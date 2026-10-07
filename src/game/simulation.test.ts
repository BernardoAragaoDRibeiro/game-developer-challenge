import { describe, expect, it } from 'vitest';
import { GAME_CONFIG as C } from './config';
import { createState, NO_INPUT, step } from './simulation';
import type { Input } from './types';

const DT = 1 / 60;
const press = (o: Partial<Input>): Input => ({ ...NO_INPUT, ...o });

describe('player movement', () => {
    it('cannot cross an island', () => {
        const s = createState(C);
        for (let i = 0; i < 300; i++) step(s, press({ forward: true }), DT, C);
        const island = C.islands[0]!;
        const dist = Math.hypot(s.player.x - island.x, s.player.y - island.y);
        expect(dist).toBeGreaterThanOrEqual(island.radius + C.player.radius);
    });

    it('stays inside the arena', () => {
        const s = createState(C);
        s.player.angle = -Math.PI / 2;
        for (let i = 0; i < 300; i++) step(s, press({ forward: true }), DT, C);
        expect(s.player.y).toBeGreaterThanOrEqual(C.player.radius);
    });
});

describe('weapons', () => {
    it('front cannon respects its cooldown', () => {
        const s = createState(C);
        step(s, press({ fireFront: true }), DT, C);
        step(s, press({ fireFront: true }), DT, C);
        expect(s.projectiles).toHaveLength(1);
        for (let i = 0; i < 30; i++) step(s, NO_INPUT, DT, C);
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
        for (let i = 0; i < 60; i++) step(s, NO_INPUT, DT, C);
        expect(s.projectiles).toHaveLength(0);
    });
});