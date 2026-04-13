import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { WalletComponent } from '../components/wallet-component.js';
import { FacilityComponent } from '../components/facility-component.js';
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
): Pick<ActionMethods, 'ChooseServiceFacility' | 'SeekService' | 'UseService' | 'SeekKnownRestLocation'> {
	const { memory, actor, deps, resolveNearbyLocations } = ctx;

	return {
		ChooseServiceFacility(intent: string): ActionResult {
			const registry = deps.getFacilityTypeRegistry?.();
			if (registry === undefined) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'ChooseServiceFacility', payload: { agentId: actor.agentId, reason: 'registry undefined', intent } });
				return FAILED;
			}

			// Sticky target: if we already picked a valid service facility for
			// this intent, keep it. Prevents ping-ponging between equal-score
			// facilities (all rest_inns have identical energy effects).
			if (memory.serviceTarget !== null) {
				const existing = resolveNearbyLocations().find(l => l.id === memory.serviceTarget);
				if (existing !== undefined) {
					const eft = registry.get(existing.facility_type);
					if (eft?.kind === 'service' && scoreForIntent(eft, intent) > 0) {
						return SUCCEEDED;
					}
				}
				// Previous target no longer valid — re-pick
				memory.serviceTarget = null;
			}

			type Candidate = { id: string; score: number };
			const candidates: Candidate[] = [];

			const nearbyLocs = resolveNearbyLocations();
			for (const loc of nearbyLocs) {
				if (loc.facility_type === '') continue;
				const ft = registry.get(loc.facility_type);
				if (ft?.kind !== 'service') continue;
				const score = scoreForIntent(ft, intent);
				if (score <= 0) continue;
				candidates.push({ id: loc.id, score });
			}

			if (candidates.length === 0) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'ChooseServiceFacility', payload: { agentId: actor.agentId, reason: 'no candidates', intent, nearbyCount: nearbyLocs.length, nearbyTypes: nearbyLocs.map(l => l.facility_type), registrySize: registry.size, registryKeys: [...registry.keys()] } });
				return FAILED;
			}
			candidates.sort((a, b) => b.score - a.score);
			memory.serviceTarget = candidates[0]!.id;
			return SUCCEEDED;
		},

		SeekService(): ActionResult {
			if (memory.serviceTarget === null) return FAILED;

			// If not at target yet, travel
			if (memory.atLocation !== memory.serviceTarget) {
				beginAction(ctx, 'seek_service');
				memory.movementTarget = { id: memory.serviceTarget, type: 'location' };
				return RUNNING;
			}

			// At target — immediately start the service visit (merged with
			// UseService to work around mistreevous reset() preventing sequence
			// advancement from SeekService SUCCEEDED to UseService in the same step).
			const targetId = memory.serviceTarget;
			if (memory.currentServiceVisit !== null) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'SeekService', payload: { agentId: actor.agentId, reason: 'visit already active', facilityId: memory.currentServiceVisit.facilityId } });
				return FAILED;
			}

			const ft = resolveServiceFacilityType(ctx, targetId);
			if (ft === null) {
				const nearbyIds = resolveNearbyLocations().map(l => l.id);
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'SeekService', payload: { agentId: actor.agentId, reason: 'facility type not resolved at arrival', targetId, nearbyCount: nearbyIds.length, nearbyIds: nearbyIds.slice(0, 5) } });
				memory.serviceTarget = null;
				return FAILED;
			}

			const wallet = actor.get(WalletComponent);
			if (wallet.state.gold < ft.cost_per_visit) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'SeekService', payload: { agentId: actor.agentId, reason: 'insufficient gold at arrival', gold: wallet.state.gold, cost: ft.cost_per_visit } });
				memory.serviceTarget = null;
				return FAILED;
			}

			// Debit cost upfront
			if (ft.cost_per_visit > 0) {
				wallet.state = { ...wallet.state, gold: wallet.state.gold - ft.cost_per_visit };
				wallet.markDirty();

				const locationActorMap = ctx.deps.getLocationActors();
				const locActor = locationActorMap.get(targetId);
				if (locActor?.has(FacilityComponent) === true) {
					const facility = locActor.get(FacilityComponent);
					facility.state = { ...facility.state, fund: facility.state.fund + ft.cost_per_visit };
					facility.markDirty();
				}

				ctx.deps.eventBus.emit({
					type: 'GoldFlowed',
					tick: ctx.deps.tickCount(),
					wallClock: Date.now(),
					source: 'UseService',
					payload: {
						category: 'transfer' as const,
						subcategory: 'service_fee',
						amount: ft.cost_per_visit,
						fromEntity: actor.agentId,
						toEntity: targetId,
					},
				});
			}

			memory.currentServiceVisit = {
				facilityId: targetId,
				ticksRemaining: ft.ticks_per_visit,
				costPaid: true,
			};
			memory.insideFacility = true;

			beginAction(ctx, 'use_service');
			memory.commitmentTicks = ft.ticks_per_visit;
			memory.committedAction = 'use_service';

			deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'SeekService', payload: { agentId: actor.agentId, result: 'VISIT_STARTED', target: targetId, ticks: ft.ticks_per_visit } });
			return RUNNING;
		},

		UseService(): ActionResult {
			const targetId = memory.serviceTarget;
			if (targetId === null) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'UseService', payload: { agentId: actor.agentId, reason: 'serviceTarget is null' } });
				return FAILED;
			}
			if (memory.currentServiceVisit !== null) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'UseService', payload: { agentId: actor.agentId, reason: 'currentServiceVisit already set', facilityId: memory.currentServiceVisit.facilityId } });
				return FAILED;
			}

			const ft = resolveServiceFacilityType(ctx, targetId);
			if (ft === null) {
				const nearbyIds = resolveNearbyLocations().map(l => l.id);
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'UseService', payload: { agentId: actor.agentId, reason: 'resolveServiceFacilityType returned null', targetId, atLocation: memory.atLocation, nearbyLocationCount: nearbyIds.length, nearbyIds: nearbyIds.slice(0, 5) } });
				return FAILED;
			}

			const wallet = actor.get(WalletComponent);
			if (wallet.state.gold < ft.cost_per_visit) {
				deps.eventBus.emit({ type: 'DebugNote', tick: deps.tickCount(), wallClock: Date.now(), source: 'UseService', payload: { agentId: actor.agentId, reason: 'insufficient gold', gold: wallet.state.gold, cost: ft.cost_per_visit } });
				return FAILED;
			}

			// Debit cost upfront — completed visits are non-refundable
			if (ft.cost_per_visit > 0) {
				wallet.state = { ...wallet.state, gold: wallet.state.gold - ft.cost_per_visit };
				wallet.markDirty();

				// Credit the facility fund — service revenue
				const locationActorMap = ctx.deps.getLocationActors();
				const locActor = locationActorMap.get(targetId);
				if (locActor?.has(FacilityComponent) === true) {
					const facility = locActor.get(FacilityComponent);
					facility.state = { ...facility.state, fund: facility.state.fund + ft.cost_per_visit };
					facility.markDirty();
				}

				// Emit GoldFlowed for monetary policy velocity tracking
				ctx.deps.eventBus.emit({
					type: 'GoldFlowed',
					tick: ctx.deps.tickCount(),
					wallClock: Date.now(),
					source: 'UseService',
					payload: {
						category: 'transfer' as const,
						subcategory: 'service_fee',
						amount: ft.cost_per_visit,
						fromEntity: actor.agentId,
						toEntity: targetId,
					},
				});
			}

			memory.currentServiceVisit = {
				facilityId: targetId,
				ticksRemaining: ft.ticks_per_visit,
				costPaid: true,
			};
			memory.insideFacility = true;

			// beginAction first (sets btAction, clears stale commitments), then
			// unconditionally set commitment — UseService always owns the
			// commitment once it fires (double-enter is already guarded above).
			beginAction(ctx, 'use_service');
			memory.commitmentTicks = ft.ticks_per_visit;
			memory.committedAction = 'use_service';
			return RUNNING;
		},

		SeekKnownRestLocation(): ActionResult {
			const registry = deps.getFacilityTypeRegistry?.();
			if (registry === undefined) return FAILED;
			const locations = deps.getLocations();

			// Find known service locations with energy effects
			type RestCandidate = { id: string; x: number; y: number; distance: number };
			const candidates: RestCandidate[] = [];
			for (const locId of memory.knownLocations) {
				const loc = locations.find(l => l.id === locId);
				if (loc === undefined) continue;
				const ft = registry.get(loc.facility_type);
				if (ft?.kind !== 'service' || ft.staffed_effects.energy <= 0) continue;
				const dx = actor.pos.x - loc.position.x;
				const dy = actor.pos.y - loc.position.y;
				candidates.push({ id: loc.id, x: loc.position.x, y: loc.position.y, distance: Math.sqrt(dx * dx + dy * dy) });
			}
			if (candidates.length === 0) return FAILED;
			candidates.sort((a, b) => a.distance - b.distance);

			const target = candidates[0]!;
			if (memory.atLocation === target.id) return SUCCEEDED;

			memory.movementTarget = { id: target.id, type: 'location' };
			memory.serviceTarget = target.id;
			beginAction(ctx, 'seek_service');
			return RUNNING;
		},
	};
}
