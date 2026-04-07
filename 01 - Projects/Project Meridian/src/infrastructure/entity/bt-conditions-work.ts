import type { ConditionContext } from './bt-action-helpers.js';
import type { ConditionMethods } from './bt-conditions.js';
import { AttributesComponent } from '../components/attributes-component.js';

type WorkKeys = 'HasJob' | 'HasNoJob' | 'AtJobFacility' | 'OpenFacilityNearby' | 'OpenProductionFacilityNearby' | 'BetterPayAvailable' | 'IsCommitted';

export function createWorkConditions(ctx: ConditionContext): Pick<ConditionMethods, WorkKeys> {
	const { actor, deps, memory, resolveNearbyFacilities } = ctx;

	return {
		HasJob(): boolean {
			return actor.job !== null;
		},

		HasNoJob(): boolean {
			return actor.job === null;
		},

		AtJobFacility(): boolean {
			if (memory.atLocation === null || actor.job === null) return false;
			const facilities = resolveNearbyFacilities();
			return facilities.some(f =>
				f.id === memory.atLocation &&
				f.job === actor.job &&
				f.status !== 'abandoned' &&
				f.workerId === actor.agentId,
			);
		},

		OpenFacilityNearby(): boolean {
			return resolveNearbyFacilities().some(f => f.workerId === null);
		},

		OpenProductionFacilityNearby(): boolean {
			return resolveNearbyFacilities().some(f => f.workerId === null && f.job !== '' && f.status !== 'abandoned');
		},

		BetterPayAvailable(): boolean {
			if (actor.job === null) return false;
			const facilities = resolveNearbyFacilities();
			const { jobs: jobsConfig } = deps.config;
			const baseline = jobsConfig.aptitude_baseline;
			const attrComp = actor.get(AttributesComponent);

			// Current job effective wage — check facility worker, or all nearby facilities matching our job
			const currentFacility = facilities.find(f => f.workerId === actor.agentId)
				?? facilities.find(f => f.job === actor.job);
			const currentWage = currentFacility?.wage ?? 0;
			const currentJobDef = jobsConfig.definitions[actor.job];
			const currentApt = currentJobDef !== undefined ? (attrComp.getByName(currentJobDef.primary_attribute) || baseline) : baseline;
			const currentEffective = currentWage * (currentApt / baseline);

			// Best available open position
			for (const f of facilities) {
				if (f.workerId !== null || f.job === '') continue;
				const jobDef = jobsConfig.definitions[f.job];
				const apt = jobDef !== undefined ? (attrComp.getByName(jobDef.primary_attribute) || baseline) : baseline;
				if (f.wage * (apt / baseline) > currentEffective) return true;
			}
			return false;
		},

		IsCommitted(): boolean {
			return memory.commitmentTicks > 0;
		},
	};
}
