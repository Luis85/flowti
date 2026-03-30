import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyRest, type RestConfig } from '../../domain/systems/rest.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
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
	btAction: string | undefined,
	agentGold: number,
	restPrice: number,
): RestTier | null {
	// Only apply rest when agent is resting or idle — don't charge agents just passing by
	const isResting = btAction === undefined || btAction === 'idle' || btAction === 'rest';
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
): GameSystem {
	return {
		name: 'RestSystem',
		priority: SystemPriority.REST,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const radius = deps.config.perception.interaction_radius;
			const restConfig: RestConfig = deps.config.rest_tiers;

			for (const agent of agentList) {
				const bb = agent.get(BlackboardComponent);
				const btAction = bb.state.btAction as string | undefined;

				const nearestRest = findNearestRestLocation(agent.pos.x, agent.pos.y, locationList, radius);
				const wallet = agent.get(WalletComponent);
				const restTier = resolveRestTier(nearestRest, agent.property, btAction, wallet.state.gold, deps.config.economy.rest_price);

				if (restTier === null) {
					if (bb.state.restingAt !== undefined) {
						bb.state = { ...bb.state, restingAt: undefined };
						bb.markDirty();
					}
					continue;
				}

				const needs = agent.get(NeedsComponent);
				const result = applyRest({ currentEnergy: needs.state.energy, restTier }, restConfig);

				needs.state = { ...needs.state, energy: result.newEnergy };
				needs.markDirty();

				// Track restingAt for first-tick event emission
				const previousRestingAt = bb.state.restingAt as string | undefined;
				const currentRestingAt = nearestRest?.id ?? 'outdoors';

				if (previousRestingAt !== currentRestingAt) {
					bb.state = { ...bb.state, restingAt: currentRestingAt };
					bb.markDirty();

					// Deduct gold on first tick of public shelter stay
					if (restTier === 'public_shelter') {
						const world = worldEntity();
						const economy = world.get(EconomyComponent);
						wallet.state = { ...wallet.state, gold: wallet.state.gold - deps.config.economy.rest_price };
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
									gold: deps.config.economy.rest_price,
								},
							],
						};
						economy.markDirty();
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
