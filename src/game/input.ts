import { NO_INPUT } from './simulation';
import type { Input } from './types';

const KEY_MAP: Record<string, keyof Input> = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyA: 'turnLeft', ArrowLeft: 'turnLeft',
    KeyD: 'turnRight', ArrowRight: 'turnRight',
    Space: 'fireFront', KeyQ: 'fireLeft', KeyE: 'fireRight',
};

export function createKeyboardInput() {
    const input: Input = { ...NO_INPUT };

    const set = (e: KeyboardEvent, value: boolean) => {
        const action = KEY_MAP[e.code];
        if (!action) return;
        e.preventDefault();
        input[action] = value;
    };
    const onDown = (e: KeyboardEvent) => set(e, true);
    const onUp = (e: KeyboardEvent) => set(e, false);
    const onBlur = () => Object.assign(input, NO_INPUT);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);

    return {
        input,
        dispose() {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
            window.removeEventListener('blur', onBlur);
        },
    };
}