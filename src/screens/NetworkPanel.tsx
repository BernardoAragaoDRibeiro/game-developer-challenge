import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
    readNetworkSettings, SCENARIO_IDS, writeNetworkSettings, type ScenarioId,
} from '../api/networkSettings';
import { resetMockState, seedSampleMatches } from '../mocks/controls';
import { resetRuntime } from '../mocks/runtime';
import { SCENARIO_INFO } from '../mocks/scenarios';

export function NetworkPanel() {
    const queryClient = useQueryClient();
    const [scenario, setScenario] = useState<ScenarioId>(() => readNetworkSettings().scenario);

    const choose = (id: ScenarioId) => {
        writeNetworkSettings({ scenario: id });
        resetRuntime();
        setScenario(id);
        void queryClient.invalidateQueries();
    };

    return (
        <details className="devtools">
            <summary>Network scenarios (mock API)</summary>
            <div className="field">
                <label htmlFor="scenario">Scenario</label>
                <select id="scenario" value={scenario} onChange={(e) => choose(e.target.value as ScenarioId)}>
                    {SCENARIO_IDS.map((id) => (
                        <option key={id} value={id}>{SCENARIO_INFO[id].label}</option>
                    ))}
                </select>
                <p className="muted">{SCENARIO_INFO[scenario].description}</p>
            </div>
            <div className="button-row">
                <button
                    type="button" className="btn small"
                    onClick={() => { seedSampleMatches(); void queryClient.invalidateQueries(); }}
                >
                    Add 12 sample matches
                </button>
                <button
                    type="button" className="btn small"
                    onClick={() => { resetMockState(); window.location.reload(); }}
                >
                    Reset mock data and scenario
                </button>
            </div>
        </details>
    );
}