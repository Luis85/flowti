import type { MovementTarget, SkillEntry, ModifierMap } from '../../domain/systems/behavior-agent.js';
import type { JourneyState, CargoState, LocationMemoryEntry } from '../../domain/core/component-data.js';
export type { LocationMemoryEntry } from '../../domain/core/component-data.js';
import type { PriceMemory } from '../../domain/systems/price-memory.js';
import type { SupplyRoute } from '../../domain/systems/cargo.js';
import type { QuestRuntime } from '../../domain/schemas/quest-schema.js';
import { CircularBuffer } from 'mnemonist';

/**
 * Item the agent is physically carrying for a claimed quest. Separate from
 * haulCargo which belongs to the supply-chain system. Populated by
 * PickupForQuest, consumed by CompleteQuest, cleared by AbandonQuest.
 */
export interface QuestCargo {
	itemId: string;
	quantity: number;
	questId: string;
}

/**
 * Active service-facility visit. Populated by the `UseService` BT action and
 * consumed by `ServiceSystem`, which ticks `ticksRemaining` down and applies
 * the facility's staffed/unstaffed effects on completion. Cleared on
 * completion or by the orphan guard when the agent leaves mid-visit.
 */
export interface ServiceVisit {
	facilityId: string;
	ticksRemaining: number;
	costPaid: boolean;
}

/**
 * Mood/area modifier queued by nearby `area_effect` facilities. Applied by
 * the mood system on the tick following observation. Populated by the
 * AreaEffectSystem (Task 4.5), drained during mood recomputation.
 */
export interface AreaModifier {
	kind: 'mood';
	delta_per_tick: number;
}

export interface WorkingMemory {
	movementTarget: MovementTarget | null;
	journey: JourneyState | null;
	atLocation: string | null;
	currentRegion: string;
	haulCargo: CargoState | null;
	questCargo: QuestCargo | null;
	readonly socialCooldowns: Map<string, number>;
	committedAction: string | null;
	btAction: string | null;
	gossipPending: string | null;
	locationMemories: LocationMemoryEntry[];
	readonly knownLocations: string[];
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
	serviceTarget: string | null;
	currentServiceVisit: ServiceVisit | null;
	pendingAreaModifiers: AreaModifier[];
	commitmentTicks: number;
	sleepDebt: number;
	ticksRestedThisDay: number;
	personalThresholds: { hunger: number; energy: number; thirst: number };
	priceMemories: CircularBuffer<PriceMemory>;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
}

export function createWorkingMemory(priceMemoryMax: number, locationUsableThreshold = 5): WorkingMemory {
	const priceMemories = new CircularBuffer<PriceMemory>(Array, priceMemoryMax);
	const threshold = locationUsableThreshold;

	return {
		movementTarget: null,
		journey: null,
		atLocation: null,
		currentRegion: '',
		haulCargo: null,
		questCargo: null,
		socialCooldowns: new Map<string, number>(),
		committedAction: null,
		btAction: null,
		gossipPending: null,
		locationMemories: [] as LocationMemoryEntry[],
		get knownLocations(): string[] {
			return this.locationMemories
				.filter(m => m.significance >= threshold)
				.map(m => m.locationId);
		},
		traitModifiers: null,
		skills: [],
		feedingAt: null,
		restingAt: null,
		arrivalSlot: null,
		buyTargetItem: null,
		unemployedTicks: 0,
		recovering: false,
		supplyRoute: null,
		activeQuest: null,
		cachedAvailableQuest: null,
		insideFacility: false,
		serviceTarget: null,
		currentServiceVisit: null,
		pendingAreaModifiers: [],
		commitmentTicks: 0,
		sleepDebt: 0,
		ticksRestedThisDay: 0,
		personalThresholds: { hunger: 40, energy: 30, thirst: 40 },
		priceMemories,
		recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void {
			priceMemories.push({ itemId, price, locationId, tick });
		},
	};
}
