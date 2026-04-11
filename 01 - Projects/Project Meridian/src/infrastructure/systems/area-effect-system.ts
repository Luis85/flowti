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
 * Pending area modifier queued by AreaEffectSystem for later consumption by
 * MoodSystem. Task 6.1 will migrate this queue onto `BehaviorAgent` /
 * `MemoryComponent`; during the Task 1.8 stub phase it lives in the closure.
 */
export interface PendingAreaModifier {
	kind: 'mood';
	delta_per_tick: number;
}

export interface AreaEffectSystemHandle {
	readonly system: GameSystem;
	/** Read the queued area modifiers for an agent (stub helper). */
	getPending(agentId: string): PendingAreaModifier[];
	/** Clear queued area modifiers for an agent (stub helper). */
	clearPending(agentId: string): void;
	/** Seed `lastPulseTick` for a facility id (stub helper). */
	setLastPulseTick(locationId: string, tick: number): void;
	/** Read `lastPulseTick` for a facility id (stub helper). */
	getLastPulseTick(locationId: string): number | undefined;
}

/**
 * Create an AreaEffectSystem instance. NOT registered with the tick scheduler
 * in Task 1.8 — Chunk 6 / Task 6.1 wires it in before MoodSystem.
 *
 * Stub-state notes:
 * - `lastPulseTick` lives in a closure `Map<locationId, number>` because
 *   `FacilityComponent.state` does not yet carry a `lastPulseTick` field.
 *   Task 6.1 Step 4 will initialize it on `FacilityComponent.state` inside
 *   `populateScene`, at which point this map collapses.
 * - `pendingAreaModifiers` live in a closure `Map<agentId, PendingAreaModifier[]>`
 *   because neither `BehaviorAgent` nor `MemoryComponent` exposes the queue yet.
 *   Task 6.1 will migrate it onto working memory and hook MoodSystem to drain it.
 * - `getFacilityTypeRegistry` / `getLocationFacilityType` are passed as factory
 *   parameters (not read from `deps`) because Task 1.9 adds the registry to
 *   `GameCoreDeps` and Task 2.1 adds `facility_type` to `LocationSchema`. Once
 *   those land, both resolvers collapse into direct lookups.
 */
export function createAreaEffectSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	getFacilityTypeRegistry: () => Map<string, FacilityType>,
	getLocationFacilityType: (loc: WorldLocation) => string | undefined,
	worldEntity: () => Actor,
): AreaEffectSystemHandle {
	const lastPulseTickMap = new Map<string, number>();
	const pendingModifiers = new Map<string, PendingAreaModifier[]>();

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

	function pushModifier(agentId: string, modifier: PendingAreaModifier): void {
		const existing = pendingModifiers.get(agentId);
		if (existing === undefined) {
			pendingModifiers.set(agentId, [{ ...modifier }]);
			return;
		}
		existing.push({ ...modifier });
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
				pushModifier(agent.agentId, facilityType.modifier);
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
		const stored = lastPulseTickMap.get(loc.id);
		if (stored === undefined) {
			lastPulseTickMap.set(loc.id, deps.tickCount);
			return;
		}

		if ((deps.tickCount - stored) < facilityType.ticks_per_pulse) return;

		payWage(worker, facility, facilityType, loc, economy, deps);
		applyPulseToAgents(loc, facilityType, agentList);
		lastPulseTickMap.set(loc.id, deps.tickCount);

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

	const system: GameSystem = {
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

	return {
		system,
		getPending(agentId): PendingAreaModifier[] {
			const list = pendingModifiers.get(agentId);
			return list === undefined ? [] : list.map(m => ({ ...m }));
		},
		clearPending(agentId): void {
			pendingModifiers.delete(agentId);
		},
		setLastPulseTick(locationId, tick): void {
			lastPulseTickMap.set(locationId, tick);
		},
		getLastPulseTick(locationId): number | undefined {
			return lastPulseTickMap.get(locationId);
		},
	};
}
