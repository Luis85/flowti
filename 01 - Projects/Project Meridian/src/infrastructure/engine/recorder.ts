import type { EventBus, GameEvent } from '../../domain/core/events.js';

export interface SnapshotData {
	tick: number;
	day: number;
	phase: string;
	phaseProgress: string;

	economy: {
		treasury: number;
		agentGold: number;
		facilityGold: number;
		totalGold: number;
		velocity: number;
		velocityHealth: string;
		faucetRate: number;
		sinkRate: number;
		netFlow: number;
		dailySummary: {
			wages: number;
			tax: number;
			sales: number;
			consumption: number;
			avgWage: number;
			wageSpread: number;
			vacancyCount: number;
			unemploymentCount: number;
			jobSwitches: number;
			supplyDeliveries: number;
			questsCompleted: number;
		};
		marketPrices: Record<string, number>;
		stimulusActive: boolean;
	};

	population: {
		agentCount: number;
		employedCount: number;
		avgHunger: number;
		avgEnergy: number;
		avgThirst: number;
		avgMood: number;
		avgSleepDebt: number;
	};

	agents: Array<{
		name: string;
		id: string;
		kind: string;
		action: string | null;
		commitment: { action: string; ticksRemaining: number } | null;
		btPath: string;
		attributes: { st: number; dx: number; iq: number; ht: number };
		traits: string[];
		position: { x: number; y: number };
		location: string | null;
		destination: string | null;
		insideFacility: boolean;
		needs: {
			hunger: { value: number; threshold: number };
			energy: { value: number; threshold: number };
			thirst: { value: number; threshold: number };
			social: { value: number };
		};
		mood: {
			value: number;
			bucket: string;
			factors: Record<string, number>;
		};
		gold: number;
		stamina: { current: number; max: number };
		sleepDebt: number;
		recovering: boolean;
		wakeOffset: number;
		sleepOffset: number;
		job: { role: string; facility: string } | null;
		unemployedTicks: number;
		knownLocations: string[];
		inventory: Array<{ item: string; quantity: number; charges?: number }>;
		priceMemory: { count: number; cheapestFood: number | null; oldestTick: number | null };
		memories: { count: number; max: number; inWindow: number; positive: number; negative: number };
		relationships: Array<{ target: string; disposition: number; familiarity: number }>;
		quests: string[];
		supplyRoutes: string[];
		hauling: string | null;
		serviceVisit: { facilityId: string; ticksRemaining: number; costPaid: boolean } | null;
	}>;

	facilities: Array<{
		name: string;
		id: string;
		type: string;
		status: string;
		fund: number;
		workerId: string | null;
		stock: Array<{ item: string; quantity: number }>;
		production: {
			output: string;
			quantity: number;
			intervalTicks: number;
			wage: number;
			job: string;
			input?: string;
		} | null;
	}>;

	quests: Array<{
		state: string;
		type: string;
		facilityId: string;
		itemId: string | null;
		quantity: number;
		reward: number;
		expiryTicksRemaining: number;
		claimedBy: string | null;
		repairProgress: number;
	}>;

	goldFlows: Record<string, { total: number; count: number }>;
	actionDistribution: Record<string, string[]>;
	anomalies: string[];

	config: {
		ticksPerDay: number;
		phases: Record<string, { start: number; end: number }>;
		restDayInterval: number;
		leisureMoodThreshold: number;
		sleepDebtMax: number;
		treasuryRegenPerAgentPerDay: number;
		moodWeights: Record<string, number>;
		restTiers: Record<string, number>;
	};
}

export interface RecorderDeps {
	getEventBus: () => EventBus;
	buildSnapshot: () => SnapshotData;
	writeFile: (path: string, content: string) => Promise<void>;
	dataRoot?: string;
}

export interface Recorder {
	start(): void;
	stop(): Promise<void>;
	isRecording(): boolean;
}

function serializeEvent(event: GameEvent): string {
	return JSON.stringify({
		record: 'event',
		tick: event.tick,
		type: event.type,
		source: event.source,
		wallClock: event.wallClock,
		payload: event.payload,
	});
}

function serializeSnapshot(data: SnapshotData): string {
	return JSON.stringify({ record: 'snapshot', ...data });
}

export function createRecorder(deps: RecorderDeps): Recorder {
	let recording = false;
	let buffer: string[] = [];
	let unsubscribe: (() => void) | null = null;
	let startedAt: Date | null = null;

	return {
		start(): void {
			if (recording) return;
			recording = true;
			buffer = [];
			startedAt = new Date();

			// Capture initial snapshot
			buffer.push(serializeSnapshot(deps.buildSnapshot()));

			// Subscribe to all events
			const eventBus = deps.getEventBus();
			unsubscribe = eventBus.onAny((event) => {
				// Always capture the event
				buffer.push(serializeEvent(event));
				// On phase change, also capture a full snapshot
				if (event.type === 'DayPhaseChanged') {
					buffer.push(serializeSnapshot(deps.buildSnapshot()));
				}
			});
		},

		async stop(): Promise<void> {
			if (!recording) return;
			recording = false;

			// Unsubscribe from events
			if (unsubscribe !== null) {
				unsubscribe();
				unsubscribe = null;
			}

			// Capture final snapshot
			buffer.push(serializeSnapshot(deps.buildSnapshot()));

			// Build filename
			const d = startedAt ?? new Date();
			const pad = (n: number): string => n.toString().padStart(2, '0');
			const filename = `recording-${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.jsonl`;
			const root = deps.dataRoot !== undefined && deps.dataRoot.length > 0 ? deps.dataRoot : '03 - Resources';
			const path = `${root}/Economy/Recordings/${filename}`;

			// Write file
			const content = buffer.join('\n');
			buffer = [];
			startedAt = null;
			await deps.writeFile(path, content);
		},

		isRecording(): boolean {
			return recording;
		},
	};
}
