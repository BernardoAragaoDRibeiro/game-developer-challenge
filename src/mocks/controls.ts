import { getPlayerId, playerNameFor } from '../api/ids';
import { NETWORK_KEY } from '../api/networkSettings';
import { clearPending } from '../api/pending';
import { addRecord, clearDb } from './db';
import { sampleHistory } from './fixtures';
import { resetRuntime } from './runtime';

export function seedSampleMatches(): void {
    const id = getPlayerId();
    for (const record of sampleHistory(id, playerNameFor(id))) addRecord(record);
}

export function resetMockState(): void {
    clearDb();
    clearPending();
    try {
        localStorage.removeItem(NETWORK_KEY);
    } catch {
        // nothing to remove
    }
    resetRuntime();
}