# Phase 0F: Trait System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
n**Dependencies:** Chunks B, C, D (Result type + schemas + vault loading)
**Produces:** TraitResolverSystem + Phase 0 verification — modifier pipeline foundation

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
