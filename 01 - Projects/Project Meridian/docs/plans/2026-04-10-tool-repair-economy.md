# Tool Repair Economy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create tool demand by connecting equipment repair to tool purchases, and enable craftsmen to collect and sell produced goods via a generic CollectProduced action.

**Architecture:** 7 tasks across 2 chunks. Chunk 1: new conditions, config, actions (TDD). Chunk 2: MDSL updates and Harvest→CollectProduced swap. All independently testable.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, JSON config.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-10-tool-repair-economy-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Conditions, Config, and Actions

### Task 1: Add config values and schema

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `configs/game-config.json`

- [ ] **Step 1: Add to economy config schema**

In `src/domain/schemas/game-config-schema.ts`, find the economy config schema (the Zod object containing `overload_goods_threshold`). Add:

```typescript
equipment_repair_threshold: z.number().default(5),
tool_repair_charges: z.number().default(10),
```

- [ ] **Step 2: Add to game-config.json**

In `configs/game-config.json`, in the `"economy"` section, add:

```json
"equipment_repair_threshold": 5,
"tool_repair_charges": 10
```

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git add "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "feat(meridian): add equipment_repair_threshold and tool_repair_charges config"
```

---

### Task 2: Add NeedsRepair and HasTools conditions

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-economy.ts` — add both conditions
- Modify: `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface and EconomyKeys
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`

- [ ] **Step 1: Add to ConditionMethods interface**

In `src/infrastructure/entity/bt-conditions.ts`, find `IsOverloaded(): boolean;` in the `ConditionMethods` interface and add after it:

```typescript
NeedsRepair(): boolean;
HasTools(): boolean;
```

- [ ] **Step 2: Add to EconomyKeys and implement**

In `src/infrastructure/entity/bt-conditions-economy.ts`, append `'NeedsRepair' | 'HasTools'` to the `EconomyKeys` type union.

Add implementations inside the returned object, after `IsOverloaded()`:

```typescript
NeedsRepair(): boolean {
	const inv = actor.get(InventoryComponent).state.items;
	const equip = inv.find(i => i.item_id === 'equipment');
	if (equip === undefined || equip.quantity === 0) return false;
	return (equip.charges ?? 0) > 0 && (equip.charges ?? 0) < config.economy.equipment_repair_threshold;
},

HasTools(): boolean {
	const inv = actor.get(InventoryComponent).state.items;
	const tools = inv.find(i => i.item_id === 'tools');
	return tools !== undefined && tools.quantity > 0;
},
```

- [ ] **Step 3: Write tests**

In `tests/infrastructure/entity/bt-conditions.test.ts`, add:

```typescript
describe('NeedsRepair', () => {
	it('returns true when equipment charges below repair threshold', () => {
		setInventory([{ item_id: 'equipment', quantity: 1, charges: 3 }]);
		expect(conditions.NeedsRepair()).toBe(true);
	});

	it('returns false when equipment charges at threshold', () => {
		setInventory([{ item_id: 'equipment', quantity: 1, charges: 5 }]);
		expect(conditions.NeedsRepair()).toBe(false);
	});

	it('returns false when equipment fully depleted (NeedsEquipment handles that)', () => {
		setInventory([{ item_id: 'equipment', quantity: 1, charges: 0 }]);
		expect(conditions.NeedsRepair()).toBe(false);
	});

	it('returns false when no equipment', () => {
		setInventory([]);
		expect(conditions.NeedsRepair()).toBe(false);
	});
});

describe('HasTools', () => {
	it('returns true when tools in inventory', () => {
		setInventory([{ item_id: 'tools', quantity: 3, charges: undefined }]);
		expect(conditions.HasTools()).toBe(true);
	});

	it('returns false when no tools', () => {
		setInventory([]);
		expect(conditions.HasTools()).toBe(false);
	});

	it('returns false when tools quantity is 0', () => {
		setInventory([{ item_id: 'tools', quantity: 0, charges: undefined }]);
		expect(conditions.HasTools()).toBe(false);
	});
});
```

Adapt `setInventory` to match existing test patterns.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-economy.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions.ts"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): add NeedsRepair and HasTools conditions for tool repair economy"
```

---

### Task 3: Add RepairWithTools action

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-needs.ts` — add RepairWithTools (equipment-related, lives alongside Harvest/Eat/Drink)
- Modify: `src/infrastructure/entity/bt-actions.ts` — add to ActionMethods interface and Pick type
- Test: `tests/infrastructure/entity/bt-actions.test.ts` (or existing action test file)

- [ ] **Step 1: Add to ActionMethods interface**

In `src/infrastructure/entity/bt-actions.ts`, find `Harvest(): ActionResult;` in the `ActionMethods` interface and add after it:

```typescript
RepairWithTools(): ActionResult;
```

- [ ] **Step 2: Update createNeedsActions Pick type**

In `src/infrastructure/entity/bt-actions-needs.ts`, find the `Pick<ActionMethods, ...>` return type on `createNeedsActions` (line 12) and add `'RepairWithTools'` to the union.

- [ ] **Step 3: Implement RepairWithTools**

In `src/infrastructure/entity/bt-actions-needs.ts`, add after the `Harvest()` method:

```typescript
RepairWithTools(): ActionResult {
	const inv = actor.get(InventoryComponent);
	const tools = inv.state.items.find(i => i.item_id === 'tools');
	if (tools === undefined || tools.quantity === 0) return FAILED;

	const equip = inv.state.items.find(i => i.item_id === 'equipment');
	if (equip === undefined) return FAILED;

	const repairCharges = deps.config.economy.tool_repair_charges;

	// Consume 1 tool, add charges to equipment
	const newItems = inv.state.items
		.map(i => {
			if (i.item_id === 'tools') return { ...i, quantity: i.quantity - 1 };
			if (i.item_id === 'equipment') return { ...i, charges: (i.charges ?? 0) + repairCharges };
			return { ...i };
		})
		.filter(i => i.quantity > 0);

	inv.state = { ...inv.state, items: newItems };
	inv.markDirty();

	beginAction(ctx, 'repair_equipment');

	eventBus.emit({
		type: 'EquipmentRepaired',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'BehaviorAgent',
		payload: { agentId: actor.agentId, chargesAdded: repairCharges },
	});

	return SUCCEEDED;
},
```

Note: `deps`, `actor`, `eventBus`, `beginAction`, `SUCCEEDED`, `FAILED`, `InventoryComponent` should all be available in scope from the existing `createNeedsActions` closure. Check the destructuring at the top of the function.

- [ ] **Step 4: Add commitment ticks for repair_equipment**

In `configs/game-config.json`, in the `"commitment_ticks"` section, add:

```json
"repair_equipment": 5
```

- [ ] **Step 5: Write test**

In the appropriate test file (search for existing bt-actions tests), add:

```typescript
describe('RepairWithTools', () => {
	it('consumes 1 tool and adds charges to equipment', () => {
		// Set inventory: tools qty 2, equipment charges 3
		// Call RepairWithTools
		// Assert: tools qty 1, equipment charges 13 (3 + 10)
	});

	it('fails when no tools in inventory', () => {
		// Set inventory: equipment only
		// Assert: returns FAILED
	});

	it('fails when no equipment in inventory', () => {
		// Set inventory: tools only
		// Assert: returns FAILED
	});

	it('removes tools item when quantity reaches 0', () => {
		// Set inventory: tools qty 1, equipment charges 2
		// Call RepairWithTools
		// Assert: tools item removed from inventory, equipment charges 12
	});
});
```

Adapt to existing test patterns for BT actions.

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-needs.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git add "01 - Projects/Project Meridian/configs/game-config.json"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): add RepairWithTools action — consume 1 tool for +10 equipment charges"
```

---

### Task 4: Replace Harvest with CollectProduced

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-needs.ts` — rename Harvest to CollectProduced, make generic
- Modify: `src/infrastructure/entity/bt-actions.ts` — update ActionMethods interface

- [ ] **Step 1: Read the existing Harvest implementation**

Read `src/infrastructure/entity/bt-actions-needs.ts` and find the `Harvest()` method (lines ~43-70). It currently:
1. Finds the facility at `memory.atLocation`
2. Looks for food items specifically: `FOOD_ITEMS.has(s.item_id)`
3. Transfers 1 unit from facility stock to agent inventory
4. Calls `beginAction(ctx, 'harvest')`

- [ ] **Step 2: Update ActionMethods interface**

In `src/infrastructure/entity/bt-actions.ts`, change `Harvest(): ActionResult;` to `CollectProduced(): ActionResult;`. Also update the Pick type in `createNeedsActions` return type: replace `'Harvest'` with `'CollectProduced'`.

- [ ] **Step 3: Rename and generalize Harvest → CollectProduced**

In `src/infrastructure/entity/bt-actions-needs.ts`, rename the `Harvest()` method to `CollectProduced()` and make it generic — instead of only looking for `FOOD_ITEMS`, take the first available stock item:

```typescript
CollectProduced(): ActionResult {
	if (memory.atLocation === null) return FAILED;
	const locationActorMap = getLocationActors();
	const locActor = locationActorMap.get(memory.atLocation);
	if (locActor?.has(FacilityComponent) !== true) return FAILED;
	const facility = locActor.get(FacilityComponent);

	// Take first available stock item (generic — works for food, tools, any produced good)
	const stockItem = facility.state.stock.find(s => s.quantity > 0);
	if (stockItem === undefined) return FAILED;

	// Remove from facility stock
	const newStock = facility.state.stock
		.map(s => {
			if (s.item_id !== stockItem.item_id) return { ...s };
			const newQty = s.quantity - 1;
			return newQty > 0 ? { ...s, quantity: newQty } : null;
		})
		.filter((s): s is NonNullable<typeof s> => s !== null);
	facility.state = { ...facility.state, stock: newStock };
	facility.markDirty();

	// Add to agent inventory
	const inv = actor.get(InventoryComponent);
	const existing = inv.state.items.find(i => i.item_id === stockItem.item_id);
	const newItems = existing !== undefined
		? inv.state.items.map(i => i.item_id === stockItem.item_id ? { ...i, quantity: i.quantity + 1 } : { ...i })
		: [...inv.state.items.map(i => ({ ...i })), { item_id: stockItem.item_id, quantity: 1 }];
	inv.state = { ...inv.state, items: newItems };
	inv.markDirty();

	beginAction(ctx, 'collect');
	return SUCCEEDED;
},
```

Key change from Harvest: `FOOD_ITEMS.has(s.item_id)` replaced with `s.quantity > 0` — takes any stock item, not just food.

- [ ] **Step 4: Add commitment ticks for collect**

In `configs/game-config.json`, in the `"commitment_ticks"` section, add:

```json
"collect": 5
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

If existing tests reference `Harvest` by name, they may fail. Update them to reference `CollectProduced`. Check `tests/infrastructure/entity/bt-actions.test.ts` and any integration tests.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-needs.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git add "01 - Projects/Project Meridian/configs/game-config.json"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "refactor(meridian): replace Harvest with generic CollectProduced — works for any facility output"
```

---

## Chunk 2: MDSL Updates

### Task 5: Update settler.mdsl — Harvest → CollectProduced

**File:** `jobs/settler.mdsl`

- [ ] **Step 1: Replace Harvest with CollectProduced**

In `jobs/settler.mdsl`, change:

```
        /* Harvest food from farm if stock available */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [Harvest]
        }
```

to:

```
        /* Collect produced food from farm */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [CollectProduced]
        }
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/settler.mdsl"
git commit -m "refactor(meridian): settler Harvest → CollectProduced"
```

---

### Task 6: Update craftsman.mdsl — add CollectProduced

**File:** `jobs/craftsman.mdsl`

- [ ] **Step 1: Add CollectProduced before Work**

Replace `jobs/craftsman.mdsl` with:

```
root [Job] {
    selector {
        /* Collect produced tools from workshop */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "tools"]
            action [CollectProduced]
        }
        /* Work at workshop */
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsWorkHours)
        }
        /* Go to work */
        sequence {
            condition [HasJob]
            action [SeekWork]
        }

        action [Wander]
    }
}
```

The CollectProduced branch comes first — craftsman picks up tools before working. When `IsOverloaded` fires (tools > 15 in inventory), P1.9 sends them to sell. After selling, they return and work.

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/craftsman.mdsl"
git commit -m "feat(meridian): craftsman collects tools from workshop — enables overload sell"
```

---

### Task 7: Add P4.45 repair branch to base.mdsl

**File:** `behavior-trees/base.mdsl`

- [ ] **Step 1: Insert P4.45 before P4.5**

In `behavior-trees/base.mdsl`, find the `/* P4.5: Buy equipment */` block (starts with the comment around line 200). Insert BEFORE it:

```
        /* P4.45: Repair equipment with tools when charges low */
        sequence {
            flip { condition [IsNighttime] }
            flip { condition [IsRecovering] }
            condition [NeedsRepair]
            selector {
                /* Have tools — consume and repair */
                sequence {
                    condition [HasTools]
                    action [RepairWithTools]
                }
                /* Buy tools first */
                sequence {
                    condition [CanAffordItem, "tools"]
                    selector {
                        sequence {
                            condition [AtLocation, "market"]
                            condition [FacilityHasStock, "tools"]
                            action [BuyItem, "tools"]
                        }
                        action [SeekMarket]
                    }
                }
            }
        }

```

- [ ] **Step 2: Run full tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Run typecheck and lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): add P4.45 repair branch — agents buy tools and repair equipment"
```
