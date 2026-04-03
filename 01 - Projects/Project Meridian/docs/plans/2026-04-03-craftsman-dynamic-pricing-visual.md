# Craftsman, Dynamic Pricing & Visual Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a craftsman agent who produces tools/equipment, generalize the trade system for multi-item commerce, enable dynamic pricing, and add economy visualization to the debug overlay.

**Architecture:** Extends the existing ECS + BT architecture with generalized trade (any item, not just food), item effects via system-level checks (tools boost farm output, equipment reduces decay), and overlay panels showing market prices/wallets/trades.

**Tech Stack:** TypeScript, Zod, mistreevous (MDSL behavior trees), ExcaliburJS (ECS), Vitest

**Spec:** `docs/specs/2026-04-03-craftsman-dynamic-pricing-visual-design.md`

**Test command:** `npx vitest run --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`
**Single test:** `npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

---

## Chunk 1: Generalized Trade & Fixes (prerequisite for everything)

### Task 1: Fix `FacilityHasStock` to use its `itemId` parameter

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:342-346`
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

- [ ] **Step 1: Write failing test**

Add test that verifies `FacilityHasStock("tools")` returns false when facility only has food, and true when facility has tools.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Fix FacilityHasStock**

Change line 342-346 from checking `FOOD_ITEMS.has(s.item_id)` to checking `s.item_id === itemId`:

```typescript
FacilityHasStock(itemId: string): boolean {
	return agent.nearbyFacilities.some(
		f => f.stock.some(s => s.item_id === itemId && s.quantity > 0),
	);
},
```

- [ ] **Step 4: Run tests, type check**
- [ ] **Step 5: Commit** `fix(meridian): FacilityHasStock now uses its itemId parameter instead of hardcoded FOOD_ITEMS`

---

### Task 2: Add `TRADE_GOODS` set and item category helpers

**Files:**
- Modify: `src/domain/systems/food-items.ts`
- Modify: `tests/domain/systems/food-items.test.ts`

- [ ] **Step 1: Write tests**

Test `TRADE_GOODS` set contains 'tools' and 'equipment'. Test `isTradeGood()` helper.

- [ ] **Step 2: Add to food-items.ts**

```typescript
/** Craftable trade goods — non-food items agents produce and sell. */
export const TRADE_GOODS = new Set(['tools', 'equipment']);

export function isTradeGood(itemId: string): boolean {
	return TRADE_GOODS.has(itemId);
}
```

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): add TRADE_GOODS set and isTradeGood helper`

---

### Task 3: Generalize `SellAtMarket` for any inventory item

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:477-526`
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

- [ ] **Step 1: Write tests**

Test that `SellAtMarket` can sell tools (not just food) when the agent is at a market.

- [ ] **Step 2: Generalize SellAtMarket**

Currently `SellAtMarket()` searches inventory using `findFoodInInventory()`. Change to find ANY sellable item (food or trade goods):

```typescript
SellAtMarket(): ActionResult {
	if (atLocation === null) return FAILED;
	const facility = agent.nearbyFacilities.find(f => f.id === atLocation);
	if (facility === undefined) return FAILED;

	// Find first sellable item in inventory (food or trade goods)
	const inv = actor.get(InventoryComponent).state.items;
	const sellable = inv.find(i =>
		(FOOD_ITEMS.has(i.item_id) || TRADE_GOODS.has(i.item_id)) && i.quantity > 0,
	);
	if (sellable === null || sellable === undefined) return FAILED;

	const price = facility.state.currentPrices?.[sellable.item_id] ?? config.economy.food_price;
	if (facility.state.fund < price) return FAILED;

	// Transfer item to facility stock, debit facility fund, credit agent wallet
	// ... (keep existing transfer logic but use sellable.item_id instead of food.item_id)
}
```

Import `TRADE_GOODS` from `../../domain/systems/food-items.js`.

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): generalize SellAtMarket to sell any food or trade good`

---

### Task 4: Add `BuyItem(itemId)` action and generalize TradeSystem

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Modify: `src/domain/systems/behavior-agent.ts`
- Modify: `src/infrastructure/systems/trade-system.ts:24-49,206-207`
- Modify: `tests/infrastructure/systems/trade-system.test.ts`

- [ ] **Step 1: Add `buyTargetItem` working memory to BehaviorAgent**

In `behavior-agent.ts`, add to the BT working memory section:

```typescript
buyTargetItem: string | null;
```

In `behavior-agent-factory.ts`, initialize: `let buyTargetItem: string | null = null;`
Add getter/setter in the agent object.

- [ ] **Step 2: Add `BuyItem(itemId)` action**

In `behavior-agent-factory.ts`, add after `Buy()`:

```typescript
BuyItem(itemId: string): ActionResult {
	if (atLocation === null) return FAILED;
	const atFacility = agent.nearbyFacilities.find(f =>
		f.id === atLocation && f.stock.some(s => s.item_id === itemId && s.quantity > 0),
	);
	if (atFacility === undefined) return FAILED;
	btAction = 'buy';
	buyTargetItem = itemId;
	return SUCCEEDED;
},
```

Add `BuyItem(itemId: string): ActionResult;` to the BehaviorAgent interface.

- [ ] **Step 3: Generalize TradeSystem**

In `trade-system.ts`, rename `findNearestFoodFacility` to `findNearestFacilityWithItem` and make it accept an `itemId` parameter instead of hardcoding `FOOD_ITEMS`:

```typescript
function findNearestFacilityWithItem(
	agent: AgentActor,
	locationList: WorldLocation[],
	locationActorMap: Map<string, Actor>,
	radius: number,
	itemId: string,
): NearestFacility | undefined {
	// Same logic but check stockItem.item_id === itemId instead of FOOD_ITEMS.has()
}
```

Update the execute loop (~line 206) to read `buyTargetItem` from the behavior agent:

```typescript
if (btAction !== 'buy') continue;
const targetItem = ba.buyTargetItem ?? 'food'; // fallback for backward compat with Buy()
const target = findNearestFacilityWithItem(agent, locationList, locationActorMap, radius, targetItem);
```

- [ ] **Step 4: Write tests for BuyItem and generalized TradeSystem**
- [ ] **Step 5: Run tests, type check**
- [ ] **Step 6: Commit** `feat(meridian): add BuyItem action and generalize TradeSystem for any item`

---

### Task 5: Add `HasTradeGoods`, `NeedsTools`, `NeedsEquipment`, `CanAffordItem` conditions

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Modify: `src/domain/systems/behavior-agent.ts`
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

- [ ] **Step 1: Write tests for each condition**

- [ ] **Step 2: Implement conditions**

```typescript
HasTradeGoods(): boolean {
	return agent.inventory.some(i => TRADE_GOODS.has(i.item_id) && i.quantity > 0);
},

NeedsTools(): boolean {
	const tools = agent.inventory.find(i => i.item_id === 'tools');
	return tools === undefined || tools.quantity === 0;
},

NeedsEquipment(): boolean {
	const equip = agent.inventory.find(i => i.item_id === 'equipment');
	return equip === undefined || equip.quantity === 0;
},

CanAffordItem(itemId: string): boolean {
	const staleTicks = config.economy.price_memory_stale_ticks;
	const tick = tickCount();
	let cheapestPrice = Infinity;
	for (const mem of priceMemories) {
		if (mem.itemId === itemId && !isPriceStale(mem, tick, staleTicks)) {
			if (mem.price < cheapestPrice) cheapestPrice = mem.price;
		}
	}
	if (cheapestPrice === Infinity) {
		// No price memory — use base value from item registry or a fallback
		cheapestPrice = config.economy.food_price; // fallback
	}
	return agent.gold >= cheapestPrice;
},
```

- [ ] **Step 3: Add to BehaviorAgent interface**
- [ ] **Step 4: Run tests, type check**
- [ ] **Step 5: Commit** `feat(meridian): add HasTradeGoods, NeedsTools, NeedsEquipment, CanAffordItem conditions`

---

### Task 6: Route production output to worker inventory for private facilities

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts:318-327`
- Modify: `tests/infrastructure/systems/facility-system.test.ts`

- [ ] **Step 1: Write test**

Test that when `production.funding === 'facility'` and `production.wage === 0`, output goes to worker inventory instead of facility stock.

- [ ] **Step 2: Modify output routing**

In `facility-system.ts`, after `applyStockChanges` is called (~line 318), check the funding model:

```typescript
if (result.produceOutput && production !== null) {
	if (production.funding === 'facility' && production.wage === 0) {
		// Private production — output goes to worker inventory
		const inv = worker.get(InventoryComponent);
		const existingItem = inv.state.items.find(i => i.item_id === production.output.item_id);
		if (existingItem !== undefined) {
			inv.state = { items: inv.state.items.map(i =>
				i.item_id === production.output.item_id
					? { ...i, quantity: i.quantity + outputQty }
					: { ...i }
			) };
		} else {
			inv.state = { items: [...inv.state.items.map(i => ({ ...i })), { item_id: production.output.item_id, quantity: outputQty }] };
		}
		inv.markDirty();
	} else {
		// Waged/treasury production — output goes to facility stock
		facility.state = { ...facility.state, stock: newStock };
	}
}
```

Where `outputQty` accounts for the tools multiplier (see Task 9).

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): route production output to worker inventory for private zero-wage facilities`

---

## Chunk 2: Craftsman Agent, Items & Effects

### Task 7: Add config fields for tools and equipment effects

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `configs/game-config.json`
- Modify: `tests/integration/data-validation.test.ts` (or similar)

- [ ] **Step 1: Write test**

```typescript
it('EconomyConfig includes tools and equipment params', () => {
	const config = GameConfigSchema.parse({});
	expect(config.economy.tools_output_multiplier).toBe(2);
	expect(config.economy.equipment_decay_reduction).toBe(0.2);
});
```

- [ ] **Step 2: Add to EconomyConfigSchema**

```typescript
tools_output_multiplier: z.number().default(2),
equipment_decay_reduction: z.number().default(0.2),
```

- [ ] **Step 3: Update game-config.json**

Add under `"economy"`:
```json
"tools_output_multiplier": 2,
"equipment_decay_reduction": 0.2
```

- [ ] **Step 4: Run tests, type check**
- [ ] **Step 5: Commit** `feat(meridian): add tools_output_multiplier and equipment_decay_reduction config`

---

### Task 8: Create item data files

**Files:**
- Create: `items/tools.json`
- Create: `items/equipment.json`

- [ ] **Step 1: Create items/tools.json**

```json
{
	"id": "tools",
	"name": "Farming Tools",
	"baseValue": 8,
	"category": "trade_goods",
	"maxCharges": 10
}
```

- [ ] **Step 2: Create items/equipment.json**

```json
{
	"id": "equipment",
	"name": "Protective Gear",
	"baseValue": 12,
	"category": "trade_goods",
	"maxCharges": 20
}
```

- [ ] **Step 3: Run data validation tests**
- [ ] **Step 4: Commit** `feat(meridian): add tools and equipment item definitions`

---

### Task 9: Tools output multiplier in FacilitySystem

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts`
- Modify: `tests/infrastructure/systems/facility-system.test.ts`

- [ ] **Step 1: Write test**

Test that when a worker has tools with charges > 0, the production output quantity is multiplied by `tools_output_multiplier` and 1 charge is consumed.

- [ ] **Step 2: Implement**

In `facility-system.ts`, after `applyStockChanges` and before output routing (Task 6), check the worker's inventory for tools:

```typescript
let outputQty = production.output.quantity;
if (result.produceOutput && loc.type === 'food') {
	const workerInv = worker.get(InventoryComponent);
	const tools = workerInv.state.items.find(i => i.item_id === 'tools' && (i.charges ?? 0) > 0);
	if (tools !== undefined) {
		outputQty *= deps.config.economy.tools_output_multiplier;
		// Consume 1 charge
		workerInv.state = { items: workerInv.state.items.map(i => {
			if (i.item_id !== 'tools') return { ...i };
			const newCharges = (i.charges ?? 0) - 1;
			return newCharges > 0 ? { ...i, charges: newCharges } : null;
		}).filter((i): i is typeof i & object => i !== null) };
		workerInv.markDirty();
	}
}
```

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): tools boost farm output by multiplier, consume 1 charge per cycle`

---

### Task 10: Equipment decay reduction in NeedsDecaySystem

**Files:**
- Modify: `src/infrastructure/systems/needs-decay-system.ts:36-43`
- Modify: `tests/infrastructure/systems/needs-decay-system.test.ts`

- [ ] **Step 1: Write test**

Test that an agent with equipment (`charges > 0`) has all decay rates reduced by `equipment_decay_reduction`.

- [ ] **Step 2: Implement**

In `needs-decay-system.ts`, after merging trait and activity modifiers (~line 43), check for equipment:

```typescript
// Equipment decay reduction
const inv = entity.get(InventoryComponent);
const hasEquipment = inv.state.items.some(i => i.item_id === 'equipment' && (i.charges ?? 0) > 0);
if (hasEquipment) {
	const reduction = 1 - deps.config.economy.equipment_decay_reduction;
	mergedMods.hungerDecayScale = (mergedMods.hungerDecayScale ?? 1) * reduction;
	mergedMods.thirstDecayScale = (mergedMods.thirstDecayScale ?? 1) * reduction;
	mergedMods.energyDecayScale = (mergedMods.energyDecayScale ?? 1) * reduction;
}
```

Add `import { InventoryComponent } from '../components/inventory-component.js';` at the top.

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): equipment reduces all need decay rates by configurable percentage`

---

### Task 11: Equipment charge decay at day boundary

**Files:**
- Modify: `src/infrastructure/systems/day-night-system.ts:302-369`
- Modify: `tests/infrastructure/systems/day-night-system.test.ts`

- [ ] **Step 1: Write test**

Test that at day boundary, equipment charges are decremented by 1 for all agents. Test that equipment at 1 charge is removed after decrement.

- [ ] **Step 2: Add equipment decay to processDayBoundary**

After stipends (~line 339) and before facility subsidies, add:

```typescript
// Equipment durability — consume 1 charge per day
for (const agent of agentList) {
	const inv = agent.get(InventoryComponent);
	const hasEquip = inv.state.items.some(i => i.item_id === 'equipment');
	if (!hasEquip) continue;
	const updated = inv.state.items
		.map(i => {
			if (i.item_id !== 'equipment') return { ...i };
			const newCharges = (i.charges ?? 0) - 1;
			return newCharges > 0 ? { ...i, charges: newCharges } : null;
		})
		.filter((i): i is NonNullable<typeof i> => i !== null);
	inv.state = { items: updated };
	inv.markDirty();
}
```

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): equipment loses 1 charge per day, removed at 0`

---

### Task 12: Create craftsman agent, workshop, and behavior tree

**Files:**
- Create: `agents/craftsman.json`
- Create: `locations/workshop.json`
- Create: `behavior-trees/branch-craftsman.mdsl`
- Modify: `locations/house.json`
- Modify: `src/infrastructure/engine/world-loader.ts:49`

- [ ] **Step 1: Create agents/craftsman.json**

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

- [ ] **Step 2: Create locations/workshop.json**

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

- [ ] **Step 3: Create behavior-trees/branch-craftsman.mdsl**

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

- [ ] **Step 4: Update house capacity** 2 → 3

- [ ] **Step 5: Add 'craftsman' to BT_KINDS** in `world-loader.ts:49`

- [ ] **Step 6: Validate MDSL**

```bash
node -e "
const {convertMDSLToJSON, validateDefinition} = require('mistreevous');
const fs = require('fs');
const base = fs.readFileSync('behavior-trees/base.mdsl', 'utf8');
for (const branch of ['branch-settler.mdsl', 'branch-guard.mdsl', 'branch-craftsman.mdsl']) {
  const b = fs.readFileSync('behavior-trees/' + branch, 'utf8');
  convertMDSLToJSON(base + '\n\n' + b);
  const r = validateDefinition(base + '\n\n' + b);
  console.log(branch + ':', r.succeeded ? 'VALID' : 'INVALID: ' + r.errorMessage);
}
"
```

- [ ] **Step 7: Run tests, type check**
- [ ] **Step 8: Commit** `feat(meridian): add craftsman agent, workshop, and role BT`

---

### Task 13: Update settler and base BTs for tools/equipment buying

**Files:**
- Modify: `behavior-trees/branch-settler.mdsl`
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Add tools-buying to settler BT**

In `branch-settler.mdsl`, add after the sell-excess sequences and before the work sequences:

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

- [ ] **Step 2: Add equipment-buying to base BT**

In `base.mdsl`, add a new block between P4 (hungry) and P5 (energy):

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

- [ ] **Step 3: Validate all 3 MDSL files**
- [ ] **Step 4: Commit** `feat(meridian): settler buys tools, all agents buy equipment via base BT`

---

## Chunk 3: Visual Polish & Integration

### Task 14: Add market prices panel to debug overlay

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts:190-210`

- [ ] **Step 1: Add market prices section**

In the debug overlay's `update()` function, after the facilities section (~line 190), add a market prices panel:

```typescript
// Market prices
const marketActor = locationActors.get('loc-market');
if (marketActor !== undefined && marketActor.has(FacilityComponent)) {
	const market = marketActor.get(FacilityComponent);
	lines.push('<div style="margin-top:8px;border-top:1px solid #45475a;padding-top:6px">');
	lines.push('<b>Market Prices</b>');
	const prices = market.state.currentPrices ?? {};
	for (const [itemId, price] of Object.entries(prices)) {
		const basePrice = items.get(itemId)?.baseValue ?? price;
		const color = price < basePrice ? '#a6e3a1' : price > basePrice ? '#f38ba8' : '#cdd6f4';
		const arrow = price < basePrice ? '▼' : price > basePrice ? '▲' : '─';
		lines.push(`  <span style="color:${color}">${itemId}: ${price.toFixed(1)}g ${arrow}</span>`);
	}
	lines.push('</div>');
}
```

This requires passing `itemRegistry` to the overlay. Update `OverlayDeps` to include `getItemRegistry`.

- [ ] **Step 2: Type check**
- [ ] **Step 3: Commit** `feat(meridian): add market prices panel to debug overlay`

---

### Task 15: Add wallet display to agent overlay section

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts:129-187`

- [ ] **Step 1: Add gold to agent header**

In the agent info section (~line 137), add wallet display to the agent name line:

```typescript
const wallet = entity.get(WalletComponent);
lines.push(`<b>${entity.agentName}</b> — 💰 ${wallet.state.gold.toFixed(0)}g`);
```

Import `WalletComponent` at the top of the file.

- [ ] **Step 2: Type check**
- [ ] **Step 3: Commit** `feat(meridian): show agent wallet in debug overlay`

---

### Task 16: Add action labels on agent sprites

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts:86-98`

- [ ] **Step 1: Update thought bubble rendering**

The existing `ensureThoughtBubble()` creates ExcaliburJS Labels for agents. Update the label text to show the current action from `ACTION_DISPLAY`:

```typescript
const action = entity.behaviorAgent.btAction;
const display = action !== null ? ACTION_DISPLAY[action] : undefined;
const labelText = display !== undefined ? `${display.emoji} ${display.label}` : '';
```

Update in the `update()` function where thought bubbles are refreshed (~line 213).

- [ ] **Step 2: Type check**
- [ ] **Step 3: Commit** `feat(meridian): show action emoji labels on agent sprites`

---

### Task 17: Integration test — three-agent economy

**Files:**
- Create: `tests/integration/three-agent-economy.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
describe('three-agent economy integration', () => {
	it('craftsman produces tools into own inventory (private zero-wage)', () => { ... });
	it('tools multiply farm output and consume a charge', () => { ... });
	it('equipment reduces need decay rates', () => { ... });
	it('equipment loses 1 charge at day boundary', () => { ... });
	it('BuyItem sets buyTargetItem for TradeSystem', () => { ... });
	it('FacilityHasStock uses itemId parameter correctly', () => { ... });
});
```

- [ ] **Step 2: Run tests — expect PASS**
- [ ] **Step 3: Commit** `test(meridian): add three-agent economy integration tests`

---

### Task 18: Final verification pass

- [ ] **Step 1: Full test suite** — `npx vitest run --config configs/vitest.config.ts` — 0 failures
- [ ] **Step 2: Type check** — `npx tsc --noEmit --project configs/tsconfig.json` — 0 errors
- [ ] **Step 3: Validate all MDSL files** — settler, guard, craftsman — all VALID
- [ ] **Step 4: Verify data files** — all JSON files parse against schemas
