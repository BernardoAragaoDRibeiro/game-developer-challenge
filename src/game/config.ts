import type { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
    arena: { width: 1280, height: 720 },
    islands: [{ x: 640, y: 360, radius: 90 }],
    player: {
        maxHealth: 100,
        radius: 20,
        speed: 180,
        turnSpeed: 2.5,
        spawn: { x: 200, y: 360, angle: 0 },
    },
    frontWeapon: { cooldown: 0.4, damage: 10, speed: 500, lifetime: 1.2 },
    sideWeapon: { cooldown: 1.2, damage: 10, speed: 500, lifetime: 1.2, spread: 14 },
};