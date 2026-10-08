import { isMatchRecord, type MatchRecord } from './contracts';

const KEY = 'pirate-battle:pending';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadPending(storage: Store = localStorage): MatchRecord[] {
    try {
        const raw: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
        return Array.isArray(raw) ? raw.filter(isMatchRecord) : [];
    } catch {
        return [];
    }
}

function save(records: MatchRecord[], storage: Store): void {
    try {
        storage.setItem(KEY, JSON.stringify(records));
    } catch {
        // storage unavailable: the pending record only lives in memory for this session
    }
}

export function addPending(record: MatchRecord, storage: Store = localStorage): void {
    const all = loadPending(storage);
    if (all.some((r) => r.matchId === record.matchId)) return;
    save([...all, record], storage);
}

export function removePending(matchId: string, storage: Store = localStorage): void {
    save(loadPending(storage).filter((r) => r.matchId !== matchId), storage);
}

export function clearPending(storage: Store = localStorage): void {
    try {
        storage.removeItem(KEY);
    } catch {
        // nothing to clear
    }
}