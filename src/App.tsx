import { useRef, useState } from 'react';
import { useMatchRegistrations } from './api/registrations';
import { toRecord } from './api/records';
import { loadLastResult, saveLastResult, type MatchResult } from './game/result';
import { buildConfig, loadSettings, type Settings } from './game/settings';
import type { GameConfig } from './game/types';
import { applyOverrides, E2E } from './testing/e2e';
import { GameScreen } from './screens/GameScreen';
import { MainMenu } from './screens/MainMenu';
import { OptionsScreen } from './screens/OptionsScreen';
import { ResultScreen } from './screens/ResultScreen';

type Screen =
    | { name: 'menu' }
    | { name: 'options' }
    | { name: 'game'; runId: number; config: GameConfig; settings: Settings }
    | { name: 'result'; result: MatchResult };

export default function App() {
    const [screen, setScreen] = useState<Screen>({ name: 'menu' });
    const [lastResult, setLastResult] = useState(loadLastResult);
    const runCounter = useRef(0);
    const registrations = useMatchRegistrations();

    const startGame = () => {
        const settings = loadSettings();
        const base = buildConfig(settings);
        const config = E2E ? applyOverrides(base, E2E.overrides) : base;
        setScreen({ name: 'game', runId: ++runCounter.current, config, settings });
    };
    const toMenu = () => setScreen({ name: 'menu' });

    switch (screen.name) {
        case 'menu':
            return (
                <MainMenu
                    lastResult={lastResult}
                    pendingCount={registrations.pendingCount}
                    registering={registrations.saving}
                    onRetryPending={registrations.retryAll}
                    onPlay={startGame}
                    onOptions={() => setScreen({ name: 'options' })}
                />
            );
        case 'options':
            return <OptionsScreen onBack={toMenu} />;
        case 'game':
            return (
                <GameScreen
                    key={screen.runId}
                    config={screen.config}
                    settings={screen.settings}
                    onQuit={toMenu}
                    onFinish={(result) => {
                        saveLastResult(result);
                        setLastResult(result);
                        registrations.enqueue(toRecord(result));
                        setScreen({ name: 'result', result });
                    }}
                />
            );
        case 'result':
            return (
                <ResultScreen
                    result={screen.result}
                    registration={registrations.statusOf(screen.result.matchId)}
                    onRetry={() => registrations.retry(screen.result.matchId)}
                    onPlayAgain={startGame}
                    onMenu={toMenu}
                />
            );
    }
}