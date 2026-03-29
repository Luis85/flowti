import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyFeed } from '../../domain/systems/feed.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

function distance(ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.sqrt(dx * dx + dy * dy);
}

export function createFeedSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'FeedSystem',
		priority: SystemPriority.FEED,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const radius = deps.config.perception.interaction_radius;

			for (const agent of agentList) {
				let nearestFood: WorldLocation | undefined;
				let nearestDist = Infinity;
				for (const loc of locationList) {
					if (loc.type !== 'food') continue;
					const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
					if (dist <= radius && dist < nearestDist) {
						nearestDist = dist;
						nearestFood = loc;
					}
				}

				if (nearestFood === undefined) continue;

				const needs = agent.get(NeedsComponent);
				const result = applyFeed(
					{ currentHunger: needs.state.hunger },
					{ recovery_rate: deps.config.needs.food_recovery_rate },
				);

				needs.state = { ...needs.state, hunger: result.newHunger };
				needs.markDirty();

				const bb = agent.get(BlackboardComponent);
				const previousFeedingAt = bb.state.feedingAt as string | undefined;

				if (previousFeedingAt !== nearestFood.id) {
					bb.state.feedingAt = nearestFood.id;
					bb.markDirty();

					deps.eventBus.emit({
						type: 'FeedStarted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'FeedSystem',
						payload: {
							agentId: agent.agentId,
							locationId: nearestFood.id,
						},
					});
				}
			}
		},
	};
}
