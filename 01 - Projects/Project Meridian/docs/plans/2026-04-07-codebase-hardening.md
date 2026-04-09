# Codebase Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate dead code, fix broken paths, extract shared utilities, split god files, migrate magic numbers, and close test coverage gaps so Project Meridian meets its own 80% coverage threshold and established architectural standards.

**Architecture:** Seven independent chunks. Chunk 1 (cleanup) unblocks nothing but reduces noise. Chunk 2 (dataRoot) is a standalone infra fix. Chunks 4-5 (bt-actions/conditions split) depend on Chunk 3 (shared utilities). Chunk 6 (magic numbers) depends on Chunks 4-5. Chunk 7 (test coverage) can run in parallel with any chunk. TDD throughout: write/update failing test, implement, verify green, commit.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, ExcaliburJS ECS components.

**Review source:** Codebase review findings from 2026-04-06 conversation.

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Lint:** `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Dead Code Removal & Quick Fixes

### Task 1: Remove orphaned mortality priority slot

**Files:**
- Modify: `src/domain/core/tick-scheduler.ts:45`

- [ ] **Step 1: Remove MORTALITY_CHECK from SystemPriority**

In `src/domain/core/tick-scheduler.ts`, delete line 45:
```typescript
MORTALITY_CHECK: 14.5,
```

- [ ] **Step 2: Grep for references**

Run: `cd "01 - Projects/Project Meridian" && grep -r "MORTALITY_CHECK" src/ tests/`
Expected: zero matches (no system uses this priority).

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts"
git commit -m "cleanup(meridian): remove orphaned MORTALITY_CHECK priority slot"
```

---

### Task 2: Remove dead MortalityConfigSchema

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts:162-167, 313, 319`

- [ ] **Step 1: Delete MortalityConfigSchema definition**

In `src/domain/schemas/game-config-schema.ts`, delete the `MortalityConfigSchema` block (approximately lines 162-167):
```typescript
const MortalityConfigSchema = z.object({
	starvation_collapse_ticks: z.number().int().default(50),
	starvation_death_ticks: z.number().int().default(100),
	despair_death_ticks: z.number().int().default(200),
	quest_danger_mortality_chance: z.number().min(0).max(1).default(0.1),
});
```

- [ ] **Step 2: Remove mortality_config from GameConfigSchema**

In the same file, find and delete the `mortality_config` line:
```typescript
mortality_config: withDefaults(MortalityConfigSchema),
```

Keep the `mortality: z.boolean().default(false)` toggle — it's a feature flag for future use.

- [ ] **Step 3: Grep for references**

Run: `cd "01 - Projects/Project Meridian" && grep -r "mortality_config\|MortalityConfig" src/ tests/`
Expected: zero matches after removal.

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all 1,273+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git commit -m "cleanup(meridian): remove dead MortalityConfigSchema — deferred indefinitely"
```

---

### Task 3: Replace console calls with logger in game-view.ts

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts:89, 343`

- [ ] **Step 1: Replace console.warn at line 89**

Find:
```typescript
console.warn('[Meridian] Game deps not ready — tick system not registered.');
```
Replace with:
```typescript
this.deps?.logger.warn('[Meridian] Game deps not ready — tick system not registered.');
```

If `this.deps` is not yet available at that point (check context), use a guard:
```typescript
if (this.deps) {
	this.deps.logger.warn('Game deps not ready — tick system not registered.');
}
```

- [ ] **Step 2: Replace console.error at line 343**

Find:
```typescript
console.error('[Meridian] Engine failed to initialize:', message);
```
Replace with:
```typescript
this.deps?.logger.error(`Engine failed to initialize: ${message}`);
```

Again, guard if deps may not exist at that point — this is an initialization error path, so fallback to console is acceptable if logger is not yet wired. In that case, keep the console.error but add a comment:
```typescript
// Logger not available during init failure — console is intentional here
console.error('[Meridian] Engine failed to initialize:', message);
```

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/infrastructure/engine/game-view.ts --config configs/eslint.config.mjs`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "fix(meridian): replace console calls with injected logger in game-view"
```

---

## Chunk 2: DataRoot Path Fix

### Task 4: Add dataRoot to GameCoreDeps

**Files:**
- Modify: `src/domain/core/game-deps.ts`
- Modify: `src/infrastructure/engine/game-view.ts` (initialization)
- Test: existing tests that construct GameCoreDeps (update mocks)

- [ ] **Step 1: Add dataRoot to GameCoreDeps interface**

In `src/domain/core/game-deps.ts`, add after the `writeFile` property:
```typescript
dataRoot: string;
```

Note: NOT `readonly` — `dataRoot` is detected inside `initializeWorld()` (game-view.ts line 111-113) which runs after `GameCoreDeps` is constructed in `plugin.ts`. The field must be mutable so it can be assigned post-construction.

- [ ] **Step 2: Add placeholder in plugin.ts deps construction**

In `src/plugin.ts`, where `GameCoreDeps` is constructed (around lines 144-152), add a placeholder:
```typescript
dataRoot: '',
```

- [ ] **Step 3: Run typecheck to find all construction sites**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -40`
Expected: errors everywhere GameCoreDeps is constructed without `dataRoot`.

- [ ] **Step 4: Assign dataRoot inside initializeWorld**

In `src/infrastructure/engine/game-view.ts`, after the `dataRoot` detection (line 113), assign it to deps:
```typescript
deps.dataRoot = dataRoot;
```

This must happen before any system registration calls that use `deps.dataRoot`.

- [ ] **Step 5: Fix all test mocks**

Search for test files that create GameCoreDeps mocks and add `dataRoot: '01 - Projects/Project Meridian'` (or `'test-root'`) to each. Common locations:
- `tests/helpers/` — shared test factory
- `tests/infrastructure/systems/` — individual system tests
- `tests/integration/` — integration test fixtures

Run: `cd "01 - Projects/Project Meridian" && grep -rn "eventBus.*config.*logger\|GameCoreDeps\|tickCount.*writeFile" tests/ --include="*.ts" | head -30`

For each match, add `dataRoot: 'test-data'` to the deps object.

- [ ] **Step 6: Run typecheck and full tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/game-deps.ts" "01 - Projects/Project Meridian/src/plugin.ts" "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): add dataRoot to GameCoreDeps for dynamic path resolution"
```

---

### Task 5: Parameterize daily-report-system paths

**Files:**
- Modify: `src/infrastructure/systems/daily-report-system.ts:197`
- Test: `tests/infrastructure/systems/daily-report-system.test.ts`

- [ ] **Step 1: Write failing test**

In the existing test file, add a test that verifies the written path uses `deps.dataRoot`:
```typescript
it('writes report to dataRoot-relative path', async () => {
	const deps = makeDeps({ dataRoot: 'my-root' });
	// ... trigger daily report ...
	expect(writtenPath).toContain('my-root/Economy/');
});
```

Adapt to the existing test setup — the key assertion is that the path prefix comes from `deps.dataRoot`, not a hardcoded `03 - Resources`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/daily-report-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — path still contains `03 - Resources`.

- [ ] **Step 3: Fix the hardcoded path**

In `src/infrastructure/systems/daily-report-system.ts`, line 197, change:
```typescript
const path = `03 - Resources/Economy/day-${dayStr}.md`;
```
to:
```typescript
const path = `${deps.dataRoot}/Economy/day-${dayStr}.md`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/daily-report-system.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/daily-report-system.ts"
git add "01 - Projects/Project Meridian/tests/infrastructure/systems/daily-report-system.test.ts"
git commit -m "fix(meridian): use dataRoot for daily report paths instead of hardcoded 03 - Resources"
```

---

### Task 6: Parameterize relationship-checkpoint-system paths

**Files:**
- Modify: `src/infrastructure/systems/relationship-checkpoint-system.ts:11, 91`
- Test: `tests/infrastructure/systems/relationship-checkpoint-system.test.ts`

- [ ] **Step 1: Write failing test**

Add a test verifying that canvas export paths use `deps.dataRoot`:
```typescript
it('writes relationship canvas to dataRoot-relative path', () => {
	const deps = makeDeps({ dataRoot: 'my-root' });
	// ... trigger checkpoint ...
	expect(writtenPath).toContain('my-root/Graphs/');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/relationship-checkpoint-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Replace hardcoded paths**

In `src/infrastructure/systems/relationship-checkpoint-system.ts`:

Line 11 — change the constant to a function or compute in execute:
```typescript
// DELETE: const GRAPH_PATH = '03 - Resources/Graphs/relationships.canvas';
```

In the `execute()` function body, compute paths dynamically:
```typescript
const graphPath = `${deps.dataRoot}/Graphs/relationships.canvas`;
```

Line 91 — change:
```typescript
const viewPath = `${deps.dataRoot}/Graphs/${agent.agentName}-relationships.canvas`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/relationship-checkpoint-system.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/relationship-checkpoint-system.ts"
git add "01 - Projects/Project Meridian/tests/infrastructure/systems/relationship-checkpoint-system.test.ts"
git commit -m "fix(meridian): use dataRoot for relationship canvas paths"
```

---

## Chunk 3: Shared Utilities

### Task 7: Extract findNearest utility

**Files:**
- Create: `src/domain/core/array-utils.ts`
- Create: `tests/domain/core/array-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/core/array-utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { findNearest } from '../../../src/domain/core/array-utils.js';

describe('findNearest', () => {
	it('returns null for empty array', () => {
		expect(findNearest([])).toBeNull();
	});

	it('returns the only item', () => {
		const items = [{ id: 'a', distance: 5 }];
		expect(findNearest(items)).toEqual({ id: 'a', distance: 5 });
	});

	it('returns closest of multiple items', () => {
		const items = [
			{ id: 'far', distance: 100 },
			{ id: 'near', distance: 3 },
			{ id: 'mid', distance: 50 },
		];
		expect(findNearest(items)?.id).toBe('near');
	});

	it('preserves all properties on returned item', () => {
		const items = [{ id: 'a', distance: 1, extra: 'data' }];
		expect(findNearest(items)).toEqual({ id: 'a', distance: 1, extra: 'data' });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/array-utils.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement findNearest**

Create `src/domain/core/array-utils.ts`:
```typescript
export function findNearest<T extends { distance: number }>(items: T[]): T | null {
	if (items.length === 0) return null;
	return items.reduce((min, item) => item.distance < min.distance ? item : min);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/array-utils.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/array-utils.ts"
git add "01 - Projects/Project Meridian/tests/domain/core/array-utils.test.ts"
git commit -m "feat(meridian): add findNearest utility for distance-based selection"
```

---

### Task 8: Extract updateItemInInventory utility

**Files:**
- Modify: `src/domain/core/array-utils.ts`
- Modify: `tests/domain/core/array-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/domain/core/array-utils.test.ts`:
```typescript
import { findNearest, updateItemInInventory } from '../../../src/domain/core/array-utils.js';

describe('updateItemInInventory', () => {
	const items = [
		{ item_id: 'bread', quantity: 3, charges: undefined },
		{ item_id: 'sword', quantity: 1, charges: 5 },
	];

	it('updates matching item without mutating original', () => {
		const result = updateItemInInventory(items, 'bread', { quantity: 10 });
		expect(result.find(i => i.item_id === 'bread')?.quantity).toBe(10);
		expect(items[0].quantity).toBe(3); // original unchanged
	});

	it('leaves non-matching items unchanged', () => {
		const result = updateItemInInventory(items, 'bread', { quantity: 10 });
		expect(result.find(i => i.item_id === 'sword')).toEqual({ item_id: 'sword', quantity: 1, charges: 5 });
	});

	it('returns copy when no item matches', () => {
		const result = updateItemInInventory(items, 'potion', { quantity: 1 });
		expect(result).toEqual(items);
		expect(result).not.toBe(items);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/array-utils.test.ts --config configs/vitest.config.ts`
Expected: FAIL — function not exported.

- [ ] **Step 3: Implement updateItemInInventory**

Add to `src/domain/core/array-utils.ts`:
```typescript
interface InventoryItem {
	item_id: string;
	[key: string]: unknown;
}

export function updateItemInInventory<T extends InventoryItem>(
	items: T[],
	itemId: string,
	updates: Partial<T>,
): T[] {
	return items.map(i => i.item_id === itemId ? { ...i, ...updates } : { ...i });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/array-utils.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/array-utils.ts"
git add "01 - Projects/Project Meridian/tests/domain/core/array-utils.test.ts"
git commit -m "feat(meridian): add updateItemInInventory utility for immutable item updates"
```

---

## Chunk 4: Split bt-actions.ts

The 1,004-line `bt-actions.ts` is split into 7 domain-focused modules plus a slim barrel. The existing `createActions()` function signature is preserved — callers are unaffected.

### File Map

| New File | Actions | ~Lines |
|----------|---------|--------|
| `bt-action-helpers.ts` | beginAction, SUCCEEDED/FAILED/RUNNING, shared types | ~50 |
| `bt-actions-needs.ts` | Eat, Drink, Harvest, Rest, SeekWater, FillWaterskin, SeekFood, SeekRest, SeekBestFoodSource | ~220 |
| `bt-actions-work.ts` | ClaimJob, ClaimBestJob, SeekJobFacility, ReleaseJob, SwitchJob, Work, SeekWork | ~290 |
| `bt-actions-economy.ts` | SellAtMarket, Buy, BuyItem, SeekMarket | ~110 |
| `bt-actions-social.ts` | Talk, SeekSocial | ~50 |
| `bt-actions-cargo.ts` | PickupCargo, DeliverCargo, SeekDeliveryTarget, SeekSupplySource | ~110 |
| `bt-actions-quest.ts` | ClaimQuest, SeekQuestFacility, WorkRepair, CompleteQuest, AbandonQuest | ~200 |
| `bt-actions-leisure.ts` | ChooseLeisure, SeekLeisureTarget, Leisure, Idle, Wander | ~120 |
| `bt-actions.ts` (barrel) | createActions() merges all groups + ContinueCommitment, tickUnemployment, recordPriceObservation | ~80 |

### Task 9: Create bt-action-helpers.ts

**Files:**
- Create: `src/infrastructure/entity/bt-action-helpers.ts`

- [ ] **Step 1: Extract shared constants and beginAction**

Create `src/infrastructure/entity/bt-action-helpers.ts` with:
- The `SUCCEEDED`, `FAILED`, `RUNNING` constants
- The `beginAction()` function
- Re-export of the `ActionResult` type
- The `ActionContext` interface bundling the common parameters (actor, deps, memory, resolvers, commitmentMultiplier)

```typescript
import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { ActionResult, PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export const SUCCEEDED: ActionResult = 'mistreevous.succeeded';
export const FAILED: ActionResult = 'mistreevous.failed';
export const RUNNING: ActionResult = 'mistreevous.running';

/** Shared context for action sub-modules. */
export interface ActionContext {
	memory: WorkingMemory;
	actor: AgentActor;
	deps: BehaviorAgentDeps;
	resolveNearbyFacilities: () => PerceivedFacility[];
	resolveNearbyAgents: () => PerceivedAgent[];
	resolveNearbyLocations: () => PerceivedLocation[];
	commitmentMultiplier: number;
}

/**
 * Extended context for condition sub-modules.
 * Conditions need additional location/time data that actions don't.
 */
export interface ConditionContext extends ActionContext {
	getAtLocationData: () => WorldLocation | undefined;
	wakeOffset: number;
	personalSleepOffset: number;
}

export function beginAction(ctx: ActionContext, actionName: string): void {
	// Move the beginAction body from bt-actions.ts lines 76-91 here
	// Exact copy of the existing logic
}
```

**IMPORTANT:** The `ActionContext` field order is `memory, actor, deps` — matching the existing `createActions(memory, actor, deps, ...)` parameter order in bt-actions.ts. The `ConditionContext` extends `ActionContext` with the three extra params that `createConditions` receives: `getAtLocationData`, `wakeOffset`, `personalSleepOffset`.

Adapt the exact body from the current `beginAction` in `bt-actions.ts` (lines 76-91), replacing closure variables with `ctx.*` references.

- [ ] **Step 2: Verify typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean (new file, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-action-helpers.ts"
git commit -m "refactor(meridian): extract bt-action-helpers with shared constants and ActionContext"
```

---

### Task 10: Extract bt-actions-needs.ts

**Files:**
- Create: `src/infrastructure/entity/bt-actions-needs.ts`

- [ ] **Step 1: Create needs action module**

Move actions Eat, Drink, Harvest, Rest, SeekWater, FillWaterskin, SeekFood, SeekRest, SeekBestFoodSource from `bt-actions.ts` into a new `bt-actions-needs.ts` that exports a factory function:

```typescript
import { type ActionContext, SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { findFoodInInventory, FOOD_ITEMS } from '../../domain/systems/food-items.js';
import { isPriceStale } from '../../domain/systems/price-memory.js';
import { findNearest } from '../../domain/core/array-utils.js';

export function createNeedsActions(ctx: ActionContext) {
	const { actor, deps, memory } = ctx;
	const { config, eventBus } = deps;

	return {
		Eat(): ActionResult { /* move Eat body */ },
		Drink(): ActionResult { /* move Drink body */ },
		Harvest(): ActionResult { /* move Harvest body (lines 120-147) */ },
		Rest(): ActionResult { /* move Rest body */ },
		SeekWater(): ActionResult { /* move SeekWater body */ },
		FillWaterskin(): ActionResult { /* move FillWaterskin body */ },
		SeekFood(): ActionResult { /* move SeekFood body */ },
		SeekRest(): ActionResult { /* move SeekRest body */ },
		SeekBestFoodSource(): ActionResult { /* move SeekBestFoodSource body */ },
	};
}
```

Replace inline `reduce((a, b) => a.distance < b.distance ? a : b)` calls with `findNearest()`.

- [ ] **Step 2: Verify typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-needs.ts"
git commit -m "refactor(meridian): extract needs actions to bt-actions-needs.ts"
```

---

### Task 11: Extract remaining action modules

**Files:**
- Create: `src/infrastructure/entity/bt-actions-work.ts`
- Create: `src/infrastructure/entity/bt-actions-economy.ts`
- Create: `src/infrastructure/entity/bt-actions-social.ts`
- Create: `src/infrastructure/entity/bt-actions-cargo.ts`
- Create: `src/infrastructure/entity/bt-actions-quest.ts`
- Create: `src/infrastructure/entity/bt-actions-leisure.ts`

- [ ] **Step 1: Create bt-actions-work.ts**

Move: ClaimJob, ClaimBestJob, SeekJobFacility, ReleaseJob, SwitchJob, Work, SeekWork.
Each file follows the same factory pattern as `createNeedsActions` — receives `ActionContext`, returns action methods object.

- [ ] **Step 2: Create bt-actions-economy.ts**

Move: SellAtMarket, Buy, BuyItem, SeekMarket.
Keep the inline stock manipulation as-is (consistent with the original). Do NOT import `updateStock` from facility-system — adding cross-system infrastructure imports should be a separate, intentional decision.

- [ ] **Step 3: Create bt-actions-social.ts**

Move: Talk, SeekSocial.

- [ ] **Step 4: Create bt-actions-cargo.ts**

Move: PickupCargo, DeliverCargo, SeekDeliveryTarget, SeekSupplySource.

- [ ] **Step 5: Create bt-actions-quest.ts**

Move: ClaimQuest, SeekQuestFacility, WorkRepair, CompleteQuest, AbandonQuest.

- [ ] **Step 6: Create bt-actions-leisure.ts**

Move: ChooseLeisure, SeekLeisureTarget, Leisure, Idle, Wander.
Replace hardcoded `dist / 100` with config-driven distance penalty (see Chunk 5, Task 15).

- [ ] **Step 7: Verify typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-work.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-economy.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-social.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-cargo.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-quest.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-leisure.ts"
git commit -m "refactor(meridian): extract work, economy, social, cargo, quest, leisure actions"
```

---

### Task 12: Rewire bt-actions.ts as barrel

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts`

- [ ] **Step 1: Replace bt-actions.ts with barrel**

Replace the entire contents of `bt-actions.ts` with a slim barrel that imports from all sub-modules and composes the `createActions()` return:

```typescript
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING } from './bt-action-helpers.js';
import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import { createNeedsActions } from './bt-actions-needs.js';
import { createWorkActions } from './bt-actions-work.js';
import { createEconomyActions } from './bt-actions-economy.js';
import { createSocialActions } from './bt-actions-social.js';
import { createCargoActions } from './bt-actions-cargo.js';
import { createQuestActions } from './bt-actions-quest.js';
import { createLeisureActions } from './bt-actions-leisure.js';
// ... keep ContinueCommitment, tickUnemployment, recordPriceObservation inline
// (they cross-cut multiple domains — small enough to stay here)

// IMPORTANT: parameter order is memory, actor, deps — matches existing call site in behavior-agent-factory.ts
export function createActions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
	resolveNearbyAgents: () => PerceivedAgent[],
	resolveNearbyLocations: () => PerceivedLocation[],
	commitmentMultiplier = 1.0,
) {
	const ctx: ActionContext = {
		memory, actor, deps,
		resolveNearbyFacilities, resolveNearbyAgents, resolveNearbyLocations,
		commitmentMultiplier,
	};

	return {
		...createNeedsActions(ctx),
		...createWorkActions(ctx),
		...createEconomyActions(ctx),
		...createSocialActions(ctx),
		...createCargoActions(ctx),
		...createQuestActions(ctx),
		...createLeisureActions(ctx),
		ContinueCommitment(): ActionResult { /* keep inline — ~30 lines */ },
		tickUnemployment(): void { /* keep inline — ~7 lines */ },
		recordPriceObservation(itemId: string, price: number, facilityId: string): void { /* keep inline — ~3 lines */ },
	};
}
```

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass — the public API (`createActions`) is unchanged.

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/infrastructure/entity/ --config configs/eslint.config.mjs`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/"
git commit -m "refactor(meridian): rewire bt-actions.ts as barrel — 1004 lines → ~80"
```

---

## Chunk 5: Split bt-conditions.ts

Same approach as bt-actions: domain-focused modules, slim barrel, unchanged public API.

### File Map

| New File | Conditions | ~Lines |
|----------|-----------|--------|
| `bt-conditions-survival.ts` | IsHungry, IsThirsty, IsExhausted, IsRecovering, IsLonely, NeedsCritical, NeedsTools, NeedsEquipment | ~60 |
| `bt-conditions-work.ts` | HasJob, HasNoJob, AtJobFacility, OpenFacilityNearby, OpenProductionFacilityNearby, BetterPayAvailable, IsCommitted | ~90 |
| `bt-conditions-economy.ts` | HasGold, HasFood, HasFoodReserve, HasWater, HasTradeGoods, CanAffordFood, CanAffordItem, KnowsFoodSource, FacilityHasStock, KnowsSupplyRoute, HasCargo, CargoDestinationNearby, FacilityNeedsSupply | ~140 |
| `bt-conditions-context.ts` | NearAgent, NearAgentClose, AtLocation, NearLocation, IsAtLeisure, IsDaytime, IsNighttime, IsWorkHours, ShouldSleep, IsRestDay, IsMoodLow | ~70 |
| `bt-conditions-quest.ts` | HasQuest, QuestAvailable, QuestAtFacility, QuestCargoReady | ~50 |
| `bt-conditions.ts` (barrel) | createConditions() merges all groups | ~40 |

### Task 13: Create condition sub-modules

**Files:**
- Create: `src/infrastructure/entity/bt-conditions-survival.ts`
- Create: `src/infrastructure/entity/bt-conditions-work.ts`
- Create: `src/infrastructure/entity/bt-conditions-economy.ts`
- Create: `src/infrastructure/entity/bt-conditions-context.ts`
- Create: `src/infrastructure/entity/bt-conditions-quest.ts`

Each module follows the same factory pattern but uses `ConditionContext` (NOT `ActionContext`) because conditions need the extra `getAtLocationData`, `wakeOffset`, and `personalSleepOffset` fields:
```typescript
import type { ConditionContext } from './bt-action-helpers.js';
// domain-specific imports...

export function createSurvivalConditions(ctx: ConditionContext) {
	const { actor, deps, memory } = ctx;
	return {
		IsHungry(): boolean { /* move body */ },
		// ...
	};
}
```

- [ ] **Step 1: Create bt-conditions-survival.ts**

Move: IsHungry, IsThirsty, IsExhausted, IsRecovering, IsLonely, NeedsCritical, NeedsTools, NeedsEquipment.
These conditions only use `actor`, `deps.config`, and `memory.personalThresholds` — they don't need the extra `ConditionContext` fields, but accept it for interface consistency.

- [ ] **Step 2: Create bt-conditions-work.ts**

Move: HasJob, HasNoJob, AtJobFacility, OpenFacilityNearby, OpenProductionFacilityNearby, BetterPayAvailable, IsCommitted.

- [ ] **Step 3: Create bt-conditions-economy.ts**

Move: HasGold, HasFood, HasFoodReserve, HasWater, HasTradeGoods, CanAffordFood, CanAffordItem, KnowsFoodSource, FacilityHasStock, KnowsSupplyRoute, HasCargo, CargoDestinationNearby, FacilityNeedsSupply.

- [ ] **Step 4: Create bt-conditions-context.ts**

Move: NearAgent, NearAgentClose, AtLocation, NearLocation, IsAtLeisure, IsDaytime, IsNighttime, IsWorkHours, ShouldSleep, IsRestDay, IsMoodLow.
**NOTE:** This module uses `ctx.getAtLocationData`, `ctx.wakeOffset`, and `ctx.personalSleepOffset` — the extra fields from `ConditionContext`. Verify all three are accessed correctly from `ctx`.

- [ ] **Step 5: Create bt-conditions-quest.ts**

Move: HasQuest, QuestAvailable, QuestAtFacility, QuestCargoReady.

- [ ] **Step 6: Verify typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-survival.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-work.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-economy.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-context.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-quest.ts"
git commit -m "refactor(meridian): extract condition sub-modules by domain concern"
```

---

### Task 14: Rewire bt-conditions.ts as barrel

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions.ts`

- [ ] **Step 1: Replace bt-conditions.ts with barrel**

Same pattern as Task 12 but using `ConditionContext`. The barrel's `createConditions` must preserve the original parameter order: `(memory, actor, deps, resolveNearbyFacilities, resolveNearbyAgents, resolveNearbyLocations, getAtLocationData, wakeOffset, personalSleepOffset)`. Build a `ConditionContext` from these params and spread all `create*Conditions(ctx)` results.

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/infrastructure/entity/ --config configs/eslint.config.mjs`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/"
git commit -m "refactor(meridian): rewire bt-conditions.ts as barrel — 420 lines → ~40"
```

---

## Chunk 6: Magic Numbers Migration (depends on Chunks 4-5)

### Task 15: Move BT magic numbers to game-config or ranges.ts

**Files:**
- Modify: `src/domain/schemas/ranges.ts`
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Modify: action/condition modules created in Chunks 4-5

- [ ] **Step 1: Add constants to ranges.ts**

In `src/domain/schemas/ranges.ts`, add:
```typescript
export const PERSONAL_THRESHOLD_CAP = 90;
```

- [ ] **Step 2: Add configurable values to game-config-schema.ts**

In the appropriate config section, add:
```typescript
leisure_distance_divisor: z.number().default(100),
quest_repair_mood_impact: z.number().default(15),
quest_abandon_mood_impact: z.number().default(-10),
```

NOTE: Do NOT add `waterskin_max_charges` — this already exists as `config.items.waterskin.maxCharges` in the items record schema.

- [ ] **Step 3: Update behavior-agent-factory.ts**

Replace:
```typescript
const THRESHOLD_CAP = 90;
```
with:
```typescript
import { PERSONAL_THRESHOLD_CAP } from '../../domain/schemas/ranges.js';
// ... then use PERSONAL_THRESHOLD_CAP instead of THRESHOLD_CAP
```

- [ ] **Step 4: Update action modules to use config values**

In `bt-actions-needs.ts`, replace `const maxCharges = 3` with `const maxCharges = config.items['waterskin']?.maxCharges ?? 3;` (uses existing item registry, not a new config field).
In `bt-actions-leisure.ts`, replace `dist / 100` with `dist / config.leisure_distance_divisor`.
In `bt-actions-quest.ts`, replace `mood_impact: 15` and `mood_impact: -10` with config values.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass (defaults match previous hardcoded values).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/ranges.ts"
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/"
git commit -m "refactor(meridian): migrate magic numbers to ranges.ts and game-config"
```

---

## Chunk 7: Test Coverage

### Task 16: Add component class tests

**Files:**
- Modify: `tests/infrastructure/components/game-components.test.ts`

The existing test file already covers NeedsComponent, MoodComponent, MemoryComponent. Add the same pattern for the remaining 12 untested components.

- [ ] **Step 1: Add WalletComponent tests**

```typescript
describe('WalletComponent', () => {
	it('holds WalletState and is dirty on creation', () => {
		const comp = new WalletComponent({ gold: 100, ledger: [] });
		expect(comp.state.gold).toBe(100);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new WalletComponent({ gold: 100, ledger: [] });
		comp.clearDirty();
		comp.state.gold = 50;
		comp.markDirty();
		expect(comp.state.gold).toBe(50);
		expect(comp.dirty).toBe(true);
	});
});
```

- [ ] **Step 2: Add StaminaComponent tests**

Same pattern with `StaminaState`.

- [ ] **Step 3: Add AttributesComponent tests**

Include test for `getByName()` method:
```typescript
it('getByName returns attribute value', () => {
	const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
	expect(comp.getByName('ST')).toBe(12);
});

it('getByName returns 0 for unknown attribute', () => {
	const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
	expect(comp.getByName('LUCK')).toBe(0);
});
```

- [ ] **Step 4: Add remaining component tests**

Add test pairs (creation + mutation) for: PerceptionComponent, EconomyComponent, FacilityComponent, InventoryComponent, QuestBoardComponent, RelationshipComponent, SocialComponent, TimeComponent, TraitsComponent.

- [ ] **Step 5: Run coverage**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts --coverage`
Check that component coverage improved.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/infrastructure/components/game-components.test.ts"
git commit -m "test(meridian): add tests for all 15 untested ECS component classes"
```

---

### Task 17: Add trade-system.ts tests

**Files:**
- Create: `tests/infrastructure/systems/trade-system.test.ts`

This is the largest coverage gap — the entire infrastructure trade system has zero tests.

- [ ] **Step 1: Write core trade execution test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import createTradeSystem and required components/mocks
// Set up agent actors with NeedsComponent, WalletComponent, InventoryComponent, etc.

describe('TradeSystem', () => {
	// ... setup with mock agents, locations, facilities ...

	it('transfers gold from buyer to facility fund on successful buy', () => {
		// Set agent btAction to 'buy', buyTargetItem to 'bread'
		// Place agent near facility with bread in stock
		// Execute trade system
		// Assert: wallet decreased, facility fund increased, inventory has bread
	});

	it('fails trade when agent has insufficient gold', () => {
		// Agent wallet = 0, bread price = 5
		// Execute trade system
		// Assert: wallet unchanged, inventory unchanged
	});

	it('uses reservation pricing when demand data available', () => {
		// Set up facility with demand tracking
		// Assert: price uses calculateReservationPrice, not just base price
	});
});
```

- [ ] **Step 2: Write relationship update test**

```typescript
it('creates relationship entry between buyer and facility worker', () => {
	// Set up facility with workerId
	// Execute successful trade
	// Assert: buyer's RelationshipComponent has entry for worker
});
```

- [ ] **Step 3: Write event emission tests**

```typescript
it('emits GoldFlowed event on successful trade', () => {
	// Execute successful trade
	// Assert: eventBus received GoldFlowed with correct from/to/amount
});

it('emits Trade event with item and price details', () => {
	// Execute successful trade
	// Assert: eventBus received Trade event
});
```

- [ ] **Step 4: Write edge case tests**

```typescript
it('skips agents not in buy action', () => {
	// Agent btAction = 'work', not 'buy'
	// Assert: no trade occurs
});

it('falls back to food_price when no item registry entry', () => {
	// Buy item not in registry
	// Assert: uses config.economy.food_price
});
```

- [ ] **Step 5: Run coverage and verify improvement**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/trade-system.test.ts --config configs/vitest.config.ts --coverage`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/infrastructure/systems/trade-system.test.ts"
git commit -m "test(meridian): add trade-system tests — closes largest coverage gap"
```

---

### Task 18: Close economy and cargo branch gaps

**Files:**
- Modify: `tests/domain/systems/economy.test.ts`
- Modify: `tests/domain/systems/cargo.test.ts`

- [ ] **Step 1: Add missing economy branch tests**

In `tests/domain/systems/economy.test.ts`, add:
```typescript
it('falls back to 0 when demandRate is undefined', () => {
	const ctx = baseFacility({ demandRates: {} }); // key missing
	const prices = recalculateFacilityPrices(ctx);
	// Assert: no crash, uses ?? 0 fallback
});

it('returns empty object for empty items array', () => {
	const ctx = baseFacility({ items: [] });
	const prices = recalculateFacilityPrices(ctx);
	expect(prices).toEqual({});
});
```

- [ ] **Step 2: Add missing cargo branch tests**

In `tests/domain/systems/cargo.test.ts`, add:
```typescript
it('returns null when regions are disconnected', () => {
	// regionGraph with no path between source and destination
	const route = planSupplyRoute(knownLocs, facilityData, 'regionA', disconnectedGraph);
	expect(route).toBeNull();
});

it('skips facilities missing from facilityData', () => {
	// knownLocations includes an ID not in facilityData map
	const route = planSupplyRoute(['unknown-loc', 'bakery'], facilityData, 'town', regionGraph);
	// Assert: doesn't crash, skips the unknown location
});
```

- [ ] **Step 3: Run coverage check**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts --coverage`
Target: statements >= 80%, branches >= 70% (incremental improvement).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/domain/systems/economy.test.ts"
git add "01 - Projects/Project Meridian/tests/domain/systems/cargo.test.ts"
git commit -m "test(meridian): close economy and cargo branch coverage gaps"
```

---

### Task 19: Final coverage verification

- [ ] **Step 1: Run full test suite with coverage**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts --coverage`

- [ ] **Step 2: Verify all thresholds met**

Check output for:
- Statements >= 80%
- Lines >= 80%
- Functions >= 80%
- Branches: target improvement (64% → 70%+; full 80% may require additional test passes beyond this plan)

- [ ] **Step 3: Run lint and typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git commit -m "chore(meridian): codebase hardening complete — coverage and quality gates green"
```
