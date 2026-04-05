import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyRest, type RestConfig } from '../../domain/systems/rest.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { TimeComponent } from '../components/time-component.js';
import { distance } from '../../domain/core/math-utils.js';
import type { Actor } from 'excalibur';

type RestTier = 'owned_home' | 'public_shelter' | 'outdoors';

function findNearestRestLocation(
	agentX: number, agentY: number,
	locationList: WorldLocation[], radius: number,
): WorldLocation | undefined {
	let nearest: WorldLocation | undefined;
	let nearestDist = Infinity;
	for (const loc of locationList) {
		if (loc.type !== 'rest') continue;
		const dist = distance(agentX, agentY, loc.position.x, loc.position.y);
		if (dist <= radius && dist < nearestDist) {
			nearestDist = dist;
			nearest = loc;
		}
	}
	return nearest;
}

function resolveRestTier(
	nearestRest: WorldLocation | undefined,
	agentProperty: string[],
	btAction: string | null,
	agentGold: number,
	restPrice: number,
): RestTier | null {
	// Only apply rest when agent is resting, idle, or seeking rest — don't charge agents just passing by
	const isResting = btAction === null || btAction === 'idle' || btAction === 'rest' || btAction === 'seek_rest';
	if (!isResting) return null;

	if (nearestRest !== undefined) {
		if (agentProperty.includes(nearestRest.id)) {
			return 'owned_home';
		}
		if (agentGold >= restPrice) {
			return 'public_shelter';
		}
		return 'outdoors';
	}
	return 'outdoors';
}

export function createRestSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	worldEntity: () => Actor,
	getLocationActors?: () => Map<string, Actor>,
): GameSystem {
	return {
		name: 'RestSystem',
		priority: SystemPriority.REST,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const radius = deps.config.perception.interaction_radius;
			const restConfig: RestConfig = deps.config.rest_tiers;
			const locationActors = getLocationActors?.() ?? new Map<string, Actor>();

			// Day boundary: compute sleep deficit and reset counter
			const world = worldEntity();
			if (world.has(TimeComponent) && world.get(TimeComponent).state.dayBoundaryThisTick) {
				const minRest = deps.config.min_rest_ticks ?? 80;
				const maxDebt = deps.config.sleep_debt_max ?? 100;
				for (const agent of agentList) {
					const ba = agent.behaviorAgent;
					const deficit = minRest - ba.ticksRestedThisDay;
					if (deficit > 0) {
						ba.sleepDebt = Math.min(ba.sleepDebt + deficit, maxDebt);
					}
					ba.ticksRestedThisDay = 0;
				}
			}

			for (const agent of agentList) {
				const ba = agent.behaviorAgent;
				const btAction = ba.btAction;

				// Track rest ticks for sleep debt calculation
				if (btAction === 'rest' || btAction === 'idle') {
					ba.ticksRestedThisDay++;
				}

				const nearestRest = findNearestRestLocation(agent.pos.x, agent.pos.y, locationList, radius);
				const wallet = agent.get(WalletComponent);
				const restTier = resolveRestTier(nearestRest, agent.property, btAction, wallet.state.gold, deps.config.economy.rest_price);

				if (restTier === null) {
					if (ba.restingAt !== null) {
						ba.restingAt = null;
					}
					continue;
				}

				const needs = agent.get(NeedsComponent);
				const result = applyRest({ currentEnergy: needs.state.energy, restTier }, restConfig);

				needs.state = { ...needs.state, energy: result.newEnergy };
				needs.markDirty();

				// Reduce sleep debt while resting
				if (ba.sleepDebt > 0) {
					ba.sleepDebt = Math.max(0, ba.sleepDebt - restConfig[restTier].recovery_rate);
				}

				// Track restingAt for first-tick event emission
				const previousRestingAt = ba.restingAt;
				const currentRestingAt = nearestRest?.id ?? 'outdoors';

				if (previousRestingAt !== currentRestingAt) {
					ba.restingAt = currentRestingAt;

					// Deduct gold on first tick of public shelter stay
					if (restTier === 'public_shelter') {
						const world = worldEntity();
						const economy = world.get(EconomyComponent);
						const restPrice = deps.config.economy.rest_price;
						wallet.state = { ...wallet.state, gold: wallet.state.gold - restPrice };
						wallet.markDirty();
						economy.state = {
							...economy.state,
							ledger: [
								...economy.state.ledger,
								{
									tick: deps.tickCount,
									type: 'purchase' as const,
									from: agent.agentId,
									to: nearestRest?.id ?? 'outdoors',
									itemId: null,
									quantity: 0,
									gold: restPrice,
								},
							],
						};
						economy.markDirty();

						// Credit tavern facility fund
						if (nearestRest !== undefined) {
							const restLocationActor = locationActors.get(nearestRest.id);
							if (restLocationActor !== undefined) {
								const facility = restLocationActor.get(FacilityComponent);
								facility.state = { ...facility.state, fund: facility.state.fund + restPrice };
								facility.markDirty();
							}
						}

						deps.eventBus.emit({
							type: 'GoldFlowed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'RestSystem',
							payload: {
								category: 'transfer' as const,
								subcategory: 'rest',
								amount: restPrice,
								fromEntity: agent.agentId,
								toEntity: nearestRest?.id ?? 'outdoors',
							},
						});
					}

					deps.eventBus.emit({
						type: 'RestStarted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'RestSystem',
						payload: {
							agentId: agent.agentId,
							tier: result.tier,
							locationId: nearestRest?.id ?? null,
						},
					});
				}
			}
		},
	};
}
