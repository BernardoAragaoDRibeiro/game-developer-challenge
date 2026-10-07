import type { MatchResult } from '../game/result';
import { useHeadingFocus } from './useHeadingFocus';
import { ControlsList } from './ControlsList';

interface Props {
    lastResult: MatchResult | null;
    onPlay: () => void;
    onOptions: () => void;
}

export function MainMenu({ lastResult, onPlay, onOptions }: Props) {
    const heading = useHeadingFocus();
    return (
        <main className="panel">
            <h1 ref={heading} tabIndex={-1}>Pirate Battle</h1>
            <nav className="button-row" aria-label="Main menu">
                <button type="button" className="btn primary" onClick={onPlay}>Play</button>
                <button type="button" className="btn" onClick={onOptions}>Options</button>
            </nav>

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
        </main>
    );
}