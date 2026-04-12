import { describe, it, expect, vi } from 'vitest';
import { createRecorder } from '../../../src/infrastructure/engine/recorder.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { SnapshotData } from '../../../src/infrastructure/engine/recorder.js';

function stubSnapshot(): SnapshotData {
	return {
		tick: 100,
		day: 0,
		phase: 'dawn',
		phaseProgress: '100/480',
		economy: {
			treasury: 1000,
			agentGold: 120,
			facilityGold: 500,
			totalGold: 1620,
			velocity: 0.3,
			velocityHealth: 'healthy',
			faucetRate: 10,
			sinkRate: 5,
			netFlow: 5,
			dailySummary: {
				wages: 10, tax: 2, sales: 5, consumption: 3,
				avgWage: 3, wageSpread: 1, vacancyCount: 2,
				unemploymentCount: 1, jobSwitches: 0, supplyDeliveries: 0, questsCompleted: 0,
			},
			marketPrices: { food: 2.5 },
			stimulusActive: false,
		},
		population: {
			agentCount: 3, employedCount: 2,
			avgHunger: 70, avgEnergy: 65, avgThirst: 72, avgMood: 10, avgSleepDebt: 5,
		},
		agents: [],
		facilities: [],
		quests: [],
		goldFlows: {},
		actionDistribution: {},
		anomalies: [],
		config: {
			ticksPerDay: 480,
			phases: { dawn: { start: 0, end: 59 }, day: { start: 60, end: 299 }, dusk: { start: 300, end: 359 }, night: { start: 360, end: 479 } },
			restDayInterval: 7,
			leisureMoodThreshold: -20,
			sleepDebtMax: 100,
			treasuryRegenPerAgentPerDay: 20,
			moodWeights: { needs: 30 },
			restTiers: { owned_home: 4 },
		},
	};
}

describe('createRecorder', () => {
	it('is not recording initially', () => {
		const eventBus = createEventBus();
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: vi.fn().mockResolvedValue(undefined),
		});
		expect(recorder.isRecording()).toBe(false);
	});

	it('is recording after start()', () => {
		const eventBus = createEventBus();
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: vi.fn().mockResolvedValue(undefined),
		});
		recorder.start();
		expect(recorder.isRecording()).toBe(true);
	});

	it('captures initial snapshot on start', async () => {
		const eventBus = createEventBus();
		const writeFn = vi.fn().mockResolvedValue(undefined);
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: writeFn,
		});
		recorder.start();
		await recorder.stop();

		const content = writeFn.mock.calls[0]![1] as string;
		const lines = content.split('\n').filter(l => l.length > 0);
		// First line: initial snapshot, last line: final snapshot
		expect(lines.length).toBeGreaterThanOrEqual(2);
		const first = JSON.parse(lines[0]!);
		expect(first.record).toBe('snapshot');
		expect(first.tick).toBe(100);
	});

	it('captures all events unfiltered', async () => {
		const eventBus = createEventBus();
		const writeFn = vi.fn().mockResolvedValue(undefined);
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: writeFn,
		});
		recorder.start();

		eventBus.emit({ type: 'NeedChanged', tick: 101, wallClock: 1, source: 'NeedsSystem', payload: { agentId: 'a1' } });
		eventBus.emit({ type: 'GoldFlowed', tick: 102, wallClock: 2, source: 'TradeSystem', payload: { amount: 5 } });

		await recorder.stop();

		const content = writeFn.mock.calls[0]![1] as string;
		const lines = content.split('\n').filter(l => l.length > 0);
		const events = lines.filter(l => JSON.parse(l).record === 'event');
		expect(events).toHaveLength(2);
		expect(JSON.parse(events[0]!).type).toBe('NeedChanged');
		expect(JSON.parse(events[1]!).type).toBe('GoldFlowed');
	});

	it('inserts snapshot on DayPhaseChanged events', async () => {
		const eventBus = createEventBus();
		const writeFn = vi.fn().mockResolvedValue(undefined);
		let snapshotTick = 100;
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: () => ({ ...stubSnapshot(), tick: snapshotTick }),
			writeFile: writeFn,
		});
		recorder.start();

		// Emit a phase change
		snapshotTick = 120;
		eventBus.emit({ type: 'DayPhaseChanged', tick: 120, wallClock: 3, source: 'DayNightSystem', payload: { newPhase: 'day' } });

		await recorder.stop();

		const content = writeFn.mock.calls[0]![1] as string;
		const lines = content.split('\n').filter(l => l.length > 0);
		const snapshots = lines.filter(l => JSON.parse(l).record === 'snapshot');
		// initial + phase-change + final = 3
		expect(snapshots.length).toBeGreaterThanOrEqual(3);
	});

	it('writes to correct path with .jsonl extension', async () => {
		const eventBus = createEventBus();
		const writeFn = vi.fn().mockResolvedValue(undefined);
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: writeFn,
			dataRoot: '03 - Resources',
		});
		recorder.start();
		await recorder.stop();

		const path = writeFn.mock.calls[0]![0] as string;
		expect(path).toMatch(/^03 - Resources\/Economy\/Recordings\/recording-\d{4}-\d{2}-\d{2}-\d{4}\.jsonl$/);
	});

	it('captures final snapshot on stop', async () => {
		const eventBus = createEventBus();
		const writeFn = vi.fn().mockResolvedValue(undefined);
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: writeFn,
		});
		recorder.start();
		await recorder.stop();

		const content = writeFn.mock.calls[0]![1] as string;
		const lines = content.split('\n').filter(l => l.length > 0);
		const last = JSON.parse(lines[lines.length - 1]!);
		expect(last.record).toBe('snapshot');
	});

	it('is not recording after stop()', async () => {
		const eventBus = createEventBus();
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: vi.fn().mockResolvedValue(undefined),
		});
		recorder.start();
		await recorder.stop();
		expect(recorder.isRecording()).toBe(false);
	});

	it('does not capture events after stop()', async () => {
		const eventBus = createEventBus();
		const writeFn = vi.fn().mockResolvedValue(undefined);
		const recorder = createRecorder({
			getEventBus: () => eventBus,
			buildSnapshot: stubSnapshot,
			writeFile: writeFn,
		});
		recorder.start();
		await recorder.stop();

		// Emit after stop — should not be captured
		eventBus.emit({ type: 'LateEvent', tick: 999, wallClock: 999, source: 'test', payload: {} });

		// Start + stop again to get a fresh recording
		recorder.start();
		await recorder.stop();

		const content = writeFn.mock.calls[1]![1] as string;
		const lines = content.split('\n').filter(l => l.length > 0);
		const events = lines.filter(l => JSON.parse(l).record === 'event');
		expect(events.every(e => JSON.parse(e).type !== 'LateEvent')).toBe(true);
	});
});
