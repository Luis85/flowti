import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyRest, type RestConfig } from '../../domain/systems/rest.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { distance } from '../../domain/core/math-utils.js';

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
): RestTier | null {
	if (nearestRest !== undefined) {
		return agentProperty.includes(nearestRest.id) ? 'owned_home' : 'public_shelter';
	}
	if (btAction === undefined || btAction === 'idle') {
		return 'outdoors';
	}
	return null;
}

export function createRestSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
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
				const restTier = resolveRestTier(nearestRest, agent.property, btAction);

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
