export type ShipColor = 'yellow' | 'red' | 'black';

const BASE_INDEX: Record<ShipColor, number> = { black: 2, red: 3, yellow: 6 };

export type DamageTier = 0 | 1 | 2;

export function damageTier(healthRatio: number): DamageTier {
    if (healthRatio > 2 / 3) return 0;
    if (healthRatio > 1 / 3) return 1;
    return 2;
}

export function shipSpriteName(color: ShipColor, tier: DamageTier): string {
    return `ship_${BASE_INDEX[color] + 6 * tier}.png`;
}