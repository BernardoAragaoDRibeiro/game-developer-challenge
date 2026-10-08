export function formatDate(iso: string): string {
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function formatDuration(seconds: number): string {
    return `${seconds.toFixed(1)}s`;
}

export function endReasonText(reason: 'time' | 'death'): string {
    return reason === 'death' ? 'Ship destroyed' : 'Time ran out';
}