import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { getTexture, type Atlas } from './atlas';
import { damageTier, shipSpriteName, type ShipColor } from './shipSprites';
import { drainEvents } from './simulation';
import type { GameConfig, GameEvent, GameState, Ship } from './types';

const SHIP_ROTATION_OFFSET = -Math.PI / 2;
const BAR_WIDTH = 40;
const BAR_HEIGHT = 5;
const EFFECT_SIZE = { explosion: 80, hit: 22, shot: 16 };
const EFFECT_DURATION = { explosion: 0.45, hit: 0.18, shot: 0.12 };

class ShipView {
    readonly container = new Container();
    private readonly sprite = new Sprite();
    private readonly bar = new Graphics();
    private readonly atlas: Atlas;
    private readonly color: ShipColor;
    private ratio = -1;
    private tier = -1;

    constructor(atlas: Atlas, color: ShipColor, radius: number) {
        this.atlas = atlas;
        this.color = color;
        this.sprite.anchor.set(0.5);
        this.sprite.texture = getTexture(atlas, shipSpriteName(color, 0));
        const length = radius * 3;
        this.sprite.scale.set(length / Math.max(this.sprite.texture.width, this.sprite.texture.height));
        this.bar.position.set(-BAR_WIDTH / 2, -radius - 14);
        this.container.addChild(this.sprite, this.bar);
    }

    update(ship: Ship): void {
        this.container.position.set(ship.x, ship.y);
        this.sprite.rotation = ship.angle + SHIP_ROTATION_OFFSET;

        const ratio = Math.max(0, ship.health) / ship.maxHealth;
        if (ratio === this.ratio) return;
        this.ratio = ratio;

        const color = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffc107 : 0xe53935;
        this.bar.clear()
            .rect(0, 0, BAR_WIDTH, BAR_HEIGHT).fill(0x000000)
            .rect(1, 1, (BAR_WIDTH - 2) * ratio, BAR_HEIGHT - 2).fill(color);

        const tier = damageTier(ratio);
        if (tier !== this.tier) {
            this.tier = tier;
            this.sprite.texture = getTexture(this.atlas, shipSpriteName(this.color, tier));
        }
    }
}

interface Effect { sprite: Sprite; age: number; duration: number; baseScale: number }

export class GameRenderer {
    readonly root = new Container();
    private readonly shipsLayer = new Container();
    private readonly shotsLayer = new Container();
    private readonly effectsLayer = new Container();
    private readonly atlas: Atlas;
    private readonly config: GameConfig;
    private readonly player: ShipView;
    private readonly enemyViews = new Map<number, ShipView>();
    private readonly shotSprites = new Map<number, Sprite>();
    private effects: Effect[] = [];
    private explosionCount = 0;

    private readonly scoreText = new Text({ text: '', style: { fill: '#ffffff', fontSize: 22, fontFamily: 'sans-serif' } });
    private readonly timeText = new Text({ text: '', style: { fill: '#ffffff', fontSize: 22, fontFamily: 'sans-serif' } });
    private readonly banner = new Text({
        text: '',
        style: { fill: '#ffffff', fontSize: 40, fontFamily: 'sans-serif', align: 'center', stroke: { color: '#000000', width: 5 } },
    });

    constructor(atlas: Atlas, config: GameConfig) {
        this.atlas = atlas;
        this.config = config;

        const islands = new Graphics();
        for (const i of config.islands) islands.circle(i.x, i.y, i.radius).fill(0x6b8e4e);

        this.player = new ShipView(atlas, 'yellow', config.player.radius);
        this.shipsLayer.addChild(this.player.container);

        this.scoreText.position.set(16, 12);
        this.timeText.anchor.set(1, 0);
        this.timeText.position.set(config.arena.width - 16, 12);
        this.banner.anchor.set(0.5);
        this.banner.position.set(config.arena.width / 2, config.arena.height / 2);

        this.root.addChild(
            islands, this.shipsLayer, this.shotsLayer, this.effectsLayer,
            this.scoreText, this.timeText, this.banner,
        );
    }

    reset(): void {
        for (const v of this.enemyViews.values()) v.container.destroy({ children: true });
        this.enemyViews.clear();
        for (const s of this.shotSprites.values()) s.destroy();
        this.shotSprites.clear();
        for (const e of this.effects) e.sprite.destroy();
        this.effects = [];
        this.banner.text = '';
    }

    sync(state: GameState, frameMs: number): void {
        this.player.update(state.player);

        const liveEnemies = new Set<number>();
        for (const e of state.enemies) {
            liveEnemies.add(e.id);
            let view = this.enemyViews.get(e.id);
            if (!view) {
                view = new ShipView(this.atlas, 'red', e.radius);
                this.shipsLayer.addChild(view.container);
                this.enemyViews.set(e.id, view);
            }
            view.update(e);
        }
        for (const [id, view] of this.enemyViews) {
            if (!liveEnemies.has(id)) {
                view.container.destroy({ children: true });
                this.enemyViews.delete(id);
            }
        }

        const liveShots = new Set<number>();
        for (const p of state.projectiles) {
            liveShots.add(p.id);
            let s = this.shotSprites.get(p.id);
            if (!s) {
                s = new Sprite(getTexture(this.atlas, 'cannon_ball.png'));
                s.anchor.set(0.5);
                if (p.owner === 'enemy') s.tint = 0xff7777;
                this.shotsLayer.addChild(s);
                this.shotSprites.set(p.id, s);
            }
            s.position.set(p.x, p.y);
        }
        for (const [id, s] of this.shotSprites) {
            if (!liveShots.has(id)) {
                s.destroy();
                this.shotSprites.delete(id);
            }
        }

        for (const ev of drainEvents(state)) this.addEffect(ev);
        this.updateEffects(frameMs / 1000);
        this.updateHud(state);
    }

    private addEffect(ev: GameEvent): void {
        const n = ev.type === 'explosion' ? 1 + (this.explosionCount++ % 3) : 3;
        const tex = getTexture(this.atlas, `explosion_${n}.png`);
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.position.set(ev.x, ev.y);
        const baseScale = EFFECT_SIZE[ev.type] / tex.width;
        sprite.scale.set(baseScale * 0.5);
        this.effectsLayer.addChild(sprite);
        this.effects.push({ sprite, age: 0, duration: EFFECT_DURATION[ev.type], baseScale });
    }

    private updateEffects(dt: number): void {
        this.effects = this.effects.filter((e) => {
            e.age += dt;
            const t = e.age / e.duration;
            if (t >= 1) {
                e.sprite.destroy();
                return false;
            }
            e.sprite.scale.set(e.baseScale * (0.5 + 0.7 * t));
            e.sprite.alpha = 1 - t;
            return true;
        });
    }

    private updateHud(state: GameState): void {
        const score = `Score: ${state.score}`;
        if (this.scoreText.text !== score) this.scoreText.text = score;

        const remaining = Math.ceil(this.config.match.duration - state.time);
        const time = `Time: ${Math.max(0, remaining)}s`;
        if (this.timeText.text !== time) this.timeText.text = time;

        const banner = state.status === 'ended'
            ? `${state.endReason === 'death' ? 'Game Over' : "Time's up"}\nScore: ${state.score}\nPress R to play again`
            : '';
        if (this.banner.text !== banner) this.banner.text = banner;
    }
}