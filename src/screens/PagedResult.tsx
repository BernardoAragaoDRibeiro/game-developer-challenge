import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ApiError } from '../api/client';
import type { Page } from '../api/contracts';

interface Props<T> {
    query: UseQueryResult<Page<T>, ApiError>;
    onPage: (page: number) => void;
    emptyText: string;
    children: (items: T[]) => ReactNode;
}

export function PagedResult<T>({ query, onPage, emptyText, children }: Props<T>) {
    const { data, error, isPending, isFetching, refetch } = query;

    if (isPending) {
        return <p role="status" aria-busy="true">Loading…</p>;
    }

    if (!data) {
        return (
            <div role="alert" className="notice">
                <p>{error?.message ?? 'Something went wrong.'}</p>
                <button type="button" className="btn small" onClick={() => void refetch()}>Try again</button>
            </div>
        );
    }

    if (data.total === 0) {
        return <p>{emptyText}</p>;
    }

    return (
        <div>
            {children(data.items)}
            <nav className="pagination" aria-label="Pagination">
                <button type="button" className="btn small" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
                    Previous
                </button>
                <span>Page {data.page} of {data.totalPages}</span>
                <button type="button" className="btn small" disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>
                    Next
                </button>
            </nav>
            <p role="status" className="muted">{isFetching ? 'Updating…' : ''}</p>
        </div>
    );
}