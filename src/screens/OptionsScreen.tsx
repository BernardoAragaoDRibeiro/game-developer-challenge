import { useState, type FormEvent } from 'react';
import {
    loadSettings, saveSettings, SETTINGS_LIMITS, validateSettings, type Settings,
} from '../game/settings';
import { useHeadingFocus } from './useHeadingFocus';

interface Props {
    onBack: () => void;
}

export function OptionsScreen({ onBack }: Props) {
    const heading = useHeadingFocus();
    const [initial] = useState(loadSettings);
    const [sessionTime, setSessionTime] = useState(String(initial.sessionTime));
    const [spawnInterval, setSpawnInterval] = useState(String(initial.spawnInterval));
    const [saved, setSaved] = useState(false);

    const parsed: Settings = {
        sessionTime: sessionTime.trim() === '' ? NaN : Number(sessionTime),
        spawnInterval: spawnInterval.trim() === '' ? NaN : Number(spawnInterval),
    };
    const errors = validateSettings(parsed);
    const valid = Object.keys(errors).length === 0;
    const t = SETTINGS_LIMITS.sessionTime;
    const i = SETTINGS_LIMITS.spawnInterval;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        saveSettings(parsed);
        setSaved(true);
    };

    return (
        <main className="panel">
            <h1 ref={heading} tabIndex={-1}>Options</h1>
            <form onSubmit={submit} noValidate>
                <div className="field">
                    <label htmlFor="session-time">Game session time (seconds)</label>
                    <input
                        id="session-time" type="number" inputMode="numeric"
                        min={t.min} max={t.max} step={t.step} value={sessionTime}
                        aria-invalid={errors.sessionTime ? true : undefined}
                        aria-describedby="session-time-help session-time-error"
                        onChange={(e) => { setSessionTime(e.target.value); setSaved(false); }}
                    />
                    <p id="session-time-help" className="muted">Whole seconds, {t.min} to {t.max}.</p>
                    <p id="session-time-error" className="error" role="alert">{errors.sessionTime ?? ''}</p>
                </div>

                <div className="field">
                    <label htmlFor="spawn-interval">Enemy spawn time (seconds)</label>
                    <input
                        id="spawn-interval" type="number" inputMode="decimal"
                        min={i.min} max={i.max} step={i.step} value={spawnInterval}
                        aria-invalid={errors.spawnInterval ? true : undefined}
                        aria-describedby="spawn-interval-help spawn-interval-error"
                        onChange={(e) => { setSpawnInterval(e.target.value); setSaved(false); }}
                    />
                    <p id="spawn-interval-help" className="muted">Seconds between spawns, {i.min} to {i.max}.</p>
                    <p id="spawn-interval-error" className="error" role="alert">{errors.spawnInterval ?? ''}</p>
                </div>

                <div className="button-row">
                    <button type="submit" className="btn primary" disabled={!valid}>Save</button>
                    <button type="button" className="btn" onClick={onBack}>Back</button>
                </div>
                <p role="status" className="muted">{saved ? 'Settings saved.' : ''}</p>
            </form>
        </main>
    );
}