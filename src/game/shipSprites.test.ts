import { describe, expect, it } from 'vitest';
import { damageTier, shipSpriteName } from './shipSprites';

describe('ship sprites', () => {
    it('maps health to damage tiers', () => {
        expect(damageTier(1)).toBe(0);
        expect(damageTier(0.5)).toBe(1);
        expect(damageTier(0.2)).toBe(2);
        expect(damageTier(0)).toBe(2);
    });

    it('picks the right sprite per colour and tier', () => {
        expect(shipSpriteName('yellow', 0)).toBe('ship_6.png');
        expect(shipSpriteName('yellow', 2)).toBe('ship_18.png');
        expect(shipSpriteName('red', 0)).toBe('ship_3.png');
        expect(shipSpriteName('red', 1)).toBe('ship_9.png');
        expect(shipSpriteName('red', 2)).toBe('ship_15.png');
        expect(shipSpriteName('black', 0)).toBe('ship_2.png');
        expect(shipSpriteName('black', 1)).toBe('ship_8.png');
        expect(shipSpriteName('black', 2)).toBe('ship_14.png');
    });
});