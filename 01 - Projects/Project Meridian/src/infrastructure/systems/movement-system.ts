import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { computeMovement } from '../../domain/systems/movement.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { AttributesComponent } from '../components/attributes-component.js';

interface MovementTarget {
	id: string;
	type: 'agent' | 'location';
}

function isMovementTarget(value: unknown): value is MovementTarget {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === 'string' && (v.type === 'agent' || v.type === 'location');
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

				if (!isMovementTarget(rawTarget)) continue;

				const attrs = agent.get(AttributesComponent);
				const speed = attrs.state.DX / deps.config.formulas.basic_speed_divisor;

				let targetPos: { x: number; y: number } | undefined;

				if (rawTarget.type === 'agent') {
					const targetAgent = agentList.find(a => a.agentId === rawTarget.id);
					if (targetAgent !== undefined) {
						targetPos = { x: targetAgent.pos.x, y: targetAgent.pos.y };
					}
				} else {
					const targetLocation = locationList.find(l => l.id === rawTarget.id);
					if (targetLocation !== undefined) {
						targetPos = { x: targetLocation.position.x, y: targetLocation.position.y };
					}
				}

				if (targetPos === undefined) continue;

				const result = computeMovement({
					currentPos: { x: agent.pos.x, y: agent.pos.y },
					targetPos,
					speed,
					deltaTicks: 1,
				});

				agent.pos.x = result.newPos.x;
				agent.pos.y = result.newPos.y;

				if (result.arrived) {
					delete bb.state.movementTarget;
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
				}
			}
		},
	};
}
