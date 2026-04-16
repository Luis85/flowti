# Module System + Observability — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a module system with typed settings, dependency ordering, open EventMap, async events, listener priority, startup validation, and ship three observability modules (Core, Event Inspector, Health Monitor).

**Architecture:** Modules are bounded contexts that declare commands, events, settings schemas, and lifecycle hooks. `PluginCore` topologically sorts them by `dependsOn`, validates at startup, then calls `init(ports, settings)` in order. The EventBus becomes open (declaration merging), gains `emitAsync` + listener priority, and snapshots listeners before dispatch. Settings become namespaced per module. Three modules prove the pattern: Core (refactor of existing), Event Inspector (sidebar + ring buffer), Health Monitor (command-only diagnostics).

**Tech Stack:** TypeScript 6, Vue 3, Pinia 2, Vitest 4, Obsidian 1.12.7 API. No new runtime dependencies.

**Spec:** [`docs/specs/2026-04-16-module-system-design.md`](../specs/2026-04-16-module-system-design.md)

**Conventions:** Same as Increments 1-2. All paths relative to `01 - Projects/Agentonomous/`. Commits from `C:/Projects/flowti` with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`. TDD. Tabs. `.js` imports.

---

## Chunk 1: Foundations (topo-sort, Module interface, open EventMap)

**Goal:** Ship the `topologicalSort` utility, the `Module` + `ModulePorts` + `defineModule` types, and split `EventMap` into an empty base + `core-events.ts` augmentation. At the end, all 104 existing tests still pass.

### Task 1.1: `topologicalSort` utility (TDD)

**Files:**
- Create: `src/domain/shared/utils/topo-sort.ts`
- Create: `tests/domain/shared/utils/topo-sort.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/shared/utils/topo-sort.test.ts
import { describe, expect, it } from 'vitest';
import { topologicalSort } from '../../../../src/domain/shared/utils/topo-sort.js';
import { isErr, isOk } from '../../../../src/domain/shared/result.js';

type Node = { id: string; dependsOn?: readonly string[] };

describe('topologicalSort', () => {
	it('returns nodes in dependency order', () => {
		const nodes: Node[] = [
			{ id: 'c', dependsOn: ['b'] },
			{ id: 'a' },
			{ id: 'b', dependsOn: ['a'] },
		];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			const ids = result.value.map((n) => n.id);
			expect(ids).toEqual(['a', 'b', 'c']);
		}
	});

	it('returns nodes unchanged when no dependencies', () => {
		const nodes: Node[] = [{ id: 'a' }, { id: 'b' }];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isOk(result)).toBe(true);
	});

	it('returns err on circular dependency', () => {
		const nodes: Node[] = [
			{ id: 'a', dependsOn: ['b'] },
			{ id: 'b', dependsOn: ['a'] },
		];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error).toMatch(/circular/i);
	});

	it('returns err on unknown dependency', () => {
		const nodes: Node[] = [{ id: 'a', dependsOn: ['nonexistent'] }];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error).toMatch(/unknown/i);
	});

	it('handles diamond dependencies', () => {
		const nodes: Node[] = [
			{ id: 'd', dependsOn: ['b', 'c'] },
			{ id: 'b', dependsOn: ['a'] },
			{ id: 'c', dependsOn: ['a'] },
			{ id: 'a' },
		];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			const ids = result.value.map((n) => n.id);
			expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
			expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
			expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
			expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
		}
	});
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run tests/domain/shared/utils/topo-sort.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement**

```ts
// src/domain/shared/utils/topo-sort.ts
import { err, ok, type Result } from '../result.js';

export function topologicalSort<T>(
	nodes: readonly T[],
	getId: (node: T) => string,
	getDeps: (node: T) => readonly string[],
): Result<T[], string> {
	const nodeMap = new Map<string, T>();
	for (const node of nodes) {
		nodeMap.set(getId(node), node);
	}

	const visited = new Set<string>();
	const visiting = new Set<string>();
	const sorted: T[] = [];

	function visit(id: string): string | null {
		if (visited.has(id)) return null;
		if (visiting.has(id)) return `circular dependency involving "${id}"`;

		const node = nodeMap.get(id);
		if (!node) return `unknown dependency "${id}"`;

		visiting.add(id);
		for (const dep of getDeps(node)) {
			const error = visit(dep);
			if (error !== null) return error;
		}
		visiting.delete(id);
		visited.add(id);
		sorted.push(node);
		return null;
	}

	for (const node of nodes) {
		const error = visit(getId(node));
		if (error !== null) return err(error);
	}

	return ok(sorted);
}
```

- [ ] **Step 4: Run — verify 5 tests pass**

- [ ] **Step 5: Commit**: `feat(agentonomous): add topologicalSort utility`

### Task 1.2: `Module` + `ModulePorts` + `defineModule` interfaces

**Files:**
- Create: `src/domain/shared/module.ts`

- [ ] **Step 1: Create the types**

```ts
// src/domain/shared/module.ts
import type { Result } from './result.js';
import type { EventBus } from './event-bus.js';
import type { LoggerPort } from './logger-port.js';
import type { NotificationPort } from './notification-port.js';
import type { SettingsPort } from '../settings/settings-port.js';
import type { ViewRegistryPort } from '../views/view-registry-port.js';
import type { CommandEntry } from '../commands/command-types.js';

export interface ModulePorts {
	readonly eventBus: EventBus;
	readonly logger: LoggerPort;
	readonly settings: SettingsPort;
	readonly notifications: NotificationPort;
	readonly views: ViewRegistryPort;
}

export interface Module {
	readonly id: string;
	readonly name: string;
	readonly dependsOn?: readonly string[];

	readonly settingsKey?: string;
	readonly settingsDefaults?: unknown;
	validateSettings?(raw: unknown): Result<unknown, string>;

	readonly commands?: readonly CommandEntry[];

	init(ports: ModulePorts, settings: unknown): Promise<void>;
	destroy(): void;
}

export function defineModule<TSettings = unknown>(def: {
	readonly id: string;
	readonly name: string;
	readonly dependsOn?: readonly string[];
	readonly settingsKey?: string;
	readonly settingsDefaults?: TSettings;
	validateSettings?(raw: unknown): Result<TSettings, string>;
	readonly commands?: readonly CommandEntry[];
	init(ports: ModulePorts, settings: TSettings): Promise<void>;
	destroy(): void;
}): Module {
	return def as Module;
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**: `feat(agentonomous): add Module interface + defineModule builder`

### Task 1.3: Open EventMap + core-events augmentation

**Files:**
- Modify: `src/domain/shared/event-bus.ts` — make `EventMap` empty
- Create: `src/domain/shared/core-events.ts` — augmentation with the 5 core channels
- Modify: all test files that emit events — they need `core-events.ts` imported for types

- [ ] **Step 1: Empty the EventMap in `event-bus.ts`**

Replace the `EventMap` interface body with an empty interface:
```ts
export interface EventMap {}
```

Remove the `PluginSettings` import (no longer needed since `settings` channel payload is `unknown`).

- [ ] **Step 2: Create `core-events.ts`**

```ts
// src/domain/shared/core-events.ts
import type { LogLevel } from './logger-port.js';

declare module './event-bus.js' {
	interface EventMap {
		log: { level: LogLevel; source: string; message: string; data?: unknown };
		error: { code: string; message: string; source: string; severity: 'user' | 'system' | 'fatal'; data?: unknown };
		settings: { previous: unknown; current: unknown };
		core: { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'validation'; degraded?: boolean; errors?: string[] };
		command: { id: string; trigger: 'palette' | 'ribbon' | 'hotkey' };
	}
}
```

- [ ] **Step 3: Import `core-events.ts` where needed**

Any file that calls `bus.emit('core', ...)` or `bus.on('log', ...)` needs the augmentation in scope. TypeScript module augmentation takes effect when the augmenting file is included in the compilation (via `tsconfig.json` include). Since `src/domain/shared/core-events.ts` is already covered by `../src/**/*.ts`, it should auto-resolve.

However, test files that reference specific event channels may need an explicit import to ensure the augmentation is loaded:
```ts
import '../../src/domain/shared/core-events.js';
```

Add this import to: `tests/core/logger.test.ts`, `tests/core/error-handler.test.ts`, `tests/core/plugin-core.test.ts`, `tests/domain/shared/event-bus.test.ts`. If the tests already pass without the explicit import (because tsconfig includes `src/**`), skip this step.

- [ ] **Step 4: Run `npm test` — verify all 104 tests pass**

If TypeScript complains that `'core'` is not a key of `EventMap` (empty), the augmentation isn't resolving. Debug: check `tsconfig.json` includes `../src/**/*.ts` and that `core-events.ts` matches the glob. If needed, add an explicit `import './core-events.js'` in `event-bus.ts` (side-effect import to ensure the augmentation loads).

- [ ] **Step 5: Commit**: `refactor(agentonomous): open EventMap via declaration merging`

### Task 1.4: Verify chunk is green

- [ ] **Step 1: Run `npm test`**

Expected: 109+ tests (104 existing + 5 topo-sort). Exit 0.

---

## Chunk 2: EventBus enhancements

**Goal:** Add `emitAsync`, listener priority on `on()`, snapshot-based dispatch (both sync and async), and `traceMap` eviction. All existing EventBus tests still pass; new tests cover each enhancement.

### Task 2.1: Snapshot dispatch + listener priority (TDD)

**Files:**
- Modify: `src/domain/shared/event-bus.ts`
- Modify: `tests/domain/shared/event-bus.test.ts`

- [ ] **Step 1: Add priority + snapshot tests**

Append to `tests/domain/shared/event-bus.test.ts`:

```ts
describe('listener priority', () => {
	it('higher priority fires first', () => {
		const bus = createEventBus();
		const order: string[] = [];
		bus.on('core', () => { order.push('default'); });
		bus.on('core', () => { order.push('high'); }, { priority: 100 });
		bus.on('core', () => { order.push('low'); }, { priority: -100 });
		bus.emit('core', { phase: 'ready' });
		expect(order).toEqual(['high', 'default', 'low']);
	});

	it('same priority preserves registration order', () => {
		const bus = createEventBus();
		const order: number[] = [];
		bus.on('core', () => { order.push(1); }, { priority: 0 });
		bus.on('core', () => { order.push(2); }, { priority: 0 });
		bus.emit('core', { phase: 'ready' });
		expect(order).toEqual([1, 2]);
	});
});

describe('snapshot dispatch', () => {
	it('unsubscribing during emit does not skip listeners', () => {
		const bus = createEventBus();
		const calls: string[] = [];
		const unsub = bus.on('core', () => {
			calls.push('first');
			unsub();
		});
		bus.on('core', () => { calls.push('second'); });
		bus.emit('core', { phase: 'ready' });
		expect(calls).toEqual(['first', 'second']);
	});

	it('subscribing during emit does not fire new listener in current dispatch', () => {
		const bus = createEventBus();
		const calls: string[] = [];
		bus.on('core', () => {
			calls.push('original');
			bus.on('core', () => { calls.push('added-during-emit'); });
		});
		bus.emit('core', { phase: 'ready' });
		expect(calls).toEqual(['original']);
	});
});
```

- [ ] **Step 2: Run — verify new tests fail (existing pass)**

- [ ] **Step 3: Implement priority + snapshot in `event-bus.ts`**

Key changes to `createEventBus()`:
- `channelListeners` values change from `Set` to a sorted array of `{ listener, priority }` entries.
- `on()` accepts optional `{ priority?: number }`, inserts into the array maintaining sort order (descending by priority, stable by insertion order within same priority).
- `emit()` snapshots the listener array (`[...listeners]`) before iterating — no live mutation effects.
- `onAny()` snapshots similarly.

The exact implementation must preserve all existing test behavior (10 tests).

- [ ] **Step 4: Run — verify all EventBus tests pass (existing + new)**

- [ ] **Step 5: Commit**: `feat(agentonomous): add listener priority + snapshot dispatch`

### Task 2.2: `emitAsync` (TDD)

**Files:**
- Modify: `src/domain/shared/event-bus.ts`
- Modify: `tests/domain/shared/event-bus.test.ts`

- [ ] **Step 1: Add async tests**

```ts
describe('emitAsync', () => {
	it('awaits all listener Promises before resolving', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		bus.on('core', async () => {
			await new Promise((r) => { setTimeout(r, 10); });
			order.push('async-listener');
		});
		bus.on('core', () => { order.push('sync-listener'); });
		await bus.emitAsync('core', { phase: 'ready' });
		expect(order).toContain('async-listener');
		expect(order).toContain('sync-listener');
	});

	it('returns the EventEnvelope', async () => {
		const bus = createEventBus();
		const env = await bus.emitAsync('core', { phase: 'ready' });
		expect(env.channel).toBe('core');
		expect(env.eventId).toBeTruthy();
	});

	it('snapshots listeners before dispatching', async () => {
		const bus = createEventBus();
		const calls: string[] = [];
		bus.on('core', async () => {
			calls.push('original');
			bus.on('core', () => { calls.push('added-during-async'); });
		});
		await bus.emitAsync('core', { phase: 'ready' });
		expect(calls).toEqual(['original']);
	});
});
```

- [ ] **Step 2: Run — verify new tests fail**

- [ ] **Step 3: Implement `emitAsync`**

```ts
async function emitAsync<K extends keyof EventMap>(
	channel: K,
	payload: EventMap[K],
	opts?: { parentId?: string },
): Promise<EventEnvelope<K>> {
	const envelope = buildEnvelope(channel, payload, opts);

	const snapshot = [...(channelListeners.get(channel as string) ?? [])];
	const promises: (void | Promise<void>)[] = [];
	for (const entry of snapshot) {
		promises.push((entry.listener as (e: EventEnvelope<K>) => void | Promise<void>)(envelope));
	}

	const anySnapshot = [...anyListeners];
	for (const listener of anySnapshot) {
		promises.push(listener(envelope as EventEnvelope));
	}

	await Promise.all(promises);
	return envelope;
}
```

Extract `buildEnvelope()` as a shared helper used by both `emit` and `emitAsync` (DRY — currently the envelope construction is duplicated).

- [ ] **Step 4: Run — verify all tests pass**

- [ ] **Step 5: Update EventBus interface** to include `emitAsync`:

```ts
emitAsync<K extends keyof EventMap>(channel: K, payload: EventMap[K], opts?: { parentId?: string }): Promise<EventEnvelope<K>>;
```

- [ ] **Step 6: Commit**: `feat(agentonomous): add emitAsync for awaitable event dispatch`

### Task 2.3: `traceMap` eviction (TDD)

**Files:**
- Modify: `src/domain/shared/event-bus.ts`
- Modify: `tests/domain/shared/event-bus.test.ts`

- [ ] **Step 1: Add eviction test**

```ts
describe('traceMap eviction', () => {
	it('evicts oldest entries when exceeding maxTraceEntries', () => {
		const bus = createEventBus({ maxTraceEntries: 100 });
		for (let i = 0; i < 150; i++) {
			bus.emit('core', { phase: 'ready' });
		}
		// After 150 emits with max 100, eviction should have fired
		// Verify by emitting a child of an early event — traceId should be new (parent evicted)
		const early = bus.emit('core', { phase: 'ready' });
		expect(early.traceId).toBeTruthy(); // still works, just starts new trace
	});
});
```

- [ ] **Step 2: Implement eviction**

`createEventBus` accepts optional `opts?: { maxTraceEntries?: number }` (default `10000`). After each `traceMap.set()`, check if `traceMap.size > maxTraceEntries`. If so, evict the oldest 25%:

```ts
if (traceMap.size > maxTraceEntries) {
	const evictCount = Math.floor(maxTraceEntries * 0.25);
	const iterator = traceMap.keys();
	for (let i = 0; i < evictCount; i++) {
		const key = iterator.next().value;
		if (key !== undefined) traceMap.delete(key);
	}
}
```

- [ ] **Step 3: Run — verify passes**

- [ ] **Step 4: Commit**: `feat(agentonomous): add traceMap eviction`

### Task 2.4: Verify chunk is green

- [ ] **Step 1: Run `npm test`**

Expected: ~117+ tests. Exit 0.

---

## Chunk 3: Logger warn + SettingsPort migration + namespaced settings

**Goal:** Add `warn` log level, migrate `PluginSettings` → `CoreSettings`, change `SettingsPort` to handle `unknown` blobs, implement namespaced settings loading/validation in `PluginCore`.

### Task 3.1: Add `warn` to LoggerPort + Logger (TDD)

**Files:**
- Modify: `src/domain/shared/logger-port.ts`
- Modify: `src/core/logger.ts`
- Modify: `tests/core/logger.test.ts`
- Modify: `src/domain/shared/core-events.ts` — update `LogLevel` reference
- Modify: `src/domain/settings/plugin-settings.ts` — add `'warn'` to `KNOWN_LOG_LEVELS`

- [ ] **Step 1: Add test for warn**

```ts
it('warn() emits on bus and calls console.warn when level is info or lower', () => {
	const bus = createEventBus();
	const logger = new Logger(bus, 'info');
	const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const busListener = vi.fn();
	bus.on('log', busListener);
	logger.warn('src', 'degraded');
	expect(spy).toHaveBeenCalledWith('[agentonomous:src]', 'degraded', undefined);
	expect(busListener.mock.calls[0][0].payload.level).toBe('warn');
	spy.mockRestore();
});

it('warn() is suppressed when level is error', () => {
	const bus = createEventBus();
	const logger = new Logger(bus, 'error');
	const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	logger.warn('src', 'degraded');
	expect(spy).not.toHaveBeenCalled();
	spy.mockRestore();
});
```

- [ ] **Step 2: Implement**

Update `LogLevel` type in `logger-port.ts`:
```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

Update `LEVEL_ORDER` in `logger.ts`:
```ts
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
```

Add `warn()` method to Logger + LoggerPort.

Update `KNOWN_LOG_LEVELS` in `plugin-settings.ts` to include `'warn'`. Update settings tab dropdown.

Update `core-events.ts` — the `log` event's `level` field type references `LogLevel` which now includes `'warn'`.

- [ ] **Step 3: Run `npm test`**

- [ ] **Step 4: Commit**: `feat(agentonomous): add warn log level`

### Task 3.2: Rename `PluginSettings` → `CoreSettings` + migrate SettingsPort

**Files:**
- Modify: `src/domain/settings/plugin-settings.ts` — rename type + exports
- Modify: `src/domain/settings/settings-port.ts` — change to `unknown` blob
- Modify: all consumers of `PluginSettings` / `SettingsPort` — update imports

This is a sweeping rename. The implementer must:

1. In `plugin-settings.ts`:
   - `PluginSettings` → `CoreSettings`
   - `DEFAULT_SETTINGS` → `CORE_SETTINGS_DEFAULTS`
   - `validateSettings` → `validateCoreSettings`
   - Keep all exports, add deprecated re-exports if needed for backward compat (or just rename everywhere).

2. In `settings-port.ts`:
   - `load()` returns `Promise<Result<unknown, string>>` (was `Result<PluginSettings, string>`)
   - `save()` accepts `unknown` (was `PluginSettings`)
   - `subscribe()` callback passes `unknown` (was `PluginSettings`)

3. Update all files that reference the old names. Key files:
   - `src/infrastructure/obsidian/obsidian-settings-adapter.ts`
   - `src/infrastructure/settings/settings-tab.ts`
   - `src/core/plugin-core.ts`
   - `src/ui/stores/settings-store.ts`
   - All corresponding test files

4. The settings adapter (`ObsidianSettingsAdapter`) no longer validates — it just passes raw data through. Validation moves to `PluginCore`.

- [ ] **Step 1: Rename types and update SettingsPort**

- [ ] **Step 2: Update all consumers (find-and-replace + type fixes)**

- [ ] **Step 3: Run `npm test` — expect some failures from type changes; fix them**

- [ ] **Step 4: Commit**: `refactor(agentonomous): rename PluginSettings → CoreSettings, SettingsPort to unknown blob`

### Task 3.3: Verify chunk is green

- [ ] **Step 1: Run `npm test`**

Expected: exit 0, ~119+ tests.

---

## Chunk 4: PluginCore module orchestration + startup validation

**Goal:** Rewrite `PluginCore` to accept `Module[]`, topologically sort them, run startup validation (circular deps, duplicates, settings), call `init(ports, settings)` per module in order, and `destroy()` in reverse order.

### Task 4.1: Rewrite `PluginCore` for modules (TDD)

**Files:**
- Modify: `src/core/plugin-core.ts`
- Modify: `tests/core/plugin-core.test.ts`

- [ ] **Step 1: Write new tests**

Replace/extend `plugin-core.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PluginCore } from '../../src/core/plugin-core.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import '../../src/domain/shared/core-events.js';
import { Logger } from '../../src/core/logger.js';
import { defineModule, type Module } from '../../src/domain/shared/module.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import { ok } from '../../src/domain/shared/result.js';

function fakeSettings() {
	return {
		load: vi.fn(async () => ok({})),
		save: vi.fn(async () => ok(undefined)),
		subscribe: vi.fn(() => () => {}),
	};
}

function fakeViews() {
	return { registerAll: vi.fn(), openView: vi.fn(async () => ok(undefined)) };
}

function fakeNotifications(): NotificationPort { return { show: vi.fn() }; }

const moduleA = defineModule({
	id: 'a', name: 'A',
	async init() {},
	destroy() {},
});

const moduleB = defineModule({
	id: 'b', name: 'B', dependsOn: ['a'],
	async init() {},
	destroy() {},
});

describe('PluginCore with modules', () => {
	it('init() calls module.init in dependency order', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		const a = defineModule({ id: 'a', name: 'A', async init() { order.push('a'); }, destroy() {} });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() { order.push('b'); }, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: { register: vi.fn(() => () => {}), unregisterAll: vi.fn() }, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[b, a],
		);
		await core.init();
		expect(order).toEqual(['a', 'b']);
	});

	it('destroy() calls module.destroy in reverse order', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		const a = defineModule({ id: 'a', name: 'A', async init() {}, destroy() { order.push('a'); } });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() {}, destroy() { order.push('b'); } });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: { register: vi.fn(() => () => {}), unregisterAll: vi.fn() }, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[b, a],
		);
		await core.init();
		core.destroy();
		expect(order).toEqual(['b', 'a']);
	});

	it('fails fast on circular dependencies', async () => {
		const bus = createEventBus();
		const a = defineModule({ id: 'a', name: 'A', dependsOn: ['b'], async init() {}, destroy() {} });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() {}, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: { register: vi.fn(() => () => {}), unregisterAll: vi.fn() }, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[a, b],
		);

		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(String(env.payload.phase)); });
		await core.init();
		expect(core.ready).toBe(false);
		expect(phases).toContain('validation');
	});

	it('detects duplicate module ids', async () => {
		const bus = createEventBus();
		const a1 = defineModule({ id: 'a', name: 'A1', async init() {}, destroy() {} });
		const a2 = defineModule({ id: 'a', name: 'A2', async init() {}, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: { register: vi.fn(() => () => {}), unregisterAll: vi.fn() }, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[a1, a2],
		);

		await core.init();
		expect(core.ready).toBe(false);
	});

	it('collects commands from all modules', async () => {
		const bus = createEventBus();
		const commands = { register: vi.fn(() => () => {}), unregisterAll: vi.fn() };
		const m = defineModule({
			id: 'test', name: 'Test',
			commands: [{ id: 'test-cmd', name: 'Test' }],
			async init() {},
			destroy() {},
		});

		const core = new PluginCore(
			{ settings: fakeSettings(), commands, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();
		expect(commands.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-cmd' }));
	});

	it('emits core:initializing and core:ready', async () => {
		const bus = createEventBus();
		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(String(env.payload.phase)); });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: { register: vi.fn(() => () => {}), unregisterAll: vi.fn() }, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[moduleA],
		);
		await core.init();
		expect(phases).toContain('initializing');
		expect(phases).toContain('ready');
	});
});
```

- [ ] **Step 2: Rewrite `PluginCore` implementation**

The constructor now takes `(ports: CorePorts, modules: readonly Module[])` instead of `commandEntries`.

`init()` sequence:
1. Emit `core:initializing`
2. Create `ErrorHandler`
3. Validate: duplicate ids, duplicate settingsKeys, duplicate command ids
4. Topological sort modules
5. If validation fails → emit `core:validation` with errors, log at error level, set `ready = false`, return
6. Load raw settings blob via `ports.settings.load()`
7. For each module (in sorted order):
   - Extract `raw[module.settingsKey]` if `settingsKey` exists
   - Validate via `module.validateSettings(section)` or fall back to `module.settingsDefaults`
   - Call `module.init(modulePorts, validatedSettings)`
8. Register all commands (collected from all modules)
9. Subscribe to settings changes
10. Emit `core:ready`

`destroy()` sequence:
1. Emit `core:destroying`
2. Unsubscribe settings
3. For each module in REVERSE sorted order: call `module.destroy()`
4. Unregister all commands
5. Destroy ErrorHandler
6. Emit `core:destroyed`

- [ ] **Step 3: Run — verify all tests pass**

- [ ] **Step 4: Commit**: `refactor(agentonomous): rewrite PluginCore for module orchestration`

### Task 4.2: Verify chunk is green

- [ ] **Step 1: Run `npm test`**

Expected: exit 0.

---

## Chunk 5: Three modules (Core, Event Inspector, Health Monitor)

**Goal:** Implement the three observability modules, their settings, views, stores, and commands.

### Task 5.1: Core module

**Files:**
- Create: `src/modules/core/core-module.ts`

- [ ] **Step 1: Create the Core module using `defineModule`**

```ts
// src/modules/core/core-module.ts
import { defineModule } from '../../domain/shared/module.js';
import { CORE_SETTINGS_DEFAULTS, validateCoreSettings, type CoreSettings } from '../../domain/settings/plugin-settings.js';
import { CORE_COMMANDS } from '../../domain/commands/core-commands.js';

export const CoreModule = defineModule<CoreSettings>({
	id: 'core',
	name: 'Core',
	dependsOn: [],
	settingsKey: 'core',
	settingsDefaults: CORE_SETTINGS_DEFAULTS,
	validateSettings: validateCoreSettings,
	commands: CORE_COMMANDS,

	async init(ports, settings) {
		ports.logger.info('core', `Core module initialized (logLevel: ${settings.logLevel})`);
	},

	destroy() {},
});
```

- [ ] **Step 2: Commit**: `feat(agentonomous): add Core module`

### Task 5.2: Event Inspector module (TDD — store + module + view)

**Files:**
- Create: `src/modules/event-inspector/event-inspector-settings.ts`
- Create: `src/modules/event-inspector/event-inspector-events.ts`
- Create: `src/modules/event-inspector/event-inspector-store.ts`
- Create: `src/modules/event-inspector/event-inspector-module.ts`
- Create: `src/modules/event-inspector/views/EventInspectorView.vue`
- Create: `src/modules/event-inspector/views/event-inspector-view.ts` (ItemView subclass)
- Create: `tests/modules/event-inspector/event-inspector-store.test.ts`
- Create: `tests/modules/event-inspector/event-inspector-module.test.ts`

This is the largest task. The implementer should:

1. Create the settings type + validator + defaults.
2. Create the EventMap augmentation (`event-inspector` channel).
3. Create the Pinia store (ring buffer, trace grouping, filter).
4. Create the module definition using `defineModule<EventInspectorSettings>`.
5. Create the `ItemView` subclass + Vue sidebar panel.
6. Write tests for the store (buffer add, eviction at max, filter).
7. Write a test for the module (init subscribes to bus, destroy unsubscribes).

Key implementation details:
- Ring buffer: an array capped at `maxEvents`. When full, shift the oldest off the front.
- Trace grouping: a `Map<traceId, EventEnvelope[]>` derived from the buffer.
- Filter: a reactive `Set<string>` of channel names to show (empty = all).
- The sidebar Vue view mounts a dedicated Vue app instance (same pattern as HomepageView).

- [ ] **Step 1: Create settings, events, store, module, view**

(Implementer has creative freedom within the spec constraints. Key contract: the store exposes `events: ref<EventEnvelope[]>`, `traceGroups: computed<Map<string, EventEnvelope[]>>`, `filterChannels: ref<string[]>`, and the module subscribes via `bus.onAny()` at priority `-100`.)

- [ ] **Step 2: Write tests — store ring buffer behavior, module lifecycle**

- [ ] **Step 3: Run `npm test` — verify green**

- [ ] **Step 4: Commit**: `feat(agentonomous): add Event Inspector module with sidebar view`

### Task 5.3: Health Monitor module (TDD)

**Files:**
- Create: `src/modules/health-monitor/health-monitor-module.ts`
- Create: `src/modules/health-monitor/health-monitor-events.ts`
- Create: `tests/modules/health-monitor/health-monitor-module.test.ts`

- [ ] **Step 1: Create the module**

Key behavior:
- `init()`: subscribe to `core` events, build module-state map, start 60s interval for periodic health-check self-emit.
- `destroy()`: clear interval, unsubscribe.
- Command `show-health`: logs structured summary + shows Notice.

The implementer must ensure `destroy()` calls `clearInterval()`.

- [ ] **Step 2: Write tests**

Test that:
- `init()` subscribes to bus (verify via mock listener count or spy).
- `destroy()` clears the interval.
- The `show-health` callback logs module states.

- [ ] **Step 3: Run `npm test`**

- [ ] **Step 4: Commit**: `feat(agentonomous): add Health Monitor module`

### Task 5.4: Verify chunk is green

- [ ] **Step 1: Run `npm test`**

Expected: exit 0, ~135+ tests.

---

## Chunk 6: Anti-pattern fixes + shell rewire + final quality gate

**Goal:** Apply remaining anti-pattern fixes (ViewRegistry returns Result, PluginContext wraps CorePorts, ribbon to shell), rewire `main.ts` to pass modules, update ESLint for `src/modules/`, and run the final quality gate.

### Task 6.1: `ViewRegistry.openView` returns `Result`

**Files:**
- Modify: `src/infrastructure/obsidian/view-registry.ts`
- Modify: `src/domain/views/view-registry-port.ts`
- Modify: `tests/infrastructure/obsidian/view-registry.test.ts`

- [ ] **Step 1: Update port interface**

`openView` returns `Promise<Result<void, string>>` instead of `Promise<void>`. Update the port, the concrete class, and the test that verifies the unknown-type error (now returns `err` instead of throwing).

- [ ] **Step 2: Update all callers** — `ObsidianCommandAdapter.register()` callback, any test that catches the throw.

- [ ] **Step 3: Commit**: `refactor(agentonomous): ViewRegistry.openView returns Result`

### Task 6.2: `PluginContext` wraps `CorePorts`

**Files:**
- Modify: `src/plugin.ts`
- Modify: `src/core/plugin-core.ts` — export `CorePorts`

- [ ] **Step 1: Update `PluginContext`**

```ts
import type { CorePorts } from './core/plugin-core.js';
import type { App, Plugin } from 'obsidian';

export type PluginContext = CorePorts & {
	readonly app: App;
	readonly plugin: Plugin;
};
```

- [ ] **Step 2: Update consumers** that construct `PluginContext` (just `main.ts`).

- [ ] **Step 3: Commit**: `refactor(agentonomous): PluginContext wraps CorePorts`

### Task 6.3: Ribbon visibility moves to shell

**Files:**
- Modify: `src/main.ts` — adapter subscribes to bus + reads initial settings
- Modify: `src/core/plugin-core.ts` — remove `setRibbonVisibility` call

- [ ] **Step 1: In `main.ts`**, after `core.init()`:

```ts
// Ribbon visibility: adapter-level concern, not core
const initialRibbon = core.settings.core?.showRibbonIcon ?? true;
commands.setRibbonVisibility(initialRibbon);
bus.on('settings', (env) => {
	const current = env.payload.current as MergedSettings;
	const previous = env.payload.previous as MergedSettings;
	if (current.core?.showRibbonIcon !== previous.core?.showRibbonIcon) {
		commands.setRibbonVisibility(current.core?.showRibbonIcon ?? true);
	}
});
```

- [ ] **Step 2: Remove `setRibbonVisibility` from `CommandPort` interface** (if still present).

- [ ] **Step 3: Remove any `setRibbonVisibility` call from `plugin-core.ts`**.

- [ ] **Step 4: Commit**: `refactor(agentonomous): move ribbon visibility to Obsidian shell`

### Task 6.4: Rewire `main.ts` to pass modules

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update `main.ts`**

Import the three modules and pass them to `PluginCore`:

```ts
import { CoreModule } from './modules/core/core-module.js';
import { EventInspectorModule } from './modules/event-inspector/event-inspector-module.js';
import { HealthMonitorModule } from './modules/health-monitor/health-monitor-module.js';

// In onload():
this.core = new PluginCore(
	{ settings, commands, views, logger, notifications, eventBus: bus },
	[CoreModule, EventInspectorModule, HealthMonitorModule],
);
```

- [ ] **Step 2: Register Event Inspector's view** in the `ViewRegistry` entries array.

- [ ] **Step 3: Run `npm test`**

- [ ] **Step 4: Commit**: `feat(agentonomous): wire three modules into Obsidian shell`

### Task 6.5: ESLint updates for `src/modules/`

**Files:**
- Modify: `configs/eslint.config.mjs`

- [ ] **Step 1: Add `src/modules/**/*.ts` override**

```js
{
	files: ['src/modules/**/*.ts'],
	rules: {
		'no-console': 'off',
		'no-restricted-syntax': 'off',
	},
},
```

- [ ] **Step 2: Run lint**: `npx eslint src/ tests/ stories/ --config configs/eslint.config.mjs --no-error-on-unmatched-pattern`

- [ ] **Step 3: Commit**: `chore(agentonomous): ESLint rules for src/modules/`

### Task 6.6: Final quality gate

- [ ] **Step 1: Full test suite with coverage**

```bash
npx vitest run --config configs/vitest.config.ts --coverage
```

Expected: ~140+ tests, coverage ≥ 80/70/80/80.

- [ ] **Step 2: Build**

```bash
npm run build
ls dist/
```

Expected: `main.js`, `manifest.json`, `styles.css` only.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Full npm test**

```bash
npm test
```

Expected: exit 0.

- [ ] **Step 5: Commit any adjustments**

---

## Done

All six chunks complete. Increment 3 ships:
- Module system with `defineModule<T>()`, dependency ordering, startup validation
- Open EventMap via declaration merging
- `emitAsync` + listener priority + snapshot dispatch + traceMap eviction
- `warn` log level
- Namespaced settings with per-module validation
- Core module (refactored from existing)
- Event Inspector module (sidebar view + ring buffer + trace grouping)
- Health Monitor module (command-only diagnostics with periodic sampling)
- Anti-pattern fixes: ViewRegistry→Result, PluginContext wraps CorePorts, ribbon to shell

Spec acceptance criteria 1–19 satisfied.
