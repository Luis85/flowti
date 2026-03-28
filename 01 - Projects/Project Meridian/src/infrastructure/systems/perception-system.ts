import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { resolvePerception } from '../../domain/systems/perception.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { PerceptionComponent } from '../components/perception-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { TimeComponent } from '../components/time-component.js';

export function createPerceptionSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'PerceptionSystem',
		priority: SystemPriority.PERCEPTION,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const world = worldEntity();
			const timeComp = world.get(TimeComponent);
			const timePhase = timeComp.state.phase;

			const agentInputs = agentList.map(a => ({
				id: a.agentId,
				pos: { x: a.pos.x, y: a.pos.y },
			}));

			const locationInputs = locationList.map(l => ({
				id: l.id,
				type: l.type,
				pos: { x: l.position.x, y: l.position.y },
			}));

			for (const agent of agentList) {
				const attrs = agent.get(AttributesComponent);
				const perception = agent.get(PerceptionComponent);

				const otherAgents = agentInputs.filter(a => a.id !== agent.agentId);

				const result = resolvePerception(
					{
						agentPos: { x: agent.pos.x, y: agent.pos.y },
						agentIQ: attrs.state.IQ,
						agents: otherAgents,
						locations: locationInputs,
						timePhase,
					},
					deps.config.perception,
				);

				perception.state = result;
				perception.markDirty();
			}
		},
	};
}
