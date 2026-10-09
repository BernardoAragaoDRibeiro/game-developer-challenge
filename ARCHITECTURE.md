# Architecture

This document describes the key design decisions behind Pirate Battle: how React and PixiJS coexist, how the simulation runs, how collisions work, how resources are managed, and how the ranking and history integrations are handled.

---

## Table of Contents

1. [High-level overview](#high-level-overview)
2. [React / PixiJS boundary](#react--pixijs-boundary)
3. [Simulation loop](#simulation-loop)
4. [Collision model](#collision-model)
5. [Enemy behaviour](#enemy-behaviour)
6. [Resource management and lifecycle](#resource-management-and-lifecycle)
7. [Local persistence](#local-persistence)
8. [Ranking and match history integration](#ranking-and-match-history-integration)
9. [MSW mock layer](#msw-mock-layer)
10. [Testing instrumentation](#testing-instrumentation)
11. [Limitations and known trade-offs](#limitations-and-known-trade-offs)

---

## High-level overview

```
┌─────────────────────────────────────────────────────────────────┐
│  React (UI layer)                                               │
│  App → MainMenu / OptionsScreen / GameScreen / ResultScreen     │
│  State: current screen, last result, registration status        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ mounts / unmounts
┌──────────────────────▼──────────────────────────────────────────┐
│  GameSession  (src/game/session.ts)                             │
│  Owns: PixiJS Application, GameState, keyboard input           │
│  Drives: simulation.step() on every ticker tick                 │
│  Emits: HudSnapshot (score / time / paused) via callback        │
└──────┬────────────────────────────────────────────┬────────────┘
       │                                            │
┌──────▼──────────┐                     ┌──────────▼────────────┐
│  simulation.ts  │                     │  renderer.ts          │
│  Pure functions │                     │  GameRenderer (PixiJS)│
│  No I/O         │                     │  Reads state, draws   │
│  Deterministic  │                     │  sprites & effects    │
└─────────────────┘                     └───────────────────────┘
```

The simulation is a **plain-object state machine** with no side effects.  
The renderer is a **read-only view** of that state — it never writes to it.  
React only re-renders when `HudSnapshot` changes (score, time, pause, end).

---

## React / PixiJS boundary

### Why keep them strictly separated

PixiJS runs a 60 fps ticker. Triggering a React re-render every frame would be prohibitively expensive. The solution is to push the continuous game state into the simulation and surface only coarse UI signals to React.

### HudSnapshot — the bridge

`GameSession` tracks the last serialised `HudSnapshot` and calls `onHud` only when it changes:

```ts
// session.ts
private emitHud(): void {
    const hud: HudSnapshot = { score, secondsLeft, paused, ended, endReason };
    const key = JSON.stringify(hud);
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.callbacks.onHud(hud);
}
```

`secondsLeft` is a ceiling integer, so it updates at most once per second.  
`score` and `paused` change rarely. React only re-renders when something the user actually sees has changed.

### Canvas ownership

`GameSession.start()` appends the PixiJS `<canvas>` to a `<div ref>` inside `GameScreen`.  
React does not manage the canvas element — it owns the `<div>` wrapper.  
On unmount, `GameScreen` calls `session.destroy()`, which removes the canvas and disposes all PixiJS resources.

### Strict Mode safety

`useEffect` in `GameScreen` stores the session in a `ref` and uses an `active` flag so the double-invocation in React Strict Mode is safe:

```ts
useEffect(() => {
    let active = true;
    const session = new GameSession(…);
    session.start().then(() => { if (!active) return; … });
    return () => { active = false; session.destroy(); };
}, [config, settings, attempt]);
```

The first (discarded) effect's `destroy()` runs before the second `start()`.

---

## Simulation loop

### Fixed timestep

The simulation runs at a fixed `DT = 1/60` s regardless of monitor refresh rate.  
`GameSession` accumulates real elapsed time and drains it in fixed steps:

```ts
this.acc += Math.min(ticker.deltaMS / 1000, 0.1); // cap at 100 ms to survive tab switches
while (this.acc >= DT) {
    step(this.state, this.merged, DT, this.config);
    this.acc -= DT;
}
```

The 100 ms cap prevents a spiral of death after a long tab-switch pause.

### `step()` — what happens per tick

1. **Advance time** — cooldowns, match clock.
2. **Apply player input** — rotation, forward movement, weapon fire.
3. **Update enemies** — steer, move, fire (shooters).
4. **Update projectiles** — move, check TTL, check obstacle hit, apply damage.
5. **Remove dead enemies** — add to score, emit explosion event.
6. **Spawn timer** — attempt to spawn a new enemy when the timer expires.
7. **End condition** — check player health and match duration.

### Seeded RNG

`GameState.rng` is a 32-bit Mulberry32 generator.  
All randomness (spawn positions, kind selection) runs through `random(state)`, making every match with the same seed fully reproducible.

### Manual clock (E2E mode)

When `?e2e=1` is present, `GameSession` sets `manualClock = true`.  
The ticker still runs (keeping PixiJS and the renderer alive), but the simulation is not advanced automatically.  
Tests drive time with `window.__pirate.advance(seconds)`, which calls `step()` the exact number of fixed ticks needed.

---

## Collision model

All collision checks use **circle vs. circle** and **circle vs. axis-aligned rectangle** (arena bounds).

### Arena bounds

```ts
if (x - radius < 0 || y - radius < 0 || x + radius > width || y + radius > height) return true;
```

### Island collision

```ts
config.islands.some((i) => Math.hypot(x - i.x, y - i.y) < i.radius + radius)
```

### Sliding movement

`moveShip` attempts the combined `(dx, dy)` move first.  
If blocked, it tries `(dx, 0)` and `(0, dy)` independently.  
This gives smooth sliding along island edges and arena walls.

### Projectile removal

A projectile is removed the first time it:
- runs out of TTL (`ttl <= 0`)
- hits an obstacle (`isBlocked(x, y, 0, config)` — point check)
- hits its target (circle overlap)

`isBlocked` is called with `radius = 0` for projectiles so that the projectile's centre crossing into any obstacle terminates it.

### Chaser contact damage

The Chaser is removed immediately upon contact with the player (`dist < e.radius + p.radius`).  
A `continue` statement in the enemy update loop skips the `survivors.push(e)` call — no extra health tracking needed.

---

## Enemy behaviour

### Chaser

1. `steerTowards(player)` — rotate up to `turnSpeed * dt` rad per tick toward the player.
2. Move forward at `speed * dt` px per tick.
3. On contact: deal `contactDamage`, emit explosion, remove self (no score awarded).

### Shooter

1. `steerTowards(player)` — same steering as Chaser.
2. If `dist > keepDistance`, advance toward the player.
3. If `dist ≤ attackRange` and aim error ≤ `aimTolerance` and `cooldown === 0`: fire, reset cooldown.

`aimTolerance` (radians) prevents the Shooter from firing while still swinging its bow onto the player, giving the player a brief window to dodge.

### Spawn strategy

1. Attempt up to 20 random positions.
2. Accept a position only if it is outside the `minSpawnDistance` from the player **and** not inside an island (checked with a slightly enlarged radius `+10` to keep a margin).
3. If no valid position is found in 20 attempts, retry after `SPAWN_RETRY_DELAY = 0.25 s`.
4. The first spawn is always a Chaser, the second always a Shooter; after that, `shooterChance` governs the mix.

---

## Resource management and lifecycle

### PixiJS objects

Every entity that enters the arena gets a `ShipView` or a `Sprite` created in the renderer.  
Entities that leave (dead enemies, expired projectiles) are destroyed in the same `sync()` call:

```ts
for (const [id, view] of this.enemyViews) {
    if (!liveEnemies.has(id)) {
        view.container.destroy({ children: true });
        this.enemyViews.delete(id);
    }
}
```

`destroy({ children: true })` releases GPU textures and removes display objects from the scene graph.

### Texture reuse

The entire sprite sheet is loaded once into an `Atlas` (`Map<string, Texture>`).  
All `ShipView` instances share the same base textures — only the frame is different.  
`Texture` objects in the atlas are lightweight wrappers around a single shared `TextureSource` (the PNG bitmap); they are never duplicated.

### Event listeners

`GameSession` registers four listeners:
- `window.keydown` — pause toggle
- `window.blur` — auto-pause
- `document.visibilitychange` — auto-pause
- Keyboard input listeners (managed by `createKeyboardInput`, disposed separately)

All four are removed in `destroy()`.

### Accumulated input guard

On pause and on resume, `clearInput()` resets all keyboard and touch input flags **and** drains the accumulator (`this.acc = 0`).  
This prevents queued movement or shots from the paused period from being replayed when the game resumes.

---

## Local persistence

| Data | Key | Format |
|---|---|---|
| User settings | `pirate-battle:settings` | `{ sessionTime, spawnInterval }` |
| Last match result | `pirate-battle:last-result` | `MatchResult` |
| Pending registrations | `pirate-battle:pending` | `MatchRecord[]` |
| Network mock settings | `pirate-battle:net-settings` | `NetworkSettings` |
| Confirmed mock records | `pirate-battle:records` | `MatchRecord[]` |

All reads are wrapped in `try/catch` so that storage restrictions (private mode, quota exceeded) degrade gracefully to defaults.

### Pending registrations

When a match finishes, `useMatchRegistrations.enqueue()`:
1. Saves the record to `pending` in `localStorage`.
2. Immediately fires the API call.
3. On success: removes from `pending`, invalidates TanStack Query caches.
4. On failure: leaves the record in `pending`; the user can retry manually from the Main Menu or Result screen.

On app load, `useEffect` drains any leftover pending records automatically (one attempt per session).

---

## Ranking and match history integration

### API contracts (`src/api/contracts.ts`)

```ts
MatchRecord        — canonical record shared by both endpoints
RankingEntry       — MatchRecord + rank (computed server-side / mock-side)
Page<T>            — { items, page, pageSize, total, totalPages }
RegisterMatchResponse — { record, created }
```

### Queries (`src/api/queries.ts`)

- `useRanking(config, page)` — filtered by `sessionTime` + `spawnInterval`; `keepPreviousData` prevents content flicker on pagination.
- `useHistory(playerId, page)` — same pattern.

Both queries are invalidated via `queryClient.invalidateQueries` after a successful registration.  
Tabs are also refreshed when they come back into view (`refetchOnWindowFocus` default from TanStack Query).

### Ranking tie-breaking

When two entries have the same score **and** the same config, the earlier `playedAt` timestamp wins (ascending ISO string sort in the mock DB).  
This is deterministic and documented in `src/mocks/db.ts`.

### Idempotent registration

The `POST /api/matches` handler checks whether `matchId` already exists in storage before writing.  
If it does, it returns the existing record with `created: false`.  
This handles the `register-timeout-after-commit` scenario: after the timeout, the client retries with the same `matchId` and receives the original record without duplication.

`registerMatch` in `src/api/client.ts` uses `axios` with a configurable timeout.  
On timeout, the pending record remains in `localStorage`; the next retry sends the same `matchId`.

### Cache invalidation after registration

```ts
onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['ranking'] });
    void queryClient.invalidateQueries({ queryKey: ['history'] });
},
```

Both tabs are invalidated as a unit so the user always sees a consistent view after their match is registered.

---

## MSW mock layer

MSW intercepts requests at the network level (service worker), so Axios sees real HTTP responses — including error status codes, network failures, and delays.

### Shared state between development and tests

Handlers (`src/mocks/handlers.ts`), the in-memory/localStorage DB (`src/mocks/db.ts`), fixtures (`src/mocks/fixtures.ts`), and scenario logic (`src/mocks/scenarios.ts`) are all imported directly in both the browser worker (`src/mocks/browser.ts`) and in Vitest unit tests (`src/mocks/mocks.test.ts`).

### Scenario resolution

`resolveBehavior(networkSettings, kind, ctx)` maps a `ScenarioId` to a `Behavior` (latency, outcome, flags).  
Randomness inside scenarios (`variable-latency`) is drawn from a seeded RNG stored in `ctx`, so tests can reproduce any sequence of latencies.

### Out-of-order protection

`registerMatch` in `src/api/client.ts` stores the latest `matchId` sent and ignores any response that arrives after a newer one has been dispatched.  
`useRanking` and `useHistory` rely on TanStack Query's built-in stale-while-revalidate and `keepPreviousData` to avoid showing older data over newer data.

---

## Testing instrumentation

When the URL contains `?e2e=1`, `GameScreen` creates `GameSession` with `manualClock: true` and exposes:

```ts
window.__pirate = {
    advance(seconds): void,   // run exactly Math.round(seconds / DT) simulation steps
    snapshot(): TestSnapshot, // serialisable view of the full game state
}
```

`TestSnapshot` includes player position/health, all enemy positions/health, all projectile positions/velocities, score, time, and end state.

Tests never inspect PixiJS internals — they only call `advance()` and `snapshot()`, then assert against DOM elements or snapshot values.  
This keeps tests fast (no arbitrary `waitFor` loops) and deterministic (seed + manual clock = identical physics every run).

---

## Limitations and known trade-offs

- **Single island** — the arena ships with one circular island centred at (640, 360). The config supports an arbitrary array of `Circle` obstacles, but the default map was tuned for one.
- **Circle-only collision** — ship hulls are represented as circles. Rectangular hulls with SAT or OBB collision would be more accurate but add complexity without significantly changing the feel at this scale.
- **No audio** — WAV assets are included in the repository but playback was not implemented in this version.
- **No visual regression baselines committed** — `playwright test --update-snapshots` must be run once before the visual regression tests pass. Baselines are machine-dependent.
- **MSW in production build** — the service worker (`public/mockServiceWorker.js`) is included in the production build by design, as required by the challenge specification. In a real product this would be gated by an environment variable.
- **Player name** — generated deterministically from the player UUID (`src/api/ids.ts`); no name-entry screen is provided.
