# Agent-Proof Production Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Agentonomous framework with 8 structural quality mechanisms: graceful module degradation, shared test fakes, settings migration, cross-module import ban, emitAsync backpressure, listener introspection, max-lines enforcement, and JSDoc documentation.

**Architecture:** All items are additive — they modify existing files or add test infrastructure without changing the module system's shape. `PluginCore` gains try/catch per module, a `degradedModules` getter, settings migration logic, and listener leak detection. The EventBus gains `listenerCount()` and `maxConcurrency` on `emitAsync`. ESLint gains two new rules. The `Module` interface gains JSDoc + two optional fields.

**Tech Stack:** TypeScript 6, Vitest 4, ESLint 10. No new runtime dependencies.

**Spec:** [`docs/specs/2026-04-16-agent-proof-foundation-design.md`](../specs/2026-04-16-agent-proof-foundation-design.md)

**Conventions:** Same as Increments 1-3. All paths relative to `01 - Projects/Agentonomous/`. Commits from `C:/Projects/flowti`. TDD. Tabs. `.js` imports.

---

## Chunk 1: All 8 items

Items are independent — implement in any order. Recommended order follows dependency: fakes first (used by later tests), then EventBus enhancements, then PluginCore changes, then ESLint + JSDoc.

### Task 1: Shared test fakes (S)

**Files:**
- Create: `tests/__fakes__/fake-ports.ts`
- Modify: all ~10 test files that construct inline fakes

- [ ] **Step 1: Create `tests/__fakes__/fake-ports.ts`**

```ts
import { vi } from 'vitest';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import type { SettingsPort } from '../../src/domain/settings/settings-port.js';
import type { CommandPort } from '../../src/domain/commands/command-port.js';
import type { ViewRegistryPort } from '../../src/domain/views/view-registry-port.js';
import type { ModulePorts } from '../../src/domain/shared/module.js';
import { ok } from '../../src/domain/shared/result.js';

export function fakeLogger(): LoggerPort {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		setLevel: vi.fn(),
	};
}

export function fakeSettings(initial: unknown = null): SettingsPort {
	let data = initial;
	const listeners = new Set<(s: unknown) => void>();
	return {
		load: vi.fn(async () => ok(data)),
		save: vi.fn(async (d: unknown) => { data = d; for (const l of listeners) l(d); return ok(undefined); }),
		subscribe: vi.fn((l: (s: unknown) => void) => { listeners.add(l); return () => { listeners.delete(l); }; }),
	};
}

export function fakeNotifications(): NotificationPort & { messages: string[] } {
	const messages: string[] = [];
	return {
		show: vi.fn((msg: string) => { messages.push(msg); }),
		messages,
	};
}

export function fakeCommands(): CommandPort & { registered: string[] } {
	const registered: string[] = [];
	return {
		register: vi.fn((entry: { id: string }) => { registered.push(entry.id); return () => {}; }),
		unregisterAll: vi.fn(),
		registered,
	};
}

export function fakeViews(): ViewRegistryPort {
	return {
		registerAll: vi.fn(),
		openView: vi.fn(async () => ok(undefined)),
	};
}

export function fakeModulePorts(overrides?: Partial<ModulePorts>): ModulePorts {
	return {
		eventBus: overrides?.eventBus ?? { on: vi.fn(() => () => {}), emit: vi.fn(), emitAsync: vi.fn(), onAny: vi.fn(() => () => {}), listenerCount: vi.fn(() => 0) } as never,
		logger: overrides?.logger ?? fakeLogger(),
		settings: overrides?.settings ?? fakeSettings(),
		notifications: overrides?.notifications ?? fakeNotifications(),
		views: overrides?.views ?? fakeViews(),
		...overrides,
	};
}
```

Note: `fakeModulePorts` composes a full `EventBus` fake inline since importing `createEventBus` would add a real dependency. Tests that need a real bus should pass `overrides: { eventBus: createEventBus() }`.

- [ ] **Step 2: Migrate existing test files**

Find all test files that define their own `fakeLogger`, `fakeSettings`, `fakeNotifications`, `fakeCommands`, `fakeViews`, or `fakeModulePorts`/`fakePorts` inline. Replace with imports from `../../__fakes__/fake-ports.js` (or adjust relative path per test location).

Key files to migrate:
- `tests/core/plugin-core.test.ts`
- `tests/core/logger.test.ts`
- `tests/core/error-handler.test.ts`
- `tests/modules/event-inspector/event-inspector-module.test.ts`
- `tests/modules/health-monitor/health-monitor-module.test.ts`

For each file: remove the inline fake function, add the import, verify types match. If a test needs a customized fake (e.g., `fakeSettings` with specific initial data), use the function parameter or `fakeModulePorts({ settings: fakeSettings(myData) })`.

- [ ] **Step 3: Run `npm test` — all 176 tests must pass**

- [ ] **Step 4: Commit**: `refactor(agentonomous): extract shared test fakes to tests/__fakes__/`

### Task 2: `runWithConcurrency` utility (TDD)

**Files:**
- Create: `src/domain/shared/utils/run-with-concurrency.ts`
- Create: `tests/domain/shared/utils/run-with-concurrency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '../../../../src/domain/shared/utils/run-with-concurrency.js';

describe('runWithConcurrency', () => {
	it('runs all tasks when limit is Infinity', async () => {
		const results: number[] = [];
		const tasks = [1, 2, 3].map((n) => () => { results.push(n); });
		await runWithConcurrency(tasks, Infinity);
		expect(results).toEqual([1, 2, 3]);
	});

	it('limits concurrent execution', async () => {
		let concurrent = 0;
		let maxConcurrent = 0;
		const tasks = Array.from({ length: 5 }, () => async () => {
			concurrent++;
			maxConcurrent = Math.max(maxConcurrent, concurrent);
			await new Promise((r) => { setTimeout(r, 10); });
			concurrent--;
		});
		await runWithConcurrency(tasks, 2);
		expect(maxConcurrent).toBe(2);
	});

	it('completes all tasks even with limit', async () => {
		const results: number[] = [];
		const tasks = [1, 2, 3, 4, 5].map((n) => async () => {
			await new Promise((r) => { setTimeout(r, 5); });
			results.push(n);
		});
		await runWithConcurrency(tasks, 2);
		expect(results).toHaveLength(5);
	});

	it('handles sync tasks in the pool', async () => {
		const results: number[] = [];
		const tasks = [1, 2, 3].map((n) => () => { results.push(n); });
		await runWithConcurrency(tasks, 1);
		expect(results).toEqual([1, 2, 3]);
	});

	it('handles empty task list', async () => {
		await runWithConcurrency([], 2);
	});
});
```

- [ ] **Step 2: Implement**

```ts
export async function runWithConcurrency(
	tasks: readonly (() => void | Promise<void>)[],
	limit: number,
): Promise<void> {
	if (!Number.isFinite(limit)) {
		await Promise.all(tasks.map((t) => t()));
		return;
	}
	let index = 0;
	async function next(): Promise<void> {
		while (index < tasks.length) {
			const i = index++;
			await tasks[i]();
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, tasks.length) }, () => next()),
	);
}
```

- [ ] **Step 3: Run — verify 5 tests pass**

- [ ] **Step 4: Commit**: `feat(agentonomous): add runWithConcurrency pool executor`

### Task 3: emitAsync backpressure + listenerCount (TDD)

**Files:**
- Modify: `src/domain/shared/event-bus.ts`
- Modify: `tests/domain/shared/event-bus.test.ts`

- [ ] **Step 1: Add tests**

```ts
describe('emitAsync backpressure', () => {
	it('limits concurrent listeners with maxConcurrency', async () => {
		const bus = createEventBus();
		let concurrent = 0;
		let maxConcurrent = 0;
		for (let i = 0; i < 5; i++) {
			bus.on('core', async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => { setTimeout(r, 10); });
				concurrent--;
			});
		}
		await bus.emitAsync('core', { phase: 'ready' }, { maxConcurrency: 2 });
		expect(maxConcurrent).toBe(2);
	});

	it('defaults to Infinity (all concurrent)', async () => {
		const bus = createEventBus();
		let concurrent = 0;
		let maxConcurrent = 0;
		for (let i = 0; i < 3; i++) {
			bus.on('core', async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => { setTimeout(r, 10); });
				concurrent--;
			});
		}
		await bus.emitAsync('core', { phase: 'ready' });
		expect(maxConcurrent).toBe(3);
	});
});

describe('listenerCount', () => {
	it('returns 0 for empty bus', () => {
		const bus = createEventBus();
		expect(bus.listenerCount()).toBe(0);
	});

	it('counts channel listeners', () => {
		const bus = createEventBus();
		bus.on('core', () => {});
		bus.on('core', () => {});
		bus.on('log', () => {});
		expect(bus.listenerCount('core')).toBe(2);
		expect(bus.listenerCount('log')).toBe(1);
		expect(bus.listenerCount()).toBe(3);
	});

	it('includes onAny listeners in total', () => {
		const bus = createEventBus();
		bus.on('core', () => {});
		bus.onAny(() => {});
		expect(bus.listenerCount()).toBe(2);
	});

	it('decreases after unsubscribe', () => {
		const bus = createEventBus();
		const unsub = bus.on('core', () => {});
		expect(bus.listenerCount('core')).toBe(1);
		unsub();
		expect(bus.listenerCount('core')).toBe(0);
	});
});
```

- [ ] **Step 2: Implement in `event-bus.ts`**

Add `maxConcurrency` to `emitAsync` opts. Import and use `runWithConcurrency` from `./utils/run-with-concurrency.js`. Add `listenerCount(channel?)` to the EventBus interface and implementation.

`listenerCount` implementation:
```ts
function listenerCount(channel?: keyof EventMap): number {
	if (channel !== undefined) {
		return channelListeners.get(channel as string)?.length ?? 0;
	}
	let total = anyListeners.length;
	for (const entries of channelListeners.values()) {
		total += entries.length;
	}
	return total;
}
```

(Adjust based on whether `channelListeners` values are arrays or Sets — they should be arrays after the Increment 3 priority refactor.)

- [ ] **Step 3: Run — verify new + existing tests pass**

- [ ] **Step 4: Commit**: `feat(agentonomous): add emitAsync maxConcurrency + listenerCount`

### Task 4: Graceful module degradation (TDD)

**Files:**
- Modify: `src/core/plugin-core.ts`
- Modify: `tests/core/plugin-core.test.ts`

- [ ] **Step 1: Add tests**

```ts
it('continues initializing other modules when one throws', async () => {
	const bus = createEventBus();
	const order: string[] = [];
	const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() {} });
	const healthy = defineModule({ id: 'healthy', name: 'Healthy', async init() { order.push('healthy'); }, destroy() {} });

	const core = new PluginCore(
		{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[broken, healthy],
	);
	await core.init();
	expect(core.ready).toBe(true);
	expect(order).toContain('healthy');
});

it('exposes degradedModules for failed modules', async () => {
	const bus = createEventBus();
	const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() {} });

	const core = new PluginCore(
		{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[broken],
	);
	await core.init();
	expect(core.degradedModules).toContain('broken');
});

it('emits core event with degraded: true when a module fails', async () => {
	const bus = createEventBus();
	const events: unknown[] = [];
	bus.on('core', (env) => { events.push(env.payload); });
	const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() {} });

	const core = new PluginCore(
		{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[broken],
	);
	await core.init();
	expect(events).toContainEqual(expect.objectContaining({ degraded: true }));
});

it('does not register commands for failed modules', async () => {
	const bus = createEventBus();
	const commands = fakeCommands();
	const broken = defineModule({
		id: 'broken', name: 'Broken',
		commands: [{ id: 'broken-cmd', name: 'Broken' }],
		async init() { throw new Error('boom'); },
		destroy() {},
	});

	const core = new PluginCore(
		{ settings: fakeSettings(), commands, views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[broken],
	);
	await core.init();
	expect(commands.registered).not.toContain('broken-cmd');
});

it('skips failed modules during destroy', async () => {
	const bus = createEventBus();
	const destroyCalls: string[] = [];
	const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() { destroyCalls.push('broken'); } });
	const healthy = defineModule({ id: 'healthy', name: 'Healthy', async init() {}, destroy() { destroyCalls.push('healthy'); } });

	const core = new PluginCore(
		{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[broken, healthy],
	);
	await core.init();
	core.destroy();
	expect(destroyCalls).toEqual(['healthy']);
	expect(destroyCalls).not.toContain('broken');
});
```

Use `fakeSettings`, `fakeCommands`, etc. from `tests/__fakes__/fake-ports.js` (Task 1).

- [ ] **Step 2: Implement in `plugin-core.ts`**

In the module init loop, wrap each `module.init()` in try/catch:
```ts
const initializedModuleIds = new Set<string>();
const degradedModuleIds: string[] = [];

for (const module of sortedModules) {
	try {
		await module.init(modulePorts, validatedSettings);
		initializedModuleIds.add(module.id);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		this.ports.logger.error('core', `Module "${module.id}" failed to initialize: ${msg}`);
		degradedModuleIds.push(module.id);
	}
}

// Register commands only for initialized modules
for (const module of sortedModules) {
	if (initializedModuleIds.has(module.id) && module.commands) {
		for (const cmd of module.commands) {
			this.ports.commands.register(cmd);
		}
	}
}
```

Add `get degradedModules(): readonly string[]` getter.

In `destroy()`, only call `module.destroy()` for modules in `initializedModuleIds`.

If any module failed, emit `core` with `degraded: true, errors: [...]` alongside the `ready` emission.

- [ ] **Step 3: Run — verify all tests pass**

- [ ] **Step 4: Commit**: `feat(agentonomous): graceful module degradation with degradedModules`

### Task 5: Listener leak detection in destroy (TDD)

**Files:**
- Modify: `src/core/plugin-core.ts`
- Modify: `tests/core/plugin-core.test.ts`

- [ ] **Step 1: Add test**

```ts
it('warns when a module leaks listeners during destroy', async () => {
	const bus = createEventBus();
	const logger = fakeLogger();
	const leaky = defineModule({
		id: 'leaky', name: 'Leaky',
		async init(ports) {
			ports.eventBus.on('core', () => {}); // subscribes but destroy doesn't unsubscribe
		},
		destroy() { /* intentionally does NOT unsubscribe */ },
	});

	const core = new PluginCore(
		{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger, notifications: fakeNotifications(), eventBus: bus },
		[leaky],
	);
	await core.init();
	core.destroy();
	expect(logger.warn).toHaveBeenCalledWith('core', expect.stringContaining('leaky'));
});
```

- [ ] **Step 2: Implement**

In `destroy()`, before calling each `module.destroy()`:
```ts
const before = this.ports.eventBus.listenerCount();
module.destroy();
const after = this.ports.eventBus.listenerCount();
if (after >= before) {
	this.ports.logger.warn('core', `Module "${module.id}" may have leaked event listener(s)`);
}
```

- [ ] **Step 3: Run — verify passes**

- [ ] **Step 4: Commit**: `feat(agentonomous): listener leak detection in PluginCore.destroy`

### Task 6: Settings migration framework (TDD)

**Files:**
- Modify: `src/domain/shared/module.ts`
- Modify: `src/core/plugin-core.ts`
- Modify: `tests/core/plugin-core.test.ts`

- [ ] **Step 1: Add `settingsVersion` and `migrate` to Module + defineModule**

In `src/domain/shared/module.ts`, add to both `Module` interface and `defineModule` parameter type:
```ts
readonly settingsVersion?: number;
migrate?(fromVersion: number, blob: unknown): Result<unknown, string>;
```

- [ ] **Step 2: Add migration tests**

```ts
it('calls migrate() when settings version is behind', async () => {
	const bus = createEventBus();
	const migrateFn = vi.fn((fromVersion: number, blob: unknown) => {
		return ok({ ...(blob as Record<string, unknown>), migrated: true, _version: 2 });
	});
	const m = defineModule<{ color: string }>({
		id: 'test', name: 'Test',
		settingsKey: 'test',
		settingsVersion: 2,
		settingsDefaults: { color: 'blue' },
		migrate: migrateFn,
		async init() {},
		destroy() {},
	});

	const settings = fakeSettings({ test: { _version: 1, color: 'red' } });
	const core = new PluginCore(
		{ settings, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[m],
	);
	await core.init();
	expect(migrateFn).toHaveBeenCalledWith(1, expect.objectContaining({ color: 'red' }));
});

it('falls back to defaults when migrate returns err', async () => {
	const bus = createEventBus();
	const receivedSettings: unknown[] = [];
	const m = defineModule<{ color: string }>({
		id: 'test', name: 'Test',
		settingsKey: 'test',
		settingsVersion: 2,
		settingsDefaults: { color: 'blue' },
		migrate: () => ({ kind: 'err', error: 'migration failed' }),
		async init(_ports, settings) { receivedSettings.push(settings); },
		destroy() {},
	});

	const settings = fakeSettings({ test: { _version: 1, color: 'red' } });
	const core = new PluginCore(
		{ settings, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[m],
	);
	await core.init();
	expect(receivedSettings[0]).toEqual({ color: 'blue' });
});

it('skips migration when no settingsVersion declared', async () => {
	const bus = createEventBus();
	const receivedSettings: unknown[] = [];
	const m = defineModule<{ color: string }>({
		id: 'test', name: 'Test',
		settingsKey: 'test',
		settingsDefaults: { color: 'blue' },
		async init(_ports, settings) { receivedSettings.push(settings); },
		destroy() {},
	});

	const settings = fakeSettings({ test: { color: 'red' } });
	const core = new PluginCore(
		{ settings, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus },
		[m],
	);
	await core.init();
	expect(receivedSettings[0]).toEqual(expect.objectContaining({ color: 'red' }));
});
```

- [ ] **Step 3: Implement migration in `PluginCore`**

In the settings-resolution phase of `init()`, after extracting each module's section:

```ts
if (module.settingsVersion !== undefined && module.migrate !== undefined) {
	let version = (section as Record<string, unknown>)?._version as number ?? 0;
	let current = section;
	const maxIterations = module.settingsVersion - version;
	let iterations = 0;

	while (version < module.settingsVersion && iterations < maxIterations + 1) {
		const migrated = module.migrate(version, current);
		if (migrated.kind === 'err') {
			this.ports.logger.warn('core', `Migration failed for "${module.id}": ${migrated.error}`);
			current = module.settingsDefaults;
			break;
		}
		current = migrated.value;
		version++;
		iterations++;
	}

	// Store migrated version
	if (typeof current === 'object' && current !== null) {
		(current as Record<string, unknown>)._version = module.settingsVersion;
	}
	validatedSettings = current;
}
```

Save the migrated blob back after all modules are processed.

- [ ] **Step 4: Run — verify all tests pass**

- [ ] **Step 5: Commit**: `feat(agentonomous): settings migration framework`

### Task 7: Cross-module import ban + max-lines error (ESLint)

**Files:**
- Modify: `configs/eslint.config.mjs`

- [ ] **Step 1: Add cross-module import ban**

In the existing `src/modules/**` ESLint block, add `no-restricted-imports`:

```js
{
	files: ['src/modules/**/*.ts', 'src/modules/**/*.vue'],
	rules: {
		'no-console': 'off',
		'no-restricted-syntax': 'off',
		'no-restricted-imports': ['error', {
			patterns: [{
				group: ['**/modules/*/*'],
				message: 'Modules must not import from other modules — use EventBus for cross-module communication',
			}],
		}],
	},
},
```

- [ ] **Step 2: Add max-lines error for domain + modules**

Add a new block:
```js
{
	files: ['src/domain/**/*.ts', 'src/modules/**/*.ts'],
	rules: {
		'max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
	},
},
```

- [ ] **Step 3: Run lint**

```bash
npx eslint src/ tests/ stories/ --config configs/eslint.config.mjs --no-error-on-unmatched-pattern
```

Expected: 0 errors. If any existing domain/module file exceeds 350 lines, it must be split (unlikely — all files are currently well under 200 lines).

- [ ] **Step 4: Verify cross-module ban works** — create a temporary probe file `src/modules/health-monitor/__probe.ts` that imports from `../../modules/event-inspector/event-inspector-module.js`. Run lint — should error. Delete the probe file.

- [ ] **Step 5: Commit**: `chore(agentonomous): ESLint cross-module ban + max-lines error for domain/modules`

### Task 8: JSDoc on Module interface

**Files:**
- Modify: `src/domain/shared/module.ts`

- [ ] **Step 1: Add JSDoc to every field of `Module`**

```ts
export interface Module {
	/** Unique identifier across all registered modules. Duplicates are fatal at startup. */
	readonly id: string;

	/** Human-readable name for logs, settings UI, and health reports. */
	readonly name: string;

	/** Module IDs that must complete init() before this one. Circular deps are fatal. Unknown deps are fatal. */
	readonly dependsOn?: readonly string[];

	/** Key in the merged settings blob. Must not collide across modules. Omit for modules with no settings. */
	readonly settingsKey?: string;

	/** Default settings used when no persisted data exists or validation fails. */
	readonly settingsDefaults?: unknown;

	/** Schema version for settings migration. Increment when the settings shape changes. */
	readonly settingsVersion?: number;

	/** Validates raw persisted settings blob. Return ok(validated) or err(reason). On err, defaults are used. */
	validateSettings?(raw: unknown): Result<unknown, string>;

	/** Migrates settings from an older version. Called in a loop until version matches settingsVersion. */
	migrate?(fromVersion: number, blob: unknown): Result<unknown, string>;

	/** Commands to register with Obsidian. Declared as data; PluginCore handles registration. */
	readonly commands?: readonly CommandEntry[];

	/** Called after dependencies are ready. Receives scoped ports and validated settings. May subscribe to EventBus. */
	init(ports: ModulePorts, settings: unknown): Promise<void>;

	/** Called on plugin unload in reverse dependency order. Must unsubscribe all listeners and clear intervals. */
	destroy(): void;
}
```

- [ ] **Step 2: Add JSDoc to `defineModule`**

```ts
/**
 * Type-safe module builder. Preserves TSettings at the definition site
 * for compile-time safety, then erases to Module (unknown settings)
 * for the heterogeneous collection in PluginCore.
 *
 * Required way to create modules. Direct Module literals lose type safety.
 */
export function defineModule<TSettings = unknown>(def: { ... }): Module;
```

- [ ] **Step 3: Add JSDoc to `ModulePorts`**

```ts
export interface ModulePorts {
	/** Typed pub/sub for cross-module communication. The only sanctioned coupling mechanism. */
	readonly eventBus: EventBus;
	/** Structured logger (debug/info/warn/error). Dual console + bus output. */
	readonly logger: LoggerPort;
	/** Load/save the merged settings blob. Modules read only their own settingsKey section. */
	readonly settings: SettingsPort;
	/** Show user-facing toast notifications. Use for user-severity errors only. */
	readonly notifications: NotificationPort;
	/** Register and open Obsidian views. */
	readonly views: ViewRegistryPort;
}
```

- [ ] **Step 4: Run `npm run docs`** — verify TypeDoc generates meaningful output with the new JSDoc.

- [ ] **Step 5: Run `npm test`** — verify nothing broke.

- [ ] **Step 6: Commit**: `docs(agentonomous): JSDoc on Module, ModulePorts, defineModule`

### Task 9: Final quality gate

- [ ] **Step 1: Full test suite with coverage**

```bash
npx vitest run --config configs/vitest.config.ts --coverage
```

Expected: ~190+ tests, coverage ≥ 80/70/80/80. If thresholds are missed, add targeted tests.

- [ ] **Step 2: Build**

```bash
npm run build
ls dist/
```

Expected: `main.js`, `manifest.json`, `styles.css` only.

- [ ] **Step 3: Full lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Full npm test**

```bash
npm test
```

Expected: exit 0.

- [ ] **Step 5: Commit any final adjustments**

---

## Done

All 8 items shipped:
1. Shared test fakes in `tests/__fakes__/fake-ports.ts`
2. `runWithConcurrency` pool executor
3. `emitAsync` backpressure via `maxConcurrency` + `listenerCount()` on EventBus
4. Graceful module degradation with `degradedModules` getter
5. Listener leak detection in `PluginCore.destroy()`
6. Settings migration framework (`settingsVersion` + `migrate()`)
7. ESLint: cross-module import ban + max-lines error for domain/modules
8. JSDoc on Module, ModulePorts, defineModule

Spec acceptance criteria 1-10 satisfied.
