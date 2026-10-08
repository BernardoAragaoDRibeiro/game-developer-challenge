import { delay, http, HttpResponse } from 'msw';
import { HISTORY_PAGE_SIZE, isMatchRecord, RANKING_PAGE_SIZE } from '../api/contracts';
import { addRecord, allRecords, findStored, historyPage, rankingPage } from './db';
import { nextBehavior } from './runtime';
import type { Behavior } from './scenarios';

const wait = (latency: Behavior['latency']) => delay(latency === 'infinite' ? 'infinite' : latency);

function failure(b: Behavior) {
    if (b.outcome === 'ok') return null;
    if (b.outcome === 'network-error') return HttpResponse.error();
    return HttpResponse.json({ message: b.outcome.message }, { status: b.outcome.status });
}

function intParam(url: URL, name: string, fallback: number): number {
    const n = Number(url.searchParams.get(name));
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const handlers = [
    http.get('/api/ranking', async ({ request }) => {
        const b = nextBehavior('ranking');
        await wait(b.latency);
        const failed = failure(b);
        if (failed) return failed;

        const url = new URL(request.url);
        const config = {
            sessionTime: Number(url.searchParams.get('sessionTime')),
            spawnInterval: Number(url.searchParams.get('spawnInterval')),
        };
        const records = allRecords(localStorage, !b.hideFixtures);
        return HttpResponse.json(
            rankingPage(records, config, intParam(url, 'page', 1), intParam(url, 'pageSize', RANKING_PAGE_SIZE)),
        );
    }),

    http.get('/api/matches', async ({ request }) => {
        const b = nextBehavior('history');
        await wait(b.latency);
        const failed = failure(b);
        if (failed) return failed;

        const url = new URL(request.url);
        const playerId = url.searchParams.get('playerId') ?? '';
        return HttpResponse.json(
            historyPage(allRecords(localStorage, false), playerId, intParam(url, 'page', 1), intParam(url, 'pageSize', HISTORY_PAGE_SIZE)),
        );
    }),

    http.post('/api/matches', async ({ request }) => {
        const body: unknown = await request.json().catch(() => null);
        const alreadyCommitted = isMatchRecord(body) && findStored(body.matchId) !== undefined;
        const b = nextBehavior('register', alreadyCommitted);

        if (b.hangAfterCommit && isMatchRecord(body)) addRecord(body);

        await wait(b.latency);
        const failed = failure(b);
        if (failed) return failed;

        if (!isMatchRecord(body)) {
            return HttpResponse.json({ message: 'Invalid match record.' }, { status: 422 });
        }
        const { record, created } = addRecord(body);
        return HttpResponse.json({ record, created }, { status: created ? 201 : 200 });
    }),
];