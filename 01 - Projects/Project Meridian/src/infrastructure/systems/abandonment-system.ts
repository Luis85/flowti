import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createAbandonmentSystem(
	getLocationActors: () => Map<string, Actor>,
	getLocations: () => WorldLocation[],
	getAgents?: () => AgentActor[],
): GameSystem {
	return {
		name: 'AbandonmentSystem',
		priority: SystemPriority.ABANDONMENT,

		execute(deps: GameCoreDeps): void {
			const locationActors = getLocationActors();
			const locations = getLocations();

			for (const loc of locations) {
				const locActor = locationActors.get(loc.id);
				if (locActor?.has(FacilityComponent) !== true) continue;
				const facility = locActor.get(FacilityComponent);

				if (facility.state.status !== 'abandoned' && facility.state.fund <= 0) {
					// Evict worker before abandoning — they need to find new work
					const evictedWorker = facility.state.workerId;
					if (evictedWorker !== null && getAgents !== undefined) {
						const worker = getAgents().find(a => a.agentId === evictedWorker);
						if (worker !== undefined) {
							worker.job = null;
							facility.state = { ...facility.state, workerId: null };
						}
					}
					facility.state = { ...facility.state, status: 'abandoned' };
					facility.markDirty();
					deps.eventBus.emit({
						type: 'FacilityAbandoned',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'AbandonmentSystem',
						payload: { facilityId: loc.id, lastWorker: evictedWorker },
					});
				} else if (facility.state.status === 'abandoned' && facility.state.fund > 0) {
					facility.state = { ...facility.state, status: 'idle' };
					facility.markDirty();
					deps.eventBus.emit({
						type: 'FacilityRestored',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'AbandonmentSystem',
						payload: { facilityId: loc.id, newFund: facility.state.fund },
					});
				}
			}
		},
	};
}
