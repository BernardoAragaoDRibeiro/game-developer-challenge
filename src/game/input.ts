import { NO_INPUT } from './simulation';
import type { Input } from './types';

const KEY_MAP: Record<string, keyof Input> = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyA: 'turnLeft', ArrowLeft: 'turnLeft',
    KeyD: 'turnRight', ArrowRight: 'turnRight',
    Space: 'fireFront', KeyQ: 'fireLeft', KeyE: 'fireRight',
};

export function createKeyboardInput(isActive: () => boolean) {
    const input: Input = { ...NO_INPUT };

    const onDown = (e: KeyboardEvent) => {
        const action = KEY_MAP[e.code];
        if (!action || !isActive()) return;
        e.preventDefault();
        input[action] = true;
    };
    const onUp = (e: KeyboardEvent) => {
        const action = KEY_MAP[e.code];
        if (action) input[action] = false;
    };
    const reset = () => Object.assign(input, NO_INPUT);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', reset);

    return {
        input,
        reset,
        dispose() {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
            window.removeEventListener('blur', reset);
        },
    };
}