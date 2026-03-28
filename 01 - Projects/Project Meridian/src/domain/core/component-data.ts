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

export interface AttributesState {
	ST: number;
	DX: number;
	IQ: number;
	HT: number;
}

export interface SocialState {
	status: number;
	reputation: number;
	charisma: number;
}

export interface TimeState {
	phase: 'dawn' | 'day' | 'dusk' | 'night';
	tickInCycle: number;
	dayCount: number;
}

export interface PerceptionState {
	nearbyAgents: { id: string; distance: number }[];
	nearbyLocations: { id: string; type: string; distance: number }[];
}
