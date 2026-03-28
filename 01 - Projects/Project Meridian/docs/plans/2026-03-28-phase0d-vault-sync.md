# Phase 0D: VaultSync (Load-Only) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
n**Dependencies:** Chunks A, B, C (schemas + Result type + VaultAdapter interface)
**Produces:** VaultAdapter, frontmatter parser, vault loader, directory loader — vault read pipeline

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

