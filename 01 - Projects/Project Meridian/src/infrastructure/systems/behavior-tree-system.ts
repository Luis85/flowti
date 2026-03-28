import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { evaluateBT, type BTNode } from '../../domain/systems/behavior-tree.js';
import { createGameRNG, hashString } from '../../domain/core/game-rng.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { TimeComponent } from '../components/time-component.js';

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

function resolveMovementTarget(
	action: string,
	params: Record<string, unknown>,
	perception: { nearbyAgents: { id: string; distance: number }[]; nearbyLocations: { id: string; type: string; distance: number }[] },
): { id: string; type: 'agent' | 'location' } | null {
	// If action params specify a target explicitly
	if (typeof params.targetId === 'string' && typeof params.targetType === 'string') {
		const targetType = params.targetType === 'agent' ? 'agent' : 'location';
		return { id: params.targetId, type: targetType };
	}

	// Resolve seek_food → nearest food location
	if (action === 'seek_food') {
		const food = perception.nearbyLocations.find(l => l.type === 'food');
		if (food !== undefined) return { id: food.id, type: 'location' };
	}

	// Resolve seek_rest → nearest rest location
	if (action === 'seek_rest') {
		const rest = perception.nearbyLocations.find(l => l.type === 'rest');
		if (rest !== undefined) return { id: rest.id, type: 'location' };
	}

	// Resolve interact → nearest agent
	if (action === 'interact' || action === 'socialize') {
		const nearest = perception.nearbyAgents[0];
		if (nearest !== undefined) return { id: nearest.id, type: 'agent' };
	}

	return null;
}
