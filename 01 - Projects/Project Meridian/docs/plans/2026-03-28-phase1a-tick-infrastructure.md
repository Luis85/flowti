# Phase 1A: Tick Infrastructure + ECS Components — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the tick loop, ECS component foundations, GameCoreDeps wiring, and EventBus batching — everything Phase 1B game systems need to run on.

**Architecture:** Domain defines contracts (TickScheduler, GameSystem, GameCoreDeps, component data interfaces). Infrastructure implements with ExcaliburJS integration (tick runner, tick system, tracked components). One ExcaliburJS System hosts the fixed-timestep accumulator; game systems are plain objects dispatched at 2Hz.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, System), Vitest, ESLint (63 rules on src, 27 on tests)

**Design Spec:** `docs/specs/2026-03-28-phase1a-tick-infrastructure-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`tick-runner.ts`, `tick-runner.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore` (one existing exception in `withDefaults()`)
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **Coverage target:** 80% statements, 80% lines
- **ESLint:** Run `npx eslint src/ tests/ --config configs/eslint.config.mjs` — must pass with 0 errors
- **TypeScript:** Run `npx tsc --noEmit --project configs/tsconfig.json` — must pass with 0 errors
- **Full test:** Run `npx vitest run --config configs/vitest.config.ts` — all tests must pass

---

## Chunk A: Domain Interfaces

### Task A1: GameCoreDeps Interface

**Files:**
- Create: `src/domain/core/game-deps.ts`

- [ ] **Step 1: Create GameCoreDeps interface**

```typescript
// src/domain/core/game-deps.ts
import type { Logger } from './logger.js';
import type { EventBus } from './events.js';
import type { GameConfig } from '../schemas/game-config-schema.js';
import type { PerformanceTracker } from '../../infrastructure/performance/performance-tracker.js';

export interface GameCoreDeps {
	readonly logger: Logger;
	readonly eventBus: EventBus;
	readonly config: GameConfig;
	readonly performanceTracker: PerformanceTracker;
	/** Current tick number — set by the tick runner before system execution each tick */
	tickCount: number;
}
```

**Wait** — `PerformanceTracker` is in infrastructure. Domain must not import infrastructure. The `PerformanceTracker` interface should be extracted to domain or `GameCoreDeps` should reference an abstraction.

Check: `PerformanceTracker` is already defined as an **interface** in `src/infrastructure/performance/performance-tracker.ts`. The interface itself is pure (no ExcaliburJS deps). Move the interface to domain, keep the implementation in infrastructure.

- [ ] **Step 2: Extract PerformanceTracker interface to domain**

Create `src/domain/core/performance.ts`:

```typescript
// src/domain/core/performance.ts
export interface PerformanceTracker {
	readonly enabled: boolean;
	setEnabled(enabled: boolean): void;
	startSystem(name: string): void;
	endSystem(): void;
	completeTick(tick: number): TickPerformance | null;
	history(limit?: number): TickPerformance[];
	averages(ticks?: number): Map<string, number>;
}

export interface TickPerformance {
	tick: number;
	totalMs: number;
	systems: SystemTiming[];
}

export interface SystemTiming {
	name: string;
	durationMs: number;
}
```

Then update `src/infrastructure/performance/performance-tracker.ts` to import the interface from domain:

```typescript
// src/infrastructure/performance/performance-tracker.ts
import type { Logger } from '../../domain/core/logger.js';
import type { PerformanceTracker, TickPerformance, SystemTiming } from '../../domain/core/performance.js';
export type { PerformanceTracker, TickPerformance, SystemTiming };
// ... rest unchanged, remove the local interface/type declarations
```

Update `src/plugin.ts` import:

```typescript
// Change:
import type { PerformanceTracker } from './infrastructure/performance/performance-tracker.js';
// To:
import type { PerformanceTracker } from './domain/core/performance.js';
```

- [ ] **Step 3: Create GameCoreDeps interface (now with domain-only imports)**

```typescript
// src/domain/core/game-deps.ts
import type { Logger } from './logger.js';
import type { EventBus } from './events.js';
import type { GameConfig } from '../schemas/game-config-schema.js';
import type { PerformanceTracker } from './performance.js';

export interface GameCoreDeps {
	readonly logger: Logger;
	readonly eventBus: EventBus;
	readonly config: GameConfig;
	readonly performanceTracker: PerformanceTracker;
	/** Current tick number — set by the tick runner before system execution each tick */
	tickCount: number;
}
```

- [ ] **Step 4: Run typecheck and lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors. All existing tests still pass.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: 110 tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/game-deps.ts" "01 - Projects/Project Meridian/src/domain/core/performance.ts" "01 - Projects/Project Meridian/src/infrastructure/performance/performance-tracker.ts" "01 - Projects/Project Meridian/src/plugin.ts"
git commit -m "feat(meridian): GameCoreDeps interface + extract PerformanceTracker to domain"
```

---

### Task A2: TickScheduler Interface + SystemPriority Constants

**Files:**
- Create: `src/domain/core/tick-scheduler.ts`

- [ ] **Step 1: Create TickScheduler and GameSystem interfaces**

```typescript
// src/domain/core/tick-scheduler.ts
import type { GameCoreDeps } from './game-deps.js';

export interface GameSystem {
	readonly name: string;
	readonly priority: number;
	execute(deps: GameCoreDeps): void;
}

export interface TickScheduler {
	register(system: GameSystem): void;
	tick(deps: GameCoreDeps): void;
	readonly tickCount: number;
}

export const SystemPriority = {
	TRAIT_RESOLVER: 0.5,
	DAY_NIGHT: 0.7,
	NEEDS_DECAY: 1,
	MOOD: 2,
	PERCEPTION: 3,
	MEMORY: 4,
	BEHAVIOR_TREE: 5,
	MOVEMENT: 5.5,
	JOB: 6,
	QUEST_EVALUATION: 7,
	OBJECT_INTERACTION: 8,
	TOOL_EXECUTION: 9,
	CONSTRUCTION: 10,
	TRADE: 11,
	DIALOGUE: 12,
	PROGRESSION: 13,
	RELATIONSHIP: 14,
	MORTALITY_CHECK: 14.5,
	ITEM_DURABILITY: 15,
	ECONOMY: 16,
	WORLD_EVENT: 17,
	SEASON: 17.5,
	NOTIFICATION: 18,
	CHRONICLER: 18.5,
	SCENARIO: 18.7,
	ABANDONMENT: 18.8,
	VAULT_SYNC: 19,
	UI_BRIDGE: 20,
} as const;
```

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts"
git commit -m "feat(meridian): TickScheduler + GameSystem interfaces with SystemPriority constants"
```

---

### Task A3: Component Data Interfaces

**Files:**
- Create: `src/domain/core/component-data.ts`

- [ ] **Step 1: Create component data interfaces**

```typescript
// src/domain/core/component-data.ts

export interface NeedsState {
	hunger: number;
	energy: number;
	social: number;
}

export interface MoodState {
	value: number;
	bucket: string;
}

export interface MemoryEntry {
	tick: number;
	type: string;
	description: string;
	participants: string[];
	outcome: 'positive' | 'negative' | 'neutral';
	significance: number;
	mood_impact: number;
	original_significance?: number;
}

export interface MemoryState {
	entries: MemoryEntry[];
	maxEntries: number;
}

export interface BlackboardState {
	[key: string]: unknown;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts"
git commit -m "feat(meridian): component data interfaces (NeedsState, MoodState, MemoryState, BlackboardState)"
```

---

## Chunk B: EventBus Batching

### Task B1: Add BatchableEventBus + Batching Implementation

**Files:**
- Modify: `src/infrastructure/event-bus.ts`
- Create: `src/infrastructure/engine/batchable-event-bus.ts` (interface only)
- Modify: `tests/infrastructure/event-bus.test.ts` (add batching tests)

- [ ] **Step 1: Write failing tests for batching**

Add to `tests/infrastructure/event-bus.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import type { GameEvent } from '../../src/domain/core/events.js';

// ... existing tests ...

describe('EventBus batching', () => {
	it('queues events during batch mode instead of dispatching', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('Test', handler);

		bus.beginBatch();
		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });

		expect(handler).not.toHaveBeenCalled();
	});

	it('delivers all queued events on flushBatch in order', () => {
		const bus = createEventBus();
		const received: number[] = [];
		bus.on('Seq', (e) => received.push(e.tick));

		bus.beginBatch();
		bus.emit({ type: 'Seq', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'Seq', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'Seq', tick: 3, wallClock: Date.now(), source: 's', payload: {} });
		bus.flushBatch();

		expect(received).toEqual([1, 2, 3]);
	});

	it('dispatches immediately when not in batch mode (regression)', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('Test', handler);

		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledOnce();
	});

	it('events emitted during flushBatch handler execute immediately', () => {
		const bus = createEventBus();
		const order: string[] = [];

		bus.on('First', () => {
			order.push('first-handler');
			bus.emit({ type: 'Reactive', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		});
		bus.on('Reactive', () => order.push('reactive-handler'));

		bus.beginBatch();
		bus.emit({ type: 'First', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.flushBatch();

		expect(order).toEqual(['first-handler', 'reactive-handler']);
	});

	it('beginBatch + flushBatch with no events is a no-op', () => {
		const bus = createEventBus();
		expect(() => {
			bus.beginBatch();
			bus.flushBatch();
		}).not.toThrow();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/event-bus.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `beginBatch` is not a function.

- [ ] **Step 3: Create BatchableEventBus interface**

```typescript
// src/infrastructure/engine/batchable-event-bus.ts
import type { EventBus } from '../../domain/core/events.js';

export interface BatchableEventBus extends EventBus {
	beginBatch(): void;
	flushBatch(): void;
}
```

- [ ] **Step 4: Update createEventBus to return BatchableEventBus**

Modify `src/infrastructure/event-bus.ts`:

```typescript
import type { GameEvent, EventHandler, EventBus, Unsubscribe, EventFilter } from '../domain/core/events.js';
import type { BatchableEventBus } from './engine/batchable-event-bus.js';

/**
 * EventBus implementation with priority ordering, history, filter, and batching support.
 *
 * Batching: when beginBatch() is called, emit() queues events instead of dispatching.
 * flushBatch() delivers all queued events and returns to immediate mode.
 * The tick runner uses this to deliver events between system executions.
 */

interface PrioritizedHandler {
	handler: EventHandler;
	priority: number;
}

const HISTORY_MAX = 500;

export function createEventBus(): BatchableEventBus {
	const handlers = new Map<string, PrioritizedHandler[]>();
	const anyHandlers: PrioritizedHandler[] = [];
	const eventHistory: GameEvent[] = [];
	let batching = false;
	let batchQueue: GameEvent[] = [];

	function addHandler(map: Map<string, PrioritizedHandler[]>, type: string, handler: EventHandler, priority: number): void {
		const existing = map.get(type);
		const list = existing ?? [];
		if (existing === undefined) map.set(type, list);
		list.push({ handler, priority });
		list.sort((a, b) => a.priority - b.priority);
	}

	function dispatch(event: GameEvent): void {
		const typed = handlers.get(event.type);
		if (typed !== undefined) {
			for (const { handler } of typed) handler(event);
		}
		for (const { handler } of anyHandlers) handler(event);
	}

	return {
		emit(event: GameEvent): void {
			eventHistory.push(event);
			if (eventHistory.length > HISTORY_MAX) eventHistory.shift();

			if (batching) {
				batchQueue.push(event);
			} else {
				dispatch(event);
			}
		},

		on(type: string, handler: EventHandler, priority = 100): Unsubscribe {
			addHandler(handlers, type, handler, priority);
			return () => {
				const list = handlers.get(type);
				if (list !== undefined) {
					const idx = list.findIndex((h) => h.handler === handler);
					if (idx >= 0) list.splice(idx, 1);
				}
			};
		},

		off(type: string, handler: EventHandler): void {
			const list = handlers.get(type);
			if (list !== undefined) {
				const idx = list.findIndex((h) => h.handler === handler);
				if (idx >= 0) list.splice(idx, 1);
			}
		},

		onAny(handler: EventHandler): Unsubscribe {
			const entry: PrioritizedHandler = { handler, priority: 100 };
			anyHandlers.push(entry);
			return () => {
				const idx = anyHandlers.indexOf(entry);
				if (idx >= 0) anyHandlers.splice(idx, 1);
			};
		},

		filter(predicate: EventFilter, handler: EventHandler): Unsubscribe {
			const wrappedHandler: EventHandler = (event) => {
				if (predicate(event)) handler(event);
			};
			const entry: PrioritizedHandler = { handler: wrappedHandler, priority: 100 };
			anyHandlers.push(entry);
			return () => {
				const idx = anyHandlers.indexOf(entry);
				if (idx >= 0) anyHandlers.splice(idx, 1);
			};
		},

		history(filter?: { type?: string; source?: string; limit?: number }): GameEvent[] {
			let results = [...eventHistory];
			if (filter?.type !== undefined) results = results.filter((e) => e.type === filter.type);
			if (filter?.source !== undefined) results = results.filter((e) => e.source === filter.source);
			if (filter?.limit !== undefined) results = results.slice(-filter.limit);
			return results;
		},

		beginBatch(): void {
			batching = true;
			batchQueue = [];
		},

		flushBatch(): void {
			batching = false;
			const queued = batchQueue;
			batchQueue = [];
			for (const event of queued) {
				dispatch(event);
			}
		},
	};
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/event-bus.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (existing 17 + 5 new = 22 tests).

- [ ] **Step 6: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, 0 warnings, all 115 tests pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/event-bus.ts" "01 - Projects/Project Meridian/src/infrastructure/engine/batchable-event-bus.ts" "01 - Projects/Project Meridian/tests/infrastructure/event-bus.test.ts"
git commit -m "feat(meridian): EventBus batching — beginBatch/flushBatch for inter-system event delivery"
```

---

## Chunk C: Tick Runner

### Task C1: Tick Runner Implementation

**Files:**
- Create: `src/infrastructure/engine/tick-runner.ts`
- Create: `tests/infrastructure/engine/tick-runner.test.ts`

- [ ] **Step 1: Write failing tests for tick runner**

```typescript
// tests/infrastructure/engine/tick-runner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTickRunner } from '../../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { SystemPriority } from '../../../src/domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameSystem } from '../../../src/domain/core/tick-scheduler.js';

function createTestDeps(): { deps: GameCoreDeps; eventBus: ReturnType<typeof createEventBus> } {
	const eventBus = createEventBus();
	const deps: GameCoreDeps = {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 0,
	};
	return { deps, eventBus };
}

function createMockSystem(name: string, priority: number, fn?: (deps: GameCoreDeps) => void): GameSystem {
	return { name, priority, execute: fn ?? (() => {}) };
}

describe('TickRunner', () => {
	it('executes systems in priority order', () => {
		const order: string[] = [];
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('B', 10, () => order.push('B')));
		runner.register(createMockSystem('A', 1, () => order.push('A')));
		runner.register(createMockSystem('C', 20, () => order.push('C')));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(order).toEqual(['A', 'B', 'C']);
	});

	it('increments tickCount after all systems complete', () => {
		const runner = createTickRunner(createEventBus());
		const { deps } = createTestDeps();

		expect(runner.tickCount).toBe(0);
		runner.tick(deps);
		expect(runner.tickCount).toBe(1);
		runner.tick(deps);
		expect(runner.tickCount).toBe(2);
	});

	it('sets deps.tickCount to current tick before systems execute', () => {
		let capturedTick = -1;
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('Capture', 1, (d) => { capturedTick = d.tickCount; }));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(capturedTick).toBe(1);
	});

	it('skips failing system and continues with next', () => {
		const order: string[] = [];
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('Good1', 1, () => order.push('Good1')));
		runner.register(createMockSystem('Bad', 2, () => { throw new Error('boom'); }));
		runner.register(createMockSystem('Good2', 3, () => order.push('Good2')));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(order).toEqual(['Good1', 'Good2']);
	});

	it('calls beginBatch/flushBatch around each system', () => {
		const eventBus = createEventBus();
		const beginSpy = vi.spyOn(eventBus, 'beginBatch');
		const flushSpy = vi.spyOn(eventBus, 'flushBatch');

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('A', 1));
		runner.register(createMockSystem('B', 2));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(beginSpy).toHaveBeenCalledTimes(2);
		expect(flushSpy).toHaveBeenCalledTimes(2);
	});

	it('flushBatch still called after system failure (finally block)', () => {
		const eventBus = createEventBus();
		const flushSpy = vi.spyOn(eventBus, 'flushBatch');

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Fail', 1, () => { throw new Error('boom'); }));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(flushSpy).toHaveBeenCalledOnce();
	});

	it('records performance timing when enabled', () => {
		const eventBus = createEventBus();
		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Sys', 1));

		const { deps } = createTestDeps();
		deps.performanceTracker.setEnabled(true);
		runner.tick(deps);

		const history = deps.performanceTracker.history();
		expect(history).toHaveLength(1);
		expect(history[0]?.systems[0]?.name).toBe('Sys');
	});

	it('handles empty runner with no systems', () => {
		const runner = createTickRunner(createEventBus());
		const { deps } = createTestDeps();
		expect(() => runner.tick(deps)).not.toThrow();
		expect(runner.tickCount).toBe(1);
	});

	it('delivers events from system A to system B via batch flush', () => {
		const eventBus = createEventBus();
		let received = false;

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Emitter', 1, (d) => {
			d.eventBus.emit({ type: 'TestEvent', tick: d.tickCount, wallClock: Date.now(), source: 'Emitter', payload: {} });
		}));
		runner.register(createMockSystem('Receiver', 2, () => {}));

		eventBus.on('TestEvent', () => { received = true; });

		const { deps } = createTestDeps();
		deps.eventBus = eventBus;
		runner.tick(deps);

		expect(received).toBe(true);
	});

	it('SystemPriority constants match GDD numbering', () => {
		expect(SystemPriority.NEEDS_DECAY).toBe(1);
		expect(SystemPriority.MOOD).toBe(2);
		expect(SystemPriority.BEHAVIOR_TREE).toBe(5);
		expect(SystemPriority.VAULT_SYNC).toBe(19);
		expect(SystemPriority.UI_BRIDGE).toBe(20);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/tick-runner.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement tick runner**

```typescript
// src/infrastructure/engine/tick-runner.ts
import type { TickScheduler, GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { BatchableEventBus } from './batchable-event-bus.js';

export function createTickRunner(eventBus: BatchableEventBus): TickScheduler {
	const systems: GameSystem[] = [];
	let tickCount = 0;

	return {
		get tickCount() { return tickCount; },

		register(system: GameSystem): void {
			systems.push(system);
			systems.sort((a, b) => a.priority - b.priority);
		},

		tick(deps: GameCoreDeps): void {
			const currentTick = tickCount + 1;
			deps.tickCount = currentTick;

			for (const system of systems) {
				eventBus.beginBatch();
				deps.performanceTracker.startSystem(system.name);
				try {
					system.execute(deps);
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					deps.logger.error('TickRunner', `System "${system.name}" failed: ${message}`, err instanceof Error ? err : undefined);
				} finally {
					deps.performanceTracker.endSystem();
					eventBus.flushBatch();
				}
			}

			deps.performanceTracker.completeTick(currentTick);
			tickCount = currentTick;
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/tick-runner.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (10 tests).

- [ ] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/tick-runner.ts" "01 - Projects/Project Meridian/tests/infrastructure/engine/tick-runner.test.ts"
git commit -m "feat(meridian): TickRunner with priority ordering, error boundaries, and EventBus batching"
```

---

## Chunk D: ECS Components

### Task D1: TrackedComponent Base

**Files:**
- Create: `src/infrastructure/components/tracked-component.ts`
- Create: `tests/infrastructure/components/tracked-component.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/components/tracked-component.test.ts
import { describe, it, expect } from 'vitest';
import * as ex from 'excalibur';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

class TestComponent extends TrackedComponent {
	constructor(public value: number) { super(); }
}

describe('TrackedComponent', () => {
	it('is dirty on creation', () => {
		const comp = new TestComponent(42);
		expect(comp.dirty).toBe(true);
	});

	it('clearDirty sets dirty to false', () => {
		const comp = new TestComponent(42);
		comp.clearDirty();
		expect(comp.dirty).toBe(false);
	});

	it('markDirty sets dirty to true after clearing', () => {
		const comp = new TestComponent(42);
		comp.clearDirty();
		comp.markDirty();
		expect(comp.dirty).toBe(true);
	});

	it('extends ExcaliburJS Component', () => {
		const comp = new TestComponent(42);
		expect(comp).toBeInstanceOf(ex.Component);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/components/tracked-component.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement TrackedComponent**

```typescript
// src/infrastructure/components/tracked-component.ts
import { Component } from 'excalibur';

export abstract class TrackedComponent extends Component {
	private _dirty = true;

	get dirty(): boolean { return this._dirty; }
	markDirty(): void { this._dirty = true; }
	clearDirty(): void { this._dirty = false; }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/components/tracked-component.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/components/tracked-component.ts" "01 - Projects/Project Meridian/tests/infrastructure/components/tracked-component.test.ts"
git commit -m "feat(meridian): TrackedComponent base class with dirty flag tracking"
```

---

### Task D2: Concrete Components (Needs, Mood, Memory, Blackboard)

**Files:**
- Create: `src/infrastructure/components/needs-component.ts`
- Create: `src/infrastructure/components/mood-component.ts`
- Create: `src/infrastructure/components/memory-component.ts`
- Create: `src/infrastructure/components/blackboard-component.ts`
- Create: `tests/infrastructure/components/game-components.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/components/game-components.test.ts
import { describe, it, expect } from 'vitest';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

describe('NeedsComponent', () => {
	it('holds NeedsState and is dirty on creation', () => {
		const comp = new NeedsComponent({ hunger: 80, energy: 90, social: 70 });
		expect(comp.state.hunger).toBe(80);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new NeedsComponent({ hunger: 80, energy: 90, social: 70 });
		comp.clearDirty();
		comp.state.hunger -= 10;
		comp.markDirty();
		expect(comp.state.hunger).toBe(70);
		expect(comp.dirty).toBe(true);
	});
});

describe('MoodComponent', () => {
	it('holds MoodState and is dirty on creation', () => {
		const comp = new MoodComponent({ value: 50, bucket: 'content' });
		expect(comp.state.value).toBe(50);
		expect(comp.state.bucket).toBe('content');
		expect(comp.dirty).toBe(true);
	});
});

describe('MemoryComponent', () => {
	it('holds MemoryState and is dirty on creation', () => {
		const comp = new MemoryComponent({ entries: [], maxEntries: 50 });
		expect(comp.state.entries).toEqual([]);
		expect(comp.state.maxEntries).toBe(50);
		expect(comp.dirty).toBe(true);
	});
});

describe('BlackboardComponent', () => {
	it('holds BlackboardState and is dirty on creation', () => {
		const comp = new BlackboardComponent({});
		expect(comp.state).toEqual({});
		expect(comp.dirty).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/components/game-components.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement all four components**

```typescript
// src/infrastructure/components/needs-component.ts
import type { NeedsState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class NeedsComponent extends TrackedComponent {
	constructor(public state: NeedsState) { super(); }
}
```

```typescript
// src/infrastructure/components/mood-component.ts
import type { MoodState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class MoodComponent extends TrackedComponent {
	constructor(public state: MoodState) { super(); }
}
```

```typescript
// src/infrastructure/components/memory-component.ts
import type { MemoryState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class MemoryComponent extends TrackedComponent {
	constructor(public state: MemoryState) { super(); }
}
```

```typescript
// src/infrastructure/components/blackboard-component.ts
import type { BlackboardState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class BlackboardComponent extends TrackedComponent {
	constructor(public state: BlackboardState) { super(); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/components/game-components.test.ts --config configs/vitest.config.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/components/" "01 - Projects/Project Meridian/tests/infrastructure/components/"
git commit -m "feat(meridian): NeedsComponent, MoodComponent, MemoryComponent, BlackboardComponent"
```

---

## Chunk E: TickSystem (ExcaliburJS Integration)

### Task E1: MeridianTickSystem

**Files:**
- Create: `src/infrastructure/engine/tick-system.ts`
- Create: `tests/infrastructure/engine/tick-system.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/engine/tick-system.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MeridianTickSystem } from '../../../src/infrastructure/engine/tick-system.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import type { TickScheduler } from '../../../src/domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';

function createMockTickRunner(): TickScheduler & { tickCalls: number } {
	return {
		tickCount: 0,
		tickCalls: 0,
		register() {},
		tick() { this.tickCalls++; },
	};
}

function createMockDeps(): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: { emit() {}, on: () => () => {}, off() {}, onAny: () => () => {}, filter: () => () => {}, history: () => [] },
		config: GameConfigSchema.parse({ tick_interval_ms: 500 }),
		performanceTracker: { enabled: false, setEnabled() {}, startSystem() {}, endSystem() {}, completeTick: () => null, history: () => [], averages: () => new Map() },
		tickCount: 0,
	};
}

describe('MeridianTickSystem', () => {
	it('fires a tick when elapsed >= tick_interval_ms', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(500);
		expect(runner.tickCalls).toBe(1);
	});

	it('does not fire a tick when elapsed < tick_interval_ms', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(300);
		expect(runner.tickCalls).toBe(0);
	});

	it('limits catch-up to 3 ticks per update', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(5000); // 10 ticks worth, should cap at 3
		expect(runner.tickCalls).toBe(3);
	});

	it('accumulates partial elapsed time across updates', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(300);
		expect(runner.tickCalls).toBe(0);
		system.update(300); // 600 total, 1 tick fires, 100 remains
		expect(runner.tickCalls).toBe(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/tick-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement MeridianTickSystem**

```typescript
// src/infrastructure/engine/tick-system.ts
import { System, SystemType } from 'excalibur';
import type { TickScheduler } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';

export class MeridianTickSystem extends System {
	readonly systemType = SystemType.Update;
	static override priority = 0;

	private accumulator = 0;
	private readonly maxCatchUp = 3;

	constructor(
		private tickRunner: TickScheduler,
		private deps: GameCoreDeps,
	) { super(); }

	update(elapsed: number): void {
		this.accumulator += elapsed;
		const interval = this.deps.config.tick_interval_ms;
		let steps = 0;
		while (this.accumulator >= interval && steps < this.maxCatchUp) {
			this.tickRunner.tick(this.deps);
			this.accumulator -= interval;
			steps++;
		}
		if (this.accumulator > interval) {
			this.accumulator = interval;
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/tick-system.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/tick-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/engine/tick-system.test.ts"
git commit -m "feat(meridian): MeridianTickSystem — ExcaliburJS System hosting 2Hz tick accumulator"
```

---

## Chunk F: Plugin Wiring + Integration

### Task F1: Wire GameCoreDeps in Plugin + Game View

**Files:**
- Modify: `src/plugin.ts`
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Update plugin.ts — compose GameCoreDeps in initializeGame()**

```typescript
// src/plugin.ts — add imports and update initializeGame()

// Add imports:
import { createEventBus } from './infrastructure/event-bus.js';
import { loadGameConfig } from './infrastructure/config/game-config-loader.js';
import { GameConfigSchema } from './domain/schemas/game-config-schema.js';
import type { GameCoreDeps } from './domain/core/game-deps.js';
import type { GameConfig } from './domain/schemas/game-config-schema.js';

// Add field:
private gameDeps: GameCoreDeps | null = null;

// Update initializeGame():
private initializeGame(): void {
    this.logger?.info('Meridian', 'Game initialization started');

    const eventBus = createEventBus();
    const config = GameConfigSchema.parse({});

    if (this.logger !== null && this.performanceTracker !== null) {
        this.gameDeps = {
            logger: this.logger,
            eventBus,
            config,
            performanceTracker: this.performanceTracker,
            tickCount: 0,
        };
    }
}

// Update registerView to pass deps:
this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => new MeridianGameView(leaf, this.gameDeps));
```

- [ ] **Step 2: Update game-view.ts — accept deps, create tick infrastructure**

```typescript
// src/infrastructure/engine/game-view.ts
import { ItemView } from 'obsidian';
import type * as ex from 'excalibur';
import { createGameEngine, createTestActor } from './game-engine.js';
import { createGameLoader } from './game-loader.js';
import { createTickRunner } from './tick-runner.js';
import { MeridianTickSystem } from './tick-system.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;
	private deps: GameCoreDeps | null;

	constructor(leaf: import('obsidian').WorkspaceLeaf, deps: GameCoreDeps | null) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return MERIDIAN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Project Meridian';
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian ItemView interface requires async
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add('meridian-game-container');

		try {
			const style = getComputedStyle(container);
			const bgColor = style.getPropertyValue('--background-primary').trim() || '#1a1a2e';

			this.engine = createGameEngine(container, {
				backgroundColor: bgColor,
			});

			// Add a test actor to verify rendering (Phase 0 acceptance criterion 1)
			const testActor = createTestActor({ x: 400, y: 300 });
			this.engine.currentScene.add(testActor);

			// Wire tick infrastructure if deps are available
			if (this.deps !== null) {
				const batchableEventBus = this.deps.eventBus as import('./batchable-event-bus.js').BatchableEventBus;
				const tickRunner = createTickRunner(batchableEventBus);
				const tickSystem = new MeridianTickSystem(tickRunner, this.deps);
				this.engine.currentScene.world.add(tickSystem);
				this.deps.logger.info('Meridian', 'Tick system registered');
			}

			const loader = createGameLoader();
			void this.engine.start(loader).catch((err: unknown) => {
				this.showError(container, err);
			});
		} catch (err: unknown) {
			this.showError(container, err);
		}
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian ItemView interface requires async
	async onClose(): Promise<void> {
		if (this.engine !== null) {
			this.engine.stop();
			this.engine = null;
		}
	}

	private showError(container: HTMLElement, err: unknown): void {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[Meridian] Engine failed to initialize:', message);
		container.empty();
		const errorEl = container.createDiv({ cls: 'meridian-error' });
		errorEl.createEl('h3', { text: 'Project Meridian' });
		errorEl.createEl('p', { text: 'The game engine failed to start.' });
		errorEl.createEl('code', { text: message });
		errorEl.createEl('p', { text: 'Check the developer console for details.' });
	}
}
```

- [ ] **Step 3: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/plugin.ts" "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): wire GameCoreDeps in plugin + tick system in game view"
```

---

### Task F2: Integration Test

**Files:**
- Create: `tests/integration/tick-integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/integration/tick-integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { GameSystem } from '../../src/domain/core/tick-scheduler.js';

function createIntegrationDeps(eventBus: ReturnType<typeof createEventBus>): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 0,
	};
}

describe('Tick Integration', () => {
	it('system A emits event, system B receives it via batch flush', () => {
		const eventBus = createEventBus();
		let receivedByB = false;

		eventBus.on('FromA', () => { receivedByB = true; });

		const systemA: GameSystem = {
			name: 'SystemA', priority: 1,
			execute(deps) {
				deps.eventBus.emit({ type: 'FromA', tick: deps.tickCount, wallClock: Date.now(), source: 'SystemA', payload: {} });
			},
		};
		const systemB: GameSystem = {
			name: 'SystemB', priority: 2,
			execute() {},
		};

		const runner = createTickRunner(eventBus);
		runner.register(systemA);
		runner.register(systemB);

		const deps = createIntegrationDeps(eventBus);
		runner.tick(deps);

		expect(receivedByB).toBe(true);
	});

	it('system A fails, system B still executes', () => {
		const eventBus = createEventBus();
		let bExecuted = false;

		const systemA: GameSystem = {
			name: 'FailingA', priority: 1,
			execute() { throw new Error('A crashed'); },
		};
		const systemB: GameSystem = {
			name: 'HealthyB', priority: 2,
			execute() { bExecuted = true; },
		};

		const runner = createTickRunner(eventBus);
		runner.register(systemA);
		runner.register(systemB);

		const deps = createIntegrationDeps(eventBus);
		runner.tick(deps);

		expect(bExecuted).toBe(true);
	});

	it('performance tracker records timing for all systems', () => {
		const eventBus = createEventBus();
		const perfTracker = createPerformanceTracker();
		perfTracker.setEnabled(true);

		const runner = createTickRunner(eventBus);
		runner.register({ name: 'Sys1', priority: 1, execute() {} });
		runner.register({ name: 'Sys2', priority: 2, execute() {} });

		const deps = createIntegrationDeps(eventBus);
		deps.performanceTracker = perfTracker;
		runner.tick(deps);

		const history = perfTracker.history();
		expect(history).toHaveLength(1);
		expect(history[0]?.systems).toHaveLength(2);
		expect(history[0]?.systems[0]?.name).toBe('Sys1');
		expect(history[0]?.systems[1]?.name).toBe('Sys2');
	});
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/ --config configs/vitest.config.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Run full quality gates + build**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts && npm run build`
Expected: 0 errors, all ~142 tests pass, build produces dist/main.js.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/"
git commit -m "test(meridian): tick integration tests — inter-system events, error boundaries, perf tracking"
```

---

## Chunk G: Phase 1A Verification

### Task G1: Full Verification Against Exit Criteria

- [ ] **Step 1: Run complete quality gate suite**

Run:
```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ tests/ --config configs/eslint.config.mjs
npx vitest run --config configs/vitest.config.ts
npm run build
```

Expected: 0 errors, 0 warnings, ~142 tests pass, build succeeds.

- [ ] **Step 2: Verify exit criteria checklist**

| Criterion | Evidence |
|-----------|----------|
| Tick runner executes at 2Hz via ExcaliburJS | MeridianTickSystem accumulator test |
| Systems execute in priority order with error boundaries | tick-runner.test.ts: priority order + skip on failure |
| EventBus batches between systems | tick-runner.test.ts: beginBatch/flushBatch called; integration test: A emits → B receives |
| TrackedComponent dirty tracking | tracked-component.test.ts: creation, mark, clear |
| Components hold state (Needs, Mood, Memory) | game-components.test.ts: state access + dirty |
| GameCoreDeps wired plugin → view → tick system | plugin.ts + game-view.ts wiring |
| PerformanceTracker records per-system | tick-runner.test.ts + integration test |
| Phase 0 tests pass | Full suite run |

- [ ] **Step 3: Update GDD §30.2 to reflect the system architecture deviation**

In `Project Meridian.md`, find §30.2 row for "Tick Cycle" and update:

```
|**Tick Cycle**|Engine update loop with fixed timestep accumulator (§2.1)|
Tick accumulator logic. One ExcaliburJS System (`MeridianTickSystem`)
hosts the 2Hz accumulator. Game systems implement `GameSystem` interface
and are dispatched by `TickRunner` — NOT registered as individual
ExcaliburJS Systems (ADR deviation from original §30.2).|
```

- [ ] **Step 4: Final commit**

```bash
git add "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 1A complete — tick infrastructure + ECS components"
```
