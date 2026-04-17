/**
 * Compute a shallow diff between two settings blobs (keyed by section name,
 * e.g. { core: {...}, eventInspector: {...} }).  Each changed section shows up
 * as one entry so downstream consumers (Event Inspector, modules) can tell
 * exactly what changed without scanning the entire blob.
 */
export function diffSettingsBlob(
	previous: unknown,
	current: unknown,
): ReadonlyArray<{ key: string; previous?: unknown; current?: unknown }> {
	const prev = isRecord(previous) ? previous : {};
	const next = isRecord(current) ? current : {};
	const keys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);

	const changes: Array<{ key: string; previous?: unknown; current?: unknown }> = [];
	for (const key of keys) {
		const p = prev[key];
		const c = next[key];
		if (sameJson(p, c)) continue;
		const entry: { key: string; previous?: unknown; current?: unknown } = { key };
		if (key in prev) entry.previous = p;
		if (key in next) entry.current = c;
		changes.push(entry);
	}
	return changes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameJson(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	return JSON.stringify(a) === JSON.stringify(b);
}
