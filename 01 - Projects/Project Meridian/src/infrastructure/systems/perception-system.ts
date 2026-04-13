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

			// Pre-compute facility occupancy lookup
			const insideFacilitySet = new Set<string>();
			const agentLocationMap = new Map<string, string>();
			for (const a of agentList) {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- behaviorAgent uses !: but may be unset before init
				if (a.behaviorAgent?.insideFacility === true) {
					insideFacilitySet.add(a.agentId);
					if (a.behaviorAgent.atLocation !== null) {
						agentLocationMap.set(a.agentId, a.behaviorAgent.atLocation);
					}
				}
			}

			const locationInputs = locationList.map(l => ({
				id: l.id,
				facility_type: l.facility_type,
				pos: { x: l.position.x, y: l.position.y },
			}));

			for (const agent of agentList) {
				const attrs = agent.get(AttributesComponent);
				const perception = agent.get(PerceptionComponent);
				const selfInside = insideFacilitySet.has(agent.agentId);
				const selfLocation = agentLocationMap.get(agent.agentId) ?? null;

				let otherAgents: { id: string; pos: { x: number; y: number } }[];

				if (selfInside) {
					// Agent inside facility — only see agents at the same location
					otherAgents = agentInputs.filter(a => {
						if (a.id === agent.agentId) return false;
						return agentLocationMap.get(a.id) === selfLocation;
					});
				} else {
					// Agent outside — exclude agents inside facilities
					otherAgents = agentInputs.filter(a => {
						if (a.id === agent.agentId) return false;
						return !insideFacilitySet.has(a.id);
					});
				}

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

				// Update location memories from perception
				const locMemConfig = deps.config.location_memory;
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- behaviorAgent may be unset before init
				if (agent.behaviorAgent !== undefined) {
					const ba = agent.behaviorAgent;
					for (const nearLoc of result.nearbyLocations) {
						if (nearLoc.facility_type === '') continue;
						const existing = ba.locationMemories.find(m => m.locationId === nearLoc.id);
						if (existing !== undefined) {
							existing.lastRefreshedTick = deps.tickCount;
							// Upgrade gossip entries to perceived — first-hand visual confirmation
							if (existing.source === 'gossip') {
								existing.source = 'perceived';
								existing.significance = locMemConfig.perceived.significance;
								existing.originalSignificance = locMemConfig.perceived.significance;
								existing.reliability = 1.0;
							}
						} else {
							const locData = locationList.find(l => l.id === nearLoc.id);
							ba.locationMemories = [...ba.locationMemories, {
								locationId: nearLoc.id,
								facilityType: nearLoc.facility_type,
								position: locData !== undefined
									? { x: locData.position.x, y: locData.position.y }
									: { x: 0, y: 0 },
								significance: locMemConfig.perceived.significance,
								originalSignificance: locMemConfig.perceived.significance,
								source: 'perceived' as const,
								reliability: 1.0,
								discoveredTick: deps.tickCount,
								lastRefreshedTick: deps.tickCount,
							}];
						}
					}
				}
			}
		},
	};
}
