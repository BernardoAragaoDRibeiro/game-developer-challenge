import { Application } from 'pixi.js';
import { loadAtlas } from './atlas';
import { createKeyboardInput } from './input';
import { GameRenderer } from './renderer';
import { createState, NO_INPUT, step } from './simulation';
import type { TestSnapshot } from '../testing/e2e';
import type { EndReason, GameConfig, GameState, Input } from './types';

const DT = 1 / 60;
const END_DELAY_MS = 1200;
const INPUT_KEYS = Object.keys(NO_INPUT) as (keyof Input)[];

export interface HudSnapshot {
    score: number;
    secondsLeft: number;
    paused: boolean;
    ended: boolean;
    endReason: EndReason | null;
}

export interface EndSummary {
    score: number;
    playedSeconds: number;
    reason: EndReason;
}

export interface SessionOptions {
    seed?: number;
    manualClock?: boolean;
}

interface Callbacks {
    onHud: (hud: HudSnapshot) => void;
    onEnd: (summary: EndSummary) => void;
}

export class GameSession {
    private readonly host: HTMLElement;
    private readonly config: GameConfig;
    private readonly callbacks: Callbacks;
    private readonly app = new Application();
    private readonly touch: Input = { ...NO_INPUT };
    private readonly merged: Input = { ...NO_INPUT };
    private readonly state: GameState;
    private readonly manualClock: boolean;
    private renderer: GameRenderer | undefined;
    private keyboard: ReturnType<typeof createKeyboardInput> | undefined;
    private acc = 0;
    private paused = false;
    private appReady = false;
    private destroyed = false;
    private endReported = false;
    private endTimer: number | undefined;
    private lastHud = '';

    constructor(host: HTMLElement, config: GameConfig, callbacks: Callbacks, options: SessionOptions = {}) {
        this.host = host;
        this.config = config;
        this.callbacks = callbacks;
        this.manualClock = options.manualClock ?? false;
        this.state = createState(config, options.seed ?? (Math.random() * 2 ** 32) >>> 0);
    }

    async start(): Promise<void> {
        await this.app.init({
            width: this.config.arena.width,
            height: this.config.arena.height,
            background: '#0b3d5c',
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        this.appReady = true;
        if (this.destroyed) {
            this.destroyApp();
            return;
        }

        const atlas = await loadAtlas();
        if (this.destroyed) return;

        this.host.appendChild(this.app.canvas);
        const renderer = new GameRenderer(atlas, this.config);
        this.app.stage.addChild(renderer.root);
        this.renderer = renderer;

        this.keyboard = createKeyboardInput(() => this.isActive());
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('blur', this.onFocusLost);
        document.addEventListener('visibilitychange', this.onVisibility);

        this.app.ticker.add((ticker) => {
            if (this.isActive() && !this.manualClock) {
                this.acc += Math.min(ticker.deltaMS / 1000, 0.1);
                this.mergeInput();
                while (this.acc >= DT) {
                    step(this.state, this.merged, DT, this.config);
                    this.acc -= DT;
                }
            } else {
                this.acc = 0;
            }
            renderer.sync(this.state, this.paused ? 0 : ticker.deltaMS);
            this.emitHud();
            this.checkEnd();
        });
        this.emitHud();
    }

    pause(): void {
        if (this.paused || this.state.status === 'ended') return;
        this.paused = true;
        this.clearInput();
        this.emitHud();
    }

    resume(): void {
        if (!this.paused) return;
        this.paused = false;
        this.acc = 0;
        this.clearInput();
        this.emitHud();
    }

    advance(seconds: number): void {
        const steps = Math.round(seconds / DT);
        for (let i = 0; i < steps && this.isActive(); i++) {
            this.mergeInput();
            step(this.state, this.merged, DT, this.config);
        }
        this.renderer?.sync(this.state, 0);
        this.emitHud();
        this.checkEnd();
    }

    snapshot(): TestSnapshot {
        const s = this.state;
        return {
            time: s.time,
            status: s.status,
            endReason: s.endReason,
            score: s.score,
            paused: this.paused,
            spawned: s.spawned,
            player: { x: s.player.x, y: s.player.y, angle: s.player.angle, health: s.player.health },
            enemies: s.enemies.map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, health: e.health })),
            projectiles: s.projectiles.map((p) => ({ owner: p.owner, x: p.x, y: p.y, vx: p.vx, vy: p.vy })),
        };
    }

    setTouch(key: keyof Input, pressed: boolean): void {
        if (pressed && !this.isActive()) return;
        this.touch[key] = pressed;
    }

    destroy(): void {
        this.destroyed = true;
        window.clearTimeout(this.endTimer);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('blur', this.onFocusLost);
        document.removeEventListener('visibilitychange', this.onVisibility);
        this.keyboard?.dispose();
        if (this.appReady) this.destroyApp();
    }

    private destroyApp(): void {
        this.appReady = false;
        this.app.destroy(true, { children: true });
    }

    private isActive(): boolean {
        return !this.paused && this.state.status === 'playing';
    }

    private clearInput(): void {
        this.keyboard?.reset();
        Object.assign(this.touch, NO_INPUT);
        Object.assign(this.merged, NO_INPUT);
    }

    private mergeInput(): void {
        const kb = this.keyboard?.input;
        for (const k of INPUT_KEYS) this.merged[k] = (kb?.[k] ?? false) || this.touch[k];
    }

    private readonly onKeyDown = (e: KeyboardEvent): void => {
        if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
            if (this.paused) this.resume();
            else this.pause();
        }
    };
    private readonly onFocusLost = (): void => this.pause();
    private readonly onVisibility = (): void => {
        if (document.hidden) this.pause();
    };

    private emitHud(): void {
        const s = this.state;
        const hud: HudSnapshot = {
            score: s.score,
            secondsLeft: Math.max(0, Math.ceil(this.config.match.duration - s.time)),
            paused: this.paused,
            ended: s.status === 'ended',
            endReason: s.endReason,
        };
        const key = JSON.stringify(hud);
        if (key === this.lastHud) return;
        this.lastHud = key;
        this.callbacks.onHud(hud);
    }

    private checkEnd(): void {
        if (this.state.status !== 'ended' || this.endReported || this.state.endReason === null) return;
        this.endReported = true;
        const summary: EndSummary = {
            score: this.state.score,
            playedSeconds: this.state.time,
            reason: this.state.endReason,
        };
        this.endTimer = window.setTimeout(() => this.callbacks.onEnd(summary), END_DELAY_MS);
    }
}