import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerMatch, type ApiError } from './client';
import type { MatchRecord, RegisterMatchResponse } from './contracts';
import { addPending, loadPending, removePending } from './pending';

export type RegistrationStatus = 'saving' | 'saved' | 'failed';

export function useMatchRegistrations() {
    const queryClient = useQueryClient();
    const [pending, setPending] = useState<MatchRecord[]>(loadPending);
    const [statuses, setStatuses] = useState<Record<string, RegistrationStatus>>({});
    const inFlight = useRef(new Set<string>());
    const autoRetried = useRef(false);

    const { mutateAsync } = useMutation<RegisterMatchResponse, ApiError, MatchRecord>({
        mutationFn: (record) => registerMatch(record),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['ranking'] });
            void queryClient.invalidateQueries({ queryKey: ['history'] });
        },
    });

    const submit = useCallback(
        (record: MatchRecord) => {
            const id = record.matchId;
            if (inFlight.current.has(id)) return;
            inFlight.current.add(id);
            setStatuses((s) => ({ ...s, [id]: 'saving' }));
            mutateAsync(record)
                .then(
                    () => {
                        removePending(id);
                        setPending(loadPending());
                        setStatuses((s) => ({ ...s, [id]: 'saved' }));
                    },
                    () => setStatuses((s) => ({ ...s, [id]: 'failed' })),
                )
                .finally(() => inFlight.current.delete(id));
        },
        [mutateAsync],
    );

    useEffect(() => {
        if (autoRetried.current) return;
        autoRetried.current = true;
        loadPending().forEach(submit);
    }, [submit]);

    const enqueue = useCallback(
        (record: MatchRecord) => {
            addPending(record);
            setPending(loadPending());
            submit(record);
        },
        [submit],
    );

    return {
        pendingCount: pending.length,
        saving: Object.values(statuses).includes('saving'),
        statusOf: (matchId: string): RegistrationStatus => statuses[matchId] ?? 'saving',
        enqueue,
        retry: (matchId: string) => {
            const record = loadPending().find((r) => r.matchId === matchId);
            if (record) submit(record);
        },
        retryAll: () => loadPending().forEach(submit),
    };
}