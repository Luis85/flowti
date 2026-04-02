# Multi-Agent Supply & Demand Economy

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Second agent (guard), food reserve mechanic, treasury-funded facilities, reservation pricing, per-agent treasury scaling, critical economy bug fixes

## Problem

The current single-agent economy is a closed loop: the settler farms food, sells it at market, then buys it back when hungry. The market serves no real purpose. A functioning supply/demand model requires at least two agents with different roles — one producing, one consuming — with the market as the exchange hub.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Second agent role | Guard (pure consumer) | Simplest proof of supply/demand — no food production, must buy everything |
| Excess detection | Reserve threshold (config: `food_reserve: 3`) | Stable buffer, prevents sell-then-starve loop, tunable |
| Guard income | Treasury-funded guard post facility | Public servant model, reuses FacilitySystem |
| Facility model | Two tiers: private (`funding: "facility"`) vs public (`funding: "treasury"`) | Clean separation, schema-driven, extensible |
| Housing | Increase cottage capacity to 2 | Minimal change, creates future scarcity pressure |
| Pricing model | Posted prices + reservation price check | Research-backed: posted prices for facilities, willingness-to-pay for buyers (see Research Basis) |
| Treasury scaling | Per-agent treasury regen | Prevents money supply dilution as agents are added |

## Schema Changes

### ProductionSchema — funding field

```typescript
// location-schema.ts
funding: z.enum(['facility', 'treasury']).default('facility')
```

- `"facility"` (default): wages debit `facility.fund`. Existing behavior unchanged.
- `"treasury"`: wages debit `economy.state.treasury`. No facility fund needed for wages.

### NeedsConfigSchema — food reserve

```typescript
// game-config-schema.ts
food_reserve: z.number().int().default(3)
```

Minimum food units a producing agent keeps before selling excess. Added to `game-config.json` under `needs`.

### BT_KINDS expansion

```typescript
// world-loader.ts
const BT_KINDS = ['settler', 'guard'] as const;
```

## Guard Agent

**File:** `agents/guard.json`

```json
{
  "id": "agent-guard",
  "name": "Guard",
  "kind": "guard",
  "color": "#5c6bc0",
  "attributes": { "ST": 14, "DX": 12, "IQ": 10, "HT": 13 },
  "social": { "status": 1, "reputation": 1, "charisma": 10 },
  "needs": { "hunger": 80, "energy": 80, "social": 50, "thirst": 80 },
  "inventory": [
    { "item_id": "food", "quantity": 3 },
    { "item_id": "waterskin", "quantity": 1, "charges": 3 }
  ],
  "wallet": { "gold": 30 },
  "position": { "x": 260, "y": 220, "region": "region-valley" },
  "behavior_tree": "guard",
  "job": null
}
```

- Higher ST/HT (physical role), lower IQ
- Starts with 3 food (matches reserve threshold) and 30g
- Must enter the economy quickly to survive

## Guard Post Location

**File:** `locations/guard-post.json`

```json
{
  "id": "loc-guard-post",
  "name": "Guard Post",
  "type": "work",
  "position": { "x": 230, "y": 180 },
  "color": "#78909c",
  "production": {
    "job": "guard",
    "output": { "item_id": "security", "quantity": 1 },
    "input": null,
    "wage": 4,
    "ticks_per_cycle": 20,
    "funding": "treasury"
  },
  "capacity": 1
}
```

- `type: "work"` — generic work location
- `funding: "treasury"` — wages from town treasury
- `wage: 4` — higher than farmer (3) to offset buying all food
- `output: "security"` — abstract, non-tradeable work product

## Behavior Trees

### Guard role branch (`branch-guard.mdsl`)

```
root [Role] {
    selector {
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsWorkHours)
        }
        sequence {
            condition [HasJob]
            action [SeekWork]
        }
        action [Wander]
    }
}
```

Simple: work, seek work, or wander. All survival (eat, drink, rest, buy food) handled by `base.mdsl` priorities P0-P6.

### Settler role branch changes (`branch-settler.mdsl`)

Replace `HasFood` with `HasFoodReserve` in sell branches:

```
/* Sell excess at market — only if not hungry AND above reserve */
sequence {
    condition [AtLocation, "market"]
    condition [HasFoodReserve]
    flip { condition [IsHungry] }
    action [SellAtMarket]
}
sequence {
    condition [HasFoodReserve]
    flip { condition [IsHungry] }
    action [SeekMarket]
}
```

### New BT condition: `HasFoodReserve`

```typescript
HasFoodReserve(): boolean {
    const food = findFoodInInventory(agent.inventory);
    if (food === null) return false;
    return food.quantity > config.needs.food_reserve;
}
```

Returns true only when food quantity exceeds the reserve threshold.

## FacilitySystem Treasury Funding

### Wage payment logic

When processing a production cycle completion:

```
if (production.funding === 'treasury') {
    actualWage = Math.min(wage, treasury)
    treasury -= actualWage
    worker.gold += actualWage  // no tax — money is already public
    emit GoldFlowed { category: 'transfer', subcategory: 'public_wage' }
} else {
    // existing logic unchanged
    actualWage = Math.min(wage, facility.fund)
    tax = actualWage * taxRate
    facility.fund -= actualWage
    worker.gold += (actualWage - tax)
    treasury += tax
}
```

Key rules:
- Treasury-funded wages: no tax (circular to tax public money back to treasury)
- Partial wage if treasury is broke (`actualWage = Math.min(wage, treasury)`)
- Guard post `FacilityComponent` initialized with `fund: 0` (fund irrelevant for treasury-funded)
- `GoldFlowed` event uses `subcategory: 'public_wage'` for monetary tracking

### FacilityComponent initialization (`game-view.ts`)

`game-view.ts` initializes a `FacilityComponent` for every location with `production !== null`, unconditionally setting `fund: deps.config.economy.facility_start_fund`. For treasury-funded facilities this is wrong — they should start with `fund: 0`. The initialization must branch on `production.funding`:

```typescript
const fund = loc.production.funding === 'treasury' ? 0 : deps.config.economy.facility_start_fund;
marker.addComponent(new FacilityComponent({ stock: startingStock, fund, ... }));
```

### Location lookup

`FacilitySystem` already receives `getLocations()`. To determine funding source, match the facility's location actor to its `WorldLocation` definition and read `production.funding`. The branching happens in `facility-system.ts`'s `processFacilityTick()` — before calling `applyFacilityTick`, check the funding source and pass the appropriate fund (facility's own fund or `economy.state.treasury`).

## Economy Flow

```
FARMER                              GUARD
  |                                   |
  +- Work at farm                     +- Work at guard post
  +- Harvest food -> inventory        +- Cycle complete -> treasury pays 4g
  +- inventory > reserve(3)?          |
  |   yes -> sell excess at market    +- Hungry -> eat from inventory
  |   (market.stock grows)            |   no food -> buy from market
  |                                   |   (market.stock shrinks)
  +- Hungry -> eat from inventory     |
  |   (never below reserve)           |
  +- Night -> rest at cottage         +- Night -> rest at cottage (cap 2)
```

**Money circulation:**
- Treasury -> guard wages (~52g/day at ~13 cycles)
- Guard -> market (buys food)
- Market -> farmer (pays for food sold)
- Treasury regenerates 50g/day

**Natural supply/demand emergence:**
- Farmer productive -> market well-stocked -> prices stay low -> guard thrives
- Farmer slows down -> supply drops -> prices rise -> guard struggles
- Treasury broke -> guard unpaid -> can't buy food -> survival pressure

## Reservation Price System

Agents should not blindly buy at any affordable price. Instead, each agent calculates a *reservation price* — the maximum they're willing to pay — based on need urgency, current stock, and budget. This is the core mechanism that makes supply/demand emergent.

### Research basis

- **Marginal utility theory**: the 1st food unit when starving is far more valuable than the 10th when well-fed
- **Victoria 3**: pops have tiered needs and substitute goods based on price — our simplified version
- **Kenshi**: location-based posted prices with regional modifiers — matches our `calculatePostedPrice()`
- **BazaarBot (Doran & Parberry)**: double auction with belief ranges — too complex for 2-10 agents, but the *price belief* concept informed our reservation price approach
- **Dwarf Fortress warning**: internal economy removed in 2014 because agents couldn't afford meals — our reservation price prevents this by letting urgent agents pay more

### Domain function: `calculateReservationPrice()`

**File:** `src/domain/systems/utility.ts` (new)

```typescript
interface ReservationPriceInput {
  baseValue: number;       // item's base price from config (e.g., food_price: 5)
  needLevel: number;       // 0-100, current need satisfaction (hunger value)
  needThreshold: number;   // below this = urgent (e.g., hunger_threshold: 40)
  currentStock: number;    // how many of this item the agent already holds
  walletGold: number;      // total gold available
}

function calculateReservationPrice(input: ReservationPriceInput): number {
  // Urgency multiplier: exponential increase as need drops below threshold
  const urgency = input.needLevel < input.needThreshold
    ? 1 + ((input.needThreshold - input.needLevel) / input.needThreshold) * 2  // 1x to 3x
    : Math.max(0.3, input.needLevel / 100);                                     // 0.3x to 1x

  // Diminishing returns on stockpiling
  const stockPenalty = 1 / (1 + input.currentStock * 0.5);

  // Budget constraint: when not desperate, cap at 30% of wallet
  // When need is critical, allow spending up to 80% (survival override)
  const capRatio = input.needLevel < input.needThreshold ? 0.8 : 0.3;
  const budgetCap = input.walletGold * capRatio;

  const rawReservation = input.baseValue * urgency * stockPenalty;
  return Math.min(rawReservation, budgetCap);
}
```

### Behavior examples

| Agent State | Reservation Price | Market Price (5g) | Buys? |
|-------------|------------------|-------------------|-------|
| Guard, hunger=10 (starving), 0 food, 30g wallet | `5 * 2.5 * 1.0 = 12.5g` (capped at 9g by budget) | 5g | Yes — desperate |
| Guard, hunger=60 (fine), 2 food, 20g wallet | `5 * 0.6 * 0.5 = 1.5g` | 5g | No — well-stocked |
| Farmer, hunger=35 (hungry), 3 food (at reserve), 40g wallet | `5 * 1.25 * 0.4 = 2.5g` | 5g | No — has reserve |
| Guard, hunger=25 (urgent), 0 food, 8g wallet | `5 * 1.75 * 1.0 = 8.75g` (capped at 6.4g by 80% critical cap) | 5g | Yes — desperate, spends most of wallet |

### Integration with Buy action

The `CanAffordFood()` BT condition is updated to include the reservation price check:

```typescript
CanAffordFood(): boolean {
  const price = getCheapestKnownPrice();
  const reservationPrice = calculateReservationPrice({
    baseValue: config.economy.food_price,
    needLevel: agent.hunger,
    needThreshold: config.needs.hunger_threshold,
    currentStock: countFoodInInventory(agent.inventory),
    walletGold: agent.gold,
  });
  return agent.gold >= price && price <= reservationPrice;
}
```

This means `CanAffordFood` now returns false when the posted price exceeds what the agent is willing to pay. The agent will wait, seek cheaper sources, or go hungry — creating natural demand elasticity.

### Config parameters

Added to `EconomyConfigSchema`:

```typescript
reservation_urgency_max: z.number().default(3),     // max multiplier when need is critical
reservation_stock_factor: z.number().default(0.5),   // diminishing return steepness
reservation_budget_cap: z.number().default(0.3),     // max fraction of wallet per purchase (non-critical)
reservation_budget_cap_critical: z.number().default(0.8), // max fraction when need is below threshold
```

## Per-Agent Treasury Scaling

### Problem

Fixed `treasury_regen_per_day: 50` doesn't scale. With 2 agents it's tight but workable. With 10 agents the treasury can't fund all public wages, and the economy starves.

### Solution

Replace with per-agent scaling:

```typescript
// game-config-schema.ts — EconomyConfigSchema
treasury_regen_per_agent_per_day: z.number().default(25)
```

**DayNightSystem** day-boundary logic changes from:

```typescript
treasury += config.economy.treasury_regen_per_day;
```

to:

```typescript
treasury += config.economy.treasury_regen_per_agent_per_day * agentCount;
```

With 2 agents: 50g/day (same as current). With 5 agents: 125g/day. Scales naturally.

The old `treasury_regen_per_day` field is removed from both schema and `game-config.json`.

## Stipend Deprecation

The existing `DayNightSystem` pays a daily `guard_stipend` (default: 2g) from treasury to any agent with `job === 'guard'`. With treasury-funded wages now paying ~52g/day, this stipend would double-pay the guard.

**Fix:** Set `guard_stipend: 0` in `game-config.json`. The stipend config field remains in the schema for future non-treasury-funded roles that may need daily income without a facility, but the guard no longer uses it. `DayNightSystem` can optionally skip stipend for agents whose facility has `funding: "treasury"`.

## Bundled Bug Fixes

These four issues from the codebase review directly block a working two-agent economy:

### 1. Market excluded from price recalculation

**Problem:** `EconomySystem` only queues facilities with `production !== null`. Market has `production: null`, so `currentPrices` stays `undefined`. Sell price falls back to hardcoded 5, buy price to config 3.

**Fix:** Include market-type locations in the `EconomySystem` recalculation queue regardless of `production` field.

### 2. SellAtMarket hardcoded fallback price

**Problem:** `behavior-agent-factory.ts:460` uses `?? 5` instead of `config.economy.food_price`.

**Fix:** Replace hardcoded 5 with `deps.config.economy.food_price` passed through `BehaviorAgentDeps`.

### 3. btAction never reset between ticks

**Problem:** Stale `btAction` values cause downstream systems to fire incorrectly (e.g., FeedSystem consuming food when agent stopped eating).

**Fix:** Reset `btAction = null` at the start of each BT step, before tree evaluation.

### 4. Mood calculation excludes thirst

**Problem:** `mood-system.ts` uses `NEEDS_SUM_MAX = 300` (3 needs). Thirst is excluded from mood despite being a full gameplay need.

**Fix:** Add `needs.state.thirst` to the satisfaction sum and update `NEEDS_SUM_MAX` to 400.

## Files Changed

| File | Change |
|------|--------|
| `agents/guard.json` | **New** — guard agent definition |
| `locations/guard-post.json` | **New** — treasury-funded guard post |
| `locations/house.json` | Capacity 1 -> 2 |
| `behavior-trees/branch-guard.mdsl` | **New** — guard role BT |
| `behavior-trees/branch-settler.mdsl` | HasFood -> HasFoodReserve in sell branches |
| `src/domain/systems/utility.ts` | **New** — `calculateReservationPrice()` |
| `src/domain/schemas/location-schema.ts` | Add `funding` field to ProductionSchema |
| `src/domain/schemas/game-config-schema.ts` | Add `food_reserve` to NeedsConfigSchema, reservation price params to EconomyConfigSchema, replace `treasury_regen_per_day` with `treasury_regen_per_agent_per_day` |
| `configs/game-config.json` | Add `food_reserve: 3`, reservation price params, update treasury regen, set `guard_stipend: 0` |
| `src/infrastructure/engine/world-loader.ts` | Add `'guard'` to BT_KINDS |
| `src/infrastructure/entity/behavior-agent-factory.ts` | Add `HasFoodReserve` condition, integrate reservation price into `CanAffordFood`, fix `SellAtMarket` price fallback |
| `src/infrastructure/systems/behavior-tree-system.ts` | Reset `btAction = null` before each BT step |
| `src/infrastructure/systems/facility-system.ts` | Treasury funding path in wage logic (branch in `processFacilityTick`) |
| `src/infrastructure/engine/game-view.ts` | Branch FacilityComponent init on `production.funding` (fund: 0 for treasury) |
| `src/infrastructure/systems/economy-system.ts` | Include market in price recalc queue |
| `src/infrastructure/systems/day-night-system.ts` | Per-agent treasury regen scaling |
| `src/infrastructure/systems/mood-system.ts` | Include thirst in needsSatisfaction |
| Tests | New tests for reservation price, guard BT, HasFoodReserve, treasury funding, per-agent regen, mood thirst |
