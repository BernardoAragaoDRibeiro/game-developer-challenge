import { useEffect, useRef, useState } from 'react';
import type { MatchResult } from '../game/result';
import { GameSession, type HudSnapshot } from '../game/session';
import type { Settings } from '../game/settings';
import type { GameConfig } from '../game/types';
import { ControlsList } from './ControlsList';
import { trapFocus } from './focusTrap';
import { TouchControls } from './TouchControls';

interface Props {
    config: GameConfig;
    settings: Settings;
    onFinish: (result: MatchResult) => void;
    onQuit: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

export function GameScreen({ config, settings, onFinish, onQuit }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);
    const sessionRef = useRef<GameSession | null>(null);
    const pauseButtonRef = useRef<HTMLButtonElement>(null);
    const wasPaused = useRef(false);
    const onFinishRef = useRef(onFinish);
    const [load, setLoad] = useState<LoadState>('loading');
    const [attempt, setAttempt] = useState(0);
    const [hud, setHud] = useState<HudSnapshot>({
        score: 0, secondsLeft: config.match.duration, paused: false, ended: false, endReason: null,
    });

    useEffect(() => {
        onFinishRef.current = onFinish;
    }, [onFinish]);

    useEffect(() => {
        let active = true;
        const session = new GameSession(hostRef.current!, config, {
            onHud: setHud,
            onEnd: (s) =>
                onFinishRef.current({ ...s, finishedAt: new Date().toISOString(), settings }),
        });
        sessionRef.current = session;
        session.start().then(
            () => { if (active) setLoad('ready'); },
            () => { if (active) setLoad('error'); },
        );
        return () => {
            active = false;
            session.destroy();
            sessionRef.current = null;
        };
    }, [config, settings, attempt]);

    useEffect(() => {
        if (wasPaused.current && !hud.paused) pauseButtonRef.current?.focus();
        wasPaused.current = hud.paused;
    }, [hud.paused]);

    const status = hud.ended
        ? hud.endReason === 'death' ? 'Game over' : "Time's up"
        : hud.paused ? 'Game paused' : '';

    return (
        <main className="game-screen">
            <div className="hud" role="group" aria-label="Match status">
                <span>Score: <strong>{hud.score}</strong></span>
                <span>Time: <strong>{hud.secondsLeft}s</strong></span>
                <button
                    ref={pauseButtonRef} type="button" className="btn small"
                    disabled={load !== 'ready' || hud.ended}
                    onClick={() => sessionRef.current?.pause()}
                >
                    Pause
                </button>
            </div>
            <p className="sr-only" role="status">{status}</p>

            <div className="canvas-wrap">
                <div ref={hostRef} className="canvas-host" />

                {load === 'loading' && <div className="overlay" role="status">Loading assets…</div>}

                {load === 'error' && (
                    <div className="overlay" role="alert">
                        <p>Could not load the game assets.</p>
                        <div className="button-row">
                            <button type="button" className="btn primary" onClick={() => { setLoad('loading'); setAttempt((n) => n + 1); }}>
                                Try again
                            </button>
                            <button type="button" className="btn" onClick={onQuit}>Main Menu</button>
                        </div>
                    </div>
                )}

                {hud.paused && (
                    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" onKeyDown={trapFocus}>
                        <h2 id="pause-title">Paused</h2>
                        <ControlsList />
                        <div className="button-row">
                            <button type="button" className="btn primary" autoFocus onClick={() => sessionRef.current?.resume()}>
                                Resume
                            </button>
                            <button type="button" className="btn" onClick={onQuit}>Quit to Main Menu</button>
                        </div>
                    </div>
                )}
            </div>

            <TouchControls onChange={(key, pressed) => sessionRef.current?.setTouch(key, pressed)} />
            <p className="portrait-hint">Rotate your device to landscape for the best view.</p>
        </main>
    );
}