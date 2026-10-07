export interface Vec2 { x: number; y: number }
export interface Circle extends Vec2 { radius: number }

export interface WeaponConfig {
    cooldown: number;
    damage: number;
    speed: number;
    lifetime: number;
}

export interface GameConfig {
    arena: { width: number; height: number };
    islands: Circle[];
    player: {
        maxHealth: number;
        radius: number;
        speed: number;
        turnSpeed: number;
        spawn: Vec2 & { angle: number };
    };
    frontWeapon: WeaponConfig;
    sideWeapon: WeaponConfig & { spread: number };
}

export interface Input {
    forward: boolean;
    turnLeft: boolean;
    turnRight: boolean;
    fireFront: boolean;
    fireLeft: boolean;
    fireRight: boolean;
}

export interface Projectile extends Vec2 {
    id: number;
    owner: 'player' | 'enemy';
    vx: number;
    vy: number;
    damage: number;
    ttl: number;
}

export interface Ship extends Circle { angle: number; health: number }

export interface Player extends Ship {
    cooldowns: { front: number; left: number; right: number };
}

export interface GameState {
    time: number;
    nextId: number;
    player: Player;
    projectiles: Projectile[];
}