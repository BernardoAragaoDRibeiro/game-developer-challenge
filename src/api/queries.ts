import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchHistory, fetchRanking, type ApiError } from './client';
import type { MatchConfigSnapshot, MatchRecord, Page, RankingEntry } from './contracts';

export function useRanking(config: MatchConfigSnapshot, page: number) {
    return useQuery<Page<RankingEntry>, ApiError>({
        queryKey: ['ranking', config.sessionTime, config.spawnInterval, page],
        queryFn: ({ signal }) => fetchRanking(config, page, signal),
        placeholderData: keepPreviousData,
    });
}

export function useHistory(playerId: string, page: number) {
    return useQuery<Page<MatchRecord>, ApiError>({
        queryKey: ['history', playerId, page],
        queryFn: ({ signal }) => fetchHistory(playerId, page, signal),
        placeholderData: keepPreviousData,
    });
}