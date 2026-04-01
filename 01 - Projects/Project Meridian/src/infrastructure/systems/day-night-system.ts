import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { advanceTime } from '../../domain/systems/day-night.js';
import { generateDailyReport } from '../../domain/systems/daily-report.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { FacilityComponent } from '../components/facility-component.js';
import { NeedsComponent } from '../components/needs-component.js';

const DAY_PADDING_WIDTH = 3;

function processWelfare(
	agentList: AgentActor[],
	economy: EconomyComponent,
	deps: GameCoreDeps,
): void {
	const welfareThreshold = deps.config.economy.welfare_threshold_gold;
	const welfareReward = deps.config.economy.welfare_reward_min;
	const maxGrants = deps.config.economy.max_active_welfare_quests;
	let grantCount = 0;

	// Sort by gold ascending so the poorest agents get welfare first
	const sorted = [...agentList].sort((a, b) =>
		a.get(WalletComponent).state.gold - b.get(WalletComponent).state.gold,
	);

	for (const agent of sorted) {
		if (grantCount >= maxGrants) break;
		const wallet = agent.get(WalletComponent);
		if (wallet.state.gold >= welfareThreshold) continue;
		if (economy.state.treasury < welfareReward) continue;

		wallet.state = { ...wallet.state, gold: wallet.state.gold + welfareReward };
		wallet.markDirty();

		economy.state = {
			...economy.state,
			treasury: economy.state.treasury - welfareReward,
			ledger: [
				...economy.state.ledger,
				{
					tick: deps.tickCount,
					type: 'welfare' as const,
					from: 'treasury',
					to: agent.agentId,
					itemId: null,
					quantity: 0,
					gold: welfareReward,
				},
			],
		};
		economy.markDirty();

		deps.eventBus.emit({
			type: 'WelfareGranted',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DayNightSystem',
			payload: { agentId: agent.agentId, amount: welfareReward, treasuryRemaining: economy.state.treasury },
		});

		grantCount++;
	}
}

function collectFacilities(
	locationData: WorldLocation[],
	locationActors: Map<string, Actor>,
): { name: string; produced: { item: string; qty: number }[]; workerName: string | null; status: string }[] {
	const facilities: { name: string; produced: { item: string; qty: number }[]; workerName: string | null; status: string }[] = [];
	for (const loc of locationData) {
		const locActor = locationActors.get(loc.id);
		if (locActor?.has(FacilityComponent) !== true) continue;
		const fac = locActor.get(FacilityComponent);
		facilities.push({
			name: loc.name,
			produced: fac.state.stock.map(s => ({ item: s.item_id, qty: s.quantity })),
			workerName: fac.state.workerId,
			status: fac.state.status,
		});
	}
	return facilities;
}

function writeDailyReport(
	economy: EconomyComponent,
	agentList: AgentActor[],
	locationActors: Map<string, Actor>,
	locationData: WorldLocation[],
	dayCount: number,
	deps: GameCoreDeps,
	previousGold: Map<string, number>,
): void {
	const facilities = collectFacilities(locationData, locationActors);

	const agentSnapshots = agentList.map(a => {
		const w = a.get(WalletComponent);
		const prev = previousGold.get(a.agentId) ?? w.state.gold;
		return { name: a.agentName, gold: w.state.gold, goldChange: w.state.gold - prev };
	});

	const report = generateDailyReport({
		dayCount,
		summary: economy.state.dailySummary,
		treasury: economy.state.treasury,
		facilities,
		transactions: economy.state.ledger,
		agents: agentSnapshots,
	});

	const dayStr = String(dayCount).padStart(DAY_PADDING_WIDTH, '0');
	const path = `03 - Resources/Economy/day-${dayStr}.md`;

	if (deps.writeFile !== null) {
		const content = `${report.frontmatter}\n${report.body}`;
		void deps.writeFile(path, content);
	}

	deps.eventBus.emit({
		type: 'DailyReportWritten',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'DayNightSystem',
		payload: { dayCount, path },
	});
}

function checkEconomyLiveness(
	agentList: AgentActor[],
	economy: EconomyComponent,
	dayCount: number,
	deps: GameCoreDeps,
): void {
	// 1. Starvation detection — all agents at hunger 0
	if (agentList.length > 0 && agentList.every(a => a.get(NeedsComponent).state.hunger === 0)) {
		deps.eventBus.emit({
			type: 'EconomyCollapsed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DayNightSystem',
			payload: { reason: 'all_agents_starving', dayCount },
		});
		deps.logger.warn('DayNightSystem', `Economy collapse detected: all agents have hunger at 0 on day ${dayCount}`);
	}

	// 2. Production stall detection — no wages paid this day
	if (economy.state.dailySummary.totalWages === 0) {
		deps.eventBus.emit({
			type: 'ProductionStalled',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DayNightSystem',
			payload: { reason: 'no_production', dayCount },
		});
		deps.logger.warn('DayNightSystem', `Production stalled: no wages paid on day ${dayCount}`);
	}

	// 3. Trade stall detection — no purchases this day (warning only)
	if (economy.state.dailySummary.totalSales === 0) {
		deps.logger.warn('DayNightSystem', `No trades occurred on day ${dayCount}`);
	}
}

function processStipends(
	agentList: AgentActor[],
	economy: EconomyComponent,
	deps: GameCoreDeps,
): void {
	for (const agent of agentList) {
		const job = agent.job;
		let stipendAmount = 0;
		if (job === 'guard') {
			stipendAmount = deps.config.economy.guard_stipend;
		} else if (job === 'merchant') {
			stipendAmount = deps.config.economy.merchant_stipend;
		}
		if (stipendAmount === 0) continue;

		if (economy.state.treasury < stipendAmount) {
			deps.eventBus.emit({
				type: 'StipendSkipped',
				tick: deps.tickCount,
				wallClock: Date.now(),
				source: 'DayNightSystem',
				payload: { agentId: agent.agentId, job, amount: stipendAmount, treasuryRemaining: economy.state.treasury },
			});
			continue;
		}

		const wallet = agent.get(WalletComponent);
		wallet.state = { ...wallet.state, gold: wallet.state.gold + stipendAmount };
		wallet.markDirty();

		economy.state = {
			...economy.state,
			treasury: economy.state.treasury - stipendAmount,
			ledger: [
				...economy.state.ledger,
				{
					tick: deps.tickCount,
					type: 'stipend' as const,
					from: 'treasury',
					to: agent.agentId,
					itemId: null,
					quantity: 0,
					gold: stipendAmount,
				},
			],
		};
		economy.markDirty();

		deps.eventBus.emit({
			type: 'StipendPaid',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DayNightSystem',
			payload: { agentId: agent.agentId, job, amount: stipendAmount, treasuryRemaining: economy.state.treasury },
		});
	}
}

function processFacilitySubsidies(
	locationActors: Map<string, Actor>,
	locationData: WorldLocation[],
	economy: EconomyComponent,
	deps: GameCoreDeps,
): void {
	const threshold = deps.config.economy.facility_subsidy_threshold;
	const subsidyAmount = deps.config.economy.facility_subsidy_per_day;

	for (const loc of locationData) {
		const locActor = locationActors.get(loc.id);
		if (locActor === undefined) continue;
		if (!locActor.has(FacilityComponent)) continue;
		const facility = locActor.get(FacilityComponent);
		if (facility.state.fund >= threshold) continue;
		if (economy.state.treasury < subsidyAmount) continue;

		facility.state = { ...facility.state, fund: facility.state.fund + subsidyAmount };
		facility.markDirty();

		economy.state = {
			...economy.state,
			treasury: economy.state.treasury - subsidyAmount,
			ledger: [
				...economy.state.ledger,
				{
					tick: deps.tickCount,
					type: 'subsidy' as const,
					from: 'treasury',
					to: loc.id,
					itemId: null,
					quantity: 0,
					gold: subsidyAmount,
				},
			],
		};
		economy.markDirty();

		deps.eventBus.emit({
			type: 'FacilitySubsidised',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DayNightSystem',
			payload: { facilityId: loc.id, amount: subsidyAmount, newFund: facility.state.fund, treasuryRemaining: economy.state.treasury },
		});
	}
}

function processDayBoundary(
	entity: Actor,
	dayCount: number,
	getAgents: (() => AgentActor[]) | undefined,
	getLocationActors: (() => Map<string, Actor>) | undefined,
	getLocations: (() => WorldLocation[]) | undefined,
	deps: GameCoreDeps,
	previousGold: Map<string, number>,
): void {
	if (!entity.has(EconomyComponent)) return;

	const economy = entity.get(EconomyComponent);
	const agentList = getAgents?.() ?? [];

	// 0. Treasury regen
	const treasuryRegen = deps.config.economy.treasury_regen_per_day;
	economy.state = { ...economy.state, treasury: economy.state.treasury + treasuryRegen };
	economy.markDirty();

	// 1. Welfare check
	processWelfare(agentList, economy, deps);

	// 2. Stipends
	processStipends(agentList, economy, deps);

	// 3. Facility subsidies
	const locationActors = getLocationActors?.() ?? new Map<string, Actor>();
	const locationData = getLocations?.() ?? [];
	processFacilitySubsidies(locationActors, locationData, economy, deps);

	// 4. Economy liveness invariant checks
	checkEconomyLiveness(agentList, economy, dayCount, deps);

	// 5. Generate daily report
	writeDailyReport(economy, agentList, locationActors, locationData, dayCount, deps, previousGold);

	// 6. Snapshot current gold for next day's delta
	for (const agent of agentList) {
		previousGold.set(agent.agentId, agent.get(WalletComponent).state.gold);
	}

	// 7. Prune old ledger entries
	const retentionTicks = deps.config.economy.ledger_retention_days * deps.config.ticks_per_day;
	const cutoffTick = deps.tickCount - retentionTicks;
	const prunedLedger = economy.state.ledger.filter(e => e.tick >= cutoffTick);

	// 8. Reset daily summary
	economy.state = {
		...economy.state,
		ledger: prunedLedger,
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	};
	economy.markDirty();
}

export function createDayNightSystem(
	worldEntity: () => Actor,
	getAgents?: () => AgentActor[],
	getLocationActors?: () => Map<string, Actor>,
	getLocations?: () => WorldLocation[],
): GameSystem {
	let previousDayCount = -1;
	const previousGold = new Map<string, number>();

	return {
		name: 'DayNightSystem',
		priority: SystemPriority.DAY_NIGHT,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);

			const result = advanceTime(deps.tickCount, {
				ticks_per_day: deps.config.ticks_per_day,
				day_night: deps.config.day_night,
			});

			const oldPhase = time.state.phase;
			time.state = result.state;
			time.markDirty();

			if (result.phaseChanged) {
				deps.eventBus.emit({
					type: 'DayPhaseChanged',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'DayNightSystem',
					payload: {
						oldPhase,
						newPhase: result.state.phase,
						dayCount: result.state.dayCount,
					},
				});
			}

			// Day boundary logic — welfare check + daily report + ledger pruning
			const dayIncremented = result.state.dayCount > previousDayCount && previousDayCount >= 0;
			previousDayCount = result.state.dayCount;

			if (dayIncremented) {
				processDayBoundary(entity, result.state.dayCount, getAgents, getLocationActors, getLocations, deps, previousGold);
			}
		},
	};
}
