export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.sqrt(dx * dx + dy * dy);
}

/** Canonical sorted pair key for deduplicating symmetric interactions. */
export function pairKey(a: string, b: string): string {
	return a < b ? `${a}:${b}` : `${b}:${a}`;
}
