# Agentonomous Infrastructure Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Agentonomous Obsidian plugin with a complete target-architecture skeleton (Vue 3 + Vue Router + Pinia presentation layer, Meridian-style three-layer DDD split, Storybook 10 + Vitest 4 + TypeScript 6 harness), opening a "Homepage" view via ribbon or command — with no business logic.

**Architecture:** Mirrors Project Meridian's `Infrastructure → Domain → UI` split, ESLint-enforced. Vue is pure presentation: domain types are plain TypeScript, stores translate them to Vue reactivity via domain ports, components are props-in/events-out. Obsidian imports limited to an allowlist. Build outputs to `dist/`, a post-build script deploys into a dedicated test vault at `C:\Projects\Agentonomous\.obsidian\plugins\agentonomous\`.

**Tech Stack:** TypeScript 6, Vue 3, Vue Router 4, Pinia 2, Vite 7, Vitest 4, `@vue/test-utils`, Storybook 10.3 (`@storybook/vue3-vite` + `@storybook/addon-a11y` + `@storybook/addon-vitest`), TypeDoc 0.28, ESLint 10 (flat config) with `eslint-plugin-obsidianmd`, `eslint-plugin-vue`, `vue-eslint-parser`, Obsidian 1.12.7 API. Node ≥ 20.19.

**Spec:** [`01 - Projects/Agentonomous/docs/specs/2026-04-15-agentonomous-skeleton-design.md`](../specs/2026-04-15-agentonomous-skeleton-design.md)

**Conventions referenced:**
- All paths below are relative to `01 - Projects/Agentonomous/` unless otherwise stated.
- `cd` into `01 - Projects/Agentonomous/` before running any `npm`/`npx` command.
- All commits use the `agentonomous` scope: `feat(agentonomous): …`, `chore(agentonomous): …`, etc.
- Add `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` to every commit footer.
- Indentation: tabs. Imports: `.js` extensions in TS source (ESM, NodeNext). No `any`, no `@ts-ignore`, no `TODO`/`FIXME`.
- Tests go under `tests/` mirroring `src/`. Domain tests must not import Vue, Pinia, or Obsidian.

---

## Chunk 1: Project bootstrap

**Goal:** Create folder skeleton, `package.json` with locked dependency list, static plugin metadata (`manifest.json`, `versions.json`), root-level housekeeping (`README.md`, `LICENSE`, `.gitignore`), and `version-bump.mjs`. At the end of this chunk, `npm install` succeeds and the project folder has the committed skeleton but no source yet.

### Task 1.1: Create folder skeleton

**Files:**
- Create: `01 - Projects/Agentonomous/src/`
- Create: `01 - Projects/Agentonomous/src/domain/settings/`
- Create: `01 - Projects/Agentonomous/src/domain/shared/`
- Create: `01 - Projects/Agentonomous/src/infrastructure/obsidian/`
- Create: `01 - Projects/Agentonomous/src/infrastructure/views/`
- Create: `01 - Projects/Agentonomous/src/infrastructure/settings/`
- Create: `01 - Projects/Agentonomous/src/infrastructure/ribbon/`
- Create: `01 - Projects/Agentonomous/src/ui/router/`
- Create: `01 - Projects/Agentonomous/src/ui/stores/`
- Create: `01 - Projects/Agentonomous/src/ui/pages/`
- Create: `01 - Projects/Agentonomous/src/ui/components/`
- Create: `01 - Projects/Agentonomous/configs/storybook/`
- Create: `01 - Projects/Agentonomous/scripts/`
- Create: `01 - Projects/Agentonomous/styles/`
- Create: `01 - Projects/Agentonomous/stories/`
- Create: `01 - Projects/Agentonomous/tests/domain/settings/`
- Create: `01 - Projects/Agentonomous/tests/domain/shared/`
- Create: `01 - Projects/Agentonomous/tests/infrastructure/obsidian/`
- Create: `01 - Projects/Agentonomous/tests/ui/stores/`
- Create: `01 - Projects/Agentonomous/tests/ui/components/`
- Create: `01 - Projects/Agentonomous/tests/ui/pages/`

- [ ] **Step 1: Create all directories**

Run from `01 - Projects/Agentonomous/`:
```bash
mkdir -p src/domain/settings src/domain/shared \
         src/infrastructure/obsidian src/infrastructure/views src/infrastructure/settings src/infrastructure/ribbon \
         src/ui/router src/ui/stores src/ui/pages src/ui/components \
         configs/storybook scripts styles stories \
         tests/domain/settings tests/domain/shared \
         tests/infrastructure/obsidian \
         tests/ui/stores tests/ui/components tests/ui/pages
```

- [ ] **Step 2: Verify the tree**

Run: `find src tests configs scripts styles stories -type d | sort`
Expected: all 21 directories from the list above appear. (Git tracks files, not directories, so empty directories are not committed — they will be committed as their first real file is added in later chunks. Do not add `.gitkeep` files.)

### Task 1.2: Write `package.json`

**Files:**
- Create: `01 - Projects/Agentonomous/package.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agentonomous",
  "version": "0.0.1",
  "description": "Autonomous agents sandbox — Vue 3 + DDD infrastructure skeleton for Obsidian.",
  "type": "module",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "build": "vite build --config configs/vite.config.ts",
    "build:dev": "vite build --config configs/vite.config.ts --watch",
    "deploy": "node scripts/deploy-to-test-vault.mjs",
    "test": "npm run lint && npm run typecheck && npm run test:unit",
    "test:unit": "vitest run --config configs/vitest.config.ts",
    "test:watch": "vitest --config configs/vitest.config.ts",
    "typecheck": "tsc --noEmit --project configs/tsconfig.json",
    "lint": "eslint src/ --config configs/eslint.config.mjs",
    "storybook": "storybook dev -p 6006 -c configs/storybook",
    "build-storybook": "storybook build -c configs/storybook",
    "docs": "typedoc --options configs/typedoc.json",
    "release": "node scripts/package-release.mjs",
    "version": "node version-bump.mjs && git add manifest.json versions.json"
  },
  "devDependencies": {
    "@storybook/addon-a11y": "^10.3.0",
    "@storybook/addon-vitest": "^10.3.0",
    "@storybook/test": "^10.3.0",
    "@storybook/vue3-vite": "^10.3.0",
    "@types/node": "^22.0.0",
    "@typescript-eslint/eslint-plugin": "^8.58.0",
    "@typescript-eslint/parser": "^8.58.0",
    "@vitejs/plugin-vue": "^6.0.0",
    "@vitest/coverage-v8": "^4.1.2",
    "@vue/test-utils": "^2.4.6",
    "eslint": "^10.1.0",
    "eslint-plugin-obsidianmd": "^0.1.9",
    "eslint-plugin-vue": "^10.0.0",
    "jsdom": "^29.0.1",
    "obsidian": "^1.12.3",
    "pinia": "^2.3.0",
    "storybook": "^10.3.0",
    "typedoc": "^0.28.18",
    "typescript": "^6.0.2",
    "typescript-eslint": "^8.58.0",
    "vite": "^7.0.0",
    "vitest": "^4.1.2",
    "vue": "^3.5.0",
    "vue-eslint-parser": "^10.0.0",
    "vue-router": "^4.4.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Run `npm install`**

Run from `01 - Projects/Agentonomous/`:
```bash
npm install
```

Expected: `node_modules/` appears, `package-lock.json` is generated, no peer-dependency errors that block install. Warnings about optional peers are acceptable. If a package fails to resolve, stop and report — do not downgrade versions silently.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/package.json" "01 - Projects/Agentonomous/package-lock.json"
git commit -m "chore(agentonomous): scaffold package.json with locked dependency set

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: Write `manifest.json` and `versions.json`

**Files:**
- Create: `01 - Projects/Agentonomous/manifest.json`
- Create: `01 - Projects/Agentonomous/versions.json`

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "id": "agentonomous",
  "name": "Agentonomous",
  "version": "0.0.1",
  "minAppVersion": "1.12.7",
  "description": "Autonomous agents sandbox — Vue 3 + DDD infrastructure skeleton.",
  "author": "Luis Mendez",
  "isDesktopOnly": true
}
```

- [ ] **Step 2: Create `versions.json`**

```json
{
  "0.0.1": "1.12.7"
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/manifest.json" "01 - Projects/Agentonomous/versions.json"
git commit -m "chore(agentonomous): add manifest.json and versions.json

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: Write `version-bump.mjs`

**Files:**
- Create: `01 - Projects/Agentonomous/version-bump.mjs`

- [ ] **Step 1: Create the version-bump script (ported from Meridian)**

```js
import { readFileSync, writeFileSync } from 'node:fs';

const targetVersion = process.env.npm_package_version;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/version-bump.mjs"
git commit -m "chore(agentonomous): add version-bump script

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.5: Write `.gitignore`

**Files:**
- Create: `01 - Projects/Agentonomous/.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
node_modules/
dist/
coverage/
docs/api/
storybook-static/
.vite/
*.log
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/.gitignore"
git commit -m "chore(agentonomous): add gitignore

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.6: Write `README.md`

**Files:**
- Create: `01 - Projects/Agentonomous/README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Agentonomous

Autonomous agents sandbox — an Obsidian plugin scaffolded as a Vue 3 + DDD infrastructure skeleton. First increment ships the target architecture and build harness with no business logic.

## Status

`0.0.1` — infrastructure skeleton only. No autonomous-agent features yet.

## Install (development)

Requires Node `>=20.19.0`.

```bash
cd "01 - Projects/Agentonomous"
npm install
npm run build
```

`npm run build` emits `dist/main.js`, `dist/manifest.json`, `dist/styles.css` and auto-deploys them to the test vault resolved from `AGENTONOMOUS_TEST_VAULT` (default `C:\Projects\Agentonomous`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Production build + deploy to test vault |
| `npm run build:dev` | Watch build + deploy on each change |
| `npm test` | Lint + typecheck + Vitest |
| `npm run test:watch` | Vitest watch mode |
| `npm run storybook` | Storybook 10 dev server on `:6006` |
| `npm run docs` | Generate TypeDoc API docs in `docs/api/` |
| `npm run release` | Produce `dist/agentonomous-<version>.zip` |

## Architecture

Three layers enforced by ESLint:

- `src/domain/` — plain TypeScript. No Vue, no Obsidian, no `node:*`.
- `src/infrastructure/` — Obsidian adapters + platform I/O.
- `src/ui/` — Vue 3 + Pinia presentation. Consumes domain through ports and stores.

See `docs/specs/2026-04-15-agentonomous-skeleton-design.md`.

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/README.md"
git commit -m "docs(agentonomous): add README

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.7: Write `LICENSE`

**Files:**
- Create: `01 - Projects/Agentonomous/LICENSE`

- [ ] **Step 1: Create `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 Luis Mendez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/LICENSE"
git commit -m "chore(agentonomous): add MIT license

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 2: Quality harness configs

**Goal:** Ship every config file the quality gates need: TypeScript, ESLint (with the Vue SFC parser block), Vitest, Vite, TypeDoc, Storybook (`main.ts` + `preview.ts`), plus the three build-time scripts (`deploy-to-test-vault.mjs`, `package-release.mjs`, `concat-styles.mjs`). At the end, `npm run lint`, `npm run typecheck`, and `npm run test:unit` all succeed against a placeholder test.

### Task 2.1: Write `configs/tsconfig.json`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/tsconfig.json`

- [ ] **Step 1: Create the main TS config**

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
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "types": ["obsidian", "vite/client", "vitest/globals"],
    "lib": ["ES2022", "DOM"],
    "jsx": "preserve"
  },
  "include": ["../src/**/*.ts", "../src/**/*.vue"],
  "exclude": ["../tests/**/*", "../node_modules", "../dist"]
}
```

### Task 2.2: Write `configs/tsconfig.lint.json`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/tsconfig.lint.json`

- [ ] **Step 1: Create lint TS config (includes tests for type-aware linting)**

```json
{
  "extends": "./tsconfig.json",
  "include": ["../src/**/*.ts", "../src/**/*.vue", "../tests/**/*.ts", "../stories/**/*.ts"],
  "exclude": ["../node_modules", "../dist"]
}
```

- [ ] **Step 2: Commit (both tsconfigs together)**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/configs/tsconfig.json" "01 - Projects/Agentonomous/configs/tsconfig.lint.json"
git commit -m "chore(agentonomous): add TypeScript 6 strict configs

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: Write `configs/eslint.config.mjs`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/eslint.config.mjs`

This is the most important quality-gate file. It has three file-scope blocks (TS src, TS tests, Vue SFCs). The Vue block uses `vue-eslint-parser` with `@typescript-eslint/parser` nested in `parserOptions.parser`. Meridian's layer-isolation `no-restricted-imports` rules are ported with Agentonomous path adjustments.

- [ ] **Step 1: Create the ESLint flat config**

```js
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import vueparser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import obsidianmd from 'eslint-plugin-obsidianmd';

/** Merge all Vue flat/recommended config entries' rules into one object. */
const vueRecommendedRules = Object.assign(
	{},
	...(vuePlugin.configs['flat/recommended'] ?? []).map((c) => c.rules ?? {}),
);

const sharedTsRules = {
	'@typescript-eslint/no-explicit-any': 'error',
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
	'@typescript-eslint/strict-boolean-expressions': 'error',
	'@typescript-eslint/no-floating-promises': 'error',
	'@typescript-eslint/no-misused-promises': 'error',
	'@typescript-eslint/require-await': 'error',
	'@typescript-eslint/await-thenable': 'error',
	'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
	'@typescript-eslint/no-unnecessary-condition': 'error',
	'@typescript-eslint/no-unsafe-return': 'error',
	'@typescript-eslint/no-unsafe-assignment': 'error',
	'@typescript-eslint/no-unsafe-argument': 'error',
	'@typescript-eslint/no-unsafe-member-access': 'error',
	'@typescript-eslint/no-unsafe-call': 'error',
	'@typescript-eslint/no-misused-spread': 'error',
	'@typescript-eslint/restrict-template-expressions': 'error',
	'@typescript-eslint/no-base-to-string': 'error',
	'@typescript-eslint/return-await': ['error', 'in-try-catch'],
	'@typescript-eslint/only-throw-error': 'error',
	'@typescript-eslint/no-confusing-void-expression': 'error',
	'@typescript-eslint/prefer-nullish-coalescing': 'error',
	'@typescript-eslint/prefer-optional-chain': 'error',
	'@typescript-eslint/no-unnecessary-type-assertion': 'error',
	'@typescript-eslint/no-duplicate-type-constituents': 'error',
	'@typescript-eslint/no-unnecessary-type-parameters': 'error',
	'@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
	'@typescript-eslint/no-redundant-type-constituents': 'error',
	'@typescript-eslint/no-useless-constructor': 'error',
	'eqeqeq': ['error', 'always'],
	'no-var': 'error',
	'prefer-const': 'error',
};

const noRestrictedDomElements = [
	'error',
	{ property: 'innerHTML', message: 'Use DOM API (createEl, createDiv, setText, classList) instead of innerHTML' },
	{ property: 'outerHTML', message: 'Use DOM API instead of outerHTML' },
	{ property: 'insertAdjacentHTML', message: 'Use DOM API instead of insertAdjacentHTML' },
];

const noTryCatchOutsideInfra = [
	'error',
	{ selector: 'TryStatement', message: 'Use Result type instead of try/catch outside src/infrastructure/** (spec §2.2 rule 4)' },
	{ selector: "UnaryExpression[operator='delete']", message: 'Use obj[key] = undefined instead of delete' },
];

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.lint.json',
				tsconfigRootDir: new URL('..', import.meta.url).pathname,
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
			'obsidianmd': obsidianmd,
		},
		rules: {
			...obsidianmd.configs?.recommended,
			'obsidianmd/ui/sentence-case': ['warn', { brands: ['Agentonomous'] }],
			...sharedTsRules,
			'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
			'complexity': ['warn', 10],
			'no-console': 'warn',
			'no-restricted-properties': noRestrictedDomElements,
			'no-restricted-syntax': noTryCatchOutsideInfra,
			'no-restricted-globals': [
				'error',
				{ name: 'require', message: 'Use ESM imports' },
			],
		},
	},
	{
		files: ['tests/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.lint.json',
				tsconfigRootDir: new URL('..', import.meta.url).pathname,
			},
		},
		plugins: { '@typescript-eslint': tseslint },
		rules: {
			...sharedTsRules,
			'no-console': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
	{
		files: ['**/*.vue'],
		languageOptions: {
			parser: vueparser,
			parserOptions: {
				parser: tsparser,
				project: './configs/tsconfig.lint.json',
				tsconfigRootDir: new URL('..', import.meta.url).pathname,
				extraFileExtensions: ['.vue'],
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
		plugins: {
			'vue': vuePlugin,
			'@typescript-eslint': tseslint,
		},
		rules: {
			...vueRecommendedRules,
			...sharedTsRules,
			'no-restricted-properties': noRestrictedDomElements,
		},
	},
	{
		files: ['src/infrastructure/**/*.ts'],
		rules: {
			'no-restricted-syntax': 'off',
			'no-console': 'off',
		},
	},
	{
		files: ['src/domain/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../infrastructure/*', '../../infrastructure/*'], message: 'Domain must not import infrastructure (spec §2.2 rule 1)' },
						{ group: ['obsidian', 'node:*'], message: 'Domain must not import platform modules' },
						{ group: ['vue', 'pinia', 'vue-router', '@vue/reactivity'], message: 'Domain must not import Vue — domain is plain TypeScript' },
					],
				},
			],
		},
	},
	{
		files: ['src/ui/**/*.ts', 'src/ui/**/*.vue'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../infrastructure/*', '../../infrastructure/*', '../../../infrastructure/*'], message: 'UI must not import infrastructure — use stores + ports (invariant 18)' },
					],
				},
			],
		},
	},
	{
		files: ['src/**/*.ts'],
		ignores: [
			'src/main.ts',
			'src/plugin.ts',
			'src/infrastructure/obsidian/**/*.ts',
			'src/infrastructure/views/*-view.ts',
			'src/infrastructure/settings/settings-tab.ts',
			'src/domain/**/*.ts',
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{ paths: [{ name: 'obsidian', message: 'Obsidian only allowed in allowlist (spec §2.2 rule 3)' }] },
			],
		},
	},
];
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/configs/eslint.config.mjs"
git commit -m "chore(agentonomous): add ESLint flat config with Vue + Obsidian rules

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.4: Write `configs/vitest.config.ts`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/vitest.config.ts`
- Create: `01 - Projects/Agentonomous/tests/placeholder.test.ts`

- [ ] **Step 1: Create the Vitest config with Storybook 10 + Vue plugins**

`@storybook/addon-vitest` ships a Vite plugin (`storybookTest`) that projects stories with `play` functions into the Vitest tree. Without it, `vitest run` will not execute Storybook interaction stories. With it, no `include` glob for `stories/**/*.stories.ts` is needed — the plugin handles story discovery via the Storybook config.

```ts
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
	plugins: [
		vue(),
		storybookTest({ configDir: resolve(projectRoot, 'configs/storybook') }),
	],
	test: {
		environment: 'jsdom',
		root: projectRoot,
		globals: true,
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts', 'src/**/*.vue'],
			exclude: ['src/main.ts', 'src/plugin.ts'],
			thresholds: {
				statements: 80,
				lines: 80,
				branches: 70,
				functions: 80,
			},
		},
	},
});
```

If `@storybook/addon-vitest/vitest-plugin` cannot be imported at this step (the Storybook configs live in Chunk 2 Task 2.10 but Storybook itself is installed in Chunk 1), that is expected — `npm install` completed in Task 1.2, so the package is on disk. Only story discovery fails until the Storybook config exists in Task 2.10; plain Vitest tests run fine.

- [ ] **Step 2: Add a placeholder test**

```ts
// tests/placeholder.test.ts
import { describe, expect, it } from 'vitest';

describe('placeholder', () => {
	it('harness boots', () => {
		expect(true).toBe(true);
	});
});
```

- [ ] **Step 3: Run tests and verify green**

Run from `01 - Projects/Agentonomous/`:
```bash
npx vitest run --config configs/vitest.config.ts
```

Expected: `1 passed`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/configs/vitest.config.ts" "01 - Projects/Agentonomous/tests/placeholder.test.ts"
git commit -m "chore(agentonomous): add vitest config + placeholder test

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.5: Write `scripts/concat-styles.mjs`

**Files:**
- Create: `01 - Projects/Agentonomous/scripts/concat-styles.mjs`

- [ ] **Step 1: Create the Vite plugin that concatenates `styles/*.css` → `dist/styles.css`**

```js
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function concatStyles({ projectRoot }) {
	return {
		name: 'agentonomous-concat-styles',
		closeBundle() {
			const stylesDir = resolve(projectRoot, 'styles');
			const distDir = resolve(projectRoot, 'dist');
			if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
			if (!existsSync(stylesDir)) {
				writeFileSync(resolve(distDir, 'styles.css'), '/* agentonomous: no styles */\n');
				return;
			}
			const files = readdirSync(stylesDir).filter((f) => f.endsWith('.css')).sort();
			const chunks = files.map((f) => {
				const body = readFileSync(resolve(stylesDir, f), 'utf8');
				return `/* ==== ${f} ==== */\n${body}\n`;
			});
			writeFileSync(resolve(distDir, 'styles.css'), chunks.join('\n'));
		},
	};
}
```

### Task 2.6: Write `scripts/deploy-to-test-vault.mjs`

**Files:**
- Create: `01 - Projects/Agentonomous/scripts/deploy-to-test-vault.mjs`

- [ ] **Step 1: Create the deploy script (idempotent)**

```js
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const vault = process.env.AGENTONOMOUS_TEST_VAULT ?? 'C:\\Projects\\Agentonomous';
const distDir = resolve(process.cwd(), 'dist');
const targetDir = resolve(vault, '.obsidian', 'plugins', 'agentonomous');
const files = ['main.js', 'manifest.json', 'styles.css'];

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
	const src = resolve(distDir, file);
	if (!existsSync(src)) {
		console.error(`[deploy] missing ${file} in dist/ — run \`npm run build\` first`);
		process.exit(1);
	}
	const dest = resolve(targetDir, file);
	copyFileSync(src, dest);
	const { size } = statSync(dest);
	console.log(`[deploy] ${file} -> ${dest} (${size} bytes)`);
}

console.log(`[deploy] ok — plugin deployed to ${targetDir}`);
```

### Task 2.7: Write `scripts/package-release.mjs`

**Files:**
- Create: `01 - Projects/Agentonomous/scripts/package-release.mjs`

- [ ] **Step 1: Create the release-zip script**

```js
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import archiver from 'archiver';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
const distDir = resolve(process.cwd(), 'dist');
const zipPath = resolve(distDir, `agentonomous-${manifest.version}.zip`);
const files = ['main.js', 'manifest.json', 'styles.css'];

for (const f of files) {
	if (!existsSync(resolve(distDir, f))) {
		console.error(`[release] missing ${f} in dist/ — run npm run build first`);
		process.exit(1);
	}
}

const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });
archive.on('error', (err) => { throw err; });
archive.pipe(output);
for (const f of files) archive.file(resolve(distDir, f), { name: f });
await archive.finalize();

console.log(`[release] wrote ${zipPath}`);
```

- [ ] **Step 2: Install `archiver` as a devDependency**

Run from `01 - Projects/Agentonomous/`:
```bash
npm install --save-dev archiver@^7.0.0
```

Expected: `package.json` gains `"archiver": "^7.0.0"`; `package-lock.json` updates.

- [ ] **Step 3: Commit the three scripts + archiver dep**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/scripts/" "01 - Projects/Agentonomous/package.json" "01 - Projects/Agentonomous/package-lock.json"
git commit -m "chore(agentonomous): add build scripts (deploy, release, concat-styles)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.8: Write `configs/vite.config.ts`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/vite.config.ts`

- [ ] **Step 1: Create the Vite config**

```ts
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { concatStyles } from '../scripts/concat-styles.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function copyManifest(): Plugin {
	return {
		name: 'agentonomous-copy-manifest',
		closeBundle() {
			const src = resolve(projectRoot, 'manifest.json');
			const dest = resolve(projectRoot, 'dist', 'manifest.json');
			if (existsSync(src)) copyFileSync(src, dest);
		},
	};
}

function runDeploy(): Plugin {
	return {
		name: 'agentonomous-run-deploy',
		closeBundle() {
			execSync('node scripts/deploy-to-test-vault.mjs', { cwd: projectRoot, stdio: 'inherit' });
		},
	};
}

export default defineConfig({
	plugins: [
		vue(),
		concatStyles({ projectRoot }),
		copyManifest(),
		runDeploy(),
	],
	build: {
		lib: {
			entry: resolve(projectRoot, 'src/main.ts'),
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		outDir: resolve(projectRoot, 'dist'),
		emptyOutDir: true,
		sourcemap: false,
		minify: true,
		rollupOptions: {
			external: ['obsidian', 'electron', /^node:/],
			output: {
				globals: { obsidian: 'obsidian' },
				banner: '/* Agentonomous — Obsidian plugin. Generated file, do not edit. */',
			},
		},
	},
});
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/configs/vite.config.ts"
git commit -m "chore(agentonomous): add Vite config with deploy + styles pipeline

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.9: Write `configs/typedoc.json`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/typedoc.json`

- [ ] **Step 1: Create the TypeDoc config**

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["../src/domain", "../src/infrastructure"],
  "entryPointStrategy": "expand",
  "exclude": ["**/*.vue", "**/*.test.ts"],
  "out": "../docs/api",
  "tsconfig": "./tsconfig.json",
  "skipErrorChecking": false,
  "disableSources": false,
  "readme": "none"
}
```

### Task 2.10: Write `configs/storybook/main.ts`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/storybook/main.ts`

- [ ] **Step 1: Create the Storybook 10 main config (ESM)**

```ts
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
	// Relative to this file (configs/storybook/main.ts) → project root → stories/
	stories: ['../../stories/**/*.stories.@(ts|mdx)'],
	addons: [
		'@storybook/addon-a11y',
		'@storybook/addon-vitest',
	],
	framework: {
		name: '@storybook/vue3-vite',
		options: {
			docgen: 'vue-component-meta',
		},
	},
	typescript: {
		check: false,
	},
};

export default config;
```

### Task 2.11: Write `configs/storybook/preview.ts`

**Files:**
- Create: `01 - Projects/Agentonomous/configs/storybook/preview.ts`

- [ ] **Step 1: Create the Storybook preview config**

```ts
import type { Preview } from '@storybook/vue3-vite';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
		a11y: {
			config: {},
			options: {},
		},
	},
};

export default preview;
```

- [ ] **Step 2: Commit TypeDoc + Storybook configs together**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/configs/typedoc.json" "01 - Projects/Agentonomous/configs/storybook/"
git commit -m "chore(agentonomous): add TypeDoc + Storybook 10 configs

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.12: Verify the harness is green on an empty project

- [ ] **Step 1: Run lint**

Run from `01 - Projects/Agentonomous/`:
```bash
npx eslint src/ --config configs/eslint.config.mjs
```

Expected: `0 problems`. `src/` has no files yet.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: `0 errors`.

- [ ] **Step 3: Run unit tests**

```bash
npx vitest run --config configs/vitest.config.ts
```

Expected: `1 passed` (placeholder).

- [ ] **Step 4: Run the full `npm test` command end-to-end**

```bash
npm test
```

Expected: exit code `0`.

- [ ] **Step 5: If any config needed a tweak, commit fix**

If Step 1–4 needed fixes (e.g. a plugin version incompat), commit those adjustments as `chore(agentonomous): harness verification fixes`. If no fix was needed, skip.

---

## Chunk 3: Domain layer (TDD)

**Goal:** Ship the pure-TypeScript domain layer. Every file here must have zero imports from `obsidian`, `node:*`, `src/infrastructure/**`, `vue`, `pinia`, `vue-router`, or `@vue/reactivity`. Tests for each file go into `tests/domain/` mirroring the path.

### Task 3.1: `Result<T, E>` type

**Files:**
- Create: `01 - Projects/Agentonomous/tests/domain/shared/result.test.ts`
- Create: `01 - Projects/Agentonomous/src/domain/shared/result.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/shared/result.test.ts
import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, type Result } from '../../../src/domain/shared/result.js';

describe('Result', () => {
	it('ok() creates an Ok variant holding the value', () => {
		const r: Result<number, string> = ok(42);
		expect(isOk(r)).toBe(true);
		expect(isErr(r)).toBe(false);
		if (isOk(r)) expect(r.value).toBe(42);
	});

	it('err() creates an Err variant holding the error', () => {
		const r: Result<number, string> = err('boom');
		expect(isErr(r)).toBe(true);
		expect(isOk(r)).toBe(false);
		if (isErr(r)) expect(r.error).toBe('boom');
	});

	it('isOk / isErr narrow the type correctly', () => {
		const value: Result<{ id: number }, string> = ok({ id: 7 });
		if (isOk(value)) expect(value.value.id).toBe(7);
	});
});
```

- [ ] **Step 2: Run test — verify it fails**

Run from `01 - Projects/Agentonomous/`:
```bash
npx vitest run tests/domain/shared/result.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module `src/domain/shared/result.js` does not exist.

- [ ] **Step 3: Implement `result.ts`**

```ts
// src/domain/shared/result.ts
export type Ok<T> = { readonly kind: 'ok'; readonly value: T };
export type Err<E> = { readonly kind: 'err'; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
	return { kind: 'ok', value };
}

export function err<E>(error: E): Err<E> {
	return { kind: 'err', error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
	return r.kind === 'ok';
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
	return r.kind === 'err';
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run tests/domain/shared/result.test.ts --config configs/vitest.config.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/domain/shared/result.ts" "01 - Projects/Agentonomous/tests/domain/shared/result.test.ts"
git commit -m "feat(agentonomous): add Result<T,E> type for domain error handling

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: `Unsubscribe` type alias

**Files:**
- Create: `01 - Projects/Agentonomous/src/domain/shared/unsubscribe.ts`

No dedicated test file — type aliases are verified at type-check time.

- [ ] **Step 1: Create the type alias**

```ts
// src/domain/shared/unsubscribe.ts
export type Unsubscribe = () => void;
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/domain/shared/unsubscribe.ts"
git commit -m "feat(agentonomous): add Unsubscribe type alias

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.3: `PluginSettings` type + `DEFAULT_SETTINGS` + `validateSettings`

**Files:**
- Create: `01 - Projects/Agentonomous/tests/domain/settings/plugin-settings.test.ts`
- Create: `01 - Projects/Agentonomous/src/domain/settings/plugin-settings.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/settings/plugin-settings.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from '../../../src/domain/settings/plugin-settings.js';
import { isErr, isOk } from '../../../src/domain/shared/result.js';

describe('validateSettings', () => {
	it('accepts default settings', () => {
		const r = validateSettings(DEFAULT_SETTINGS);
		expect(isOk(r)).toBe(true);
	});

	it('accepts raw JSON matching the schema', () => {
		const r = validateSettings({ showRibbonIcon: false, defaultView: 'home' });
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value.showRibbonIcon).toBe(false);
	});

	it('rejects a non-object', () => {
		expect(isErr(validateSettings(null))).toBe(true);
		expect(isErr(validateSettings('nope'))).toBe(true);
		expect(isErr(validateSettings(42))).toBe(true);
	});

	it('rejects a missing showRibbonIcon', () => {
		const r = validateSettings({ defaultView: 'home' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects a wrong-type showRibbonIcon', () => {
		const r = validateSettings({ showRibbonIcon: 'yes', defaultView: 'home' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects an unknown defaultView value', () => {
		const r = validateSettings({ showRibbonIcon: true, defaultView: 'not-a-view' });
		expect(isErr(r)).toBe(true);
	});

	it('DEFAULT_SETTINGS has showRibbonIcon = true and defaultView = home', () => {
		expect(DEFAULT_SETTINGS.showRibbonIcon).toBe(true);
		expect(DEFAULT_SETTINGS.defaultView).toBe('home');
	});
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run tests/domain/settings/plugin-settings.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `plugin-settings.ts`**

```ts
// src/domain/settings/plugin-settings.ts
import { err, ok, type Result } from '../shared/result.js';

export type DefaultViewName = 'home';

export type PluginSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
};

export const DEFAULT_SETTINGS: PluginSettings = {
	showRibbonIcon: true,
	defaultView: 'home',
};

const KNOWN_DEFAULT_VIEWS: readonly DefaultViewName[] = ['home'];

function isObject(x: unknown): x is Record<string, unknown> {
	return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function validateSettings(raw: unknown): Result<PluginSettings, string> {
	if (!isObject(raw)) return err('settings must be an object');
	const { showRibbonIcon, defaultView } = raw;
	if (typeof showRibbonIcon !== 'boolean') return err('showRibbonIcon must be boolean');
	if (typeof defaultView !== 'string') return err('defaultView must be string');
	if (!KNOWN_DEFAULT_VIEWS.includes(defaultView as DefaultViewName)) {
		return err(`defaultView must be one of: ${KNOWN_DEFAULT_VIEWS.join(', ')}`);
	}
	return ok({ showRibbonIcon, defaultView: defaultView as DefaultViewName });
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run tests/domain/settings/plugin-settings.test.ts --config configs/vitest.config.ts
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/domain/settings/plugin-settings.ts" "01 - Projects/Agentonomous/tests/domain/settings/plugin-settings.test.ts"
git commit -m "feat(agentonomous): add PluginSettings type + validator

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.4: `SettingsPort` interface

**Files:**
- Create: `01 - Projects/Agentonomous/src/domain/settings/settings-port.ts`

No runtime behavior to test — pure TypeScript interface. Verified at typecheck and by consumers in later chunks.

- [ ] **Step 1: Create the port**

```ts
// src/domain/settings/settings-port.ts
import type { Result } from '../shared/result.js';
import type { Unsubscribe } from '../shared/unsubscribe.js';
import type { PluginSettings } from './plugin-settings.js';

export interface SettingsPort {
	load(): Promise<Result<PluginSettings, string>>;
	save(settings: PluginSettings): Promise<Result<void, string>>;
	subscribe(listener: (settings: PluginSettings) => void): Unsubscribe;
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/domain/settings/settings-port.ts"
git commit -m "feat(agentonomous): add SettingsPort interface

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.5: Verify Chunk 3 is fully green

- [ ] **Step 1: Run full `npm test`**

Run from `01 - Projects/Agentonomous/`:
```bash
npm test
```

Expected: lint green, typecheck green, all domain tests pass, placeholder passes. Exit code `0`.

- [ ] **Step 2: (no .gitkeep cleanup needed — see Task 1.1 Step 2)**

---

## Chunk 4: Infrastructure layer (TDD)

**Goal:** Ship the Obsidian-touching infrastructure: settings adapter implementing `SettingsPort`, view registry, homepage view, settings tab, ribbon helper. Every file is on the `obsidian` allowlist (§2.2 rule 3). Tests mock `obsidian`'s `Plugin` surface.

### Task 4.1: Test fixtures — fake Obsidian `Plugin`

**Files:**
- Create: `01 - Projects/Agentonomous/tests/infrastructure/obsidian/fake-plugin.ts`

Obsidian's `Plugin` class has many methods. For tests we only need `loadData`, `saveData`, `registerView`, `addRibbonIcon`, `addCommand`, `addSettingTab`, `app.workspace`. A lightweight fake keeps domain logic testable without jsdom inheriting Electron quirks.

- [ ] **Step 1: Create the fake plugin factory**

```ts
// tests/infrastructure/obsidian/fake-plugin.ts
import { vi } from 'vitest';

export type FakeLeaf = {
	view: unknown;
	detach: () => void;
	setViewState: ReturnType<typeof vi.fn>;
};

export type FakeWorkspace = {
	getLeavesOfType: ReturnType<typeof vi.fn>;
	getLeaf: ReturnType<typeof vi.fn>;
	getLeftLeaf: ReturnType<typeof vi.fn>;
	getRightLeaf: ReturnType<typeof vi.fn>;
	revealLeaf: ReturnType<typeof vi.fn>;
	detachLeavesOfType: ReturnType<typeof vi.fn>;
};

export type FakePlugin = {
	data: unknown;
	app: { workspace: FakeWorkspace };
	loadData: ReturnType<typeof vi.fn>;
	saveData: ReturnType<typeof vi.fn>;
	registerView: ReturnType<typeof vi.fn>;
	addRibbonIcon: ReturnType<typeof vi.fn>;
	addCommand: ReturnType<typeof vi.fn>;
	addSettingTab: ReturnType<typeof vi.fn>;
};

export function createFakePlugin(initialData: unknown = null): FakePlugin {
	const state = { data: initialData };
	const makeLeaf = () => ({ setViewState: vi.fn(async () => undefined), detach: vi.fn() });
	const workspace: FakeWorkspace = {
		getLeavesOfType: vi.fn(() => []),
		getLeaf: vi.fn(makeLeaf),
		getLeftLeaf: vi.fn(makeLeaf),
		getRightLeaf: vi.fn(makeLeaf),
		revealLeaf: vi.fn(),
		detachLeavesOfType: vi.fn(),
	};
	return {
		get data() { return state.data; },
		set data(v) { state.data = v; },
		app: { workspace },
		loadData: vi.fn(async () => state.data),
		saveData: vi.fn(async (d: unknown) => { state.data = d; }),
		registerView: vi.fn(),
		addRibbonIcon: vi.fn(() => ({ remove: vi.fn() })),
		addCommand: vi.fn(),
		addSettingTab: vi.fn(),
	};
}
```

- [ ] **Step 2: Commit (fixture only)**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/tests/infrastructure/obsidian/fake-plugin.ts"
git commit -m "test(agentonomous): add fake Obsidian Plugin fixture

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 4.2: `ObsidianSettingsAdapter`

**Files:**
- Create: `01 - Projects/Agentonomous/tests/infrastructure/obsidian/obsidian-settings-adapter.test.ts`
- Create: `01 - Projects/Agentonomous/src/infrastructure/obsidian/obsidian-settings-adapter.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/infrastructure/obsidian/obsidian-settings-adapter.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianSettingsAdapter } from '../../../src/infrastructure/obsidian/obsidian-settings-adapter.js';
import { DEFAULT_SETTINGS } from '../../../src/domain/settings/plugin-settings.js';
import { isOk } from '../../../src/domain/shared/result.js';
import { createFakePlugin } from './fake-plugin.js';

describe('ObsidianSettingsAdapter', () => {
	it('load() returns DEFAULT_SETTINGS when plugin data is null', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toEqual(DEFAULT_SETTINGS);
	});

	it('load() returns stored settings when valid', async () => {
		const plugin = createFakePlugin({ showRibbonIcon: false, defaultView: 'home' });
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value.showRibbonIcon).toBe(false);
	});

	it('load() returns DEFAULT_SETTINGS when stored data is invalid', async () => {
		const plugin = createFakePlugin({ showRibbonIcon: 'yes' });
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toEqual(DEFAULT_SETTINGS);
	});

	it('save() persists settings and notifies subscribers', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const listener = vi.fn();
		adapter.subscribe(listener);
		const next = { showRibbonIcon: false, defaultView: 'home' as const };
		await adapter.save(next);
		expect(plugin.saveData).toHaveBeenCalledWith(next);
		expect(listener).toHaveBeenCalledWith(next);
	});

	it('subscribe() returns an unsubscribe that stops further notifications', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const listener = vi.fn();
		const unsub = adapter.subscribe(listener);
		unsub();
		await adapter.save({ showRibbonIcon: false, defaultView: 'home' });
		expect(listener).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run tests/infrastructure/obsidian/obsidian-settings-adapter.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — adapter module does not exist.

- [ ] **Step 3: Implement the adapter**

```ts
// src/infrastructure/obsidian/obsidian-settings-adapter.ts
import type { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, validateSettings, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export class ObsidianSettingsAdapter implements SettingsPort {
	private readonly plugin: Plugin;
	private readonly listeners = new Set<(s: PluginSettings) => void>();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<Result<PluginSettings, string>> {
		try {
			const raw: unknown = await this.plugin.loadData();
			if (raw === null || raw === undefined) return ok(DEFAULT_SETTINGS);
			const validated = validateSettings(raw);
			if (validated.kind === 'err') return ok(DEFAULT_SETTINGS);
			return validated;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return err(`failed to load settings: ${msg}`);
		}
	}

	async save(settings: PluginSettings): Promise<Result<void, string>> {
		try {
			await this.plugin.saveData(settings);
			for (const l of this.listeners) l(settings);
			return ok(undefined);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return err(`failed to save settings: ${msg}`);
		}
	}

	subscribe(listener: (s: PluginSettings) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
```

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run tests/infrastructure/obsidian/obsidian-settings-adapter.test.ts --config configs/vitest.config.ts
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/infrastructure/obsidian/obsidian-settings-adapter.ts" "01 - Projects/Agentonomous/tests/infrastructure/obsidian/obsidian-settings-adapter.test.ts"
git commit -m "feat(agentonomous): add ObsidianSettingsAdapter implementing SettingsPort

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 4.3: `ViewRegistry`

**Files:**
- Create: `01 - Projects/Agentonomous/tests/infrastructure/obsidian/view-registry.test.ts`
- Create: `01 - Projects/Agentonomous/src/infrastructure/obsidian/view-registry.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/infrastructure/obsidian/view-registry.test.ts
import { describe, expect, it } from 'vitest';
import type { Plugin } from 'obsidian';
import { ViewRegistry } from '../../../src/infrastructure/obsidian/view-registry.js';
import { createFakePlugin } from './fake-plugin.js';

describe('ViewRegistry', () => {
	it('registerAll() registers every view type with the plugin', () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([
			{ type: 'test-view', displayName: 'Test', icon: 'bot', defaultLocation: 'main', viewFactory: () => ({ }) as never },
		]);
		registry.registerAll(plugin as unknown as Plugin, { ctx: true } as never);
		expect(plugin.registerView).toHaveBeenCalledWith('test-view', expect.any(Function));
	});

	it('openView() reveals an existing leaf if one exists', async () => {
		const plugin = createFakePlugin();
		const existing = { setViewState: () => Promise.resolve(), detach: () => {} };
		plugin.app.workspace.getLeavesOfType = (() => [existing]) as never;
		const registry = new ViewRegistry([
			{ type: 'test-view', displayName: 'Test', icon: 'bot', defaultLocation: 'main', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'test-view');
		expect(plugin.app.workspace.revealLeaf).toHaveBeenCalledWith(existing);
	});

	it('openView() creates a new leaf when none exists', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([
			{ type: 'test-view', displayName: 'Test', icon: 'bot', defaultLocation: 'main', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'test-view');
		expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
	});

	it('openView() throws for unknown type', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([]);
		await expect(registry.openView(plugin as unknown as Plugin, 'nope')).rejects.toThrow(/unknown/i);
	});
});
```

- [ ] **Step 2: Run test — verify fails**

```bash
npx vitest run tests/infrastructure/obsidian/view-registry.test.ts --config configs/vitest.config.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `view-registry.ts`**

```ts
// src/infrastructure/obsidian/view-registry.ts
import type { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../plugin.js';

export type ViewLocation = 'main' | 'left' | 'right';

export type ViewRegistration = {
	readonly type: string;
	readonly displayName: string;
	readonly icon: string;
	readonly defaultLocation: ViewLocation;
	readonly viewFactory: (leaf: WorkspaceLeaf, ctx: PluginContext) => ItemView;
};

export class ViewRegistry {
	private readonly entries: readonly ViewRegistration[];

	constructor(entries: readonly ViewRegistration[]) {
		this.entries = entries;
	}

	registerAll(plugin: Plugin, ctx: PluginContext): void {
		for (const entry of this.entries) {
			plugin.registerView(entry.type, (leaf) => entry.viewFactory(leaf, ctx));
		}
	}

	async openView(plugin: Plugin, type: string): Promise<void> {
		const entry = this.entries.find((e) => e.type === type);
		if (!entry) throw new Error(`ViewRegistry: unknown view type "${type}"`);

		const existing = plugin.app.workspace.getLeavesOfType(type);
		if (existing.length > 0 && existing[0]) {
			plugin.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.getLeafForLocation(plugin, entry.defaultLocation);
		await leaf.setViewState({ type, active: true });
		plugin.app.workspace.revealLeaf(leaf);
	}

	private getLeafForLocation(plugin: Plugin, location: ViewLocation): WorkspaceLeaf {
		switch (location) {
			case 'left': return plugin.app.workspace.getLeftLeaf(false) ?? plugin.app.workspace.getLeaf(true);
			case 'right': return plugin.app.workspace.getRightLeaf(false) ?? plugin.app.workspace.getLeaf(true);
			case 'main':
			default: return plugin.app.workspace.getLeaf(true);
		}
	}
}
```

Note: `PluginContext` is imported from `../../plugin.js` which will be written in Chunk 6. TypeScript will complain until Chunk 6 — address this by creating a stub `src/plugin.ts` now (see Step 3b).

- [ ] **Step 3b: Create a minimal `src/plugin.ts` stub so `PluginContext` resolves**

```ts
// src/plugin.ts
import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
};
```

This is a partial stub — Chunk 6 expands it with `createPluginContext()` and the view registry reference.

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run tests/infrastructure/obsidian/view-registry.test.ts --config configs/vitest.config.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/infrastructure/obsidian/view-registry.ts" "01 - Projects/Agentonomous/src/plugin.ts" "01 - Projects/Agentonomous/tests/infrastructure/obsidian/view-registry.test.ts"
git commit -m "feat(agentonomous): add ViewRegistry + initial PluginContext stub

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 4.4: `HomepageView`

**Files:**
- Create: `01 - Projects/Agentonomous/src/infrastructure/views/homepage-view.ts`

No unit test in this chunk — `HomepageView` mounts a Vue app that does not exist yet. Full integration is covered in Chunk 6's smoke test.

- [ ] **Step 1: Create the view with a stubbed mount**

```ts
// src/infrastructure/views/homepage-view.ts
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../plugin.js';

export const VIEW_TYPE_HOMEPAGE = 'agentonomous-homepage';

type MountedApp = { unmount: () => void };

export class HomepageView extends ItemView {
	private mounted: MountedApp | null = null;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_HOMEPAGE; }
	getDisplayText(): string { return 'Agentonomous homepage'; }
	getIcon(): string { return 'bot'; }

	async onOpen(): Promise<void> {
		try {
			const { createVueApp } = await import('../../ui/app.js');
			this.mounted = createVueApp(this.ctx, this.contentEl);
		} catch (error) {
			this.contentEl.empty();
			this.contentEl.createEl('div', { text: `Agentonomous failed to load: ${error instanceof Error ? error.message : String(error)}` });
		}
	}

	async onClose(): Promise<void> {
		this.mounted?.unmount();
		this.mounted = null;
	}
}
```

The dynamic `import('../../ui/app.js')` keeps the UI layer from being coupled at module parse time — Chunk 5 fills in `createVueApp()`. Until then, `onOpen()` shows a friendly failure; tests in Chunk 6 verify full behavior.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: `0 errors`. (If TS complains about `../../ui/app.js` not resolving, add a TODO stub at `src/ui/app.ts`: `export function createVueApp(_ctx: unknown, _el: HTMLElement) { throw new Error('not implemented'); return { unmount: () => {} }; }` — but this is Chunk 5's job; see Step 3.)

- [ ] **Step 3: If typecheck fails, add a minimal UI stub**

Create: `01 - Projects/Agentonomous/src/ui/app.ts`

```ts
// src/ui/app.ts — stub, replaced in Chunk 5
import type { PluginContext } from '../plugin.js';

export type MountedApp = { unmount: () => void };

export function createVueApp(_ctx: PluginContext, _el: HTMLElement): MountedApp {
	throw new Error('createVueApp not yet implemented (Chunk 5)');
}
```

Re-run typecheck — expected `0 errors`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/infrastructure/views/homepage-view.ts" "01 - Projects/Agentonomous/src/ui/app.ts"
git commit -m "feat(agentonomous): add HomepageView with stub Vue mount

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 4.5: `SettingsTab`

**Files:**
- Create: `01 - Projects/Agentonomous/src/infrastructure/settings/settings-tab.ts`

- [ ] **Step 1: Create the settings tab**

```ts
// src/infrastructure/settings/settings-tab.ts
import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import { isOk } from '../../domain/shared/result.js';

export class AgentonomousSettingsTab extends PluginSettingTab {
	private readonly port: SettingsPort;
	private current: PluginSettings = DEFAULT_SETTINGS;

	constructor(app: App, plugin: Plugin, port: SettingsPort) {
		super(app, plugin);
		this.port = port;
	}

	async display(): Promise<void> {
		const loaded = await this.port.load();
		if (isOk(loaded)) this.current = loaded.value;

		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Show ribbon icon')
			.setDesc('Show the Agentonomous icon in the left ribbon.')
			.addToggle((toggle) => {
				toggle
					.setValue(this.current.showRibbonIcon)
					.onChange(async (value) => {
						this.current = { ...this.current, showRibbonIcon: value };
						await this.port.save(this.current);
					});
			});

		new Setting(containerEl)
			.setName('Default view')
			.setDesc('Which view opens when the plugin launches.')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('home', 'Home')
					.setValue(this.current.defaultView)
					.onChange(async (value) => {
						if (value === 'home') {
							this.current = { ...this.current, defaultView: 'home' };
							await this.port.save(this.current);
						}
					});
			});
	}
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: `0 errors`.

- [ ] **Step 3: Run lint**

```bash
npx eslint src/ --config configs/eslint.config.mjs
```

Expected: `0 errors`. (Warnings like `no-console` may appear — confirm none are errors.)

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/infrastructure/settings/settings-tab.ts"
git commit -m "feat(agentonomous): add AgentonomousSettingsTab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 4.6: Ribbon helper

**Files:**
- Create: `01 - Projects/Agentonomous/src/infrastructure/ribbon/ribbon.ts`

- [ ] **Step 1: Create the ribbon helper**

```ts
// src/infrastructure/ribbon/ribbon.ts
import type { Plugin } from 'obsidian';

export type RibbonHandle = { remove: () => void } | null;

export function registerRibbon(
	plugin: Plugin,
	opts: { visible: boolean; icon: string; title: string; onClick: () => void | Promise<void> },
): RibbonHandle {
	if (!opts.visible) return null;
	const el = plugin.addRibbonIcon(opts.icon, opts.title, () => {
		void opts.onClick();
	});
	return { remove: () => el.remove() };
}
```

- [ ] **Step 2: Run lint + typecheck**

```bash
npx eslint src/ --config configs/eslint.config.mjs
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: `0 errors` for each.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/infrastructure/ribbon/ribbon.ts"
git commit -m "feat(agentonomous): add ribbon registration helper

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 4.7: Verify Chunk 4 is green

- [ ] **Step 1: Run lint explicitly so `eslint-plugin-obsidianmd` violations surface now**

```bash
npx eslint src/ --config configs/eslint.config.mjs
```

Expected: `0 errors`. Warnings about sentence-case for UI strings are acceptable if they concern placeholder strings scheduled for Chunk 6 polish.

- [ ] **Step 2: Run full `npm test`**

```bash
npm test
```

Expected: exit code `0`. All infrastructure + domain tests pass.

---

## Chunk 5: UI layer (TDD)

**Goal:** Ship the Vue 3 presentation layer — `createVueApp()` factory, Pinia stores bound via `provide/inject` to the domain `SettingsPort`, memory-history router, two pages, one component. No business logic in SFCs.

### Task 5.1: `PluginContext` injection key

**Files:**
- Create: `01 - Projects/Agentonomous/src/ui/plugin-context-key.ts`

- [ ] **Step 1: Create the injection key symbol**

```ts
// src/ui/plugin-context-key.ts
import type { InjectionKey } from 'vue';
import type { PluginContext } from '../plugin.js';

export const PluginContextKey: InjectionKey<PluginContext> = Symbol('AgentonomousPluginContext');
```

### Task 5.2: `useAppStore`

**Files:**
- Create: `01 - Projects/Agentonomous/tests/ui/stores/app-store.test.ts`
- Create: `01 - Projects/Agentonomous/src/ui/stores/app-store.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/stores/app-store.test.ts
import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../../../src/ui/stores/app-store.js';

describe('useAppStore', () => {
	it('exposes default greeting and version', () => {
		setActivePinia(createPinia());
		const store = useAppStore();
		expect(store.greeting).toBe('Hello from Agentonomous');
		expect(store.pluginVersion).toBe('0.0.0');
	});

	it('setVersion() updates pluginVersion', () => {
		setActivePinia(createPinia());
		const store = useAppStore();
		store.setVersion('1.2.3');
		expect(store.pluginVersion).toBe('1.2.3');
	});
});
```

- [ ] **Step 2: Run test — verify fails**

```bash
npx vitest run tests/ui/stores/app-store.test.ts --config configs/vitest.config.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the store**

```ts
// src/ui/stores/app-store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
	const greeting = ref<string>('Hello from Agentonomous');
	const pluginVersion = ref<string>('0.0.0');

	function setVersion(next: string): void {
		pluginVersion.value = next;
	}

	return { greeting, pluginVersion, setVersion };
});
```

- [ ] **Step 4: Run — verify passes**

```bash
npx vitest run tests/ui/stores/app-store.test.ts --config configs/vitest.config.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/ui/plugin-context-key.ts" "01 - Projects/Agentonomous/src/ui/stores/app-store.ts" "01 - Projects/Agentonomous/tests/ui/stores/app-store.test.ts"
git commit -m "feat(agentonomous): add useAppStore (version + greeting) and injection key

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.3: `useSettingsStore` (depends on `SettingsPort` via inject)

**Files:**
- Create: `01 - Projects/Agentonomous/tests/ui/stores/settings-store.test.ts`
- Create: `01 - Projects/Agentonomous/src/ui/stores/settings-store.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/stores/settings-store.test.ts
import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '../../../src/ui/stores/settings-store.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../../src/domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../../src/domain/settings/settings-port.js';
import { ok } from '../../../src/domain/shared/result.js';

function makeFakePort(initial: PluginSettings = DEFAULT_SETTINGS): SettingsPort {
	let current = initial;
	const listeners = new Set<(s: PluginSettings) => void>();
	return {
		load: async () => ok(current),
		save: async (s) => { current = s; for (const l of listeners) l(s); return ok(undefined); },
		subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
	};
}

describe('useSettingsStore', () => {
	it('hydrate() loads settings from the port', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort({ showRibbonIcon: false, defaultView: 'home' });
		const store = useSettingsStore();
		await store.hydrate(port);
		expect(store.settings.showRibbonIcon).toBe(false);
	});

	it('update() writes settings through the port and reflects the change', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort();
		const store = useSettingsStore();
		await store.hydrate(port);
		await store.update({ showRibbonIcon: false, defaultView: 'home' });
		expect(store.settings.showRibbonIcon).toBe(false);
	});

	it('subscribes to port changes and updates state reactively', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort();
		const store = useSettingsStore();
		await store.hydrate(port);
		await port.save({ showRibbonIcon: false, defaultView: 'home' });
		expect(store.settings.showRibbonIcon).toBe(false);
	});
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run tests/ui/stores/settings-store.test.ts --config configs/vitest.config.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the store**

```ts
// src/ui/stores/settings-store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { isOk } from '../../domain/shared/result.js';

export const useSettingsStore = defineStore('settings', () => {
	const settings = ref<PluginSettings>(DEFAULT_SETTINGS);
	let port: SettingsPort | null = null;
	let unsub: Unsubscribe | null = null;

	async function hydrate(newPort: SettingsPort): Promise<void> {
		port = newPort;
		unsub?.();
		unsub = port.subscribe((s) => { settings.value = s; });
		const loaded = await port.load();
		if (isOk(loaded)) settings.value = loaded.value;
	}

	async function update(next: PluginSettings): Promise<void> {
		if (!port) throw new Error('settings store not hydrated');
		const r = await port.save(next);
		if (isOk(r)) settings.value = next;
	}

	function dispose(): void {
		unsub?.();
		unsub = null;
		port = null;
	}

	return { settings, hydrate, update, dispose };
});
```

- [ ] **Step 4: Run — verify passes**

```bash
npx vitest run tests/ui/stores/settings-store.test.ts --config configs/vitest.config.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/ui/stores/settings-store.ts" "01 - Projects/Agentonomous/tests/ui/stores/settings-store.test.ts"
git commit -m "feat(agentonomous): add useSettingsStore depending on domain SettingsPort

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.4: `HelloCard` component

**Files:**
- Create: `01 - Projects/Agentonomous/tests/ui/components/HelloCard.test.ts`
- Create: `01 - Projects/Agentonomous/src/ui/components/HelloCard.vue`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/components/HelloCard.test.ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HelloCard from '../../../src/ui/components/HelloCard.vue';

describe('HelloCard', () => {
	it('renders title and message props', () => {
		const wrapper = mount(HelloCard, {
			props: { title: 'Hi', message: 'Welcome' },
		});
		expect(wrapper.text()).toContain('Hi');
		expect(wrapper.text()).toContain('Welcome');
	});

	it('applies the hello-card class', () => {
		const wrapper = mount(HelloCard, { props: { title: 'x', message: 'y' } });
		expect(wrapper.classes()).toContain('hello-card');
	});
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run tests/ui/components/HelloCard.test.ts --config configs/vitest.config.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

```vue
<!-- src/ui/components/HelloCard.vue -->
<script setup lang="ts">
interface Props {
	title: string;
	message: string;
}
defineProps<Props>();
</script>

<template>
	<section class="hello-card">
		<h2 class="hello-card__title">{{ title }}</h2>
		<p class="hello-card__message">{{ message }}</p>
	</section>
</template>
```

- [ ] **Step 4: Run — verify passes**

```bash
npx vitest run tests/ui/components/HelloCard.test.ts --config configs/vitest.config.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/ui/components/HelloCard.vue" "01 - Projects/Agentonomous/tests/ui/components/HelloCard.test.ts"
git commit -m "feat(agentonomous): add HelloCard presentational component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.5: Router + pages

**Files:**
- Create: `01 - Projects/Agentonomous/src/ui/router/index.ts`
- Create: `01 - Projects/Agentonomous/src/ui/pages/Home.vue`
- Create: `01 - Projects/Agentonomous/src/ui/pages/About.vue`
- Create: `01 - Projects/Agentonomous/tests/ui/pages/Home.test.ts`

- [ ] **Step 1: Create the router**

```ts
// src/ui/router/index.ts
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Home from '../pages/Home.vue';
import About from '../pages/About.vue';

export function createAppRouter(): Router {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'home', component: Home },
			{ path: '/about', name: 'about', component: About },
		],
	});
}
```

- [ ] **Step 2: Create `Home.vue`**

```vue
<!-- src/ui/pages/Home.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import HelloCard from '../components/HelloCard.vue';
import { useAppStore } from '../stores/app-store.js';

const appStore = useAppStore();
const { greeting, pluginVersion } = storeToRefs(appStore);
</script>

<template>
	<div class="agentonomous-home">
		<HelloCard :title="greeting" :message="`Version ${pluginVersion}`" />
		<nav class="agentonomous-nav">
			<router-link to="/about">About</router-link>
		</nav>
	</div>
</template>
```

- [ ] **Step 3: Create `About.vue`**

```vue
<!-- src/ui/pages/About.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';

const appStore = useAppStore();
const { pluginVersion } = storeToRefs(appStore);
</script>

<template>
	<div class="agentonomous-about">
		<h2>Agentonomous</h2>
		<p>Autonomous agents sandbox — version {{ pluginVersion }} for Obsidian 1.12.7+.</p>
		<nav class="agentonomous-nav">
			<router-link to="/">Home</router-link>
		</nav>
	</div>
</template>
```

- [ ] **Step 4: Write the Home page test**

```ts
// tests/ui/pages/Home.test.ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import Home from '../../../src/ui/pages/Home.vue';
import About from '../../../src/ui/pages/About.vue';
import { useAppStore } from '../../../src/ui/stores/app-store.js';

describe('Home page', () => {
	it('renders HelloCard with store greeting and version', async () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		router.push('/');
		await router.isReady();

		const app = useAppStore();
		app.setVersion('9.9.9');

		const wrapper = mount(Home, { global: { plugins: [router] } });
		expect(wrapper.text()).toContain('Hello from Agentonomous');
		expect(wrapper.text()).toContain('9.9.9');
	});

	it('contains a router-link to /about', () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		const wrapper = mount(Home, { global: { plugins: [router] } });
		expect(wrapper.html()).toMatch(/\/about/);
	});
});
```

- [ ] **Step 5: Run Home test — verify passes**

```bash
npx vitest run tests/ui/pages/Home.test.ts --config configs/vitest.config.ts
```

Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/ui/router/" "01 - Projects/Agentonomous/src/ui/pages/" "01 - Projects/Agentonomous/tests/ui/pages/"
git commit -m "feat(agentonomous): add router, Home + About pages, route test

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.6: `createVueApp()` factory (replace stub from Chunk 4)

**Files:**
- Modify: `01 - Projects/Agentonomous/src/ui/app.ts`

- [ ] **Step 1: Replace the stub with the real factory**

```ts
// src/ui/app.ts
import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import { createAppRouter } from './router/index.js';
import { PluginContextKey } from './plugin-context-key.js';
import { useAppStore } from './stores/app-store.js';
import { useSettingsStore } from './stores/settings-store.js';
import AppRoot from './AppRoot.vue';
import type { PluginContext } from '../plugin.js';

export type MountedApp = { unmount: () => void };

export function createVueApp(ctx: PluginContext, el: HTMLElement): MountedApp {
	const vue: VueApp = createApp(AppRoot);
	const pinia = createPinia();
	const router = createAppRouter();

	vue.use(pinia);
	vue.use(router);
	vue.provide(PluginContextKey, ctx);

	const appStore = useAppStore(pinia);
	appStore.setVersion(ctx.plugin.manifest.version);

	const settingsStore = useSettingsStore(pinia);
	void settingsStore.hydrate(ctx.settings);

	vue.mount(el);

	return {
		unmount: () => {
			settingsStore.dispose();
			vue.unmount();
		},
	};
}
```

- [ ] **Step 2: Create `AppRoot.vue`**

Create: `01 - Projects/Agentonomous/src/ui/AppRoot.vue`

```vue
<!-- src/ui/AppRoot.vue -->
<script setup lang="ts">
</script>

<template>
	<router-view />
</template>
```

- [ ] **Step 3: Run typecheck + tests**

```bash
npx tsc --noEmit --project configs/tsconfig.json
npm run test:unit
```

Expected: typecheck clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/ui/app.ts" "01 - Projects/Agentonomous/src/ui/AppRoot.vue"
git commit -m "feat(agentonomous): implement createVueApp factory with Pinia + Router

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.7: Verify Chunk 5 is green

- [ ] **Step 1: Run full `npm test`**

```bash
npm test
```

Expected: exit code `0`. Coverage thresholds may fail — if so, this is addressed in Chunk 6 Task 6.6.

---

## Chunk 6: Composition, styles, stories, smoke

**Goal:** Wire it all together: extend `PluginContext` with the view registry reference, write `src/main.ts`, create `styles/base.css` + `styles/homepage.css`, write `stories/HelloCard.stories.ts` (including a `.test` interaction story), build, deploy to the test vault, and verify end-to-end.

### Task 6.1: Finalize `src/plugin.ts`

**Files:**
- Modify: `01 - Projects/Agentonomous/src/plugin.ts`

- [ ] **Step 1: Expand `PluginContext` and add the factory**

```ts
// src/plugin.ts
import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';
import type { ViewRegistry } from './infrastructure/obsidian/view-registry.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
	readonly viewRegistry: ViewRegistry;
};

export function createPluginContext(plugin: Plugin, settings: SettingsPort, viewRegistry: ViewRegistry): PluginContext {
	return { app: plugin.app, plugin, settings, viewRegistry };
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/plugin.ts"
git commit -m "feat(agentonomous): finalize PluginContext with viewRegistry

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 6.2: Write `src/main.ts`

**Files:**
- Create: `01 - Projects/Agentonomous/src/main.ts`

- [ ] **Step 1: Create the plugin entry**

```ts
// src/main.ts
import { Plugin } from 'obsidian';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView, VIEW_TYPE_HOMEPAGE } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { registerRibbon, type RibbonHandle } from './infrastructure/ribbon/ribbon.js';
import { createPluginContext } from './plugin.js';
import { isOk } from './domain/shared/result.js';
import { DEFAULT_SETTINGS } from './domain/settings/plugin-settings.js';

export default class AgentonomousPlugin extends Plugin {
	private ribbon: RibbonHandle = null;

	async onload(): Promise<void> {
		const settings = new ObsidianSettingsAdapter(this);
		const initial = await settings.load();
		const current = isOk(initial) ? initial.value : DEFAULT_SETTINGS;

		const registry = new ViewRegistry([
			{
				type: VIEW_TYPE_HOMEPAGE,
				displayName: 'Agentonomous homepage',
				icon: 'bot',
				defaultLocation: 'main',
				viewFactory: (leaf, ctx) => new HomepageView(leaf, ctx),
			},
			// Example future sidebar panel:
			// { type: 'agentonomous-inspector', displayName: 'Agent inspector', icon: 'search', defaultLocation: 'right', viewFactory: (leaf, ctx) => new InspectorView(leaf, ctx) },
		]);

		const ctx = createPluginContext(this, settings, registry);
		registry.registerAll(this, ctx);

		this.ribbon = registerRibbon(this, {
			visible: current.showRibbonIcon,
			icon: 'bot',
			title: 'Open Agentonomous',
			onClick: () => registry.openView(this, VIEW_TYPE_HOMEPAGE),
		});

		// Route the settings listener through Obsidian's register() so it is
		// torn down automatically on plugin unload (spec §3.2).
		this.register(settings.subscribe((s) => {
			this.ribbon?.remove();
			this.ribbon = registerRibbon(this, {
				visible: s.showRibbonIcon,
				icon: 'bot',
				title: 'Open Agentonomous',
				onClick: () => registry.openView(this, VIEW_TYPE_HOMEPAGE),
			});
		}));

		this.addCommand({
			id: 'open-homepage',
			name: 'Open homepage',
			callback: () => { void registry.openView(this, VIEW_TYPE_HOMEPAGE); },
		});

		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
	}

	onunload(): void {
		this.ribbon?.remove();
		this.ribbon = null;
	}
}
```

- [ ] **Step 2: Run typecheck + lint**

```bash
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ --config configs/eslint.config.mjs
```

Expected: `0 errors` each.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/src/main.ts"
git commit -m "feat(agentonomous): wire plugin entry with ribbon, command, settings tab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 6.3: Styles

**Files:**
- Create: `01 - Projects/Agentonomous/styles/base.css`
- Create: `01 - Projects/Agentonomous/styles/homepage.css`

- [ ] **Step 1: Create `styles/base.css`**

```css
/* Agentonomous base reset + layout tokens */
.agentonomous-home,
.agentonomous-about {
	padding: 1rem;
	color: var(--text-normal);
}

.agentonomous-nav {
	margin-top: 1rem;
	display: flex;
	gap: 0.75rem;
}
```

- [ ] **Step 2: Create `styles/homepage.css`**

```css
/* Agentonomous HelloCard */
.hello-card {
	border: 1px solid var(--background-modifier-border);
	border-radius: 0.5rem;
	padding: 1rem;
	background: var(--background-secondary);
}

.hello-card__title {
	margin: 0 0 0.5rem 0;
	font-size: 1.25rem;
}

.hello-card__message {
	margin: 0;
	color: var(--text-muted);
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/styles/"
git commit -m "style(agentonomous): add base + homepage CSS

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 6.4: Storybook story for `HelloCard` with `.test` interaction

**Files:**
- Create: `01 - Projects/Agentonomous/stories/HelloCard.stories.ts`

- [ ] **Step 1: Create the story file**

```ts
// stories/HelloCard.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect } from '@storybook/test';
import HelloCard from '../src/ui/components/HelloCard.vue';

const meta: Meta<typeof HelloCard> = {
	title: 'Components/HelloCard',
	component: HelloCard,
	args: { title: 'Hi', message: 'Welcome to Agentonomous.' },
};

export default meta;
type Story = StoryObj<typeof HelloCard>;

export const Default: Story = {};

export const LongMessage: Story = {
	args: {
		title: 'Introduction',
		message: 'Agentonomous is an autonomous agents sandbox that runs entirely inside your Obsidian vault. This is a longer message to validate wrapping behavior.',
	},
};

export const RendersTitleAndMessage: Story = {
	args: { title: 'Interaction test', message: 'Visible to the user.' },
	play: async ({ canvasElement }) => {
		await expect(canvasElement.textContent ?? '').toContain('Interaction test');
		await expect(canvasElement.textContent ?? '').toContain('Visible to the user.');
	},
};
```

Note: The Storybook 10 `.test` syntax is available via the `play` function + `@storybook/test` integration. `@storybook/addon-vitest` picks up any story with a `play` function and runs it as a Vitest test.

- [ ] **Step 2: Run Storybook build to validate the story compiles**

```bash
npm run build-storybook
```

Expected: `storybook-static/` folder produced, no errors.

- [ ] **Step 3: Run unit tests — verify the `play` story executes via `@storybook/addon-vitest`**

```bash
npm run test:unit
```

Expected: all existing tests pass, plus a new test entry for `Components/HelloCard/RendersTitleAndMessage` contributed by the Storybook Vitest plugin.

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/stories/"
git commit -m "feat(agentonomous): add HelloCard Storybook story with interaction test

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 6.5: Build, deploy, and verify in Obsidian (manual)

- [ ] **Step 1: Run full build**

```bash
cd "01 - Projects/Agentonomous"
npm run build
```

Expected:
- `dist/main.js`, `dist/manifest.json`, `dist/styles.css` produced.
- `[deploy]` log lines confirming copy into `C:\Projects\Agentonomous\.obsidian\plugins\agentonomous\`.
- Exit code `0`.

- [ ] **Step 2: Verify idempotency**

```bash
npm run build
```

Expected: same output, no errors, files overwritten in test vault.

- [ ] **Step 3: Manual smoke test in Obsidian**

Open Obsidian against the vault `C:\Projects\Agentonomous`. Enable Community plugins if not enabled. Toggle on **Agentonomous** in *Settings → Community plugins → Installed*. Verify:
- Ribbon icon (bot) appears in left ribbon.
- Clicking it opens a tab titled **Agentonomous homepage** with the `HelloCard` greeting + version `0.0.1`.
- Command palette shows **Agentonomous: Open homepage**; running it focuses the existing leaf.
- Clicking **About** in the homepage navigates to the about page with the plugin summary.
- *Settings → Agentonomous* shows the two controls; toggling `Show ribbon icon` hides/shows the icon immediately.
- Disabling the plugin closes the leaf with no errors in the Obsidian dev console.

Record any failures as issues to fix before marking the task complete. All six sub-checks must pass.

- [ ] **Step 4: Produce a release zip to verify the release script**

```bash
npm run release
```

Expected: `dist/agentonomous-0.0.1.zip` produced, containing exactly `main.js`, `manifest.json`, `styles.css`. Verify with:

```bash
unzip -l dist/agentonomous-0.0.1.zip
```

Expected output shows three files, nothing else.

- [ ] **Step 5: Commit any adjustments discovered during smoke test**

If a fix was needed, commit it with an appropriate scope. If smoke is clean, no commit.

### Task 6.6: Final quality gate

- [ ] **Step 1: Run `npm test` with coverage**

```bash
npx vitest run --config configs/vitest.config.ts --coverage
```

Expected: all tests pass AND coverage thresholds met (`statements ≥ 80`, `lines ≥ 80`, `branches ≥ 70`, `functions ≥ 80`).

If thresholds are not met, add targeted tests for uncovered branches — do not relax thresholds.

- [ ] **Step 2: Run TypeDoc and verify zero errors**

```bash
npm run docs
```

Expected: `docs/api/` generated. Warnings about missing docs are acceptable per spec acceptance criterion 9; errors are not.

- [ ] **Step 3: Run full `npm test`**

```bash
npm test
```

Expected: exit code `0`.

- [ ] **Step 4: Final verification commit**

If any small drift landed (coverage-plugging tests, style adjustments uncovered by smoke), stage them:

```bash
cd "C:/Projects/flowti"
git add "01 - Projects/Agentonomous/"
git status --short "01 - Projects/Agentonomous/"
```

If anything is staged, commit with an appropriate scope, e.g. `test(agentonomous): add coverage for settings-store edge cases` or `chore(agentonomous): final quality gate adjustments`. If nothing is staged, skip.

---

## Done

All six chunks complete. The Agentonomous skeleton is shipped:
- Vue 3 homepage opens via ribbon + command inside an Obsidian `ItemView`.
- Settings tab persists `showRibbonIcon` + `defaultView`.
- Domain, infrastructure, UI layers isolated by ESLint.
- Storybook 10 with a11y + Vitest-driven interaction tests.
- TypeDoc produces API docs for domain + infrastructure.
- `dist/agentonomous-0.0.1.zip` is ready for marketplace submission (submission itself is manual, out of scope).

Spec acceptance criteria 1–18 satisfied.

