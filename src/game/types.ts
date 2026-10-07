export interface Vec2 { x: number; y: number }
export interface Circle extends Vec2 { radius: number }

export interface WeaponConfig {
    cooldown: number;
    damage: number;
    speed: number;
    lifetime: number;
}

interface EnemyBaseConfig {
    radius: number;
    maxHealth: number;
    speed: number;
    turnSpeed: number;
}

export interface ChaserConfig extends EnemyBaseConfig {
    contactDamage: number;
}

export interface ShooterConfig extends EnemyBaseConfig {
    attackRange: number;
    keepDistance: number;
    aimTolerance: number;
    weapon: WeaponConfig;
}

export interface MatchConfig {
    duration: number;
    spawnInterval: number;
    maxEnemies: number;
    shooterChance: number;
    minSpawnDistance: number;
}

export interface GameConfig {
    arena: { width: number; height: number };
    islands: Circle[];
    projectileRadius: number;
    match: MatchConfig;
    player: {
        maxHealth: number;
        radius: number;
        speed: number;
        turnSpeed: number;
        spawn: Vec2 & { angle: number };
    };
    frontWeapon: WeaponConfig;
    sideWeapon: WeaponConfig & { spread: number };
    chaser: ChaserConfig;
    shooter: ShooterConfig;
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

export interface Ship extends Circle {
    angle: number;
    health: number;
    maxHealth: number;
}

export interface Player extends Ship {
    cooldowns: { front: number; left: number; right: number };
}

export type EnemyKind = 'chaser' | 'shooter';

export interface Enemy extends Ship {
    id: number;
    kind: EnemyKind;
    cooldown: number;
}

export type EndReason = 'time' | 'death';

export type GameEvent =
    | { type: 'shot'; x: number; y: number }
    | { type: 'hit'; x: number; y: number }
    | { type: 'explosion'; x: number; y: number };

export interface GameState {
    time: number;
    status: 'playing' | 'ended';
    endReason: EndReason | null;
    score: number;
    nextId: number;
    rng: number;
    spawnTimer: number;
    spawned: number;
    player: Player;
    enemies: Enemy[];
    projectiles: Projectile[];
    events: GameEvent[];
}