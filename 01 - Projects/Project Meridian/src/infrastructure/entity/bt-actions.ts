import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { ActionResult, PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';
import type { ActionContext } from './bt-action-helpers.js';
import { FAILED, RUNNING } from './bt-action-helpers.js';
import { NeedsComponent } from '../components/needs-component.js';
import { createNeedsActions } from './bt-actions-needs.js';
import { createWorkActions } from './bt-actions-work.js';
import { createEconomyActions } from './bt-actions-economy.js';
import { createSocialActions } from './bt-actions-social.js';
import { createCargoActions } from './bt-actions-cargo.js';
import { createQuestActions } from './bt-actions-quest.js';
import { createLeisureActions } from './bt-actions-leisure.js';

export interface ActionMethods {
	Eat(): ActionResult;
	Drink(): ActionResult;
	CollectProduced(): ActionResult;
	RepairWithTools(): ActionResult;
	Rest(): ActionResult;
	SeekWater(): ActionResult;
	FillWaterskin(): ActionResult;
	SellAtMarket(): ActionResult;
	SeekFood(): ActionResult;
	SeekRest(): ActionResult;
	Buy(): ActionResult;
	BuyItem(itemId: string): ActionResult;
	SeekBestFoodSource(): ActionResult;
	ClaimJob(): ActionResult;
	ClaimBestJob(): ActionResult;
	SeekJobFacility(): ActionResult;
	ReleaseJob(): ActionResult;
	SwitchJob(): ActionResult;
	Work(): ActionResult;
	Talk(): ActionResult;
	SeekWork(): ActionResult;
	SeekSocial(): ActionResult;
	SeekMarket(): ActionResult;
	PickupCargo(): ActionResult;
	DeliverCargo(): ActionResult;
	SeekDeliveryTarget(): ActionResult;
	SeekSupplySource(): ActionResult;
	ClaimQuest(): ActionResult;
	SeekQuestFacility(): ActionResult;
	WorkRepair(): ActionResult;
	CompleteQuest(): ActionResult;
	AbandonQuest(): ActionResult;
	Idle(): ActionResult;
	Wander(): ActionResult;
	ChooseLeisure(): ActionResult;
	SeekLeisureTarget(): ActionResult;
	Leisure(): ActionResult;
	ContinueCommitment(): ActionResult;
	tickUnemployment(): void;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
}

export function createActions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
	resolveNearbyAgents: () => PerceivedAgent[],
	resolveNearbyLocations: () => PerceivedLocation[],
	commitmentMultiplier = 1.0,
): ActionMethods {
	const ctx: ActionContext = {
		memory, actor, deps,
		resolveNearbyFacilities, resolveNearbyAgents, resolveNearbyLocations,
		commitmentMultiplier,
	};

	const { config } = deps;

	return {
		...createNeedsActions(ctx),
		...createWorkActions(ctx),
		...createEconomyActions(ctx),
		...createSocialActions(ctx),
		...createCargoActions(ctx),
		...createQuestActions(ctx),
		...createLeisureActions(ctx),

		// Cross-cutting utilities — small, kept inline
		ContinueCommitment(): ActionResult {
			memory.commitmentTicks--;
			if (memory.commitmentTicks <= 0) {
				memory.committedAction = null;
				return FAILED;
			}
			// Break consumption commitments when the need is satisfied — prevents waste
			const ca = memory.committedAction;
			const needs = actor.get(NeedsComponent).state;
			if (ca === 'eat' && needs.hunger >= memory.personalThresholds.hunger) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			if (ca === 'drink' && needs.thirst >= memory.personalThresholds.thirst) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			if (ca === 'rest' && needs.energy >= memory.personalThresholds.energy + config.needs.recovery_hysteresis) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			if (ca === 'buy' && needs.hunger >= memory.personalThresholds.hunger) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			// Restore btAction so downstream systems (rest, needs-decay) see the correct activity
			memory.btAction = memory.committedAction;
			return RUNNING;
		},

		tickUnemployment(): void {
			if (actor.job === null) {
				memory.unemployedTicks++;
			} else {
				memory.unemployedTicks = 0;
			}
		},

		recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void {
			memory.priceMemories.push({ itemId, price, locationId, tick });
		},
	};
}
