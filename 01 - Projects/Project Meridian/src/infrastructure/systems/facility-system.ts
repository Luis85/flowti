import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyFacilityTick, type FacilityTickResult } from '../../domain/systems/facility.js';
import { applySkillProgression } from '../../domain/systems/skill-progression.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { distance } from '../../domain/core/math-utils.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation, Production } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import type { LedgerEntry } from '../../domain/core/component-data.js';

interface StockItem {
	item_id: string;
	quantity: number;
}

export function findItemInStock(stock: StockItem[], itemId: string): number {
	for (const item of stock) {
		if (item.item_id === itemId) return item.quantity;
	}
	return 0;
}

export function updateStock(stock: StockItem[], itemId: string, delta: number): StockItem[] {
	const hasItem = stock.some(item => item.item_id === itemId);
	if (!hasItem && delta > 0) {
		return [...stock.map(item => ({ ...item })), { item_id: itemId, quantity: delta }];
	}
	return stock
		.map(item => {
			if (item.item_id !== itemId) return { ...item };
			const newQty = item.quantity + delta;
			return newQty > 0 ? { ...item, quantity: newQty } : null;
		})
		.filter((item): item is StockItem => item !== null);
}

function findWorker(
	agentList: AgentActor[],
	facilityJob: string,
	locX: number,
	locY: number,
	radius: number,
): AgentActor | undefined {
	for (const agent of agentList) {
		const bb = agent.get(BlackboardComponent);
		const btAction = bb.state.btAction as string | undefined;
		if (btAction !== 'work') continue;
		if (agent.job !== facilityJob) continue;
		const dist = distance(agent.pos.x, agent.pos.y, locX, locY);
		if (dist <= radius) return agent;
	}
	return undefined;
}

function applyStockChanges(
	stock: StockItem[],
	result: FacilityTickResult,
	production: NonNullable<Production>,
): StockItem[] {
	let newStock = [...stock.map(s => ({ ...s }))];
	if (result.consumeInput && production.input !== null) {
		newStock = updateStock(newStock, production.input.item_id, -production.input.quantity);
	}
	if (result.produceOutput) {
		newStock = updateStock(newStock, production.output.item_id, production.output.quantity);
	}
	return newStock;
}

function recordCycleComplete(
	worker: AgentActor,
	facility: FacilityComponent,
	economy: EconomyComponent,
	result: FacilityTickResult,
	loc: WorldLocation,
	deps: GameCoreDeps,
): void {
	// Pay worker
	const workerWallet = worker.get(WalletComponent);
	workerWallet.state = { ...workerWallet.state, gold: workerWallet.state.gold + result.workerGoldChange };
	workerWallet.markDirty();

	// Collect tax + record ledger
	const newEntries: LedgerEntry[] = [
		{
			tick: deps.tickCount,
			type: 'wage' as const,
			from: loc.id,
			to: worker.agentId,
			itemId: null,
			quantity: 0,
			gold: result.workerGoldChange,
		},
		{
			tick: deps.tickCount,
			type: 'tax' as const,
			from: loc.id,
			to: 'treasury',
			itemId: null,
			quantity: 0,
			gold: result.taxCollected,
		},
	];
	economy.state = {
		...economy.state,
		treasury: economy.state.treasury + result.taxCollected,
		ledger: [...economy.state.ledger, ...newEntries],
	};
	economy.markDirty();

	// Skill progression
	applyWorkerSkillProgression(worker, loc, deps);

	// Relationship update (facility → worker)
	applyWorkerRelationship(worker, loc.id);

	deps.eventBus.emit({
		type: 'ProductionComplete',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'FacilitySystem',
		payload: {
			facilityId: loc.id,
			workerId: worker.agentId,
			outputItem: loc.production?.output.item_id,
			outputQuantity: loc.production?.output.quantity,
		},
	});

	// Insolvency check
	if (facility.state.fund <= 0) {
		deps.eventBus.emit({
			type: 'FacilityInsolvent',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: { facilityId: loc.id },
		});
	}
}

interface SkillEntry {
	id: string;
	points: number;
	use_count: number;
	use_bonus: number;
}

function upsertSkill(skills: SkillEntry[], skillId: string, updated: SkillEntry): SkillEntry[] {
	const exists = skills.some(s => s.id === skillId);
	if (exists) return skills.map(s => s.id === skillId ? updated : { ...s });
	return [...skills.map(s => ({ ...s })), updated];
}

function applyWorkerSkillProgression(worker: AgentActor, loc: WorldLocation, deps: GameCoreDeps): void {
	const workerBb = worker.get(BlackboardComponent);
	const agentSkills = (workerBb.state.skills as SkillEntry[] | undefined) ?? [];
	const jobSkillId = loc.production?.job ?? '';
	const existing = agentSkills.find(s => s.id === jobSkillId);
	const skillResult = applySkillProgression({
		points: existing?.points ?? 0,
		useCount: existing?.use_count ?? 0,
		useBonus: existing?.use_bonus ?? 0,
		thresholds: [...deps.config.skills.use_thresholds],
		maxUseBonus: deps.config.skills.max_use_bonus,
	});
	const newSkill: SkillEntry = { id: jobSkillId, points: skillResult.newPoints, use_count: skillResult.newUseCount, use_bonus: skillResult.newUseBonus };
	workerBb.state = { ...workerBb.state, skills: upsertSkill(agentSkills, jobSkillId, newSkill) };
	workerBb.markDirty();
}

function applyWorkerRelationship(worker: AgentActor, locationId: string): void {
	const workerRelComp = worker.get(RelationshipComponent);
	const facilityRelEntry = workerRelComp.state.entries.find(e => e.agentId === locationId);
	const relResult = applyRelationshipUpdate({
		currentDisposition: facilityRelEntry?.disposition ?? 0,
		currentFamiliarity: facilityRelEntry?.familiarity ?? 0,
		dispositionChange: 1,
		familiarityChange: 1,
	});
	const newEntry = { agentId: locationId, disposition: relResult.newDisposition, familiarity: relResult.newFamiliarity };
	const updatedEntries = facilityRelEntry !== undefined
		? workerRelComp.state.entries.map(e => e.agentId === locationId ? newEntry : { ...e })
		: [...workerRelComp.state.entries.map(e => ({ ...e })), newEntry];
	workerRelComp.state = { ...workerRelComp.state, entries: updatedEntries };
	workerRelComp.markDirty();
}

function checkRequiredInput(facility: FacilityComponent, production: NonNullable<Production>): boolean {
	return production.input === null
		|| findItemInStock(facility.state.stock, production.input.item_id) >= production.input.quantity;
}

function processFacilityTick(
	loc: WorldLocation,
	production: NonNullable<Production>,
	facility: FacilityComponent,
	agentList: AgentActor[],
	economy: EconomyComponent,
	deps: GameCoreDeps,
): void {
	const radius = deps.config.perception.interaction_radius;
	const worker = findWorker(agentList, production.job, loc.position.x, loc.position.y, radius);

	const result = applyFacilityTick({
		hasWorker: worker !== undefined,
		workerJob: worker?.job ?? null,
		facilityJob: production.job,
		workProgress: facility.state.workProgress,
		ticksPerCycle: production.ticks_per_cycle,
		hasRequiredInput: checkRequiredInput(facility, production),
		wage: production.wage,
		taxRate: deps.config.economy.tax_rate,
		facilityFund: facility.state.fund,
		workerGold: worker !== undefined ? worker.get(WalletComponent).state.gold : 0,
	});

	const newStock = applyStockChanges(facility.state.stock, result, production);
	facility.state = {
		...facility.state,
		stock: newStock,
		fund: facility.state.fund + result.facilityFundChange,
		workProgress: result.newWorkProgress,
		status: result.status,
		workerId: worker?.agentId ?? null,
	};
	facility.markDirty();

	if (result.cycleComplete && worker !== undefined) {
		recordCycleComplete(worker, facility, economy, result, loc, deps);
	} else if (result.idleReason !== null) {
		deps.eventBus.emit({
			type: 'FacilityIdle',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: { facilityId: loc.id, reason: result.idleReason },
		});
	}
}

export function createFacilitySystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'FacilitySystem',
		priority: SystemPriority.FACILITY,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const locationActorMap = getLocationActors();
			const economy = worldEntity().get(EconomyComponent);

			for (const loc of locationList) {
				if (loc.production === null) continue;
				const locActor = locationActorMap.get(loc.id);
				if (locActor === undefined) continue;
				processFacilityTick(loc, loc.production, locActor.get(FacilityComponent), agentList, economy, deps);
			}
		},
	};
}
