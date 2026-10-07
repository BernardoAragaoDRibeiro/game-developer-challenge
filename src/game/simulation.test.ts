import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { createEnemy, createState, NO_INPUT, step } from './simulation';
import type { GameConfig, GameState, Input } from './types';

const DT = 1 / 60;
const press = (o: Partial<Input>): Input => ({ ...NO_INPUT, ...o });

const C: GameConfig = {
    ...GAME_CONFIG,
    match: { ...GAME_CONFIG.match, spawnInterval: 1e9 },
};

function run(state: GameState, seconds: number, input: Input = NO_INPUT, config = C, dt = DT) {
    for (let t = 0; t < seconds - 1e-9; t += dt) step(state, input, dt, config);
}

describe('player movement', () => {
    it('cannot cross an island', () => {
        const s = createState(C);
        run(s, 5, press({ forward: true }));
        const island = C.islands[0]!;
        const dist = Math.hypot(s.player.x - island.x, s.player.y - island.y);
        expect(dist).toBeGreaterThanOrEqual(island.radius + C.player.radius);
    });

    it('stays inside the arena', () => {
        const s = createState(C);
        s.player.angle = -Math.PI / 2; // facing up
        run(s, 5, press({ forward: true }));
        expect(s.player.y).toBeGreaterThanOrEqual(C.player.radius);
    });
});

describe('weapons', () => {
    it('front cannon respects its cooldown', () => {
        const s = createState(C);
        step(s, press({ fireFront: true }), DT, C);
        step(s, press({ fireFront: true }), DT, C);
        expect(s.projectiles).toHaveLength(1);
        run(s, 0.5);
        step(s, press({ fireFront: true }), DT, C);
        expect(s.projectiles).toHaveLength(2);
    });

    it('left broadside fires 3 parallel shots to the left', () => {
        const s = createState(C);
        step(s, press({ fireLeft: true }), DT, C);
        expect(s.projectiles).toHaveLength(3);
        const [a, b, c] = s.projectiles;
        expect(a!.vy).toBeLessThan(0);
        expect(b!.vy).toBeCloseTo(a!.vy);
        expect(c!.vy).toBeCloseTo(a!.vy);
    });

    it('projectiles are removed when they hit an island', () => {
        const s = createState(C);
        step(s, press({ fireFront: true }), DT, C);
        run(s, 1);
        expect(s.projectiles).toHaveLength(0);
    });
});

describe('combat', () => {
    it('a player shot damages an enemy exactly once and is removed', () => {
        const s = createState(C);
        const e = createEnemy(s, 'shooter', 400, 360, C);
        e.cooldown = 1e9;
        step(s, press({ fireFront: true }), DT, C);
        run(s, 0.6);
        expect(e.health).toBe(C.shooter.maxHealth - C.frontWeapon.damage);
        expect(s.projectiles).toHaveLength(0);
    });

    it('destroying an enemy scores 1 point and removes it', () => {
        const s = createState(C);
        const e = createEnemy(s, 'chaser', 400, 360, C);
        e.health = C.frontWeapon.damage; // one hit away
        e.x = 400; e.y = 360;
        step(s, press({ fireFront: true }), DT, C);
        run(s, 0.6);
        expect(s.score).toBe(1);
        expect(s.enemies).toHaveLength(0);
    });

    it('a Chaser that rams the player hurts it, explodes and does not score', () => {
        const s = createState(C);
        createEnemy(s, 'chaser', s.player.x + 30, s.player.y, C);
        step(s, NO_INPUT, DT, C);
        expect(s.player.health).toBe(C.player.maxHealth - C.chaser.contactDamage);
        expect(s.enemies).toHaveLength(0);
        expect(s.score).toBe(0);
    });

    it('a Shooter fires only inside its attack range', () => {
        const near = createState(C);
        const n = createEnemy(near, 'shooter', near.player.x + 250, near.player.y, C);
        n.cooldown = 0;
        step(near, NO_INPUT, DT, C);
        expect(near.projectiles.filter((p) => p.owner === 'enemy')).toHaveLength(1);

        const far = createState(C);
        const f = createEnemy(far, 'shooter', far.player.x + 500, far.player.y, C);
        f.cooldown = 0;
        step(far, NO_INPUT, DT, C);
        expect(far.projectiles).toHaveLength(0);
    });

    it('enemy projectiles damage the player', () => {
        const s = createState(C);
        const e = createEnemy(s, 'shooter', s.player.x + 250, s.player.y, C);
        e.cooldown = 0;
        run(s, 1.2);
        expect(s.player.health).toBeLessThan(C.player.maxHealth);
    });
});

describe('spawning', () => {
    const S: GameConfig = { ...GAME_CONFIG, match: { ...GAME_CONFIG.match, spawnInterval: 2 } };

    it('spawns a Chaser then a Shooter, away from the player and obstacles', () => {
        const s = createState(S, 7);
        run(s, 4.1, NO_INPUT, S);
        expect(s.enemies.map((e) => e.kind)).toEqual(['chaser', 'shooter']);
        for (const e of s.enemies) {
            expect(s.spawned).toBe(2);
            const island = S.islands[0]!;
            expect(Math.hypot(e.x - island.x, e.y - island.y)).toBeGreaterThan(island.radius + e.radius);
        }
    });

    it('keeps the same cadence at different frame rates', () => {
        const a = createState(S, 3);
        const b = createState(S, 3);
        run(a, 10.1, NO_INPUT, S, 1 / 60);
        run(b, 10.1, NO_INPUT, S, 1 / 30);
        expect(a.spawned).toBe(b.spawned);
    });
});

describe('match rules', () => {
    const short: GameConfig = { ...C, match: { ...C.match, duration: 2 } };

    it('ends by time and freezes everything', () => {
        const s = createState(short);
        createEnemy(s, 'shooter', 900, 100, short);
        run(s, 2.1, press({ forward: true, fireFront: true }), short);
        expect(s.status).toBe('ended');
        expect(s.endReason).toBe('time');
        expect(s.time).toBe(2);

        const frozen = JSON.stringify(s);
        run(s, 1, press({ forward: true, fireFront: true }), short);
        expect(JSON.stringify(s)).toBe(frozen);
    });

    it('ends by death', () => {
        const s = createState(C);
        s.player.health = 10;
        createEnemy(s, 'chaser', s.player.x + 30, s.player.y, C);
        step(s, NO_INPUT, DT, C);
        expect(s.status).toBe('ended');
        expect(s.endReason).toBe('death');
        expect(s.player.health).toBe(0);
    });

    it('is deterministic for the same seed and inputs', () => {
        const play = () => {
            const s = createState(GAME_CONFIG, 42);
            run(s, 20, press({ forward: true, fireFront: true, turnRight: true }), GAME_CONFIG);
            return JSON.stringify(s);
        };
        expect(play()).toBe(play());
    });
});