import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { NeedsComponent } from '../components/needs-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { generateDailyReport } from '../../domain/systems/daily-report.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

const DAY_PADDING_WIDTH = 3;

export function createDailyReportSystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
	getLocationActors: () => Map<string, Actor>,
	getLocations: () => WorldLocation[],
): GameSystem {
	const previousGold = new Map<string, number>();

	return {
		name: 'DailyReportSystem',
		priority: SystemPriority.DAILY_REPORT,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;
			if (!entity.has(EconomyComponent)) return;

			const economy = entity.get(EconomyComponent);
			const agentList = getAgents();
			const locationActors = getLocationActors();
			const locationData = getLocations();
			const dayCount = time.state.dayCount;

			// 1. Economy liveness checks
			checkEconomyLiveness(agentList, economy, dayCount, deps);

			// 2. Generate daily report
			writeDailyReport(economy, agentList, locationActors, locationData, dayCount, deps, previousGold);

			// 3. Snapshot current gold for next day's delta
			for (const agent of agentList) {
				previousGold.set(agent.agentId, agent.get(WalletComponent).state.gold);
			}

			// 4. Prune old ledger entries
			const retentionTicks = deps.config.economy.ledger_retention_days * deps.config.ticks_per_day;
			const cutoffTick = deps.tickCount - retentionTicks;
			const prunedLedger = economy.state.ledger.filter(e => e.tick >= cutoffTick);

			// 5. Reset daily summary
			economy.state = {
				...economy.state,
				ledger: prunedLedger,
				dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
			};
			economy.markDirty();
		},
	};
}

function checkEconomyLiveness(
	agentList: AgentActor[],
	economy: EconomyComponent,
	dayCount: number,
	deps: GameCoreDeps,
): void {
	// Starvation detection
	if (agentList.length > 0 && agentList.every(a => a.get(NeedsComponent).state.hunger === 0)) {
		deps.eventBus.emit({
			type: 'EconomyCollapsed',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DailyReportSystem',
			payload: { reason: 'all_agents_starving', dayCount },
		});
		deps.logger.warn('DailyReportSystem', `Economy collapse detected: all agents have hunger at 0 on day ${dayCount}`);
	}

	// Production stall detection
	if (economy.state.dailySummary.totalWages === 0) {
		deps.eventBus.emit({
			type: 'ProductionStalled',
			tick: deps.tickCount,
			wallClock: Date.now(),
			source: 'DailyReportSystem',
			payload: { reason: 'no_production', dayCount },
		});
		deps.logger.warn('DailyReportSystem', `Production stalled: no wages paid on day ${dayCount}`);
	}

	// Trade stall warning
	if (economy.state.dailySummary.totalSales === 0) {
		deps.logger.warn('DailyReportSystem', `No trades occurred on day ${dayCount}`);
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
		source: 'DailyReportSystem',
		payload: { dayCount, path },
	});
}
