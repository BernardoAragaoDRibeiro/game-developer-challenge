# Pirate Battle

A 2D top-down naval shooter built with React, TypeScript and PixiJS.  
Navigate between islands, destroy enemy ships, and climb the ranking before time runs out.

**Live demo:** [https://game-developer-challenge-mu.vercel.app](https://game-developer-challenge-mu.vercel.app)

---

## Table of Contents

1. [Setup](#setup)
2. [Available Commands](#available-commands)
3. [Controls](#controls)
4. [Gameplay Configuration](#gameplay-configuration)
5. [Network Scenarios (MSW)](#network-scenarios-msw)
6. [Playwright Tests](#playwright-tests)
7. [Environment Variables](#environment-variables)

---

## Setup

**Prerequisites:** Node.js ≥ 20 and npm ≥ 10.

```bash
# 1. Clone the repository
git clone https://github.com/BernardoAragaoDRibeiro/game-developer-challenge.git
cd game-developer-challenge

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).  
The MSW service worker starts automatically and intercepts all `/api/*` requests.

> **No external services required.** All API calls are mocked by MSW and state is persisted in `localStorage`.

---

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally (port 4173) |
| `npm run lint` | Run ESLint across the project |
| `npm run typecheck` | Run `tsc` in check mode without emitting files |
| `npm test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run all Playwright E2E tests (builds first) |
| `npm run test:e2e:desktop` | Run E2E tests in the desktop Chromium project only |
| `npm run test:e2e:update` | Regenerate Playwright visual snapshot baselines |

---

## Controls

### Keyboard

| Key | Action |
|---|---|
| `W` / `↑` | Sail forward |
| `A` / `←` | Turn left |
| `D` / `→` | Turn right |
| `Space` | Fire front cannon |
| `Q` | Fire left broadside (3 shots) |
| `E` | Fire right broadside (3 shots) |
| `P` / `Esc` | Pause / Resume |

All movement and fire actions can be held simultaneously.

### Touch (mobile)

On touch devices, six on-screen buttons appear at the bottom of the arena:
**Turn left**, **Sail forward**, **Turn right**, **Fire left broadside**, **Fire front cannon**, **Fire right broadside**.  
Multi-touch is supported — hold movement and fire at the same time.

---

## Gameplay Configuration

All game parameters are centralised in `src/game/config.ts` (`GAME_CONFIG`).  
Changing values there affects the next match without touching any game logic.

### Player-adjustable settings (Options screen / `localStorage`)

| Setting | Default | Range | Key |
|---|---|---|---|
| Game session time | 90 s | 60–180 s (integers) | `sessionTime` |
| Enemy spawn interval | 3 s | 1–10 s (0.5 steps) | `spawnInterval` |

Settings are saved to `localStorage` under the key `pirate-battle:settings` and persist across reloads.  
Each match takes a **snapshot** of the current settings at start-time; changing options mid-match has no effect on the ongoing game.

### Full config reference (`src/game/config.ts`)

```
arena         width / height of the play field (px)
islands       array of {x, y, radius} obstacles
projectileRadius  collision radius of all projectiles

match
  duration          total match time (seconds)
  spawnInterval     seconds between enemy spawns
  maxEnemies        maximum enemies alive at once
  shooterChance     probability [0-1] of spawning a Shooter
  minSpawnDistance  minimum distance from the player at spawn

player
  maxHealth / radius / speed / turnSpeed / spawn

frontWeapon   cooldown / damage / speed / lifetime
sideWeapon    cooldown / damage / speed / lifetime / spread (px between the 3 shots)

chaser        radius / maxHealth / speed / turnSpeed / contactDamage
shooter       radius / maxHealth / speed / turnSpeed
              attackRange / keepDistance / aimTolerance
              weapon: cooldown / damage / speed / lifetime
```

---

## Network Scenarios (MSW)

The **Network Panel** (gear icon in the Main Menu, bottom-right) lets you choose a scenario, set latency, and reset the mock database.

### Available scenarios

| Scenario ID | Behaviour |
|---|---|
| `success` | Normal responses; ranking has several fixture pages |
| `empty` | Ranking and history start empty (no fixtures shown) |
| `slow` | Every response takes ~15× the configured base latency |
| `variable-latency` | Random (seeded) latency; answers can arrive out of order |
| `out-of-order` | Every other request is slow, so older answers arrive after newer ones |
| `timeout` | All requests hang indefinitely |
| `connection-failure` | All requests throw a network error |
| `client-error` | All requests return HTTP 400 |
| `server-error` | All requests return HTTP 500 |
| `ranking-fails` | Only ranking requests fail (HTTP 500); history and register succeed |
| `history-fails` | Only history requests fail (HTTP 500) |
| `register-timeout-after-commit` | Registration commits the record, then hangs — simulates a timeout after the server wrote the data (idempotent retry safe) |
| `register-unavailable` | Registration returns HTTP 503; ranking and history still work |

### Selecting a scenario

1. Open the Main Menu.
2. Click the **Network** button (bottom of the menu).
3. Choose a scenario from the dropdown and adjust **Base latency (ms)** if needed.
4. Click **Apply**.  
   The new settings are saved to `localStorage` under `pirate-battle:net-settings` and survive a reload.

### Resetting to initial state

In the Network Panel, click **Reset mock database**.  
This clears all real player records from `localStorage` while keeping the current scenario setting.  
Fixture data (other players) is never stored — it is generated deterministically at query time.

### Reproducing failures in tests

E2E tests seed the network settings via `localStorage` before navigation:

```ts
await openApp(page, { net: { scenario: 'register-timeout-after-commit', latencyMs: 20 } });
```

The `timeoutMs` option controls when Axios aborts a request. E2E tests use 1 500 ms (set via `net: { timeoutMs: 1500 }`); the production default is 5 000 ms.

---

## Playwright Tests

Tests live in `e2e/` and require the production build.

```bash
# Build + run all tests (both desktop and mobile Chromium)
npm run test:e2e

# Desktop only (faster during development)
npm run test:e2e:desktop

# Update visual baseline snapshots
npm run test:e2e:update
```

### Test structure

| File | Coverage |
|---|---|
| `options.e2e.ts` | Validation, saving, and persistence of Options |
| `assets.e2e.ts` | Asset loading progress, failure, and retry |
| `movement.e2e.ts` | Movement, rotation, arena bounds, island collision |
| `combat.e2e.ts` | Weapons, cooldowns, enemy behaviours, scoring |
| `match.e2e.ts` | End by time / death, pause, result screen, persistence |
| `navigation.e2e.ts` | Abandon match, reload, repeated navigation, touch controls |

Tests run on **desktop Chromium** (1280 × 800) and **mobile Chromium** (Pixel 7 landscape).  
HTML report: `playwright-report/index.html`.  
Failure traces: `test-results/`.

### Reproducibility

Each test uses `?e2e=1` mode, which:
- fixes the RNG seed (`?seed=N`)
- switches the simulation to **manual clock** (`advance(seconds)`)
- exposes `window.__pirate.advance()` and `window.__pirate.snapshot()` for test control

Game rules, input, collisions and rendering always run the real code; only the clock is external.

---

## Environment Variables

No environment variables are required for development, build or testing.  
The app is fully self-contained: all API calls are intercepted by the MSW service worker included in `public/mockServiceWorker.js`.

For a custom production base path, set `base` in `vite.config.ts`.
