import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { FacilityType } from '../../domain/schemas/facility-type-schema.js';
import type { Actor } from 'excalibur';
import { findWorker } from '../../domain/systems/facility-worker.js';
import { resolveEffectiveTaxRate } from '../../domain/systems/monetary-policy.js';
import { FacilityComponent } from '../components/facility-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import type { LedgerEntry } from '../../domain/core/component-data.js';
import type { SkillEntry } from '../../domain/systems/behavior-agent.js';

/**
 * In-system visit tracking used during the Task 1.7 stub phase. Task 4.4 will
 * relocate this state into `MemoryComponent.currentServiceVisit` so that it
 * persists across saves alongside the rest of the agent's working memory.
 */
export interface ServiceVisit {
	facilityId: string;
	ticksRemaining: number;
	costPaid: boolean;
}

export interface ServiceSystemHandle {
	readonly system: GameSystem;
	/** Seed an active visit. Stub-only helper — replaced by `UseService` BT action in Task 4.4. */
	startVisit(agentId: string, visit: ServiceVisit): void;
	/** Read an active visit (for assertions). */
	getVisit(agentId: string): ServiceVisit | undefined;
	/** Clear an active visit (test utility). */
	clearVisit(agentId: string): void;
}

/**
 * Create a ServiceSystem instance. NOT registered with the tick scheduler in
 * Task 1.7 — Chunk 4 / Task 4.3 wires it in.
 *
 * Registry is passed as a factory parameter (not read from `deps`) because
 * `GameCoreDeps.getFacilityTypeRegistry` is added in Task 1.9. Same story for
 * `getLocationFacilityType`: Task 2.1 will add `facility_type` to
 * `LocationSchema`, at which point this resolver collapses into
 * `loc.facility_type`.
 */
export function createServiceSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
	getFacilityTypeRegistry: () => Map<string, FacilityType>,
	getLocationFacilityType: (loc: WorldLocation) => string | undefined,
): ServiceSystemHandle {
	const visits = new Map<string, ServiceVisit>();

	function payWage(
		worker: AgentActor,
		facility: FacilityComponent,
		facilityType: Extract<FacilityType, { kind: 'service' }>,
		loc: WorldLocation,
		economy: EconomyComponent,
		deps: GameCoreDeps,
	): boolean {
		const wage = facilityType.default_wage;
		if (wage <= 0) return true;

		let wageFrom: string;
		if (facilityType.funding === 'facility') {
			if (facility.state.fund < wage) return false;
			facility.state = { ...facility.state, fund: facility.state.fund - wage };
			facility.markDirty();
			wageFrom = loc.id;
		} else {
			economy.state = { ...economy.state, treasury: economy.state.treasury - wage };
			economy.markDirty();
			wageFrom = 'treasury';
		}

		const taxRate = resolveEffectiveTaxRate(economy.state, deps.config.economy);
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
			source: 'ServiceSystem',
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
				source: 'ServiceSystem',
				payload: {
					category: 'transfer' as const,
					subcategory: 'tax',
					amount: tax,
					fromEntity: wageFrom,
					toEntity: 'treasury',
				},
			});
		}

		return true;
	}

	function applyNeedsEffects(
		agent: AgentActor,
		effects: Extract<FacilityType, { kind: 'service' }>['staffed_effects'],
	): void {
		if (effects.energy === 0 && effects.social === 0) return;
		const needs = agent.get(NeedsComponent);
		const newEnergy = effects.energy !== 0
			? Math.max(0, Math.min(100, needs.state.energy + effects.energy))
			: needs.state.energy;
		const newSocial = effects.social !== 0
			? Math.max(0, Math.min(100, needs.state.social + effects.social))
			: needs.state.social;
		needs.state = { ...needs.state, energy: newEnergy, social: newSocial };
		needs.markDirty();
	}

	function applyMoodMemory(
		agent: AgentActor,
		effects: Extract<FacilityType, { kind: 'service' }>['staffed_effects'],
		loc: WorldLocation,
		deps: GameCoreDeps,
	): void {
		if (effects.mood === 0) return;
		const memComp = agent.get(MemoryComponent);
		const outcome: 'positive' | 'negative' = effects.mood > 0 ? 'positive' : 'negative';
		const halfDivisor = 2;
		memComp.state = {
			...memComp.state,
			entries: [
				...memComp.state.entries,
				{
					tick: deps.tickCount,
					type: `service_${loc.id}`,
					description: `Visited service facility ${loc.name}`,
					participants: [],
					outcome,
					significance: Math.max(1, Math.ceil(Math.abs(effects.mood) / halfDivisor)),
					mood_impact: effects.mood,
				},
			],
		};
		memComp.markDirty();
	}

	function applySkillXp(
		agent: AgentActor,
		effects: Extract<FacilityType, { kind: 'service' }>['staffed_effects'],
	): void {
		if (effects.skill_xp <= 0) return;
		const skills = agent.behaviorAgent.skills;
		const existing = skills.find(s => s.id === 'study');
		if (existing !== undefined) {
			existing.points += effects.skill_xp;
			return;
		}
		const newSkill: SkillEntry = { id: 'study', points: effects.skill_xp, use_count: 0, use_bonus: 0 };
		agent.behaviorAgent.skills = [...skills, newSkill];
	}

	function applyEffects(
		agent: AgentActor,
		effects: Extract<FacilityType, { kind: 'service' }>['staffed_effects'],
		loc: WorldLocation,
		deps: GameCoreDeps,
	): void {
		applyNeedsEffects(agent, effects);
		applyMoodMemory(agent, effects, loc, deps);
		applySkillXp(agent, effects);
	}

	function resolveServiceFacility(
		loc: WorldLocation,
		registry: Map<string, FacilityType>,
		locationActorMap: Map<string, Actor>,
	): { facilityType: Extract<FacilityType, { kind: 'service' }>; facility: FacilityComponent } | null {
		const facilityTypeId = getLocationFacilityType(loc);
		if (facilityTypeId === undefined || facilityTypeId === '') return null;
		const facilityType = registry.get(facilityTypeId);
		if (facilityType === undefined) return null;
		if (facilityType.kind !== 'service') return null;
		const locActor = locationActorMap.get(loc.id);
		if (locActor === undefined) return null;
		if (!locActor.has(FacilityComponent)) return null;
		const facility = locActor.get(FacilityComponent);
		if (facility.state.status === 'abandoned') return null;
		return { facilityType, facility };
	}

	function isOrphaned(agent: AgentActor, loc: WorldLocation): boolean {
		const ba = agent.behaviorAgent;
		return ba.btAction !== 'use_service'
			|| ba.atLocation !== loc.id
			|| ba.insideFacility !== true;
	}

	function emitServiceDelivered(
		agent: AgentActor,
		loc: WorldLocation,
		facilityType: Extract<FacilityType, { kind: 'service' }>,
		staffed: boolean,
		deps: GameCoreDeps,
	): void {
		deps.eventBus.emit({
			type: 'ServiceDelivered',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'ServiceSystem',
			payload: {
				agentId: agent.agentId,
				facilityId: loc.id,
				facilityType: facilityType.id,
				staffed,
			},
		});
	}

	function tickVisitor(
		agent: AgentActor,
		visit: ServiceVisit,
		loc: WorldLocation,
		facilityType: Extract<FacilityType, { kind: 'service' }>,
		hasWorker: boolean,
		deps: GameCoreDeps,
	): void {
		if (isOrphaned(agent, loc)) {
			agent.behaviorAgent.insideFacility = false;
			visits.delete(agent.agentId);
			return;
		}

		visit.ticksRemaining -= 1;
		if (visit.ticksRemaining > 0) return;

		const effects = hasWorker ? facilityType.staffed_effects : facilityType.unstaffed_effects;
		applyEffects(agent, effects, loc, deps);
		agent.behaviorAgent.insideFacility = false;
		visits.delete(agent.agentId);
		emitServiceDelivered(agent, loc, facilityType, hasWorker, deps);
	}

	function processServiceLocation(
		loc: WorldLocation,
		facilityType: Extract<FacilityType, { kind: 'service' }>,
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

		if (worker !== undefined) {
			payWage(worker, facility, facilityType, loc, economy, deps);
		}

		for (const agent of agentList) {
			const visit = visits.get(agent.agentId);
			if (visit?.facilityId !== loc.id) continue;
			tickVisitor(agent, visit, loc, facilityType, worker !== undefined, deps);
		}
	}

	const system: GameSystem = {
		name: 'ServiceSystem',
		priority: SystemPriority.LEISURE,

		execute(deps: GameCoreDeps): void {
			const locationList = locations();
			const agentList = agents();
			const registry = getFacilityTypeRegistry();
			const locationActorMap = getLocationActors();
			const economy = worldEntity().get(EconomyComponent);

			for (const loc of locationList) {
				const resolved = resolveServiceFacility(loc, registry, locationActorMap);
				if (resolved === null) continue;
				processServiceLocation(loc, resolved.facilityType, resolved.facility, agentList, economy, deps);
			}
		},
	};

	return {
		system,
		startVisit(agentId, visit): void {
			visits.set(agentId, { ...visit });
		},
		getVisit(agentId): ServiceVisit | undefined {
			const v = visits.get(agentId);
			return v === undefined ? undefined : { ...v };
		},
		clearVisit(agentId): void {
			visits.delete(agentId);
		},
	};
}
