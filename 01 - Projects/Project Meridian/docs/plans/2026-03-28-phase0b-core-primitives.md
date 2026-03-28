# Phase 0B: Core Primitives — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
n**Dependencies:** Chunk A (project scaffold must exist)
**Produces:** Result type, EventBus, Logger — core primitives all other chunks use

**Goal:** Establish the project scaffold, core primitives (Result, EventBus, Logger), Zod schemas, vault loading, game config, and trait system — the foundation all future phases build on.

**Architecture:** Obsidian plugin hosting an ExcaliburJS engine in a custom leaf view. TypeScript strict mode, Vite build, ESLint architecture enforcement. All game entities are ExcaliburJS ECS entities/actors with custom components. Vault markdown files are the persistence layer, Zod-validated at load time.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+, Zod, Vitest, Vite, ESLint (flat config), Obsidian Plugin API

**GDD Reference:** `01 - Projects/Project Meridian/Project Meridian.md` — §2, §12, §14, §16, §23, §29, §30, §34, §36

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`result-type.ts`, `result-type.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **Coverage target:** 80% statements, 80% lines

---

## Chunk B: Core Primitives

### Task B1: Result Type

**Files:**
- Create: `src/domain/core/result.ts`
- Create: `tests/domain/core/result.test.ts`

- [ ] **Step 1: Write failing tests for Result type**

```typescript
// tests/domain/core/result.test.ts
import { describe, it, expect } from 'vitest';
import { Result } from '../../src/domain/core/result.js';

describe('Result', () => {
	it('creates a success result with a value', () => {
		const result = Result.ok(42);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(42);
		}
	});

	it('creates an error result with a GameError', () => {
		const result = Result.err({
			code: 'TEST_ERROR',
			message: 'something failed',
			system: 'TestSystem',
			recoverable: true,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('TEST_ERROR');
		}
	});

	it('maps a success result', () => {
		const result = Result.ok(10).map(v => v * 2);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(20);
	});

	it('does not map an error result', () => {
		const err = Result.err({ code: 'E', message: 'm', system: 's', recoverable: true });
		const mapped = err.map(() => 999);
		expect(mapped.ok).toBe(false);
	});

	it('flatMaps through a 3-step chain', () => {
		const step1 = (n: number) => Result.ok(n + 1);
		const step2 = (n: number) => Result.ok(n * 2);
		const step3 = (n: number) => Result.ok(`result: ${n}`);

		const final = Result.ok(5)
			.flatMap(step1)
			.flatMap(step2)
			.flatMap(step3);

		expect(final.ok).toBe(true);
		if (final.ok) expect(final.value).toBe('result: 12');
	});

	it('short-circuits on error in a chain', () => {
		const step1 = (n: number) => Result.ok(n + 1);
		const step2 = (_n: number) => Result.err<number>({
			code: 'STEP2_FAIL', message: 'boom', system: 'test', recoverable: false,
		});
		const step3 = (n: number) => Result.ok(n * 100);

		const final = Result.ok(5).flatMap(step1).flatMap(step2).flatMap(step3);

		expect(final.ok).toBe(false);
		if (!final.ok) expect(final.error.code).toBe('STEP2_FAIL');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/result.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `Result` not found.

- [ ] **Step 3: Implement Result type**

```typescript
// src/domain/core/result.ts
export interface GameError {
	code: string;
	message: string;
	system: string;
	recoverable: boolean;
	context?: Record<string, unknown>;
}

export type ResultValue<T> =
	| { ok: true; value: T; map: <U>(fn: (v: T) => U) => ResultValue<U>; flatMap: <U>(fn: (v: T) => ResultValue<U>) => ResultValue<U> }
	| { ok: false; error: GameError; map: <U>(fn: (v: T) => U) => ResultValue<U>; flatMap: <U>(fn: (v: T) => ResultValue<U>) => ResultValue<U> };

function createOk<T>(value: T): ResultValue<T> {
	return {
		ok: true,
		value,
		map<U>(fn: (v: T) => U): ResultValue<U> {
			return createOk(fn(value));
		},
		flatMap<U>(fn: (v: T) => ResultValue<U>): ResultValue<U> {
			return fn(value);
		},
	};
}

function createErr<T>(error: GameError): ResultValue<T> {
	return {
		ok: false,
		error,
		map<U>(_fn: (v: T) => U): ResultValue<U> {
			return createErr<U>(error);
		},
		flatMap<U>(_fn: (v: T) => ResultValue<U>): ResultValue<U> {
			return createErr<U>(error);
		},
	};
}

export const Result = {
	ok: <T>(value: T): ResultValue<T> => createOk(value),
	err: <T = never>(error: GameError): ResultValue<T> => createErr(error),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/result.test.ts --config configs/vitest.config.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/result.ts" "01 - Projects/Project Meridian/tests/domain/core/result.test.ts"
git commit -m "feat(meridian): Result type with map, flatMap, and chain composition"
```

---

### Task B2: GameEvent & EventBus

**Files:**
- Create: `src/domain/core/events.ts`
- Create: `src/infrastructure/event-bus.ts`
- Create: `tests/infrastructure/event-bus.test.ts`

- [ ] **Step 1: Write failing tests for EventBus**

```typescript
// tests/infrastructure/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createEventBus, type GameEvent } from '../../src/infrastructure/event-bus.js';

describe('EventBus', () => {
	it('emits and receives a typed event', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('TestEvent', handler);

		const event: GameEvent = {
			type: 'TestEvent',
			tick: 1,
			wallClock: Date.now(),
			source: 'TestSystem',
			payload: { value: 42 },
		};
		bus.emit(event);

		expect(handler).toHaveBeenCalledWith(event);
	});

	it('supports priority ordering (lower = first)', () => {
		const bus = createEventBus();
		const order: number[] = [];

		bus.on('PriorityTest', () => order.push(200), 200);
		bus.on('PriorityTest', () => order.push(0), 0);
		bus.on('PriorityTest', () => order.push(100), 100);

		bus.emit({ type: 'PriorityTest', tick: 1, wallClock: Date.now(), source: 'test', payload: {} });

		expect(order).toEqual([0, 100, 200]);
	});

	it('stores event history and supports querying', () => {
		const bus = createEventBus();

		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 'sys1', payload: {} });
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 'sys2', payload: {} });
		bus.emit({ type: 'A', tick: 3, wallClock: Date.now(), source: 'sys1', payload: {} });

		const allA = bus.history({ type: 'A' });
		expect(allA).toHaveLength(2);

		const fromSys2 = bus.history({ source: 'sys2' });
		expect(fromSys2).toHaveLength(1);

		const limited = bus.history({ limit: 1 });
		expect(limited).toHaveLength(1);
	});

	it('supports onAny to capture all events', () => {
		const bus = createEventBus();
		const events: GameEvent[] = [];

		bus.onAny((e) => events.push(e));
		bus.emit({ type: 'X', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'Y', tick: 2, wallClock: Date.now(), source: 's', payload: {} });

		expect(events).toHaveLength(2);
	});

	it('supports unsubscribe', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		const unsub = bus.on('Test', handler);

		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);

		unsub();
		bus.emit({ type: 'Test', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('supports filter-based subscription', () => {
		const bus = createEventBus();
		const handler = vi.fn();

		bus.filter((e) => e.payload.agentId === 'elena', handler);

		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 's', payload: { agentId: 'elena' } });
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 's', payload: { agentId: 'marcus' } });

		expect(handler).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/event-bus.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement GameEvent type and EventBus**

```typescript
// src/domain/core/events.ts
export interface GameEvent {
	type: string;
	tick: number;
	wallClock: number;
	source: string;
	payload: Record<string, unknown>;
}

export type EventHandler = (event: GameEvent) => void;
export type Unsubscribe = () => void;
export type EventFilter = (event: GameEvent) => boolean;

export interface EventBus {
	emit(event: GameEvent): void;
	on(type: string, handler: EventHandler, priority?: number): Unsubscribe;
	off(type: string, handler: EventHandler): void;
	onAny(handler: EventHandler): Unsubscribe;
	filter(predicate: EventFilter, handler: EventHandler): Unsubscribe;
	history(filter?: { type?: string; source?: string; limit?: number }): GameEvent[];
}
```

```typescript
// src/infrastructure/event-bus.ts
import type { GameEvent, EventHandler, EventBus, Unsubscribe, EventFilter } from '../domain/core/events.js';
export type { GameEvent } from '../domain/core/events.js';

interface PrioritizedHandler {
	handler: EventHandler;
	priority: number;
}

const HISTORY_MAX = 500;

export function createEventBus(): EventBus {
	const handlers = new Map<string, PrioritizedHandler[]>();
	const anyHandlers: PrioritizedHandler[] = [];
	const eventHistory: GameEvent[] = [];

	function addHandler(map: Map<string, PrioritizedHandler[]>, type: string, handler: EventHandler, priority: number): void {
		if (!map.has(type)) map.set(type, []);
		const list = map.get(type)!;
		list.push({ handler, priority });
		list.sort((a, b) => a.priority - b.priority);
	}

	return {
		emit(event: GameEvent): void {
			eventHistory.push(event);
			if (eventHistory.length > HISTORY_MAX) eventHistory.shift();

			const typed = handlers.get(event.type);
			if (typed) {
				for (const { handler } of typed) handler(event);
			}
			for (const { handler } of anyHandlers) handler(event);
		},

		on(type: string, handler: EventHandler, priority = 100): Unsubscribe {
			addHandler(handlers, type, handler, priority);
			return () => {
				const list = handlers.get(type);
				if (list) {
					const idx = list.findIndex((h) => h.handler === handler);
					if (idx >= 0) list.splice(idx, 1);
				}
			};
		},

		off(type: string, handler: EventHandler): void {
			const list = handlers.get(type);
			if (list) {
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
			if (filter?.type) results = results.filter((e) => e.type === filter.type);
			if (filter?.source) results = results.filter((e) => e.source === filter.source);
			if (filter?.limit) results = results.slice(-filter.limit);
			return results;
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/event-bus.test.ts --config configs/vitest.config.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/events.ts" "01 - Projects/Project Meridian/src/infrastructure/event-bus.ts" "01 - Projects/Project Meridian/tests/infrastructure/event-bus.test.ts"
git commit -m "feat(meridian): GameEvent type and EventBus with priority, history, filter"
```

---

### Task B3: Logger

**Files:**
- Create: `src/domain/core/logger.ts`
- Create: `src/infrastructure/logger/console-logger.ts`
- Create: `tests/infrastructure/logger/console-logger.test.ts`

- [ ] **Step 1: Write failing test for Logger**

```typescript
// tests/infrastructure/logger/console-logger.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createConsoleLogger } from '../../../src/infrastructure/logger/console-logger.js';

describe('ConsoleLogger', () => {
	it('logs info with structured format (system, message, tick)', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createConsoleLogger();

		logger.info('TestSystem', 'something happened', { tick: 5 });

		expect(spy).toHaveBeenCalledOnce();
		const output = spy.mock.calls[0][0] as string;
		expect(output).toContain('TestSystem');
		expect(output).toContain('something happened');
		spy.mockRestore();
	});

	it('logs warn and error at correct levels', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logger = createConsoleLogger();

		logger.warn('Sys', 'warning');
		logger.error('Sys', 'error');

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(errorSpy).toHaveBeenCalledOnce();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it('respects log level filtering', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createConsoleLogger('warn');

		logger.debug('Sys', 'should be hidden');
		logger.info('Sys', 'should be hidden');

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/logger/console-logger.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Logger interface and ConsoleLogger**

```typescript
// src/domain/core/logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
	debug(system: string, msg: string, data?: unknown): void;
	info(system: string, msg: string, data?: unknown): void;
	warn(system: string, msg: string, data?: unknown): void;
	error(system: string, msg: string, err?: Error, data?: unknown): void;
}
```

```typescript
// src/infrastructure/logger/console-logger.ts
import type { Logger, LogLevel } from '../../domain/core/logger.js';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createConsoleLogger(minLevel: LogLevel = 'debug'): Logger {
	const threshold = LEVELS[minLevel];

	function format(level: LogLevel, system: string, msg: string, data?: unknown): string {
		const timestamp = new Date().toISOString();
		const base = `[${timestamp}] [${level.toUpperCase()}] [${system}] ${msg}`;
		return data ? `${base} ${JSON.stringify(data)}` : base;
	}

	return {
		debug(system, msg, data) {
			if (LEVELS.debug >= threshold) console.log(format('debug', system, msg, data));
		},
		info(system, msg, data) {
			if (LEVELS.info >= threshold) console.log(format('info', system, msg, data));
		},
		warn(system, msg, data) {
			if (LEVELS.warn >= threshold) console.warn(format('warn', system, msg, data));
		},
		error(system, msg, err, data) {
			if (LEVELS.error >= threshold) console.error(format('error', system, msg, { error: err?.message, ...data as object }));
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/logger/console-logger.test.ts --config configs/vitest.config.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/logger.ts" "01 - Projects/Project Meridian/src/infrastructure/logger/" "01 - Projects/Project Meridian/tests/infrastructure/logger/"
git commit -m "feat(meridian): Logger interface and ConsoleLogger with structured output"
```

---

