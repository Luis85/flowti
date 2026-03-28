export interface Quarantine {
	readonly quarantined: string[];
	add(path: string): void;
	has(path: string): boolean;
	clear(): void;
}

export function createQuarantine(): Quarantine {
	const paths: string[] = [];
	return {
		get quarantined() { return [...paths]; },
		add(path: string) { if (!paths.includes(path)) paths.push(path); },
		has(path: string) { return paths.includes(path); },
		clear() { paths.length = 0; },
	};
}
