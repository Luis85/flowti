# Recording System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the markdown-based recording system with a JSONL recorder that captures every event unfiltered and interleaves structured world-state snapshots at phase boundaries.

**Architecture:** New `recorder.ts` module owns the recording lifecycle (subscribe, buffer, serialize, write). The debug overlay toggles it. A new `BtEvaluated` event from the BT system provides per-tick per-agent leaf-node traces. `buildSnapshotData()` returns typed `SnapshotData` objects for structured JSON snapshots.

**Tech Stack:** TypeScript, ExcaliburJS ECS, mistreevous BT, Vitest

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-12-recording-overhaul-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: BT Leaf Extraction + BtEvaluated Event

### Task 1: Add `extractLeafNode` helper to bt-active-path.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/ui/bt-active-path.ts:15-30`
- Test: `01 - Projects/Project Meridian/tests/infrastructure/ui/bt-active-path.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/infrastructure/ui/bt-active-path.test.ts`, add a new `describe` block at the end of the file:

```typescript
describe('extractLeafNode', () => {
	it('returns the deepest RUNNING leaf', () => {
		const tree: NodeDetails = {
			name: 'ROOT', type: 'root', state: 'mistreevous.running',
			children: [{
				name: 'selector', type: 'selector', state: 'mistreevous.running',
				children: [
					{ name: 'Eat', type: 'action', state: 'mistreevous.running', children: [] },
				],
			}],
		} as unknown as NodeDetails;
		const result = extractLeafNode(tree);
		expect(result).toEqual({ name: 'Eat', state: 'RUNNING' });
	});

	it('returns the last SUCCEEDED/FAILED leaf when no RUNNING', () => {
		const tree: NodeDetails = {
			name: 'ROOT', type: 'root', state: 'mistreevous.succeeded',
			children: [{
				name: 'sequence', type: 'sequence', state: 'mistreevous.succeeded',
				children: [
					{ name: 'CheckHunger', type: 'action', state: 'mistreevous.succeeded', children: [] },
					{ name: 'Eat', type: 'action', state: 'mistreevous.failed', children: [] },
				],
			}],
		} as unknown as NodeDetails;
		const result = extractLeafNode(tree);
		expect(result).toEqual({ name: 'Eat', state: 'FAILED' });
	});

	it('returns root node when all children are READY', () => {
		const tree: NodeDetails = {
			name: 'ROOT', type: 'root', state: 'mistreevous.ready',
			children: [{
				name: 'selector', type: 'selector', state: 'mistreevous.ready',
				children: [
					{ name: 'Eat', type: 'action', state: 'mistreevous.ready', children: [] },
				],
			}],
		} as unknown as NodeDetails;
		const result = extractLeafNode(tree);
		expect(result).toEqual({ name: 'ROOT', state: 'READY' });
	});
});
```

Add the import for `extractLeafNode` alongside the existing `extractActivePath` import at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/ui/bt-active-path.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `extractLeafNode` is not exported.

- [ ] **Step 3: Implement extractLeafNode**

In `src/infrastructure/ui/bt-active-path.ts`, add this exported function after `extractActivePath`:

```typescript
/**
 * Walks the tree to the active leaf node and returns its name + normalized state.
 * Used by BehaviorTreeSystem to emit BtEvaluated events.
 */
export function extractLeafNode(details: NodeDetails): { name: string; state: string } {
	let node: NodeDetails = details;
	for (;;) {
		const next = pickNextChild(node);
		if (next === undefined) break;
		node = next;
	}
	return { name: describeNode(node), state: normalizeState(node.state) };
}
```

Also add this helper function (before `stateLabel`):

```typescript
function normalizeState(state: string): string {
	switch (state) {
		case 'mistreevous.running': return 'RUNNING';
		case 'mistreevous.succeeded': return 'SUCCEEDED';
		case 'mistreevous.failed': return 'FAILED';
		default: return 'READY';
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/ui/bt-active-path.test.ts --config configs/vitest.config.ts`
Expected: PASS — all `extractLeafNode` tests green.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/ui/bt-active-path.ts" "01 - Projects/Project Meridian/tests/infrastructure/ui/bt-active-path.test.ts"
git commit -m "feat(meridian): add extractLeafNode helper for BT tracing"
```

---

### Task 2: Emit BtEvaluated from behavior-tree-system.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts`
- Test: `01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts`

- [ ] **Step 1: Update createMockAgent factory**

In `tests/infrastructure/systems/behavior-tree-system.test.ts`, update the existing `createMockAgent()` function to include fields needed by the BtEvaluated emission. Replace the function with:

```typescript
function createMockAgent(): AgentActor {
	const stepFn = vi.fn();
	const resetFn = vi.fn();
	return {
		agentId: 'agent-test',
		behaviorAgent: {
			btAction: null as string | null,
			tickUnemployment: vi.fn(),
			committedAction: null as string | null,
			commitmentTicks: 0,
		},
		behaviorTree: {
			step: stepFn,
			reset: resetFn,
			getTreeNodeDetails: vi.fn().mockImplementation(() => { throw new Error('no tree'); }),
		},
		_stepFn: stepFn,
		_resetFn: resetFn,
	} as unknown as AgentActor & { _stepFn: ReturnType<typeof vi.fn>; _resetFn: ReturnType<typeof vi.fn> };
}
```

Key changes from the original mock:
- Added `agentId: 'agent-test'`
- Added `committedAction: null`, `commitmentTicks: 0` to `behaviorAgent`
- Added `getTreeNodeDetails` to `behaviorTree` (defaults to throwing — existing tests will trigger the catch branch and emit `BtEvaluated` with `leaf: 'unknown'`, which is correct behavior)

- [ ] **Step 2: Write the failing test**

Add these tests at the bottom of the `describe` block:

```typescript
it('emits BtEvaluated event after each agent step', () => {
	const agent = createMockAgent();
	// Override getTreeNodeDetails to return a minimal tree
	(agent.behaviorTree as Record<string, unknown>).getTreeNodeDetails = vi.fn().mockReturnValue({
		name: 'ROOT', type: 'root', state: 'mistreevous.running',
		children: [{ name: 'Eat', type: 'action', state: 'mistreevous.running', children: [] }],
	});

	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createBehaviorTreeSystem(() => [agent]);

	system.execute(deps);

	const btEvents = emitSpy.mock.calls.filter(c => c[0].type === 'BtEvaluated');
	expect(btEvents).toHaveLength(1);
	expect(btEvents[0]![0].source).toBe('BehaviorTreeSystem');
	expect(btEvents[0]![0].payload).toMatchObject({
		agentId: 'agent-test',
		leaf: 'Eat',
		leafStatus: 'RUNNING',
	});
});

it('emits BtEvaluated with unknown leaf when getTreeNodeDetails throws', () => {
	const agent = createMockAgent();
	// Default mock already throws — no override needed

	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createBehaviorTreeSystem(() => [agent]);

	system.execute(deps);

	const btEvents = emitSpy.mock.calls.filter(c => c[0].type === 'BtEvaluated');
	expect(btEvents).toHaveLength(1);
	expect(btEvents[0]![0].payload).toMatchObject({
		leaf: 'unknown',
		leafStatus: 'unknown',
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/behavior-tree-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — no BtEvaluated events emitted (implementation doesn't emit yet).

- [ ] **Step 4: Implement BtEvaluated emission**

In `src/infrastructure/systems/behavior-tree-system.ts`, replace the entire file with:

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { extractLeafNode } from '../ui/bt-active-path.js';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,
		execute(deps: GameCoreDeps): void {
			for (const agent of agents()) {
				agent.behaviorAgent.tickUnemployment();
				agent.behaviorAgent.btAction = null;
				// Always reset — forces evaluation from root every tick.
				// P-1 commitment guard catches committed agents before they re-evaluate work.
				agent.behaviorTree.reset();
				agent.behaviorTree.step();

				// Emit BT evaluation result for recording/debugging
				let leaf = 'unknown';
				let leafStatus = 'unknown';
				try {
					const details = agent.behaviorTree.getTreeNodeDetails();
					const result = extractLeafNode(details);
					leaf = result.name;
					leafStatus = result.state;
				} catch {
					// Tree may throw during initialization — use fallback values
				}
				deps.eventBus.emit({
					type: 'BtEvaluated',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'BehaviorTreeSystem',
					payload: {
						agentId: agent.agentId,
						leaf,
						leafStatus,
						action: agent.behaviorAgent.btAction,
						committedAction: agent.behaviorAgent.committedAction,
						commitmentTicks: agent.behaviorAgent.commitmentTicks,
					},
				});
			}
		},
	};
}
```

Key changes from the original:
- `_deps` renamed to `deps` (was unused, now used for `deps.eventBus` and `deps.tickCount`)
- Import `extractLeafNode` from `../ui/bt-active-path.js`
- After `step()`, try/catch `getTreeNodeDetails()` + `extractLeafNode()`, then emit `BtEvaluated`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/behavior-tree-system.test.ts --config configs/vitest.config.ts`
Expected: PASS — all tests including new BtEvaluated tests green.

- [ ] **Step 6: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts"
git commit -m "feat(meridian): emit BtEvaluated event per agent per tick from BT system"
```

---

## Chunk 2: Recorder Module

### Task 3: Create recorder.ts with SnapshotData type and createRecorder

**Files:**
- Create: `01 - Projects/Project Meridian/src/infrastructure/engine/recorder.ts`
- Create: `01 - Projects/Project Meridian/tests/infrastructure/engine/recorder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/infrastructure/engine/recorder.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/recorder.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `recorder.ts` does not exist.

- [ ] **Step 3: Implement recorder.ts**

Create `src/infrastructure/engine/recorder.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/recorder.test.ts --config configs/vitest.config.ts`
Expected: PASS — all recorder tests green.

- [ ] **Step 5: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/recorder.ts" "01 - Projects/Project Meridian/tests/infrastructure/engine/recorder.test.ts"
git commit -m "feat(meridian): add JSONL recorder module with SnapshotData type"
```

---

## Chunk 3: Snapshot Data Builder

### Task 4: Add buildSnapshotData function to debug-overlay.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts`

This function parallels the existing `buildDiagnosticSnapshot` but returns structured `SnapshotData` instead of a markdown string. It reads the same ECS components and reuses the same data extraction logic.

- [ ] **Step 1: Add import for SnapshotData**

At the top of `debug-overlay.ts`, add after the existing imports (around line 24):

```typescript
import type { SnapshotData } from './recorder.js';
```

- [ ] **Step 2: Add buildSnapshotData function**

Add this function before the `createDebugOverlay` export (before line 1093). This is a large function that extracts structured data from ECS components. It reuses the same component reads as `buildDiagnosticSnapshot` but returns typed objects.

```typescript
function buildSnapshotData(deps: OverlayDeps): SnapshotData {
	const world = deps.getWorldEntity();
	const agents = deps.getAgents();
	const locations = deps.getLocations();
	const locationActors = deps.getLocationActors();
	const tick = deps.getTickCount();
	const ticksPerDay = deps.getTicksPerDay?.() ?? 480;
	const time = world.get(TimeComponent);
	const economy = world.get(EconomyComponent);
	const velocity = economy.state.monetarySnapshot?.velocity ?? 0;
	const config = deps.getConfig?.();
	const locationMap = new Map(locations.map(l => [l.id, l]));
	const facilityTypes = deps.getFacilityTypeRegistry?.();
	const recipes = deps.getRecipeRegistry?.();

	// Economy totals
	let totalAgentGold = 0;
	let totalFacilityGold = 0;
	for (const a of agents) totalAgentGold += a.get(WalletComponent).state.gold;
	for (const loc of locations) {
		const la = locationActors.get(loc.id);
		if (la?.has(FacilityComponent) === true) totalFacilityGold += la.get(FacilityComponent).state.fund;
	}

	// Market prices
	const marketPrices: Record<string, number> = {};
	const marketLoc = locations.find(l => l.facility_type === 'market_stall');
	if (marketLoc !== undefined) {
		const ma = locationActors.get(marketLoc.id);
		if (ma?.has(FacilityComponent) === true) {
			const prices = ma.get(FacilityComponent).state.currentPrices ?? {};
			for (const [id, p] of Object.entries(prices)) marketPrices[id] = Number(p);
		}
	}

	// Daily summary
	const ds = economy.state.dailySummary;

	// Monetary snapshot
	const ms = economy.state.monetarySnapshot;

	// Gold flows (today only)
	const goldFlows: Record<string, { total: number; count: number }> = {};
	const dayStartTick = tick - time.state.tickInCycle;
	const todayLedger = economy.state.ledger.filter(e => e.tick >= dayStartTick);
	for (const entry of todayLedger) {
		const existing = goldFlows[entry.type];
		if (existing !== undefined) {
			existing.total += entry.gold;
			existing.count += 1;
		} else {
			goldFlows[entry.type] = { total: entry.gold, count: 1 };
		}
	}

	// Action distribution
	const actionDistribution: Record<string, string[]> = {};
	for (const agent of agents) {
		const action = agent.behaviorAgent.btAction ?? 'idle';
		const existing = actionDistribution[action];
		if (existing !== undefined) {
			existing.push(agent.agentName);
		} else {
			actionDistribution[action] = [agent.agentName];
		}
	}

	// Anomalies — reuse the existing detectAnomalies function, parse its markdown output
	const questBoard = world.has(QuestBoardComponent) ? world.get(QuestBoardComponent).state : null;
	const { agentsByAction } = buildActionDistribution(agents);
	const anomalySection = detectAnomalies(agents, economy, locations, locationActors, world, tick, economy.state.treasury + totalAgentGold + totalFacilityGold, config, velocity, agentsByAction, facilityTypes);
	const anomalies = anomalySection.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));

	// Agents
	const agentData = agents.map(agent => {
		const needs = agent.get(NeedsComponent).state;
		const wallet = agent.get(WalletComponent).state;
		const mood = agent.get(MoodComponent).state;
		const stamina = agent.get(StaminaComponent).state;
		const inv = agent.get(InventoryComponent).state;
		const ba = agent.behaviorAgent;
		const loc = ba.atLocation;
		const target = ba.movementTarget;

		// BT path
		let btPath = '';
		try {
			const nodeDetails = agent.behaviorTree.getTreeNodeDetails();
			btPath = extractActivePath(nodeDetails);
		} catch { /* skip */ }

		// Job + facility
		const jobFacility = locations.find(l => {
			const la = locationActors.get(l.id);
			return la?.has(FacilityComponent) === true && la.get(FacilityComponent).state.workerId === agent.agentId;
		});

		// Price memory
		let cheapestFood: number | null = null;
		let oldestTick: number | null = null;
		for (const pm of ba.priceMemories) {
			if (oldestTick === null || pm.tick < oldestTick) oldestTick = pm.tick;
			if (pm.itemId === 'food' && (cheapestFood === null || pm.price < cheapestFood)) {
				cheapestFood = pm.price;
			}
		}

		// Memories
		const memComponent = agent.has(MemoryComponent) ? agent.get(MemoryComponent) : null;
		const memEntries = memComponent?.state.entries ?? [];
		const windowTicks = config?.mood.memory_window_ticks ?? 50;
		const inWindow = memEntries.filter(m => m.tick >= tick - windowTicks);

		// Relationships
		const relEntries = agent.has(RelationshipComponent) ? agent.get(RelationshipComponent).state.entries : [];

		return {
			name: agent.agentName,
			id: agent.agentId,
			kind: agent.kind,
			action: ba.btAction,
			commitment: ba.commitmentTicks > 0 ? { action: ba.committedAction ?? 'unknown', ticksRemaining: ba.commitmentTicks } : null,
			btPath,
			attributes: { st: agent.get(AttributesComponent).state.ST, dx: agent.get(AttributesComponent).state.DX, iq: agent.get(AttributesComponent).state.IQ, ht: agent.get(AttributesComponent).state.HT },
			traits: agent.has(TraitsComponent) ? agent.get(TraitsComponent).traitIds : [],
			position: { x: Math.round(agent.pos.x), y: Math.round(agent.pos.y) },
			location: loc,
			destination: target?.id ?? null,
			insideFacility: ba.insideFacility,
			needs: {
				hunger: { value: needs.hunger, threshold: ba.personalThresholds.hunger },
				energy: { value: needs.energy, threshold: ba.personalThresholds.energy },
				thirst: { value: needs.thirst, threshold: ba.personalThresholds.thirst },
				social: { value: needs.social },
			},
			mood: {
				value: mood.value,
				bucket: mood.bucket,
				factors: mood.factors !== undefined ? {
					needs: mood.factors.needs,
					positiveMemories: mood.factors.positiveMemories,
					negativeMemories: mood.factors.negativeMemories,
					goalProgress: mood.factors.goalProgress,
					walletHealth: mood.factors.walletHealth,
					equipmentCondition: mood.factors.equipmentCondition,
					relationshipQuality: mood.factors.relationshipQuality,
				} : {},
			},
			gold: wallet.gold,
			stamina: { current: stamina.current, max: stamina.max },
			sleepDebt: ba.sleepDebt,
			recovering: ba.recovering,
			wakeOffset: ba.wakeOffset,
			sleepOffset: ba.sleepOffset,
			job: agent.job !== null ? { role: agent.job, facility: jobFacility?.name ?? 'unassigned' } : null,
			unemployedTicks: ba.unemployedTicks,
			knownLocations: [...ba.knownLocations],
			inventory: inv.items.map(i => ({ item: i.item_id, quantity: i.quantity, ...(i.charges !== undefined ? { charges: i.charges } : {}) })),
			priceMemory: { count: ba.priceMemories.size, cheapestFood, oldestTick },
			memories: {
				count: memEntries.length,
				max: memComponent?.state.maxEntries ?? 0,
				inWindow: inWindow.length,
				positive: inWindow.filter(m => m.outcome === 'positive').length,
				negative: inWindow.filter(m => m.outcome === 'negative').length,
			},
			relationships: relEntries.map(r => ({ target: r.agentId, disposition: r.disposition, familiarity: r.familiarity })),
			quests: ba.activeQuest !== null ? [ba.activeQuest.type] : [],
			supplyRoutes: ba.supplyRoute !== null ? [`${ba.supplyRoute.sourceId} → ${ba.supplyRoute.destinationId}`] : [],
			hauling: ba.haulCargo !== null ? `${ba.haulCargo.itemId}x${ba.haulCargo.quantity}` : null,
			serviceVisit: ba.currentServiceVisit,
		};
	});

	// Facilities
	const facilityData = locations
		.filter(loc => {
			const la = locationActors.get(loc.id);
			return la?.has(FacilityComponent) === true;
		})
		.map(loc => {
			const la = locationActors.get(loc.id)!;
			const fac = la.get(FacilityComponent);
			const ft = facilityTypes?.get(loc.facility_type);
			const recipe = loc.active_recipe !== null ? recipes?.get(loc.active_recipe) : undefined;
			const isProduction = ft?.kind === 'production' && recipe !== undefined;

			return {
				name: loc.name,
				id: loc.id,
				type: loc.facility_type,
				status: fac.state.status,
				fund: fac.state.fund,
				workerId: fac.state.workerId,
				stock: fac.state.stock.map(s => ({ item: s.item_id, quantity: s.quantity })),
				production: isProduction && recipe !== undefined ? {
					output: recipe.outputs.map(o => o.item_id).join(', '),
					quantity: recipe.outputs.reduce((s, o) => s + o.quantity, 0),
					intervalTicks: recipe.ticks_per_cycle,
					wage: (ft as Extract<typeof ft, { kind: 'production' }>).default_wage,
					job: (ft as Extract<typeof ft, { kind: 'production' }>).primary_job,
					...(recipe.inputs.length > 0 ? { input: recipe.inputs.map(i => `${i.item_id}x${i.quantity}`).join(', ') } : {}),
				} : null,
			};
		});

	// Quests
	const questData = questBoard !== null ? questBoard.quests.map(q => ({
		state: q.state,
		type: q.type,
		facilityId: q.facilityId,
		itemId: q.itemId,
		quantity: q.quantity,
		reward: q.reward,
		expiryTicksRemaining: Math.max(0, q.expiryTicks - (tick - q.createdTick)),
		claimedBy: q.claimedBy,
		repairProgress: q.repairProgress,
	})) : [];

	// Config
	const configData = config !== undefined ? {
		ticksPerDay: config.ticks_per_day,
		phases: {
			dawn: { start: config.day_night.dawn.start, end: config.day_night.dawn.end },
			day: { start: config.day_night.day.start, end: config.day_night.day.end },
			dusk: { start: config.day_night.dusk.start, end: config.day_night.dusk.end },
			night: { start: config.day_night.night.start, end: config.day_night.night.end },
		},
		restDayInterval: config.rest_day_interval,
		leisureMoodThreshold: config.leisure_mood_threshold,
		sleepDebtMax: config.sleep_debt_max,
		treasuryRegenPerAgentPerDay: config.economy.treasury_regen_per_agent_per_day,
		moodWeights: config.mood.factor_weights,
		restTiers: {
			owned_home: config.rest_tiers.owned_home.recovery_rate,
			public_shelter: config.rest_tiers.public_shelter.recovery_rate,
			outdoors: config.rest_tiers.outdoors.recovery_rate,
		},
	} : {
		ticksPerDay,
		phases: {},
		restDayInterval: 7,
		leisureMoodThreshold: -20,
		sleepDebtMax: 100,
		treasuryRegenPerAgentPerDay: 20,
		moodWeights: {},
		restTiers: {},
	};

	return {
		tick,
		day: time.state.dayCount,
		phase: time.state.phase,
		phaseProgress: `${time.state.tickInCycle}/${ticksPerDay}`,
		economy: {
			treasury: economy.state.treasury,
			agentGold: totalAgentGold,
			facilityGold: totalFacilityGold,
			totalGold: economy.state.treasury + totalAgentGold + totalFacilityGold,
			velocity,
			velocityHealth: velocity > 0.2 ? 'healthy' : velocity > 0 ? 'slow' : 'stalled',
			faucetRate: ms?.faucetRate ?? 0,
			sinkRate: ms?.sinkRate ?? 0,
			netFlow: ms?.netFlow ?? 0,
			dailySummary: {
				wages: ds.totalWages,
				tax: ds.totalTax,
				sales: ds.totalSales,
				consumption: ds.totalConsumption,
				avgWage: ds.avgWage,
				wageSpread: ds.wageSpread,
				vacancyCount: ds.vacancyCount,
				unemploymentCount: ds.unemploymentCount,
				jobSwitches: ds.jobSwitchesThisDay,
				supplyDeliveries: ds.supplyDeliveries,
				questsCompleted: ds.questsCompletedThisDay,
			},
			marketPrices,
			stimulusActive: velocity < 0.2,
		},
		population: {
			agentCount: agents.length,
			employedCount: agents.filter(a => a.job !== null).length,
			avgHunger: agents.length > 0 ? agents.reduce((s, a) => s + a.get(NeedsComponent).state.hunger, 0) / agents.length : 0,
			avgEnergy: agents.length > 0 ? agents.reduce((s, a) => s + a.get(NeedsComponent).state.energy, 0) / agents.length : 0,
			avgThirst: agents.length > 0 ? agents.reduce((s, a) => s + a.get(NeedsComponent).state.thirst, 0) / agents.length : 0,
			avgMood: agents.length > 0 ? agents.reduce((s, a) => s + a.get(MoodComponent).state.value, 0) / agents.length : 0,
			avgSleepDebt: agents.length > 0 ? agents.reduce((s, a) => s + a.behaviorAgent.sleepDebt, 0) / agents.length : 0,
		},
		agents: agentData,
		facilities: facilityData,
		quests: questData,
		goldFlows,
		actionDistribution,
		anomalies,
		config: configData,
	};
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean. This validates that `buildSnapshotData` correctly returns `SnapshotData` and all field accesses match the ECS component shapes.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "feat(meridian): add buildSnapshotData for structured JSONL snapshots"
```

---

## Chunk 4: Integration + Cleanup

### Task 5: Wire recorder into debug-overlay.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts`

Replace the inline recording logic with the recorder module.

- [ ] **Step 1: Add import for createRecorder**

At the top of `debug-overlay.ts`, add alongside the `SnapshotData` import:

```typescript
import { createRecorder } from './recorder.js';
```

(If you added `import type { SnapshotData }` in Task 4, keep it but also add this runtime import.)

- [ ] **Step 2: Replace recording state variables**

In `createDebugOverlay`, find the recording state block (around lines 1122-1126):

```typescript
	let isRecording = false;
	let isWriting = false;
	let recordingBuffer: string[] = [];
	let recordingUnsubscribe: (() => void) | null = null;
	let recordingStartedAt: Date | null = null;
```

Replace with:

```typescript
	const recorder = deps.getEventBus !== undefined && deps.writeFile !== undefined
		? createRecorder({
			getEventBus: deps.getEventBus!,
			buildSnapshot: () => buildSnapshotData(deps),
			writeFile: deps.writeFile!,
			dataRoot: deps.dataRoot,
		})
		: null;
```

- [ ] **Step 3: Replace menu record action handler**

Find the `if (action === 'record')` block in the click handler (around lines 1253-1315). Replace the entire block with:

```typescript
			if (action === 'record') {
				if (recorder === null) {
					showToast('❌ Unavailable');
					return;
				}
				if (recorder.isRecording()) {
					// Stop recording
					showToast('⏳ Saving...');
					void recorder.stop().then(() => {
						showToast('✅ Saved');
					}).catch(() => {
						showToast('❌ Save failed');
					});
				} else {
					// Start recording
					recorder.start();
					showToast('● Recording started');
				}
				return;
			}
```

- [ ] **Step 4: Update renderMenu to use recorder**

Find `renderMenu()` (around line 1163). It references the deleted `isRecording` variable:

```typescript
const recordLabel = isRecording ? '⏹ Stop recording' : '⏺ Start recording';
```

Replace with:

```typescript
const recordLabel = recorder?.isRecording() === true ? '⏹ Stop recording' : '⏺ Start recording';
```

- [ ] **Step 6: Update the isRecording reference in renderTabBar call**

Find where `renderTabBar` is called (around line 1488):

```typescript
contentEl.appendChild(range.createContextualFragment(`${header}<br>${renderTabBar(activePanel, hasAnomaly, isRecording)}${body}`));
```

Replace `isRecording` with:

```typescript
contentEl.appendChild(range.createContextualFragment(`${header}<br>${renderTabBar(activePanel, hasAnomaly, recorder?.isRecording() ?? false)}${body}`));
```

- [ ] **Step 7: Update dispose to use recorder**

Find the dispose function (around lines 1496-1520). Replace the recording cleanup block:

```typescript
			if (recordingUnsubscribe !== null) {
				if (isRecording && recordingBuffer.length > 0) {
					console.warn(`[Meridian] Debug overlay disposed while recording — ${String(recordingBuffer.length)} snapshot(s) discarded`);
				}
				recordingUnsubscribe();
				recordingUnsubscribe = null;
			}
```

With:

```typescript
			if (recorder?.isRecording() === true) {
				// Fire-and-forget — best-effort save on dispose
				void recorder.stop().catch(() => {});
			}
```

- [ ] **Step 8: Remove `isWriting` variable**

Search for any remaining references to `isWriting` in the function and remove them. It was only used in the old recording logic.

- [ ] **Step 9: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "feat(meridian): wire JSONL recorder into debug overlay, remove inline recording"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Build**

Run: `cd "01 - Projects/Project Meridian" && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit any remaining fixes**

If any tests or typecheck issues were found and fixed, commit them.

```bash
git add -A "01 - Projects/Project Meridian/"
git commit -m "fix(meridian): resolve issues from recording overhaul final verification"
```

(Skip this step if no fixes were needed.)
