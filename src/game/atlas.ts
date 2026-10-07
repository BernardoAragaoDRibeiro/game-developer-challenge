import { Assets, Rectangle, Texture } from 'pixi.js';

const SHEET = '/assets/spritesheet/ships_miscellaneous_sheet';

export type Atlas = Map<string, Texture>;

export async function loadAtlas(): Promise<Atlas> {
    const [sheet, xml] = await Promise.all([
        Assets.load<Texture>(`${SHEET}.png`),
        fetch(`${SHEET}.xml`).then((r) => r.text()),
    ]);

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const atlas: Atlas = new Map();
    for (const el of Array.from(doc.querySelectorAll('SubTexture'))) {
        const num = (attr: string) => Number(el.getAttribute(attr));
        atlas.set(
            el.getAttribute('name')!,
            new Texture({
                source: sheet.source,
                frame: new Rectangle(num('x'), num('y'), num('width'), num('height')),
            }),
        );
    }
    return atlas;
}

export function getTexture(atlas: Atlas, name: string): Texture {
    const tex = atlas.get(name);
    if (!tex) {
        throw new Error(`Sprite "${name}" not found. Available: ${[...atlas.keys()].join(', ')}`);
    }
    return tex;
}