import type { MatchResult } from '../game/result';
import type { MatchRecord } from './contracts';
import { getPlayerId, playerNameFor } from './ids';

export function toRecord(result: MatchResult): MatchRecord {
    const playerId = getPlayerId();
    return {
        matchId: result.matchId,
        playerId,
        playerName: playerNameFor(playerId),
        playedAt: result.finishedAt,
        score: result.score,
        durationSeconds: Math.round(result.playedSeconds * 10) / 10,
        endReason: result.reason,
        config: { sessionTime: result.settings.sessionTime, spawnInterval: result.settings.spawnInterval },
    };
}