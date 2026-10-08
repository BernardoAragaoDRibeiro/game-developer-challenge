import type { EndReason } from '../game/types';

export const RANKING_PAGE_SIZE = 10;
export const HISTORY_PAGE_SIZE = 5;

export interface MatchConfigSnapshot {
    sessionTime: number;
    spawnInterval: number;
}

export interface MatchRecord {
    matchId: string;
    playerId: string;
    playerName: string;
    playedAt: string;
    score: number;
    durationSeconds: number;
    endReason: EndReason;
    config: MatchConfigSnapshot;
}

export interface RankingEntry extends MatchRecord {
    rank: number;
}

export interface Page<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface RegisterMatchResponse {
    record: MatchRecord;
    created: boolean;
}

export function isMatchRecord(x: unknown): x is MatchRecord {
    if (typeof x !== 'object' || x === null) return false;
    const o = x as Record<string, unknown>;
    const c = o.config as Record<string, unknown> | null | undefined;
    return (
        typeof o.matchId === 'string' && o.matchId !== '' &&
        typeof o.playerId === 'string' && o.playerId !== '' &&
        typeof o.playerName === 'string' &&
        typeof o.playedAt === 'string' && !Number.isNaN(Date.parse(o.playedAt)) &&
        typeof o.score === 'number' && Number.isInteger(o.score) && o.score >= 0 &&
        typeof o.durationSeconds === 'number' && Number.isFinite(o.durationSeconds) && o.durationSeconds >= 0 &&
        (o.endReason === 'time' || o.endReason === 'death') &&
        typeof c?.sessionTime === 'number' && typeof c.spawnInterval === 'number'
    );
}