import { QueryClient } from '@tanstack/react-query';
import { retryDelay, retryPolicy } from './client';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: retryPolicy, retryDelay, staleTime: 0 },
        mutations: { retry: retryPolicy, retryDelay },
    },
});