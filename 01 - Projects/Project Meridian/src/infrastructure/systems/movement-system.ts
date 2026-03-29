import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { NeedsComponent } from '../components/needs-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
import { clamp, distance } from '../../domain/core/math-utils.js';

/** Snap-to-target when within this fraction of per-tick speed */
const ARRIVAL_THRESHOLD_MULTIPLIER = 1.5;

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

export function createMovementSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'MovementSystem',
		priority: SystemPriority.MOVEMENT,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();

			for (const agent of agentList) {
				const bb = agent.get(BlackboardComponent);
				const rawTarget = bb.state.movementTarget;

				if (!isMovementTarget(rawTarget)) {
					// No target — stop moving
					agent.vel.x = 0;
					agent.vel.y = 0;
					continue;
				}

				let targetPos: { x: number; y: number } | undefined;

				if (rawTarget.type === 'agent') {
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
				const arrivalThreshold = speedPerTick * ARRIVAL_THRESHOLD_MULTIPLIER;

				if (dist <= arrivalThreshold) {
					// Arrived — snap to target, stop, emit event
					agent.pos.x = targetPos.x;
					agent.pos.y = targetPos.y;
					agent.vel.x = 0;
					agent.vel.y = 0;

					bb.state.movementTarget = undefined;
					bb.markDirty();

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
				} else {
					// Set velocity toward target — ExcaliburJS interpolates between ticks
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
