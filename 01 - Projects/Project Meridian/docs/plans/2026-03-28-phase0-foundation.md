# Phase 0: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the project scaffold, core primitives (Result, EventBus, Logger), Zod schemas, vault loading, game config, and trait system — the foundation all future phases build on.

**Architecture:** Obsidian plugin hosting an ExcaliburJS engine in a custom leaf view. TypeScript strict mode, Vite build, ESLint architecture enforcement. All game entities are ExcaliburJS ECS entities/actors with custom components. Vault markdown files are the persistence layer, Zod-validated at load time.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.29+, Zod, Vitest, Vite, ESLint (flat config), Obsidian Plugin API

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

## Chunk A: Project Scaffold

### Task A1: Initialize Obsidian Plugin Project

**Files:**
- Create: `package.json`
- Create: `manifest.json`
- Create: `configs/tsconfig.json`
- Create: `configs/vite.config.ts`
- Create: `configs/vitest.config.ts`
- Create: `src/main.ts`
- Create: `src/plugin.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "project-meridian",
  "version": "0.0.1",
  "description": "Emergent agent-simulation sandbox RPG — Obsidian plugin",
  "type": "module",
  "scripts": {
    "build": "vite build --config configs/vite.config.ts",
    "build:dev": "vite build --config configs/vite.config.ts --watch",
    "test": "npm run lint && npm run typecheck && npm run test:unit",
    "test:unit": "vitest run --config configs/vitest.config.ts",
    "test:watch": "vitest --config configs/vitest.config.ts",
    "typecheck": "tsc --noEmit --project configs/tsconfig.json",
    "lint": "eslint src/ --config configs/eslint.config.mjs"
  },
  "devDependencies": {
    "obsidian": "latest",
    "excalibur": "^0.29.0",
    "zod": "^3.23.0",
    "yaml": "^2.5.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create Obsidian manifest.json**

```json
{
  "id": "project-meridian",
  "name": "Project Meridian",
  "version": "0.0.1",
  "minAppVersion": "1.4.0",
  "description": "Emergent agent-simulation sandbox RPG",
  "author": "Flowti",
  "isDesktopOnly": true
}
```

- [ ] **Step 3: Create configs/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "../dist",
    "rootDir": "../src",
    "baseUrl": "../src",
    "types": ["obsidian"],
    "lib": ["ES2022", "DOM"]
  },
  "include": ["../src/**/*.ts"],
  "exclude": ["../tests/**/*.ts", "../node_modules"]
}
```

- [ ] **Step 4: Create configs/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, '../src/main.ts'),
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		outDir: resolve(__dirname, '../dist'),
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: ['obsidian', 'electron'],
			output: {
				globals: {
					obsidian: 'obsidian',
				},
			},
		},
	},
});
```

- [ ] **Step 5: Create configs/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		root: '..',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/main.ts', 'src/plugin.ts'],
			thresholds: {
				statements: 80,
				lines: 80,
			},
		},
	},
});
```

- [ ] **Step 6: Create src/main.ts (Obsidian plugin entry)**

```typescript
export { MeridianPlugin as default } from './plugin.js';
```

- [ ] **Step 7: Create src/plugin.ts (Obsidian plugin class)**

```typescript
import { Plugin } from 'obsidian';

export class MeridianPlugin extends Plugin {
	async onload(): Promise<void> {
		console.log('Project Meridian loading...');
	}

	async onunload(): Promise<void> {
		console.log('Project Meridian unloading...');
	}
}
```

- [ ] **Step 8: Run npm install and verify build**

Run: `cd "01 - Projects/Project Meridian" && npm install && npm run typecheck`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Project Meridian/package.json" "01 - Projects/Project Meridian/manifest.json" "01 - Projects/Project Meridian/configs/" "01 - Projects/Project Meridian/src/"
git commit -m "feat(meridian): initialize Obsidian plugin project scaffold"
```

---

### Task A2: ESLint Architecture Enforcement

**Files:**
- Create: `configs/eslint.config.mjs`

- [ ] **Step 1: Create configs/eslint.config.mjs**

```javascript
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
			'complexity': ['warn', 10],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TryStatement',
					message: 'Use Result type instead of try/catch (GDD §16.2)',
				},
			],
			'no-restricted-globals': [
				'error',
				{ name: 'require', message: 'Use ESM imports' },
			],
		},
	},
	{
		// Infrastructure boundary code may use try/catch to wrap external APIs that throw
		files: ['src/infrastructure/**/*.ts'],
		rules: {
			'no-restricted-syntax': 'off',
		},
	},
	{
		files: ['src/domain/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../infrastructure/*', '../../infrastructure/*'], message: 'Domain must not import infrastructure (GDD §36.3)' },
						{ group: ['obsidian', 'node:*'], message: 'Domain must not import platform modules (GDD §36.3)' },
					],
				},
			],
		},
	},
	{
		files: ['src/ui/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../domain/*', '../../domain/*'], message: 'UI must not import domain internals — use Pinia stores (GDD §36.3)' },
					],
				},
			],
		},
	},
];
```

- [ ] **Step 2: Run lint to verify config loads**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: No errors (only 2 small files to lint).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/configs/eslint.config.mjs"
git commit -m "feat(meridian): add ESLint flat config with architecture enforcement rules"
```

---

### Task A3: ExcaliburJS Engine in Obsidian Leaf View

**Files:**
- Create: `src/infrastructure/engine/game-engine.ts`
- Create: `src/infrastructure/engine/game-view.ts`
- Modify: `src/plugin.ts`
- Create: `tests/infrastructure/engine/game-engine.test.ts`

- [ ] **Step 1: Write failing test for game engine initialization**

```typescript
// tests/infrastructure/engine/game-engine.test.ts
import { describe, it, expect } from 'vitest';
import * as ex from 'excalibur';
import { createGameEngine, createTestSprite } from '../../src/infrastructure/engine/game-engine.js';

describe('GameEngine', () => {
	it('creates an ExcaliburJS engine with the correct configuration', () => {
		const container = document.createElement('div');
		const engine = createGameEngine(container);
		expect(engine).toBeDefined();
		expect(engine.canvasWidth).toBeGreaterThan(0);
	});

	it('creates a test sprite actor with position and graphics', () => {
		const sprite = createTestSprite({ x: 100, y: 200 });
		expect(sprite).toBeInstanceOf(ex.Actor);
		expect(sprite.pos.x).toBe(100);
		expect(sprite.pos.y).toBe(200);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/game-engine.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `createGameEngine` not found.

- [ ] **Step 3: Implement game engine factory**

```typescript
// src/infrastructure/engine/game-engine.ts
import * as ex from 'excalibur';

export interface GameEngineConfig {
	width?: number;
	height?: number;
}

export function createGameEngine(
	container: HTMLElement,
	config: GameEngineConfig = {},
): ex.Engine {
	const { width = 800, height = 600 } = config;

	const canvas = document.createElement('canvas');
	container.appendChild(canvas);

	const engine = new ex.Engine({
		canvasElement: canvas,
		width,
		height,
		backgroundColor: ex.Color.fromHex('#1a1a2e'),
		suppressPlayButton: true,
		antialiasing: false,
	});

	return engine;
}

export function createTestSprite(pos: { x: number; y: number }): ex.Actor {
	const actor = new ex.Actor({
		pos: new ex.Vector(pos.x, pos.y),
		width: 32,
		height: 32,
		color: ex.Color.fromHex('#e94560'),
	});
	return actor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/engine/game-engine.test.ts --config configs/vitest.config.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create Obsidian ItemView wrapper**

```typescript
// src/infrastructure/engine/game-view.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as ex from 'excalibur';
import { createGameEngine, createTestSprite } from './game-engine.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return MERIDIAN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Project Meridian';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.style.padding = '0';
		container.style.overflow = 'hidden';

		this.engine = createGameEngine(container, {
			width: container.clientWidth,
			height: container.clientHeight,
		});

		// Add a test sprite to verify rendering (Phase 0 acceptance criterion 1)
		const testSprite = createTestSprite({ x: 400, y: 300 });
		this.engine.currentScene.add(testSprite);

		await this.engine.start();
	}

	async onClose(): Promise<void> {
		if (this.engine) {
			this.engine.stop();
			this.engine = null;
		}
	}
}
```

- [ ] **Step 6: Register view in plugin.ts**

```typescript
// src/plugin.ts
import { Plugin } from 'obsidian';
import { MeridianGameView, MERIDIAN_VIEW_TYPE } from './infrastructure/engine/game-view.js';

export class MeridianPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => new MeridianGameView(leaf));

		this.addRibbonIcon('gamepad-2', 'Project Meridian', async () => {
			const existingLeaves = this.app.workspace.getLeavesOfType(MERIDIAN_VIEW_TYPE);
			if (existingLeaves.length > 0) {
				this.app.workspace.revealLeaf(existingLeaves[0]);
				return;
			}
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: MERIDIAN_VIEW_TYPE, active: true });
		});
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(MERIDIAN_VIEW_TYPE);
	}
}
```

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/" "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): ExcaliburJS engine in Obsidian leaf view"
```

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

## Chunk C: Zod Schemas

### Task C1: Agent Schema and Sub-Schemas

**Files:**
- Create: `src/domain/schemas/common.ts`
- Create: `src/domain/schemas/agent-schema.ts`
- Create: `src/domain/schemas/trait-schema.ts`
- Create: `tests/domain/schemas/agent-schema.test.ts`
- Create: `tests/domain/schemas/trait-schema.test.ts`

- [ ] **Step 1: Write failing tests for AgentSchema**

```typescript
// tests/domain/schemas/agent-schema.test.ts
import { describe, it, expect } from 'vitest';
import { AgentSchema } from '../../../src/domain/schemas/agent-schema.js';

describe('AgentSchema', () => {
	const validAgent = {
		id: 'agent-merchant-elena',
		name: 'Elena Vasquez',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 14 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 50,
		wallet: { gold: 100 },
		position: { x: 100, y: 200, region: 'loc-marketplace' },
		behavior_tree: 'config/kinds/merchant-bt.json',
	};

	it('validates a well-formed agent', () => {
		const result = AgentSchema.safeParse(validAgent);
		expect(result.success).toBe(true);
	});

	it('rejects an agent with invalid id prefix', () => {
		const result = AgentSchema.safeParse({ ...validAgent, id: 'npc-elena' });
		expect(result.success).toBe(false);
	});

	it('rejects attributes outside range 1-20', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			attributes: { ST: 25, DX: 10, IQ: 10, HT: 10 },
		});
		expect(result.success).toBe(false);
	});

	it('applies defaults for optional arrays', () => {
		const result = AgentSchema.parse(validAgent);
		expect(result.memory).toEqual([]);
		expect(result.goals).toEqual([]);
		expect(result.skills).toEqual([]);
		expect(result.traits).toEqual([]);
		expect(result.inventory).toEqual([]);
		expect(result.property).toEqual([]);
		expect(result.tools).toEqual([]);
	});

	it('rejects needs outside 0-100 range', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			needs: { hunger: 150, energy: 50, social: 50 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects mood outside -100 to 100 range', () => {
		const result = AgentSchema.safeParse({ ...validAgent, mood: 200 });
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/agent-schema.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement common schemas and AgentSchema**

```typescript
// src/domain/schemas/common.ts
import { z } from 'zod';

export const PositionSchema = z.object({
	x: z.number(),
	y: z.number(),
	region: z.string().optional(),
});

export const MemoryEntrySchema = z.object({
	tick: z.number(),
	type: z.string(),
	description: z.string(),
	participants: z.array(z.string()).default([]),
	outcome: z.enum(['positive', 'negative', 'neutral']),
	significance: z.number().min(1).max(10),
	mood_impact: z.number(),
	original_significance: z.number().min(1).max(10).optional(),
});

export const GoalSchema = z.object({
	id: z.string(),
	type: z.enum(['aspirational', 'operational']),
	metric: z.string(),
	target: z.number(),
	priority: z.enum(['high', 'medium', 'low']),
	reward_xp: z.number().min(0),
	progress: z.number().min(0).default(0),
});

export const SkillEntrySchema = z.object({
	id: z.string(),
	points: z.number().int().min(0).default(0),
	use_count: z.number().int().min(0).default(0),
	use_bonus: z.number().int().min(0).max(3).default(0),
});

export const InventoryItemSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int().min(1),
	spoilage_remaining: z.number().nullable().default(null),
});

export const EquipmentSchema = z.object({
	head: z.string().nullable().default(null),
	body: z.string().nullable().default(null),
	hands: z.string().nullable().default(null),
	tool: z.string().nullable().default(null),
	accessory: z.string().nullable().default(null),
});

export const LLMConfigSchema = z.object({
	enabled: z.boolean().default(false),
	provider: z.string().default('cursor'),
	personality: z.union([z.string(), z.record(z.string())]).optional(),
	temperature: z.number().min(0).max(2).default(0.7),
	max_tokens: z.number().int().min(1).default(150),
});
```

```typescript
// src/domain/schemas/agent-schema.ts
import { z } from 'zod';
import {
	PositionSchema,
	MemoryEntrySchema,
	GoalSchema,
	SkillEntrySchema,
	InventoryItemSchema,
	EquipmentSchema,
	LLMConfigSchema,
} from './common.js';

export const AgentSchema = z.object({
	id: z.string().regex(/^agent-[a-z0-9-]+$/),
	name: z.string().min(1),
	kind: z.string(),
	attributes: z.object({
		ST: z.number().int().min(1).max(20),
		DX: z.number().int().min(1).max(20),
		IQ: z.number().int().min(1).max(20),
		HT: z.number().int().min(1).max(20),
	}),
	social: z.object({
		status: z.number().int().min(-4).max(8),
		reputation: z.number().int().min(-4).max(4),
		charisma: z.number().int().min(1).max(20),
	}),
	needs: z.object({
		hunger: z.number().min(0).max(100),
		energy: z.number().min(0).max(100),
		social: z.number().min(0).max(100),
	}),
	mood: z.number().min(-100).max(100).default(50),
	memory: z.array(MemoryEntrySchema).default([]),
	goals: z.array(GoalSchema).default([]),
	skills: z.array(SkillEntrySchema).default([]),
	inventory: z.array(InventoryItemSchema).default([]),
	equipment: EquipmentSchema.default({}),
	traits: z.array(z.string()).default([]),
	wallet: z.object({ gold: z.number().min(0) }),
	xp: z.number().min(0).default(0),
	level: z.number().int().min(1).default(1),
	position: PositionSchema,
	relationships: z.string().default('graphs/relationships.canvas'),
	llm: LLMConfigSchema.optional(),
	tools: z.array(z.string()).default([]),
	behavior_tree: z.string(),
	job: z.string().nullable().default(null),
	property: z.array(z.string()).default([]),
});

export type Agent = z.infer<typeof AgentSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/agent-schema.test.ts --config configs/vitest.config.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write failing tests for TraitSchema**

```typescript
// tests/domain/schemas/trait-schema.test.ts
import { describe, it, expect } from 'vitest';
import { TraitSchema } from '../../../src/domain/schemas/trait-schema.js';

describe('TraitSchema', () => {
	const validTrait = {
		id: 'trait-unkillable',
		name: 'Unkillable',
		description: 'This agent cannot die.',
		category: 'survival',
		effects: [
			{ system: 'MortalityCheck', modifier: { prevent_death: true, auto_recover_ticks: 150 } },
		],
		assignable_by: 'director',
		stackable: false,
		conflicts_with: [],
	};

	it('validates a well-formed trait', () => {
		const result = TraitSchema.safeParse(validTrait);
		expect(result.success).toBe(true);
	});

	it('rejects invalid category', () => {
		const result = TraitSchema.safeParse({ ...validTrait, category: 'invalid' });
		expect(result.success).toBe(false);
	});

	it('rejects invalid id prefix', () => {
		const result = TraitSchema.safeParse({ ...validTrait, id: 'bonus-speed' });
		expect(result.success).toBe(false);
	});

	it('validates all assignable_by values', () => {
		for (const by of ['director', 'definition', 'milestone', 'inherited']) {
			const result = TraitSchema.safeParse({ ...validTrait, assignable_by: by });
			expect(result.success).toBe(true);
		}
	});
});
```

- [ ] **Step 6: Implement TraitSchema**

```typescript
// src/domain/schemas/trait-schema.ts
import { z } from 'zod';

export const TraitEffectSchema = z.object({
	system: z.string(),
	modifier: z.record(z.unknown()),
});

export const TraitSchema = z.object({
	id: z.string().regex(/^trait-[a-z0-9-]+$/),
	name: z.string().min(1),
	description: z.string(),
	category: z.enum(['survival', 'social', 'economic', 'work', 'special']),
	effects: z.array(TraitEffectSchema),
	assignable_by: z.enum(['director', 'definition', 'milestone', 'inherited']),
	stackable: z.boolean().default(false),
	conflicts_with: z.array(z.string()).default([]),
});

export type Trait = z.infer<typeof TraitSchema>;
```

- [ ] **Step 7: Run all schema tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/ --config configs/vitest.config.ts`
Expected: PASS (10 tests).

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/" "01 - Projects/Project Meridian/tests/domain/schemas/"
git commit -m "feat(meridian): Zod schemas for Agent, Trait, and all sub-schemas"
```

---

## Chunk D: VaultSync (Load-Only)

### Task D0: VaultAdapter Interface

**Files:**
- Create: `src/domain/core/vault-adapter.ts`
- Create: `src/infrastructure/vault/memfs-vault-adapter.ts`
- Create: `tests/infrastructure/vault/memfs-vault-adapter.test.ts`

- [ ] **Step 1: Write failing test for MemfsVaultAdapter**

```typescript
// tests/infrastructure/vault/memfs-vault-adapter.test.ts
import { describe, it, expect } from 'vitest';
import { createMemfsVaultAdapter } from '../../../src/infrastructure/vault/memfs-vault-adapter.js';

describe('MemfsVaultAdapter', () => {
	it('reads a file that was written', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': '---\nid: agent-elena\n---\n',
		});
		const result = await adapter.readFile('agents/elena.md');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toContain('agent-elena');
	});

	it('returns error for missing file', async () => {
		const adapter = createMemfsVaultAdapter({});
		const result = await adapter.readFile('nonexistent.md');
		expect(result.ok).toBe(false);
	});

	it('lists files matching a glob pattern', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': '---\nid: a\n---',
			'agents/marcus.md': '---\nid: b\n---',
			'config/traits/unkillable.md': '---\nid: t\n---',
		});
		const files = await adapter.listFiles('agents/');
		expect(files).toHaveLength(2);
		expect(files).toContain('agents/elena.md');
		expect(files).toContain('agents/marcus.md');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/memfs-vault-adapter.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement VaultAdapter interface and MemfsVaultAdapter**

```typescript
// src/domain/core/vault-adapter.ts
import type { ResultValue } from './result.js';

export interface VaultAdapter {
	readFile(path: string): Promise<ResultValue<string>>;
	listFiles(directory: string): Promise<string[]>;
	writeFile(path: string, content: string): Promise<ResultValue<void>>;
}
```

```typescript
// src/infrastructure/vault/memfs-vault-adapter.ts
import { Result, type ResultValue } from '../../domain/core/result.js';
import type { VaultAdapter } from '../../domain/core/vault-adapter.js';

export function createMemfsVaultAdapter(files: Record<string, string>): VaultAdapter {
	const store = new Map(Object.entries(files));

	return {
		async readFile(path: string): Promise<ResultValue<string>> {
			const content = store.get(path);
			if (content === undefined) {
				return Result.err({
					code: 'FILE_NOT_FOUND',
					message: `File not found: ${path}`,
					system: 'VaultAdapter',
					recoverable: true,
				});
			}
			return Result.ok(content);
		},

		async listFiles(directory: string): Promise<string[]> {
			return [...store.keys()].filter((key) => key.startsWith(directory));
		},

		async writeFile(path: string, content: string): Promise<ResultValue<void>> {
			store.set(path, content);
			return Result.ok(undefined);
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/memfs-vault-adapter.test.ts --config configs/vitest.config.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/vault-adapter.ts" "01 - Projects/Project Meridian/src/infrastructure/vault/memfs-vault-adapter.ts" "01 - Projects/Project Meridian/tests/infrastructure/vault/memfs-vault-adapter.test.ts"
git commit -m "feat(meridian): VaultAdapter interface + MemfsVaultAdapter for testing"
```

---

### Task D1: Markdown Frontmatter Parser

**Files:**
- Create: `src/infrastructure/vault/frontmatter-parser.ts`
- Create: `tests/infrastructure/vault/frontmatter-parser.test.ts`

- [ ] **Step 1: Write failing tests for frontmatter parsing**

```typescript
// tests/infrastructure/vault/frontmatter-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../../src/infrastructure/vault/frontmatter-parser.js';

describe('parseFrontmatter', () => {
	it('parses valid YAML frontmatter from markdown', () => {
		const md = `---\nid: agent-elena\nname: Elena\n---\nBody text here.`;
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe('agent-elena');
			expect(result.value.name).toBe('Elena');
		}
	});

	it('returns error for missing frontmatter delimiters', () => {
		const md = `No frontmatter here.`;
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(false);
	});

	it('returns error for malformed YAML', () => {
		const md = `---\n: invalid yaml [\n---\n`;
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(false);
	});

	it('handles empty frontmatter', () => {
		const md = `---\n---\nBody only.`;
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({});
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/frontmatter-parser.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement frontmatter parser using Result type**

```typescript
// src/infrastructure/vault/frontmatter-parser.ts
import { Result, type ResultValue } from '../../domain/core/result.js';
import type { GameError } from '../../domain/core/result.js';
import { parse as parseYaml } from 'yaml';

export function parseFrontmatter(markdown: string): ResultValue<Record<string, unknown>> {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return Result.err({
			code: 'FRONTMATTER_MISSING',
			message: 'No frontmatter delimiters found',
			system: 'VaultSync',
			recoverable: true,
		});
	}

	const yamlContent = match[1].trim();
	if (yamlContent === '') {
		return Result.ok({});
	}

	const parsed = parseYamlSafe(yamlContent);
	return parsed;
}

function parseYamlSafe(content: string): ResultValue<Record<string, unknown>> {
	try {
		const data = parseYaml(content);
		if (typeof data !== 'object' || data === null) {
			return Result.err({
				code: 'FRONTMATTER_NOT_OBJECT',
				message: 'Frontmatter did not parse to an object',
				system: 'VaultSync',
				recoverable: true,
			});
		}
		return Result.ok(data as Record<string, unknown>);
	} catch {
		return Result.err({
			code: 'YAML_PARSE_ERROR',
			message: 'Failed to parse YAML frontmatter',
			system: 'VaultSync',
			recoverable: true,
		});
	}
}
```

Note: Add `yaml` to `devDependencies` in `package.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/frontmatter-parser.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/vault/" "01 - Projects/Project Meridian/tests/infrastructure/vault/" "01 - Projects/Project Meridian/package.json"
git commit -m "feat(meridian): frontmatter parser with Result-based error handling"
```

---

### Task D2: VaultLoader (Schema-Validated Loading)

**Files:**
- Create: `src/infrastructure/vault/vault-loader.ts`
- Create: `src/infrastructure/vault/quarantine.ts`
- Create: `tests/infrastructure/vault/vault-loader.test.ts`

- [ ] **Step 1: Write failing tests for VaultLoader**

```typescript
// tests/infrastructure/vault/vault-loader.test.ts
import { describe, it, expect } from 'vitest';
import { createVaultLoader } from '../../../src/infrastructure/vault/vault-loader.js';
import { AgentSchema } from '../../../src/domain/schemas/agent-schema.js';
import { TraitSchema } from '../../../src/domain/schemas/trait-schema.js';

describe('VaultLoader', () => {
	const validAgentMd = `---
id: agent-merchant-elena
name: Elena Vasquez
kind: merchant
attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 }
social: { status: 0, reputation: 0, charisma: 14 }
needs: { hunger: 80, energy: 90, social: 70 }
wallet: { gold: 100 }
position: { x: 100, y: 200, region: loc-marketplace }
behavior_tree: config/kinds/merchant-bt.json
---
Elena is a merchant.`;

	const invalidAgentMd = `---
id: bad-prefix
name: 123
---
Invalid agent.`;

	const loader = createVaultLoader();

	it('loads and validates a well-formed agent file', () => {
		const result = loader.loadEntity(validAgentMd, AgentSchema, 'agents/elena.md');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe('agent-merchant-elena');
			expect(result.value.name).toBe('Elena Vasquez');
			expect(result.value.traits).toEqual([]);
		}
	});

	it('returns error and quarantines an invalid agent file', () => {
		const result = loader.loadEntity(invalidAgentMd, AgentSchema, 'agents/bad.md');
		expect(result.ok).toBe(false);
		expect(loader.quarantined).toContain('agents/bad.md');
	});

	it('returns error for file with no frontmatter', () => {
		const result = loader.loadEntity('Just text.', AgentSchema, 'agents/none.md');
		expect(result.ok).toBe(false);
		expect(loader.quarantined).toContain('agents/none.md');
	});

	it('loads a valid trait file', () => {
		const traitMd = `---
id: trait-unkillable
name: Unkillable
description: Cannot die.
category: survival
effects:
  - system: MortalityCheck
    modifier: { prevent_death: true }
assignable_by: director
stackable: false
conflicts_with: []
---`;
		const result = loader.loadEntity(traitMd, TraitSchema, 'config/traits/unkillable.md');
		expect(result.ok).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/vault-loader.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement VaultLoader with quarantine**

```typescript
// src/infrastructure/vault/quarantine.ts
export interface Quarantine {
	readonly quarantined: string[];
	add(path: string): void;
	has(path: string): boolean;
	clear(): void;
}

export function createQuarantine(): Quarantine {
	const paths: string[] = [];
	return {
		get quarantined() { return [...paths]; },
		add(path: string) { if (!paths.includes(path)) paths.push(path); },
		has(path: string) { return paths.includes(path); },
		clear() { paths.length = 0; },
	};
}
```

```typescript
// src/infrastructure/vault/vault-loader.ts
import type { ZodSchema } from 'zod';
import { Result, type ResultValue } from '../../domain/core/result.js';
import { parseFrontmatter } from './frontmatter-parser.js';
import { createQuarantine, type Quarantine } from './quarantine.js';

export interface VaultLoader {
	loadEntity<T>(markdown: string, schema: ZodSchema<T>, filePath: string): ResultValue<T>;
	readonly quarantined: string[];
}

export function createVaultLoader(): VaultLoader {
	const quarantine = createQuarantine();

	return {
		get quarantined() { return quarantine.quarantined; },

		loadEntity<T>(markdown: string, schema: ZodSchema<T>, filePath: string): ResultValue<T> {
			const parsed = parseFrontmatter(markdown);
			if (!parsed.ok) {
				quarantine.add(filePath);
				return Result.err({ ...parsed.error, context: { filePath } });
			}

			const validated = schema.safeParse(parsed.value);
			if (!validated.success) {
				quarantine.add(filePath);
				return Result.err({
					code: 'SCHEMA_INVALID',
					message: `Schema validation failed for ${filePath}: ${validated.error.message}`,
					system: 'VaultSync',
					recoverable: true,
					context: { filePath, errors: validated.error.issues },
				});
			}

			return Result.ok(validated.data);
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/vault-loader.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/vault/" "01 - Projects/Project Meridian/tests/infrastructure/vault/"
git commit -m "feat(meridian): VaultLoader with Zod validation and quarantine for invalid files"
```

---

### Task D3: VaultDirectoryLoader (Directory Scan → Validated Entities)

**Files:**
- Create: `src/infrastructure/vault/vault-directory-loader.ts`
- Create: `tests/infrastructure/vault/vault-directory-loader.test.ts`

- [ ] **Step 1: Write failing tests for VaultDirectoryLoader**

```typescript
// tests/infrastructure/vault/vault-directory-loader.test.ts
import { describe, it, expect } from 'vitest';
import { createVaultDirectoryLoader } from '../../../src/infrastructure/vault/vault-directory-loader.js';
import { createMemfsVaultAdapter } from '../../../src/infrastructure/vault/memfs-vault-adapter.js';
import { AgentSchema } from '../../../src/domain/schemas/agent-schema.js';
import { TraitSchema } from '../../../src/domain/schemas/trait-schema.js';

describe('VaultDirectoryLoader', () => {
	const agentElena = `---
id: agent-merchant-elena
name: Elena Vasquez
kind: merchant
attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 }
social: { status: 0, reputation: 0, charisma: 14 }
needs: { hunger: 80, energy: 90, social: 70 }
wallet: { gold: 100 }
position: { x: 100, y: 200, region: loc-marketplace }
behavior_tree: config/kinds/merchant-bt.json
---`;

	const agentBad = `---
id: bad-prefix
name: 123
---`;

	const traitUnkillable = `---
id: trait-unkillable
name: Unkillable
description: Cannot die.
category: survival
effects:
  - system: MortalityCheck
    modifier: { prevent_death: true }
assignable_by: director
stackable: false
conflicts_with: []
---`;

	it('loads all valid agents from a directory', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': agentElena,
			'config/traits/unkillable.md': traitUnkillable,
		});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.loaded[0].id).toBe('agent-merchant-elena');
		expect(result.quarantined).toHaveLength(0);
	});

	it('quarantines invalid files and continues loading valid ones', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': agentElena,
			'agents/bad.md': agentBad,
		});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.quarantined).toHaveLength(1);
		expect(result.quarantined[0]).toBe('agents/bad.md');
	});

	it('loads traits from config directory', async () => {
		const adapter = createMemfsVaultAdapter({
			'config/traits/unkillable.md': traitUnkillable,
		});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('config/traits/', TraitSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.loaded[0].id).toBe('trait-unkillable');
	});

	it('returns empty results for empty directory', async () => {
		const adapter = createMemfsVaultAdapter({});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(0);
		expect(result.quarantined).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/vault-directory-loader.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement VaultDirectoryLoader**

```typescript
// src/infrastructure/vault/vault-directory-loader.ts
import type { ZodSchema } from 'zod';
import type { VaultAdapter } from '../../domain/core/vault-adapter.js';
import { createVaultLoader } from './vault-loader.js';
import type { Logger } from '../../domain/core/logger.js';

export interface DirectoryLoadResult<T> {
	loaded: T[];
	quarantined: string[];
}

export interface VaultDirectoryLoader {
	loadDirectory<T>(directory: string, schema: ZodSchema<T>): Promise<DirectoryLoadResult<T>>;
}

export function createVaultDirectoryLoader(
	adapter: VaultAdapter,
	logger?: Logger,
): VaultDirectoryLoader {
	const entityLoader = createVaultLoader();

	return {
		async loadDirectory<T>(directory: string, schema: ZodSchema<T>): Promise<DirectoryLoadResult<T>> {
			const files = await adapter.listFiles(directory);
			const loaded: T[] = [];
			const quarantined: string[] = [];

			for (const filePath of files) {
				const readResult = await adapter.readFile(filePath);
				if (!readResult.ok) {
					quarantined.push(filePath);
					logger?.warn('VaultSync', `Could not read ${filePath}: ${readResult.error.message}`);
					continue;
				}

				const validateResult = entityLoader.loadEntity(readResult.value, schema, filePath);
				if (!validateResult.ok) {
					quarantined.push(filePath);
					logger?.warn('VaultSync', `Invalid file ${filePath}: ${validateResult.error.message}`);
					continue;
				}

				loaded.push(validateResult.value);
			}

			logger?.info('VaultSync', `Loaded ${loaded.length} entities from ${directory}, quarantined ${quarantined.length}`);
			return { loaded, quarantined };
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/vault/vault-directory-loader.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/vault/vault-directory-loader.ts" "01 - Projects/Project Meridian/tests/infrastructure/vault/vault-directory-loader.test.ts"
git commit -m "feat(meridian): VaultDirectoryLoader — loads all entities from a vault directory via VaultAdapter"
```

---

## Chunk E: Game Config

### Task E1: GameConfig Schema and Loader

**Files:**
- Create: `src/domain/schemas/game-config-schema.ts`
- Create: `src/infrastructure/config/game-config-loader.ts`
- Create: `tests/infrastructure/config/game-config-loader.test.ts`

- [ ] **Step 1: Write failing tests for GameConfig**

```typescript
// tests/infrastructure/config/game-config-loader.test.ts
import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { loadGameConfig } from '../../../src/infrastructure/config/game-config-loader.js';

describe('GameConfigSchema', () => {
	it('validates a minimal config with all defaults applied', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.tick_interval_ms).toBe(500);
			expect(result.data.ticks_per_day).toBe(480);
			expect(result.data.mortality).toBe(true);
			expect(result.data.locale).toBe('en');
			expect(result.data.needs.hunger_decay).toBe(0.5);
			expect(result.data.economy.tax_rate).toBe(0.05);
		}
	});

	it('accepts overrides', () => {
		const result = GameConfigSchema.safeParse({
			tick_interval_ms: 100,
			mortality: false,
			locale: 'de',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.tick_interval_ms).toBe(100);
			expect(result.data.mortality).toBe(false);
			expect(result.data.locale).toBe('de');
		}
	});
});

describe('loadGameConfig', () => {
	it('loads config from JSON string using Result type', () => {
		const json = '{ "mortality": false }';
		const result = loadGameConfig(json);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.mortality).toBe(false);
			expect(result.value.tick_interval_ms).toBe(500);
		}
	});

	it('returns error for invalid JSON', () => {
		const result = loadGameConfig('not json');
		expect(result.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/config/ --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement GameConfigSchema**

```typescript
// src/domain/schemas/game-config-schema.ts
import { z } from 'zod';

export const GameConfigSchema = z.object({
	version: z.string().default('1.0.0'),
	locale: z.string().default('en'),
	tick_interval_ms: z.number().int().min(50).default(500),
	ticks_per_day: z.number().int().min(1).default(480),
	mortality: z.boolean().default(true),
	needs: z.object({
		hunger_decay: z.number().default(0.5),
		energy_decay: z.number().default(0.25),
		social_decay: z.number().default(0.15),
	}).default({}),
	stamina: z.object({
		recovery_per_idle_tick: z.number().default(0.05),
		exhaustion_speed_modifier: z.number().default(0.5),
		exhaustion_skill_penalty: z.number().default(-2),
	}).default({}),
	memory: z.object({
		max_entries: z.number().int().default(50),
		min_lifespan_ticks: z.number().int().default(20),
	}).default({}),
	economy: z.object({
		tax_rate: z.number().min(0).max(1).default(0.05),
		price_clamp_min: z.number().default(0.5),
		price_clamp_max: z.number().default(3.0),
		recalculation_interval_ticks: z.number().int().default(10),
		welfare_threshold_gold: z.number().default(10),
		welfare_reward_min: z.number().default(15),
		welfare_reward_max: z.number().default(25),
		max_active_welfare_quests: z.number().int().default(3),
		treasury_start_sandbox: z.number().default(500),
		treasury_regen_per_day: z.number().default(1),
		circulation_floor_per_agent: z.number().default(50),
		loan_interest_per_day: z.number().default(0.01),
	}).default({}),
	mood: z.object({
		factor_weights: z.object({
			needs: z.number().default(30),
			positive_memories: z.number().default(20),
			negative_memories: z.number().default(20),
			goal_progress: z.number().default(10),
			wallet: z.number().default(10),
			equipment: z.number().default(5),
			relationships: z.number().default(5),
		}).default({}),
		external_modifier_cap: z.number().default(30),
	}).default({}),
	mortality_config: z.object({
		starvation_collapse_ticks: z.number().int().default(50),
		starvation_death_ticks: z.number().int().default(100),
		despair_death_ticks: z.number().int().default(200),
		quest_danger_mortality_chance: z.number().min(0).max(1).default(0.1),
	}).default({}),
	perception: z.object({
		base_multiplier: z.number().default(20),
		night_multiplier: z.number().default(10),
	}).default({}),
	day_night: z.object({
		dawn: z.object({ start: z.number().default(0), end: z.number().default(59) }).default({}),
		day: z.object({ start: z.number().default(60), end: z.number().default(299) }).default({}),
		dusk: z.object({ start: z.number().default(300), end: z.number().default(359) }).default({}),
		night: z.object({ start: z.number().default(360), end: z.number().default(479) }).default({}),
	}).default({}),
	gossip: z.object({
		reliability_tiers: z.array(z.number()).default([1.0, 0.7, 0.5, 0.3]),
		iq_filter_threshold: z.number().default(12),
	}).default({}),
	crime: z.object({
		mood_threshold: z.number().default(-20),
	}).default({}),
	skills: z.object({
		use_thresholds: z.array(z.number().int()).default([10, 25, 50, 100, 200]),
		max_use_bonus: z.number().int().default(3),
	}).default({}),
	rest_tiers: z.object({
		owned_home: z.object({ recovery_rate: z.number().default(2.0), mood_effect: z.number().default(2) }).default({}),
		public_shelter: z.object({ recovery_rate: z.number().default(1.5), mood_effect: z.number().default(0) }).default({}),
		outdoors: z.object({ recovery_rate: z.number().default(1.0), mood_effect: z.number().default(-3) }).default({}),
	}).default({}),
	season: z.object({
		days_per_season: z.number().int().default(15),
	}).default({}),
	candidate_pool: z.object({
		size_min: z.number().int().default(3),
		size_max: z.number().int().default(5),
		weighted_count: z.number().int().default(2),
		refresh_days: z.number().int().default(5),
	}).default({}),
	world_events: z.object({
		evaluation_interval_ticks: z.number().int().default(50),
	}).default({}),
	canvas_checkpoint_interval_ticks: z.number().int().default(50),
	ui_bridge_snapshot_interval_ticks: z.number().int().default(10),
	vault_sync_debounce_ms: z.number().int().default(2000),
	llm: z.object({
		provider: z.string().default('cursor'),
		budget_daily_calls: z.number().int().default(50),
	}).default({}),
	formulas: z.object({
		basic_speed_divisor: z.number().default(4),
		carry_capacity_multiplier: z.number().default(5),
		trade_modifier_per_chr: z.number().default(0.02),
		social_reach_multiplier: z.number().default(0.5),
	}).default({}),
	bt: z.object({
		quest_wage_skip_multiplier: z.number().default(1.5),
	}).default({}),
	agent_creation: z.object({
		base_cost: z.number().default(50),
		cost_per_attribute_point: z.number().default(5),
		candidate_discount: z.number().default(0.7),
	}).default({}),
	world_health: z.object({
		tiers: z.array(z.object({
			name: z.string(),
			max: z.number(),
			positive_event_multiplier: z.number(),
			negative_event_multiplier: z.number(),
		})).default([
			{ name: 'critical', max: 20, positive_event_multiplier: 2.0, negative_event_multiplier: 0.3 },
			{ name: 'struggling', max: 40, positive_event_multiplier: 1.5, negative_event_multiplier: 0.6 },
			{ name: 'stable', max: 60, positive_event_multiplier: 1.0, negative_event_multiplier: 1.0 },
			{ name: 'thriving', max: 80, positive_event_multiplier: 0.8, negative_event_multiplier: 1.3 },
			{ name: 'booming', max: 100, positive_event_multiplier: 0.6, negative_event_multiplier: 1.5 },
		]),
	}).default({}),
	debug: z.boolean().default(false),
}).default({});

export type GameConfig = z.infer<typeof GameConfigSchema>;
```

- [ ] **Step 4: Implement config loader**

```typescript
// src/infrastructure/config/game-config-loader.ts
import { GameConfigSchema, type GameConfig } from '../../domain/schemas/game-config-schema.js';
import { Result, type ResultValue } from '../../domain/core/result.js';

export function loadGameConfig(jsonString: string): ResultValue<GameConfig> {
	let raw: unknown;
	try {
		raw = JSON.parse(jsonString);
	} catch {
		return Result.err({
			code: 'CONFIG_PARSE_ERROR',
			message: 'Failed to parse game-config.json',
			system: 'Config',
			recoverable: true,
		});
	}

	const validated = GameConfigSchema.safeParse(raw);
	if (!validated.success) {
		return Result.err({
			code: 'CONFIG_SCHEMA_INVALID',
			message: `game-config.json validation failed: ${validated.error.message}`,
			system: 'Config',
			recoverable: true,
		});
	}

	return Result.ok(validated.data);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/config/ --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" "01 - Projects/Project Meridian/src/infrastructure/config/" "01 - Projects/Project Meridian/tests/infrastructure/config/"
git commit -m "feat(meridian): GameConfig Zod schema with all defaults + config loader"
```

---

## Chunk F: Trait System

### Task F1: TraitResolverSystem

**Files:**
- Create: `src/domain/systems/trait-resolver.ts`
- Create: `tests/domain/systems/trait-resolver.test.ts`

- [ ] **Step 1: Write failing tests for TraitResolver**

```typescript
// tests/domain/systems/trait-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTraitModifiers, type TraitDefinition, type ModifierMap } from '../../../src/domain/systems/trait-resolver.js';

describe('TraitResolver', () => {
	const traits: Record<string, TraitDefinition> = {
		'trait-resilient': {
			id: 'trait-resilient',
			effects: [
				{ system: 'NeedsDecaySystem', modifier: { hunger_decay: 0.5, energy_decay: 0.5 } },
			],
			conflicts_with: [],
		},
		'trait-workaholic': {
			id: 'trait-workaholic',
			effects: [
				{ system: 'JobSystem', modifier: { productivity: 1.1 } },
				{ system: 'MoodSystem', modifier: { overtime_penalty: 0 } },
			],
			conflicts_with: ['trait-loner'],
		},
		'trait-loner': {
			id: 'trait-loner',
			effects: [
				{ system: 'NeedsDecaySystem', modifier: { social_decay: 0 } },
			],
			conflicts_with: ['trait-workaholic'],
		},
	};

	it('builds a modifier map from agent trait IDs', () => {
		const result = resolveTraitModifiers(['trait-resilient'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const mods = result.value;
			expect(mods.get('NeedsDecaySystem')).toEqual({ hunger_decay: 0.5, energy_decay: 0.5 });
		}
	});

	it('merges modifiers from multiple traits targeting the same system', () => {
		const result = resolveTraitModifiers(['trait-resilient', 'trait-loner'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const needsMods = result.value.get('NeedsDecaySystem');
			expect(needsMods).toEqual({ hunger_decay: 0.5, energy_decay: 0.5, social_decay: 0 });
		}
	});

	it('detects trait conflicts and returns error', () => {
		const result = resolveTraitModifiers(['trait-workaholic', 'trait-loner'], traits);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('TRAIT_CONFLICT');
		}
	});

	it('handles unknown trait IDs gracefully', () => {
		const result = resolveTraitModifiers(['trait-nonexistent'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.size).toBe(0);
		}
	});

	it('returns empty map for no traits', () => {
		const result = resolveTraitModifiers([], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.size).toBe(0);
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/trait-resolver.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement TraitResolver**

```typescript
// src/domain/systems/trait-resolver.ts
import { Result, type ResultValue } from '../core/result.js';

export interface TraitEffect {
	system: string;
	modifier: Record<string, unknown>;
}

export interface TraitDefinition {
	id: string;
	effects: TraitEffect[];
	conflicts_with: string[];
}

export type ModifierMap = Map<string, Record<string, unknown>>;

export function resolveTraitModifiers(
	agentTraitIds: string[],
	traitDefinitions: Record<string, TraitDefinition>,
): ResultValue<ModifierMap> {
	const activeTraits: TraitDefinition[] = [];

	for (const id of agentTraitIds) {
		const def = traitDefinitions[id];
		if (!def) continue;
		activeTraits.push(def);
	}

	// Check conflicts
	for (let i = 0; i < activeTraits.length; i++) {
		for (let j = i + 1; j < activeTraits.length; j++) {
			const a = activeTraits[i];
			const b = activeTraits[j];
			if (a.conflicts_with.includes(b.id) || b.conflicts_with.includes(a.id)) {
				return Result.err({
					code: 'TRAIT_CONFLICT',
					message: `Trait conflict: ${a.id} conflicts with ${b.id}`,
					system: 'TraitResolverSystem',
					recoverable: true,
					context: { traitA: a.id, traitB: b.id },
				});
			}
		}
	}

	// Build modifier map
	const modifierMap: ModifierMap = new Map();

	for (const trait of activeTraits) {
		for (const effect of trait.effects) {
			const existing = modifierMap.get(effect.system) ?? {};
			modifierMap.set(effect.system, { ...existing, ...effect.modifier });
		}
	}

	return Result.ok(modifierMap);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/trait-resolver.test.ts --config configs/vitest.config.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/" "01 - Projects/Project Meridian/tests/domain/systems/"
git commit -m "feat(meridian): TraitResolverSystem with modifier map building and conflict detection"
```

---

## Chunk F2: Full Test Suite & Phase 0 Verification

### Task F2: Run All Tests and Verify Phase 0 Acceptance Criteria

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: ALL PASS. Target: ~38 tests across 11 test files.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: No errors.

- [ ] **Step 4: Verify Phase 0 acceptance criteria checklist**

| Criterion | Task | Status |
|-----------|------|--------|
| ExcaliburJS engine initializes in Obsidian plugin view, renders a test sprite | A3 | Implemented + tested |
| EventBus emits and receives a typed event; history query returns it | B2 | Tested |
| Logger writes structured output to console and vault file | B3 | Tested (console; vault file logger deferred — infrastructure adapter for file I/O is available via VaultAdapter) |
| Result.ok() and Result.err() compose correctly through a 3-step chain | B1 | Tested |
| Zod schema validates a well-formed agent file; rejects malformed; quarantines invalid | C1 + D2 | Tested |
| VaultSync loads all markdown from a test vault directory into validated entities | D0 + D3 | Tested (via VaultAdapter + VaultDirectoryLoader) |
| Trait schema validates trait-unkillable.md; TraitResolverSystem builds modifier map | C1 + F1 | Tested |

- [ ] **Step 5: Final commit**

```bash
git add -A "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 0 Foundation complete — all acceptance criteria met"
```

---

## File Structure Summary

```
01 - Projects/Project Meridian/
├── package.json
├── manifest.json
├── configs/
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── eslint.config.mjs
├── src/
│   ├── main.ts
│   ├── plugin.ts
│   ├── domain/
│   │   ├── core/
│   │   │   ├── result.ts
│   │   │   ├── events.ts
│   │   │   ├── logger.ts
│   │   │   └── vault-adapter.ts
│   │   ├── schemas/
│   │   │   ├── common.ts
│   │   │   ├── agent-schema.ts
│   │   │   ├── trait-schema.ts
│   │   │   └── game-config-schema.ts
│   │   └── systems/
│   │       └── trait-resolver.ts
│   └── infrastructure/
│       ├── engine/
│       │   ├── game-engine.ts
│       │   └── game-view.ts
│       ├── event-bus.ts
│       ├── logger/
│       │   └── console-logger.ts
│       ├── vault/
│       │   ├── frontmatter-parser.ts
│       │   ├── vault-loader.ts
│       │   ├── vault-directory-loader.ts
│       │   ├── memfs-vault-adapter.ts
│       │   └── quarantine.ts
│       └── config/
│           └── game-config-loader.ts
└── tests/
    ├── domain/
    │   ├── core/
    │   │   └── result.test.ts
    │   ├── schemas/
    │   │   ├── agent-schema.test.ts
    │   │   └── trait-schema.test.ts
    │   └── systems/
    │       └── trait-resolver.test.ts
    └── infrastructure/
        ├── engine/
        │   └── game-engine.test.ts
        ├── event-bus.test.ts
        ├── logger/
        │   └── console-logger.test.ts
        ├── vault/
        │   ├── memfs-vault-adapter.test.ts
        │   ├── frontmatter-parser.test.ts
        │   ├── vault-loader.test.ts
        │   └── vault-directory-loader.test.ts
        └── config/
            └── game-config-loader.test.ts
```

**Layer direction enforced by ESLint (GDD §36.3):**
```
Infrastructure (engine, vault, config, event-bus, logger)
    → Domain (schemas, core, systems)
    → [Future: UI (Vue/Pinia)]
```

Domain NEVER imports infrastructure. Infrastructure implements domain interfaces. Systems communicate via EventBus — no system imports another system.
