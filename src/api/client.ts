import axios, { isAxiosError } from 'axios';
import {
    HISTORY_PAGE_SIZE, RANKING_PAGE_SIZE,
    type MatchConfigSnapshot, type MatchRecord, type Page, type RankingEntry,
    type RegisterMatchResponse,
} from './contracts';
import { readNetworkSettings } from './networkSettings';

export class ApiError extends Error {
    readonly kind: 'timeout' | 'network' | 'http';
    readonly status: number | undefined;
    readonly retryable: boolean;

    constructor(kind: ApiError['kind'], message: string, retryable: boolean, status?: number) {
        super(message);
        this.name = 'ApiError';
        this.kind = kind;
        this.status = status;
        this.retryable = retryable;
    }
}

export function toApiError(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    if (isAxiosError(err)) {
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            return new ApiError('timeout', 'The server took too long to respond.', true);
        }
        if (err.response) {
            const { status, data } = err.response;
            const serverMessage = (data as { message?: unknown } | undefined)?.message;
            const message = typeof serverMessage === 'string' ? serverMessage : `The server answered with error ${status}.`;
            // 5xx and "try again later" codes may recover; other 4xx are our fault and will not.
            return new ApiError('http', message, status >= 500 || status === 408 || status === 429, status);
        }
        return new ApiError('network', 'Could not reach the server. Check your connection.', true);
    }
    return new ApiError('network', 'Something went wrong while contacting the server.', false);
}

export const retryPolicy = (failureCount: number, error: unknown): boolean =>
    failureCount < 2 && error instanceof ApiError && error.retryable;
export const retryDelay = (attempt: number): number => 500 * 2 ** attempt;

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
    config.timeout = readNetworkSettings().timeoutMs;
    return config;
});

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
    try {
        return (await request()).data;
    } catch (err) {
        throw axios.isCancel(err) ? err : toApiError(err);
    }
}

export function fetchRanking(
    config: MatchConfigSnapshot, page: number, signal?: AbortSignal,
): Promise<Page<RankingEntry>> {
    return call(() =>
        api.get<Page<RankingEntry>>('/ranking', {
            params: {
                sessionTime: config.sessionTime, spawnInterval: config.spawnInterval,
                page, pageSize: RANKING_PAGE_SIZE,
            },
            signal,
        }),
    );
}

export function fetchHistory(
    playerId: string, page: number, signal?: AbortSignal,
): Promise<Page<MatchRecord>> {
    return call(() =>
        api.get<Page<MatchRecord>>('/matches', {
            params: { playerId, page, pageSize: HISTORY_PAGE_SIZE },
            signal,
        }),
    );
}

export function registerMatch(record: MatchRecord): Promise<RegisterMatchResponse> {
    return call(() => api.post<RegisterMatchResponse>('/matches', record));
}