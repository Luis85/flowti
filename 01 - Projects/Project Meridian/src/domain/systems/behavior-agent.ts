import type { JourneyState, CargoState } from '../core/component-data.js';
import type { CircularBuffer } from 'mnemonist';
import type { PriceMemory } from './price-memory.js';

export type { CargoState } from '../core/component-data.js';

export interface PerceivedAgent {
	id: string;
	position: { x: number; y: number };
	distance: number;
}

export interface PerceivedLocation {
	id: string;
	type: string;
	position: { x: number; y: number };
	distance: number;
}

export interface PerceivedFacility {
	id: string;
	job: string;
	stock: { item_id: string; quantity: number }[];
	distance: number;
	hasUnmetInput: boolean;
	workerId: string | null;
}

export interface MovementTarget {
	id: string;
	type: 'agent' | 'location';
}

export interface SkillEntry {
	id: string;
	points: number;
	use_count: number;
	use_bonus: number;
}

export type ModifierMap = Record<string, Record<string, unknown>>;

export type ActionResult =
	| 'mistreevous.succeeded'
	| 'mistreevous.failed'
	| 'mistreevous.running';

export interface BehaviorAgent {
	// Index signature required for mistreevous Agent compatibility
	[key: string]: unknown;

	// Read-only state properties
	readonly hunger: number;
	readonly energy: number;
	readonly social: number;
	readonly thirst: number;
	readonly gold: number;
	readonly mood: number;
	readonly moodBucket: string;
	readonly timePhase: string;
	readonly job: string | null;
	readonly position: { x: number; y: number };
	readonly inventory: { item_id: string; quantity: number }[];
	readonly nearbyAgents: PerceivedAgent[];
	readonly nearbyLocations: PerceivedLocation[];
	readonly nearbyFacilities: PerceivedFacility[];

	// BT working memory
	movementTarget: MovementTarget | null;
	journey: JourneyState | null;
	atLocation: string | null;
	currentRegion: string;
	haulCargo: CargoState | null;
	readonly socialCooldowns: Map<string, number>;
	committedAction: string | null;

	// System working memory (migrated from BlackboardComponent)
	btAction: string | null;
	gossipPending: string | null;
	knownLocations: string[];
	traitModifiers: ModifierMap | null;
	skills: SkillEntry[];
	feedingAt: string | null;
	restingAt: string | null;
	arrivalSlot: number | null;
	buyTargetItem: string | null;
	unemployedTicks: number;
	recovering: boolean;

	// Price memory
	priceMemories: CircularBuffer<PriceMemory>;

	// Condition methods (25)
	IsHungry(): boolean;
	IsExhausted(): boolean;
	IsRecovering(): boolean;
	IsLonely(): boolean;
	IsThirsty(): boolean;
	HasWater(): boolean;
	NeedsCritical(): boolean;
	HasFood(): boolean;
	HasFoodReserve(): boolean;
	HasGold(amount: number): boolean;
	CanAffordFood(): boolean;
	AtLocation(type: string): boolean;
	NearLocation(type: string): boolean;
	NearAgent(): boolean;
	NearAgentClose(): boolean;
	IsDaytime(): boolean;
	IsNighttime(): boolean;
	IsWorkHours(): boolean;
	HasJob(): boolean;
	AtJobFacility(): boolean;
	FacilityHasStock(itemId: string): boolean;
	HasCargo(): boolean;
	CargoDestinationNearby(): boolean;
	FacilityNeedsSupply(): boolean;
	KnowsFoodSource(): boolean;
	HasNoJob(): boolean;
	OpenFacilityNearby(): boolean;
	OpenProductionFacilityNearby(): boolean;
	HasTradeGoods(): boolean;
	NeedsTools(): boolean;
	NeedsEquipment(): boolean;
	CanAffordItem(itemId: string): boolean;

	// Action methods (23)
	Eat(): ActionResult;
	Rest(): ActionResult;
	Drink(): ActionResult;
	Harvest(): ActionResult;
	SeekFood(): ActionResult;
	SeekRest(): ActionResult;
	SeekWater(): ActionResult;
	FillWaterskin(): ActionResult;
	SellAtMarket(): ActionResult;
	SeekWork(): ActionResult;
	SeekSocial(): ActionResult;
	SeekMarket(): ActionResult;
	Work(): ActionResult;
	Talk(): ActionResult;
	Buy(): ActionResult;
	BuyItem(itemId: string): ActionResult;
	PickupCargo(): ActionResult;
	DeliverCargo(): ActionResult;
	SeekDeliveryTarget(): ActionResult;
	SeekSupplySource(): ActionResult;
	SeekBestFoodSource(): ActionResult;
	ClaimJob(): ActionResult;
	ClaimBestJob(): ActionResult;
	ReleaseJob(): ActionResult;
	Idle(): ActionResult;
	Wander(): ActionResult;

	// Utility methods
	tickUnemployment(): void;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
}
