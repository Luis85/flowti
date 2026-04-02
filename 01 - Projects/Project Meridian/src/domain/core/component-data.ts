export interface MonetarySnapshot {
	moneySupply: number;
	velocity: number;
	faucetRate: number;
	sinkRate: number;
	netFlow: number;
}

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
	metadata?: Record<string, unknown>;
}

export interface MemoryState {
	entries: MemoryEntry[];
	maxEntries: number;
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

export interface FacilityState {
	stock: { item_id: string; quantity: number }[];
	fund: number;
	workProgress: number;
	status: 'idle' | 'producing' | 'auto';
	workerId: string | null;
	currentPrices?: Record<string, number>;
}

export interface RelationshipEntry {
	agentId: string;
	disposition: number;
	familiarity: number;
	tags: string[];
	lastInteractionTick: number;
}

export interface RelationshipState {
	entries: RelationshipEntry[];
}

export interface LedgerEntry {
	tick: number;
	type: 'wage' | 'purchase' | 'tax' | 'consumption' | 'welfare' | 'stipend' | 'subsidy';
	from: string;
	to: string;
	itemId: string | null;
	quantity: number;
	gold: number;
}

export type FlowCategory = 'faucet' | 'sink' | 'transfer';

export interface GoldFlow {
	category: FlowCategory;
	subcategory: string;
	amount: number;
	tick: number;
	fromEntity: string | null;
	toEntity: string | null;
}

export interface DailySummary {
	totalWages: number;
	totalTax: number;
	totalSales: number;
	totalConsumption: number;
}

export interface EconomyState {
	treasury: number;
	ledger: LedgerEntry[];
	dailySummary: DailySummary;
	monetarySnapshot?: MonetarySnapshot;
}

export interface WalletState {
	gold: number;
}

export interface InventoryState {
	items: { item_id: string; quantity: number }[];
}

export interface JourneyWaypoint {
	regionId: string;
	crossingPoint: { x: number; y: number };
	travelCost: number;
}

export interface JourneyState {
	waypoints: JourneyWaypoint[];
	waypointIndex: number;
	finalTarget: { id: string; type: 'agent' | 'location' };
	totalCost: number;
}

export interface StaminaState {
	current: number;
	max: number;
}

export interface CargoState {
	itemId: string;
	quantity: number;
	source: string;
	destination: string;
}
