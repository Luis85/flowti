import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { WalletComponent } from '../components/wallet-component.js';
import type { FacilityType } from '../../domain/schemas/facility-type-schema.js';

type ServiceFacility = Extract<FacilityType, { kind: 'service' }>;

/**
 * Score a service facility type against an agent's intent. Returns 0 when
 * the intent doesn't match any positive staffed effect on the facility.
 */
function scoreForIntent(ft: ServiceFacility, intent: string): number {
	if (intent === 'leisure') return ft.staffed_effects.mood;
	if (intent === 'rest') return ft.staffed_effects.energy;
	if (intent === 'social') return ft.staffed_effects.social;
	return 0;
}

/**
 * Resolve the service facility type registered for a nearby location, or
 * null if the registry is missing, the location isn't nearby, or the
 * registered facility type isn't of `kind: 'service'`.
 */
function resolveServiceFacilityType(ctx: ActionContext, targetId: string): ServiceFacility | null {
	const registry = ctx.deps.getFacilityTypeRegistry?.();
	if (registry === undefined) return null;
	const targetLoc = ctx.resolveNearbyLocations().find(l => l.id === targetId);
	if (targetLoc === undefined) return null;
	const ft = registry.get(targetLoc.facility_type);
	if (ft?.kind !== 'service') return null;
	return ft;
}

/**
 * Service facility interaction actions. Agents pick a nearby `service` kind
 * facility scored against their current intent (leisure / rest / social),
 * travel to it, and then enter a timed visit. The visit is stored on
 * `memory.currentServiceVisit` and ticked down by `ServiceSystem`, which also
 * applies the facility's staffed / unstaffed effects on completion.
 *
 * Cost is debited up-front in `UseService` so agents who can't pay never
 * enter the facility — the service system only applies effects and clears
 * the visit.
 */
export function createServiceActions(
	ctx: ActionContext,
): Pick<ActionMethods, 'ChooseServiceFacility' | 'SeekService' | 'UseService'> {
	const { memory, actor, deps, resolveNearbyLocations } = ctx;

	return {
		ChooseServiceFacility(intent: string): ActionResult {
			const registry = deps.getFacilityTypeRegistry?.();
			if (registry === undefined) return FAILED;

			type Candidate = { id: string; score: number };
			const candidates: Candidate[] = [];

			for (const loc of resolveNearbyLocations()) {
				if (loc.facility_type === '') continue;
				const ft = registry.get(loc.facility_type);
				if (ft?.kind !== 'service') continue;
				const score = scoreForIntent(ft, intent);
				if (score <= 0) continue;
				candidates.push({ id: loc.id, score });
			}

			if (candidates.length === 0) return FAILED;
			candidates.sort((a, b) => b.score - a.score);
			memory.serviceTarget = candidates[0]!.id;
			return SUCCEEDED;
		},

		SeekService(): ActionResult {
			if (memory.serviceTarget === null) return FAILED;
			beginAction(ctx, 'seek_service');
			memory.movementTarget = { id: memory.serviceTarget, type: 'location' };
			if (memory.atLocation === memory.serviceTarget) return SUCCEEDED;
			return RUNNING;
		},

		UseService(): ActionResult {
			const targetId = memory.serviceTarget;
			if (targetId === null) return FAILED;
			if (memory.currentServiceVisit !== null) return FAILED;

			const ft = resolveServiceFacilityType(ctx, targetId);
			if (ft === null) return FAILED;

			const wallet = actor.get(WalletComponent);
			if (wallet.state.gold < ft.cost_per_visit) return FAILED;

			// Debit cost upfront — completed visits are non-refundable
			if (ft.cost_per_visit > 0) {
				wallet.state = { ...wallet.state, gold: wallet.state.gold - ft.cost_per_visit };
				wallet.markDirty();
			}

			memory.currentServiceVisit = {
				facilityId: targetId,
				ticksRemaining: ft.ticks_per_visit,
				costPaid: true,
			};
			memory.insideFacility = true;

			// beginAction first (sets btAction, clears stale commitments), then
			// override commitment ticks with the facility-type-specific duration.
			beginAction(ctx, 'use_service');
			if (memory.commitmentTicks <= 0) {
				memory.commitmentTicks = ft.ticks_per_visit;
				memory.committedAction = 'use_service';
			}
			return RUNNING;
		},
	};
}
