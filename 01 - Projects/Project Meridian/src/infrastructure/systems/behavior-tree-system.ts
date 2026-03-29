import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { evaluateBT, type BTNode } from '../../domain/systems/behavior-tree.js';
import { createGameRNG, hashString } from '../../domain/core/game-rng.js';
import { AGENT_SOCIAL_ACTIONS } from '../../domain/systems/bt-actions.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { TimeComponent } from '../components/time-component.js';
import type { PerceptionState } from '../../domain/core/component-data.js';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
	btDefinitions: Record<string, BTNode>,
	worldEntity: () => Actor,
	baseSeed: number,
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,

		execute(deps: GameCoreDeps): void {
			const world = worldEntity();
			const timeComp = world.get(TimeComponent);
			const timePhase = timeComp.state.phase;

			for (const agent of agents()) {
				const bt = btDefinitions[agent.kind];
				if (bt === undefined) continue;

				const needs = agent.get(NeedsComponent);
				const mood = agent.get(MoodComponent);
				const perception = agent.get(PerceptionComponent);
				const bb = agent.get(BlackboardComponent);

				const seed = (baseSeed ^ deps.tickCount ^ hashString(agent.agentId)) >>> 0;
				const rng = createGameRNG(seed);

				const result = evaluateBT(bt, {
					needs: needs.state,
					mood: mood.state,
					perception: perception.state,
					timePhase,
					rng,
				});

				if (result.action !== null) {
					// Resolve movementTarget from perception if action implies movement
					const movementTarget = resolveMovementTarget(result.action, result.params, perception.state);

					const prevAction = bb.state.btAction as string | undefined;
					if (result.action !== prevAction) {
						deps.logger.debug('BT', `${agent.agentName}: ${prevAction ?? 'none'} → ${result.action}`, {
							needs: needs.state,
							target: movementTarget?.id ?? null,
						});
					}

					bb.state = {
						...bb.state,
						btAction: result.action,
						btParams: result.params,
						...(movementTarget !== null ? { movementTarget } : {}),
					};
					bb.markDirty();

					deps.eventBus.emit({
						type: 'BTActionSelected',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'BehaviorTreeSystem',
						payload: {
							agentId: agent.agentId,
							action: result.action,
							params: result.params,
						},
					});
				}
			}
		},
	};
}

const LOCATION_ACTIONS: Record<string, string> = {
	seek_food: 'food',
	seek_rest: 'rest',
	seek_social: 'social',
	seek_work: 'work',
};

function resolveMovementTarget(
	action: string,
	params: Record<string, unknown>,
	perception: PerceptionState,
): { id: string; type: 'agent' | 'location' } | null {
	if (typeof params.targetId === 'string' && typeof params.targetType === 'string') {
		const targetType = params.targetType === 'agent' ? 'agent' : 'location';
		return { id: params.targetId, type: targetType };
	}

	const locationType = LOCATION_ACTIONS[action];
	if (locationType !== undefined) {
		const loc = perception.nearbyLocations.find(l => l.type === locationType);
		if (loc !== undefined) return { id: loc.id, type: 'location' };
	}

	if (AGENT_SOCIAL_ACTIONS.has(action)) {
		const nearest = perception.nearbyAgents[0];
		if (nearest !== undefined) return { id: nearest.id, type: 'agent' };
	}

	return null;
}
