import type { RegistrationStatus } from '../api/registrations';
import type { MatchResult } from '../game/result';
import { useHeadingFocus } from './useHeadingFocus';

interface Props {
    result: MatchResult;
    registration: RegistrationStatus;
    onRetry: () => void;
    onPlayAgain: () => void;
    onMenu: () => void;
}

export function ResultScreen({ result, registration, onRetry, onPlayAgain, onMenu }: Props) {
    const heading = useHeadingFocus();
    return (
        <main className="panel">
            <h1 ref={heading} tabIndex={-1}>
                {result.reason === 'death' ? 'Game Over' : "Time's up"}
            </h1>
            <dl className="stats">
                <div><dt>Score</dt><dd>{result.score}</dd></div>
                <div><dt>Time played</dt><dd>{result.playedSeconds.toFixed(1)}s</dd></div>
                <div>
                    <dt>Ended because</dt>
                    <dd>{result.reason === 'death' ? 'Your ship was destroyed' : 'Time ran out'}</dd>
                </div>
            </dl>

            {registration === 'saving' && <p role="status">Registering your match…</p>}
            {registration === 'saved' && <p role="status">Match registered in the ranking and history.</p>}
            {registration === 'failed' && (
                <div role="alert" className="notice">
                    <p>Could not register the match. It is saved on this device and will be retried.</p>
                    <button type="button" className="btn small" onClick={onRetry}>Try again</button>
                </div>
            )}

            <div className="button-row">
                <button type="button" className="btn primary" onClick={onPlayAgain}>Play Again</button>
                <button type="button" className="btn" onClick={onMenu}>Main Menu</button>
            </div>
        </main>
    );
}