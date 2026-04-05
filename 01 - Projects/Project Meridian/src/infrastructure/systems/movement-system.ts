import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { AttributesComponent } from '../components/attributes-component.js';
import { NeedsComponent } from '../components/needs-component.js';
import { StaminaComponent } from '../components/stamina-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
import { clamp, distance } from '../../domain/core/math-utils.js';
import { resolveArrivalOffset } from '../../domain/systems/arrival-spread.js';
import type { JourneyState } from '../../domain/core/component-data.js';

/** Sentinel value used by journey waypoint navigation. */
export const JOURNEY_SENTINEL = '__journey__';

/** Snap-to-target when within this fraction of per-tick speed — value from config.formulas.arrival_threshold_multiplier */

interface MovementTarget {
	id: string;
	type: 'agent' | 'location';
}

function isMovementTarget(value: unknown): value is MovementTarget {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === 'string' && (v.type === 'agent' || v.type === 'location');
}

function drainMovementEnergy(
	agent: AgentActor,
	speedPerTick: number,
	deps: GameCoreDeps,
): void {
	const energyCost = speedPerTick * deps.config.stamina.movement_energy_cost;
	const needs = agent.get(NeedsComponent);
	const oldEnergy = needs.state.energy;
	const newEnergy = clamp(oldEnergy - energyCost, 0, 100);
	needs.state = { ...needs.state, energy: newEnergy };
	needs.markDirty();

	if (oldEnergy > 0 && newEnergy <= 0) {
		deps.eventBus.emit({
			type: 'AgentExhausted',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'MovementSystem',
			payload: { agentId: agent.agentId },
		});
	}

	if (newEnergy < NEED_CRITICAL_THRESHOLDS.energy) {
		agent.vel.x *= deps.config.stamina.exhaustion_speed_modifier;
		agent.vel.y *= deps.config.stamina.exhaustion_speed_modifier;
	}
}

function handleJourneyWaypointArrival(
	agent: AgentActor,
	journey: JourneyState,
	deps: GameCoreDeps,
): void {
	const ba = agent.behaviorAgent;
	const waypoint = journey.waypoints[journey.waypointIndex]!;
	const previousRegion = ba.currentRegion || 'unknown';

	// Deduct stamina for crossing
	const stamina = agent.get(StaminaComponent);
	const newStamina = Math.max(0, stamina.state.current - waypoint.travelCost);
	stamina.state = { ...stamina.state, current: newStamina };
	stamina.markDirty();

	deps.eventBus.emit({
		type: 'RegionEntered',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'MovementSystem',
		payload: {
			agentId: agent.agentId,
			fromRegion: previousRegion,
			toRegion: waypoint.regionId,
			travelCost: waypoint.travelCost,
			staminaRemaining: newStamina,
		},
	});

	// Exhaustion check — halt journey if stamina depleted
	if (newStamina <= 0) {
		ba.currentRegion = waypoint.regionId;
		ba.journey = null;
		ba.movementTarget = null;
		agent.vel.x = 0;
		agent.vel.y = 0;
		return;
	}

	const nextIndex = journey.waypointIndex + 1;
	if (nextIndex < journey.waypoints.length) {
		// More waypoints — continue journey
		ba.currentRegion = waypoint.regionId;
		ba.journey = { ...journey, waypointIndex: nextIndex };
		ba.movementTarget = { id: JOURNEY_SENTINEL, type: 'location' as const };
	} else {
		// Last waypoint — route to final destination
		ba.currentRegion = waypoint.regionId;
		ba.journey = null;
		ba.movementTarget = journey.finalTarget;
	}
}


export function createMovementSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	locationActors?: () => Map<string, Actor>,
): GameSystem {
	return {
		name: 'MovementSystem',
		priority: SystemPriority.MOVEMENT,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const spreadRadius = deps.config.formulas.arrival_spread_radius;

			for (const agent of agentList) {
				const ba = agent.behaviorAgent;
				const rawTarget = ba.movementTarget;

				// Already at target — consume movementTarget silently, no re-arrival
				if (isMovementTarget(rawTarget) && ba.atLocation === rawTarget.id) {
					ba.movementTarget = null;
					agent.vel.x = 0;
					agent.vel.y = 0;
					continue;
				}

				// Clear atLocation when agent starts moving to a new target
				if (isMovementTarget(rawTarget) && ba.atLocation !== null) {
					ba.atLocation = null;
					ba.arrivalSlot = null;
					ba.insideFacility = false;
				}

				if (!isMovementTarget(rawTarget)) {
					// No target — stop moving, recover stamina while idle
					agent.vel.x = 0;
					agent.vel.y = 0;
					const stamina = agent.get(StaminaComponent);
					if (stamina.state.current < stamina.state.max) {
						const recovered = Math.min(
							stamina.state.max,
							stamina.state.current + deps.config.stamina.recovery_per_idle_tick,
						);
						stamina.state = { ...stamina.state, current: recovered };
						stamina.markDirty();
					}
					continue;
				}

				// Check for journey waypoint navigation
				const journey = ba.journey;
				const isJourneyMove = journey !== null && rawTarget.id === JOURNEY_SENTINEL;

				let targetPos: { x: number; y: number } | undefined;

				if (isJourneyMove) {
					const wp = journey.waypoints[journey.waypointIndex];
					if (wp !== undefined) {
						targetPos = { x: wp.crossingPoint.x, y: wp.crossingPoint.y };
					}
				} else if (rawTarget.type === 'agent') {
					const targetAgent = agentList.find(a => a.agentId === rawTarget.id);
					if (targetAgent !== undefined) {
						targetPos = { x: targetAgent.pos.x, y: targetAgent.pos.y };
					}
				} else {
					const loc = locationList.find(l => l.id === rawTarget.id);
					if (loc !== undefined) {
						targetPos = { x: loc.position.x, y: loc.position.y };
					}
				}

				if (targetPos === undefined) {
					agent.vel.x = 0;
					agent.vel.y = 0;
					continue;
				}

				const attrs = agent.get(AttributesComponent);
				const speedPerTick = attrs.state.DX / deps.config.formulas.basic_speed_divisor;
				const speedPerSec = speedPerTick * (1000 / deps.config.tick_interval_ms);
				const dist = distance(agent.pos.x, agent.pos.y, targetPos.x, targetPos.y);
				const arrivalThreshold = speedPerTick * deps.config.formulas.arrival_threshold_multiplier;

				if (dist <= arrivalThreshold) {
					if (isJourneyMove) {
						// Arrived at journey waypoint — handle crossing
						agent.pos.x = targetPos.x;
						agent.pos.y = targetPos.y;
						agent.vel.x = 0;
						agent.vel.y = 0;
						handleJourneyWaypointArrival(agent, journey, deps);
					} else {
						// Count agents already at this location (for spread offset)
						const agentsAtLocation = agentList.filter(a => {
							return a.behaviorAgent.atLocation === rawTarget.id;
						});
						const slotIndex = agentsAtLocation.length;
						const totalAgents = slotIndex + 1;
						const offset = resolveArrivalOffset(slotIndex, totalAgents, spreadRadius);

						// Arrived — snap to target + offset, stop, emit event
						agent.pos.x = targetPos.x + offset.dx;
						agent.pos.y = targetPos.y + offset.dy;
						agent.vel.x = 0;
						agent.vel.y = 0;

						ba.movementTarget = null;
						ba.atLocation = rawTarget.id;
						ba.arrivalSlot = slotIndex;

						// Mark whether the agent entered a facility
						const locActor = locationActors?.().get(rawTarget.id);
						ba.insideFacility = locActor?.has(FacilityComponent) === true;

						// Track known locations for gossip
						if (!ba.knownLocations.includes(rawTarget.id)) {
							ba.knownLocations = [...ba.knownLocations, rawTarget.id];
						}

						deps.eventBus.emit({
							type: 'AgentArrived',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'MovementSystem',
							payload: {
								agentId: agent.agentId,
								targetId: rawTarget.id,
								targetType: rawTarget.type,
							},
						});
					}
				} else {
					// Move straight toward target
					const nx = (targetPos.x - agent.pos.x) / dist;
					const ny = (targetPos.y - agent.pos.y) / dist;
					agent.vel.x = nx * speedPerSec;
					agent.vel.y = ny * speedPerSec;

					drainMovementEnergy(agent, speedPerTick, deps);
				}
			}
		},
	};
}
