import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyRecipeCycle } from '../../domain/systems/recipe.js';
import { getEffectiveTaxRate } from '../../domain/systems/monetary-policy.js';
import { applySkillProgression } from '../../domain/systems/skill-progression.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { findWorker } from '../../domain/systems/facility-worker.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Recipe } from '../../domain/schemas/recipe-schema.js';
import type { FacilityType } from '../../domain/schemas/facility-type-schema.js';
import { WalletComponent } from '../components/wallet-component.js';
import type { FacilityComponent } from '../components/facility-component.js';
import type { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import type { LedgerEntry } from '../../domain/core/component-data.js';
import type { SkillEntry } from '../../domain/systems/behavior-agent.js';

function upsertSkill(skills: SkillEntry[], skillId: string, updated: SkillEntry): SkillEntry[] {
	const exists = skills.some(s => s.id === skillId);
	if (exists) return skills.map(s => s.id === skillId ? updated : { ...s });
	return [...skills.map(s => ({ ...s })), updated];
}

function applyWorkerSkillProgression(worker: AgentActor, skillId: string, deps: GameCoreDeps): void {
	const ba = worker.behaviorAgent;
	const agentSkills = ba.skills;
	const existing = agentSkills.find(s => s.id === skillId);
	const skillResult = applySkillProgression({
		points: existing?.points ?? 0,
		useCount: existing?.use_count ?? 0,
		useBonus: existing?.use_bonus ?? 0,
		thresholds: [...deps.config.skills.use_thresholds],
		maxUseBonus: deps.config.skills.max_use_bonus,
	});
	const newSkill: SkillEntry = {
		id: skillId,
		points: skillResult.newPoints,
		use_count: skillResult.newUseCount,
		use_bonus: skillResult.newUseBonus,
	};
	ba.skills = upsertSkill(agentSkills, skillId, newSkill);
}

function applyWorkerRelationship(worker: AgentActor, locationId: string, tickCount: number): void {
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
		lastInteractionTick: tickCount,
	};
	const updatedEntries = facilityRelEntry !== undefined
		? workerRelComp.state.entries.map(e => e.agentId === locationId ? newEntry : { ...e })
		: [...workerRelComp.state.entries.map(e => ({ ...e })), newEntry];
	workerRelComp.state = { ...workerRelComp.state, entries: updatedEntries };
	workerRelComp.markDirty();
}

function computeTaxRate(economy: EconomyComponent, deps: GameCoreDeps): number {
	const snapshot = economy.state.monetarySnapshot;
	if (snapshot === undefined) return deps.config.economy.tax_base_rate;
	const mp = deps.config.economy.monetary_policy;
	return getEffectiveTaxRate(
		mp.tax_base_rate,
		snapshot.velocity,
		{ stagnant: mp.velocity_stagnant, overheated: mp.velocity_overheated },
		{ stagnant: mp.tax_stagnant_multiplier, overheated: mp.tax_overheated_multiplier },
	);
}

function computeEffectiveTicks(
	worker: AgentActor,
	baseTicks: number,
	primaryJob: string,
	deps: GameCoreDeps,
): number {
	const jobDef = deps.config.jobs.definitions[primaryJob];
	if (jobDef === undefined) return baseTicks;
	const attrValue = worker.get(AttributesComponent).getByName(jobDef.primary_attribute)
		|| deps.config.jobs.aptitude_baseline;
	const efficiency = attrValue / deps.config.jobs.aptitude_baseline;
	return Math.round(baseTicks / efficiency);
}

interface CycleContext {
	loc: WorldLocation;
	facilityType: FacilityType & { kind: 'production' };
	recipe: Recipe;
	worker: AgentActor;
	economy: EconomyComponent;
	deps: GameCoreDeps;
	workerGoldChange: number;
	taxCollected: number;
	treasuryDelta: number;
	fundBefore: number;
	fundAfter: number;
}

function recordRecipeCycleComplete(ctx: CycleContext): void {
	const { loc, facilityType, recipe, worker, economy, deps } = ctx;

	// Pay worker
	const workerWallet = worker.get(WalletComponent);
	workerWallet.state = {
		...workerWallet.state,
		gold: workerWallet.state.gold + ctx.workerGoldChange,
	};
	workerWallet.markDirty();

	// Public-wage event for treasury-funded facilities
	if (facilityType.funding === 'treasury' && ctx.workerGoldChange > 0) {
		deps.eventBus.emit({
			type: 'GoldFlowed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				category: 'transfer' as const,
				subcategory: 'public_wage',
				amount: ctx.workerGoldChange,
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
			amount: ctx.workerGoldChange,
			fromEntity: loc.id,
			toEntity: worker.agentId,
		},
	});

	// Ledger + daily summary update. Treasury absolute value already includes
	// wage debit from applyRecipeCycle; we only need to add tax on top here.
	const newEntries: LedgerEntry[] = [
		{
			tick: deps.tickCount,
			type: 'wage' as const,
			from: loc.id,
			to: worker.agentId,
			itemId: null,
			quantity: 0,
			gold: ctx.workerGoldChange,
		},
		{
			tick: deps.tickCount,
			type: 'tax' as const,
			from: loc.id,
			to: 'treasury',
			itemId: null,
			quantity: 0,
			gold: ctx.taxCollected,
		},
	];
	economy.state = {
		...economy.state,
		treasury: economy.state.treasury + ctx.treasuryDelta + ctx.taxCollected,
		ledger: [...economy.state.ledger, ...newEntries],
		dailySummary: {
			...economy.state.dailySummary,
			totalWages: economy.state.dailySummary.totalWages + ctx.workerGoldChange,
			totalTax: economy.state.dailySummary.totalTax + ctx.taxCollected,
		},
	};
	economy.markDirty();

	// Skill progression keyed on the facility type's primary job
	applyWorkerSkillProgression(worker, facilityType.primary_job, deps);

	// Relationship update (facility -> worker)
	applyWorkerRelationship(worker, loc.id, deps.tickCount);

	// ProductionComplete event (first output chosen for payload when multi-output)
	const firstOutput = recipe.outputs[0];
	deps.eventBus.emit({
		type: 'ProductionComplete',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'FacilitySystem',
		payload: {
			facilityId: loc.id,
			workerId: worker.agentId,
			outputItem: firstOutput?.item_id,
			outputQty: firstOutput?.quantity,
			wage: ctx.workerGoldChange,
			taxCollected: ctx.taxCollected,
		},
	});

	if (ctx.taxCollected > 0) {
		deps.eventBus.emit({
			type: 'TaxCollected',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				amount: ctx.taxCollected,
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
				amount: ctx.taxCollected,
				fromEntity: loc.id,
				toEntity: 'treasury',
			},
		});
	}

	// Insolvency check — treasury-funded facilities by design have fund=0
	if (ctx.fundAfter <= 0 && facilityType.funding !== 'treasury') {
		deps.eventBus.emit({
			type: 'FacilityInsolvent',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: {
				facilityId: loc.id,
				fund: 0,
				unpaidWage: Math.max(0, facilityType.default_wage - (ctx.fundBefore - ctx.fundAfter)),
			},
		});
	}
}

export function processRecipeFacilityTick(
	loc: WorldLocation,
	facilityType: FacilityType & { kind: 'production' },
	recipe: Recipe,
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

	if (worker === undefined) {
		facility.state = {
			...facility.state,
			status: 'idle',
			workProgress: 0,
		};
		facility.markDirty();
		deps.eventBus.emit({
			type: 'FacilityIdle',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: { facilityId: loc.id, reason: 'no_worker' },
		});
		return;
	}

	const effectiveTicks = computeEffectiveTicks(worker, recipe.ticks_per_cycle, facilityType.primary_job, deps);
	const taxRate = computeTaxRate(economy, deps);

	const fundBefore = facility.state.fund;
	const result = applyRecipeCycle({
		facilityStock: facility.state.stock,
		workProgress: facility.state.workProgress,
		ticksPerCycle: effectiveTicks,
		recipe,
		wage: facilityType.default_wage,
		facilityFund: facility.state.fund,
		funding: facilityType.funding,
		treasuryFund: economy.state.treasury,
		taxRate,
	});

	// Detect "idle because missing inputs" — progress unchanged, no cycle.
	const madeProgress = result.newWorkProgress !== facility.state.workProgress;
	if (!madeProgress && !result.cycleComplete) {
		facility.state = {
			...facility.state,
			stock: result.newStock,
			fund: result.newFund,
			workProgress: result.newWorkProgress,
			status: 'idle',
		};
		facility.markDirty();
		deps.eventBus.emit({
			type: 'FacilityIdle',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'FacilitySystem',
			payload: { facilityId: loc.id, reason: 'no_input' },
		});
		return;
	}

	facility.state = {
		...facility.state,
		stock: result.newStock,
		fund: result.newFund,
		workProgress: result.newWorkProgress,
		status: 'producing',
	};
	facility.markDirty();

	if (!result.cycleComplete) return;

	// Treasury absolute delta from applyRecipeCycle (before tax credit).
	const treasuryDelta = result.newTreasury - economy.state.treasury;

	recordRecipeCycleComplete({
		loc,
		facilityType,
		recipe,
		worker,
		economy,
		deps,
		workerGoldChange: result.workerGoldChange,
		taxCollected: result.taxCollected,
		treasuryDelta,
		fundBefore,
		fundAfter: result.newFund,
	});
}
