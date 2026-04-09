# Tool Repair Economy Design

**Status:** Approved
**Date:** 2026-04-10
**Scope:** 9 changes to create tool demand, connect craftsman production to the economy, and add an agent gold sink
**Data source:** 30+ snapshots across 5 runs. Day 60: agents hoard 1,000g+, Workshop tools at 279 with no buyer, equipment decays but agents buy generic "equipment" instead of tools.

---

## Problem Statement

Agents accumulate gold with nothing to spend on. After 60 days: Bram 1,007g, Celia 1,114g, Aldric 542g. The only spend is food (~5-20g/day across all agents). Meanwhile Workshop produces tools endlessly (279 units stockpiled) with zero demand. Equipment decays (charges drop from ~18 to 0 over ~18 days) but agents buy generic "equipment" from Market Stall at P4.5, bypassing Workshop entirely.

Two connected problems:
1. **No tool demand** — agents don't buy tools, Workshop has no revenue, craftsman production is economically pointless
2. **No equipment maintenance sink** — equipment breaks silently, agents buy cheap replacements, gold accumulates

---

## Fix 1: NeedsRepair condition

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-economy.ts` — add NeedsRepair
- Modify: `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface

**Condition:** Returns true when agent has equipment with charges > 0 but below repair threshold.

```typescript
NeedsRepair(): boolean {
	const inv = actor.get(InventoryComponent).state.items;
	const equip = inv.find(i => i.item_id === 'equipment');
	if (equip === undefined || equip.quantity === 0) return false;
	return (equip.charges ?? 0) > 0 && (equip.charges ?? 0) < config.economy.equipment_repair_threshold;
},
```

Different from `NeedsEquipment` which checks charges = 0 (total depletion). `NeedsRepair` catches the "getting low" state before equipment breaks.

---

## Fix 2: HasTools condition

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-economy.ts` — add HasTools
- Modify: `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface

**Condition:** Returns true when agent has tools in inventory with quantity > 0.

```typescript
HasTools(): boolean {
	const inv = actor.get(InventoryComponent).state.items;
	const tools = inv.find(i => i.item_id === 'tools');
	return tools !== undefined && tools.quantity > 0;
},
```

Simpler than `NeedsTools` (which checks absence/depletion). `HasTools` is a positive check for the repair branch.

---

## Fix 3: RepairWithTools action

**Files:**
- Create or modify: action file in `src/infrastructure/entity/` (best fit: `bt-actions-needs.ts` or a new `bt-actions-equipment.ts`)
- Modify: `src/infrastructure/entity/bt-actions.ts` barrel — add to ActionMethods and createActions

**Action:** Consumes 1 tool from inventory, adds `tool_repair_charges` (config, default 10) to equipment charges.

```typescript
RepairWithTools(): ActionResult {
	const inv = actor.get(InventoryComponent);
	const tools = inv.state.items.find(i => i.item_id === 'tools');
	if (tools === undefined || tools.quantity === 0) return FAILED;

	const equip = inv.state.items.find(i => i.item_id === 'equipment');
	if (equip === undefined) return FAILED;

	// Consume 1 tool
	const newItems = inv.state.items
		.map(i => i.item_id === 'tools' ? { ...i, quantity: i.quantity - 1 } : { ...i })
		.filter(i => i.quantity > 0);

	// Add charges to equipment
	const repairCharges = ctx.deps.config.economy.tool_repair_charges;
	const repairedItems = newItems.map(i =>
		i.item_id === 'equipment' ? { ...i, charges: (i.charges ?? 0) + repairCharges } : i
	);

	inv.state = { ...inv.state, items: repairedItems };
	inv.markDirty();

	beginAction(ctx, 'repair_equipment');

	ctx.deps.eventBus.emit({
		type: 'EquipmentRepaired',
		tick: ctx.deps.tickCount,
		wallClock: Date.now(),
		source: 'BehaviorAgent',
		payload: { agentId: ctx.actor.agentId, chargesAdded: repairCharges },
	});

	return SUCCEEDED;
},
```

---

## Fix 4: CollectProduced action (replaces Harvest)

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-needs.ts` — replace Harvest with CollectProduced (or add alongside and remove Harvest)
- Modify: `src/infrastructure/entity/bt-actions.ts` barrel — update ActionMethods interface

**Action:** Generic "take items from assigned facility stock into agent inventory." Works for any production type (food from Farmland, tools from Workshop).

```typescript
CollectProduced(): ActionResult {
	const facilityActors = ctx.deps.getLocationActors?.();
	if (facilityActors === undefined || ctx.actor.job === null) return FAILED;

	const facilityActor = facilityActors.get(ctx.actor.job.facilityId);
	if (facilityActor === undefined || !facilityActor.has(FacilityComponent)) return FAILED;

	const facility = facilityActor.get(FacilityComponent);
	if (facility.state.stock.length === 0) return FAILED;

	// Transfer first stocked item to agent inventory
	const item = facility.state.stock[0];
	if (item.quantity <= 0) return FAILED;

	// Remove from facility
	const newStock = facility.state.stock
		.map(s => s === item ? { ...s, quantity: s.quantity - 1 } : { ...s })
		.filter(s => s.quantity > 0);
	facility.state = { ...facility.state, stock: newStock };
	facility.markDirty();

	// Add to agent inventory
	const inv = ctx.actor.get(InventoryComponent);
	const existing = inv.state.items.find(i => i.item_id === item.item_id);
	const newItems = existing
		? inv.state.items.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : { ...i })
		: [...inv.state.items.map(i => ({ ...i })), { item_id: item.item_id, quantity: 1 }];
	inv.state = { ...inv.state, items: newItems };
	inv.markDirty();

	beginAction(ctx, 'collect');
	return SUCCEEDED;
},
```

**NOTE:** Read the existing `Harvest` action first to understand exact patterns (how it accesses facility stock, inventory, component imports). The implementation above is approximate — use the actual variable names and patterns from the codebase.

---

## Fix 5: Remove Harvest action

After `CollectProduced` is working:
- Remove `Harvest` from `bt-actions-needs.ts` (or whichever file it's in)
- Remove from `ActionMethods` interface in `bt-actions.ts`
- Update settler.mdsl to use `CollectProduced` instead of `Harvest`

If `Harvest` has any food-specific logic beyond "take from facility stock," preserve that logic inside `CollectProduced` or keep `Harvest` as a thin wrapper. Investigate before deleting.

---

## Fix 6: P4.45 BT branch — repair equipment with tools

**File:** `behavior-trees/base.mdsl`

Insert before P4.5 (equipment purchase):

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

Two-tick minimum: Tick 1 buys tools, Tick 2 repairs. Self-regulating — once charges >= threshold, `NeedsRepair` is false.

---

## Fix 7: Update settler.mdsl — Harvest → CollectProduced

**File:** `jobs/settler.mdsl`

Replace:
```
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [Harvest]
        }
```

With:
```
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [CollectProduced]
        }
```

---

## Fix 8: Update craftsman.mdsl — add CollectProduced

**File:** `jobs/craftsman.mdsl`

Add before the Work sequence:

```
        /* Collect produced tools from workshop */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "tools"]
            action [CollectProduced]
        }
```

This is the critical missing link — craftsman picks up tools from Workshop stock into inventory, then `IsOverloaded` fires (tools > 15), and the agent sells at market. Workshop tools stop stockpiling.

---

## Fix 9: Config additions

**File:** `configs/game-config.json` + `src/domain/schemas/game-config-schema.ts`

Add to economy config:
```json
"equipment_repair_threshold": 5,
"tool_repair_charges": 10
```

Schema additions:
```typescript
equipment_repair_threshold: z.number().default(5),
tool_repair_charges: z.number().default(10),
```

---

## Expected Gold Flow

```
Workshop produces tools → Celia collects → IsOverloaded fires → sells at Market Stall
                                                                      ↓
All agents: equipment charges < 5 → NeedsRepair → buy tools from Market Stall
                                                                      ↓
                                                    Gold flows: Agent → Market → Workshop
```

**Demand estimate:** Equipment decays ~1 charge/day. Threshold 5 → agents buy every ~15 days. 3 agents × tool price (~2.5-5g) × 4 purchases/60 days ≈ 30-60g tool spending over 60 days. Steady, not explosive.

**Workshop becomes self-sustaining:** Tool sales fund wages + maintenance. No more subsidy dependency.

---

## Non-Goals

- Security demand (separate increment — security as service fee)
- Memory/relationship quality fixes (separate cycle)
- Treasury regen tuning (observe after tool demand activates)
- New item types or recipes
- Equipment upgrade system
