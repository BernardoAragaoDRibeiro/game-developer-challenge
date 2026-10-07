import type { Input } from '../game/types';

interface Props {
    onChange: (key: keyof Input, pressed: boolean) => void;
}

interface HoldButtonProps extends Props {
    action: keyof Input;
    label: string;
    ariaLabel: string;
}

function HoldButton({ action, label, ariaLabel, onChange }: HoldButtonProps) {
    return (
        <button
            type="button"
            className="touch-btn"
            aria-label={ariaLabel}
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onChange(action, true);
            }}
            onPointerUp={() => onChange(action, false)}
            onPointerCancel={() => onChange(action, false)}
            onLostPointerCapture={() => onChange(action, false)}
            onContextMenu={(e) => e.preventDefault()}
        >
            {label}
        </button>
    );
}

export function TouchControls({ onChange }: Props) {
    return (
        <div className="touch-controls">
            <div className="touch-cluster">
                <HoldButton action="turnLeft" label="◀" ariaLabel="Turn left" onChange={onChange} />
                <HoldButton action="forward" label="▲" ariaLabel="Sail forward" onChange={onChange} />
                <HoldButton action="turnRight" label="▶" ariaLabel="Turn right" onChange={onChange} />
            </div>
            <div className="touch-cluster">
                <HoldButton action="fireLeft" label="L" ariaLabel="Fire left broadside" onChange={onChange} />
                <HoldButton action="fireFront" label="●" ariaLabel="Fire front cannon" onChange={onChange} />
                <HoldButton action="fireRight" label="R" ariaLabel="Fire right broadside" onChange={onChange} />
            </div>
        </div>
    );
}