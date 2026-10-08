import type { MatchConfigSnapshot, MatchRecord } from '../api/contracts';
import { createRng } from './random';

export const FIXTURE_CONFIG: MatchConfigSnapshot = { sessionTime: 90, spawnInterval: 3 };

const NAMES = [
    'Anne Bonny', 'Calico Jack', 'Black Bart', 'Mary Read', 'Captain Kidd', 'Grace O`Malley',
    'Blackbeard', 'Bartholomew', 'Jean Lafitte', 'Ching Shih', 'Henry Avery', 'Rackham',
];

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_DATE = Date.UTC(2026, 8, 1);

export function makeFixtures(count = 34, seed = 7): MatchRecord[] {
    const rng = createRng(seed);
    return Array.from({ length: count }, (_, i) => {
        const died = rng() < 0.45;
        const score = 2 + Math.floor(rng() * 22);
        const duration = died ? 25 + rng() * 60 : FIXTURE_CONFIG.sessionTime;
        return {
            matchId: `fixture-${String(i + 1).padStart(3, '0')}`,
            playerId: `fixture-player-${i % NAMES.length}`,
            playerName: NAMES[i % NAMES.length] ?? 'Unknown',
            playedAt: new Date(BASE_DATE + i * 0.8 * DAY_MS).toISOString(),
            score,
            durationSeconds: Math.round(duration * 10) / 10,
            endReason: died ? 'death' : 'time',
            config: FIXTURE_CONFIG,
        } satisfies MatchRecord;
    });
}

export function sampleHistory(playerId: string, playerName: string, count = 12, seed = 11): MatchRecord[] {
    const rng = createRng(seed);
    return Array.from({ length: count }, (_, i) => {
        const died = rng() < 0.5;
        return {
            matchId: `sample-${playerId.slice(0, 8)}-${String(i + 1).padStart(2, '0')}`,
            playerId,
            playerName,
            playedAt: new Date(Date.UTC(2026, 8, 20) + i * DAY_MS).toISOString(),
            score: 3 + Math.floor(rng() * 18),
            durationSeconds: Math.round((died ? 30 + rng() * 55 : FIXTURE_CONFIG.sessionTime) * 10) / 10,
            endReason: died ? 'death' : 'time',
            config: FIXTURE_CONFIG,
        } satisfies MatchRecord;
    });
}