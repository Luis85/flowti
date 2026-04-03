# Craftsman, Dynamic Pricing & Visual Polish

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Third agent (craftsman), tools/equipment items with durability, generalized trade, dynamic pricing, debug overlay economy visualization

## Problem

The two-agent economy (farmer + guard) only trades one commodity (food). There is no production chain, no multi-good market, and prices are effectively static. Adding a craftsman who produces tools and equipment creates genuine supply/demand dynamics across three traded goods, and the visual overlay needs to make this economy legible.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Third agent role | Craftsman (tools + equipment) | Creates production chain + demand from both other agents |
| Tool effect | 2x farm output per cycle, consumes 1 charge | Farmer NEEDS tools to feed 3 agents |
| Equipment effect | 20% need decay reduction, consumes 1 charge/day | Universal demand from all agents |
| Durability | Charges (tools: 10, equipment: 20) | Creates recurring demand — agents must keep buying |
| Craftsman funding | Private (facility-funded) | Market participant, earns from sales not treasury |
| Raw materials | None (workshop produces from nothing) | Simplicity — supply chain can be added later |
| Pricing | Existing `calculatePostedPrice` + recalc queue | Already implemented, just needs to work with multiple goods |

## Craftsman Agent

**File:** `agents/craftsman.json`

```json
{
  "id": "agent-craftsman",
  "name": "Craftsman",
  "kind": "craftsman",
  "color": "#ff8a65",
  "attributes": { "ST": 10, "DX": 14, "IQ": 14, "HT": 11 },
  "social": { "status": 1, "reputation": 1, "charisma": 10 },
  "needs": { "hunger": 80, "energy": 80, "social": 50, "thirst": 80 },
  "mood": 0,
  "memory": [],
  "goals": [],
  "skills": [],
  "inventory": [
    { "item_id": "food", "quantity": 3 },
    { "item_id": "waterskin", "quantity": 1, "charges": 3 }
  ],
  "equipment": { "head": null, "body": null, "hands": null, "tool": null, "accessory": null },
  "persona": null,
  "traits": [],
  "wallet": { "gold": 40 },
  "xp": 0,
  "level": 1,
  "position": { "x": 240, "y": 210, "region": "region-valley" },
  "relationships": null,
  "tools": [],
  "behavior_tree": "craftsman",
  "job": "craftsman",
  "property": []
}
```

- Higher IQ/DX (skilled artisan), lower ST/HT
- Starts with 3 food, waterskin, 40g (needs gold to buy food since no food production)
- Position near market

## Workshop Location

**File:** `locations/workshop.json`

```json
{
  "id": "loc-workshop",
  "name": "Workshop",
  "type": "work",
  "position": { "x": 260, "y": 170, "region": "region-valley" },
  "color": "#ff8a65",
  "production": {
    "job": "craftsman",
    "output": { "item_id": "tools", "quantity": 1 },
    "input": null,
    "wage": 0,
    "ticks_per_cycle": 25,
    "funding": "facility"
  },
  "capacity": 1
}
```

- `type: "work"` — generic work location
- `funding: "facility"` — private enterprise
- `wage: 0` — craftsman earns from market sales, not facility wages
- `ticks_per_cycle: 25` — slower than farming (15), crafting takes skill
- Output: tools (primary). Equipment is produced as alternating output — see Item Effects section.

## New Items

**File:** `items/tools.json`

```json
{
  "id": "tools",
  "name": "Farming Tools",
  "baseValue": 8,
  "category": "trade_goods",
  "maxCharges": 10
}
```

**File:** `items/equipment.json`

```json
{
  "id": "equipment",
  "name": "Protective Gear",
  "baseValue": 12,
  "category": "trade_goods",
  "maxCharges": 20
}
```

## Item Effects

### Tools (farmer buys)

- When a farmer has tools in inventory (`charges > 0`), farm output is multiplied by `tools_output_multiplier` (default: 2)
- Each harvest cycle that uses the multiplier consumes 1 charge
- At 0 charges, tools item is removed from inventory — output returns to normal
- 10 charges = 10 boosted cycles

**Implementation:** `FacilitySystem` checks worker inventory for tools when a production cycle completes at a food-type facility. If tools found with charges > 0, multiply `production.output.quantity` by the config multiplier, then decrement 1 charge.

### Equipment (any agent buys)

- When an agent has equipment in inventory (`charges > 0`), all need decay rates are reduced by `equipment_decay_reduction` (default: 0.2, meaning 20% reduction)
- Equipment charges are decremented by 1 at each day boundary
- At 0 charges, equipment item is removed from inventory — decay returns to normal
- 20 charges = 20 days of protection

**Implementation:**
- `NeedsDecaySystem` checks agent inventory for equipment. If found with charges > 0, apply `(1 - equipment_decay_reduction)` multiplier to all decay scales.
- `DayNightSystem` at day boundary iterates all agents, finds equipment items, decrements 1 charge. Removes items at 0 charges.

### Workshop Output Alternation

The workshop produces tools by default (`output.item_id: "tools"`). To also produce equipment, the `FacilitySystem` alternates output: odd cycles produce tools, even cycles produce equipment. This is driven by a cycle counter on the facility state, not by changing the production config.

Alternatively, a simpler approach: the workshop always produces tools. Equipment is produced at a second workshop or via a config flag. For this iteration, **the workshop produces tools only**. Equipment production can be added as a second workshop or output toggle in a future iteration.

**Decision: Workshop produces tools only.** Equipment enters the economy via the market's initial stock (seeded with a few units) and a future second production facility. This keeps the craftsman BT simple — one product to sell.

### Config additions

In `EconomyConfigSchema`:

```typescript
tools_output_multiplier: z.number().default(2),
equipment_decay_reduction: z.number().default(0.2),
```

## Craftsman Behavior Tree

**File:** `behavior-trees/branch-craftsman.mdsl`

```
root [Role] {
    selector {
        /* Sell goods at market if carrying any and not hungry */
        sequence {
            condition [AtLocation, "market"]
            condition [HasTradeGoods]
            flip { condition [IsHungry] }
            action [SellAtMarket]
        }
        /* Go to market to sell if carrying trade goods and not hungry */
        sequence {
            condition [HasTradeGoods]
            flip { condition [IsHungry] }
            action [SeekMarket]
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

### Settler BT Addition

Add tools-buying sequences to `branch-settler.mdsl` after the sell-excess block:

```
/* Buy tools from market if needed and affordable */
sequence {
    condition [AtLocation, "market"]
    condition [NeedsTools]
    condition [CanAffordItem, "tools"]
    condition [FacilityHasStock, "tools"]
    action [BuyItem, "tools"]
}
sequence {
    condition [NeedsTools]
    condition [CanAffordItem, "tools"]
    action [SeekMarket]
}
```

### Base BT Addition

Add equipment buying to `base.mdsl` as a new priority between P4 (hungry) and P5 (energy). All agents can buy equipment:

```
/* P4.5: Buy equipment if affordable and available */
sequence {
    condition [NeedsEquipment]
    condition [CanAffordItem, "equipment"]
    selector {
        sequence {
            condition [AtLocation, "market"]
            condition [FacilityHasStock, "equipment"]
            action [BuyItem, "equipment"]
        }
        action [SeekMarket]
    }
}
```

### New BT Conditions and Actions

**Conditions:**

- `HasTradeGoods()` — returns true if inventory contains any item in `TRADE_GOODS` set with quantity > 0
- `NeedsTools()` — returns true if agent has no tools in inventory or tools charges = 0
- `NeedsEquipment()` — returns true if agent has no equipment in inventory or equipment charges = 0
- `CanAffordItem(itemId: string)` — checks `agent.gold >= cheapest known price for itemId` (uses price memory like `CanAffordFood`)

**Actions:**

- `BuyItem(itemId: string)` — like `Buy()` but targets a specific item. Sets `btAction = 'buy'` and stores the target item ID for `TradeSystem` to process.

## Generalized Trade System

### Fix 1: `FacilityHasStock(itemId)` must use its parameter

Currently ignores `itemId` and always checks `FOOD_ITEMS`. Fix:

```typescript
FacilityHasStock(itemId: string): boolean {
    return agent.nearbyFacilities.some(
        f => f.stock.some(s => s.item_id === itemId && s.quantity > 0),
    );
},
```

### Fix 2: `SellAtMarket` generalized for any item

Currently only sells food items. Generalize to sell any item the agent has that the facility stocks or trades. The action should:
1. Find a market-type facility at the current location
2. Find the first sellable item in agent inventory (food or trade goods)
3. Execute the sale

### Fix 3: Production output → worker inventory for private facilities

Currently `FacilitySystem` adds output to `facility.state.stock`. For private-funded facilities (craftsman's workshop), output should go to the worker's inventory instead — they own what they produce and carry it to market to sell.

```
if (production.funding === 'facility' && production.wage === 0) {
    // Private production — output goes to worker inventory
    addToWorkerInventory(worker, output.item_id, output.quantity);
} else {
    // Waged production — output goes to facility stock
    updateFacilityStock(facility, output.item_id, output.quantity);
}
```

### Fix 4: `TradeSystem` generalized for any item

Currently `findNearestFoodFacility` only searches for `FOOD_ITEMS`. Generalize to support buying any item:
- `BuyItem("tools")` sets a target item ID on the behavior agent
- `TradeSystem` reads the target item ID and searches for facilities stocking that item
- The existing `applyTrade` logic works unchanged — it just needs the correct item ID and price

### Fix 5: Equipment charge decay at day boundary

In `DayNightSystem`, at day boundary, iterate all agents:
```typescript
for (const agent of agentList) {
    const inv = agent.get(InventoryComponent);
    // Decrement equipment charges, remove at 0
    const updated = inv.state.items.map(i => {
        if (i.item_id !== 'equipment') return i;
        const newCharges = (i.charges ?? 0) - 1;
        return newCharges > 0 ? { ...i, charges: newCharges } : null;
    }).filter(Boolean);
    inv.state = { items: updated };
    inv.markDirty();
}
```

## Dynamic Pricing

The existing `EconomySystem` with `calculatePostedPrice` handles multi-item pricing. With the market now in the recalc queue (already fixed) and multiple goods being traded, prices will adjust based on:

- **Supply:** current stock count at the market
- **Demand:** purchase events tracked by `demandTracker`
- **Elasticity:** `subsistence: 1.5` (food — high sensitivity), `trade_goods: 0.7` (tools/equipment — lower sensitivity)
- **Clamps:** `price_clamp_min: 0.5` to `price_clamp_max: 3.0` (50%-300% of base value)

**No new pricing code needed.** The existing system handles it. What was missing was:
1. Market in the recalc queue (already fixed)
2. Multiple goods being traded (this spec adds tools + equipment)
3. Agents making purchase decisions based on price (reservation pricing already implemented)

**Emergent price dynamics:**

| Scenario | Effect |
|----------|--------|
| Farmer buys all tools → tools stock depleted | Tools price rises (low supply, high demand) |
| Guard can't afford equipment → no purchases | Equipment price drops (high supply, no demand) |
| Craftsman floods market with tools | Tools price drops (oversupply) |
| All agents well-fed → food accumulates | Food price drops |

## Visual Polish — Debug Overlay

### Market prices panel

Add a section to the debug overlay showing current market prices:

```
📊 Market Prices
  🍖 Food: 5g (base 3g) ▲
  🔧 Tools: 8g (base 8g) ─
  🛡️ Equipment: 12g (base 12g) ─
```

Color coding: green (below base), white (at base), red (above base). Arrow indicates trend (up/down/stable based on last recalculation).

### Agent wallet display

Add gold amount to each agent's info in the overlay:

```
👤 Settler — 💰 42g
  🍖 Hunger 74.5  💧 Thirst 68.2  ⚡ Energy 92.1
```

### Action labels on sprites

Show a small floating label above each agent sprite with their current action emoji + label from `ACTION_DISPLAY`. Updated every tick when `btAction` changes.

### Trade event flash

When a buy/sell event occurs at the market, briefly flash the market marker with a gold pulse and show floating text: `"+1 food"`, `"-8g"`, etc. Fades after 2 seconds.

## Housing

`locations/house.json` capacity 2 → 3.

## Files Changed

| File | Change |
|------|--------|
| `agents/craftsman.json` | **New** — craftsman agent |
| `locations/workshop.json` | **New** — private workshop facility |
| `items/tools.json` | **New** — tools item definition |
| `items/equipment.json` | **New** — equipment item definition |
| `behavior-trees/branch-craftsman.mdsl` | **New** — craftsman role BT |
| `behavior-trees/branch-settler.mdsl` | Add tools-buying sequences |
| `behavior-trees/base.mdsl` | Add equipment-buying priority block |
| `locations/house.json` | Capacity 2 → 3 |
| `src/infrastructure/engine/world-loader.ts` | Add `'craftsman'` to BT_KINDS |
| `src/domain/systems/food-items.ts` | Add `TRADE_GOODS` set export |
| `src/domain/schemas/game-config-schema.ts` | Add `tools_output_multiplier`, `equipment_decay_reduction` |
| `configs/game-config.json` | Add new config values |
| `src/infrastructure/entity/behavior-agent-factory.ts` | Add `HasTradeGoods`, `NeedsTools`, `NeedsEquipment`, `CanAffordItem`, `BuyItem`. Fix `FacilityHasStock` parameter. Generalize `SellAtMarket`. |
| `src/domain/systems/behavior-agent.ts` | Add new conditions/actions to interface |
| `src/infrastructure/systems/facility-system.ts` | Tools output multiplier. Private output → worker inventory. |
| `src/infrastructure/systems/trade-system.ts` | Generalize buy flow for any item |
| `src/infrastructure/systems/needs-decay-system.ts` | Equipment decay reduction multiplier |
| `src/infrastructure/systems/day-night-system.ts` | Equipment charge decay at day boundary |
| `src/infrastructure/engine/debug-overlay.ts` | Market prices panel, wallet display, action labels, trade flash |
| `src/infrastructure/engine/game-view.ts` | Wire action labels to agent sprites |
| Tests | Craftsman BT, tools/equipment effects, generalized trade, FacilityHasStock fix, dynamic pricing |
