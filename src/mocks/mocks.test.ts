import { describe, expect, it } from 'vitest';
import { isMatchRecord, type MatchRecord } from '../api/contracts';
import { DEFAULT_NETWORK, type NetworkSettings, type ScenarioId } from '../api/networkSettings';
import { addPending, loadPending, removePending } from '../api/pending';
import {
    addRecord, allRecords, compareRanking, historyPage, loadStored, rankingPage,
} from './db';
import { FIXTURE_CONFIG, makeFixtures, sampleHistory } from './fixtures';
import { createRng } from './random';
import { resolveBehavior, type Kind } from './scenarios';

function memoryStore() {
    const data = new Map<string, string>();
    return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
    };
}

const rec = (over: Partial<MatchRecord> = {}): MatchRecord => ({
    matchId: 'm-1', playerId: 'p-1', playerName: 'Player p-1', playedAt: '2026-10-01T10:00:00.000Z',
    score: 5, durationSeconds: 60, endReason: 'time', config: FIXTURE_CONFIG, ...over,
});

describe('ranking', () => {
    it('orders by score, then shorter duration, then earlier date, then matchId', () => {
        const a = rec({ matchId: 'a', score: 9, durationSeconds: 70 });
        const b = rec({ matchId: 'b', score: 9, durationSeconds: 50 });
        const c = rec({ matchId: 'c', score: 9, durationSeconds: 50, playedAt: '2026-09-01T10:00:00.000Z' });
        const d = rec({ matchId: 'd', score: 9, durationSeconds: 50, playedAt: '2026-09-01T10:00:00.000Z' });
        const e = rec({ matchId: 'e', score: 12 });
        const ids = [a, b, c, d, e].sort(compareRanking).map((r) => r.matchId);
        expect(ids).toEqual(['e', 'c', 'd', 'b', 'a']);
        expect([d, c, e, a, b].sort(compareRanking).map((r) => r.matchId)).toEqual(ids); // input order is irrelevant
    });

    it('only compares matches with the same configuration and numbers ranks across pages', () => {
        const other = rec({ matchId: 'x', score: 99, config: { sessionTime: 60, spawnInterval: 3 } });
        const all = [...makeFixtures(), other];
        const p1 = rankingPage(all, FIXTURE_CONFIG, 1, 10);
        const p2 = rankingPage(all, FIXTURE_CONFIG, 2, 10);
        expect(p1.total).toBe(34);
        expect(p1.totalPages).toBe(4);
        expect(p1.items.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(p2.items[0]?.rank).toBe(11);
        expect(p1.items.some((r) => r.matchId === 'x')).toBe(false);
        expect(rankingPage(all, { sessionTime: 60, spawnInterval: 3 }, 1, 10).items[0]?.matchId).toBe('x');
    });

    it('returns an empty page when nothing matches or the page is out of range', () => {
        const none = rankingPage(makeFixtures(), { sessionTime: 120, spawnInterval: 2 }, 1, 10);
        expect(none.items).toEqual([]);
        expect(none.total).toBe(0);
        expect(rankingPage(makeFixtures(), FIXTURE_CONFIG, 99, 10).items).toEqual([]);
    });
});

describe('mock database', () => {
    it('registers a match once: repeats return the original record', () => {
        const store = memoryStore();
        const first = addRecord(rec(), store);
        const again = addRecord(rec({ score: 999 }), store); // same matchId, different payload
        expect(first.created).toBe(true);
        expect(again.created).toBe(false);
        expect(again.record.score).toBe(5);
        expect(loadStored(store)).toHaveLength(1);
    });

    it('keeps registered matches in both the ranking and the history', () => {
        const store = memoryStore();
        addRecord(rec({ matchId: 'mine', playerId: 'me', score: 50 }), store);
        const ranking = rankingPage(allRecords(store), FIXTURE_CONFIG, 1, 10);
        expect(ranking.items[0]?.matchId).toBe('mine');
        expect(historyPage(allRecords(store, false), 'me', 1, 5).items.map((r) => r.matchId)).toEqual(['mine']);
        expect(historyPage(allRecords(store, false), 'someone-else', 1, 5).total).toBe(0);
    });

    it('paginates the history newest first', () => {
        const records = sampleHistory('player-abcdef', 'Player abcd', 12);
        const p1 = historyPage(records, 'player-abcdef', 1, 5);
        const p3 = historyPage(records, 'player-abcdef', 3, 5);
        expect(p1.totalPages).toBe(3);
        expect(p3.items).toHaveLength(2);
        expect(Date.parse(p1.items[0]!.playedAt)).toBeGreaterThan(Date.parse(p1.items[1]!.playedAt));
    });

    it('generates identical fixtures every time, all valid', () => {
        expect(makeFixtures()).toEqual(makeFixtures());
        expect(makeFixtures().every(isMatchRecord)).toBe(true);
        expect(isMatchRecord({ ...rec(), score: -1 })).toBe(false);
        expect(isMatchRecord({ ...rec(), endReason: 'quit' })).toBe(false);
    });
});

describe('pending registrations', () => {
    it('persists, dedupes and removes pending matches', () => {
        const store = memoryStore();
        addPending(rec({ matchId: 'a' }), store);
        addPending(rec({ matchId: 'a' }), store);
        addPending(rec({ matchId: 'b' }), store);
        expect(loadPending(store).map((r) => r.matchId)).toEqual(['a', 'b']);
        removePending('a', store);
        expect(loadPending(store).map((r) => r.matchId)).toEqual(['b']);
        store.setItem('pirate-battle:pending', '{broken');
        expect(loadPending(store)).toEqual([]);
    });
});

describe('network scenarios', () => {
    const ctx = (index = 1, seed = 1, alreadyCommitted = false) => ({
        index, random: createRng(seed), alreadyCommitted,
    });
    const behave = (scenario: ScenarioId, kind: Kind, c = ctx(), over: Partial<NetworkSettings> = {}) =>
        resolveBehavior({ ...DEFAULT_NETWORK, scenario, ...over }, kind, c);

    it('success answers after the base latency; latency override applies', () => {
        expect(behave('success', 'ranking').latency).toBe(200);
        expect(behave('success', 'ranking', ctx(), { latencyMs: 0 }).latency).toBe(0);
    });

    it('timeout never answers; failures are reported as such', () => {
        expect(behave('timeout', 'history').latency).toBe('infinite');
        expect(behave('connection-failure', 'ranking').outcome).toBe('network-error');
        expect(behave('client-error', 'ranking').outcome).toEqual({ status: 400, message: expect.any(String) });
        expect(behave('server-error', 'register').outcome).toEqual({ status: 500, message: expect.any(String) });
    });

    it('ranking-fails and history-fails only break their own query', () => {
        expect(behave('ranking-fails', 'ranking').outcome).not.toBe('ok');
        expect(behave('ranking-fails', 'history').outcome).toBe('ok');
        expect(behave('history-fails', 'history').outcome).not.toBe('ok');
        expect(behave('history-fails', 'register').outcome).toBe('ok');
    });

    it('out-of-order makes odd requests slow and even ones fast', () => {
        expect(behave('out-of-order', 'ranking', ctx(1)).latency).toBe(1800);
        expect(behave('out-of-order', 'ranking', ctx(2)).latency).toBe(100);
        expect(behave('out-of-order', 'ranking', ctx(3)).latency).toBe(1800);
    });

    it('variable latency is reproducible for a seed and stays in range', () => {
        const run = (seed: number) => {
            const c = ctx(1, seed);
            return Array.from({ length: 5 }, () => behave('variable-latency', 'ranking', c).latency);
        };
        expect(run(3)).toEqual(run(3));
        expect(run(3)).not.toEqual(run(4));
        for (const ms of run(9)) {
            expect(ms as number).toBeGreaterThanOrEqual(100);
            expect(ms as number).toBeLessThan(2000);
        }
    });

    it('registration timeout hangs once after saving, then recovers', () => {
        const first = behave('register-timeout-after-commit', 'register', ctx(1, 1, false));
        expect(first.hangAfterCommit).toBe(true);
        expect(first.latency).toBe('infinite');
        const retry = behave('register-timeout-after-commit', 'register', ctx(2, 1, true));
        expect(retry.hangAfterCommit).toBe(false);
        expect(retry.outcome).toBe('ok');
        expect(behave('register-timeout-after-commit', 'ranking').latency).toBe(200); // reads unaffected
    });

    it('registration unavailable answers 503 only for registration; empty hides fixtures', () => {
        expect(behave('register-unavailable', 'register').outcome).toEqual({ status: 503, message: expect.any(String) });
        expect(behave('register-unavailable', 'ranking').outcome).toBe('ok');
        expect(behave('empty', 'ranking').hideFixtures).toBe(true);
        expect(behave('success', 'ranking').hideFixtures).toBe(false);
    });
});