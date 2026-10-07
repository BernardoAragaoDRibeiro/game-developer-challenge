import type {
    Circle, Enemy, EnemyKind, EndReason, GameConfig, GameEvent, GameState, Input, Ship,
    WeaponConfig,
} from './types';

export const NO_INPUT: Input = {
    forward: false, turnLeft: false, turnRight: false,
    fireFront: false, fireLeft: false, fireRight: false,
};

const SPAWN_RETRY_DELAY = 0.25;
const SPAWN_ATTEMPTS = 20;

function random(state: GameState): number {
    state.rng = (state.rng + 0x6d2b79f5) >>> 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createState(config: GameConfig, seed = 1): GameState {
    const { spawn, maxHealth, radius } = config.player;
    return {
        time: 0,
        status: 'playing',
        endReason: null,
        score: 0,
        nextId: 1,
        rng: seed >>> 0,
        spawnTimer: config.match.spawnInterval,
        spawned: 0,
        enemies: [],
        projectiles: [],
        events: [],
        player: {
            x: spawn.x, y: spawn.y, angle: spawn.angle, radius,
            health: maxHealth, maxHealth,
            cooldowns: { front: 0, left: 0, right: 0 },
        },
    };
}

export function drainEvents(state: GameState): GameEvent[] {
    const events = state.events;
    state.events = [];
    return events;
}

function isBlocked(x: number, y: number, radius: number, config: GameConfig): boolean {
    const { width, height } = config.arena;
    if (x - radius < 0 || y - radius < 0 || x + radius > width || y + radius > height) return true;
    return config.islands.some((i) => Math.hypot(x - i.x, y - i.y) < i.radius + radius);
}

export function moveShip(ship: Circle, dx: number, dy: number, config: GameConfig): void {
    if (!isBlocked(ship.x + dx, ship.y + dy, ship.radius, config)) {
        ship.x += dx;
        ship.y += dy;
    } else if (!isBlocked(ship.x + dx, ship.y, ship.radius, config)) {
        ship.x += dx;
    } else if (!isBlocked(ship.x, ship.y + dy, ship.radius, config)) {
        ship.y += dy;
    }
}

function projectileHits(px: number, py: number, target: Circle, config: GameConfig): boolean {
    return Math.hypot(px - target.x, py - target.y) < target.radius + config.projectileRadius;
}

function spawnProjectile(
    state: GameState, owner: 'player' | 'enemy',
    x: number, y: number, angle: number, w: WeaponConfig,
): void {
    state.projectiles.push({
        id: state.nextId++, owner, x, y,
        vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed,
        damage: w.damage, ttl: w.lifetime,
    });
    state.events.push({ type: 'shot', x, y });
}

function fireFront(state: GameState, config: GameConfig): void {
    const p = state.player;
    spawnProjectile(
        state, 'player',
        p.x + Math.cos(p.angle) * p.radius,
        p.y + Math.sin(p.angle) * p.radius,
        p.angle,
        config.frontWeapon,
    );
}

function fireSide(state: GameState, config: GameConfig, side: 1 | -1): void {
    const p = state.player;
    const w = config.sideWeapon;
    const shotAngle = p.angle + (side * Math.PI) / 2;
    const hx = Math.cos(p.angle), hy = Math.sin(p.angle);
    const sx = Math.cos(shotAngle), sy = Math.sin(shotAngle);
    for (const k of [-1, 0, 1]) {
        spawnProjectile(
            state, 'player',
            p.x + sx * p.radius + hx * k * w.spread,
            p.y + sy * p.radius + hy * k * w.spread,
            shotAngle,
            w,
        );
    }
}

export function createEnemy(
    state: GameState, kind: EnemyKind, x: number, y: number, config: GameConfig,
): Enemy {
    const c = config[kind];
    const enemy: Enemy = {
        id: state.nextId++, kind, x, y, radius: c.radius,
        angle: Math.atan2(state.player.y - y, state.player.x - x),
        health: c.maxHealth, maxHealth: c.maxHealth,
        cooldown: kind === 'shooter' ? config.shooter.weapon.cooldown : 0,
    };
    state.enemies.push(enemy);
    return enemy;
}

function normalizeAngle(a: number): number {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

function steerTowards(ship: Ship, tx: number, ty: number, turnSpeed: number, dt: number): number {
    const diff = normalizeAngle(Math.atan2(ty - ship.y, tx - ship.x) - ship.angle);
    const maxTurn = turnSpeed * dt;
    ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    return diff - Math.max(-maxTurn, Math.min(maxTurn, diff));
}

function damagePlayer(state: GameState, amount: number, x: number, y: number): void {
    state.player.health = Math.max(0, state.player.health - amount);
    state.events.push({ type: 'hit', x, y });
}

function updateEnemies(state: GameState, dt: number, config: GameConfig): void {
    const p = state.player;
    const survivors: Enemy[] = [];

    for (const e of state.enemies) {
        const dist = Math.hypot(p.x - e.x, p.y - e.y);

        if (e.kind === 'chaser') {
            const c = config.chaser;
            steerTowards(e, p.x, p.y, c.turnSpeed, dt);
            moveShip(e, Math.cos(e.angle) * c.speed * dt, Math.sin(e.angle) * c.speed * dt, config);

            if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
                damagePlayer(state, c.contactDamage, e.x, e.y);
                state.events.push({ type: 'explosion', x: e.x, y: e.y });
                continue;
            }
        } else {
            const s = config.shooter;
            const aimError = steerTowards(e, p.x, p.y, s.turnSpeed, dt);
            if (dist > s.keepDistance) {
                moveShip(e, Math.cos(e.angle) * s.speed * dt, Math.sin(e.angle) * s.speed * dt, config);
            }
            e.cooldown = Math.max(0, e.cooldown - dt);
            if (dist <= s.attackRange && Math.abs(aimError) <= s.aimTolerance && e.cooldown === 0) {
                spawnProjectile(
                    state, 'enemy',
                    e.x + Math.cos(e.angle) * e.radius, e.y + Math.sin(e.angle) * e.radius,
                    e.angle, s.weapon,
                );
                e.cooldown = s.weapon.cooldown;
            }
        }
        survivors.push(e);
    }
    state.enemies = survivors;
}

function trySpawn(state: GameState, config: GameConfig): boolean {
    const { arena, match } = config;
    const kind: EnemyKind =
        state.spawned === 0 ? 'chaser'
            : state.spawned === 1 ? 'shooter'
                : random(state) < match.shooterChance ? 'shooter' : 'chaser';
    const radius = config[kind].radius;

    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
        const x = radius + random(state) * (arena.width - 2 * radius);
        const y = radius + random(state) * (arena.height - 2 * radius);
        const farFromPlayer =
            Math.hypot(x - state.player.x, y - state.player.y) >= match.minSpawnDistance;
        if (farFromPlayer && !isBlocked(x, y, radius + 10, config)) {
            createEnemy(state, kind, x, y, config);
            state.spawned++;
            return true;
        }
    }
    return false;
}

function endMatch(state: GameState, reason: EndReason): void {
    state.status = 'ended';
    state.endReason = reason;
    if (reason === 'death') {
        state.events.push({ type: 'explosion', x: state.player.x, y: state.player.y });
    }
}

export function step(state: GameState, input: Input, dt: number, config: GameConfig): void {
    if (state.status === 'ended') return;

    const p = state.player;
    state.time += dt;

    for (const key of ['front', 'left', 'right'] as const) {
        p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
    }
    const turn = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
    p.angle += turn * config.player.turnSpeed * dt;
    if (input.forward) {
        const d = config.player.speed * dt;
        moveShip(p, Math.cos(p.angle) * d, Math.sin(p.angle) * d, config);
    }
    if (input.fireFront && p.cooldowns.front === 0) {
        fireFront(state, config);
        p.cooldowns.front = config.frontWeapon.cooldown;
    }
    if (input.fireLeft && p.cooldowns.left === 0) {
        fireSide(state, config, -1);
        p.cooldowns.left = config.sideWeapon.cooldown;
    }
    if (input.fireRight && p.cooldowns.right === 0) {
        fireSide(state, config, 1);
        p.cooldowns.right = config.sideWeapon.cooldown;
    }

    updateEnemies(state, dt, config);

    const alive: typeof state.projectiles = [];
    for (const pr of state.projectiles) {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.ttl -= dt;
        if (pr.ttl <= 0 || isBlocked(pr.x, pr.y, 0, config)) continue;

        if (pr.owner === 'player') {
            const target = state.enemies.find((e) => e.health > 0 && projectileHits(pr.x, pr.y, e, config));
            if (target) {
                target.health -= pr.damage;
                state.events.push({ type: 'hit', x: pr.x, y: pr.y });
                continue;
            }
        } else if (projectileHits(pr.x, pr.y, p, config)) {
            damagePlayer(state, pr.damage, pr.x, pr.y);
            continue;
        }
        alive.push(pr);
    }
    state.projectiles = alive;

    state.enemies = state.enemies.filter((e) => {
        if (e.health > 0) return true;
        state.score += 1;
        state.events.push({ type: 'explosion', x: e.x, y: e.y });
        return false;
    });

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
        if (state.enemies.length >= config.match.maxEnemies) {
            state.spawnTimer += config.match.spawnInterval;
        } else if (trySpawn(state, config)) {
            state.spawnTimer += config.match.spawnInterval;
        } else {
            state.spawnTimer = SPAWN_RETRY_DELAY;
        }
    }

    if (p.health <= 0) {
        endMatch(state, 'death');
    } else if (state.time >= config.match.duration) {
        state.time = config.match.duration;
        endMatch(state, 'time');
    }
}