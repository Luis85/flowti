import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyFacilityTick, type FacilityTickResult } from '../../domain/systems/facility.js';
import { getEffectiveTaxRate } from '../../domain/systems/monetary-policy.js';
import { applySkillProgression } from '../../domain/systems/skill-progression.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { distance } from '../../domain/core/math-utils.js';
import { FOOD_ITEMS } from '../../domain/systems/food-items.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation, Production } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { WalletComponent } from '../components/wallet-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import type { LedgerEntry } from '../../domain/core/component-data.js';
import type { SkillEntry } from '../../domain/systems/behavior-agent.js';
import type { Item } from '../../domain/schemas/item-schema.js';

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
		const btAction = agent.behaviorAgent.btAction;
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

	// Debit treasury for treasury-funded wages
	if (result.treasuryChange !== 0) {
		economy.state = {
			...economy.state,
			treasury: economy.state.treasury + result.treasuryChange,
		};
		deps.eventBus.emit({
			type: 'GoldFlowed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				category: 'transfer' as const,
				subcategory: 'public_wage',
				amount: -result.treasuryChange,
				fromEntity: 'treasury',
				toEntity: worker.agentId,
			},
		});
	}

	deps.eventBus.emit({
		type: 'GoldFlowed',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'FacilitySystem',
		payload: {
			category: 'transfer' as const,
			subcategory: 'wage',
			amount: result.workerGoldChange, // net wage after tax
			fromEntity: loc.id,
			toEntity: worker.agentId,
		},
	});

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
		dailySummary: {
			...economy.state.dailySummary,
			totalWages: economy.state.dailySummary.totalWages + result.workerGoldChange,
			totalTax: economy.state.dailySummary.totalTax + result.taxCollected,
		},
	};
	economy.markDirty();

	// Skill progression
	applyWorkerSkillProgression(worker, loc, deps);

	// Relationship update (facility -> worker)
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
			outputQty: loc.production?.output.quantity,
			wage: result.workerGoldChange,
			taxCollected: result.taxCollected,
		},
	});

	// Tax event
	if (result.taxCollected > 0) {
		deps.eventBus.emit({
			type: 'TaxCollected',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				amount: result.taxCollected,
				workerId: worker.agentId,
				facilityId: loc.id,
				source: 'wage',
			},
		});

		deps.eventBus.emit({
			type: 'GoldFlowed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				category: 'transfer' as const,
				subcategory: 'tax',
				amount: result.taxCollected,
				fromEntity: loc.id,
				toEntity: 'treasury',
			},
		});
	}

	// Insolvency check (treasury-funded facilities always have fund=0 by design — skip)
	if (facility.state.fund <= 0 && loc.production?.funding !== 'treasury') {
		const production = loc.production;
		deps.eventBus.emit({
			type: 'FacilityInsolvent',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				facilityId: loc.id,
				fund: 0,
				unpaidWage: production !== null ? production.wage - (-result.facilityFundChange) : 0,
			},
		});
	}
}

function upsertSkill(skills: SkillEntry[], skillId: string, updated: SkillEntry): SkillEntry[] {
	const exists = skills.some(s => s.id === skillId);
	if (exists) return skills.map(s => s.id === skillId ? updated : { ...s });
	return [...skills.map(s => ({ ...s })), updated];
}

function applyWorkerSkillProgression(worker: AgentActor, loc: WorldLocation, deps: GameCoreDeps): void {
	const ba = worker.behaviorAgent;
	const agentSkills = ba.skills;
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
	ba.skills = upsertSkill(agentSkills, jobSkillId, newSkill);
}

function applyWorkerRelationship(worker: AgentActor, locationId: string): void {
	const workerRelComp = worker.get(RelationshipComponent);
	const facilityRelEntry = workerRelComp.state.entries.find(e => e.agentId === locationId);
	const relResult = applyRelationshipUpdate({
		currentDisposition: facilityRelEntry?.disposition ?? 0,
		currentFamiliarity: facilityRelEntry?.familiarity ?? 0,
		dispositionChange: 0.5,
		familiarityChange: 1,
	});
	const existingTags = facilityRelEntry?.tags ?? [];
	const newEntry = {
		agentId: locationId,
		disposition: relResult.newDisposition,
		familiarity: relResult.newFamiliarity,
		tags: existingTags.includes('worked_with') ? [...existingTags] : [...existingTags, 'worked_with'],
		lastInteractionTick: 0,
	};
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
	itemRegistry?: Map<string, Item>,
): void {
	const radius = deps.config.perception.interaction_radius;
	const worker = findWorker(agentList, production.job, loc.position.x, loc.position.y, radius);

	// Aptitude efficiency modifier — mismatched workers produce slower
	let effectiveTicksPerCycle = production.ticks_per_cycle;
	if (worker !== undefined) {
		const jobsConfig = deps.config.jobs;
		const jobDef = jobsConfig?.definitions[production.job];
		if (jobDef !== undefined) {
			const workerAttrs = worker.get(AttributesComponent).state as unknown as Record<string, number>;
			const attrValue = workerAttrs[jobDef.primary_attribute] ?? jobsConfig.aptitude_baseline;
			const efficiency = attrValue / jobsConfig.aptitude_baseline;
			effectiveTicksPerCycle = Math.round(production.ticks_per_cycle / efficiency);
		}
	}

	const result = applyFacilityTick({
		hasWorker: worker !== undefined,
		workerJob: worker?.job ?? null,
		facilityJob: production.job,
		workProgress: facility.state.workProgress,
		ticksPerCycle: effectiveTicksPerCycle,
		hasRequiredInput: checkRequiredInput(facility, production),
		wage: production.wage,
		taxRate: (() => {
			const snapshot = economy.state.monetarySnapshot;
			if (snapshot === undefined) return deps.config.economy.tax_base_rate;
			const mp = deps.config.economy.monetary_policy;
			return getEffectiveTaxRate(
				mp.tax_base_rate,
				snapshot.velocity,
				{ stagnant: mp.velocity_stagnant, overheated: mp.velocity_overheated },
				{ stagnant: mp.tax_stagnant_multiplier, overheated: mp.tax_overheated_multiplier },
			);
		})(),
		facilityFund: facility.state.fund,
		workerGold: worker !== undefined ? worker.get(WalletComponent).state.gold : 0,
		autoProcess: production.auto_process,
		autoTicksPerCycle: production.auto_ticks_per_cycle ?? production.ticks_per_cycle,
		funding: loc.production!.funding ?? 'facility',
		treasuryFund: economy.state.treasury,
	});

	// Apply input consumption always
	let newStock = [...facility.state.stock.map(s => ({ ...s }))];
	if (result.consumeInput && production.input !== null) {
		newStock = updateStock(newStock, production.input.item_id, -production.input.quantity);
	}

	// Apply tools multiplier for food production before routing
	let outputQty = production.output.quantity;
	if (result.produceOutput && worker !== undefined && FOOD_ITEMS.has(production.output.item_id)) {
		const workerInv = worker.get(InventoryComponent);
		const tools = workerInv.state.items.find(i => i.item_id === 'tools' && (i.charges ?? 0) > 0);
		if (tools !== undefined) {
			outputQty *= deps.config.economy.tools_output_multiplier;
			workerInv.state = {
				items: workerInv.state.items.map(i => {
					if (i.item_id !== 'tools') return { ...i };
					const newCharges = (i.charges ?? 0) - 1;
					return newCharges > 0 ? { ...i, charges: newCharges } : null;
				}).filter((i): i is NonNullable<typeof i> => i !== null),
			};
			workerInv.markDirty();
		}
	}

	// Route output based on funding model
	const isPrivateProduction = production.funding === 'facility' && production.wage === 0;
	if (result.produceOutput && isPrivateProduction && worker !== undefined) {
		// Private production — output goes to worker inventory
		const inv = worker.get(InventoryComponent);
		const itemDef = itemRegistry?.get(production.output.item_id);
		const maxCharges = itemDef?.maxCharges;
		const existingItem = inv.state.items.find(i => i.item_id === production.output.item_id);
		if (existingItem !== undefined) {
			inv.state = { items: inv.state.items.map(i =>
				i.item_id === production.output.item_id
					? { ...i, quantity: i.quantity + outputQty }
					: { ...i }
			) };
		} else {
			const newItem: { item_id: string; quantity: number; charges?: number } = { item_id: production.output.item_id, quantity: outputQty };
			if (maxCharges !== undefined) newItem.charges = maxCharges;
			inv.state = { items: [...inv.state.items.map(i => ({ ...i })), newItem] };
		}
		inv.markDirty();
	} else if (result.produceOutput) {
		// Normal production — output goes to facility stock
		newStock = updateStock(newStock, production.output.item_id, outputQty);
	}

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
	} else if (result.cycleComplete && result.status === 'auto') {
		deps.eventBus.emit({
			type: 'ProductionComplete',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				facilityId: loc.id,
				workerId: null,
				outputItem: loc.production?.output.item_id,
				outputQty: loc.production?.output.quantity,
				wage: 0,
				taxCollected: 0,
			},
		});
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
	getItemRegistry?: () => Map<string, Item>,
): GameSystem {
	return {
		name: 'FacilitySystem',
		priority: SystemPriority.FACILITY,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const locationActorMap = getLocationActors();
			const economy = worldEntity().get(EconomyComponent);
			const items = getItemRegistry?.();

			for (const loc of locationList) {
				if (loc.production === null) continue;
				const locActor = locationActorMap.get(loc.id);
				if (locActor === undefined) continue;
				processFacilityTick(loc, loc.production, locActor.get(FacilityComponent), agentList, economy, deps, items);
			}
		},
	};
}
