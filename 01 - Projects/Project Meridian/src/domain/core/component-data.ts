export interface NeedsState {
	hunger: number;
	energy: number;
	social: number;
}

export interface MoodState {
	value: number;
	bucket: string;
}

export interface MemoryEntry {
	tick: number;
	type: string;
	description: string;
	participants: string[];
	outcome: 'positive' | 'negative' | 'neutral';
	significance: number;
	mood_impact: number;
	original_significance?: number;
}

export interface MemoryState {
	entries: MemoryEntry[];
	maxEntries: number;
}

export interface BlackboardState {
	[key: string]: unknown;
}
