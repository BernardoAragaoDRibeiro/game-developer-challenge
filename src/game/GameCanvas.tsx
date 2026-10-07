import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { loadAtlas } from './atlas';
import { GAME_CONFIG as C } from './config';
import { createKeyboardInput } from './input';
import { GameRenderer } from './renderer';
import { createState, step } from './simulation';

const DT = 1 / 60;
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

export function GameCanvas() {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current!;
        const app = new Application();
        const keyboard = createKeyboardInput();
        let cancelled = false;
        let initialized = false;

        let restart: (() => void) | undefined;
        const onRestartKey = (e: KeyboardEvent) => {
            if (e.code === 'KeyR') restart?.();
        };
        window.addEventListener('keydown', onRestartKey);

        void (async () => {
            await app.init({
                width: C.arena.width,
                height: C.arena.height,
                background: '#0b3d5c',
                antialias: true,
            });
            initialized = true;
            if (cancelled) {
                app.destroy(true, { children: true });
                return;
            }

            const atlas = await loadAtlas();
            if (cancelled) return;
            host.appendChild(app.canvas);

            const renderer = new GameRenderer(atlas, C);
            app.stage.addChild(renderer.root);

            let state = createState(C, newSeed());
            let acc = 0;

            restart = () => {
                if (state.status !== 'ended') return;
                state = createState(C, newSeed());
                renderer.reset();
                acc = 0;
            };

            app.ticker.add((ticker) => {
                acc += Math.min(ticker.deltaMS / 1000, 0.1);
                while (acc >= DT) {
                    step(state, keyboard.input, DT, C);
                    acc -= DT;
                }
                renderer.sync(state, ticker.deltaMS);
            });
        })();

        return () => {
            cancelled = true;
            window.removeEventListener('keydown', onRestartKey);
            keyboard.dispose();
            if (initialized) app.destroy(true, { children: true });
        };
    }, []);

    return <div ref={hostRef} style={{ maxWidth: '100%' }} />;
}