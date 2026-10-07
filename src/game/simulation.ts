import type { GameConfig, GameState, Input, Ship, WeaponConfig } from './types';

export const NO_INPUT: Input = {
    forward: false, turnLeft: false, turnRight: false,
    fireFront: false, fireLeft: false, fireRight: false,
};

export function createState(config: GameConfig): GameState {
    const { spawn, maxHealth, radius } = config.player;
    return {
        time: 0,
        nextId: 1,
        projectiles: [],
        player: {
            x: spawn.x, y: spawn.y, angle: spawn.angle, radius,
            health: maxHealth,
            cooldowns: { front: 0, left: 0, right: 0 },
        },
    };
}

function isBlocked(x: number, y: number, radius: number, config: GameConfig): boolean {
    const { width, height } = config.arena;
    if (x - radius < 0 || y - radius < 0 || x + radius > width || y + radius > height) return true;
    return config.islands.some((i) => Math.hypot(x - i.x, y - i.y) < i.radius + radius);
}

export function moveShip(ship: Ship, dx: number, dy: number, config: GameConfig): void {
    if (!isBlocked(ship.x + dx, ship.y + dy, ship.radius, config)) {
        ship.x += dx;
        ship.y += dy;
    } else if (!isBlocked(ship.x + dx, ship.y, ship.radius, config)) {
        ship.x += dx;
    } else if (!isBlocked(ship.x, ship.y + dy, ship.radius, config)) {
        ship.y += dy;
    }
}

function spawnProjectile(
    state: GameState, x: number, y: number, angle: number, w: WeaponConfig,
): void {
    state.projectiles.push({
        id: state.nextId++, owner: 'player', x, y,
        vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed,
        damage: w.damage, ttl: w.lifetime,
    });
}

function fireFront(state: GameState, config: GameConfig): void {
    const p = state.player;
    spawnProjectile(
        state,
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
            state,
            p.x + sx * p.radius + hx * k * w.spread,
            p.y + sy * p.radius + hy * k * w.spread,
            shotAngle,
            w,
        );
    }
}

export function step(state: GameState, input: Input, dt: number, config: GameConfig): void {
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

    state.projectiles = state.projectiles.filter((pr) => {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.ttl -= dt;
        return pr.ttl > 0 && !isBlocked(pr.x, pr.y, 0, config);
    });
}