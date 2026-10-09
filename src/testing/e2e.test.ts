import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../game/config';
import { applyOverrides, readE2E } from './e2e';

describe('e2e instrumentation', () => {
    it('stays off unless ?e2e=1 is present', () => {
        expect(readE2E('')).toBe(null);
        expect(readE2E('?seed=5')).toBe(null);
        expect(readE2E('?e2e=1')?.seed).toBe(1);
        expect(readE2E('?e2e=1&seed=42')?.seed).toBe(42);
        expect(readE2E('?e2e=1&seed=abc')?.seed).toBe(1);
    });

    it('ignores malformed or non-object config overrides', () => {
        expect(readE2E('?e2e=1&config=%7Bbroken')?.overrides).toEqual({});
        expect(readE2E('?e2e=1&config=%5B1%5D')?.overrides).toEqual({});
        expect(readE2E('?e2e=1&config=%7B%22player%22%3A%7B%22maxHealth%22%3A999%7D%7D')?.overrides).toEqual({ player: { maxHealth: 999 } });
    });

    it('merges nested overrides without touching the base config', () => {
        const cfg = applyOverrides(GAME_CONFIG, { player: { maxHealth: 999 }, match: { maxEnemies: 0 } });
        expect(cfg.player.maxHealth).toBe(999);
        expect(cfg.player.speed).toBe(GAME_CONFIG.player.speed);
        expect(cfg.match.maxEnemies).toBe(0);
        expect(cfg.match.duration).toBe(GAME_CONFIG.match.duration);
        expect(GAME_CONFIG.player.maxHealth).toBe(100);
    });
});