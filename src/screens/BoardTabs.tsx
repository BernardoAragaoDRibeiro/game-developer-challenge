import { useRef, useState, type KeyboardEvent } from 'react';
import { getPlayerId } from '../api/ids';
import { useHistory, useRanking } from '../api/queries';
import type { Settings } from '../game/settings';
import { endReasonText, formatDate, formatDuration } from './format';
import { PagedResult } from './PagedResult';

type Tab = 'ranking' | 'history';

function RankingPanel({ config }: { config: Settings }) {
    const [page, setPage] = useState(1);
    const [me] = useState(getPlayerId);
    const query = useRanking(config, page);

    return (
        <>
            <p className="muted">
                Matches played with {config.sessionTime}s sessions and a spawn every {config.spawnInterval}s.
                Ties go to the shorter match.
            </p>
            <PagedResult query={query} onPage={setPage} emptyText="No matches with this configuration yet. Play one!">
                {(items) => (
                    <div className="table-scroll">
                        <table>
                            <caption className="sr-only">Ranking</caption>
                            <thead>
                            <tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Score</th><th scope="col">Time</th><th scope="col">Date</th></tr>
                            </thead>
                            <tbody>
                            {items.map((r) => (
                                <tr key={r.matchId} className={r.playerId === me ? 'mine' : undefined}>
                                    <td>{r.rank}</td>
                                    <td>{r.playerName}{r.playerId === me ? ' (you)' : ''}</td>
                                    <td>{r.score}</td>
                                    <td>{formatDuration(r.durationSeconds)}</td>
                                    <td>{formatDate(r.playedAt)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </PagedResult>
        </>
    );
}

function HistoryPanel() {
    const [page, setPage] = useState(1);
    const [me] = useState(getPlayerId);
    const query = useHistory(me, page);

    return (
        <PagedResult query={query} onPage={setPage} emptyText="You have not finished any match yet.">
            {(items) => (
                <div className="table-scroll">
                    <table>
                        <caption className="sr-only">Match history</caption>
                        <thead>
                        <tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Time</th><th scope="col">Ended</th></tr>
                        </thead>
                        <tbody>
                        {items.map((r) => (
                            <tr key={r.matchId}>
                                <td>{formatDate(r.playedAt)}</td>
                                <td>{r.score}</td>
                                <td>{formatDuration(r.durationSeconds)}</td>
                                <td>{endReasonText(r.endReason)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </PagedResult>
    );
}

export function BoardTabs({ config }: { config: Settings }) {
    const [tab, setTab] = useState<Tab>('ranking');
    const rankingTab = useRef<HTMLButtonElement>(null);
    const historyTab = useRef<HTMLButtonElement>(null);

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const next: Tab | null =
            e.key === 'ArrowLeft' || e.key === 'Home' ? 'ranking'
                : e.key === 'ArrowRight' || e.key === 'End' ? 'history'
                    : null;
        if (!next) return;
        e.preventDefault();
        setTab(next);
        (next === 'ranking' ? rankingTab : historyTab).current?.focus();
    };

    return (
        <section aria-label="Leaderboards">
            <div role="tablist" aria-label="Leaderboards" className="tabs" onKeyDown={onKeyDown}>
                <button
                    ref={rankingTab} type="button" role="tab" id="tab-ranking" className="tab"
                    aria-selected={tab === 'ranking'} aria-controls="panel-ranking"
                    tabIndex={tab === 'ranking' ? 0 : -1} onClick={() => setTab('ranking')}
                >
                    Ranking
                </button>
                <button
                    ref={historyTab} type="button" role="tab" id="tab-history" className="tab"
                    aria-selected={tab === 'history'} aria-controls="panel-history"
                    tabIndex={tab === 'history' ? 0 : -1} onClick={() => setTab('history')}
                >
                    Match History
                </button>
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
                {tab === 'ranking' ? <RankingPanel config={config} /> : <HistoryPanel />}
            </div>
        </section>
    );
}