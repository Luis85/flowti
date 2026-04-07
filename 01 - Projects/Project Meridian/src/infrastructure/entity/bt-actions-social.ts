import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { findNearest } from '../../domain/core/array-utils.js';

export function createSocialActions(ctx: ActionContext): Pick<ActionMethods, 'Talk' | 'SeekSocial'> {
	const { memory, deps, resolveNearbyAgents } = ctx;
	const { config } = deps;

	return {
		Talk(): ActionResult {
			const closeAgents = resolveNearbyAgents().filter(
				a => a.distance < config.perception.interaction_radius,
			);
			if (closeAgents.length === 0) return FAILED;
			beginAction(ctx, 'talk');
			return RUNNING;
		},

		SeekSocial(): ActionResult {
			const nearby = resolveNearbyAgents();
			if (nearby.length === 0) return FAILED;

			beginAction(ctx, 'seek_social');
			const nearest = findNearest(nearby)!;
			memory.movementTarget = { id: nearest.id, type: 'agent' };

			if (nearest.distance < config.perception.interaction_radius) return SUCCEEDED;
			return RUNNING;
		},
	};
}
