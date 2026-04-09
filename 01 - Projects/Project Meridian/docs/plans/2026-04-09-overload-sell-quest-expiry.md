# Overload Sell & Quest Expiry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken dusk sell window with an overload-based sell mechanic and extend quest expiry so repair quests complete before timing out.

**Architecture:** 4 tasks in 1 chunk. New `IsOverloaded` condition (TDD), replace P2.75 MDSL block, add config thresholds, double quest expiry. All independently testable.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, JSON config.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-09-overload-sell-quest-expiry-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Overload Sell & Quest Expiry

### Task 1: Add IsOverloaded condition

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-economy.ts` — add IsOverloaded method
- Modify: `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface
- Modify: `src/domain/schemas/game-config-schema.ts` — add threshold defaults
- Modify: `configs/game-config.json` — add threshold values
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`

- [ ] **Step 1: Add config thresholds to game-config-schema.ts**

In `src/domain/schemas/game-config-schema.ts`, find the `NeedsConfigSchema` (the schema that produces `config.needs.*`) and add:

```typescript
overload_food_threshold: z.number().default(10),
```

Find the economy config schema (the schema that produces `config.economy.*`) and add:

```typescript
overload_goods_threshold: z.number().default(15),
```

- [ ] **Step 2: Add config values to game-config.json**

In `configs/game-config.json`, in the `"needs"` section, add:

```json
"overload_food_threshold": 10
```

In the `"economy"` section, add:

```json
"overload_goods_threshold": 15
```

- [ ] **Step 3: Add IsOverloaded to ConditionMethods interface**

In `src/infrastructure/entity/bt-conditions.ts`, find `FacilityNeedsSupply(): boolean;` in the `ConditionMethods` interface and add after it:

```typescript
IsOverloaded(): boolean;
```

- [ ] **Step 4: Add IsOverloaded to EconomyKeys and implementation**

In `src/infrastructure/entity/bt-conditions-economy.ts`, update the `EconomyKeys` type (line 12-15) to append `'IsOverloaded'`:

```typescript
type EconomyKeys =
	| 'HasGold' | 'HasFood' | 'HasFoodReserve' | 'HasWater' | 'HasTradeGoods'
	| 'CanAffordFood' | 'CanAffordItem' | 'KnowsFoodSource' | 'FacilityHasStock'
	| 'KnowsSupplyRoute' | 'HasCargo' | 'CargoDestinationNearby' | 'FacilityNeedsSupply'
	| 'IsOverloaded';
```

Add the implementation inside the returned object, after `FacilityNeedsSupply()`:

```typescript
IsOverloaded(): boolean {
	const inv = actor.get(InventoryComponent).state.items;
	const food = inv.find(i => FOOD_ITEMS.has(i.item_id));
	if (food !== undefined && food.quantity > config.needs.overload_food_threshold) return true;
	const goods = inv.find(i => TRADE_GOODS.has(i.item_id));
	if (goods !== undefined && goods.quantity > config.economy.overload_goods_threshold) return true;
	return false;
},
```

Note: `FOOD_ITEMS`, `TRADE_GOODS`, `InventoryComponent`, and `config` are already available in this file's scope (imported at lines 3-6 and destructured at line 18-19).

- [ ] **Step 5: Write tests**

In `tests/infrastructure/entity/bt-conditions.test.ts`, add:

```typescript
describe('IsOverloaded', () => {
	it('returns true when food exceeds overload threshold', () => {
		setInventory([{ item_id: 'food', quantity: 15, charges: undefined }]);
		expect(conditions.IsOverloaded()).toBe(true);
	});

	it('returns false when food is at overload threshold', () => {
		setInventory([{ item_id: 'food', quantity: 10, charges: undefined }]);
		expect(conditions.IsOverloaded()).toBe(false);
	});

	it('returns true when trade goods exceed overload threshold', () => {
		setInventory([{ item_id: 'tools', quantity: 20, charges: undefined }]);
		expect(conditions.IsOverloaded()).toBe(true);
	});

	it('returns false with normal inventory', () => {
		setInventory([
			{ item_id: 'food', quantity: 5, charges: undefined },
			{ item_id: 'tools', quantity: 3, charges: undefined },
		]);
		expect(conditions.IsOverloaded()).toBe(false);
	});

	it('returns false with empty inventory', () => {
		setInventory([]);
		expect(conditions.IsOverloaded()).toBe(false);
	});
});
```

Adapt `setInventory` to match the existing test file's setup pattern for setting inventory state on the test agent's `InventoryComponent`.

- [ ] **Step 6: Run typecheck and tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-economy.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions.ts"
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git add "01 - Projects/Project Meridian/configs/game-config.json"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): add IsOverloaded condition — triggers sell when inventory excessive"
```

---

### Task 2: Replace P2.75 with overload sell in base.mdsl

**File:** `behavior-trees/base.mdsl`

- [ ] **Step 1: Replace the P2.75 block**

In `behavior-trees/base.mdsl`, find the existing P2.75 block (currently starts with `/* P2.75: Sell excess goods during dusk */` at approximately line 97 and ends around line 132). Replace the ENTIRE block with:

```
        /* P2.75: Sell excess goods when overloaded */
        sequence {
            condition [IsOverloaded]
            flip { condition [IsNighttime] }
            flip { condition [IsRecovering] }
            selector {
                sequence {
                    condition [AtLocation, "market"]
                    action [SellAtMarket]
                }
                action [SeekMarket]
            }
        }
```

This is simpler than the previous block — no food/goods-specific conditions needed since `IsOverloaded` already checks both. No time-of-day restriction beyond nighttime block.

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): replace dusk sell with overload sell — agents sell when inventory > threshold"
```

---

### Task 3: Double quest expiry

**File:** `configs/game-config.json`

Quest expiry is configured at `config.quests.expiry_ticks`, defaulting to 960 in the schema (`src/domain/schemas/game-config-schema.ts` line 257). The `QuestGenerationSystem` reads this value when creating quests (lines 64, 92, 119).

- [ ] **Step 1: Check if game-config.json has a quests section**

Read `configs/game-config.json` and search for `"quests"`. If the section exists, find `expiry_ticks` and change it. If no quests section exists, add one.

- [ ] **Step 2: Set expiry_ticks to 1920**

If quests section exists, change `expiry_ticks` to `1920`. If no quests section exists, add:

```json
"quests": {
	"expiry_ticks": 1920
}
```

1920 ticks = 4 game days. Previous value was 960 (~2 days). This gives repair quests enough off-hours windows to complete 50 ticks of progress across multiple work days.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "fix(meridian): double quest expiry 960→1920 ticks — repair quests complete before timing out"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: no new errors.

- [ ] **Step 4: Verify commit history**

Run: `git log --oneline -5`
Expected: 3 clean commits for the overload sell + quest expiry changes.
