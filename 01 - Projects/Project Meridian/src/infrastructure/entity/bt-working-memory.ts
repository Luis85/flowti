import type { MovementTarget, SkillEntry, ModifierMap } from '../../domain/systems/behavior-agent.js';
import type { JourneyState, CargoState } from '../../domain/core/component-data.js';
import type { PriceMemory } from '../../domain/systems/price-memory.js';
import type { SupplyRoute } from '../../domain/systems/cargo.js';
import type { QuestRuntime } from '../../domain/schemas/quest-schema.js';
import { CircularBuffer } from 'mnemonist';

export interface WorkingMemory {
	movementTarget: MovementTarget | null;
	journey: JourneyState | null;
	atLocation: string | null;
	currentRegion: string;
	haulCargo: CargoState | null;
	readonly socialCooldowns: Map<string, number>;
	committedAction: string | null;
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
	commitmentTicks: number;
	sleepDebt: number;
	ticksRestedThisDay: number;
	personalThresholds: { hunger: number; energy: number; thirst: number };
	priceMemories: CircularBuffer<PriceMemory>;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
}

export function createWorkingMemory(priceMemoryMax: number): WorkingMemory {
	const priceMemories = new CircularBuffer<PriceMemory>(Array, priceMemoryMax);

	return {
		movementTarget: null,
		journey: null,
		atLocation: null,
		currentRegion: '',
		haulCargo: null,
		socialCooldowns: new Map<string, number>(),
		committedAction: null,
		btAction: null,
		gossipPending: null,
		knownLocations: [],
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
