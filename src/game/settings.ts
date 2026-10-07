import { GAME_CONFIG } from './config';
import type { GameConfig } from './types';

export interface Settings {
    sessionTime: number;
    spawnInterval: number;
}

export const SETTINGS_LIMITS = {
    sessionTime: { min: 60, max: 180, step: 5 },
    spawnInterval: { min: 1, max: 10, step: 0.5 },
} as const;

export const DEFAULT_SETTINGS: Settings = {
    sessionTime: GAME_CONFIG.match.duration,
    spawnInterval: GAME_CONFIG.match.spawnInterval,
};

export type SettingsErrors = Partial<Record<keyof Settings, string>>;

export function validateSettings(s: Settings): SettingsErrors {
    const errors: SettingsErrors = {};
    const t = SETTINGS_LIMITS.sessionTime;
    if (!Number.isInteger(s.sessionTime) || s.sessionTime < t.min || s.sessionTime > t.max) {
        errors.sessionTime = `Enter a whole number of seconds between ${t.min} and ${t.max}.`;
    }
    const i = SETTINGS_LIMITS.spawnInterval;
    if (!Number.isFinite(s.spawnInterval) || s.spawnInterval < i.min || s.spawnInterval > i.max) {
        errors.spawnInterval = `Enter a number of seconds between ${i.min} and ${i.max}.`;
    }
    return errors;
}

export function buildConfig(s: Settings): GameConfig {
    return {
        ...GAME_CONFIG,
        match: { ...GAME_CONFIG.match, duration: s.sessionTime, spawnInterval: s.spawnInterval },
    };
}

const KEY = 'pirate-battle:settings';

export function loadSettings(): Settings {
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        if (typeof raw === 'object' && raw !== null) {
            const { sessionTime, spawnInterval } = raw as Record<string, unknown>;
            if (typeof sessionTime === 'number' && typeof spawnInterval === 'number') {
                const loaded = { sessionTime, spawnInterval };
                if (Object.keys(validateSettings(loaded)).length === 0) return loaded;
            }
        }
    } catch {
        // storage unavailable or corrupted: fall back to defaults
    }
    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
        // storage unavailable: settings just won't persist
    }
}