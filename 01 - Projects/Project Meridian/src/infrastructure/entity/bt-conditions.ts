import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { ConditionContext } from './bt-action-helpers.js';
import { createSurvivalConditions } from './bt-conditions-survival.js';
import { createWorkConditions } from './bt-conditions-work.js';
import { createEconomyConditions } from './bt-conditions-economy.js';
import { createContextConditions } from './bt-conditions-context.js';
import { createQuestConditions } from './bt-conditions-quest.js';

export interface ConditionMethods {
	IsHungry(): boolean;
	IsExhausted(): boolean;
	IsRecovering(): boolean;
	IsLonely(): boolean;
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
	IsThirsty(): boolean;
	HasWater(): boolean;
	HasTradeGoods(): boolean;
	NeedsTools(): boolean;
	NeedsEquipment(): boolean;
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
	IsDusk(): boolean;
	IsSociallyCritical(): boolean;
}

export function createConditions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
	resolveNearbyAgents: () => PerceivedAgent[],
	resolveNearbyLocations: () => PerceivedLocation[],
	getAtLocationData: () => WorldLocation | undefined,
	wakeOffset: number,
	personalSleepOffset = 0,
): ConditionMethods {
	const ctx: ConditionContext = {
		memory, actor, deps,
		resolveNearbyFacilities, resolveNearbyAgents, resolveNearbyLocations,
		getAtLocationData, wakeOffset, personalSleepOffset,
		commitmentMultiplier: 1, // conditions don't use this, but ActionContext requires it
	};
	return {
		...createSurvivalConditions(ctx),
		...createWorkConditions(ctx),
		...createEconomyConditions(ctx),
		...createContextConditions(ctx),
		...createQuestConditions(ctx),
	};
}
