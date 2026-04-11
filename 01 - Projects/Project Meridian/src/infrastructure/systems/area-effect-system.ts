import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { FacilityType } from '../../domain/schemas/facility-type-schema.js';
import type { Actor } from 'excalibur';
import { findWorker } from '../../domain/systems/facility-worker.js';
import { FacilityComponent } from '../components/facility-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import type { LedgerEntry } from '../../domain/core/component-data.js';

/**
 * Create an AreaEffectSystem instance. Registered in the tick pipeline by
 * `game-view.ts` BEFORE `MoodSystem` (although actual execution order is
 * determined by `SystemPriority` — MOOD=2 runs earlier than LEISURE=6.75, so
 * modifiers pushed in tick N are drained by MoodSystem in tick N+1: a
 * deliberate 1-tick latency acceptable for area effects).
 *
 * State lives on components / working memory (no closure):
 * - `lastPulseTick` on `FacilityComponent.state` (seeded at spawn in
 *   `populateScene` for area_effect facilities).
 * - `pendingAreaModifiers` on `agent.behaviorAgent` (drained by `MoodSystem`).
 */
export function createAreaEffectSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	getFacilityTypeRegistry: () => Map<string, FacilityType>,
	getLocationFacilityType: (loc: WorldLocation) => string | undefined,
	worldEntity: () => Actor,
): GameSystem {
	function payWage(
		worker: AgentActor,
		facility: FacilityComponent,
		facilityType: Extract<FacilityType, { kind: 'area_effect' }>,
		loc: WorldLocation,
		economy: EconomyComponent,
		deps: GameCoreDeps,
	): void {
		const wage = facilityType.default_wage;
		if (wage <= 0) return;

		let wageFrom: string;
		if (facilityType.funding === 'facility') {
			if (facility.state.fund < wage) return;
			facility.state = { ...facility.state, fund: facility.state.fund - wage };
			facility.markDirty();
			wageFrom = loc.id;
		} else {
			economy.state = { ...economy.state, treasury: economy.state.treasury - wage };
			economy.markDirty();
			wageFrom = 'treasury';
		}

		const taxRate = deps.config.economy.tax_base_rate;
		const tax = wage * taxRate;
		const netWage = wage - tax;

		const workerWallet = worker.get(WalletComponent);
		workerWallet.state = { ...workerWallet.state, gold: workerWallet.state.gold + netWage };
		workerWallet.markDirty();

		const wageEntry: LedgerEntry = {
			tick: deps.tickCount,
			type: 'wage' as const,
			from: wageFrom,
			to: worker.agentId,
			itemId: null,
			quantity: 0,
			gold: netWage,
		};
		const taxEntry: LedgerEntry = {
			tick: deps.tickCount,
			type: 'tax' as const,
			from: wageFrom,
			to: 'treasury',
			itemId: null,
			quantity: 0,
			gold: tax,
		};
		economy.state = {
			...economy.state,
			treasury: economy.state.treasury + tax,
			ledger: [...economy.state.ledger, wageEntry, taxEntry],
			dailySummary: {
				...economy.state.dailySummary,
				totalWages: economy.state.dailySummary.totalWages + netWage,
				totalTax: economy.state.dailySummary.totalTax + tax,
			},
		};
		economy.markDirty();

		deps.eventBus.emit({
			type: 'GoldFlowed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'AreaEffectSystem',
			payload: {
				category: 'transfer' as const,
				subcategory: facilityType.funding === 'treasury' ? 'public_wage' : 'wage',
				amount: netWage,
				fromEntity: wageFrom,
				toEntity: worker.agentId,
			},
		});

		if (tax > 0) {
			deps.eventBus.emit({
				type: 'GoldFlowed',
				tick: deps.tickCount,
				wallClock: Date.now(),
				source: 'AreaEffectSystem',
				payload: {
					category: 'transfer' as const,
					subcategory: 'tax',
					amount: tax,
					fromEntity: wageFrom,
					toEntity: 'treasury',
				},
			});
		}
	}

	function applyPulseToAgents(
		loc: WorldLocation,
		facilityType: Extract<FacilityType, { kind: 'area_effect' }>,
		agentList: AgentActor[],
	): void {
		const radiusSquared = facilityType.radius * facilityType.radius;
		for (const agent of agentList) {
			const dx = agent.pos.x - loc.position.x;
			const dy = agent.pos.y - loc.position.y;
			if ((dx * dx + dy * dy) <= radiusSquared) {
				agent.behaviorAgent.pendingAreaModifiers.push({ ...facilityType.modifier });
			}
		}
	}

	function resolveAreaFacility(
		loc: WorldLocation,
		registry: Map<string, FacilityType>,
		locationActorMap: Map<string, Actor>,
	): { facilityType: Extract<FacilityType, { kind: 'area_effect' }>; facility: FacilityComponent } | null {
		const facilityTypeId = getLocationFacilityType(loc);
		if (facilityTypeId === undefined || facilityTypeId === '') return null;
		const facilityType = registry.get(facilityTypeId);
		if (facilityType === undefined) return null;
		if (facilityType.kind !== 'area_effect') return null;
		const locActor = locationActorMap.get(loc.id);
		if (locActor === undefined) return null;
		if (!locActor.has(FacilityComponent)) return null;
		const facility = locActor.get(FacilityComponent);
		if (facility.state.status === 'abandoned') return null;
		return { facilityType, facility };
	}

	function processAreaLocation(
		loc: WorldLocation,
		facilityType: Extract<FacilityType, { kind: 'area_effect' }>,
		facility: FacilityComponent,
		agentList: AgentActor[],
		economy: EconomyComponent,
		deps: GameCoreDeps,
	): void {
		const radius = deps.config.perception.interaction_radius;
		const worker = findWorker<AgentActor>(
			agentList,
			facility.state.workerId,
			facilityType.primary_job,
			loc.position.x,
			loc.position.y,
			radius,
		);

		// Unstaffed → no pulse, no wage, and (per spec) pulse clock does NOT advance.
		if (worker === undefined) return;

		// Initialise lastPulseTick on first encounter without pulsing this tick.
		// First pulse happens on or after tick = initTick + ticks_per_pulse.
		const stored = facility.state.lastPulseTick;
		if (stored === undefined) {
			facility.state = { ...facility.state, lastPulseTick: deps.tickCount };
			facility.markDirty();
			return;
		}

		if ((deps.tickCount - stored) < facilityType.ticks_per_pulse) return;

		payWage(worker, facility, facilityType, loc, economy, deps);
		applyPulseToAgents(loc, facilityType, agentList);
		facility.state = { ...facility.state, lastPulseTick: deps.tickCount };
		facility.markDirty();

		deps.eventBus.emit({
			type: 'AreaEffectPulsed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'AreaEffectSystem',
			payload: {
				facilityId: loc.id,
				facilityType: facilityType.id,
				workerId: worker.agentId,
				radius: facilityType.radius,
				modifier: { ...facilityType.modifier },
			},
		});
	}

	return {
		name: 'AreaEffectSystem',
		priority: SystemPriority.LEISURE,

		execute(deps: GameCoreDeps): void {
			const locationList = locations();
			const agentList = agents();
			const registry = getFacilityTypeRegistry();
			const locationActorMap = getLocationActors();
			const economy = worldEntity().get(EconomyComponent);

			for (const loc of locationList) {
				const resolved = resolveAreaFacility(loc, registry, locationActorMap);
				if (resolved === null) continue;
				processAreaLocation(loc, resolved.facilityType, resolved.facility, agentList, economy, deps);
			}
		},
	};
}
