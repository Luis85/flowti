import type { ActionResult, PerceivedFacility } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { FacilityComponent } from '../components/facility-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { findNearest } from '../../domain/core/array-utils.js';

export function createWorkActions(ctx: ActionContext): Pick<ActionMethods, 'ClaimJob' | 'ClaimBestJob' | 'SeekJobFacility' | 'ReleaseJob' | 'SwitchJob' | 'Work' | 'SeekWork'> {
	const { memory, actor, deps, resolveNearbyFacilities } = ctx;
	const { config, getLocationActors, getLocations } = deps;

	return {
		ClaimJob(): ActionResult {
			const agentKind = actor.kind;
			const openFacilities = resolveNearbyFacilities().filter(f =>
				f.workerId === null && f.job !== '' && f.job === agentKind,
			);
			if (openFacilities.length === 0) return FAILED;
			const nearest = findNearest(openFacilities)!;
			actor.job = nearest.job;
			if (!deps.claimFacility!(nearest.id)) {
				actor.job = null;
				return FAILED;
			}
			beginAction(ctx, 'claim_job');
			return SUCCEEDED;
		},

		ClaimBestJob(): ActionResult {
			const jobsConfig = deps.jobsConfig ?? deps.config.jobs;
			const openFacilities = resolveNearbyFacilities().filter(f =>
				f.workerId === null && f.job !== '',
			);
			if (openFacilities.length === 0) return FAILED;

			let chosen: typeof openFacilities[0];
			if (memory.unemployedTicks >= jobsConfig.desperation_ticks) {
				// Desperate — take nearest regardless of fit
				chosen = findNearest(openFacilities)!;
			} else {
				// Score = wage × (attribute / baseline) — prefers high-wage facilities
				// when aptitude matches. Covers all facility kinds (production,
				// service, area_effect) since resolveNearbyFacilities returns all.
				const attrComp = actor.get(AttributesComponent);
				const baseline = jobsConfig.aptitude_baseline;
				const scoreFor = (f: typeof openFacilities[0]): number => {
					const jobDef = jobsConfig.definitions[f.job];
					if (jobDef === undefined) return 0;
					const apt = attrComp.getByName(jobDef.primary_attribute) || baseline;
					return f.wage * (apt / baseline);
				};
				chosen = openFacilities.reduce((best, f) => {
					const fScore = scoreFor(f);
					const bestScore = scoreFor(best);
					if (fScore > bestScore) return f;
					if (fScore === bestScore && f.distance < best.distance) return f;
					return best;
				});
			}

			actor.job = chosen.job;
			if (!deps.claimFacility!(chosen.id)) {
				actor.job = null;
				return FAILED;
			}
			memory.unemployedTicks = 0;
			beginAction(ctx, 'claim_job');
			deps.swapBehaviorTree?.(chosen.job);
			return SUCCEEDED;
		},

		SeekJobFacility(): ActionResult {
			if (actor.job !== null) return FAILED;
			if (memory.unemployedTicks < config.jobs.desperation_ticks) return FAILED;

			// Search ALL known locations for open production facilities
			const allLocations = getLocations();
			const locationActorMap = getLocationActors();
			const facilityTypeRegistry = deps.getFacilityTypeRegistry?.();

			const openFacilities = allLocations
				.filter(l => {
					const ft = facilityTypeRegistry?.get(l.facility_type);
					if (ft === undefined || ft.primary_job === '') return false;
					const locActor = locationActorMap.get(l.id);
					if (locActor?.has(FacilityComponent) !== true) return false;
					const fac = locActor.get(FacilityComponent);
					return fac.state.workerId === null && fac.state.status !== 'abandoned';
				})
				.map(l => ({
					id: l.id,
					dist: Math.hypot(l.position.x - actor.pos.x, l.position.y - actor.pos.y),
				}))
				.sort((a, b) => a.dist - b.dist);

			if (openFacilities.length === 0) return FAILED;

			beginAction(ctx, 'seek_job_facility');
			memory.movementTarget = { id: openFacilities[0]!.id, type: 'location' };
			return RUNNING;
		},

		ReleaseJob(): ActionResult {
			deps.releaseFacility!();
			actor.job = null;
			memory.unemployedTicks = 0;
			memory.btAction = null;
			deps.swapBehaviorTree?.(null);
			return SUCCEEDED;
		},

		SwitchJob(): ActionResult {
			const facilities = resolveNearbyFacilities();
			const { jobs: jobsConfig } = deps.config;
			const baseline = jobsConfig.aptitude_baseline;
			const switchAttrComp = actor.get(AttributesComponent);

			const currentWage = facilities.find(f => f.workerId === actor.agentId)?.wage ?? 0;
			const currentJobDef = actor.job !== null ? jobsConfig.definitions[actor.job] : undefined;
			const currentApt = currentJobDef !== undefined ? (switchAttrComp.getByName(currentJobDef.primary_attribute) || baseline) : baseline;
			const currentEffective = currentWage * (currentApt / baseline);

			let bestFacility: PerceivedFacility | null = null;
			let bestEffective = currentEffective;
			for (const f of facilities) {
				if (f.workerId !== null || f.job === '') continue;
				const jobDef = jobsConfig.definitions[f.job];
				const apt = jobDef !== undefined ? (switchAttrComp.getByName(jobDef.primary_attribute) || baseline) : baseline;
				const effective = f.wage * (apt / baseline);
				if (effective > bestEffective) { bestFacility = f; bestEffective = effective; }
			}

			if (bestFacility === null) return FAILED;
			// Don't switch to the same job at the same facility
			if (bestFacility.job === actor.job && bestFacility.wage <= currentWage) return FAILED;

			const oldJob = actor.job;
			const oldFacilityId = facilities.find(f => f.workerId === actor.agentId)?.id ?? null;
			deps.releaseFacility!();
			actor.job = bestFacility.job;
			if (!deps.claimFacility!(bestFacility.id)) {
				actor.job = oldJob;
				// Re-claim old facility to restore reservation
				if (oldFacilityId !== null) {
					deps.claimFacility!(oldFacilityId);
				}
				return FAILED;
			}
			beginAction(ctx, 'switch_job');
			deps.eventBus.emit({
				type: 'JobSwitched',
				tick: deps.tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, oldJob, newJob: bestFacility.job, oldWage: currentWage, newWage: bestFacility.wage },
			});
			deps.swapBehaviorTree?.(bestFacility.job);
			return SUCCEEDED;
		},

		Work(): ActionResult {
			if (memory.atLocation === null || actor.job === null) return FAILED;
			const facilities = resolveNearbyFacilities();
			const jobFacility = facilities.find(f =>
				f.id === memory.atLocation &&
				f.job === actor.job &&
				f.workerId === actor.agentId,
			);
			if (jobFacility === undefined) return FAILED;
			beginAction(ctx, 'work');
			return RUNNING;
		},

		SeekWork(): ActionResult {
			if (actor.job === null) return FAILED;

			// Only target facilities reserved by this agent
			const availableFacility = resolveNearbyFacilities().find(f =>
				f.job === actor.job && f.workerId === actor.agentId,
			);
			if (availableFacility !== undefined) {
				beginAction(ctx, 'seek_work');
				memory.movementTarget = { id: availableFacility.id, type: 'location' };
				if (memory.atLocation === availableFacility.id) return SUCCEEDED;
				return RUNNING;
			}

			// Fallback: search all locations (for facilities outside perception range)
			const allLocations = getLocations();
			const locationActorMap = getLocationActors();
			const facilityTypeRegistry = deps.getFacilityTypeRegistry?.();
			const jobLoc = allLocations.find(l => {
				const ft = facilityTypeRegistry?.get(l.facility_type);
				if (ft?.primary_job !== actor.job) return false;
				const locActor = locationActorMap.get(l.id);
				if (locActor?.has(FacilityComponent) !== true) return false;
				return locActor.get(FacilityComponent).state.workerId === actor.agentId;
			});
			if (jobLoc === undefined) return FAILED;

			// If already at the facility but it's occupied, don't re-target — fail gracefully
			if (memory.atLocation === jobLoc.id) return FAILED;

			beginAction(ctx, 'seek_work');
			memory.movementTarget = { id: jobLoc.id, type: 'location' };
			return RUNNING;
		},
	};
}
