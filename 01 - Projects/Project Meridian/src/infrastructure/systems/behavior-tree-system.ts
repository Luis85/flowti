import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { evaluateBT, type BTContext, type BTNode } from '../../domain/systems/behavior-tree.js';
import { createGameRNG, hashString } from '../../domain/core/game-rng.js';
import { AGENT_SOCIAL_ACTIONS } from '../../domain/systems/bt-actions.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { TimeComponent } from '../components/time-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { distance } from '../../domain/core/math-utils.js';
import type { PerceptionState } from '../../domain/core/component-data.js';

const BT_PREFIX = 'bt-';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
	btDefinitions: Record<string, BTNode>,
	worldEntity: () => Actor,
	baseSeed: number,
	getLocationActors?: () => Map<string, Actor>,
	getLocations?: () => WorldLocation[],
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,

		execute(deps: GameCoreDeps): void {
			const world = worldEntity();
			const timeComp = world.get(TimeComponent);
			const timePhase = timeComp.state.phase;

			const locationActorMap = getLocationActors?.() ?? new Map<string, Actor>();
			const locationList = getLocations?.() ?? [];

			for (const agent of agents()) {
				const btKey = agent.behaviorTree.startsWith(BT_PREFIX) ? agent.behaviorTree.slice(BT_PREFIX.length) : agent.behaviorTree;
				const bt = btDefinitions[btKey];
				if (bt === undefined) continue;

				const needs = agent.get(NeedsComponent);
				const mood = agent.get(MoodComponent);
				const perception = agent.get(PerceptionComponent);
				const bb = agent.get(BlackboardComponent);

				const seed = (baseSeed ^ deps.tickCount ^ hashString(agent.agentId)) >>> 0;
				const rng = createGameRNG(seed);

				const wallet = agent.get(WalletComponent);
				const inv = agent.get(InventoryComponent);

				const nearbyFacilities: BTContext['nearbyFacilities'] = [];
				for (const loc of locationList) {
					if (loc.production === null) continue;
					const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
					if (dist > deps.config.perception.interaction_radius) continue;
					const locActor = locationActorMap.get(loc.id);
					if (locActor === undefined) continue;
					const facility = locActor.get(FacilityComponent);
					nearbyFacilities.push({
						id: loc.id,
						job: loc.production.job,
						stock: [...facility.state.stock],
					});
				}

				const result = evaluateBT(bt, {
					needs: needs.state,
					mood: mood.state,
					perception: perception.state,
					timePhase,
					rng,
					interactionRadius: deps.config.perception.interaction_radius,
					wallet: wallet.state.gold,
					inventory: [...inv.state.items],
					job: agent.job,
					nearbyFacilities,
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
	seek_market: 'market',
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
