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

	for (const agent of agentList) {
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
): void {
	const facilities = collectFacilities(locationData, locationActors);

	const agentSnapshots = agentList.map(a => {
		const w = a.get(WalletComponent);
		return { name: a.agentName, gold: w.state.gold, goldChange: 0 };
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

function processDayBoundary(
	entity: Actor,
	dayCount: number,
	getAgents: (() => AgentActor[]) | undefined,
	getLocationActors: (() => Map<string, Actor>) | undefined,
	getLocations: (() => WorldLocation[]) | undefined,
	deps: GameCoreDeps,
): void {
	if (!entity.has(EconomyComponent)) return;

	const economy = entity.get(EconomyComponent);
	const agentList = getAgents?.() ?? [];

	// 1. Welfare check
	processWelfare(agentList, economy, deps);

	// 2. Generate daily report
	const locationActors = getLocationActors?.() ?? new Map<string, Actor>();
	const locationData = getLocations?.() ?? [];
	writeDailyReport(economy, agentList, locationActors, locationData, dayCount, deps);

	// 3. Prune old ledger entries
	const retentionTicks = deps.config.economy.ledger_retention_days * deps.config.ticks_per_day;
	const cutoffTick = deps.tickCount - retentionTicks;
	const prunedLedger = economy.state.ledger.filter(e => e.tick >= cutoffTick);

	// 4. Reset daily summary
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
				processDayBoundary(entity, result.state.dayCount, getAgents, getLocationActors, getLocations, deps);
			}
		},
	};
}
