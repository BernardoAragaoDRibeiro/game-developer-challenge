import type { Settings } from './settings';
import type { EndReason } from './types';

export interface MatchResult {
    score: number;
    playedSeconds: number;
    reason: EndReason;
    finishedAt: string;
    settings: Settings;
}

const KEY = 'pirate-battle:last-result';

export function saveLastResult(r: MatchResult): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(r));
    } catch {
        // storage unavailable: the result just won't persist
    }
}

export function loadLastResult(): MatchResult | null {
    try {
        const r: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        if (typeof r !== 'object' || r === null) return null;
        const o = r as Record<string, unknown>;
        const s = o.settings as Record<string, unknown> | undefined;
        const valid =
            typeof o.score === 'number' && typeof o.playedSeconds === 'number' &&
            (o.reason === 'time' || o.reason === 'death') && typeof o.finishedAt === 'string' &&
            typeof s?.sessionTime === 'number' && typeof s.spawnInterval === 'number';
        return valid ? (r as MatchResult) : null;
    } catch {
        return null;
    }
}