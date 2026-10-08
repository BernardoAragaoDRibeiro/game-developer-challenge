export function newId(): string {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    );
}

const PLAYER_KEY = 'pirate-battle:player-id';
let memoryId: string | undefined;

export function getPlayerId(): string {
    try {
        const saved = localStorage.getItem(PLAYER_KEY);
        if (saved) return saved;
        const id = newId();
        localStorage.setItem(PLAYER_KEY, id);
        return id;
    } catch {
        memoryId ??= newId();
        return memoryId;
    }
}

export function playerNameFor(playerId: string): string {
    return `Player ${playerId.slice(0, 4)}`;
}