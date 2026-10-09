import type { EnemyKind, EndReason, GameConfig } from '../game/types';

// Active only with ?e2e=1. ?seed=N fixes the random seed, ?config={...} overrides gameplay config.
// The clock becomes manual (advance()), but rules, input and rendering stay the real ones.
export interface TestSnapshot {
    time: number;
    status: 'playing' | 'ended';
    endReason: EndReason | null;
    score: number;
    paused: boolean;
    spawned: number;
    player: { x: number; y: number; angle: number; health: number };
    enemies: { id: number; kind: EnemyKind; x: number; y: number; health: number }[];
    projectiles: { owner: 'player' | 'enemy'; x: number; y: number; vx: number; vy: number }[];
}

export interface PirateTestApi {
    advance(seconds: number): void;
    snapshot(): TestSnapshot;
}

declare global {
    interface Window {
        __pirate?: PirateTestApi;
    }
}

export interface E2EOptions {
    seed: number;
    overrides: Record<string, unknown>;
}

export function readE2E(search: string): E2EOptions | null {
    const params = new URLSearchParams(search);
    if (params.get('e2e') !== '1') return null;
    const seed = Number(params.get('seed') ?? 1);
    let overrides: Record<string, unknown> = {};
    try {
        const raw: unknown = JSON.parse(params.get('config') ?? '{}');
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
            overrides = raw as Record<string, unknown>;
        }
    } catch {
        overrides = {};
    }
    return { seed: Number.isFinite(seed) ? seed : 1, overrides };
}

export const E2E: E2EOptions | null =
    typeof window === 'undefined' ? null : readE2E(window.location.search);

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function merge(base: unknown, patch: unknown): unknown {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) out[k] = k in base ? merge(base[k], v) : v;
    return out;
}

export function applyOverrides(config: GameConfig, overrides: Record<string, unknown>): GameConfig {
    return merge(config, overrides) as GameConfig;
}