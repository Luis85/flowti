# Generalized Facility Production Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline-`production`/`leisure`/`type` location schema with a three-kind facility model (production / service / area_effect), a recipe library, and unified worker semantics — producing water, food, tools, and equipment through proper supply chains with hourly service wages and area-effect guards.

**Architecture:** Six phases. (1) Foundation adds schemas, loaders, the shared `findWorker` helper, the pure `applyRecipeCycle` function, and stubbed ServiceSystem + AreaEffectSystem — all without changing runtime behavior. (2) Production migration swaps the FacilitySystem, quest generation, and the perception/projection pipeline onto the new registries while keeping `location.type` in place. (3) Service migration registers ServiceSystem, adds the water item, deletes leisure/rest systems, rewrites BT branches P0.3/P2.5/P5, and finally drops `location.type`. (4) Area effect wires Guard Post pulses into the mood pipeline. (5) Jobs + hiring adds 8 new jobs. (6) Docs + cleanup updates the GDD and arc42.

**Tech Stack:** TypeScript strict, Vitest, Zod v3, mistreevous 4.3.1, Excalibur.js ECS, Obsidian plugin runtime.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-11-generalized-facility-production-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/<path> --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

**Lint:** `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`

**Working directory:** All `cd` commands go to `01 - Projects/Project Meridian`. The git root is `c:\Projects\flowti`; use full paths for `git mv`.

---

## File Structure

New files created by this plan (full paths relative to `01 - Projects/Project Meridian/`):

**Schemas:**
- `src/domain/schemas/recipe-schema.ts` — `RecipeSchema` + `Recipe` type
- `src/domain/schemas/facility-type-schema.ts` — discriminated union over production/service/area_effect

**Pure domain functions:**
- `src/domain/systems/recipe.ts` — `applyRecipeCycle` (cycle math, pure)
- `src/domain/systems/facility-worker.ts` — `findWorker` (extracted from facility-system.ts)

**Loaders:**
- `src/infrastructure/entity/recipe-loader.ts`
- `src/infrastructure/entity/facility-type-loader.ts`

**Systems:**
- `src/infrastructure/systems/service-system.ts`
- `src/infrastructure/systems/area-effect-system.ts`

**BT layer:**
- `src/infrastructure/entity/bt-actions-service.ts` — `UseService`, `SeekService`, `ChooseServiceFacility`

**Data folders:**
- `recipes/` — `farm-wheat.json`, `craft-tools.json`, `smithy-equipment.json`, `draw-water.json`
- `facility-types/` — 11 files (farm, workshop, smithy, well, guard_post, rest_inn, bathhouse, tavern, library, park, market_stall)

**New location + item files:**
- `locations/smithy.json` (new)
- `locations/well.json` (renamed from `water-source.json`)
- `items/water.md`

**Tests:** one `*.test.ts` per new source file (listed per task).

Files **deleted** in Phase 3:
- `src/infrastructure/systems/leisure-system.ts` + its tests
- `src/infrastructure/systems/rest-system.ts` + its tests
- `src/infrastructure/entity/bt-actions-leisure.ts`
- `items/waterskin.md`

Files **heavily modified** (see spec §Incidental call sites table for the full list — every entry there is addressed in the chunks below):
- `src/domain/schemas/location-schema.ts`
- `src/domain/systems/behavior-agent.ts` (PerceivedLocation)
- `src/domain/systems/perception.ts`
- `src/domain/core/component-data.ts`
- `src/domain/systems/world-validation.ts`
- `src/infrastructure/systems/facility-system.ts`
- `src/infrastructure/systems/perception-system.ts`
- `src/infrastructure/systems/quest-generation-system.ts`
- `src/infrastructure/systems/economy-system.ts`
- `src/infrastructure/systems/subsidy-system.ts`
- `src/infrastructure/systems/daily-report-system.ts`
- `src/infrastructure/systems/gossip-system.ts`
- `src/infrastructure/systems/mood-system.ts`
- `src/infrastructure/engine/world-loader.ts`
- `src/infrastructure/engine/game-view.ts`
- `src/infrastructure/engine/debug-overlay.ts`
- `src/infrastructure/entity/behavior-agent-factory.ts`
- `src/infrastructure/entity/bt-conditions-context.ts`
- `src/infrastructure/entity/bt-actions-needs.ts`
- `src/infrastructure/entity/bt-actions-economy.ts`
- `src/infrastructure/entity/bt-conditions-economy.ts`
- `src/infrastructure/entity/bt-working-memory.ts`
- `src/infrastructure/entity/bt-actions.ts` (ContinueCommitment extension)
- `behavior-trees/base.mdsl`
- All 11 existing `locations/*.json` (minus `water-source.json` which is renamed)

---

## Chunk 1: Phase 1 — Foundation (no behavior change)

Pure additions only. Every new system is unregistered. Existing code continues to run unchanged. Green test suite at every task boundary.

### Task 1.1: Create `RecipeSchema` + tests

**Files:**
- Create: `src/domain/schemas/recipe-schema.ts`
- Create: `tests/domain/schemas/recipe-schema.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/schemas/recipe-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RecipeSchema } from '../../../src/domain/schemas/recipe-schema.js';

describe('RecipeSchema', () => {
	it('accepts a minimal raw producer recipe', () => {
		const parsed = RecipeSchema.parse({
			id: 'recipe-farm-wheat',
			name: 'Farm Wheat',
			outputs: [{ item_id: 'food', quantity: 1 }],
			ticks_per_cycle: 15,
		});
		expect(parsed.inputs).toEqual([]);
		expect(parsed.required_skill).toBeNull();
		expect(parsed.min_skill_level).toBe(0);
	});

	it('accepts a recipe with inputs', () => {
		const parsed = RecipeSchema.parse({
			id: 'recipe-smithy-equipment',
			name: 'Forge Equipment',
			inputs: [{ item_id: 'tools', quantity: 1 }],
			outputs: [{ item_id: 'equipment', quantity: 1 }],
			ticks_per_cycle: 40,
		});
		expect(parsed.inputs).toHaveLength(1);
		expect(parsed.outputs[0]!.item_id).toBe('equipment');
	});

	it('rejects recipe id without recipe- prefix', () => {
		expect(() => RecipeSchema.parse({
			id: 'farm-wheat',
			name: 'bad',
			outputs: [{ item_id: 'food', quantity: 1 }],
			ticks_per_cycle: 15,
		})).toThrow();
	});

	it('rejects empty outputs', () => {
		expect(() => RecipeSchema.parse({
			id: 'recipe-empty',
			name: 'empty',
			outputs: [],
			ticks_per_cycle: 10,
		})).toThrow();
	});

	it('rejects ticks_per_cycle < 1', () => {
		expect(() => RecipeSchema.parse({
			id: 'recipe-bad',
			name: 'bad',
			outputs: [{ item_id: 'food', quantity: 1 }],
			ticks_per_cycle: 0,
		})).toThrow();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/schemas/recipe-schema.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot find module `recipe-schema.js`.

- [ ] **Step 3: Implement `RecipeSchema`**

Create `src/domain/schemas/recipe-schema.ts`:

```typescript
import { z } from 'zod';

export const RecipeSchema = z.object({
	id: z.string().regex(/^recipe-[a-z0-9-]+$/),
	name: z.string().min(1),
	inputs: z.array(z.object({
		item_id: z.string(),
		quantity: z.number().int().min(1),
	})).default([]),
	outputs: z.array(z.object({
		item_id: z.string(),
		quantity: z.number().int().min(1),
	})).min(1),
	ticks_per_cycle: z.number().int().min(1),
	required_skill: z.string().nullable().default(null),
	min_skill_level: z.number().int().min(0).default(0),
});

export type Recipe = z.infer<typeof RecipeSchema>;
```

- [ ] **Step 4: Run tests — all pass**

Run: `npx vitest run tests/domain/schemas/recipe-schema.test.ts --config configs/vitest.config.ts`
Expected: 5 passing.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/domain/schemas/recipe-schema.ts --config configs/eslint.config.mjs`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/recipe-schema.ts" "01 - Projects/Project Meridian/tests/domain/schemas/recipe-schema.test.ts"
git commit -m "feat(meridian): add RecipeSchema"
```

---

### Task 1.2: Create `FacilityTypeSchema` + tests

**Files:**
- Create: `src/domain/schemas/facility-type-schema.ts`
- Create: `tests/domain/schemas/facility-type-schema.test.ts`

- [ ] **Step 1: Write failing tests** covering all three kinds (production / service / area_effect), common field defaults, discriminated-union rejection of unknown kinds. Use the schema definitions at spec §Data Model → Facility type schema (lines 209-257) as the reference shape.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** exactly the schema from the spec:

```typescript
import { z } from 'zod';

const CommonFields = z.object({
	id: z.string().regex(/^[a-z_]+$/),
	primary_job: z.string(),
	default_wage: z.number().min(0).default(3),
	default_fund: z.number().min(0).default(200),
	funding: z.enum(['facility', 'treasury']).default('facility'),
	capacity: z.literal(1).default(1),
});

const ProductionKindSchema = CommonFields.extend({
	kind: z.literal('production'),
	allowed_recipes: z.array(z.string()).min(1),
});

const ServiceEffectsSchema = z.object({
	mood: z.number().default(0),
	energy: z.number().default(0),
	social: z.number().default(0),
	skill_xp: z.number().default(0),
});

const ServiceKindSchema = CommonFields.extend({
	kind: z.literal('service'),
	staffed_effects: ServiceEffectsSchema,
	unstaffed_effects: ServiceEffectsSchema,
	cost_per_visit: z.number().min(0).default(0),
	ticks_per_visit: z.number().int().min(1).default(20),
	restock_threshold_per_item: z.record(z.string(), z.number().int().min(0)).default({}),
});

const AreaEffectKindSchema = CommonFields.extend({
	kind: z.literal('area_effect'),
	modifier: z.object({
		kind: z.enum(['mood']),
		delta_per_tick: z.number(),
	}),
	radius: z.number().int().min(1),
	ticks_per_pulse: z.number().int().min(1).default(30),
});

export const FacilityTypeSchema = z.discriminatedUnion('kind', [
	ProductionKindSchema,
	ServiceKindSchema,
	AreaEffectKindSchema,
]);

export type FacilityType = z.infer<typeof FacilityTypeSchema>;
```

Note: `restock_threshold_per_item` is added now (service kind only) — the quest generation system in Chunk 3 needs it for Market Stall restock gating (spec §Quest generation updates).

- [ ] **Step 4: Run tests — all pass**

- [ ] **Step 5: Typecheck + lint**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add FacilityTypeSchema with three kinds"
```

---

### Task 1.3: Extract `findWorker` into `facility-worker.ts`

**Files:**
- Create: `src/domain/systems/facility-worker.ts`
- Create: `tests/domain/systems/facility-worker.test.ts`
- Modify: `src/infrastructure/systems/facility-system.ts` (lines ~48-66 — import from new location)

- [ ] **Step 1: Read current `findWorker` in facility-system.ts**

Run: `npx grep -n "findWorker" "01 - Projects/Project Meridian/src/infrastructure/systems/facility-system.ts"` (or use the Grep tool)
Copy the function body + its type signatures exactly.

- [ ] **Step 2: Write failing tests for the extracted function**

Cover (from spec §Test Strategy — facility-worker.test.ts):
- Worker present, correct job, within radius → returns agent
- Worker present, wrong job → returns null
- Worker present, wrong `btAction` (not `'work'`) → returns null
- Worker present, out of radius → returns null
- Multiple candidates, `workerId` matches one → returns that one

Use simple stub agent objects matching the real `AgentActor` shape; no ECS needed for a pure function test.

- [ ] **Step 3: Run — FAIL (module not found)**

- [ ] **Step 4: Implement `facility-worker.ts`**

Copy the existing `findWorker` from `facility-system.ts` verbatim into a new file `src/domain/systems/facility-worker.ts`. Export it. Keep the signature identical so callers need only an import change.

- [ ] **Step 5: Update `facility-system.ts` to import the extracted version**

Replace the inline function with `import { findWorker } from '../../domain/systems/facility-worker.js';`. Delete the old inline definition.

- [ ] **Step 6: Run ALL tests — nothing regresses**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: existing facility-system tests still pass + 5 new tests pass.

- [ ] **Step 7: Typecheck + lint**

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor(meridian): extract findWorker to facility-worker domain helper"
```

---

### Task 1.4: Implement `applyRecipeCycle` pure function

**Files:**
- Create: `src/domain/systems/recipe.ts`
- Create: `tests/domain/systems/recipe.test.ts`

The function handles one tick of a recipe execution: takes current stock, workProgress, recipe, wage, fund, funding kind, treasury; returns `{ newStock, newWorkProgress, cycleComplete, workerGoldChange, taxCollected, newFund, newTreasury }`.

- [ ] **Step 1: Write failing tests** (from spec §Test Strategy — recipe.test.ts):
- Cycle with no inputs (raw producer) — workProgress increments, no stock consumption, eventually produces on cycle boundary
- Cycle with matching inputs — inputs consumed exactly once on cycle complete, output added
- Cycle with missing inputs — no progress, no fund drain, no cycle complete
- Tax calculation — wage reduced by `taxRate`, tax routed to treasury accumulator
- Funding 'facility' drains fund; funding 'treasury' drains treasury

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** the function signature:

```typescript
import type { Recipe } from '../schemas/recipe-schema.js';

export interface RecipeCycleInput {
	facilityStock: ReadonlyArray<{ item_id: string; quantity: number; charges?: number }>;
	workProgress: number;
	ticksPerCycle: number;   // may differ from recipe.ticks_per_cycle due to aptitude scaling
	recipe: Recipe;
	wage: number;
	facilityFund: number;
	funding: 'facility' | 'treasury';
	treasuryFund: number;
	taxRate: number;
}

export interface RecipeCycleResult {
	newStock: Array<{ item_id: string; quantity: number; charges?: number }>;
	newWorkProgress: number;
	cycleComplete: boolean;
	workerGoldChange: number;
	taxCollected: number;
	newFund: number;
	newTreasury: number;
}

export function applyRecipeCycle(input: RecipeCycleInput): RecipeCycleResult {
	// 1. check inputs available — if not, return { cycleComplete: false, workProgress unchanged, no fund drain }
	// 2. increment workProgress
	// 3. if workProgress < ticksPerCycle: return no-cycle result
	// 4. on cycle: consume inputs, add outputs, compute wage after tax, drain fund or treasury, reset progress to 0
}
```

The actual body should mirror the existing `facility-system.ts` production cycle math so Phase 2's swap is behavior-preserving. Read the current inline cycle loop before writing.

- [ ] **Step 4: Run — tests pass**

- [ ] **Step 5: Typecheck + lint**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add applyRecipeCycle pure function"
```

---

### Task 1.5: Recipe loader + tests

**Files:**
- Create: `src/infrastructure/entity/recipe-loader.ts`
- Create: `tests/infrastructure/entity/recipe-loader.test.ts`

The loader reads `.json` files from a configurable folder, parses each via `RecipeSchema`, returns a `Map<string, Recipe>` keyed by id. Throws on any parse failure with the file path in the message.

- [ ] **Step 1: Write failing tests** covering: valid file loads, schema failure rethrows with file path context, duplicate id throws, empty folder returns empty map.

Use a `memfs`-style in-memory `readDirectory`/`readFile` stub — the Meridian codebase already uses this pattern (look at existing loaders like `location-loader.ts` for precedent).

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement the loader**

Follow the pattern of the existing location loader. Signature:

```typescript
import { RecipeSchema, type Recipe } from '../../domain/schemas/recipe-schema.js';

export interface RecipeLoaderDeps {
	readDirectory: (path: string) => string[];
	readFile: (path: string) => string;
}

export function loadRecipes(folder: string, deps: RecipeLoaderDeps): Map<string, Recipe> {
	const out = new Map<string, Recipe>();
	const files = deps.readDirectory(folder).filter(f => f.endsWith('.json'));
	for (const file of files) {
		const path = `${folder}/${file}`;
		let parsed;
		try {
			parsed = RecipeSchema.parse(JSON.parse(deps.readFile(path)));
		} catch (err) {
			throw new Error(`Failed to parse recipe file ${path}: ${(err as Error).message}`);
		}
		if (out.has(parsed.id)) {
			throw new Error(`Duplicate recipe id ${parsed.id} at ${path}`);
		}
		out.set(parsed.id, parsed);
	}
	return out;
}
```

- [ ] **Step 4: Tests pass + lint**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meridian): add recipe loader"
```

---

### Task 1.6: Facility type loader + tests

**Files:**
- Create: `src/infrastructure/entity/facility-type-loader.ts`
- Create: `tests/infrastructure/entity/facility-type-loader.test.ts`

Identical structure to the recipe loader but with `FacilityTypeSchema`.

Add a cross-reference validation helper: `validateFacilityTypes(types: Map<string, FacilityType>, recipes: Map<string, Recipe>)` that checks every `allowed_recipes` entry on production kinds exists in the recipe map. Throws with a clear error on missing refs.

- [ ] **Step 1: Write failing tests** including the cross-reference check

- [ ] **Step 2-5:** Follow the same TDD cycle as Task 1.5

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add facility type loader with recipe cross-ref validation"
```

---

### Task 1.7: Stub `ServiceSystem` (unregistered) + tests

**Files:**
- Create: `src/infrastructure/systems/service-system.ts`
- Create: `tests/infrastructure/systems/service-system.test.ts`

The full implementation follows the pseudocode in spec §Facility Lifecycle → Service, including the **orphan guard** block (spec lines ~407-434) and the commit-break cleanup hook.

- [ ] **Step 1: Write failing tests** (from spec §New system tests):
- Staffed visit completes → effects applied
- Unstaffed visit → degraded effects, no cost collected, no wage paid
- Worker earns hourly wage while `btAction === 'work'`
- Worker earns nothing during `seek_work` (travel)
- Fund depletion → subsequent ticks pay no wage
- Multiple simultaneous customers all tick down independently
- **Orphan guard:** agent with `currentServiceVisit` but `btAction !== 'use_service'` → visit cleared, no effects applied
- **Orphan guard:** agent with `memory.atLocation !== facility.id` → visit cleared
- Cost-per-visit of 0 skips wallet debit (for Park and Market)

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `service-system.ts`** following the pseudocode exactly. Use the `System` base class from `@excaliburjs/core` (see existing systems for precedent). Import `findWorker` from the domain helper.

Key logic (from spec):
```typescript
// For each location where facility_type.kind === 'service':
//   1. Skip abandoned
//   2. findWorker; pay hourly wage if present (facility/treasury funding)
//   3. For each visiting agent:
//      a. ORPHAN GUARD: if btAction !== 'use_service' || memory.atLocation !== loc.id || insideFacility !== loc.id → clear visit, continue
//      b. decrement ticksRemaining
//      c. if ticksRemaining === 0: applyEffects (staffed or unstaffed), clear visit, emit 'ServiceDelivered'
```

Note: the system is NOT yet registered in the tick pipeline. That happens in Chunk 4 (Phase 3).

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Typecheck + lint**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add ServiceSystem stub (not yet registered)"
```

---

### Task 1.8: Stub `AreaEffectSystem` (unregistered) + tests

**Files:**
- Create: `src/infrastructure/systems/area-effect-system.ts`
- Create: `tests/infrastructure/systems/area-effect-system.test.ts`

- [ ] **Step 1: Write failing tests** (from spec §Test Strategy):
- Staffed pulse → agents within `radius` get modifier pushed to `pendingAreaModifiers`
- Unstaffed facility → no pulse, no wage paid
- Pulse only fires every `ticks_per_pulse` ticks (`tickCount - lastPulseTick >= ticks_per_pulse`)
- Multiple overlapping posts → modifiers stack (two pushes into the queue)
- Worker earns wage on pulse (funding: 'treasury' routes through treasury)
- `lastPulseTick` initialized at spawn from current tick — verify that a freshly-spawned facility does NOT immediately pulse on tick 5000

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** following spec §Facility Lifecycle → Area effect pseudocode.

- [ ] **Step 4-5: Tests + typecheck**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add AreaEffectSystem stub (not yet registered)"
```

---

### Task 1.9: Wire registries into `GameCoreDeps` (no consumers yet)

**Files:**
- Modify: `src/infrastructure/entity/game-core-deps.ts` (or wherever `GameCoreDeps` is declared)
- Modify: callers that construct `GameCoreDeps`

Add two new deps fields:
- `getFacilityTypeRegistry: () => Map<string, FacilityType>`
- `getRecipeRegistry: () => Map<string, Recipe>`

- [ ] **Step 1: Grep for `GameCoreDeps` definition and all construction sites**

Run: `npx grep -rn "GameCoreDeps" "01 - Projects/Project Meridian/src/"`

- [ ] **Step 2: Add the two fields** as optional (nullable getters returning empty Map) so existing call sites compile without changes. Full population comes in Chunk 2.

- [ ] **Step 3: Run full test suite — green**

Run: `npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 4: Typecheck + lint**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meridian): wire recipe + facility-type registries into GameCoreDeps"
```

---

**Chunk 1 review checkpoint:** Invoke plan-document-reviewer before starting Chunk 2.

---

## Chunk 2: Phase 2A — Schemas and projection layer

Goal: add `facility_type` + `active_recipe` to the location schema, carry `facility_type` through the perception pipeline, keep the old `type` field alive for backwards compatibility during Phase 2. Nothing in `locations/*.json` changes yet — that happens in Chunk 3.

### Task 2.1: Extend `LocationSchema` with new fields (additive only)

**Files:**
- Modify: `src/domain/schemas/location-schema.ts`
- Modify: `tests/domain/schemas/location-schema.test.ts`

Add two fields, keep old ones:
- `facility_type: z.string().optional()` (optional during Phase 2, required in Phase 3)
- `active_recipe: z.string().nullable().default(null)`

- [ ] **Step 1: Write failing test** — location with `facility_type: 'farm'` + `active_recipe: 'recipe-farm-wheat'` parses successfully; unchanged existing fixtures still parse.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Add the fields** to the schema. Do not remove `type` or `production` yet.

- [ ] **Step 4: Tests pass, full test suite green**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meridian): add facility_type + active_recipe to LocationSchema (additive)"
```

---

### Task 2.2: Create `recipes/` folder with 4 recipe files

**Files:**
- Create: `recipes/farm-wheat.json`
- Create: `recipes/craft-tools.json`
- Create: `recipes/smithy-equipment.json`
- Create: `recipes/draw-water.json`

- [ ] **Step 1: Create `recipes/farm-wheat.json`**

```json
{
  "id": "recipe-farm-wheat",
  "name": "Farm Wheat",
  "inputs": [],
  "outputs": [{ "item_id": "food", "quantity": 1 }],
  "ticks_per_cycle": 15,
  "required_skill": null,
  "min_skill_level": 0
}
```

- [ ] **Step 2: Create `recipes/craft-tools.json`**

```json
{
  "id": "recipe-craft-tools",
  "name": "Craft Tools",
  "inputs": [],
  "outputs": [{ "item_id": "tools", "quantity": 1 }],
  "ticks_per_cycle": 25,
  "required_skill": null,
  "min_skill_level": 0
}
```

- [ ] **Step 3: Create `recipes/smithy-equipment.json`**

```json
{
  "id": "recipe-smithy-equipment",
  "name": "Forge Equipment",
  "inputs": [{ "item_id": "tools", "quantity": 1 }],
  "outputs": [{ "item_id": "equipment", "quantity": 1 }],
  "ticks_per_cycle": 40,
  "required_skill": null,
  "min_skill_level": 0
}
```

- [ ] **Step 4: Create `recipes/draw-water.json`**

```json
{
  "id": "recipe-draw-water",
  "name": "Draw Water",
  "inputs": [],
  "outputs": [{ "item_id": "water", "quantity": 3 }],
  "ticks_per_cycle": 10,
  "required_skill": null,
  "min_skill_level": 0
}
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/recipes/"
git commit -m "feat(meridian): add 4 recipe files (farm-wheat, craft-tools, smithy-equipment, draw-water)"
```

---

### Task 2.3: Create `facility-types/` folder — production kinds only (5 files)

This task adds only the production + area_effect kinds. Service kinds come in Chunk 4 (Phase 3) alongside water items to avoid a phase 2 commit depending on unmigrated services.

**Files:**
- Create: `facility-types/farm.json`
- Create: `facility-types/workshop.json`
- Create: `facility-types/smithy.json`
- Create: `facility-types/well.json`
- Create: `facility-types/guard_post.json`

- [ ] **Step 1-5: Create each file** using the shape defined in spec §Content Migration → New files table. Example for farm:

```json
{
  "id": "farm",
  "kind": "production",
  "primary_job": "settler",
  "default_wage": 3,
  "default_fund": 200,
  "funding": "facility",
  "capacity": 1,
  "allowed_recipes": ["recipe-farm-wheat"]
}
```

Use the spec table for all 5 files (farm/workshop/smithy/well/guard_post). Guard_post uses `kind: area_effect` with `modifier: { kind: 'mood', delta_per_tick: 2 }`, `radius: 150`, `ticks_per_pulse: 30`, `funding: 'treasury'`, `default_wage: 4`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add 5 production + area-effect facility types"
```

---

### Task 2.4: Extend `PerceivedLocation` with `facility_type`

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts:15-20` (PerceivedLocation interface)
- Modify: `tests/domain/systems/behavior-agent.test.ts` (if it exists — otherwise rely on downstream tests)

Add `facility_type: string` alongside the existing `type: string`. Both coexist during Phase 2.

- [ ] **Step 1: Make the change**

```typescript
export interface PerceivedLocation {
	id: string;
	type: string;            // LEGACY — dropped in Phase 3
	facility_type: string;   // NEW
	position: { x: number; y: number };
	distance: number;
}
```

- [ ] **Step 2: Run tsc — expect failures** at every site that constructs a `PerceivedLocation` (perception pipeline, tests). These get fixed in the next tasks.

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Keep a note of the failing file list — they will be addressed in Tasks 2.5, 2.6, 2.7.

- [ ] **Step 3: Do NOT commit yet** — state is broken. Chunk 2 proceeds to fix the construction sites.

---

### Task 2.5: Update `PerceptionInput` + `PerceptionState` cached shape

**Files:**
- Modify: `src/domain/systems/perception.ts:8` (PerceptionInput.locations field)
- Modify: `src/domain/systems/perception.ts:32` (pipeline copy)
- Modify: `src/domain/core/component-data.ts:69` (PerceptionState.nearbyLocations)

- [ ] **Step 1: Add `facility_type: string` to both shapes**, copy through the `.map()` at `perception.ts:32`.

- [ ] **Step 2: Run tsc** — site count goes down but not yet zero.

- [ ] **Step 3: No commit yet** (still wired to a broken factory).

---

### Task 2.6: Update `perception-system.ts:47` and `world-loader.ts:206`

**Files:**
- Modify: `src/infrastructure/systems/perception-system.ts:47`
- Modify: `src/infrastructure/engine/world-loader.ts:206-214`
- Modify: `src/domain/systems/world-validation.ts:11-19` (`WorldValidationLocation` interface — drop `type`, add the new fields read by spec §N3 row)

For `perception-system.ts:47`:
```typescript
locationInputs = locationList.map(l => ({
	id: l.id,
	type: l.type,
	facility_type: l.facility_type ?? '',   // coalesce during Phase 2; location fixtures still lack the field
	pos: { x: l.position.x, y: l.position.y },
}));
```

For `world-loader.ts:206-214`:
```typescript
// Old:
// type: loc.type,
// production: loc.production !== null ? { job: ..., output: ..., input: ... } : null
// New:
facility_type: loc.facility_type ?? loc.type,  // fallback during Phase 2
// drop `type` + `production` from the validation shape
```

For `world-validation.ts`:
```typescript
export interface WorldValidationLocation {
	id: string;
	facility_type: string;
	primary_job: string | null;      // resolved from facility type registry at call site
	inputs: Array<{ item_id: string }>;   // resolved from active recipe
	outputs: Array<{ item_id: string }>;
}
```

Update `validateWorldConsistency` to read `primary_job` / `inputs` / `outputs` directly instead of the `production` nested object. The checks themselves (producer/consumer graph) don't change — only the field names.

- [ ] **Step 1: Make all three edits**

- [ ] **Step 2: Update the `world-loader.ts` call site that builds the validation input** — it must now look up `facility_type.primary_job` and `active_recipe.inputs/outputs` from the registries via `deps.getFacilityTypeRegistry()` / `deps.getRecipeRegistry()`. During Phase 2 the registries are still mostly empty, so guard with fallbacks: if no facility type found, use legacy `loc.production.job` etc.

- [ ] **Step 3: Run tsc** — expected to be clean now except for `behavior-agent-factory.ts`

- [ ] **Step 4: No commit yet**

---

### Task 2.7: Update `behavior-agent-factory.ts:117-131` projection builder

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:117-131`

- [ ] **Step 1: Grep the current resolveNearbyLocations body**

Read lines 117-131. The current code is:
```typescript
function resolveNearbyLocations(): PerceivedLocation[] {
	const perception = actor.get(PerceptionComponent);
	const locationList = getLocations();
	return perception.state.nearbyLocations.map(nl => {
		const locData = locationList.find(l => l.id === nl.id);
		return {
			id: nl.id,
			type: locData?.type ?? nl.type,
			position: locData !== undefined ? { x: locData.position.x, y: locData.position.y } : { x: 0, y: 0 },
			distance: nl.distance,
		};
	});
}
```

- [ ] **Step 2: Add `facility_type`**

```typescript
return {
	id: nl.id,
	type: locData?.type ?? nl.type,
	facility_type: locData?.facility_type ?? nl.facility_type ?? '',
	position: locData !== undefined ? { x: locData.position.x, y: locData.position.y } : { x: 0, y: 0 },
	distance: nl.distance,
};
```

- [ ] **Step 3: Run tsc — clean**

- [ ] **Step 4: Run full vitest — green**

Because `facility_type` is empty string on locations that don't yet declare it, every existing test still passes (no consumer reads this field yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meridian): thread facility_type through perception + projection layers"
```

---

**Chunk 2 review checkpoint.**

---

## Chunk 3: Phase 2B — Production systems and call sites

Goal: migrate FacilitySystem, QuestGeneration, Economy, Subsidy, DailyReport, and debug-overlay's production paths onto the new registries; update all 5 production-side location JSON files; populate the registries at boot. At the end of this chunk, production facilities run on recipes while services and area-effect kinds still use the legacy code path.

### Task 3.1: Wire registries into boot / `game-view.ts` populateScene

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts` (populateScene)
- Modify: world bootstrap (wherever `GameCoreDeps` is populated — find it by greping)

- [ ] **Step 1: Grep `populateScene` and boot construction**

- [ ] **Step 2: Load recipes + facility types at boot**

At the same place `LocationSchema` fixtures are loaded:

```typescript
const recipes = loadRecipes('recipes', { readDirectory, readFile });
const facilityTypes = loadFacilityTypes('facility-types', { readDirectory, readFile });
validateFacilityTypes(facilityTypes, recipes);
```

- [ ] **Step 3: Expose them via `GameCoreDeps`**

```typescript
deps.getRecipeRegistry = () => recipes;
deps.getFacilityTypeRegistry = () => facilityTypes;
```

- [ ] **Step 4: Update `populateScene` fund bootstrap**

Replace the `config.economy.facility_start_fund` read with per-type `default_fund`:

```typescript
// Old:
// const fund = loc.production.funding === 'treasury' ? 0 : deps.config.economy.facility_start_fund;
// New:
const facilityType = facilityTypes.get(loc.facility_type ?? '');
const fund = loc.fund
	?? (facilityType?.funding === 'treasury' ? 0 : facilityType?.default_fund ?? deps.config.economy.facility_start_fund);
```

Fallback chain preserves back-compat during Phase 2.

- [ ] **Step 5: Run full test suite — green**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): load recipe + facility-type registries at boot"
```

---

### Task 3.2: Refactor `FacilitySystem` to use recipes

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts`
- Modify: `tests/infrastructure/systems/facility-system.test.ts`

- [ ] **Step 1: Write new failing tests**

- Production with recipe inputs → inputs consumed on cycle complete
- Production with missing recipe inputs → idle, no progress
- Aptitude scaling applied to `recipe.ticks_per_cycle`
- Fund drain per cycle on funding: 'facility'
- Treasury drain on funding: 'treasury'

- [ ] **Step 2: Rewrite the tick loop** to the spec §Facility Lifecycle → Production pseudocode.

Inside the loop:
1. `facilityType = deps.getFacilityTypeRegistry().get(loc.facility_type)`
2. Skip if `facilityType?.kind !== 'production'`
3. `recipe = deps.getRecipeRegistry().get(loc.active_recipe)`
4. `worker = findWorker(facility, facilityType, agents)`
5. `if !worker || !checkInputs(facility.stock, recipe.inputs)` → status = idle, continue
6. `effectiveTicks = applyAptitudeScaling(recipe.ticks_per_cycle, worker, facilityType.primary_job)` (reuse existing aptitude function)
7. `result = applyRecipeCycle(...)` — the pure function from Task 1.4
8. `applyResult(facility, result)`
9. On cycleComplete: `payWage`, `collectTax`, `emit ProductionComplete`

- [ ] **Step 3: Delete the inline cycle math** that's now in `applyRecipeCycle`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Typecheck + lint**

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(meridian): FacilitySystem reads recipes + facility types from registries"
```

---

### Task 3.3: Migrate `quest-generation-system.ts` to recipes

**Files:**
- Modify: `src/infrastructure/systems/quest-generation-system.ts`
- Modify: `tests/infrastructure/systems/quest-generation-system.test.ts`

Current breaks:
- Line 70: `loc.production !== null && loc.production.input !== null` → read `recipe.inputs`
- Line 99: `loc.type === 'market'` → `facility_type.id === 'market_stall'` (gate on service kind)

- [ ] **Step 1: Write failing test**

- Supply quest fires when Smithy's tools input is below threshold, referencing `recipe-smithy-equipment.inputs[0].item_id`
- Restock quest fires when Market Stall stock of `food` drops below `restock_threshold_per_item.food`

- [ ] **Step 2: Rewrite the trigger logic**

```typescript
const facilityType = deps.getFacilityTypeRegistry().get(loc.facility_type);
if (facilityType?.kind === 'production') {
	const recipe = deps.getRecipeRegistry().get(loc.active_recipe ?? '');
	if (recipe === undefined) continue;
	for (const input of recipe.inputs) {
		const stock = facility.state.stock.find(s => s.item_id === input.item_id);
		if ((stock?.quantity ?? 0) < input.quantity) {
			// Emit supply quest (existing payload shape)
		}
	}
}

// Restock gate:
if (facilityType?.kind === 'service' && facilityType.id === 'market_stall') {
	const thresholds = facilityType.restock_threshold_per_item;
	for (const [itemId, threshold] of Object.entries(thresholds)) {
		const stock = facility.state.stock.find(s => s.item_id === itemId);
		if ((stock?.quantity ?? 0) < threshold) {
			// Emit restock quest
		}
	}
}
```

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(meridian): QuestGeneration reads recipes + market_stall threshold"
```

---

### Task 3.4: Migrate economy-system, subsidy-system, daily-report-system

**Files:**
- Modify: `src/infrastructure/systems/economy-system.ts:32`
- Modify: `src/infrastructure/systems/subsidy-system.ts:37`
- Modify: `src/infrastructure/systems/daily-report-system.ts:62-63`

These are 3 small, independent edits. Do them as one commit.

- [ ] **Step 1: economy-system.ts:32**

```typescript
// Old: if (loc.production !== null || loc.type === 'market')
const ft = deps.getFacilityTypeRegistry().get(loc.facility_type ?? '');
if (ft?.kind === 'production' || ft?.id === 'market_stall') {
```

- [ ] **Step 2: subsidy-system.ts:37**

```typescript
// Old: if (facility.state.status === 'abandoned' && loc.production !== null) continue;
const ft = deps.getFacilityTypeRegistry().get(loc.facility_type ?? '');
if (facility.state.status === 'abandoned' && ft?.kind === 'production' && ft.funding === 'facility') continue;
```

- [ ] **Step 3: daily-report-system.ts:62-63**

```typescript
// Old: facilityWages.push(loc.production?.wage ?? 0); ...
const ft = deps.getFacilityTypeRegistry().get(loc.facility_type ?? '');
facilityWages.push(ft?.default_wage ?? 0);
if (fac.state.workerId === null && ft?.primary_job !== undefined && ft.primary_job !== '') {
```

- [ ] **Step 4: Run tests — existing tests may fail because test fixtures don't set `facility_type`.** Fix the fixtures to set it, or fall back to legacy reads during Phase 2 (add `?? loc.production?.job` etc.) for the transition period. Prefer the back-compat fallback path during Phase 2 to avoid mass fixture churn.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(meridian): economy/subsidy/daily-report read facility type registry"
```

---

### Task 3.5: Migrate debug-overlay production-side refs (lines 239, 819, 821, 822, 971, 972)

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts`

These are the `loc.production?.ticks_per_cycle`, `loc.production !== null`, `loc.production.job` reads used by the anomaly detector and progress display. Icon / type-display refs (232, 257, 258, 336, 637, 820, 833) stay on `loc.type` for Phase 2 and migrate in Phase 3.

- [ ] **Step 1: Replace each production ref** with a registry lookup:

```typescript
const ft = deps.getFacilityTypeRegistry().get(loc.facility_type ?? '');
const recipe = deps.getRecipeRegistry().get(loc.active_recipe ?? '');
// Progress bar:
const progressMax = recipe?.ticks_per_cycle ?? loc.production?.ticks_per_cycle ?? 0;
// Anomaly detector:
if (ft?.kind === 'production' && fac.state.workerId === null && fac.state.status !== 'abandoned') {
	anomalies.push(`[MEDIUM] Facility ${loc.name}: production facility with no worker (job=${ft.primary_job})`);
}
```

- [ ] **Step 2: Typecheck + lint**

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(meridian): debug-overlay production refs read facility type registry"
```

---

### Task 3.6: Migrate 5 production-side location files + rename water-source → well

**Files:**
- Modify: `locations/farmland.json`
- Modify: `locations/workshop.json`
- Modify: `locations/guard-post.json`
- `git mv`: `locations/water-source.json` → `locations/well.json`
- Modify: renamed `locations/well.json`
- Create: `locations/smithy.json`

For each production file, remove `type` + `production` block, add `facility_type` + `active_recipe`.

- [ ] **Step 1: Farmland**

```json
{
  "id": "farmland",
  "name": "Farmland",
  "facility_type": "farm",
  "active_recipe": "recipe-farm-wheat",
  "position": { ... unchanged },
  "color": "...",
  "fund": 200,
  "stock": [],
  "capacity": 1
}
```

Keep `type` and `production` for now if any Phase 2 tooling still reads them — OR delete immediately and rely on the back-compat fallbacks put in place in Task 3.4. Prefer deletion: the fallbacks will be removed in Chunk 5 anyway, and leaving dead fields bloats the diff.

**Decision:** delete `type` + `production` + `leisure` now from production files. Services stay untouched.

- [ ] **Step 2: Workshop**

Same transformation with `facility_type: workshop`, `active_recipe: recipe-craft-tools`.

- [ ] **Step 3: Guard-post**

```json
{
  "facility_type": "guard_post",
  "active_recipe": null,
  ...
}
```

- [ ] **Step 4: Rename water-source.json → well.json**

```bash
cd "c:/Projects/flowti"
git mv "01 - Projects/Project Meridian/locations/water-source.json" "01 - Projects/Project Meridian/locations/well.json"
```

Update its contents:

```json
{
  "id": "well",
  "name": "Well",
  "facility_type": "well",
  "active_recipe": "recipe-draw-water",
  ...
}
```

If there are cross-references to `'water-source'` id anywhere in code or fixtures, update them too (grep first).

- [ ] **Step 5: Create new `locations/smithy.json`**

Place it near the workshop geographically (see spec §Content Migration). Use `facility_type: smithy`, `active_recipe: recipe-smithy-equipment`.

- [ ] **Step 6: Run full vitest**

Many tests will fail — fixtures that still expect `type: 'work'` on farmland, etc. Fix them by updating fixture JSON / inline fixtures to use the new shape.

- [ ] **Step 7: Typecheck + lint**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(meridian): migrate production location files to facility_type"
```

---

### Task 3.7: World validation — producer/consumer graph uses recipes

**Files:**
- Modify: `src/domain/systems/world-validation.ts` (the validation body, not just the interface)
- Modify: `tests/domain/systems/world-validation.test.ts`

The existing validator walks `loc.production` to build producer/consumer sets. Rewrite to walk `facilityType.primary_job` + `recipe.outputs/inputs`.

- [ ] **Step 1: Write failing test** — supply chain graph correctly detects "tools has no producer" if `craft-tools.json` recipe is absent.

- [ ] **Step 2: Rewrite the validator body** using the new `WorldValidationLocation` interface shape defined in Task 2.6.

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(meridian): world validation walks recipe graph"
```

---

**Chunk 3 review checkpoint. Full test suite green before proceeding to Chunk 4.**

---

## Chunk 4: Phase 3A — Service facility types, water items, ServiceSystem registration

This chunk is the start of the highest-risk phase. It adds service kind facility types, introduces water as an item, deletes waterskin, and registers ServiceSystem in the tick pipeline. It does NOT yet delete leisure-system or rest-system — those come in Chunk 5 alongside the BT rewrite to keep each commit green.

### Task 4.1: Create 6 service-kind facility type files

**Files:**
- Create: `facility-types/rest_inn.json`
- Create: `facility-types/bathhouse.json`
- Create: `facility-types/tavern.json`
- Create: `facility-types/library.json`
- Create: `facility-types/park.json`
- Create: `facility-types/market_stall.json`

Use the shapes from spec §Content Migration → New files table. Example for bathhouse:

```json
{
  "id": "bathhouse",
  "kind": "service",
  "primary_job": "bathhouse_keeper",
  "default_wage": 2,
  "default_fund": 150,
  "funding": "facility",
  "capacity": 1,
  "staffed_effects":   { "mood": 15, "energy": 5, "social": 0, "skill_xp": 0 },
  "unstaffed_effects": { "mood": 5,  "energy": 0, "social": 0, "skill_xp": 0 },
  "cost_per_visit": 5,
  "ticks_per_visit": 20,
  "restock_threshold_per_item": {}
}
```

Market stall's `restock_threshold_per_item` should cover food, tools, equipment, water with appropriate thresholds (pick reasonable defaults — e.g. `{ food: 5, tools: 3, equipment: 2, water: 10 }`).

- [ ] **Step 1-6: Create each file**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(meridian): add 6 service facility types"
```

---

### Task 4.2: Add `water` item, delete `waterskin`

**Files:**
- Create: `items/water.md`
- Delete: `items/waterskin.md`
- Modify: any item registry or loader that hardcodes item ids
- Modify: agent spawn inventories (grep `waterskin` and replace)

- [ ] **Step 1: Create `items/water.md`**

```markdown
---
display_name: Water
icon: droplet
color: "#4da6ff"
rarity: common
category: food
base_price: 2
---
```

- [ ] **Step 2: Grep `waterskin` across the codebase**

Run: `npx grep -rn "waterskin" "01 - Projects/Project Meridian/"`

Note every hit. Categories:
- Agent starting inventory fixtures
- `bt-actions-needs.ts` `FillWaterskin` action (deleted in Chunk 5)
- `bt-actions-needs.ts` `Drink` action (reads `waterskin` charges)
- `HasWater` condition
- Test fixtures

- [ ] **Step 3: Update agent starting inventories** — replace `{ item_id: 'waterskin', quantity: 1, charges: 3 }` with `{ item_id: 'water', quantity: 3 }`.

- [ ] **Step 4: Rewrite `Drink` action** in `bt-actions-needs.ts` to consume 1 `water` item instead of decrementing waterskin charges. Preserve the existing side-effect shape (thirst increase, markDirty).

- [ ] **Step 5: Rewrite `HasWater` condition** in `bt-conditions-economy.ts` to check for `water` item quantity > 0.

- [ ] **Step 6: Delete `items/waterskin.md`**

```bash
cd "c:/Projects/flowti"
git rm "01 - Projects/Project Meridian/items/waterskin.md"
```

- [ ] **Step 7: Run full test suite** — many fixture failures expected. Fix each to use `water` instead. The `FillWaterskin` action is still referenced by base.mdsl — rename it to a no-op or leave it pointing at a stub until Chunk 5 rewrites base.mdsl.

Short-term stub for `FillWaterskin`:
```typescript
FillWaterskin(): ActionResult { return FAILED; }
```

This keeps the BT parsable while base.mdsl still references it. Chunk 5 deletes the action and the base.mdsl branch together.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(meridian): replace waterskin with water item"
```

---

### Task 4.3: Register ServiceSystem in tick pipeline

**Files:**
- Modify: wherever the ECS tick pipeline is assembled (likely `game-view.ts` or a system registry module)

- [ ] **Step 1: Grep for `new FacilitySystem`** (or similar) to find the pipeline assembly

- [ ] **Step 2: Add `new ServiceSystem(deps)`** to the pipeline AFTER FacilitySystem, BEFORE LeisureSystem. Order: Facility → Service → Leisure → Rest. Leisure + Rest are still active; they just won't match any service-kind facilities because their filter is still `l.type === 'leisure'/'rest'` and service facilities don't have those types (service kinds are purely in `facility_type`).

- [ ] **Step 3: Run full test suite — green**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meridian): register ServiceSystem in tick pipeline"
```

---

### Task 4.4: Add service BT actions file

**Files:**
- Create: `src/infrastructure/entity/bt-actions-service.ts`
- Create: `tests/infrastructure/entity/bt-actions-service.test.ts`
- Modify: `src/infrastructure/entity/bt-actions.ts` (register new actions)
- Modify: `src/infrastructure/entity/bt-working-memory.ts` (add `currentServiceVisit`)

- [ ] **Step 1: Extend working memory**

In `bt-working-memory.ts`, add:

```typescript
currentServiceVisit: { facilityId: string; ticksRemaining: number; costPaid: boolean } | null;
pendingAreaModifiers: Array<{ kind: 'mood'; delta: number }>;
```

Initialize both to `null` / `[]`.

- [ ] **Step 2: Write failing tests**

Cover:
- `ChooseServiceFacility('leisure')` picks a nearby service facility with best staffed mood effect, prefers staffed over unstaffed
- `SeekService` moves agent toward `memory.serviceTarget`, returns SUCCEEDED on arrival
- `UseService` validates wallet + no current visit, debits cost upfront, sets `currentServiceVisit`, commits 'use_service' for `ticks_per_visit`
- `UseService` returns FAILED if `currentServiceVisit` is already set (no double-enter)
- `UseService` returns FAILED if wallet < cost

- [ ] **Step 3: Implement `bt-actions-service.ts`**

```typescript
import type { ActionResult, ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { WalletComponent } from '../components/wallet-component.js';
import { findNearest } from '../../domain/core/array-utils.js';

export interface ServiceActionMethods {
	ChooseServiceFacility(intent: string): ActionResult;
	SeekService(): ActionResult;
	UseService(): ActionResult;
}

export function createServiceActions(ctx: ActionContext): ServiceActionMethods {
	const { memory, actor, deps, resolveNearbyLocations } = ctx;

	return {
		ChooseServiceFacility(intent: string): ActionResult {
			const facilityTypes = deps.getFacilityTypeRegistry();
			const candidates = resolveNearbyLocations()
				.map(l => {
					const ft = facilityTypes.get(l.facility_type);
					if (ft?.kind !== 'service') return null;
					// Score by intent:
					let score = 0;
					if (intent === 'leisure') score = ft.staffed_effects.mood;
					else if (intent === 'rest') score = ft.staffed_effects.energy;
					else if (intent === 'social') score = ft.staffed_effects.social;
					if (score <= 0) return null;
					return { loc: l, score };
				})
				.filter((c): c is NonNullable<typeof c> => c !== null);

			if (candidates.length === 0) return FAILED;
			candidates.sort((a, b) => b.score - a.score);
			memory.serviceTarget = candidates[0]!.loc.id;
			return SUCCEEDED;
		},

		SeekService(): ActionResult {
			if (memory.serviceTarget === null) return FAILED;
			beginAction(ctx, 'seek_service');
			memory.movementTarget = { id: memory.serviceTarget, type: 'location' };
			if (memory.atLocation === memory.serviceTarget) return SUCCEEDED;
			return RUNNING;
		},

		UseService(): ActionResult {
			if (memory.serviceTarget === null) return FAILED;
			if (memory.currentServiceVisit !== null) return FAILED;
			const ft = deps.getFacilityTypeRegistry().get(/* facility_type of target */);
			if (ft === undefined || ft.kind !== 'service') return FAILED;
			const wallet = actor.get(WalletComponent);
			if (wallet.state.gold < ft.cost_per_visit) return FAILED;
			// Debit cost upfront
			wallet.state = { ...wallet.state, gold: wallet.state.gold - ft.cost_per_visit };
			wallet.markDirty();
			// ... set currentServiceVisit, beginAction('use_service', ticks_per_visit)
			memory.currentServiceVisit = {
				facilityId: memory.serviceTarget,
				ticksRemaining: ft.ticks_per_visit,
				costPaid: true,
			};
			memory.insideFacility = memory.serviceTarget;
			beginAction(ctx, 'use_service', ft.ticks_per_visit);
			return RUNNING;
		},
	};
}
```

Also add a `memory.serviceTarget: string | null` field to working memory.

- [ ] **Step 4: Register in `bt-actions.ts`**

Add `...createServiceActions(ctx)` to the returned object; extend `ActionMethods` with the three new methods.

- [ ] **Step 5: Tests pass**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meridian): add service BT actions (ChooseServiceFacility, SeekService, UseService)"
```

---

### Task 4.5: Add `SeekWell` to `bt-actions-economy.ts`

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-economy.ts`

- [ ] **Step 1: Write failing test** — agent in perception range of a Well with water in stock, SeekWell sets movementTarget, returns RUNNING or SUCCEEDED on arrival.

- [ ] **Step 2: Implement**

```typescript
SeekWell(): ActionResult {
	const wells = resolveNearbyLocations().filter(l =>
		l.facility_type === 'well' /* stock check via facility data */
	);
	if (wells.length > 0) {
		const nearest = findNearest(wells)!;
		beginAction(ctx, 'seek_well');
		memory.movementTarget = { id: nearest.id, type: 'location' };
		if (memory.atLocation === nearest.id) return SUCCEEDED;
		return RUNNING;
	}
	// Fallback: full-map search (same pattern as SeekRest)
	const allWells = deps.getLocations().filter(l => l.facility_type === 'well');
	if (allWells.length === 0) return FAILED;
	// ... pick nearest by Euclidean distance
	beginAction(ctx, 'seek_well');
	memory.movementTarget = { id: best.id, type: 'location' };
	if (memory.atLocation === best.id) return SUCCEEDED;
	return RUNNING;
},
```

Note: the in-perception stock check requires reading the facility's stock — use the existing `resolveNearbyFacilities()` helper to cross-check.

- [ ] **Step 3: Register in `bt-actions.ts` ActionMethods interface**

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meridian): add SeekWell BT action"
```

---

### Task 4.6: Extend `ContinueCommitment` with service-visit cleanup

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts` (ContinueCommitment)
- Modify: `tests/infrastructure/entity/bt-actions.test.ts`

- [ ] **Step 1: Write failing test** — agent with `committedAction: 'use_service'` whose commit breaks (from critical need or expiry) → `currentServiceVisit` cleared synchronously, `insideFacility` cleared.

- [ ] **Step 2: Extend ContinueCommitment**

Add to every "commit breaks" branch:

```typescript
if (ca === 'use_service') {
	memory.currentServiceVisit = null;
	memory.insideFacility = null;
}
```

Do this in every early-return path that nulls `committedAction`.

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(meridian): ContinueCommitment clears currentServiceVisit on commit break"
```

---

**Chunk 4 review checkpoint.**

---

## Chunk 5: Phase 3B — BT rewrite, call-site migration, legacy deletion

This chunk performs the terminal cut: `base.mdsl` is rewritten, all remaining `l.type` reads are migrated, `location.type`/`production`/`leisure` are dropped from LocationSchema, the legacy leisure and rest systems are deleted, and the old BT actions they powered are removed.

### Task 5.1: Migrate service location files to `facility_type`

**Files:**
- Modify: `locations/cabin.json`, `farmstead.json`, `house.json` → `facility_type: rest_inn`
- Modify: `locations/bathhouse.json` → `facility_type: bathhouse`
- Modify: `locations/tavern.json` → `facility_type: tavern`
- Modify: `locations/library.json` → `facility_type: library`
- Modify: `locations/park.json` → `facility_type: park`
- Modify: `locations/market.json` → `facility_type: market_stall`

Remove `type`, `leisure`, `production` fields. Add `facility_type` and `active_recipe: null`.

- [ ] **Step 1-8: Update each file**

- [ ] **Step 9: Run tests** — many failures expected from fixture-based tests. Fix them by updating fixtures.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(meridian): migrate service location files to facility_type"
```

---

### Task 5.2: Rewrite `base.mdsl` — P0.3, P2.5, P5

**Files:**
- Modify: `behavior-trees/base.mdsl`
- Modify: `behavior-trees/*.mdsl` (settler/guard/craftsman — any branch reference to deleted actions)
- Modify: `tests/infrastructure/entity/bt-loader.test.ts` (update any fixture assertions)

- [ ] **Step 1: P0.3 — Thirst fallback**

Replace the current `SeekWater` + `FillWaterskin` + `Drink` sequence with the three-sequence selector from spec §BT changes:

```
sequence {
    condition [IsThirsty]
    condition [HasWater]
    action [Drink]
}
sequence {
    condition [IsThirsty]
    flip { condition [HasWater] }
    condition [CanAffordItem, "water"]
    action [SeekWell]
    action [BuyItem, "water"]
    action [Drink]
}
sequence {
    condition [IsThirsty]
    flip { condition [HasWater] }
    condition [CanAffordItem, "water"]
    action [SeekMarket]
    action [BuyItem, "water"]
    action [Drink]
}
```

- [ ] **Step 2: P2.5 — Leisure**

Replace `ChooseLeisure + SeekLeisureTarget + Leisure while(IsAtLeisure)` with:

```
action [ChooseServiceFacility, "leisure"]
action [SeekService]
action [UseService] while(IsUsingService)
```

Where `IsUsingService` is a new trivial condition checking `memory.currentServiceVisit !== null`.

- [ ] **Step 3: P5 — Rest**

Replace `SeekRest + Rest while(IsExhausted)` with:

```
action [ChooseServiceFacility, "rest"]
action [SeekService]
action [UseService] while(IsExhausted)
```

- [ ] **Step 4: P0 critical rest branch**

The P0 critical survival branch also uses `SeekRest + Rest`. Replace similarly with `ChooseServiceFacility + SeekService + UseService`.

- [ ] **Step 5: Update the single `[AtLocation, "market"]` call at base.mdsl:99 → `[AtLocation, "market_stall"]`**

- [ ] **Step 6: Check other `*.mdsl` files** (settler/guard/craftsman) for references to deleted actions — update or leave unchanged as appropriate.

- [ ] **Step 7: Run bt-loader tests** — must parse clean

- [ ] **Step 8: Full test suite** — integration tests on BT flows will break; fix them one at a time.

- [ ] **Step 9: Commit**

```bash
git commit -m "refactor(meridian): rewrite base.mdsl P0/P0.3/P2.5/P5 for ServiceSystem"
```

---

### Task 5.3: Add `IsUsingService` condition

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-context.ts` (or wherever `IsAtLeisure` lived)

Trivial: `IsUsingService(): boolean { return memory.currentServiceVisit !== null; }`.

- [ ] **Step 1: Write failing test**

- [ ] **Step 2: Implement**

- [ ] **Step 3: Register in `bt-conditions.ts` ConditionMethods**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meridian): add IsUsingService condition"
```

---

### Task 5.4: Migrate `bt-conditions-context.ts` — AtLocation / NearLocation → facility_type

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-context.ts:24-31`

- [ ] **Step 1: Change implementations**

```typescript
AtLocation(type: string): boolean {
	const locData = getAtLocationData();
	return locData?.facility_type === type;
},

NearLocation(type: string): boolean {
	return resolveNearbyLocations().some(l => l.facility_type === type);
},
```

The `type` parameter now carries a facility type id, not a legacy location type.

- [ ] **Step 2: Update any test that calls these conditions** with old-shape strings.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(meridian): AtLocation/NearLocation read facility_type"
```

---

### Task 5.5: Migrate `bt-actions-needs.ts` — `SeekFood`

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-needs.ts:183`

Replace `l.type === 'food'` with `l.facility_type === 'farm'`.

- [ ] **Step 1: Update the filter**

- [ ] **Step 2: Delete `SeekWater` and `SeekRest` actions** from this file. Keep `Eat`, `Drink`, `Rest`, `SeekFood`, `SeekBestFoodSource`, `CollectProduced`, `RepairWithTools`. Drop `FillWaterskin` and the standalone `Rest` action body if it's only used in now-dead branches.

**Decision check:** the spec lists `SeekRest` in the deletion list, but `Rest` the action is referenced by the critical-rest P0 branch via UseService now. Trace the final base.mdsl rewrite — if `Rest` is no longer called, delete it too. Otherwise keep it.

- [ ] **Step 3: Update `ActionMethods` interface** in `bt-actions.ts` to reflect the deletions.

- [ ] **Step 4: Tests pass, typecheck clean**

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(meridian): SeekFood filters by facility_type, delete SeekWater/FillWaterskin"
```

---

### Task 5.6: Migrate `bt-actions-economy.ts` — SellAtMarket + SeekMarket

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-economy.ts:19,102`

- [ ] **Step 1: SellAtMarket (line 19)**

```typescript
// Old: if (locData?.type !== 'market') return FAILED;
if (locData?.facility_type !== 'market_stall') return FAILED;
```

- [ ] **Step 2: SeekMarket (line 102)**

```typescript
const marketLocs = resolveNearbyLocations().filter(l => l.facility_type === 'market_stall');
```

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(meridian): SellAtMarket + SeekMarket filter by facility_type"
```

---

### Task 5.7: Migrate `debug-overlay.ts` icon + market lookup refs

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts` (lines 232, 257, 258, 336, 637, 820, 833)

- [ ] **Step 1: Introduce `FACILITY_TYPE_ICONS` map**

```typescript
const FACILITY_TYPE_ICONS: Record<string, string> = {
	farm: '🌾',
	workshop: '🔨',
	smithy: '⚒️',
	well: '💧',
	guard_post: '🛡️',
	rest_inn: '🛏️',
	bathhouse: '🛁',
	tavern: '🍺',
	library: '📚',
	park: '🌳',
	market_stall: '🏪',
};
```

- [ ] **Step 2: Replace every `LOCATION_ICONS[loc.type]` lookup with `FACILITY_TYPE_ICONS[loc.facility_type] ?? '📍'`**

- [ ] **Step 3: Replace lines 336 and 637** (`locations.find(l => l.type === 'market')`) with `locations.find(l => l.facility_type === 'market_stall')`

- [ ] **Step 4: Replace display strings at lines 258, 820, 833** that rendered `(${loc.type})` → `(${loc.facility_type})`

- [ ] **Step 5: Delete the old `LOCATION_ICONS` map** if it has no other consumers

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(meridian): debug-overlay uses FACILITY_TYPE_ICONS + market_stall lookups"
```

---

### Task 5.8: Migrate `gossip-system.ts` — rumor payload

**Files:**
- Modify: `src/infrastructure/systems/gossip-system.ts:40,50`

- [ ] **Step 1: Replace `locationType: loc.type` with `locationType: loc.facility_type`**

- [ ] **Step 2: Update the rumor description string** — use a human label helper or just the facility_type id.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(meridian): gossip-system uses facility_type in rumors"
```

---

### Task 5.9: Delete `leisure-system.ts`, `rest-system.ts`, `bt-actions-leisure.ts`

**Files:**
- Delete: `src/infrastructure/systems/leisure-system.ts`
- Delete: `src/infrastructure/systems/rest-system.ts`
- Delete: `tests/infrastructure/systems/leisure-system.test.ts`
- Delete: `tests/infrastructure/systems/rest-system.test.ts`
- Delete: `src/infrastructure/entity/bt-actions-leisure.ts`
- Modify: tick pipeline (unregister the two systems)
- Modify: `bt-actions.ts` — drop the `...createLeisureActions(ctx)` spread and the interface entries for `ChooseLeisure`, `SeekLeisureTarget`, `Leisure`. Move `Wander` and `Idle` into `bt-actions.ts` inline, or into `bt-actions-needs.ts`, before deleting the file.

- [ ] **Step 1: Grep for all references to the three deleted files**

Run: `npx grep -rn "leisure-system\|rest-system\|bt-actions-leisure\|ChooseLeisure\|SeekLeisureTarget" "01 - Projects/Project Meridian/src/"`

- [ ] **Step 2: Relocate `Wander` and `Idle`** to `bt-actions.ts` (inline, alongside `ContinueCommitment`). Preserve their bodies exactly.

- [ ] **Step 3: Unregister LeisureSystem + RestSystem from the tick pipeline**

- [ ] **Step 4: Delete the four source files + two test files**

```bash
cd "c:/Projects/flowti"
git rm "01 - Projects/Project Meridian/src/infrastructure/systems/leisure-system.ts" \
       "01 - Projects/Project Meridian/src/infrastructure/systems/rest-system.ts" \
       "01 - Projects/Project Meridian/tests/infrastructure/systems/leisure-system.test.ts" \
       "01 - Projects/Project Meridian/tests/infrastructure/systems/rest-system.test.ts" \
       "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-leisure.ts"
```

- [ ] **Step 5: Full test suite — green**

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(meridian): delete LeisureSystem, RestSystem, bt-actions-leisure"
```

---

### Task 5.10: Drop `type` / `production` / `leisure` from LocationSchema

**Files:**
- Modify: `src/domain/schemas/location-schema.ts`
- Modify: `src/domain/systems/behavior-agent.ts` (PerceivedLocation — drop `type`)
- Modify: `src/domain/systems/perception.ts` (drop type from PerceptionInput/output)
- Modify: `src/domain/core/component-data.ts` (drop type from PerceptionState.nearbyLocations)
- Modify: `src/infrastructure/systems/perception-system.ts:47` (drop type from locationInputs map)
- Modify: `src/infrastructure/engine/world-loader.ts:206-214` (drop type from projection)
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:117-131` (drop type from PerceivedLocation projection)
- Modify: every remaining fixture that still sets `type`, `production`, or `leisure`

Make `facility_type` required (not optional) now that all locations have it.

- [ ] **Step 1: Drop the fields from LocationSchema**

```typescript
// LocationSchema now contains only:
// id, name, position, color, region, fund, stock, capacity, facility_type, active_recipe
```

- [ ] **Step 2: Run tsc** — expect dozens of fixture failures. Fix them methodically.

- [ ] **Step 3: Remove the Phase 2 back-compat fallbacks** that read `loc.production?.<...>` in economy, subsidy, daily-report, debug-overlay, facility-system. These should now exclusively read the registries.

- [ ] **Step 4: Full test suite — green**

- [ ] **Step 5: Typecheck + lint**

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(meridian): drop type/production/leisure from LocationSchema"
```

---

**Chunk 5 review checkpoint. This is the largest and riskiest chunk. Manual recording verification gate recommended here before Chunk 6.**

Recording gate (from spec §Manual recording verification gate):
- Production economy runs (all 4 producers active under staffed conditions)
- Agents drink water items
- Services pay hourly wages while staffed
- Service facilities go abandoned when fund depletes
- Quest generation creates supply/restock quests with new recipe inputs

If the recording is green, proceed to Chunk 6. If not, fix before advancing.

---

## Chunk 6: Phase 4 — Area effect (Guard Post)

### Task 6.1: Add `pendingAreaModifiers` queue, register AreaEffectSystem, wire MoodSystem

**Files:**
- Modify: `src/infrastructure/entity/bt-working-memory.ts` (already added `pendingAreaModifiers` in Chunk 4 — verify it's there)
- Modify: `src/infrastructure/systems/mood-system.ts`
- Modify: tick pipeline (register AreaEffectSystem BEFORE MoodSystem)

- [ ] **Step 1: Write failing test for MoodSystem**

MoodSystem extended tests (from spec §Test Strategy):
- Area modifiers from queue are applied to mood
- Queue is drained after application
- Empty queue → no mood change from area effects

- [ ] **Step 2: Implement the MoodSystem extension**

Inside MoodSystem.execute, after existing mood computations:

```typescript
for (const mod of memory.pendingAreaModifiers) {
	if (mod.kind === 'mood') {
		moodState.mood += mod.delta;
	}
}
memory.pendingAreaModifiers = [];
```

- [ ] **Step 3: Register AreaEffectSystem in the tick pipeline** — insert before MoodSystem.

- [ ] **Step 4: Verify `lastPulseTick` init** — in `game-view.ts` populateScene, for facilities where `facilityType.kind === 'area_effect'`, initialize `FacilityComponent.state.lastPulseTick = deps.tickCount()`. If the facility is being restored from persisted state, skip the init.

- [ ] **Step 5: Write integration test**

- Spawn a Guard Post with a worker; spawn an agent inside the radius; tick forward past `ticks_per_pulse`; assert agent mood increased; assert queue was drained.

- [ ] **Step 6: Tests pass, full suite green**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(meridian): wire AreaEffectSystem + MoodSystem area modifier queue"
```

---

### Task 6.2: Update guard-post location file

**Files:**
- Modify: `locations/guard-post.json`

Already migrated in Chunk 3 to `facility_type: guard_post`. Verify the `fund: 0` (treasury-funded) and that no `active_recipe` is set.

- [ ] **Step 1: Verify** and adjust if needed.

- [ ] **Step 2: Run recording** — confirm agents near Guard Post get observable mood boost.

- [ ] **Step 3: Commit if any changes**

---

**Chunk 6 review checkpoint.**

---

## Chunk 7: Phase 5 + Phase 6 — Jobs expansion, hiring, docs, cleanup

### Task 7.1: Add 8 new jobs to `game-config.json`

**Files:**
- Modify: `configs/game-config.json` (or wherever `config.jobs.definitions` lives)

From spec §Worker Mechanics → New jobs table:

```json
{
  "blacksmith":       { "primary_attribute": "ST",  "skill": "smithing",    "base_wage": 4 },
  "water_carrier":    { "primary_attribute": "HT",  "skill": "hauling",     "base_wage": 2 },
  "innkeeper":        { "primary_attribute": "Chr", "skill": "hospitality", "base_wage": 1 },
  "bartender":        { "primary_attribute": "Chr", "skill": "hospitality", "base_wage": 2 },
  "bathhouse_keeper": { "primary_attribute": "Chr", "skill": "hospitality", "base_wage": 2 },
  "librarian":        { "primary_attribute": "IQ",  "skill": "knowledge",   "base_wage": 1 },
  "park_keeper":      { "primary_attribute": "HT",  "skill": "hospitality", "base_wage": 1 },
  "shopkeeper":       { "primary_attribute": "Chr", "skill": "trade",       "base_wage": 1 }
}
```

Match the actual schema shape used by `config.jobs.definitions` — inspect the file before editing.

- [ ] **Step 1: Read current config** to see the schema shape

- [ ] **Step 2: Add the 8 entries**

- [ ] **Step 3: Tests pass** (job-config schema validation may fail if schema is strict about attributes — add missing ones to the schema if needed)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meridian): add 8 new jobs (blacksmith, water_carrier, 6 service roles)"
```

---

### Task 7.2: Generalize `ClaimBestJob`

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-work.ts` (ClaimBestJob action)
- Modify: `tests/infrastructure/entity/bt-actions-work.test.ts`

The current `ClaimBestJob` iterates facilities via `loc.production`. Rewrite to iterate all locations where `facility_type.kind !== null` (all kinds) and `facility_type.primary_job` matches an agent-eligible job.

- [ ] **Step 1: Write failing tests**

- Agent with high Chr and no job → claims bathhouse (service facility) when no production facility nearby
- Agent with high ST → prefers Smithy over Farm

- [ ] **Step 2: Update the iteration body**

```typescript
const candidates = allLocations
	.filter(loc => facility.state.workerId === null)
	.filter(loc => {
		const ft = deps.getFacilityTypeRegistry().get(loc.facility_type);
		return ft !== undefined;
	})
	.filter(loc => facility.state.status !== 'abandoned')
	.filter(loc => {
		const ft = deps.getFacilityTypeRegistry().get(loc.facility_type)!;
		return canDoJob(agent, ft.primary_job);
	});
```

Scoring considers distance + `ft.default_wage` + match strength.

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(meridian): ClaimBestJob iterates all facility kinds"
```

---

### Task 7.3: Update GDD and arc42 docs

**Files:**
- Modify: `Project Meridian.md` (GDD — sections §5.4 and §6)
- Modify: `docs/2026-03-28-arc42-architecture.md` (§6.6)

- [ ] **Step 1: GDD §5.4 Recipe System**

Update to reflect: recipes are JSON (not markdown per initial GDD), live in `recipes/`, use `recipe-` prefix, one active recipe per facility in first pass. Document the deviation explicitly.

- [ ] **Step 2: GDD §6 Jobs & Production**

Document the three facility kinds (production / service / area_effect), hourly service wages, area-effect mood modifier, the 8 new jobs.

- [ ] **Step 3: arc42 §6.6**

Update BT action / condition lists — add `SeekWell`, `ChooseServiceFacility`, `SeekService`, `UseService`, `IsUsingService`. Remove `FillWaterskin`, `SeekWater`, `SeekRest`, `Rest`, `ChooseLeisure`, `SeekLeisureTarget`, `Leisure`, `IsAtLeisure`.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(meridian): update GDD §5.4/§6 and arc42 §6.6 for facility production redesign"
```

---

### Task 7.4: Final cleanup — remove back-compat fallbacks and unused config

**Files:**
- Modify: `src/infrastructure/systems/economy-system.ts`, `subsidy-system.ts`, `daily-report-system.ts`, `debug-overlay.ts`, `facility-system.ts` — remove any `?? loc.production?.<...>` fallback added during Phase 2
- Modify: `configs/game-config.json` — remove `economy.facility_start_fund` if unused after per-type fund wiring

- [ ] **Step 1: Grep for remaining `?? loc.production`** and `config.economy.facility_start_fund` references

- [ ] **Step 2: Delete them**

- [ ] **Step 3: Run full test suite + tsc + lint**

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(meridian): drop Phase 2 back-compat fallbacks and facility_start_fund"
```

---

### Task 7.5: Final recording session + success criteria validation

Run a fresh Obsidian recording session. Score against spec §Success Criteria:

| Metric | Target | Command |
|---|---|---|
| Equipment production | ≥5 items per 1000 ticks | Count `ProductionComplete` events with `outputItem === 'equipment'` |
| Bram work actions | ≥20 over 500 ticks | Count snapshots with `Bram.Action === 'work'` |
| Water in Market stock | shows `water×N` at least once | Grep `Market Stall.*water` |
| Drink uses water items | zero FillWaterskin emissions | Recent-events log |
| Guard Post impact | mood breakdown shows `area +2` factor | Snapshot mood factors |
| Facility stocks | all 4 producers non-zero | Grep Farmland, Workshop, Smithy, Well |
| Service visits | ServiceDelivered events emitted | Recent-events log |
| Test suite | 1570-1620 tests passing | `npx vitest run` |

- [ ] **Step 1: Record a ~500-tick session**
- [ ] **Step 2: Score each metric**
- [ ] **Step 3: Fix regressions** (expected: some, given the scope)
- [ ] **Step 4: Commit any fixes**

---

**Chunk 7 review checkpoint. Final verification.**

---

## Completion

After all chunks land and the final recording gate passes:

1. **Use `superpowers:finishing-a-development-branch`** to complete the branch.
2. Update `project_meridian_cycle_april_2026.md` memory with outcomes.
3. Archive any post-migration observation items (Bram blacksmith flip, service fund depletion tuning).

**Expected final state:**
- 7 new facility-type / recipe files under `recipes/` and `facility-types/`
- ~15 location files migrated
- ~20 source files modified per the incidental-sites table
- ~120 new tests, ~100-150 rewritten, ~15 deleted
- LeisureSystem, RestSystem, bt-actions-leisure, waterskin item — all gone
- Base.mdsl runs all three facility kinds through a unified Work + UseService pattern
