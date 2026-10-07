const CONTROLS: readonly (readonly [string, string])[] = [
    ['W / ↑', 'Sail forward'],
    ['A / ←  and  D / →', 'Turn left / right'],
    ['Space', 'Fire front cannon'],
    ['Q / E', 'Fire left / right broadside'],
    ['P / Esc', 'Pause or resume'],
];

export function ControlsList() {
    return (
        <dl className="controls">
            {CONTROLS.map(([keys, action]) => (
                <div key={keys} className="controls-row">
                    <dt>{keys}</dt>
                    <dd>{action}</dd>
                </div>
            ))}
        </dl>
    );
}