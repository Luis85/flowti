export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function round2(value: number): number {
	return Math.round(value * 100) / 100;
}
