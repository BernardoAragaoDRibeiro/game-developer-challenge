import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { loadLastResult, saveLastResult } from './result';
import {
    buildConfig, DEFAULT_SETTINGS, loadSettings, saveSettings, validateSettings,
} from './settings';

function fakeStorage() {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, v),
        },
    });
    return data;
}

describe('settings validation', () => {
    it('accepts the defaults and the limits', () => {
        expect(validateSettings(DEFAULT_SETTINGS)).toEqual({});
        expect(validateSettings({ sessionTime: 60, spawnInterval: 1 })).toEqual({});
        expect(validateSettings({ sessionTime: 180, spawnInterval: 10 })).toEqual({});
    });

    it('rejects out-of-range, fractional and non-numeric values', () => {
        const e = validateSettings({ sessionTime: 59, spawnInterval: 0 });
        expect(Object.keys(e)).toEqual(['sessionTime', 'spawnInterval']);
        expect(Object.keys(validateSettings({ sessionTime: 90.5, spawnInterval: 3 }))).toEqual(['sessionTime']);
        expect(Object.keys(validateSettings({ sessionTime: NaN, spawnInterval: NaN }))).toEqual(['sessionTime', 'spawnInterval']);
        expect(Object.keys(validateSettings({ sessionTime: 90, spawnInterval: 11 }))).toEqual(['spawnInterval']);
    });
});

describe('settings persistence', () => {
    beforeEach(() => void fakeStorage());

    it('round-trips saved settings', () => {
        saveSettings({ sessionTime: 120, spawnInterval: 2.5 });
        expect(loadSettings()).toEqual({ sessionTime: 120, spawnInterval: 2.5 });
    });

    it('falls back to defaults for missing, corrupted or invalid data', () => {
        expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
        localStorage.setItem('pirate-battle:settings', '{not json');
        expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
        localStorage.setItem('pirate-battle:settings', JSON.stringify({ sessionTime: 5, spawnInterval: 3 }));
        expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('builds a config snapshot without touching the base config', () => {
        const cfg = buildConfig({ sessionTime: 120, spawnInterval: 2 });
        expect(cfg.match.duration).toBe(120);
        expect(cfg.match.spawnInterval).toBe(2);
        expect(cfg.match.maxEnemies).toBe(GAME_CONFIG.match.maxEnemies);
        expect(GAME_CONFIG.match.duration).toBe(90);
    });

    it('persists and validates the last result', () => {
        expect(loadLastResult()).toBe(null);
        const r = {
            matchId: 'm-1', score: 7, playedSeconds: 61.5, reason: 'death' as const,
            finishedAt: '2026-10-08T10:00:00.000Z', settings: { sessionTime: 90, spawnInterval: 3 },
        };
        saveLastResult(r);
        expect(loadLastResult()).toEqual(r);
        localStorage.setItem('pirate-battle:last-result', JSON.stringify({ score: 'x' }));
        expect(loadLastResult()).toBe(null);
    });
});