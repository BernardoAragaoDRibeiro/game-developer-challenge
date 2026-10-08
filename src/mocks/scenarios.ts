import type { NetworkSettings, ScenarioId } from '../api/networkSettings';

export type Kind = 'ranking' | 'history' | 'register';

export interface Behavior {
    latency: number | 'infinite';
    outcome: 'ok' | 'network-error' | { status: number; message: string };
    hangAfterCommit: boolean;
    hideFixtures: boolean;
}

interface Context {
    index: number;
    random: () => number;
    alreadyCommitted: boolean;
}

export function resolveBehavior(s: NetworkSettings, kind: Kind, ctx: Context): Behavior {
    const L = s.latencyMs;
    const ok: Behavior = { latency: L, outcome: 'ok', hangAfterCommit: false, hideFixtures: false };
    const fail = (status: number, message: string): Behavior => ({ ...ok, outcome: { status, message } });

    switch (s.scenario) {
        case 'success':
            return ok;
        case 'empty':
            return { ...ok, hideFixtures: true };
        case 'slow':
            return { ...ok, latency: L * 15 };
        case 'variable-latency':
            return { ...ok, latency: Math.round(L / 2 + ctx.random() * L * 9.5) };
        case 'out-of-order':
            return { ...ok, latency: ctx.index % 2 === 1 ? L * 9 : Math.round(L / 2) };
        case 'timeout':
            return { ...ok, latency: 'infinite' };
        case 'connection-failure':
            return { ...ok, outcome: 'network-error' };
        case 'client-error':
            return fail(400, 'Bad request (simulated 4xx).');
        case 'server-error':
            return fail(500, 'Internal server error (simulated 5xx).');
        case 'ranking-fails':
            return kind === 'ranking' ? fail(500, 'The ranking service failed (simulated).') : ok;
        case 'history-fails':
            return kind === 'history' ? fail(500, 'The history service failed (simulated).') : ok;
        case 'register-timeout-after-commit':
            return kind === 'register' && !ctx.alreadyCommitted
                ? { ...ok, latency: 'infinite', hangAfterCommit: true }
                : ok;
        case 'register-unavailable':
            return kind === 'register' ? fail(503, 'Match registration is unavailable (simulated).') : ok;
    }
}

export const SCENARIO_INFO: Record<ScenarioId, { label: string; description: string }> = {
    success: { label: 'Success', description: 'Normal responses; ranking has several pages.' },
    empty: { label: 'Empty lists', description: 'No other players: ranking and history start empty.' },
    slow: { label: 'Slow network', description: 'Every response takes about 15 times the base latency.' },
    'variable-latency': { label: 'Variable latency', description: 'Random (seeded) latency, so answers can arrive in any order.' },
    'out-of-order': { label: 'Out-of-order responses', description: 'Every other request is slow, so older answers arrive after newer ones.' },
    timeout: { label: 'Timeout', description: 'No request ever gets an answer.' },
    'connection-failure': { label: 'Connection failure', description: 'Every request fails at the network level.' },
    'client-error': { label: 'HTTP 4xx', description: 'Every request answers 400.' },
    'server-error': { label: 'HTTP 5xx', description: 'Every request answers 500.' },
    'ranking-fails': { label: 'Ranking fails', description: 'Only the ranking query answers 500.' },
    'history-fails': { label: 'History fails', description: 'Only the history query answers 500.' },
    'register-timeout-after-commit': { label: 'Registration times out after saving', description: 'The match is saved but the answer never arrives; a retry recovers it without duplicating.' },
    'register-unavailable': { label: 'Registration unavailable', description: 'Registering answers 503 until you switch scenario, then retry.' },
};