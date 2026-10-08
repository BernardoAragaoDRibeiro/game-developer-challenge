export const SCENARIO_IDS = [
    'success', 'empty', 'slow', 'variable-latency', 'out-of-order', 'timeout',
    'connection-failure', 'client-error', 'server-error', 'ranking-fails', 'history-fails',
    'register-timeout-after-commit', 'register-unavailable',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface NetworkSettings {
    scenario: ScenarioId;
    seed: number;
    latencyMs: number;
    timeoutMs: number;
}

export const DEFAULT_NETWORK: NetworkSettings = {
    scenario: 'success', seed: 1, latencyMs: 200, timeoutMs: 5000,
};

export const NETWORK_KEY = 'pirate-battle:net-settings';

export function readNetworkSettings(): NetworkSettings {
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(NETWORK_KEY) ?? 'null');
        if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_NETWORK };
        const o = raw as Record<string, unknown>;
        const num = (v: unknown, fallback: number, min: number) =>
            typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback;
        return {
            scenario: SCENARIO_IDS.find((id) => id === o.scenario) ?? DEFAULT_NETWORK.scenario,
            seed: num(o.seed, DEFAULT_NETWORK.seed, 0),
            latencyMs: num(o.latencyMs, DEFAULT_NETWORK.latencyMs, 0),
            timeoutMs: num(o.timeoutMs, DEFAULT_NETWORK.timeoutMs, 1),
        };
    } catch {
        return { ...DEFAULT_NETWORK };
    }
}

export function writeNetworkSettings(patch: Partial<NetworkSettings>): void {
    try {
        localStorage.setItem(NETWORK_KEY, JSON.stringify({ ...readNetworkSettings(), ...patch }));
    } catch {
        // storage unavailable: the scenario just won't persist
    }
}