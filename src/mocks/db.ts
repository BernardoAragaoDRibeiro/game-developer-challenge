import {
    isMatchRecord, type MatchConfigSnapshot, type MatchRecord, type Page, type RankingEntry,
} from '../api/contracts';
import { makeFixtures } from './fixtures';

const KEY = 'pirate-battle:mock-db';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadStored(storage: Store = localStorage): MatchRecord[] {
    try {
        const raw: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
        return Array.isArray(raw) ? raw.filter(isMatchRecord) : [];
    } catch {
        return [];
    }
}

export function findStored(matchId: string, storage: Store = localStorage): MatchRecord | undefined {
    return loadStored(storage).find((r) => r.matchId === matchId);
}

export function addRecord(
    record: MatchRecord, storage: Store = localStorage,
): { record: MatchRecord; created: boolean } {
    const all = loadStored(storage);
    const existing = all.find((r) => r.matchId === record.matchId);
    if (existing) return { record: existing, created: false };
    storage.setItem(KEY, JSON.stringify([...all, record]));
    return { record, created: true };
}

export function clearDb(storage: Store = localStorage): void {
    storage.removeItem(KEY);
}

export function allRecords(storage: Store = localStorage, includeFixtures = true): MatchRecord[] {
    const stored = loadStored(storage);
    return includeFixtures ? [...makeFixtures(), ...stored] : stored;
}

export function sameConfig(a: MatchConfigSnapshot, b: MatchConfigSnapshot): boolean {
    return a.sessionTime === b.sessionTime && a.spawnInterval === b.spawnInterval;
}

export function compareRanking(a: MatchRecord, b: MatchRecord): number {
    return (
        b.score - a.score ||
        a.durationSeconds - b.durationSeconds ||
        Date.parse(a.playedAt) - Date.parse(b.playedAt) ||
        a.matchId.localeCompare(b.matchId)
    );
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
    const size = Math.max(1, Math.floor(pageSize));
    const current = Math.max(1, Math.floor(page));
    return {
        items: items.slice((current - 1) * size, current * size),
        page: current,
        pageSize: size,
        total: items.length,
        totalPages: Math.ceil(items.length / size),
    };
}

export function rankingPage(
    records: MatchRecord[], config: MatchConfigSnapshot, page: number, pageSize: number,
): Page<RankingEntry> {
    const sorted = records.filter((r) => sameConfig(r.config, config)).sort(compareRanking);
    const result = paginate(sorted, page, pageSize);
    const offset = (result.page - 1) * result.pageSize;
    return { ...result, items: result.items.map((r, i) => ({ ...r, rank: offset + i + 1 })) };
}

export function historyPage(
    records: MatchRecord[], playerId: string, page: number, pageSize: number,
): Page<MatchRecord> {
    const mine = records
        .filter((r) => r.playerId === playerId)
        .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt) || a.matchId.localeCompare(b.matchId));
    return paginate(mine, page, pageSize);
}