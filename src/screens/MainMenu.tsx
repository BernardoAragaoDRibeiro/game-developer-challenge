import { useState } from 'react';
import type { MatchResult } from '../game/result';
import { loadSettings } from '../game/settings';
import { BoardTabs } from './BoardTabs';
import { ControlsList } from './ControlsList';
import { NetworkPanel } from './NetworkPanel';
import { useHeadingFocus } from './useHeadingFocus';

interface Props {
    lastResult: MatchResult | null;
    pendingCount: number;
    registering: boolean;
    onRetryPending: () => void;
    onPlay: () => void;
    onOptions: () => void;
}

export function MainMenu({ lastResult, pendingCount, registering, onRetryPending, onPlay, onOptions }: Props) {
    const heading = useHeadingFocus();
    const [config] = useState(loadSettings);

    return (
        <main className="panel">
            <h1 ref={heading} tabIndex={-1}>Pirate Battle</h1>
            <nav className="button-row" aria-label="Main menu">
                <button type="button" className="btn primary" onClick={onPlay}>Play</button>
                <button type="button" className="btn" onClick={onOptions}>Options</button>
            </nav>

            {pendingCount > 0 && (
                <section aria-labelledby="pending-title" className="notice">
                    <h2 id="pending-title">Pending matches</h2>
                    <p role="status">
                        {registering
                            ? 'Registering…'
                            : `${pendingCount} ${pendingCount === 1 ? 'match is' : 'matches are'} waiting to be registered.`}
                    </p>
                    <button type="button" className="btn small" disabled={registering} onClick={onRetryPending}>
                        Try again
                    </button>
                </section>
            )}

            <BoardTabs config={config} />

            <section aria-labelledby="controls-title">
                <h2 id="controls-title">Controls</h2>
                <ControlsList />
                <p className="muted">On touch screens, on-screen buttons appear during the match.</p>
            </section>

            {lastResult && (
                <section aria-labelledby="last-title">
                    <h2 id="last-title">Last match</h2>
                    <p>
                        {lastResult.score} {lastResult.score === 1 ? 'point' : 'points'} in{' '}
                        {lastResult.playedSeconds.toFixed(1)}s (
                        {lastResult.reason === 'death' ? 'ship destroyed' : 'time ran out'})
                    </p>
                </section>
            )}

            <NetworkPanel />
        </main>
    );
}