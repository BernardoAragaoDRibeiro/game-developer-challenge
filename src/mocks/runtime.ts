import { readNetworkSettings } from '../api/networkSettings';
import { createRng } from './random';
import { resolveBehavior, type Behavior, type Kind } from './scenarios';

let counters: Record<Kind, number> = { ranking: 0, history: 0, register: 0 };
let rng: (() => number) | undefined;
let rngSeed: number | undefined;

export function resetRuntime(): void {
    counters = { ranking: 0, history: 0, register: 0 };
    rng = undefined;
    rngSeed = undefined;
}

export function nextBehavior(kind: Kind, alreadyCommitted = false): Behavior {
    const settings = readNetworkSettings();
    if (!rng || rngSeed !== settings.seed) {
        rng = createRng(settings.seed);
        rngSeed = settings.seed;
    }
    counters[kind] += 1;
    return resolveBehavior(settings, kind, { index: counters[kind], random: rng, alreadyCommitted });
}