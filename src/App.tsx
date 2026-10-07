import { useRef, useState } from 'react';
import { loadLastResult, saveLastResult, type MatchResult } from './game/result';
import { buildConfig, loadSettings, type Settings } from './game/settings';
import type { GameConfig } from './game/types';
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

  const startGame = () => {
    const settings = loadSettings();
    setScreen({ name: 'game', runId: ++runCounter.current, config: buildConfig(settings), settings });
  };
  const toMenu = () => setScreen({ name: 'menu' });

  switch (screen.name) {
    case 'menu':
      return <MainMenu lastResult={lastResult} onPlay={startGame} onOptions={() => setScreen({ name: 'options' })} />;
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
                setScreen({ name: 'result', result });
              }}
          />
      );
    case 'result':
      return <ResultScreen result={screen.result} onPlayAgain={startGame} onMenu={toMenu} />;
  }
}