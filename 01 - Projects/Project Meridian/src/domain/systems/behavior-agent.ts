import type { JourneyState, CargoState } from '../core/component-data.js';
import type { CircularBuffer } from 'mnemonist';
import type { PriceMemory } from './price-memory.js';
import type { SupplyRoute } from './cargo.js';
import type { QuestRuntime } from '../schemas/quest-schema.js';

export type { CargoState } from '../core/component-data.js';

export interface PerceivedAgent {
	id: string;
	position: { x: number; y: number };
	distance: number;
}

export interface PerceivedLocation {
	id: string;
	type: string;            // LEGACY — dropped in Phase 3
	facility_type: string;   // NEW — Phase 2 plumb-through
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
	wage: number;
	status: string;
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
	questCargo: { itemId: string; quantity: number; questId: string } | null;
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
	supplyRoute: SupplyRoute | null;
	activeQuest: QuestRuntime | null;
	cachedAvailableQuest: QuestRuntime | null;
	insideFacility: boolean;
	leisureTarget: string | null;
	serviceTarget: string | null;
	currentServiceVisit: { facilityId: string; ticksRemaining: number; costPaid: boolean } | null;
	pendingAreaModifiers: { kind: 'mood'; delta_per_tick: number }[];
	commitmentTicks: number;
	sleepDebt: number;
	ticksRestedThisDay: number;
	readonly personalThresholds: { hunger: number; energy: number; thirst: number };
	readonly wakeOffset: number;
	readonly sleepOffset: number;

	// Price memory
	priceMemories: CircularBuffer<PriceMemory>;

	// Condition methods (29)
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
	NeedsRepair(): boolean;
	HasTools(): boolean;
	CanAffordItem(itemId: string): boolean;
	BetterPayAvailable(): boolean;
	KnowsSupplyRoute(): boolean;
	HasQuest(): boolean;
	QuestAvailable(): boolean;
	QuestAtFacility(): boolean;
	QuestCargoReady(): boolean;
	IsCommitted(): boolean;
	ShouldSleep(): boolean;
	IsRestDay(): boolean;
	IsMoodLow(): boolean;
	IsAtLeisure(): boolean;

	// Action methods
	Eat(): ActionResult;
	Rest(): ActionResult;
	Drink(): ActionResult;
	CollectProduced(): ActionResult;
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
	SeekJobFacility(): ActionResult;
	ReleaseJob(): ActionResult;
	SwitchJob(): ActionResult;
	ClaimQuest(): ActionResult;
	SeekQuestFacility(): ActionResult;
	SeekQuestSource(): ActionResult;
	PickupForQuest(): ActionResult;
	WorkRepair(): ActionResult;
	CompleteQuest(): ActionResult;
	AbandonQuest(): ActionResult;
	RepairWithTools(): ActionResult;
	ContinueCommitment(): ActionResult;
	Idle(): ActionResult;
	Wander(): ActionResult;
	ChooseLeisure(): ActionResult;
	SeekLeisureTarget(): ActionResult;
	Leisure(): ActionResult;
	ChooseServiceFacility(intent: string): ActionResult;
	SeekService(): ActionResult;
	UseService(): ActionResult;

	// Utility methods
	tickUnemployment(): void;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
	claimFacility(facilityId: string): boolean;
	releaseFacility(): void;
}
