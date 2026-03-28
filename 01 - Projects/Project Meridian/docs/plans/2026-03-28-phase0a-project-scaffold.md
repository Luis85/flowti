# Phase 0A: Project Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
n**Dependencies:** None — this is the first chunk.
**Produces:** Project scaffold, build tooling, ExcaliburJS engine in Obsidian view

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

