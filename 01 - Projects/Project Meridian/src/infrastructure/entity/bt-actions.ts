import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { ActionResult, PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';
import type { ActionContext } from './bt-action-helpers.js';
import { FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
import { createNeedsActions } from './bt-actions-needs.js';
import { createWorkActions } from './bt-actions-work.js';
import { createEconomyActions } from './bt-actions-economy.js';
import { createSocialActions } from './bt-actions-social.js';
import { createCargoActions } from './bt-actions-cargo.js';
import { createQuestActions } from './bt-actions-quest.js';
import { createServiceActions } from './bt-actions-service.js';
import { createBuyActions } from './bt-actions-buy.js';

/**
 * Returns true when an ongoing travel commitment should be interrupted because
 * one of the agent's needs has crossed the critical threshold. Used by
 * ContinueCommitment to break `seek_*` travel actions in emergencies.
 *
 * Non-travel commitments (work / leisure / eat / drink / rest / buy) are
 * handled by their own break logic and do not go through this helper.
 */
function shouldBreakTravelForCriticalNeed(needs: {
	hunger: number;
	thirst: number;
	energy: number;
}): boolean {
	return (
		needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger
		|| needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst
		|| needs.energy < NEED_CRITICAL_THRESHOLDS.energy
	);
}

const TRAVEL_COMMITMENTS = new Set<string>([
	'seek_food',
	'seek_market',
	'seek_well',
	'seek_quest',
	'seek_quest_source',
	'seek_delivery',
	'seek_supply',
	'seek_job_facility',
	'seek_service',
	'seek_social',
	'seek_work',
]);

export interface ActionMethods {
	Eat(): ActionResult;
	Drink(): ActionResult;
	CollectProduced(): ActionResult;
	RepairWithTools(): ActionResult;
	SellAtMarket(): ActionResult;
	SeekFood(): ActionResult;
	Buy(): ActionResult;
	BuyItem(itemId: string): ActionResult;
	BuyAndDrink(): ActionResult;
	BuyAndEat(): ActionResult;
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
	SeekWell(): ActionResult;
	PickupCargo(): ActionResult;
	DeliverCargo(): ActionResult;
	SeekDeliveryTarget(): ActionResult;
	SeekSupplySource(): ActionResult;
	ClaimQuest(): ActionResult;
	SeekQuestFacility(): ActionResult;
	SeekQuestSource(): ActionResult;
	PickupForQuest(): ActionResult;
	WorkRepair(): ActionResult;
	CompleteQuest(): ActionResult;
	AbandonQuest(): ActionResult;
	Idle(): ActionResult;
	Wander(): ActionResult;
	ChooseServiceFacility(intent: string): ActionResult;
	SeekService(): ActionResult;
	UseService(): ActionResult;
	SeekKnownRestLocation(): ActionResult;
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
	const { getLocations } = deps;

	return {
		...createNeedsActions(ctx),
		...createWorkActions(ctx),
		...createEconomyActions(ctx),
		...createSocialActions(ctx),
		...createCargoActions(ctx),
		...createQuestActions(ctx),
		...createServiceActions(ctx),
		...createBuyActions(ctx),

		// Cross-cutting utilities — small, kept inline
		/** Available for custom BTs — not used in the default tree set. */
		Idle(): ActionResult {
			beginAction(ctx, 'idle');
			return RUNNING;
		},

		Wander(): ActionResult {
			beginAction(ctx, 'wander');
			// Pick a random location to wander toward — enables exploration and discovery
			if (memory.movementTarget === null) {
				const allLocs = getLocations();
				if (allLocs.length > 0) {
					const idx = Math.floor(Math.random() * allLocs.length);
					const target = allLocs[idx];
					if (target !== undefined) {
						memory.movementTarget = { id: target.id, type: 'location' };
					}
				}
			}
			return RUNNING;
		},

		ContinueCommitment(): ActionResult {
			// Helper: break the current commitment, also clearing any in-flight
			// service visit so ServiceSystem's orphan guard doesn't have to chase it.
			const breakCommitment = (reason: string): void => {
				const ca = memory.committedAction;
				const remaining = memory.commitmentTicks;
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				if (ca === 'use_service') {
					memory.currentServiceVisit = null;
					memory.insideFacility = false;
				}
				deps.eventBus.emit({
					type: 'CommitmentChanged',
					tick: deps.tickCount(),
					wallClock: Date.now(),
					source: 'ContinueCommitment',
					payload: {
						agentId: actor.agentId,
						event: reason === 'timer_expired' ? 'expired' : 'broken',
						action: ca ?? '',
						reason,
						ticksRemaining: remaining,
					},
				});
			};

			// Selective exemption for recovery commitments:
			// - use_service: full exemption (already at facility, visit in progress)
			// - buy_and_drink: exempt from thirst (it IS resolving thirst),
			//                  still breaks on critical hunger or energy
			// - buy_and_eat:   exempt from hunger (it IS resolving hunger),
			//                  still breaks on critical thirst or energy
			const ca = memory.committedAction;
			if (ca !== 'use_service') {
				const critNeeds = actor.get(NeedsComponent).state;
				const hungerCritical = ca !== 'buy_and_eat' && critNeeds.hunger < NEED_CRITICAL_THRESHOLDS.hunger;
				const energyCritical = critNeeds.energy < NEED_CRITICAL_THRESHOLDS.energy;
				const thirstCritical = ca !== 'buy_and_drink' && critNeeds.thirst < NEED_CRITICAL_THRESHOLDS.thirst;
				if (hungerCritical || energyCritical || thirstCritical) {
					breakCommitment('critical_need');
					return FAILED;
				}
			}

			memory.commitmentTicks--;
			if (memory.commitmentTicks <= 0) {
				breakCommitment('timer_expired');
				return FAILED;
			}
			// Break consumption commitments when the need is satisfied — prevents waste
			const needs = actor.get(NeedsComponent).state;
			if (ca === 'eat' && needs.hunger >= memory.personalThresholds.hunger) {
				breakCommitment('need_satisfied');
				return FAILED;
			}
			if (ca === 'drink' && needs.thirst >= memory.personalThresholds.thirst) {
				breakCommitment('need_satisfied');
				return FAILED;
			}
			if (ca === 'rest' && needs.energy >= memory.personalThresholds.energy + config.needs.recovery_hysteresis) {
				breakCommitment('need_satisfied');
				return FAILED;
			}
			if (ca === 'buy' && needs.hunger >= memory.personalThresholds.hunger) {
				breakCommitment('need_satisfied');
				return FAILED;
			}
			if (ca === 'buy_and_drink' && needs.thirst >= memory.personalThresholds.thirst) {
				breakCommitment('need_satisfied');
				return FAILED;
			}
			if (ca === 'buy_and_eat' && needs.hunger >= memory.personalThresholds.hunger) {
				breakCommitment('need_satisfied');
				return FAILED;
			}
			// Break work/repair commitments when maintenance needs arise.
			// Repair is a long (25t) stationary action like work — an agent
			// mid-repair shouldn't starve or dehydrate while fixing a building.
			if (ca === 'work' || ca === 'repair') {
				if (needs.hunger < memory.personalThresholds.hunger) {
					breakCommitment('critical_need');
					return FAILED;
				}
				if (needs.thirst < memory.personalThresholds.thirst) {
					breakCommitment('critical_need');
					return FAILED;
				}
				if (needs.energy < memory.personalThresholds.energy) {
					breakCommitment('critical_need');
					return FAILED;
				}
				const inv = actor.get(InventoryComponent).state.items;
				const equip = inv.find(i => i.item_id === 'equipment');
				if (equip === undefined || equip.quantity === 0 || (equip.charges ?? 0) === 0) {
					breakCommitment('critical_need');
					return FAILED;
				}
				if ((equip.charges ?? 0) > 0 && (equip.charges ?? 0) < config.economy.equipment_repair_threshold) {
					breakCommitment('critical_need');
					return FAILED;
				}
			}
			// Break travel commitments when a critical need escalates. Travel is cheap
			// to interrupt (max ~15 ticks of progress) and blocking critical needs
			// causes death spirals (see recording 2026-04-11-1339 — Bram with thirst=0
			// stuck in seek_rest for 70+ ticks).
			if (ca !== null && TRAVEL_COMMITMENTS.has(ca) && shouldBreakTravelForCriticalNeed(needs)) {
				breakCommitment('critical_need');
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
