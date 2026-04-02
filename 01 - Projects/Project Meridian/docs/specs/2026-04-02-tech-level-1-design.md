# Tech Level 1: Single-Agent Survival Economy — Design Spec

> Date: 2026-04-02 | Status: Implemented

---

## Overview

Strip the simulation to the minimum viable economic loop: one agent, four locations, two items, three needs. The agent must farm food, haul it to market, sell it for gold, buy food to eat, fill a waterskin for water, and sleep at a house or outdoors. Every resource must be physically moved — no teleportation of goods.

This establishes the rock-solid foundation ("tech level 1") before scaling to multiple agents and complex supply chains.

### Success Criteria

- One agent sustains itself indefinitely through a work → produce → sell → buy → consume → rest cycle
- Gold flows in a complete circle: farm fund → agent wages → market purchases → market fund → agent sales
- All three needs (hunger, thirst, energy) stay above critical thresholds through agent behavior
- GoldFlowed velocity > 0 within the first game-day
- No hardcoded jobs — agent claims work via the dynamic job claiming system

---

## 1 · Needs Model

### Current: hunger, energy, social
### New: hunger, energy, social, **thirst**

Add `thirst` to `NeedsState` in `component-data.ts`:

```typescript
export interface NeedsState {
    hunger: number;
    energy: number;
    social: number;
    thirst: number;
}
```

Thirst decays like hunger — steadily per tick based on config. Satisfied by drinking from a waterskin item in inventory.

### Config additions (game-config-schema.ts)

```
needs:
    thirst_threshold: 50        # below this, IsThirsty fires
    thirst_decay_rate: 0.20     # per tick (slightly faster than hunger)
    drink_recovery: 25          # thirst restored per drink action

NEED_CRITICAL_THRESHOLDS:
    thirst: 20                  # below this, NeedsCritical fires for thirst
```

### NeedsDecaySystem changes

Add thirst decay alongside hunger/energy/social. Emit `NeedChanged` and `NeedCritical` events for thirst using the same pattern.

---

## 2 · Items

### 2.1 Food (existing, simplified)

`items/food.json`:
```json
{
    "id": "food",
    "name": "Food",
    "baseValue": 5,
    "category": "subsistence"
}
```

`items/food.md`:
```markdown
---
display_name: Food
icon: wheat
color: "#d4a574"
rarity: common
---

Basic sustenance harvested from the farmland. Keeps body and soul together.
```

Replaces the current bread/wheat/leather-goods items. The farm produces food directly (no input required).

### 2.2 Waterskin (new)

`items/waterskin.json`:
```json
{
    "id": "waterskin",
    "name": "Waterskin",
    "baseValue": 0,
    "category": "tool",
    "charges": 3,
    "maxCharges": 3
}
```

`items/waterskin.md`:
```markdown
---
display_name: Waterskin
icon: droplet
color: "#4da6ff"
rarity: common
---

A simple leather pouch for carrying water. Holds three drinks. Refill at any water source.
```

**Charges model:** The waterskin has charges (0-3). Drinking consumes 1 charge. Filling at a water source restores to max. This avoids creating a separate "water" item — the waterskin IS the container.

**ItemSchema extension:** Add optional `charges` and `maxCharges` fields to the item schema. Items without these fields behave as before (consumable stacking).

---

## 3 · Locations

### 3.1 Water Source

`locations/water-source.json`:
```json
{
    "id": "loc-water-source",
    "name": "Spring",
    "type": "water",
    "position": { "x": 150, "y": 300, "region": "region-valley" },
    "color": "#4da6ff",
    "production": null
}
```

`locations/water-source.md`:
```markdown
---
display_name: The Spring
map_icon: droplet
color: "#4da6ff"
---

A clear spring bubbling up from the hillside. Fresh water, free for the taking.
```

No production — just a location agents visit to fill waterskins. The `FillWaterskin` action checks `AtLocation("water")`.

### 3.2 Farmland

`locations/farmland.json`:
```json
{
    "id": "loc-farmland",
    "name": "Farmland",
    "type": "food",
    "position": { "x": 100, "y": 100, "region": "region-valley" },
    "color": "#7cb342",
    "production": {
        "job": "farmer",
        "output": { "item_id": "food", "quantity": 1 },
        "input": null,
        "wage": 3,
        "ticks_per_cycle": 30,
        "auto_process": false,
        "auto_ticks_per_cycle": null
    },
    "capacity": 1
}
```

`locations/farmland.md`:
```markdown
---
display_name: The Farmland
map_icon: sprout
color: "#7cb342"
---

Fertile soil at the edge of the valley. With honest work, it yields enough food to sustain a family.
```

### 3.3 Market

`locations/market.json`:
```json
{
    "id": "loc-market",
    "name": "Market Stall",
    "type": "market",
    "position": { "x": 250, "y": 200, "region": "region-valley" },
    "color": "#ff9800",
    "production": null,
    "fund": 100,
    "stock": [
        { "item_id": "food", "quantity": 5 }
    ]
}
```

`locations/market.md`:
```markdown
---
display_name: The Market Stall
map_icon: store
color: "#ff9800"
---

A simple wooden stall where goods change hands. Buy what you need, sell what you've grown.
```

The market starts with 5 food and 100 gold in its fund. The agent can sell food to the market (market pays from fund) and buy food from the market (agent pays from wallet).

### 3.4 House

`locations/house.json`:
```json
{
    "id": "loc-house",
    "name": "Cottage",
    "type": "rest",
    "position": { "x": 300, "y": 300, "region": "region-valley" },
    "color": "#8d6e63",
    "production": null
}
```

`locations/house.md`:
```markdown
---
display_name: The Cottage
map_icon: home
color: "#8d6e63"
---

A modest dwelling with a straw roof and a warm hearth. Rest comes easy within its walls — for a price.
```

Uses the existing rest tier system: paid shelter (fast recovery) or outdoors (slow, free).

---

## 4 · The Agent

### 4.1 Settler

`agents/settler.json`:
```json
{
    "id": "agent-settler",
    "name": "Settler",
    "kind": "settler",
    "color": "#66bb6a",
    "attributes": { "ST": 12, "DX": 12, "IQ": 12, "HT": 12 },
    "social": { "status": 1, "reputation": 1, "charisma": 10 },
    "needs": { "hunger": 80, "energy": 80, "social": 50, "thirst": 80 },
    "mood": 0,
    "memory": [],
    "goals": [],
    "skills": [],
    "inventory": [
        { "item_id": "food", "quantity": 5 },
        { "item_id": "waterskin", "quantity": 1 }
    ],
    "equipment": { "head": null, "body": null, "hands": null, "tool": null, "accessory": null },
    "persona": "personas/settler.md",
    "traits": [],
    "wallet": { "gold": 50 },
    "xp": 0,
    "level": 1,
    "position": { "x": 250, "y": 200, "region": "region-valley" },
    "relationships": null,
    "tools": [],
    "behavior_tree": "settler",
    "job": null,
    "property": []
}
```

`agents/settler.md`:
```markdown
---
display_name: The Settler
portrait_color: "#66bb6a"
---

A resourceful soul who arrived in the valley with little more than a waterskin and a handful of provisions. Determined to build a life from the land.
```

**Key design decisions:**
- Starts with no job (claims farmland via P6 job claiming)
- Balanced attributes (12 across the board) — no weaknesses that cause bootstrap issues
- Starts with 5 food + 1 waterskin + 50 gold — enough buffer to survive while learning the loop
- Position at market (central) — needs to discover and travel to other locations
- `behavior_tree: "settler"` — new role branch

### 4.2 Settler BT Branch

`behavior-trees/branch-settler.mdsl`:
```
root [Role] {
    selector {
        /* Haul goods if carrying cargo */
        sequence {
            condition [HasCargo]
            condition [CargoDestinationNearby]
            action [DeliverCargo]
        }
        sequence {
            condition [HasCargo]
            action [SeekDeliveryTarget]
        }

        /* Pick up food from farm and haul to market */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [PickupCargo]
        }

        /* Work at facility */
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

This combines the artisan "work" behavior with the merchant "haul" behavior. The settler works at the farm, then when food is in stock, picks it up and hauls it to market. After delivery, returns to work.

### 4.3 Base BT (simplified)

The base.mdsl stays mostly the same but adds thirst handling:

```
P0: Critical survival (NeedsCritical)
    - IsThirsty + HasWater → Drink
    - IsThirsty → SeekWater (fill waterskin)
    - IsHungry + HasFood → Eat
    - IsHungry + CanAffordFood → Buy food
    - IsExhausted → SeekRest
P1: Role behavior (IsWorkHours + branch[Role])
P2: Thirsty → SeekWater + FillWaterskin + Drink
P3: Hungry → Eat or Buy
P4: Tired → Sleep
P5: Claim job
P6: Wander
```

---

## 5 · New BT Conditions and Actions

### New Conditions

| Condition | Returns true when |
|-----------|-------------------|
| `IsThirsty()` | `thirst < config.needs.thirst_threshold` |
| `HasWater()` | Inventory contains waterskin with charges > 0 |

### New Actions

| Action | Behavior |
|--------|----------|
| `Drink()` | Consume 1 waterskin charge, restore thirst by `drink_recovery`. Returns SUCCEEDED or FAILED (no water). |
| `SeekWater()` | Navigate to nearest water-type location. Returns RUNNING/SUCCEEDED/FAILED. |
| `FillWaterskin()` | At water location, restore waterskin charges to max. Returns SUCCEEDED or FAILED. |
| `SellAtMarket()` | At market, sell food from inventory to market (market pays from fund). Returns SUCCEEDED or FAILED. |

### Modified Conditions

| Condition | Change |
|-----------|--------|
| `NeedsCritical()` | Add `thirst < NEED_CRITICAL_THRESHOLDS.thirst` to the OR check |

### Interface Count After Changes

- Conditions: 23 → 25 (add IsThirsty, HasWater)
- Actions: 18 → 22 (add Drink, SeekWater, FillWaterskin, SellAtMarket)

---

## 6 · Sell-to-Market Mechanic

The current TradeSystem only handles agent-buys-from-facility. We need the reverse: agent-sells-to-facility.

**SellAtMarket action:**
1. Agent must be at a market-type location
2. Agent must have food in inventory
3. Market must have gold in its fund
4. On success: food moves from agent inventory to market stock, gold moves from market fund to agent wallet
5. Price = facility's currentPrices (dynamic pricing) or item baseValue as fallback
6. Emit `SaleComplete` event + `GoldFlowed` (transfer, subcategory: 'sale')

This creates the reverse gold flow: market fund → agent wallet (sale) vs agent wallet → market fund (purchase).

---

## 7 · Waterskin Charges Model

**ItemSchema extension:**

Add optional fields to `item-schema.ts`:
```typescript
charges: z.number().optional(),
maxCharges: z.number().optional(),
```

**InventoryState extension:**

The inventory tracks per-item charges. When an agent has a waterskin with 3 charges, the inventory entry is:
```json
{ "item_id": "waterskin", "quantity": 1, "charges": 3 }
```

`Drink()` decrements charges. `FillWaterskin()` resets charges to maxCharges (from item definition).

---

## 8 · Data File Philosophy

Every entity has paired files:

| File | Purpose | Read by |
|------|---------|---------|
| `*.json` | Simulation data — drives the engine | Zod schema → ECS components |
| `*.md` | Content + display props in frontmatter | Obsidian rendering, future LLM, chronicler |

The JSON is the source of truth for the sim. The markdown frontmatter provides display hints (color, icon, display_name) that the UI layer reads. The markdown body provides narrative content for the LLM dialogue system and the chronicler.

---

## 9 · Files Reset

### Remove
- `agents/elena.json`, `agents/marcus.json`, `agents/sable.json`, `agents/wren.json`
- `locations/farm.json`, `locations/bakery.json`, `locations/workshop.json`, `locations/market.json`, `locations/tavern.json`, `locations/town-square.json`
- `items/bread.json`, `items/wheat.json`, `items/leather-goods.json`
- `behavior-trees/branch-merchant.mdsl`, `branch-guard.mdsl`, `branch-artisan.mdsl`, `branch-scholar.mdsl`

### Create
- `agents/settler.json` + `agents/settler.md`
- `locations/water-source.json` + `locations/water-source.md`
- `locations/farmland.json` + `locations/farmland.md`
- `locations/market.json` + `locations/market.md`
- `locations/house.json` + `locations/house.md`
- `items/food.json` + `items/food.md`
- `items/waterskin.json` + `items/waterskin.md`
- `behavior-trees/branch-settler.mdsl`

### Modify
- `src/domain/core/component-data.ts` — add thirst to NeedsState
- `src/domain/schemas/game-config-schema.ts` — add thirst config
- `src/domain/schemas/ranges.ts` — add thirst critical threshold
- `src/domain/schemas/item-schema.ts` — add charges/maxCharges fields
- `src/infrastructure/systems/needs-decay-system.ts` — add thirst decay
- `src/domain/systems/behavior-agent.ts` — add IsThirsty, HasWater, Drink, SeekWater, FillWaterskin, SellAtMarket
- `src/infrastructure/entity/behavior-agent-factory.ts` — implement all new conditions/actions
- `behavior-trees/base.mdsl` — add thirst handling to P0 + new P2
- `src/domain/systems/food-items.ts` — update FOOD_ITEMS set to include 'food'
- `src/infrastructure/engine/world-loader.ts` — handle markdown companion files

---

## 10 · What Stays Unchanged

- Tick system, ECS architecture, ExcaliburJS engine
- FacilitySystem (production, wages, tax)
- MovementSystem (pathfinding, stamina)
- EconomySystem (dynamic pricing, demand tracking)
- MonetaryPolicySystem (velocity tracking, safety nets)
- DayNightSystem (day cycle, stipends, subsidies, reports)
- RestSystem (rest tiers: house/outdoors)
- GoldFlowed event pipeline
- Price memory system
- Job claiming system (P6)
- All infrastructure wiring from the economy depth work
