import type { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
    arena: { width: 1280, height: 720 },
    islands: [{ x: 640, y: 360, radius: 90 }],
    projectileRadius: 4,
    match: {
        duration: 90,
        spawnInterval: 3,
        maxEnemies: 8,
        shooterChance: 0.4,
        minSpawnDistance: 350,
    },
    player: {
        maxHealth: 100,
        radius: 20,
        speed: 180,
        turnSpeed: 2.5,
        spawn: { x: 200, y: 360, angle: 0 },
    },
    frontWeapon: { cooldown: 0.4, damage: 10, speed: 500, lifetime: 1.2 },
    sideWeapon: { cooldown: 1.2, damage: 10, speed: 500, lifetime: 1.2, spread: 14 },
    chaser: {
        radius: 18,
        maxHealth: 20,
        speed: 120,
        turnSpeed: 2.2,
        contactDamage: 25,
    },
    shooter: {
        radius: 20,
        maxHealth: 30,
        speed: 80,
        turnSpeed: 1.8,
        attackRange: 320,
        keepDistance: 240,
        aimTolerance: 0.25,
        weapon: { cooldown: 1.8, damage: 8, speed: 380, lifetime: 1.2 },
    },
};