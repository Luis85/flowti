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
import type { JourneyState, PerceptionState } from '../../domain/core/component-data.js';
import { pointInPolygon } from '../../domain/core/polygon.js';
import { findRegionPath, type RegionGraph } from '../../domain/systems/pathfinding.js';
import { computeCrossingPoint } from '../../domain/systems/crossing-point.js';
import type { WorldRegion } from '../../domain/schemas/region-schema.js';

const BT_PREFIX = 'bt-';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
	btDefinitions: Record<string, BTNode>,
	worldEntity: () => Actor,
	baseSeed: number,
	getLocationActors?: () => Map<string, Actor>,
	getLocations?: () => WorldLocation[],
	getRegions?: () => WorldRegion[],
	regionGraph?: RegionGraph,
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
					let movementTarget = resolveMovementTarget(result.action, result.params, perception.state, agent.job, locationList);

					const prevAction = bb.state.btAction as string | undefined;
					const actionChanged = result.action !== prevAction;
					if (actionChanged) {
						deps.logger.debug('BT', `${agent.agentName}: ${prevAction ?? 'none'} → ${result.action}`, {
							needs: needs.state,
							target: movementTarget?.id ?? null,
						});
					}

					// Clear journey when action changes
					const existingJourney = actionChanged ? undefined : bb.state.journey as JourneyState | undefined;

					// Detect cross-region journey (skip if already tracking same target)
					const regionList = getRegions?.() ?? [];
					let journey: JourneyState | undefined = existingJourney;
					if (movementTarget !== null && movementTarget.type === 'location' && regionList.length > 0 && regionGraph !== undefined) {
						const alreadyTracking = existingJourney !== undefined && existingJourney.finalTarget.id === movementTarget.id;
						if (alreadyTracking) {
							movementTarget = { id: JOURNEY_SENTINEL, type: 'location' };
						} else {
							const resolved = resolveJourney(
								agent.pos, bb, movementTarget, locationList, regionList, regionGraph,
							);
							if (resolved !== undefined) {
								journey = resolved;
								movementTarget = { id: JOURNEY_SENTINEL, type: 'location' };
							}
						}
					}

					bb.state = {
						...bb.state,
						btAction: result.action,
						btParams: result.params,
						...(movementTarget !== null ? { movementTarget } : {}),
						...(journey !== undefined ? { journey } : actionChanged ? { journey: undefined } : {}),
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

export const JOURNEY_SENTINEL = '__journey__';

function resolveJourney(
	agentPos: { x: number; y: number },
	bb: { state: Record<string, unknown> },
	movementTarget: { id: string; type: 'agent' | 'location' },
	locationList: WorldLocation[],
	regionList: WorldRegion[],
	graph: RegionGraph,
): JourneyState | undefined {
	// Determine agent's current region
	const agentRegion = resolveAgentRegion(agentPos, bb, regionList);
	if (agentRegion === undefined) return undefined;

	// Determine target location's region
	const targetLoc = locationList.find(l => l.id === movementTarget.id);
	if (targetLoc === undefined) return undefined;
	const targetRegion = targetLoc.region ?? undefined;
	if (targetRegion === undefined) return undefined;

	// Same region — no journey needed
	if (agentRegion === targetRegion) return undefined;

	// Find path between regions
	const pathResult = findRegionPath(graph, agentRegion, targetRegion);
	if (pathResult === null || pathResult.path.length < 2) return undefined;

	// Build waypoints for each hop (skip the first region — that's where the agent already is)
	const waypoints = [];
	for (let i = 0; i < pathResult.path.length - 1; i++) {
		const fromId = pathResult.path[i]!;
		const toId = pathResult.path[i + 1]!;
		const fromRegion = regionList.find(r => r.id === fromId);
		const toRegion = regionList.find(r => r.id === toId);
		if (fromRegion === undefined || toRegion === undefined) return undefined;

		const crossingPoint = computeCrossingPoint(
			{ vertices: fromRegion.bounds },
			{ vertices: toRegion.bounds },
		);

		// Get travel cost from the connection
		const conn = fromRegion.connections.find(c => c.regionId === toId);
		const travelCost = conn?.travel_cost ?? 1;

		waypoints.push({
			regionId: toId,
			crossingPoint,
			travelCost,
		});
	}

	return {
		waypoints,
		waypointIndex: 0,
		finalTarget: { id: movementTarget.id, type: movementTarget.type },
		totalCost: pathResult.totalCost,
	};
}

function resolveAgentRegion(
	agentPos: { x: number; y: number },
	bb: { state: Record<string, unknown> },
	regionList: WorldRegion[],
): string | undefined {
	// Check blackboard first
	const bbRegion = bb.state.currentRegion;
	if (typeof bbRegion === 'string' && bbRegion.length > 0) return bbRegion;

	// Fall back to point-in-polygon test
	for (const region of regionList) {
		if (pointInPolygon(agentPos.x, agentPos.y, { vertices: region.bounds })) {
			return region.id;
		}
	}
	return undefined;
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
	agentJob: string | null,
	allLocations: WorldLocation[],
): { id: string; type: 'agent' | 'location' } | null {
	if (typeof params.targetId === 'string' && typeof params.targetType === 'string') {
		const targetType = params.targetType === 'agent' ? 'agent' : 'location';
		return { id: params.targetId, type: targetType };
	}

	// seek_work: find agent's job facility from ALL locations (not just perceived)
	// Agents must be able to decide to go to work even when the facility is far away
	if (action === 'seek_work' && agentJob !== null) {
		const jobFacility = allLocations.find(l => l.production !== null && l.production.job === agentJob);
		if (jobFacility !== undefined) return { id: jobFacility.id, type: 'location' };
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
