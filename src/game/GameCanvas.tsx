import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { getTexture, loadAtlas } from './atlas';
import { GAME_CONFIG as C } from './config';
import { createKeyboardInput } from './input';
import { createState, step } from './simulation';

const DT = 1 / 60;

const SPRITES = { player: 'ship_1.png', cannonBall: 'cannon_ball.png' };
const SHIP_LENGTH = 60;
const SHIP_ROTATION_OFFSET = -Math.PI / 2;

export function GameCanvas() {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current!;
        const app = new Application();
        const keyboard = createKeyboardInput();
        let cancelled = false;
        let initialized = false;

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
            if (cancelled) return; // cleanup already destroyed the app
            host.appendChild(app.canvas);

            const world = new Container();
            app.stage.addChild(world);

            const islands = new Graphics();
            for (const i of C.islands) islands.circle(i.x, i.y, i.radius).fill(0x6b8e4e);

            const shipTex = getTexture(atlas, SPRITES.player);
            const ship = new Sprite(shipTex);
            ship.anchor.set(0.5);
            ship.scale.set(SHIP_LENGTH / Math.max(shipTex.width, shipTex.height));

            const ballTex = getTexture(atlas, SPRITES.cannonBall);
            const shotSprites = new Map<number, Sprite>(); // projectile id -> sprite

            world.addChild(islands, ship);

            const state = createState(C);
            let acc = 0;

            app.ticker.add((ticker) => {
                acc += Math.min(ticker.deltaMS / 1000, 0.1);
                while (acc >= DT) {
                    step(state, keyboard.input, DT, C);
                    acc -= DT;
                }

                ship.position.set(state.player.x, state.player.y);
                ship.rotation = state.player.angle + SHIP_ROTATION_OFFSET;

                const alive = new Set<number>();
                for (const p of state.projectiles) {
                    alive.add(p.id);
                    let s = shotSprites.get(p.id);
                    if (!s) {
                        s = new Sprite(ballTex);
                        s.anchor.set(0.5);
                        world.addChild(s);
                        shotSprites.set(p.id, s);
                    }
                    s.position.set(p.x, p.y);
                }
                for (const [id, s] of shotSprites) {
                    if (!alive.has(id)) {
                        s.destroy();
                        shotSprites.delete(id);
                    }
                }
            });
        })();

        return () => {
            cancelled = true;
            keyboard.dispose();
            if (initialized) app.destroy(true, { children: true });
        };
    }, []);

    return <div ref={hostRef} style={{ maxWidth: '100%' }} />;
}