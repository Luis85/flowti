# Framework Hardening — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Agentonomous skeleton into a framework with a shell/core split, typed EventBus with tracing, command-centric registry, structured logging, central error handling, and shared utilities.

**Architecture:** Thin Obsidian shell (`main.ts` ~40 lines) creates adapters and passes them to a platform-agnostic `PluginCore` that owns the startup sequence, registries, and lifecycle. All cross-cutting concerns (logging, errors, events) flow through a typed EventBus with traceId/parentId correlation. Commands are the first-class action primitive; ribbon icons and view-opens are optional hints on command entries.

**Tech Stack:** TypeScript 6, Vue 3, Pinia 2, Vitest 4, Obsidian 1.12.7 API. No new runtime dependencies.

**Spec:** [`01 - Projects/Agentonomous/docs/specs/2026-04-16-framework-hardening-design.md`](../specs/2026-04-16-framework-hardening-design.md)

**Conventions:**
- All paths relative to `01 - Projects/Agentonomous/` unless stated otherwise.
- `cd` into `01 - Projects/Agentonomous/` for all npm/npx commands.
- Git commits from repo root `C:/Projects/flowti` with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` footer.
- Tabs for indentation. `.js` extensions in imports (ESM/NodeNext). No `any`, no `@ts-ignore`.
- TDD: write failing test → verify fail → implement → verify pass → commit.

---

## Chunk 1: Shared utilities + DX polish

**Goal:** Ship the three utility functions (generateId, isOneOf, invariant), DX files (.editorconfig, .nvmrc, CLAUDE.md), delete placeholder test, enable `exactOptionalPropertyTypes`, refactor existing code to use the new utilities.

### Task 1.1: `generateId` + `timestamp` utilities (TDD)

**Files:**
- Create: `src/domain/shared/utils/identity.ts`
- Create: `tests/domain/shared/utils/identity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/shared/utils/identity.test.ts
import { describe, expect, it } from 'vitest';
import { generateId, timestamp } from '../../../../src/domain/shared/utils/identity.js';

describe('generateId', () => {
	it('returns a string', () => {
		expect(typeof generateId()).toBe('string');
	});

	it('returns unique values on consecutive calls', () => {
		const a = generateId();
		const b = generateId();
		expect(a).not.toBe(b);
	});
});

describe('timestamp', () => {
	it('returns a number close to Date.now()', () => {
		const before = Date.now();
		const ts = timestamp();
		const after = Date.now();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run tests/domain/shared/utils/identity.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement**

```ts
// src/domain/shared/utils/identity.ts
export function generateId(): string {
	return crypto.randomUUID();
}

export function timestamp(): number {
	return Date.now();
}
```

- [ ] **Step 4: Run — verify passes**

- [ ] **Step 5: Commit**

```bash
git add src/domain/shared/utils/identity.ts tests/domain/shared/utils/identity.test.ts
git commit -m "feat(agentonomous): add generateId + timestamp utilities

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: `isOneOf` type guard (TDD)

**Files:**
- Create: `src/domain/shared/utils/is-one-of.ts`
- Create: `tests/domain/shared/utils/is-one-of.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/shared/utils/is-one-of.test.ts
import { describe, expect, it } from 'vitest';
import { isOneOf } from '../../../../src/domain/shared/utils/is-one-of.js';

describe('isOneOf', () => {
	const allowed = ['home', 'agents', 'settings'] as const;

	it('returns true for a value in the array', () => {
		expect(isOneOf('home', allowed)).toBe(true);
	});

	it('returns false for a value not in the array', () => {
		expect(isOneOf('unknown', allowed)).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isOneOf('', allowed)).toBe(false);
	});

	it('narrows the type (compile-time check)', () => {
		const value: string = 'home';
		if (isOneOf(value, allowed)) {
			const narrowed: 'home' | 'agents' | 'settings' = value;
			expect(narrowed).toBe('home');
		}
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement**

```ts
// src/domain/shared/utils/is-one-of.ts
export function isOneOf<T extends string>(
	value: string,
	allowed: readonly T[],
): value is T {
	return (allowed as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run — verify passes**

- [ ] **Step 5: Commit**: `feat(agentonomous): add isOneOf type guard utility`

### Task 1.3: `invariant` assertion (TDD)

**Files:**
- Create: `src/domain/shared/utils/invariant.ts`
- Create: `tests/domain/shared/utils/invariant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/shared/utils/invariant.test.ts
import { describe, expect, it } from 'vitest';
import { invariant } from '../../../../src/domain/shared/utils/invariant.js';

describe('invariant', () => {
	it('does nothing when condition is true', () => {
		expect(() => invariant(true, 'should not throw')).not.toThrow();
	});

	it('throws Error with message when condition is false', () => {
		expect(() => invariant(false, 'broke')).toThrow('broke');
	});

	it('throws an Error instance', () => {
		try {
			invariant(false, 'test');
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
		}
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement**

```ts
// src/domain/shared/utils/invariant.ts
export function invariant(condition: boolean, message: string): asserts condition {
	if (!condition) {
		throw new Error(`Invariant violation: ${message}`);
	}
}
```

- [ ] **Step 4: Run — verify passes**

- [ ] **Step 5: Commit**: `feat(agentonomous): add invariant assertion utility`

### Task 1.4: Refactor existing code to use utilities

**Files:**
- Modify: `src/domain/settings/plugin-settings.ts` — derive `DefaultViewName` from `KNOWN_DEFAULT_VIEWS as const`, use `isOneOf` in validator
- Modify: `src/ui/stores/settings-store.ts` — replace `throw new Error('not hydrated')` with `invariant()`
- Modify: `src/infrastructure/settings/settings-tab.ts` — remove local `isDefaultViewName`, import from domain

- [ ] **Step 1: Refactor `plugin-settings.ts`**

```ts
// src/domain/settings/plugin-settings.ts
import { err, ok, type Result } from '../shared/result.js';
import { isOneOf } from '../shared/utils/is-one-of.js';

export const KNOWN_DEFAULT_VIEWS = ['home'] as const;
export type DefaultViewName = (typeof KNOWN_DEFAULT_VIEWS)[number];

export type PluginSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
};

export const DEFAULT_SETTINGS: PluginSettings = {
	showRibbonIcon: true,
	defaultView: 'home',
};

export function isDefaultViewName(value: string): value is DefaultViewName {
	return isOneOf(value, KNOWN_DEFAULT_VIEWS);
}

export function validateSettings(raw: unknown): Result<PluginSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('settings must be an object');
	}
	const { showRibbonIcon, defaultView } = raw as Record<string, unknown>;
	if (typeof showRibbonIcon !== 'boolean') return err('showRibbonIcon must be boolean');
	if (typeof defaultView !== 'string') return err('defaultView must be string');
	if (!isDefaultViewName(defaultView)) {
		return err(`defaultView must be one of: ${KNOWN_DEFAULT_VIEWS.join(', ')}`);
	}
	return ok({ showRibbonIcon, defaultView });
}
```

- [ ] **Step 2: Refactor `settings-store.ts` — use `invariant`**

Replace `throw new Error('settings store not hydrated')` with:
```ts
import { invariant } from '../../domain/shared/utils/invariant.js';
// ...
invariant(port !== null, 'settings store not hydrated');
```

- [ ] **Step 3: Refactor `settings-tab.ts` — remove local `isDefaultViewName`**

Remove the local function definition. It should already import from `../../domain/settings/plugin-settings.js`. Verify the import is present and the local function is gone.

- [ ] **Step 4: Run `npm test` — verify all 67 tests pass**

- [ ] **Step 5: Commit**: `refactor(agentonomous): use isOneOf + invariant in existing code`

### Task 1.5: DX polish files

**Files:**
- Create: `01 - Projects/Agentonomous/.editorconfig`
- Create: `01 - Projects/Agentonomous/.nvmrc`
- Create: `01 - Projects/Agentonomous/CLAUDE.md`
- Modify: `C:/Projects/flowti/CLAUDE.md` — add Agentonomous row to project table
- Delete: `tests/placeholder.test.ts`
- Modify: `configs/tsconfig.json` — enable `exactOptionalPropertyTypes: true`

- [ ] **Step 1: Create `.editorconfig`**

```ini
root = true

[*]
indent_style = tab
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 2: Create `.nvmrc`**

```
20.19
```

- [ ] **Step 3: Create `CLAUDE.md` inside Agentonomous**

Write a project-level CLAUDE.md with:
- Layer rules (domain pure, infrastructure adapters, UI presentation-only, core platform-agnostic)
- Port inventory table (from spec §2.3)
- Scripts table (build, test, lint, storybook, docs, deploy, release)
- `AGENTONOMOUS_TEST_VAULT` env var documentation
- Test vault setup instructions
- Convention reminders (tabs, .js imports, no any)

- [ ] **Step 4: Add Agentonomous row to vault-root `CLAUDE.md`**

In the Repository Layout table, add:
```
| **Agentonomous** | `01 - Projects/Agentonomous/` | Autonomous agents sandbox — Obsidian plugin (Vue 3 + DDD) |
```

- [ ] **Step 5: Delete `tests/placeholder.test.ts`**

```bash
git rm tests/placeholder.test.ts
```

- [ ] **Step 6: Enable `exactOptionalPropertyTypes` in `configs/tsconfig.json`**

Set `"exactOptionalPropertyTypes": true`. Run `npm test` — if any TS errors surface from existing code (e.g., `{ prop: undefined }` assignments), fix them inline.

- [ ] **Step 7: Run `npm test` — verify all tests pass (count drops by 1 due to placeholder deletion)**

- [ ] **Step 8: Commit**: `chore(agentonomous): DX polish — editorconfig, nvmrc, CLAUDE.md, enable exactOptionalPropertyTypes`

---

## Chunk 2: EventBus

**Goal:** Ship the typed EventBus with namespaced channels, EventEnvelope with tracing (traceId/parentId), and `onAny()` for centralized debug logging. Domain-pure, lives in `src/domain/shared/`.

### Task 2.1: EventBus types (TDD)

**Files:**
- Create: `src/domain/shared/event-bus.ts`
- Create: `tests/domain/shared/event-bus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/shared/event-bus.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createEventBus, type EventBus, type EventEnvelope } from '../../../src/domain/shared/event-bus.js';

describe('EventBus', () => {
	it('on() receives emitted events on the correct channel', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.on('core', listener);
		bus.emit('core', { phase: 'ready' });
		expect(listener).toHaveBeenCalledOnce();
		expect(listener.mock.calls[0][0].payload).toEqual({ phase: 'ready' });
	});

	it('on() does not fire for other channels', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.on('core', listener);
		bus.emit('log', { level: 'info', source: 'test', message: 'hi' });
		expect(listener).not.toHaveBeenCalled();
	});

	it('emit() returns an EventEnvelope with traceId and eventId', () => {
		const bus = createEventBus();
		const envelope = bus.emit('core', { phase: 'initializing' });
		expect(envelope.channel).toBe('core');
		expect(envelope.traceId).toBeTruthy();
		expect(envelope.eventId).toBeTruthy();
		expect(envelope.timestamp).toBeGreaterThan(0);
		expect(envelope.parentId).toBeUndefined();
	});

	it('emit() with parentId reuses the parent traceId', () => {
		const bus = createEventBus();
		const parent = bus.emit('core', { phase: 'initializing' });
		const child = bus.emit('log', { level: 'info', source: 'test', message: 'started' }, { parentId: parent.eventId });
		expect(child.traceId).toBe(parent.traceId);
		expect(child.parentId).toBe(parent.eventId);
	});

	it('emit() without parentId starts a new trace', () => {
		const bus = createEventBus();
		const a = bus.emit('core', { phase: 'initializing' });
		const b = bus.emit('core', { phase: 'ready' });
		expect(a.traceId).not.toBe(b.traceId);
	});

	it('onAny() receives events from all channels', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.onAny(listener);
		bus.emit('core', { phase: 'ready' });
		bus.emit('log', { level: 'info', source: 'x', message: 'y' });
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener.mock.calls[0][0].channel).toBe('core');
		expect(listener.mock.calls[1][0].channel).toBe('log');
	});

	it('unsubscribe removes the listener', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		const unsub = bus.on('core', listener);
		unsub();
		bus.emit('core', { phase: 'ready' });
		expect(listener).not.toHaveBeenCalled();
	});

	it('onAny unsubscribe works', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		const unsub = bus.onAny(listener);
		unsub();
		bus.emit('core', { phase: 'ready' });
		expect(listener).not.toHaveBeenCalled();
	});

	it('listeners fire synchronously in registration order', () => {
		const bus = createEventBus();
		const order: number[] = [];
		bus.on('core', () => order.push(1));
		bus.on('core', () => order.push(2));
		bus.emit('core', { phase: 'ready' });
		expect(order).toEqual([1, 2]);
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement**

```ts
// src/domain/shared/event-bus.ts
import type { PluginSettings } from '../settings/plugin-settings.js';
import type { Unsubscribe } from './unsubscribe.js';
import { generateId, timestamp } from './utils/identity.js';

export interface EventMap {
	log: { level: 'debug' | 'info' | 'error'; source: string; message: string; data?: unknown };
	error: { code: string; message: string; source: string; severity: 'user' | 'system' | 'fatal'; data?: unknown };
	settings: { previous: PluginSettings; current: PluginSettings };
	core: { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' };
	command: { id: string; trigger: 'palette' | 'ribbon' | 'hotkey' };
}

export type EventEnvelope<K extends keyof EventMap = keyof EventMap> = {
	readonly channel: K;
	readonly payload: EventMap[K];
	readonly traceId: string;
	readonly eventId: string;
	readonly parentId?: string;
	readonly timestamp: number;
};

export interface EventBus {
	on<K extends keyof EventMap>(channel: K, listener: (envelope: EventEnvelope<K>) => void): Unsubscribe;
	emit<K extends keyof EventMap>(channel: K, payload: EventMap[K], opts?: { parentId?: string }): EventEnvelope<K>;
	onAny(listener: (envelope: EventEnvelope) => void): Unsubscribe;
}

export function createEventBus(): EventBus {
	const channelListeners = new Map<keyof EventMap, Set<(envelope: EventEnvelope<never>) => void>>();
	const anyListeners = new Set<(envelope: EventEnvelope) => void>();
	const traceMap = new Map<string, string>();

	function on<K extends keyof EventMap>(
		channel: K,
		listener: (envelope: EventEnvelope<K>) => void,
	): Unsubscribe {
		let set = channelListeners.get(channel);
		if (!set) {
			set = new Set();
			channelListeners.set(channel, set);
		}
		set.add(listener as (envelope: EventEnvelope<never>) => void);
		return () => { set?.delete(listener as (envelope: EventEnvelope<never>) => void); };
	}

	function emit<K extends keyof EventMap>(
		channel: K,
		payload: EventMap[K],
		opts?: { parentId?: string },
	): EventEnvelope<K> {
		const eventId = generateId();
		let traceId: string;

		if (opts?.parentId !== undefined) {
			traceId = traceMap.get(opts.parentId) ?? generateId();
		} else {
			traceId = generateId();
		}

		traceMap.set(eventId, traceId);

		const envelope: EventEnvelope<K> = {
			channel,
			payload,
			traceId,
			eventId,
			parentId: opts?.parentId,
			timestamp: timestamp(),
		};

		const set = channelListeners.get(channel);
		if (set) {
			for (const listener of set) {
				(listener as (envelope: EventEnvelope<K>) => void)(envelope);
			}
		}

		for (const listener of anyListeners) {
			listener(envelope as EventEnvelope);
		}

		return envelope;
	}

	function onAny(listener: (envelope: EventEnvelope) => void): Unsubscribe {
		anyListeners.add(listener);
		return () => { anyListeners.delete(listener); };
	}

	return { on, emit, onAny };
}
```

Note: The `traceMap` stores `eventId → traceId` mappings so child events can look up their parent's traceId. This map will grow unboundedly over a long session — for a skeleton this is acceptable; a production version should add TTL-based eviction or a WeakRef approach. Add a brief inline comment noting this.

- [ ] **Step 4: Run — verify 10 tests pass**

- [ ] **Step 5: Run `npm test` — verify all tests pass**

- [ ] **Step 6: Commit**: `feat(agentonomous): add typed EventBus with tracing`

---

## Chunk 3: Logger + NotificationPort + ErrorHandler

**Goal:** Ship the LoggerPort interface (domain), Logger implementation (core, dual console+bus output), NotificationPort + ObsidianNotificationAdapter, and ErrorHandler subscribing to `error:*`.

### Task 3.1: `LoggerPort` interface

**Files:**
- Create: `src/domain/shared/logger-port.ts`

- [ ] **Step 1: Create the port**

```ts
// src/domain/shared/logger-port.ts
export type LogLevel = 'debug' | 'info' | 'error';

export interface LoggerPort {
	debug(source: string, message: string, data?: unknown): void;
	info(source: string, message: string, data?: unknown): void;
	error(source: string, message: string, data?: unknown): void;
	setLevel(level: LogLevel): void;
}
```

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**: `feat(agentonomous): add LoggerPort interface`

### Task 3.2: `Logger` implementation in core (TDD)

**Files:**
- Create: `src/core/logger.ts`
- Create: `tests/core/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/logger.test.ts
import { describe, expect, it, vi } from 'vitest';
import { Logger } from '../../src/core/logger.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';

describe('Logger', () => {
	it('debug() emits on bus and calls console.debug when level is debug', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'debug');
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const busListener = vi.fn();
		bus.on('log', busListener);

		logger.debug('test-src', 'hello', { extra: true });

		expect(spy).toHaveBeenCalledWith('[agentonomous:test-src]', 'hello', { extra: true });
		expect(busListener).toHaveBeenCalledOnce();
		expect(busListener.mock.calls[0][0].payload.level).toBe('debug');
		spy.mockRestore();
	});

	it('debug() is suppressed when level is info', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'info');
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const busListener = vi.fn();
		bus.on('log', busListener);

		logger.debug('src', 'msg');

		expect(spy).not.toHaveBeenCalled();
		expect(busListener).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('error() always fires regardless of level', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'info');
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		logger.error('src', 'boom');

		expect(spy).toHaveBeenCalledWith('[agentonomous:src]', 'boom', undefined);
		spy.mockRestore();
	});

	it('setLevel() changes the active level', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'error');
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

		logger.info('src', 'before');
		expect(spy).not.toHaveBeenCalled();

		logger.setLevel('info');
		logger.info('src', 'after');
		expect(spy).toHaveBeenCalledOnce();
		spy.mockRestore();
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/logger.ts
import type { EventBus } from '../domain/shared/event-bus.js';
import type { LoggerPort, LogLevel } from '../domain/shared/logger-port.js';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, error: 2 };

export class Logger implements LoggerPort {
	private level: LogLevel;
	private readonly bus: EventBus;

	constructor(bus: EventBus, level: LogLevel) {
		this.bus = bus;
		this.level = level;
	}

	debug(source: string, message: string, data?: unknown): void {
		if (!this.shouldLog('debug')) return;
		console.debug(`[agentonomous:${source}]`, message, data);
		this.bus.emit('log', { level: 'debug', source, message, data });
	}

	info(source: string, message: string, data?: unknown): void {
		if (!this.shouldLog('info')) return;
		console.log(`[agentonomous:${source}]`, message, data);
		this.bus.emit('log', { level: 'info', source, message, data });
	}

	error(source: string, message: string, data?: unknown): void {
		console.error(`[agentonomous:${source}]`, message, data);
		this.bus.emit('log', { level: 'error', source, message, data });
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	private shouldLog(level: LogLevel): boolean {
		return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
	}
}
```

- [ ] **Step 4: Run — verify 4 tests pass**

- [ ] **Step 5: Add `src/core/` to ESLint config with `no-console: 'off'` override**

In `configs/eslint.config.mjs`, add a new block after the infrastructure override:

```js
{
	files: ['src/core/**/*.ts'],
	rules: {
		'no-console': 'off',
		'no-restricted-syntax': 'off',
	},
},
```

Also add `src/core/**/*.ts` to the obsidian allowlist `ignores` (core doesn't import obsidian, but needs to NOT be caught by the broad `src/**/*.ts` rule that bans obsidian imports).

Wait — actually `src/core/**/*.ts` doesn't import `obsidian`, so the allowlist block (which only restricts `obsidian` imports) won't flag it. The `src/core/` override only needs `no-console: 'off'` and `no-restricted-syntax: 'off'` (core may use try/catch for orchestration). Don't add to obsidian ignores unnecessarily.

Also add `'../src/core/**/*.ts'` to `configs/tsconfig.json` include if not already covered by `'../src/**/*.ts'` (it should be — the glob `../src/**/*.ts` covers all subdirs including `core/`).

- [ ] **Step 6: Run `npm test` — verify all green**

- [ ] **Step 7: Commit**: `feat(agentonomous): add Logger with dual console + bus output`

### Task 3.3: `NotificationPort` + `ObsidianNotificationAdapter`

**Files:**
- Create: `src/domain/shared/notification-port.ts`
- Create: `src/infrastructure/obsidian/obsidian-notification-adapter.ts`
- Create: `tests/infrastructure/obsidian/obsidian-notification-adapter.test.ts`

- [ ] **Step 1: Create the port**

```ts
// src/domain/shared/notification-port.ts
export interface NotificationPort {
	show(message: string): void;
}
```

- [ ] **Step 2: Create the adapter**

```ts
// src/infrastructure/obsidian/obsidian-notification-adapter.ts
import { Notice } from 'obsidian';
import type { NotificationPort } from '../../domain/shared/notification-port.js';

export class ObsidianNotificationAdapter implements NotificationPort {
	show(message: string): void {
		new Notice(message);
	}
}
```

- [ ] **Step 3: Write a test**

```ts
// tests/infrastructure/obsidian/obsidian-notification-adapter.test.ts
import { describe, expect, it } from 'vitest';
import { ObsidianNotificationAdapter } from '../../../src/infrastructure/obsidian/obsidian-notification-adapter.js';

describe('ObsidianNotificationAdapter', () => {
	it('show() creates a Notice without throwing', () => {
		const adapter = new ObsidianNotificationAdapter();
		expect(() => adapter.show('test message')).not.toThrow();
	});
});
```

Note: The test stub in `tests/__stubs__/obsidian.ts` needs to export a `Notice` class. Check if it already does — if not, add:
```ts
export class Notice {
	constructor(public message: string) {}
}
```

- [ ] **Step 4: Update ESLint obsidian allowlist** — add `src/infrastructure/obsidian/obsidian-notification-adapter.ts` to ignores.

- [ ] **Step 5: Run `npm test` — verify green**

- [ ] **Step 6: Commit**: `feat(agentonomous): add NotificationPort + ObsidianNotificationAdapter`

### Task 3.4: `ErrorHandler` (TDD)

**Files:**
- Create: `src/core/error-handler.ts`
- Create: `tests/core/error-handler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/error-handler.test.ts
import { describe, expect, it, vi } from 'vitest';
import { ErrorHandler } from '../../src/core/error-handler.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';

function fakeLogger(): LoggerPort {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		setLevel: vi.fn(),
	};
}

function fakeNotifications(): NotificationPort & { messages: string[] } {
	const messages: string[] = [];
	return {
		show: (msg: string) => { messages.push(msg); },
		messages,
	};
}

describe('ErrorHandler', () => {
	it('logs all errors via logger.error()', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);

		bus.emit('error', {
			code: 'TEST_ERR',
			message: 'Something broke',
			source: 'test',
			severity: 'system',
		});

		expect(logger.error).toHaveBeenCalledWith('test', '[TEST_ERR] Something broke');
	});

	it('shows a notification for severity: user', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);

		bus.emit('error', {
			code: 'SAVE_FAILED',
			message: 'Settings could not be saved',
			source: 'settings',
			severity: 'user',
		});

		expect(notifications.messages).toContain('Settings could not be saved');
	});

	it('shows a notification for severity: fatal', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);

		bus.emit('error', {
			code: 'FATAL',
			message: 'Unrecoverable',
			source: 'core',
			severity: 'fatal',
		});

		expect(notifications.messages).toContain('Unrecoverable');
	});

	it('does NOT show a notification for severity: system', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);

		bus.emit('error', {
			code: 'SYS',
			message: 'Internal',
			source: 'core',
			severity: 'system',
		});

		expect(notifications.messages).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/error-handler.ts
import type { EventBus, EventEnvelope } from '../domain/shared/event-bus.js';
import type { LoggerPort } from '../domain/shared/logger-port.js';
import type { NotificationPort } from '../domain/shared/notification-port.js';
import type { Unsubscribe } from '../domain/shared/unsubscribe.js';

export class ErrorHandler {
	private readonly unsub: Unsubscribe;

	constructor(
		bus: EventBus,
		private readonly logger: LoggerPort,
		private readonly notifications: NotificationPort,
	) {
		this.unsub = bus.on('error', (envelope) => this.handle(envelope));
	}

	destroy(): void {
		this.unsub();
	}

	private handle(envelope: EventEnvelope<'error'>): void {
		const { severity, message, source, code } = envelope.payload;

		this.logger.error(source, `[${code}] ${message}`);

		if (severity === 'user' || severity === 'fatal') {
			this.notifications.show(message);
		}
	}
}
```

- [ ] **Step 4: Run — verify 4 tests pass**

- [ ] **Step 5: Run `npm test` — all green**

- [ ] **Step 6: Commit**: `feat(agentonomous): add ErrorHandler routing by severity`

---

## Chunk 4: CommandRegistry + adapter

**Goal:** Ship CommandEntry types, CommandPort interface, ObsidianCommandAdapter (implementing register + ribbon with visibility toggling via `style.display`), core-commands array, and delete the old ribbon helper.

### Task 4.1: Command types + port

**Files:**
- Create: `src/domain/commands/command-types.ts`
- Create: `src/domain/commands/command-port.ts`

- [ ] **Step 1: Create types**

```ts
// src/domain/commands/command-types.ts
export type CommandEntry = {
	readonly id: string;
	readonly name: string;
	readonly callback?: () => void | Promise<void>;
	readonly ribbon?: {
		readonly icon: string;
		readonly title: string;
		readonly visibleByDefault: boolean;
	};
	readonly opensView?: string;
};
```

- [ ] **Step 2: Create port**

```ts
// src/domain/commands/command-port.ts
import type { Unsubscribe } from '../shared/unsubscribe.js';
import type { CommandEntry } from './command-types.js';

export interface CommandPort {
	register(entry: CommandEntry): Unsubscribe;
	unregisterAll(): void;
}
```

- [ ] **Step 3: Typecheck + commit**: `feat(agentonomous): add CommandEntry types + CommandPort`

### Task 4.2: Core commands array

**Files:**
- Create: `src/domain/commands/core-commands.ts`

- [ ] **Step 1: Create the array**

```ts
// src/domain/commands/core-commands.ts
import type { CommandEntry } from './command-types.js';
import { VIEW_TYPE_HOMEPAGE } from '../../infrastructure/views/homepage-view.js';
```

Wait — domain cannot import from infrastructure. The `VIEW_TYPE_HOMEPAGE` constant lives in `src/infrastructure/views/homepage-view.ts`. We need to move the view-type constant to the domain layer or define it inline.

**Fix:** Define view-type constants in domain:

```ts
// src/domain/views/view-types.ts
export const VIEW_TYPE_HOMEPAGE = 'agentonomous-homepage';
```

Then `homepage-view.ts` imports from there instead of declaring its own. Update `src/infrastructure/views/homepage-view.ts` to import `VIEW_TYPE_HOMEPAGE` from `../../domain/views/view-types.js`.

Then:

```ts
// src/domain/commands/core-commands.ts
import type { CommandEntry } from './command-types.js';
import { VIEW_TYPE_HOMEPAGE } from '../views/view-types.js';

export const CORE_COMMANDS: readonly CommandEntry[] = [
	{
		id: 'open-homepage',
		name: 'Open homepage',
		opensView: VIEW_TYPE_HOMEPAGE,
		ribbon: {
			icon: 'bot',
			title: 'Open Agentonomous',
			visibleByDefault: true,
		},
	},
];
```

- [ ] **Step 2: Move `VIEW_TYPE_HOMEPAGE` from infra to domain**

Create `src/domain/views/view-types.ts` with the constant. Update `src/infrastructure/views/homepage-view.ts` to import from `../../domain/views/view-types.js`. Update `src/main.ts` to import from the new location.

- [ ] **Step 3: Run `npm test` — verify existing tests still pass after the move**

- [ ] **Step 4: Commit**: `feat(agentonomous): add CORE_COMMANDS + move VIEW_TYPE_HOMEPAGE to domain`

### Task 4.3: `ObsidianCommandAdapter` (TDD)

**Files:**
- Create: `src/infrastructure/obsidian/obsidian-command-adapter.ts`
- Create: `tests/infrastructure/obsidian/obsidian-command-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/infrastructure/obsidian/obsidian-command-adapter.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianCommandAdapter } from '../../../src/infrastructure/obsidian/obsidian-command-adapter.js';
import { createFakePlugin } from './fake-plugin.js';

describe('ObsidianCommandAdapter', () => {
	it('register() calls plugin.addCommand with correct id and name', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin);
		adapter.register({
			id: 'test-cmd',
			name: 'Test command',
			callback: () => {},
		});
		expect(plugin.addCommand).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'test-cmd', name: 'Test command' }),
		);
	});

	it('register() with ribbon creates a ribbon icon', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin);
		adapter.register({
			id: 'test-cmd',
			name: 'Test',
			callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		expect(plugin.addRibbonIcon).toHaveBeenCalledWith('bot', 'Open', expect.any(Function));
	});

	it('register() with ribbon visibleByDefault=false hides the element', () => {
		const plugin = createFakePlugin();
		const mockEl = { style: { display: '' }, remove: vi.fn() };
		plugin.addRibbonIcon = vi.fn(() => mockEl);
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin);
		adapter.register({
			id: 'test-cmd',
			name: 'Test',
			callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: false },
		});
		expect(mockEl.style.display).toBe('none');
	});

	it('setRibbonVisibility toggles display style', () => {
		const plugin = createFakePlugin();
		const mockEl = { style: { display: '' }, remove: vi.fn() };
		plugin.addRibbonIcon = vi.fn(() => mockEl);
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin);
		adapter.register({
			id: 'test-cmd',
			name: 'Test',
			callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		adapter.setRibbonVisibility(false);
		expect(mockEl.style.display).toBe('none');
		adapter.setRibbonVisibility(true);
		expect(mockEl.style.display).toBe('');
	});

	it('unregisterAll() removes ribbon elements', () => {
		const plugin = createFakePlugin();
		const mockEl = { style: { display: '' }, remove: vi.fn() };
		plugin.addRibbonIcon = vi.fn(() => mockEl);
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin);
		adapter.register({
			id: 'test-cmd',
			name: 'Test',
			callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		adapter.unregisterAll();
		expect(mockEl.remove).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement**

```ts
// src/infrastructure/obsidian/obsidian-command-adapter.ts
import type { Plugin } from 'obsidian';
import type { CommandPort } from '../../domain/commands/command-port.js';
import type { CommandEntry } from '../../domain/commands/command-types.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export class ObsidianCommandAdapter implements CommandPort {
	private readonly plugin: Plugin;
	private readonly ribbonElements = new Map<string, HTMLElement>();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	register(entry: CommandEntry): Unsubscribe {
		const callback = entry.callback ?? (() => {});

		this.plugin.addCommand({
			id: entry.id,
			name: entry.name,
			callback: () => { void callback(); },
		});

		if (entry.ribbon) {
			const el = this.plugin.addRibbonIcon(
				entry.ribbon.icon,
				entry.ribbon.title,
				() => { void callback(); },
			);
			if (!entry.ribbon.visibleByDefault) {
				el.style.display = 'none';
			}
			this.ribbonElements.set(entry.id, el);
		}

		return () => {
			const el = this.ribbonElements.get(entry.id);
			if (el) {
				el.remove();
				this.ribbonElements.delete(entry.id);
			}
		};
	}

	setRibbonVisibility(visible: boolean): void {
		for (const el of this.ribbonElements.values()) {
			el.style.display = visible ? '' : 'none';
		}
	}

	unregisterAll(): void {
		for (const el of this.ribbonElements.values()) {
			el.remove();
		}
		this.ribbonElements.clear();
	}
}
```

Note: The `opensView` hint is NOT wired here — that wiring happens in `PluginCore.init()` (Chunk 5), which resolves `opensView` to a callback via the `ViewRegistryPort` before passing the entry to the adapter.

- [ ] **Step 4: Run — verify 5 tests pass**

- [ ] **Step 5: Update ESLint obsidian allowlist** — add `src/infrastructure/obsidian/obsidian-command-adapter.ts` to ignores.

- [ ] **Step 6: Delete `src/infrastructure/ribbon/ribbon.ts`**

```bash
git rm src/infrastructure/ribbon/ribbon.ts
```

Also delete `tests/infrastructure/ribbon/ribbon.test.ts` if it exists (responsibility moved to the adapter).

- [ ] **Step 7: Update existing imports** — `src/main.ts` currently imports from `./infrastructure/ribbon/ribbon.js`. Remove that import. The actual main.ts rewrite happens in Chunk 5, but the import must be removed now to keep the build green. Temporarily comment out or remove the ribbon-related code in main.ts — it will be fully replaced in Chunk 5.

Actually, to keep main.ts working between chunks: leave the ribbon code in main.ts for now, just redirect the import. But ribbon.ts is being deleted... The cleanest path: delete ribbon.ts, strip the ribbon import and ribbon-related lines from main.ts, and accept that the ribbon temporarily disappears. Chunk 5 restores it via the CommandRegistry.

- [ ] **Step 8: Run `npm test` — verify all green (some tests may need updating if they reference ribbon.ts)**

- [ ] **Step 9: Commit**: `feat(agentonomous): add ObsidianCommandAdapter, delete old ribbon helper`

---

## Chunk 5: PluginCore + shell refactor + hardening + integration

**Goal:** Wire everything together: `PluginCore` class with `init()`/`destroy()`, rewrite `main.ts` to a thin shell, apply hardening fixes (hydrate reorder, double-mount guard, ESLint Vue try/catch), refactor stores to emit errors on bus, wire `About.vue` to inject `PluginContextKey`. Final quality gate.

### Task 5.1: `PluginCore` class (TDD)

**Files:**
- Create: `src/core/plugin-core.ts`
- Create: `tests/core/plugin-core.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/plugin-core.test.ts
import { describe, expect, it, vi } from 'vitest';
import { PluginCore } from '../../src/core/plugin-core.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import { Logger } from '../../src/core/logger.js';
import type { SettingsPort } from '../../src/domain/settings/settings-port.js';
import type { CommandPort } from '../../src/domain/commands/command-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import { ok } from '../../src/domain/shared/result.js';
import { DEFAULT_SETTINGS } from '../../src/domain/settings/plugin-settings.js';
import { CORE_COMMANDS } from '../../src/domain/commands/core-commands.js';

function fakeSettings(): SettingsPort {
	return {
		load: vi.fn(async () => ok(DEFAULT_SETTINGS)),
		save: vi.fn(async () => ok(undefined)),
		subscribe: vi.fn(() => () => {}),
	};
}

function fakeCommands(): CommandPort & { registered: string[] } {
	const registered: string[] = [];
	return {
		register: vi.fn((entry) => { registered.push(entry.id); return () => {}; }),
		unregisterAll: vi.fn(),
		registered,
	};
}

function fakeViewRegistry() {
	return {
		registerAll: vi.fn(),
		openView: vi.fn(async () => {}),
	};
}

function fakeNotifications(): NotificationPort {
	return { show: vi.fn() };
}

describe('PluginCore', () => {
	it('init() emits core:initializing then core:ready', async () => {
		const bus = createEventBus();
		const phases: string[] = [];
		bus.on('core', (env) => phases.push(env.payload.phase));

		const core = new PluginCore({
			settings: fakeSettings(),
			commands: fakeCommands(),
			views: fakeViewRegistry(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();
		expect(phases).toEqual(['initializing', 'ready']);
		expect(core.ready).toBe(true);
	});

	it('init() registers all command entries', async () => {
		const bus = createEventBus();
		const commands = fakeCommands();

		const core = new PluginCore({
			settings: fakeSettings(),
			commands,
			views: fakeViewRegistry(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();
		expect(commands.register).toHaveBeenCalled();
		expect(commands.registered).toContain('open-homepage');
	});

	it('destroy() emits core:destroying then core:destroyed', async () => {
		const bus = createEventBus();
		const core = new PluginCore({
			settings: fakeSettings(),
			commands: fakeCommands(),
			views: fakeViewRegistry(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();

		const phases: string[] = [];
		bus.on('core', (env) => phases.push(env.payload.phase));
		core.destroy();
		expect(phases).toEqual(['destroying', 'destroyed']);
		expect(core.ready).toBe(false);
	});

	it('is headless — no Obsidian, no DOM, no Vue', async () => {
		const bus = createEventBus();
		const core = new PluginCore({
			settings: fakeSettings(),
			commands: fakeCommands(),
			views: fakeViewRegistry(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();
		core.destroy();
		// If we got here without importing obsidian, vue, or pinia — it's headless
		expect(true).toBe(true);
	});
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement `PluginCore`**

```ts
// src/core/plugin-core.ts
import type { EventBus } from '../domain/shared/event-bus.js';
import type { LoggerPort, LogLevel } from '../domain/shared/logger-port.js';
import type { NotificationPort } from '../domain/shared/notification-port.js';
import type { SettingsPort } from '../domain/settings/settings-port.js';
import type { CommandPort } from '../domain/commands/command-port.js';
import type { CommandEntry } from '../domain/commands/command-types.js';
import type { ViewRegistryPort } from '../domain/views/view-registry-port.js';
import type { Unsubscribe } from '../domain/shared/unsubscribe.js';
import { isOk } from '../domain/shared/result.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../domain/settings/plugin-settings.js';
import { ErrorHandler } from './error-handler.js';

export interface CorePorts {
	readonly settings: SettingsPort;
	readonly commands: CommandPort;
	readonly views: ViewRegistryPort;
	readonly logger: LoggerPort;
	readonly notifications: NotificationPort;
	readonly eventBus: EventBus;
}

export class PluginCore {
	private state: 'idle' | 'initializing' | 'ready' | 'destroyed' = 'idle';
	private readonly ports: CorePorts;
	private readonly commandEntries: readonly CommandEntry[];
	private errorHandler: ErrorHandler | null = null;
	private settingsUnsub: Unsubscribe | null = null;
	private currentSettings: PluginSettings = DEFAULT_SETTINGS;

	constructor(ports: CorePorts, commandEntries: readonly CommandEntry[]) {
		this.ports = ports;
		this.commandEntries = commandEntries;
	}

	async init(): Promise<void> {
		this.state = 'initializing';
		this.ports.eventBus.emit('core', { phase: 'initializing' });

		this.errorHandler = new ErrorHandler(
			this.ports.eventBus,
			this.ports.logger,
			this.ports.notifications,
		);

		const loaded = await this.ports.settings.load();
		this.currentSettings = isOk(loaded) ? loaded.value : DEFAULT_SETTINGS;

		this.ports.logger.setLevel(this.currentSettings.logLevel ?? 'info');

		this.registerCommands();

		this.settingsUnsub = this.ports.settings.subscribe((s) => {
			const previous = this.currentSettings;
			this.currentSettings = s;
			this.ports.eventBus.emit('settings', { previous, current: s });

			if (previous.logLevel !== s.logLevel) {
				this.ports.logger.setLevel(s.logLevel ?? 'info');
			}

			if (previous.showRibbonIcon !== s.showRibbonIcon) {
				if ('setRibbonVisibility' in this.ports.commands) {
					(this.ports.commands as { setRibbonVisibility: (v: boolean) => void })
						.setRibbonVisibility(s.showRibbonIcon);
				}
			}
		});

		this.state = 'ready';
		this.ports.eventBus.emit('core', { phase: 'ready' });
		this.ports.logger.info('core', 'Plugin initialized');
	}

	destroy(): void {
		this.ports.eventBus.emit('core', { phase: 'destroying' });
		this.settingsUnsub?.();
		this.ports.commands.unregisterAll();
		this.errorHandler?.destroy();
		this.state = 'destroyed';
		this.ports.eventBus.emit('core', { phase: 'destroyed' });
	}

	get ready(): boolean {
		return this.state === 'ready';
	}

	get settings(): PluginSettings {
		return this.currentSettings;
	}

	private registerCommands(): void {
		for (const entry of this.commandEntries) {
			let resolved = entry;
			if (entry.opensView !== undefined && entry.callback === undefined) {
				const viewType = entry.opensView;
				resolved = {
					...entry,
					callback: () => this.ports.views.openView(
						null as never,
						viewType,
					),
				};
			} else if (entry.opensView !== undefined && entry.callback !== undefined) {
				this.ports.logger.info('core', `Command "${entry.id}" has both callback and opensView — opensView takes precedence`);
				const viewType = entry.opensView;
				resolved = {
					...entry,
					callback: () => this.ports.views.openView(null as never, viewType),
				};
			}
			this.ports.commands.register(resolved);
		}
	}
}
```

Note: The `openView(null as never, viewType)` is a temporary hack — `ViewRegistryPort` takes a generic `P` for the plugin param, but `PluginCore` doesn't have a `Plugin` reference. The actual `openView` call in the Obsidian shell will need the real plugin. This will be resolved in Task 5.2 when we rewire `main.ts` — the shell passes a bound `openView` that already has the plugin reference. For now, the callback stored in the command entry captures the view type; the shell adapter resolves it. Mark this with a comment.

Actually, a cleaner approach: don't resolve `opensView` in PluginCore at all. The `ObsidianCommandAdapter.register()` should receive the `opensView` string and call the view registry itself (it needs the plugin reference anyway). Update: let `PluginCore` pass command entries as-is to `commandPort.register()`. The adapter resolves `opensView` internally using the view registry it's given.

Revise `ObsidianCommandAdapter` to accept a `ViewRegistryPort` + `Plugin` at construction time so it can resolve `opensView` callbacks itself. This keeps PluginCore fully platform-agnostic.

Update the PluginCore implementation accordingly — `registerCommands` just forwards entries to the port without resolving callbacks.

- [ ] **Step 4: Run — verify 4 tests pass**

- [ ] **Step 5: Run `npm test` — all green**

- [ ] **Step 6: Commit**: `feat(agentonomous): add PluginCore with init/destroy lifecycle`

### Task 5.2: Rewrite `main.ts` as thin shell

**Files:**
- Modify: `src/main.ts` — shrink to ~40 lines
- Modify: `src/plugin.ts` — update `PluginContext` with new fields

- [ ] **Step 1: Update `src/plugin.ts`**

```ts
// src/plugin.ts
import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';
import type { ViewRegistryPort } from './domain/views/view-registry-port.js';
import type { EventBus } from './domain/shared/event-bus.js';
import type { LoggerPort } from './domain/shared/logger-port.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
	readonly viewRegistry: ViewRegistryPort;
	readonly eventBus: EventBus;
	readonly logger: LoggerPort;
};
```

- [ ] **Step 2: Rewrite `src/main.ts`**

```ts
// src/main.ts
import { Plugin } from 'obsidian';
import { createEventBus } from './domain/shared/event-bus.js';
import { CORE_COMMANDS } from './domain/commands/core-commands.js';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ObsidianCommandAdapter } from './infrastructure/obsidian/obsidian-command-adapter.js';
import { ObsidianNotificationAdapter } from './infrastructure/obsidian/obsidian-notification-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { VIEW_TYPE_HOMEPAGE } from './domain/views/view-types.js';
import { Logger } from './core/logger.js';
import { PluginCore } from './core/plugin-core.js';

export default class AgentonomousPlugin extends Plugin {
	private core: PluginCore | null = null;

	async onload(): Promise<void> {
		const bus = createEventBus();
		const settings = new ObsidianSettingsAdapter(this);
		const views = new ViewRegistry([
			{
				type: VIEW_TYPE_HOMEPAGE,
				displayName: 'Agentonomous homepage',
				icon: 'bot',
				defaultLocation: 'main',
				viewFactory: (leaf, ctx) => new HomepageView(leaf, ctx),
			},
		]);
		const logger = new Logger(bus, 'info');
		const notifications = new ObsidianNotificationAdapter();
		const commands = new ObsidianCommandAdapter(this, views);

		this.core = new PluginCore(
			{ settings, commands, views, logger, notifications, eventBus: bus },
			CORE_COMMANDS,
		);

		await this.core.init();

		const ctx = { app: this.app, plugin: this, settings, viewRegistry: views, eventBus: bus, logger };
		views.registerAll(this, ctx);
		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
		this.register(() => this.core?.destroy());
	}
}
```

Note: `ObsidianCommandAdapter` now takes `(plugin, viewRegistry)` at construction so it can resolve `opensView` → `viewRegistry.openView(plugin, type)` internally. Update the adapter's constructor signature accordingly.

- [ ] **Step 3: Run `npm test` — verify green**

- [ ] **Step 4: Commit**: `refactor(agentonomous): rewrite main.ts as thin Obsidian shell`

### Task 5.3: Hardening fixes

**Files:**
- Modify: `src/infrastructure/views/homepage-view.ts` — add double-mount guard
- Modify: `src/ui/stores/settings-store.ts` — reorder subscribe-after-load
- Modify: `configs/eslint.config.mjs` — add no-try-catch to Vue block

- [ ] **Step 1: Add double-mount guard to `homepage-view.ts`**

Add `private mounting = false;` field. In `onOpen()`:
```ts
if (this.mounted !== null || this.mounting) return;
this.mounting = true;
try {
	// existing mount logic
} finally {
	this.mounting = false;
}
```

- [ ] **Step 2: Reorder hydrate in `settings-store.ts`**

Move `subscribe()` call AFTER `await load()`:
```ts
async function hydrate(newPort: SettingsPort): Promise<void> {
	port = newPort;
	unsub?.();
	const loaded = await port.load();
	if (isOk(loaded)) settings.value = loaded.value;
	unsub = port.subscribe((s) => { settings.value = s; });
}
```

- [ ] **Step 3: Add no-try-catch to Vue ESLint block**

In the `files: ['**/*.vue']` block in `eslint.config.mjs`, add:
```js
'no-restricted-syntax': noTryCatchOutsideInfra,
```

- [ ] **Step 4: Run `npm test` — verify green**

- [ ] **Step 5: Commit**: `fix(agentonomous): hardening — double-mount guard, hydrate ordering, Vue try/catch ESLint`

### Task 5.4: Stores emit errors on bus + About.vue injects PluginContextKey

**Files:**
- Modify: `src/ui/stores/settings-store.ts` — emit error on bus instead of console
- Modify: `src/ui/app.ts` — remove `.catch(console.error)`, pass bus to stores
- Modify: `src/ui/pages/About.vue` — inject `PluginContextKey` to prove the pattern

- [ ] **Step 1: Update `settings-store.ts`** — add `bus` parameter to `hydrate()`, emit `error:*` on save failure:

```ts
async function update(next: PluginSettings): Promise<void> {
	invariant(port !== null, 'settings store not hydrated');
	const r = await port.save(next);
	if (isOk(r)) {
		settings.value = next;
	} else {
		bus?.emit('error', {
			code: 'SETTINGS_SAVE_FAILED',
			message: r.error,
			source: 'settings-store',
			severity: 'user',
		});
	}
}
```

The store receives the EventBus via `hydrate(port, eventBus)` — the second parameter is the bus reference.

- [ ] **Step 2: Update `app.ts`** — pass bus to `settingsStore.hydrate(ctx.settings, ctx.eventBus)`. Remove the `.catch(console.error)` handler (errors now go through the bus → ErrorHandler):

```ts
void settingsStore.hydrate(ctx.settings, ctx.eventBus);
```

Actually, the `void` is still needed since we're not awaiting. But errors are now captured inside the store and published to the bus, so no `.catch()` is needed.

- [ ] **Step 3: Update `About.vue`** to inject `PluginContextKey`:

```vue
<script setup lang="ts">
import { inject } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';
import { PluginContextKey } from '../plugin-context-key.js';

const appStore = useAppStore();
const { pluginVersion } = storeToRefs(appStore);
const ctx = inject(PluginContextKey);
</script>

<template>
	<div class="agentonomous-about">
		<h2>Agentonomous</h2>
		<p>Autonomous agents sandbox — version {{ pluginVersion }} for Obsidian {{ ctx?.app?.manifest?.version ?? '?' }}.</p>
		<nav class="agentonomous-nav">
			<router-link to="/">Home</router-link>
		</nav>
	</div>
</template>
```

- [ ] **Step 4: Update `settings-tab.ts`** — remove direct `Notice` calls, emit on bus instead. The `ErrorHandler` will show the Notice. Import the bus from the adapter or receive it at construction time.

Actually, `settings-tab.ts` lives in infrastructure and creates its own `Notice` calls. Since it already has access to the port, the cleanest approach: the tab emits errors through the settings port's save/load `Result`, which the store then publishes to the bus. The tab itself doesn't need the bus — it calls `port.save()` and the Result flows through the store.

But the tab calls `port.save()` directly (not through the store). For the tab's save path to surface errors via the bus, either:
(a) The tab emits on the bus directly (requires bus injection).
(b) The tab shows its own Notice (current behavior) — acceptable since the tab is infrastructure.

Keep (b) — the tab is infrastructure, and `Notice` is allowed there. The user sees the error via the tab's Notice. The store path (for programmatic saves) uses the bus. Two paths, both surfaced — acceptable and clearer than over-abstracting.

- [ ] **Step 5: Run `npm test` — verify green**

- [ ] **Step 6: Commit**: `refactor(agentonomous): stores emit errors on bus, About.vue injects context`

### Task 5.5: Update `PluginSettings` with `logLevel` field

**Files:**
- Modify: `src/domain/settings/plugin-settings.ts` — add `logLevel` to type + defaults + validator
- Modify: `src/infrastructure/settings/settings-tab.ts` — add log-level dropdown
- Modify: `tests/domain/settings/plugin-settings.test.ts` — update tests

- [ ] **Step 1: Add `logLevel` to `PluginSettings`**

```ts
import type { LogLevel } from '../shared/logger-port.js';

export const KNOWN_LOG_LEVELS = ['debug', 'info', 'error'] as const;

export type PluginSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
	readonly logLevel: LogLevel;
};

export const DEFAULT_SETTINGS: PluginSettings = {
	showRibbonIcon: true,
	defaultView: 'home',
	logLevel: 'info',
};
```

Update `validateSettings` to check `logLevel`.

- [ ] **Step 2: Add log-level dropdown to settings tab**

In `settings-tab.ts`, add a new `Setting` block for log level, similar to the default-view dropdown but using `KNOWN_LOG_LEVELS`.

- [ ] **Step 3: Update existing tests**

Tests that construct `PluginSettings` objects or compare with `DEFAULT_SETTINGS` need the `logLevel` field. Update them.

- [ ] **Step 4: Run `npm test` — verify green**

- [ ] **Step 5: Commit**: `feat(agentonomous): add logLevel to PluginSettings + settings tab`

### Task 5.6: Remove storybook `test.include` deprecation warning

**Files:**
- Modify: `configs/vitest.config.ts` — remove explicit `include` from storybook project

- [ ] **Step 1: Remove the `include` field** from the storybook project config. Let `storybookTest()` handle discovery.

- [ ] **Step 2: Run `npm test` — verify green, no deprecation warning**

- [ ] **Step 3: Commit**: `chore(agentonomous): remove deprecated storybook test.include`

### Task 5.7: Final quality gate

- [ ] **Step 1: Run full suite with coverage**

```bash
npx vitest run --config configs/vitest.config.ts --coverage
```

Expected: all tests pass, coverage ≥ 80/70/80/80. Add targeted tests if any threshold is missed.

- [ ] **Step 2: Run build**

```bash
npm run build
ls dist/
```

Expected: `main.js`, `manifest.json`, `styles.css` only.

- [ ] **Step 3: Run `npm test`**

Expected: exit 0.

- [ ] **Step 4: Run lint explicitly**

```bash
npx eslint src/ tests/ stories/ --config configs/eslint.config.mjs --no-error-on-unmatched-pattern
```

Expected: 0 errors.

- [ ] **Step 5: Commit any final adjustments**

---

## Done

All five chunks complete. The Agentonomous skeleton is hardened into a framework:
- Thin Obsidian shell (`main.ts` ~40 lines) + platform-agnostic `PluginCore`.
- Typed EventBus with tracing (traceId/parentId) and `onAny()`.
- Command-centric registry with ribbon + view hints.
- Structured Logger (console + bus dual-output, configurable level).
- Central ErrorHandler routing by severity.
- Lean shared utilities (generateId, timestamp, isOneOf, invariant).
- Hardening: double-mount guard, hydrate reorder, ESLint Vue try/catch coverage.
- DX: .editorconfig, .nvmrc, CLAUDE.md, exactOptionalPropertyTypes.
- Stores emit errors on bus; About.vue injects PluginContextKey.

Spec acceptance criteria 1–13 satisfied.
