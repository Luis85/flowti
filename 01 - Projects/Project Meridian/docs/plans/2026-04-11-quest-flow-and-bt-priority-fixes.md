# Quest Flow & BT Priority Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 6 issues found in `recording-2026-04-11-1339.md` — critical-needs preemption for travel commitments, restock quest pickup-deliver flow, tools circulation to market, lockstep rest cycles, Bram wandering diagnostic, and end-to-end verification via a new recording.

**Architecture:** Five independent chunks that can be verified separately. Chunk 1 is the smallest high-impact fix (extends `ContinueCommitment`). Chunk 2 is the biggest (new quest actions + new BT branch + new memory slot). Chunks 3–5 are isolated and can run in any order after Chunks 1–2.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-11-quest-flow-and-bt-priority-fixes-design.md`

**Baseline recording:** `recording-2026-04-11-1339.md` (94 snapshots, ~11500 ticks)

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

**Lint:** `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`

**Build:** `cd "01 - Projects/Project Meridian" && npm run build`

---

## Chunk 1: Critical needs preempt travel commitments

**Fixes:** Issue 1 (critical needs ignored), partially Issue 5 (Bram wandering).

**Why first:** smallest change, highest immediate safety impact. Unblocks agents who get stuck in fatal commitments. Work and leisure commitments already break on personal thresholds — we just extend the same idea to travel commitments at critical thresholds.

### Task 1: Add a `shouldBreakForCriticalNeed` helper in `bt-actions.ts`

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts`

- [ ] **Step 1: Read the current `ContinueCommitment` implementation**

Read `src/infrastructure/entity/bt-actions.ts` lines 85–145. Note the existing break conditions for `work` / `leisure` / `eat` / `drink` / `rest` / `buy`. We are adding a parallel branch for travel commitments with **critical** thresholds (not personal ones).

- [ ] **Step 2: Add a pure helper at module scope**

Near the top of `bt-actions.ts` after the imports, add:

```typescript
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
```

(Check the import isn't duplicated — `bt-conditions-survival.ts` already imports it so the constant is in the ranges module.)

Then add a pure helper function at module scope (outside the `createActions` factory):

```typescript
/**
 * Returns true when an ongoing travel commitment should be interrupted because
 * one of the agent's needs has crossed the critical threshold. Used by
 * ContinueCommitment to break `seek_*` travel actions in emergencies.
 *
 * Non-travel commitments (work/leisure/eat/etc.) are handled by their own
 * break logic and do not go through this helper.
 */
function shouldBreakTravelForCriticalNeed(needs: {
	hunger: number;
	thirst: number;
	energy: number;
}): boolean {
	return (
		needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger
		|| needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst
		|| needs.energy < NEED_CRITICAL_THRESHOLDS.energy
	);
}
```

Note: this helper intentionally excludes `social` — social deprivation doesn't warrant breaking travel (social emergencies are handled by `IsSociallyCritical` elsewhere).

- [ ] **Step 3: Extend `ContinueCommitment` to use the helper for travel commitments**

Inside `ContinueCommitment()`, locate the existing break logic (around line 116–140). After the `work`/`leisure` block and before `memory.btAction = memory.committedAction`, add:

```typescript
// Break travel commitments when a critical need escalates. Travel is cheap
// to interrupt (a few ticks of progress at most) and blocking critical needs
// causes death spirals (see recording 2026-04-11-1339 — Bram with thirst=0).
if (
	ca === 'seek_food'
	|| ca === 'seek_water'
	|| ca === 'seek_rest'
	|| ca === 'seek_market'
	|| ca === 'seek_quest'
	|| ca === 'seek_delivery'
	|| ca === 'seek_supply'
	|| ca === 'seek_job_facility'
	|| ca === 'seek_leisure'
	|| ca === 'seek_social'
) {
	if (shouldBreakTravelForCriticalNeed(needs)) {
		memory.commitmentTicks = 0;
		memory.committedAction = null;
		return FAILED;
	}
}
```

**Note:** `seek_water` is intentionally included. If an agent is travelling to water because of thirst and then develops critical hunger, breaking still makes sense — the BT re-evaluation will likely re-select water seek anyway (thirst is still their most urgent need), but now it could pick `seek_food` if hunger has become more critical. Letting the BT re-decide every critical tick is the correct behavior.

- [ ] **Step 4: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

### Task 2: Test the new break logic

**Files:**
- Modify: `tests/infrastructure/entity/bt-actions.test.ts`

- [ ] **Step 1: Locate the existing `ContinueCommitment` tests**

Search `tests/infrastructure/entity/bt-actions.test.ts` for existing `ContinueCommitment` describe blocks. Add new test cases in the same file near the existing ones.

- [ ] **Step 2: Add test cases for travel-break logic**

```typescript
describe('ContinueCommitment — travel commitments break on critical needs', () => {
	it('breaks seek_rest when thirst crosses critical threshold', () => {
		const ctx = makeTestContext({
			committedAction: 'seek_rest',
			commitmentTicks: 8,
			needs: { hunger: 80, thirst: 10, energy: 80, social: 50 },
		});
		const result = ctx.actions.ContinueCommitment();
		expect(result).toBe('mistreevous.failed');
		expect(ctx.memory.commitmentTicks).toBe(0);
		expect(ctx.memory.committedAction).toBeNull();
	});

	it('breaks seek_food when energy crosses critical threshold', () => {
		const ctx = makeTestContext({
			committedAction: 'seek_food',
			commitmentTicks: 6,
			needs: { hunger: 20, thirst: 80, energy: 10, social: 50 },
		});
		expect(ctx.actions.ContinueCommitment()).toBe('mistreevous.failed');
	});

	it('does NOT break seek_rest for sub-critical thirst', () => {
		// Personal thirst threshold for test = 37, but thirst=30 is below personal but above critical 20.
		// Travel commitments only break on CRITICAL, not personal thresholds.
		const ctx = makeTestContext({
			committedAction: 'seek_rest',
			commitmentTicks: 8,
			needs: { hunger: 80, thirst: 30, energy: 80, social: 50 },
		});
		expect(ctx.actions.ContinueCommitment()).toBe('mistreevous.running');
		expect(ctx.memory.commitmentTicks).toBe(7); // decremented by 1
	});

	it('does NOT break work commitments based on critical thirst (work uses its own break logic)', () => {
		// Regression guard — work/leisure keep their existing PERSONAL threshold logic.
		const ctx = makeTestContext({
			committedAction: 'work',
			commitmentTicks: 20,
			needs: { hunger: 80, thirst: 10, energy: 80, social: 50 }, // critical thirst
		});
		// Work commitment break fires because thirst 10 < personal threshold (test uses 37)
		expect(ctx.actions.ContinueCommitment()).toBe('mistreevous.failed');
	});

	it('breaks all seek_* variants on critical hunger', () => {
		const variants = ['seek_food', 'seek_water', 'seek_rest', 'seek_market', 'seek_quest', 'seek_delivery', 'seek_supply', 'seek_job_facility', 'seek_leisure', 'seek_social'];
		for (const action of variants) {
			const ctx = makeTestContext({
				committedAction: action,
				commitmentTicks: 5,
				needs: { hunger: 10, thirst: 80, energy: 80, social: 50 },
			});
			expect(ctx.actions.ContinueCommitment()).toBe('mistreevous.failed');
		}
	});
});
```

**Note:** `makeTestContext` is the existing test helper — check the test file's existing setup and adapt the fixture shape to match. If the helper doesn't expose `committedAction` / `commitmentTicks` / `needs` directly, you may need to extend it.

- [ ] **Step 3: Run bt-actions tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: all new tests pass, all existing tests still pass.

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions.test.ts"
git commit -m "fix(meridian): break travel commitments on critical needs

Extends ContinueCommitment's break list to cover seek_* travel actions
when hunger/thirst/energy cross the CRITICAL threshold (not personal).
Previously, work/leisure commitments broke on personal thresholds but
seek_rest / seek_market / etc. had no break logic at all — leading to
Bram-with-thirst-0 death spirals in recording 2026-04-11-1339.

Travel commitments are cheap to interrupt (max ~15 ticks of progress)
so aggressive critical-threshold break is safe. Work/leisure keep their
existing personal-threshold break logic for proactive maintenance."
```

---

## Chunk 2: Restock quest pickup-deliver flow

**Fixes:** Issue 2 (restock death-lock).

**Why second:** Biggest change — adds new memory state, new actions, a new BT branch. Depends on Chunk 1 because without critical-break, the new quest flow would itself get stuck in commitments.

**Architecture:** Introduce a dedicated `questCargo` slot on the agent's working memory, separate from `haulCargo` (which belongs to the supply-chain system). Add `SeekQuestSource` + `PickupForQuest` actions. Modify `CompleteQuest` + `QuestCargoReady` to understand quest cargo. Wire the new branch into `base.mdsl`.

### Task 3: Extend working memory with a `questCargo` slot

**Files:**
- Modify: `src/infrastructure/entity/bt-working-memory.ts`
- Modify: `src/domain/systems/behavior-agent.ts` (interface, if exposed)
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts` (getter/setter)

- [ ] **Step 1: Read `bt-working-memory.ts` to understand the current shape**

Read `src/infrastructure/entity/bt-working-memory.ts`. Locate the `WorkingMemory` interface and the `createWorkingMemory` factory. Note how `haulCargo` is declared and initialized.

- [ ] **Step 2: Add `questCargo` field alongside `haulCargo`**

In the `WorkingMemory` interface:

```typescript
/**
 * Item the agent is physically carrying for a claimed quest, separate from
 * supply-chain haulCargo. Set by PickupForQuest, consumed by CompleteQuest.
 * Null when the agent is not carrying anything for a quest.
 */
questCargo: { itemId: string; quantity: number; questId: string } | null;
```

In the `createWorkingMemory` factory's default values, add:

```typescript
questCargo: null,
```

- [ ] **Step 3: Expose `questCargo` on the `BehaviorAgent` domain interface**

Read `src/domain/systems/behavior-agent.ts` around line 77 (where `haulCargo` is declared). Add a parallel field:

```typescript
questCargo: { itemId: string; quantity: number; questId: string } | null;
```

- [ ] **Step 4: Add getter/setter in `behavior-agent-factory.ts`**

Read `src/infrastructure/entity/behavior-agent-factory.ts` around line 222 (where `activeQuest` getter/setter are). Add:

```typescript
get questCargo() { return memory.questCargo; },
set questCargo(v) { memory.questCargo = v; },
```

- [ ] **Step 5: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean. If any test fixtures in `tests/` fail because they spread `WorkingMemory` without `questCargo`, update the relevant fixtures.

- [ ] **Step 6: Run existing tests to catch any fixture mismatches**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: pass. If failures mention `questCargo`, update the offending fixture to include `questCargo: null`.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-working-memory.ts" "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): add questCargo working memory slot

Dedicated slot for items an agent is carrying as part of a claimed quest,
separate from the supply-chain haulCargo slot. Next commit will populate
it via a new PickupForQuest action."
```

### Task 4: Add `SeekQuestSource` and `PickupForQuest` actions

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-quest.ts`
- Modify: `src/infrastructure/entity/bt-actions.ts` (register the new actions in the union/factory)

- [ ] **Step 1: Read the existing quest actions to understand the pattern**

Read `src/infrastructure/entity/bt-actions-quest.ts` (the whole file is short). Note how `ClaimQuest`, `SeekQuestFacility`, `CompleteQuest` are structured. The pattern is: factory receives `ActionContext`, returns an object with quest action methods.

- [ ] **Step 2: Add `SeekQuestSource` and `PickupForQuest` to the returned factory**

Replace the return signature of `createQuestActions` to include the new actions:

```typescript
export function createQuestActions(ctx: ActionContext): Pick<ActionMethods,
	'ClaimQuest' | 'SeekQuestFacility' | 'SeekQuestSource' | 'PickupForQuest'
	| 'WorkRepair' | 'CompleteQuest' | 'AbandonQuest'> {
```

Then add the two new actions inside the returned object. Insert them between `SeekQuestFacility` and `WorkRepair`:

```typescript
SeekQuestSource(): ActionResult {
	// Find the nearest known location whose production output matches the
	// quest's itemId, and move toward it. Used for supply/restock quests
	// where the agent needs to physically collect the item before delivery.
	const quest = memory.activeQuest;
	if (quest === null) return FAILED;
	if (quest.type === 'repair') return FAILED;
	if (quest.itemId === null) return FAILED;

	const knownLocations = new Set(memory.knownLocations);
	const allLocations = deps.getLocations?.() ?? [];
	const candidates = allLocations.filter(l =>
		knownLocations.has(l.id)
		&& l.id !== quest.facilityId
		&& l.production !== null
		&& l.production?.output.item_id === quest.itemId,
	);
	if (candidates.length === 0) return FAILED;

	// Prefer the closest candidate by Euclidean distance from current position
	const agentPos = { x: actor.pos.x, y: actor.pos.y };
	let best = candidates[0]!;
	let bestDist = dist(agentPos, best.position);
	for (const c of candidates) {
		const d = dist(agentPos, c.position);
		if (d < bestDist) { best = c; bestDist = d; }
	}

	beginAction(ctx, 'seek_quest_source');
	memory.movementTarget = { id: best.id, type: 'location' };
	if (memory.atLocation === best.id) return SUCCEEDED;
	return RUNNING;
},

PickupForQuest(): ActionResult {
	// Pick up one unit of the quest's required item from the current facility's
	// output stock. Writes to memory.questCargo. Does not touch the agent's
	// personal inventory.
	const quest = memory.activeQuest;
	if (quest === null) return FAILED;
	if (quest.type === 'repair') return FAILED;
	if (quest.itemId === null) return FAILED;
	if (memory.atLocation === null) return FAILED;

	const locActors = deps.getLocationActors();
	const facActor = locActors.get(memory.atLocation);
	if (facActor === undefined) return FAILED;
	if (!facActor.has(FacilityComponent)) return FAILED;

	const fac = facActor.get(FacilityComponent);
	const stockItem = fac.state.stock.find(s => s.item_id === quest.itemId);
	if (stockItem === undefined || stockItem.quantity < quest.quantity) return FAILED;

	// Transfer quantity from facility stock to questCargo
	const newStock = fac.state.stock
		.map(s => s.item_id === quest.itemId
			? { ...s, quantity: s.quantity - quest.quantity }
			: { ...s })
		.filter(s => s.quantity > 0);
	fac.state = { ...fac.state, stock: newStock };
	fac.markDirty();

	memory.questCargo = {
		itemId: quest.itemId,
		quantity: quest.quantity,
		questId: quest.id,
	};

	beginAction(ctx, 'pickup_quest_item');
	return SUCCEEDED;
},
```

Add imports at the top of the file:

```typescript
import { FacilityComponent } from '../components/facility-component.js';
```

(Check it isn't already imported — `CompleteQuest` already uses it.)

And add a small helper at the bottom of the file (or import from an existing math utility if one exists):

```typescript
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}
```

**Note on `deps.getLocations`:** verify that `ActionContext.deps` exposes `getLocations`. If it only exposes `resolveNearbyLocations`, use that instead — nearby locations are fine for finding a source, and it's already how `QuestAvailable` in `bt-conditions-quest.ts` works.

- [ ] **Step 2.5: Check `deps.getLocations` or fall back to `resolveNearbyLocations`**

Read `src/infrastructure/entity/behavior-agent-factory.ts:deps` to see what's available on `BehaviorAgentDeps`. If `getLocations` isn't there, use `ctx.resolveNearbyLocations()` which returns `PerceivedLocation[]` — adapt the code to use the perceived structure (check for `position` field — if it's `distance` instead, sort by distance directly).

- [ ] **Step 3: Register the new actions in the methods union**

Read `src/infrastructure/entity/bt-actions.ts` where `ActionMethods` is defined (look for `'ClaimQuest' | 'SeekQuestFacility' | ...`). Add `SeekQuestSource` and `PickupForQuest` to the union type.

Also check `src/domain/systems/behavior-agent.ts:ActionMethods` if it exists as a domain-level interface — it likely has method signatures that need to be added:

```typescript
SeekQuestSource(): ActionResult;
PickupForQuest(): ActionResult;
```

- [ ] **Step 4: Add commitment_ticks entries for the new actions**

Edit `configs/game-config.json`, inside the `commitment_ticks` block, add:

```json
"seek_quest_source": 10,
"pickup_quest_item": 0,
```

(No commitment for the pickup itself — it's a one-tick transfer.)

- [ ] **Step 5: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-quest.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts" "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "feat(meridian): add SeekQuestSource + PickupForQuest actions

Lets an agent with an active supply/restock quest physically pick up
the required item from a source facility's output stock and carry it
separately in memory.questCargo. Prevents restock quests from being
death-locked because the agent doesn't have the item in personal inventory.

Source is chosen as the nearest known facility whose production output
matches the quest's itemId. PickupForQuest transfers one 'quantity' unit
from facility stock to questCargo (does not touch personal inventory)."
```

### Task 5: Wire quest cargo into `CompleteQuest` and `QuestCargoReady`

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-quest.ts` — `CompleteQuest`
- Modify: `src/infrastructure/entity/bt-conditions-quest.ts` — `QuestCargoReady`

- [ ] **Step 1: Update `QuestCargoReady`**

Replace the existing `QuestCargoReady` in `bt-conditions-quest.ts`:

```typescript
QuestCargoReady(): boolean {
	if (memory.activeQuest === null) return false;
	if (memory.activeQuest.type === 'repair') return true;
	if (memory.activeQuest.itemId === null) return false;

	// Prefer questCargo — purpose-built for quest delivery
	if (memory.questCargo !== null
		&& memory.questCargo.questId === memory.activeQuest.id
		&& memory.questCargo.itemId === memory.activeQuest.itemId
		&& memory.questCargo.quantity >= memory.activeQuest.quantity) {
		return true;
	}

	// Fall back to personal inventory for supply quests where the agent
	// may have bought the item for themselves
	const inv = actor.get(InventoryComponent).state.items;
	const item = inv.find(i => i.item_id === memory.activeQuest!.itemId);
	return item !== undefined && item.quantity >= memory.activeQuest.quantity;
},
```

- [ ] **Step 2: Update `CompleteQuest` to prefer questCargo**

In `bt-actions-quest.ts`, inside `CompleteQuest`, find the `supply` / `restock` branch (around lines 66–95). Replace the inventory-drain section with:

```typescript
if (quest.type === 'supply' || quest.type === 'restock') {
	if (quest.itemId === null) return FAILED;

	// Prefer questCargo — the agent specifically picked this up for the quest
	const cargo = memory.questCargo;
	if (cargo !== null
		&& cargo.questId === quest.id
		&& cargo.itemId === quest.itemId
		&& cargo.quantity >= quest.quantity) {
		// Transfer from cargo to facility
		const locActors = getLocationActors();
		const facActor = locActors.get(quest.facilityId);
		if (facActor !== undefined) {
			const fac = facActor.get(FacilityComponent);
			const hasItem = fac.state.stock.some(s => s.item_id === quest.itemId);
			const newStock = hasItem
				? fac.state.stock.map(s => s.item_id === quest.itemId ? { ...s, quantity: s.quantity + quest.quantity } : { ...s })
				: [...fac.state.stock.map(s => ({ ...s })), { item_id: quest.itemId, quantity: quest.quantity }];
			fac.state = { ...fac.state, stock: newStock };
			fac.markDirty();
		}
		memory.questCargo = null;
	} else {
		// Fall back to personal inventory — supply quests where the agent already had the item
		const inv = actor.get(InventoryComponent);
		const item = inv.state.items.find(i => i.item_id === quest.itemId);
		if (item === undefined || item.quantity < quest.quantity) return FAILED;
		const newItems = inv.state.items
			.map(i => {
				if (i.item_id !== quest.itemId) return { ...i };
				const newQty = i.quantity - quest.quantity;
				return newQty > 0 ? { ...i, quantity: newQty } : null;
			})
			.filter((i): i is NonNullable<typeof i> => i !== null);
		inv.state = { ...inv.state, items: newItems };
		inv.markDirty();

		const locActors = getLocationActors();
		const facActor = locActors.get(quest.facilityId);
		if (facActor !== undefined) {
			const fac = facActor.get(FacilityComponent);
			const hasItem = fac.state.stock.some(s => s.item_id === quest.itemId);
			const newStock = hasItem
				? fac.state.stock.map(s => s.item_id === quest.itemId ? { ...s, quantity: s.quantity + quest.quantity } : { ...s })
				: [...fac.state.stock.map(s => ({ ...s })), { item_id: quest.itemId, quantity: quest.quantity }];
			fac.state = { ...fac.state, stock: newStock };
			fac.markDirty();
		}
	}
}
```

- [ ] **Step 3: Clear `questCargo` in `AbandonQuest`**

In `AbandonQuest`, before `memory.activeQuest = null`, add:

```typescript
// If the agent was carrying quest cargo, drop it (quest is gone, don't keep stale cargo)
memory.questCargo = null;
```

- [ ] **Step 4: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-quest.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-quest.ts"
git commit -m "feat(meridian): CompleteQuest prefers questCargo over personal inventory

Supply/restock quest completion now checks memory.questCargo first
(items picked up via PickupForQuest) and only falls back to personal
inventory if the agent happens to already have the item. This unblocks
restock quests where the agent was never going to keep a personal
stockpile of the required item.

QuestCargoReady updated to match — returns true when questCargo
matches the active quest OR when personal inventory has the item."
```

### Task 6: Wire the new branch into `base.mdsl`

**Files:**
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Read the current `P4.25 Complete active quest` block**

Read `behavior-trees/base.mdsl` lines 173–191. Current structure:

```mdsl
sequence {
    condition [HasQuest]
    selector {
        sequence {
            condition [QuestAtFacility]
            condition [QuestCargoReady]
            action [CompleteQuest]
        }
        sequence {
            condition [QuestAtFacility]
            action [WorkRepair]
        }
        action [SeekQuestFacility]
    }
}
```

- [ ] **Step 2: Add a sourcing branch before `SeekQuestFacility`**

Replace the block with:

```mdsl
sequence {
    condition [HasQuest]
    selector {
        /* At quest facility with cargo ready — complete it */
        sequence {
            condition [QuestAtFacility]
            condition [QuestCargoReady]
            action [CompleteQuest]
        }
        /* At quest facility — work repair */
        sequence {
            condition [QuestAtFacility]
            action [WorkRepair]
        }
        /* Cargo not ready — go source the item from a production facility */
        sequence {
            flip { condition [QuestCargoReady] }
            action [SeekQuestSource]
            action [PickupForQuest]
        }
        /* Travel to quest facility (has cargo, just needs to deliver) */
        action [SeekQuestFacility]
    }
}
```

- [ ] **Step 3: Verify MDSL parses by running the sitemap/BT loader tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-loader.test.ts --config configs/vitest.config.ts`
Expected: pass. If mistreevous rejects the MDSL with a parse error, the usual causes are:
- `flip` requires `{ ... }` syntax not `{ condition [...] }` — try `flip { condition [QuestCargoReady] }` vs `condition [QuestCargoReady] decorated flip`
- Action signature mismatch — verify `SeekQuestSource` and `PickupForQuest` are registered in ActionMethods

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 5: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): wire SeekQuestSource + PickupForQuest into BT P4.25

Adds a new sub-branch under the Complete active quest selector:
if the quest's cargo isn't ready, seek a source facility and pick up
the item. Comes before the existing SeekQuestFacility fallback so the
agent gathers the item before traveling to the delivery target.

Combined with the new actions, this closes the restock quest
death-lock seen in recording 2026-04-11-1339."
```

### Task 7: Tests for the new quest actions

**Files:**
- Modify: `tests/infrastructure/entity/bt-actions.test.ts`

- [ ] **Step 1: Add unit tests for `SeekQuestSource`**

```typescript
describe('SeekQuestSource', () => {
	it('returns FAILED when no active quest', () => {
		const ctx = makeTestContext({ activeQuest: null });
		expect(ctx.actions.SeekQuestSource()).toBe('mistreevous.failed');
	});

	it('returns FAILED for repair quests', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'repair', facilityId: 'loc-workshop', itemId: null, quantity: 0, repairProgress: 0 },
		});
		expect(ctx.actions.SeekQuestSource()).toBe('mistreevous.failed');
	});

	it('returns FAILED when no known facility produces the quest item', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'supply', facilityId: 'loc-market', itemId: 'food', quantity: 1, repairProgress: 0 },
			knownLocations: ['loc-market'],
			locations: [/* no food producer */],
		});
		expect(ctx.actions.SeekQuestSource()).toBe('mistreevous.failed');
	});

	it('moves toward the nearest known food producer for a supply/food quest', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'supply', facilityId: 'loc-market', itemId: 'food', quantity: 1, repairProgress: 0 },
			knownLocations: ['loc-market', 'loc-farmland'],
			locations: [
				{ id: 'loc-farmland', production: { output: { item_id: 'food' } }, position: { x: 0, y: 0 } },
				{ id: 'loc-market', production: null, position: { x: 100, y: 0 } },
			],
		});
		const result = ctx.actions.SeekQuestSource();
		expect(result).toBe('mistreevous.running'); // not at farmland yet
		expect(ctx.memory.movementTarget).toEqual({ id: 'loc-farmland', type: 'location' });
	});

	it('returns SUCCEEDED when already at the source facility', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'restock', facilityId: 'loc-market', itemId: 'food', quantity: 1, repairProgress: 0 },
			knownLocations: ['loc-farmland'],
			atLocation: 'loc-farmland',
			locations: [
				{ id: 'loc-farmland', production: { output: { item_id: 'food' } }, position: { x: 0, y: 0 } },
			],
		});
		expect(ctx.actions.SeekQuestSource()).toBe('mistreevous.succeeded');
	});
});
```

- [ ] **Step 2: Add unit tests for `PickupForQuest`**

```typescript
describe('PickupForQuest', () => {
	it('returns FAILED when not at a facility', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'restock', facilityId: 'loc-market', itemId: 'food', quantity: 1, repairProgress: 0 },
			atLocation: null,
		});
		expect(ctx.actions.PickupForQuest()).toBe('mistreevous.failed');
	});

	it('returns FAILED when source facility has insufficient stock', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'restock', facilityId: 'loc-market', itemId: 'food', quantity: 3, repairProgress: 0 },
			atLocation: 'loc-farmland',
			facilityStocks: { 'loc-farmland': [{ item_id: 'food', quantity: 1 }] },
		});
		expect(ctx.actions.PickupForQuest()).toBe('mistreevous.failed');
	});

	it('transfers the quest quantity from facility stock to questCargo', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'supply', facilityId: 'loc-market', itemId: 'food', quantity: 2, repairProgress: 0 },
			atLocation: 'loc-farmland',
			facilityStocks: { 'loc-farmland': [{ item_id: 'food', quantity: 5 }] },
		});
		const result = ctx.actions.PickupForQuest();
		expect(result).toBe('mistreevous.succeeded');
		expect(ctx.memory.questCargo).toEqual({ itemId: 'food', quantity: 2, questId: 'q1' });
		// Facility stock reduced by 2
		const remaining = ctx.getFacilityStock('loc-farmland', 'food');
		expect(remaining).toBe(3);
	});

	it('does not touch personal inventory', () => {
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'supply', facilityId: 'loc-market', itemId: 'food', quantity: 1, repairProgress: 0 },
			atLocation: 'loc-farmland',
			facilityStocks: { 'loc-farmland': [{ item_id: 'food', quantity: 5 }] },
			personalInventory: [{ item_id: 'food', quantity: 2 }],
		});
		ctx.actions.PickupForQuest();
		expect(ctx.getPersonalInventoryQty('food')).toBe(2); // unchanged
	});
});
```

- [ ] **Step 3: Add integration test for the complete restock flow**

```typescript
describe('Restock quest end-to-end', () => {
	it('completes a restock via source → pickup → deliver flow', () => {
		// Agent has an active restock quest, no food in personal inventory,
		// farm has food, market is empty. Run the BT: agent should fetch food
		// from the farm and deliver to the market.
		const ctx = makeTestContext({
			activeQuest: { id: 'q1', type: 'restock', facilityId: 'loc-market', itemId: 'food', quantity: 1, repairProgress: 0 },
			knownLocations: ['loc-farmland', 'loc-market'],
			locations: [
				{ id: 'loc-farmland', production: { output: { item_id: 'food' } }, position: { x: 0, y: 0 } },
				{ id: 'loc-market', production: null, position: { x: 100, y: 0 } },
			],
			facilityStocks: { 'loc-farmland': [{ item_id: 'food', quantity: 5 }] },
			atLocation: 'loc-farmland', // pre-arrived for brevity
			personalInventory: [],
		});

		// Step 1: pickup for quest
		expect(ctx.actions.PickupForQuest()).toBe('mistreevous.succeeded');
		expect(ctx.memory.questCargo).not.toBeNull();

		// Step 2: move to market (simulate arrival)
		ctx.memory.atLocation = 'loc-market';

		// Step 3: complete quest
		expect(ctx.actions.CompleteQuest()).toBe('mistreevous.succeeded');
		expect(ctx.memory.activeQuest).toBeNull();
		expect(ctx.memory.questCargo).toBeNull();
		// Market gained the food
		expect(ctx.getFacilityStock('loc-market', 'food')).toBe(1);
	});
});
```

- [ ] **Step 4: Run the new tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: new tests pass.

- [ ] **Step 5: Run full suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions.test.ts"
git commit -m "test(meridian): SeekQuestSource, PickupForQuest, end-to-end restock flow"
```

---

## Chunk 3: Tools circulation to market

**Fixes:** Issue 3 (tools hoarding).

**Why third:** Independent from 1 and 2 but benefits from them. The existing equipment repair branch in job MDSLs already buys tools from market — but only if market has tools in stock. This chunk closes the supply loop so tools actually reach the market.

**Approach:** Two-step investigation:
1. Diagnose why `IsOverloaded + SellAtMarket` isn't actually selling Celia's tools
2. Fix whichever gate is blocking the sale

### Task 8: Diagnose the sell-at-market path for tools

**Files:**
- Read only: `src/infrastructure/entity/bt-actions-economy.ts` (SellAtMarket implementation)
- Read only: `src/infrastructure/entity/bt-conditions-economy.ts` (IsOverloaded)

- [ ] **Step 1: Trace the sell flow**

Find `SellAtMarket` in `bt-actions-economy.ts`. Document:
- Which items does it attempt to sell? (Any inventory item? Only food? Only surplus? Filters?)
- Where does the price come from?
- Does the market need to have `fund >= price`? If so, does Market Stall have enough fund for a tools(10) at price 12g (example from recording)?
- Does the market need a slot in `stock` for tools, or does it auto-create?

Write findings as a comment in the commit message when fixing Task 9.

- [ ] **Step 2: Trace `IsOverloaded`**

Find `IsOverloaded` in `bt-conditions-economy.ts`. Document the threshold (e.g. inventory count > 10) and whether it triggers reliably.

- [ ] **Step 3: Check if tools are marketable at all**

Read `03 - Resources/items/tools.md` and the items schema to see if `tools` has a `base_price` or equivalent. If no price is set, `SellAtMarket` has nothing to charge.

### Task 9: Fix whichever gate blocks tool sale

The fix depends on what Task 8 finds. Likely candidates:

**If markets don't auto-stock new item types:** add a one-liner to `SellAtMarket` that creates an empty stock slot for the item if missing, so the subsequent transfer has somewhere to land.

**If market fund is too low:** raise Market Stall's starting fund via config, or have the treasury subsidize market operations when velocity is low.

**If tools have no base price:** add `base_price: 8` (or similar) to `tools.md`'s frontmatter.

**If `IsOverloaded` only checks food/equipment types:** extend the check to include tools.

- [ ] **Step 1: Apply the smallest fix that makes Celia's tools actually reach Market Stall stock**

Document the change in the commit message. Do not over-fix — just unblock the flow.

- [ ] **Step 2: Add a regression test**

Add a test to `tests/infrastructure/entity/bt-actions-economy.test.ts` (or wherever existing market tests live) that simulates an overloaded craftsman at a market and asserts tools transfer to market stock.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add <files>
git commit -m "fix(meridian): tools flow from overloaded craftsman to market stall

Investigation of recording 2026-04-11-1339 showed Celia accumulating
tools(10)x92 with no sale path. Root cause: <fill in from Task 8 findings>.

Fix: <describe the minimal change>. The existing P4.45 repair branch
in job MDSLs (settler/guard/craftsman) already buys tools from market
— now the market actually has them."
```

---

## Chunk 4: Lockstep rest mitigation

**Fixes:** Issue 4 (lockstep rest/wander cycles).

**Why:** Low-risk config + small helper change. Can be done after or in parallel with Chunk 3.

### Task 10: Widen wake/sleep offset variance and add needs-decay jitter

**Files:**
- Modify: `src/infrastructure/entity/bt-working-memory.ts` — offset generation
- Modify: `src/domain/systems/needs-decay.ts` — per-agent decay jitter

- [ ] **Step 1: Find the current wake/sleep offset generation**

Search `grep -rn "wakeOffset\|sleepOffset" src/` to find where agents' offsets are assigned at spawn. The offsets are probably generated from agent ID + a range.

- [ ] **Step 2: Widen the range**

Find the range constant (likely something like `Math.floor(rng.next() * 30)`). Change to `Math.floor(rng.next() * 60)` so the variance doubles. Agents will diverge more on rest schedules.

- [ ] **Step 3: Add decay jitter in `applyNeedsDecay`**

Read `src/domain/systems/needs-decay.ts:applyNeedsDecay`. Each tick, the decay is `config.hunger_decay` applied uniformly to all agents. Add a small per-agent jitter that prevents identical convergence:

```typescript
// Per-agent jitter — prevents lockstep convergence without distorting
// long-run rates. Symmetric so expected value = 1.
function jitter(agentIdSeed: number, tick: number): number {
	// Deterministic noise function — same (agentIdSeed, tick) always returns same value
	const h = ((agentIdSeed * 73856093) ^ (tick * 19349663)) & 0x7fffffff;
	return 1 + ((h % 11) - 5) / 100; // ±5%
}
```

Apply: `decayRate: config.hunger_decay * jitter(input.agentIdSeed, input.tick)`.

`input.agentIdSeed` is a new parameter — compute it from the agent id once at spawn (hash the string) and store it in working memory or pass through the tick system.

- [ ] **Step 4: Update tests that assert exact decay values**

Many tests in `needs-decay.test.ts` assert specific decay amounts. Either:
- Pass a fixed `agentIdSeed` and `tick` that produces `jitter === 1.0` (find by hand)
- Or add a boolean `disableJitter` flag to the config for tests

Recommended: add `disableJitter: boolean` to the config parameter and default to `false`. Tests pass `disableJitter: true`.

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add <files>
git commit -m "feat(meridian): wider offset variance + per-agent needs decay jitter

Two small changes to break lockstep behavior seen in recording
2026-04-11-1339 (16+ 'all 3 agents resting simultaneously' anomalies):

- Double the wake/sleep offset range so agents diverge on rest schedules
- Add ±5% per-tick jitter to needs decay, keyed by agentId+tick, so
  identical agents don't converge to identical need states over time

Jitter is deterministic (hash of seed+tick) so replay/seed stability
is preserved. Tests can disable jitter via a config flag."
```

---

## Chunk 5: Bram wandering diagnostic

**Fixes:** Issue 5 — likely already resolved by Chunk 1, but needs verification.

### Task 11: Verify Bram no longer wanders with critical needs

**Files:**
- None modified (diagnostic only)

- [ ] **Step 1: Search the BT for the `Wander` fallback**

Read `base.mdsl` line 264 — confirms `action [Wander]` is the selector's last child. This means wander only fires when every other branch fails. After Chunk 1, an agent with critical needs will break their commitment and fall through to P0 critical-survival, not wander.

- [ ] **Step 2: Check if the "has job but wandering" anomaly is a false positive at night**

Search for the anomaly definition in `src/infrastructure/engine/debug-overlay.ts`. If the anomaly fires regardless of time phase, it's a false positive for night-time wandering. Add a `phase !== 'night'` guard.

- [ ] **Step 3: If fix needed, commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "fix(meridian): exclude night-time wandering from job-anomaly detector

Agents without a bed naturally wander at night if they have no reason
to do anything else. The anomaly was firing for Bram even when his
behavior was correct. Now only fires during work hours."
```

---

## Chunk 6: Final verification

### Task 12: Record a new session and compare metrics

**Files:**
- None modified (manual QA + metric comparison)

- [ ] **Step 1: Run the full test suite one more time**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck + lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: clean + 0 errors.

- [ ] **Step 3: Production build**

Run: `cd "01 - Projects/Project Meridian" && npm run build`
Expected: success. Check the `dist/` output contains the updated base.mdsl.

- [ ] **Step 4: Manual end-to-end recording**

1. Install the plugin build to the test vault
2. Open the game view
3. Click `⋮` → `⏺ Start recording`
4. Run the simulation for ~20 in-game days (with the new speed baseline, this takes ~2-3 minutes of wall clock)
5. Click `⋮` → `⏹ Stop recording`
6. Locate the new recording file under `03 - Resources/Economy/Recordings/`

- [ ] **Step 5: Compare metrics against baseline**

For the new recording, check:

| Metric | Baseline (recording-1339) | Target |
|---|---|---|
| Critical need ignored anomalies | 7+ (Bram thirst 0) | 0 |
| Restock quest completion rate | 2 of 10+ | ≥ 50% |
| "All 3 agents resting" anomaly | 16 | ≤ 8 |
| Market Stall tools stock (ever) | 0 | ≥ 1 time |
| Economy frozen days | 29 | ≤ 5 |
| Velocity at end of session | 0.08 | ≥ 0.15 |

If any metric fails the target, diagnose and fix before merging. Common culprits:
- Still hitting a commitment edge case
- Quest cargo gets dropped somewhere unexpected
- Market fund too low to buy Celia's tools

- [ ] **Step 6: Check persisted quest files**

Open `03 - Resources/Economy/Quests/` and verify new quest markdown files include:
- Frontmatter with all flow metrics (lead_time, cycle_time, queue_time, etc.)
- Restock quests that complete show a `Re-claimed by` timeline entry if applicable
- `touched_by_count` reflects multi-agent quests correctly

- [ ] **Step 7: Final commit if any follow-up fixes were needed**

```bash
git add <any files>
git commit -m "fix(meridian): <describe follow-up>"
```

- [ ] **Step 8: Push to origin/master**

```bash
git push origin master
```

---

## Appendix: File checklist

Files touched by this plan:

**Source:**
- `src/infrastructure/entity/bt-actions.ts` — ContinueCommitment extension
- `src/infrastructure/entity/bt-actions-quest.ts` — new actions, updated CompleteQuest
- `src/infrastructure/entity/bt-conditions-quest.ts` — QuestCargoReady update
- `src/infrastructure/entity/bt-working-memory.ts` — questCargo slot, wider offsets
- `src/infrastructure/entity/behavior-agent-factory.ts` — getter/setter for questCargo
- `src/domain/systems/behavior-agent.ts` — interface additions
- `src/domain/systems/needs-decay.ts` — jitter
- `src/infrastructure/entity/bt-actions-economy.ts` — SellAtMarket fix (if needed)
- `src/infrastructure/engine/debug-overlay.ts` — night wander anomaly guard (if needed)
- `behavior-trees/base.mdsl` — P4.25 new branch
- `configs/game-config.json` — new commitment_ticks entries

**Tests:**
- `tests/infrastructure/entity/bt-actions.test.ts` — travel-break + new action tests
- `tests/infrastructure/entity/bt-actions-economy.test.ts` — tools sale regression (if needed)
- `tests/infrastructure/systems/needs-decay.test.ts` — jitter disable flag

**Docs:**
- None modified (this plan + its spec are the docs)

**Out of scope:**
- Equipment repair tuning
- New quest types
- BT visual tooling
- Deprecating the old `supply` quest inventory-drain behavior (kept as fallback)
