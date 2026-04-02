# Economy Depth: Local Information & Monetary Policy — Design Spec

> Companion to: `2026-04-01-mistreevous-economy-design.md` (BT migration + base economy loop)
> Date: 2026-04-01 | Status: Draft

---

## Overview

This spec adds three economy layers on top of the base economy loop defined in the mistreevous-economy spec:

1. **Local price information** — Agents observe prices at facilities they visit, building imperfect mental models of the economy. No global price index.
2. **Price elasticity + demand tracking** — Subsistence goods (food) swing harder than luxuries. A sliding-window demand tracker feeds the pricing formula.
3. **Monetary policy** — Velocity tracking, faucet/sink ledger, progressive tax, three-layer safety net.

These layers are additive — they extend the BehaviorAgent, EconomySystem, and game-config without contradicting the base spec.

### Success Criteria

- Agents make purchase decisions from remembered (potentially stale) prices, not omniscient knowledge
- Price spikes in subsistence goods propagate faster and harder than in trade goods
- Monetary velocity is tracked and visible to the Director
- Economy self-stabilizes via progressive tax and tiered safety nets without manual intervention
- All thresholds and multipliers are config-driven (game-config.json, no code changes to rebalance)

---

## 1 · Library Foundations

Three libraries complement ExcaliburJS. Total addition: ~110KB, all MIT, zero transitive deps that matter.

### 1.1 mistreevous 4.3.1

Already specified in the companion spec. BT evaluation engine replacing the custom `evaluateBT()`. Provides parallel, lotto, decorators, guards, callbacks. Headless, Vitest-compatible. Seeded RNG via `options.random()`.

No further design needed here — see `2026-04-01-mistreevous-economy-design.md`.

### 1.2 flatqueue (~600B)

Minimal binary min-heap priority queue.

**Use cases:**
- **Amortized price recalculation** — Facilities are queued with their next recalculation tick. Each tick, EconomySystem pops facilities whose recalc tick has arrived, recalculates prices, and re-queues. Spreads cost evenly instead of all facilities recalculating on the same tick.
- **A* open set** — Optional upgrade to `findRegionPath()` in `pathfinding.ts`. Replaces linear scan with O(log n) extract-min. Not critical at 4-20 regions but free performance headroom.

**API surface used:**
```typescript
import FlatQueue from 'flatqueue';
const q = new FlatQueue<string>();
q.push('bakery', nextRecalcTick);    // item, priority
q.pop();                              // returns item with lowest priority
q.peek();                             // inspect without removing
```

### 1.3 mnemonist (tree-shakeable)

Comprehensive data structure library. Import only what's needed — each import is 1-3KB.

**Structures used:**

| Import | Use Case | Why |
|--------|----------|-----|
| `mnemonist/circular-buffer` | Agent price memories | Fixed-size (20 entries), oldest evicted automatically, no GC pressure |

**Not importing:** Heap (flatqueue covers this), SortedArray (demand tracker uses plain Map + filter — sufficient at current scale, SortedArray is a future optimization if needed), SparseSet (current dirty flags work fine), BiMap, LRUCache.

### 1.4 Libraries Evaluated and Rejected

| Library | Reason for Rejection |
|---------|---------------------|
| rbush / kdbush | ExcaliburJS SparseHashGrid handles spatial queries |
| xstate | Event-driven model conflicts with tick-based architecture; overkill for 3-8 state FSMs |
| robot3 | Good but a custom FSM (~40 lines) fits the domain-purity pattern better |
| simple-statistics | Gini coefficient and regression are ~15 lines each; not worth a dep yet |
| bintrees | mnemonist/sorted-array covers the same need with better maintenance |
| ngraph.path | Custom A* on region graph is already optimal for 4-20 regions |
| pathfinding.js / javascript-astar | Grid-based; Meridian uses polygonal regions |
| msgpack / protobuf / cbor | Binary formats break vault-as-database readability requirement |
| superjson | Not needed until game state uses Maps/Sets beyond JSON types |

---

## 2 · Local Price Information

### 2.1 The Problem

A global price index gives agents perfect information. Every agent always knows the best price for every item at every location. This prevents emergent behavior: no sticker shock, no price discovery, no arbitrage, no exploration incentive.

### 2.2 The Design

Agents observe prices only at facilities they physically visit. Observations are stored as price memories with a staleness window.

**Price memory data structure (per agent, inside BehaviorAgent):**

```typescript
import CircularBuffer from 'mnemonist/circular-buffer';

interface PriceMemory {
    itemId: string;
    price: number;
    locationId: string;
    tick: number;
}

// Fixed-size buffer — oldest memories evicted when full
// Size: 20 (configurable via game-config)
priceMemories: CircularBuffer<PriceMemory>
```

**BehaviorAgent additions** (extending the companion spec's BehaviorAgent interface):

```typescript
// New state property
priceMemories: CircularBuffer<PriceMemory>;

// New condition methods
KnowsFoodSource(): boolean;
// → returns true if any non-stale price memory exists for a subsistence item

CanAffordRememberedFood(): boolean;
// → returns true if agent.gold >= cheapest remembered food price

// New action methods
SeekBestFoodSource(): State;
// → sets movementTarget to the location with cheapest remembered food price
// → returns RUNNING (traveling) or FAILED (no known source)

// Modified existing action
Buy(): State;
// → on completion (success or failure): records a PriceMemory for the item
//   at the facility's current posted price. Agent always learns.
```

### 2.3 Staleness

A price memory's usefulness decays with time. Staleness is a boolean threshold, not a gradient.

```typescript
function isPriceStale(memory: PriceMemory, currentTick: number, staleTicks: number): boolean {
    return (currentTick - memory.tick) > staleTicks;
}
```

Config: `economy.price_memory_stale_ticks` (default: 200 — approximately 1 in-game day at 2Hz ticks). Tunable without code changes.

**Query functions (pure domain):**

```typescript
function getRememberedPrice(
    memories: CircularBuffer<PriceMemory>,
    itemId: string,
    currentTick: number,
    staleTicks: number
): PriceMemory | null {
    let best: PriceMemory | null = null;
    for (const mem of memories) {
        if (mem.itemId !== itemId) continue;
        if (isPriceStale(mem, currentTick, staleTicks)) continue;
        if (!best || mem.tick > best.tick) best = mem;
    }
    return best;
}

function getBestKnownSource(
    memories: CircularBuffer<PriceMemory>,
    itemId: string,
    currentTick: number,
    staleTicks: number
): string | null {
    let cheapest: PriceMemory | null = null;
    for (const mem of memories) {
        if (mem.itemId !== itemId) continue;
        if (isPriceStale(mem, currentTick, staleTicks)) continue;
        if (!cheapest || mem.price < cheapest.price) cheapest = mem;
    }
    return cheapest?.locationId ?? null;
}
```

### 2.4 Emergent Behaviors This Creates

1. **Stale prices** — Agent remembers bread at 5g, arrives to find it's 12g. Buy() fails. Agent must adapt. No scripting needed.
2. **Incomplete knowledge** — Agent only knows food at one location. A cheaper source exists elsewhere but agent hasn't visited it. Exploration has economic value.
3. **Emergent arbitrage** — Elena (merchant) visits many locations via hauling. She accumulates broad price knowledge. Her BT's "buy low" priorities at one location and "sell" at another naturally create price-equalizing behavior — without arbitrage-specific code.
4. **Information asymmetry** — Guards (who patrol) and merchants (who travel) have fresher, broader price knowledge than scholars (who stay at workshops). Role-based economic advantage emerges from movement patterns.

---

## 3 · Price Elasticity & Demand Tracking

### 3.1 Item Categories

Each item belongs to a category that determines how aggressively its price responds to supply/demand changes.

| Category | Elasticity | Behavior | Examples |
|----------|-----------|----------|----------|
| `subsistence` | 1.5 | Volatile — agents must buy regardless of price | wheat, bread, water |
| `comfort` | 1.0 | Neutral — linear price response | rest (tavern), clothing |
| `trade_goods` | 0.7 | Dampened — prices absorb supply shocks | leather, tools, ore |
| `luxury` | 0.4 | Sticky — prices barely move, agents defer purchases | jewelry, books, art |

**Schema change** — Item definitions gain a `category` field:

```typescript
category: z.enum(['subsistence', 'comfort', 'trade_goods', 'luxury']).default('trade_goods')
```

**Config** — Elasticity values per category in game-config.json (not hardcoded per item):

```typescript
// game-config-schema.ts, economy section
elasticity: z.record(z.string(), z.number().min(0).max(3)).default({
    subsistence: 1.5,
    comfort: 1.0,
    trade_goods: 0.7,
    luxury: 0.4,
})
```

Rebalancing = one config change. Items just declare their category.

### 3.2 How Elasticity Enters the Pricing Formula

The facility-side pricing formula from GDD 7.2, extended with elasticity:

```typescript
interface PricingInput {
    baseValue: number;           // from item definition
    demandRate: number;          // from DemandTracker
    supplyCount: number;         // facility stock for this item
    locationHops: number;        // distance from production source
    elasticity: number;          // looked up from config via item category
    pipelineModifiers: number[]; // traits, seasons, world events
    clampMin: number;            // from config (default 0.5)
    clampMax: number;            // from config (default 3.0)
}

function calculatePostedPrice(input: PricingInput): number {
    const scarcityRaw = input.demandRate / Math.max(1, input.supplyCount);
    const scarcity = 1.0 + (scarcityRaw - 1.0) * input.elasticity;
    const locationMod = 1.0 + (input.locationHops * 0.1);
    const pipeline = input.pipelineModifiers.reduce((a, b) => a * b, 1.0);
    const raw = input.baseValue * scarcity * locationMod * pipeline;
    return clamp(raw, input.baseValue * input.clampMin, input.baseValue * input.clampMax);
}
```

Elasticity amplifies or dampens the deviation from 1.0:
- Bread (subsistence, 1.5): scarcityRaw=2.0 → scarcity=2.5 (amplified swing)
- Tools (trade_goods, 0.7): scarcityRaw=2.0 → scarcity=1.7 (dampened swing)

### 3.3 Demand Tracker

A sliding-window tracker that measures consumption rate per item. Feeds the pricing formula's `demandRate` input.

```typescript
interface ConsumptionEvent {
    itemId: string;
    quantity: number;
    tick: number;
}

interface DemandTracker {
    windowSize: number;                         // ticks to look back (from config)
    events: Map<string, ConsumptionEvent[]>;    // itemId → events in window
}

function recordConsumption(
    tracker: DemandTracker,
    itemId: string,
    quantity: number,
    tick: number
): void {
    const list = tracker.events.get(itemId) ?? [];
    list.push({ itemId, quantity, tick });
    tracker.events.set(itemId, list);
}

function getDemandRate(
    tracker: DemandTracker,
    itemId: string,
    currentTick: number
): number {
    const list = tracker.events.get(itemId) ?? [];
    const cutoff = currentTick - tracker.windowSize;
    const inWindow = list.filter(e => e.tick >= cutoff);
    tracker.events.set(itemId, inWindow);  // prune as side effect
    return inWindow.reduce((sum, e) => sum + e.quantity, 0);
}
```

**Event source:** `PurchaseComplete` events emitted by the TradeSystem on successful purchase. EconomySystem listens and calls `recordConsumption()`. No new system coupling.

**Transition from fixed `food_price` to dynamic pricing:** The companion spec defines `food_price: 3` as a fixed config value. This spec's `calculatePostedPrice()` replaces it with dynamic pricing. The `food_price` config field becomes the `baseValue` for bread in the item definition. The config field is deprecated — `baseValue` per item is the source of truth, and the pricing formula applies scarcity, elasticity, and modifiers on top.

**Side-effect note:** `getDemandRate()` prunes expired events as a side effect inside a read function. This is an intentional optimization to avoid a separate pruning pass — acceptable because the DemandTracker is owned by the EconomySystem (infrastructure layer), not a shared domain object.

**Config:** `economy.demand_window_ticks` (default: 500 — approximately 4 in-game days). Shorter = prices respond faster. Longer = smoother prices.

---

## 4 · Monetary Policy

### 4.1 Gold Flow Classification

Every gold movement is exactly one of three categories:

**Faucets (gold enters circulation):**
- Agent stipend on spawn
- Treasury regeneration (configured `treasury_regen_per_day`, default 50 — see companion spec §1.4)
- Merchant caravan world events
- Guaranteed recovery events (GDD 20.3 Layer 2)

**Sinks (gold leaves circulation):**
- Equipment repair costs (no recipient — gold destroyed)
- Import costs (paid to off-map merchants who never spend locally)
- Construction material costs (gold consumed, not transferred)
- Administrative fees (configurable percentage of transactions vanishes)

**Transfers (gold moves, total supply unchanged):**
- Wages: facility fund → agent wallet
- Purchases: agent wallet → facility fund
- Tax: trade amount → Director treasury
- Quest rewards: treasury → agent wallet
- Rest payments: agent wallet → tavern fund
- Welfare: treasury → agent wallet

**Key insight:** The base economy spec is almost entirely transfers. That's healthy — gold circulates. But without explicit sinks, every faucet permanently increases the money supply, causing inflation over long sessions.

### 4.2 Monetary Ledger

Pure domain data structure recording all gold flows:

```typescript
type FlowCategory = 'faucet' | 'sink' | 'transfer';

interface GoldFlow {
    category: FlowCategory;
    subcategory: string;    // 'wage' | 'purchase' | 'tax' | 'stipend' | 'repair' | ...
    amount: number;
    tick: number;
    fromEntity: string | null;  // null for faucets
    toEntity: string | null;    // null for sinks
}

interface MonetaryLedger {
    flows: GoldFlow[];      // pruned on each snapshot calculation (flows older than windowSize are dropped)
    windowSize: number;     // ticks for velocity calculation (from config)
}
```

**Event source:** New `GoldFlowed` event type on the EventBus. Every **system** that moves gold emits this event with the flow data — Buy(), Work(), welfare, stipend, etc. The WalletComponent itself does NOT emit events (components are plain state containers per the TrackedComponent pattern). MonetaryPolicySystem listens and records. One new event type, not a new coupling pattern.

### 4.3 Velocity Calculation

Monetary velocity = how fast gold circulates. The single most important metric for economy health.

```typescript
interface MonetarySnapshot {
    moneySupply: number;       // all agent wallets + facility funds + treasury
    velocity: number;          // transferVolume / moneySupply
    faucetRate: number;        // gold created in window
    sinkRate: number;          // gold destroyed in window
    netFlow: number;           // faucetRate - sinkRate (positive = inflationary)
}

function calculateMonetarySnapshot(
    ledger: MonetaryLedger,
    currentTick: number,
    allGoldBalances: number[],
    treasuryGold: number
): MonetarySnapshot {
    const cutoff = currentTick - ledger.windowSize;
    const recent = ledger.flows.filter(f => f.tick >= cutoff);

    const moneySupply = allGoldBalances.reduce((a, b) => a + b, 0) + treasuryGold;
    const transferVolume = recent
        .filter(f => f.category === 'transfer')
        .reduce((sum, f) => sum + f.amount, 0);
    const faucetTotal = recent
        .filter(f => f.category === 'faucet')
        .reduce((sum, f) => sum + f.amount, 0);
    const sinkTotal = recent
        .filter(f => f.category === 'sink')
        .reduce((sum, f) => sum + f.amount, 0);

    return {
        moneySupply,
        velocity: moneySupply > 0 ? transferVolume / moneySupply : 0,
        faucetRate: faucetTotal,
        sinkRate: sinkTotal,
        netFlow: faucetTotal - sinkTotal,
    };
}
```

**Healthy ranges (configurable):**

| Metric | Stagnant | Healthy | Overheated |
|--------|----------|---------|------------|
| Velocity | < 0.2 | 0.3 – 0.8 | > 1.5 |
| Net flow | < -5g/day | +/-2g/day | > +10g/day |

### 4.4 Progressive Tax (Rubber-Banding)

The GDD's flat 5% trade tax becomes velocity-responsive:

```typescript
function getEffectiveTaxRate(
    baseTax: number,
    velocity: number,
    thresholds: { stagnant: number; overheated: number },
    multipliers: { stagnant: number; overheated: number }
): number {
    if (velocity > thresholds.overheated) return baseTax * multipliers.overheated;
    if (velocity < thresholds.stagnant) return baseTax * multipliers.stagnant;
    return baseTax;
}
```

Tax is the gentlest intervention: doesn't change prices, doesn't force agent behavior, fully observable by the Director.

### 4.5 Three-Layer Safety Net

Each layer activates at increasing severity. All thresholds from config.

```
Layer 1: Welfare Floor (existing — companion spec)
  Trigger:  agent.gold < welfare_threshold (default: 10)
  Action:   treasury → agent (subsistence gold)
  Effect:   prevents individual starvation
  Source:   companion spec, already designed

Layer 2: Velocity Stimulus (new)
  Trigger:  velocity < stagnant threshold for stimulus_trigger_ticks consecutive ticks (default: 50)
  Action:   treasury regen rate doubles + tax rate halved
  Effect:   injects gold and reduces drain simultaneously
  Duration: stimulus_duration_ticks (default: 100), then re-evaluate

Layer 3: Emergency Recovery Event (new, implements GDD 20.3 Layer 2)
  Trigger:  velocity < critical threshold (default: 0.1)
  Action:   emit WorldEvent "merchant caravan arrives"
            — faucet: injects gold + goods into economy
  Effect:   breaks death spiral with a narrative event
  Cooldown: one caravan per 500 ticks maximum
```

Each layer is a pure domain function. MonetaryPolicySystem checks thresholds each tick and emits events when interventions trigger.

### 4.6 Tick Pipeline Placement

```
Existing:
  ... → EconomySystem (16) → WorldEventSystem (17) → ...

Extended:
  ... → EconomySystem (16)          — price recalculation + demand tracking
      → MonetaryPolicySystem (16.5) — velocity, tax adjustment, safety nets
      → WorldEventSystem (17)       — may receive "caravan" from Layer 3
      → ...
```

MonetaryPolicySystem is a new system at priority 16.5. Runs after EconomySystem (needs fresh prices) and before WorldEventSystem (may trigger recovery events). Pure domain function + infrastructure wrapper, consistent with dual-layer pattern.

**Timing confirmation:** PurchaseComplete events are emitted by TradeSystem (priority 11) during trade execution. By priority 16, all trades for the current tick have completed. EconomySystem (16) records consumption in the demand tracker and recalculates prices using fresh demand data. MonetaryPolicySystem (16.5) then reads the updated prices and money supply to compute velocity and evaluate safety net triggers.

---

## 5 · Pinia Bridge — Economy Data to Director's Console

### 5.1 Data Shapes Crossing the UIBridge

UIBridgeSystem (tick 20) snapshots economy state after all economy systems have run. Three shapes flow to Pinia:

**To useEconomyStore:**

```typescript
interface EconomySnapshot {
    facilityPrices: Array<{
        facilityId: string;
        locationId: string;
        prices: Record<string, number>;     // itemId → posted price
        stock: Record<string, number>;       // itemId → quantity
    }>;
    monetary: MonetarySnapshot;
    activeInterventions: Array<{
        layer: 1 | 2 | 3;
        type: string;                        // 'welfare' | 'stimulus' | 'recovery_event'
        startTick: number;
        targetEntity?: string;
    }>;
    demandRates: Record<string, number>;     // itemId → consumption in window
}
```

**To useAgentStore (per agent, extending existing snapshot):**

```typescript
interface AgentEconomySnapshot {
    gold: number;
    priceMemoryCount: number;
    lastKnownPrices: Record<string, {
        price: number;
        locationId: string;
        tick: number;
        stale: boolean;
    }>;
}
```

### 5.2 Pinia Store Shape

**useEconomyStore:**

```typescript
interface EconomyStoreState {
    facilityPrices: EconomySnapshot['facilityPrices'];
    monetary: MonetarySnapshot;
    activeInterventions: EconomySnapshot['activeInterventions'];
    demandRates: EconomySnapshot['demandRates'];

    // Derived (computed)
    economyHealth: 'stagnant' | 'healthy' | 'overheated';
    effectiveTaxRate: number;
    inflationTrend: 'deflationary' | 'stable' | 'inflationary';

    // History (plain arrays, capped at 50 entries via .shift() on push — no mnemonist needed in UI layer)
    velocityHistory: number[];          // last 50 snapshots
    moneySupplyHistory: number[];
    priceHistory: Record<string, number[]>;
}
```

### 5.3 Director Actions

Available from the economy panel, dispatched as `DirectorAction` events (same pattern as quest creation):

| Action | Effect | Cost |
|--------|--------|------|
| Adjust tax rate override | Set within [0%, 15%] bounds | Free |
| Trigger caravan manually | Injects gold + goods (faucet) | Treasury gold |
| Set price cap on item | Adds a `directorPriceCap` override to the facility's item entry; `calculatePostedPrice()` applies `Math.min(result, cap)` as a post-calculation clamp | Free |
| Subsidize facility | Treasury → facility fund transfer | Treasury gold |

---

## 6 · Config Additions

All new config lives in the `economy` section of `game-config-schema.ts`:

```typescript
// Extending the existing economy section
price_memory_max: z.number().default(20),
price_memory_stale_ticks: z.number().default(200),

demand_window_ticks: z.number().default(500),

elasticity: z.record(z.string(), z.number().min(0).max(3)).default({
    subsistence: 1.5,
    comfort: 1.0,
    trade_goods: 0.7,
    luxury: 0.4,
}),

monetary_policy: z.object({
    velocity_window_ticks: z.number().default(500),
    velocity_healthy_min: z.number().default(0.3),
    velocity_healthy_max: z.number().default(0.8),
    velocity_stagnant: z.number().default(0.2),
    velocity_overheated: z.number().default(1.5),
    velocity_critical: z.number().default(0.1),
    stimulus_duration_ticks: z.number().default(100),
    caravan_cooldown_ticks: z.number().default(500),
    stimulus_trigger_ticks: z.number().default(50),
    tax_base_rate: z.number().default(0.10),  // aligned with companion spec's 10% rate
    tax_stagnant_multiplier: z.number().default(0.5),
    tax_overheated_multiplier: z.number().default(1.5),
    admin_fee_rate: z.number().default(0.02),
}).default({}),
```

---

## 7 · New & Modified Files

### New Domain Files

| File | Purpose |
|------|---------|
| `domain/systems/pricing.ts` | `calculatePostedPrice()` pure function |
| `domain/systems/demand-tracker.ts` | Sliding-window consumption tracking |
| `domain/systems/monetary-policy.ts` | Velocity, faucet/sink ledger, safety nets |
| `domain/systems/price-memory.ts` | Agent price memory queries (getRemembered, getBestSource, isStale) |

### New Infrastructure Files

| File | Purpose |
|------|---------|
| `infrastructure/systems/monetary-policy-system.ts` | MonetaryPolicySystem wrapper (priority 16.5) |
| `infrastructure/components/economy.ts` | EconomyComponent (per-facility: prices, stock, demand data) |

### Modified Files

| File | Change |
|------|--------|
| `domain/schemas/game-config-schema.ts` | Add elasticity, monetary_policy, price_memory, demand_window config |
| `domain/schemas/item-schema.ts` | Add `category` field (subsistence/comfort/trade_goods/luxury) |
| `domain/core/events.ts` | Add `GoldFlowed` event type |
| `infrastructure/systems/economy-system.ts` | Wire pricing formula + demand tracker + recalc queue |
| Systems that move gold (Buy, Work, welfare, stipend, etc.) | Emit `GoldFlowed` event after each gold transfer/creation/destruction |
| `behavior-agent.ts` (from companion spec) | Add `priceMemories`, `KnowsFoodSource()`, `CanAffordRememberedFood()`, `SeekBestFoodSource()` |

### New Test Files

| File | Coverage Target |
|------|----------------|
| `tests/domain/systems/pricing.test.ts` | Formula correctness, elasticity scaling, clamp bounds |
| `tests/domain/systems/demand-tracker.test.ts` | Window pruning, consumption recording, empty state |
| `tests/domain/systems/monetary-policy.test.ts` | Velocity calculation, safety net triggers, tax adjustment |
| `tests/domain/systems/price-memory.test.ts` | Staleness, best source, circular buffer eviction |
| `tests/integration/economy-flow.test.ts` | Multi-tick scenario: price change → agent reaction → monetary snapshot |

---

## 8 · Implementation Order

This spec layers on top of the companion spec's implementation. It should be implemented after the BehaviorAgent + base economy loop is working.

```
Chunk 1: Foundations (no game impact yet)
  ├─ Install flatqueue, mnemonist
  ├─ pricing.ts + tests (pure formula, no ECS)
  ├─ demand-tracker.ts + tests (pure data structure)
  └─ price-memory.ts + tests (pure query functions)

Chunk 2: Wire Into Simulation
  ├─ Add category to item schema + item definitions
  ├─ Add economy config (elasticity, demand_window, price_memory)
  ├─ Extend EconomySystem to use pricing.ts + demand tracker
  ├─ Extend BehaviorAgent with priceMemories + condition/action methods
  ├─ Update MDSL trees: replace `CanAffordFood`/`SeekFood` with `CanAffordRememberedFood`/`SeekBestFoodSource`
  │   (the remembered-price variants replace the companion spec's fixed-price variants — not additive)
  └─ Integration test: price recalculation responds to consumption

Chunk 3: Monetary Policy
  ├─ monetary-policy.ts + tests (velocity, ledger, safety nets)
  ├─ Add GoldFlowed event type
  ├─ MonetaryPolicySystem (priority 16.5) + wrapper
  ├─ Wire wallet changes to emit GoldFlowed
  ├─ Add monetary_policy config section
  └─ Integration test: velocity drops → stimulus triggers → velocity recovers

Chunk 4: Pinia Bridge (Phase 8 — deferred)
  ├─ Extend UIBridgeSystem with EconomySnapshot
  ├─ useEconomyStore implementation
  ├─ Extend useAgentStore with AgentEconomySnapshot
  └─ Director action handlers (tax override, caravan, price cap, subsidy)
```

Chunks 1-3 are simulation-only (no UI). Chunk 4 is Phase 8 scope — designed now, built later.

---

## 9 · Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Stale price info causes agent starvation spiral | Medium | Medium | Welfare floor (Layer 1) catches it. Tunable staleness window. |
| Elasticity values need heavy tuning | High | Low | All config-driven. Start with defaults, adjust via observation. |
| Demand tracker memory grows unbounded | Low | Medium | Window pruning on every read. Max events = agents x items x window. |
| Velocity metric is noisy with few agents | Medium | Low | Larger window smooths it. 5+ agents needed for meaningful signal. |
| Admin fee sink feels arbitrary | Low | Low | Configurable rate, can be set to 0. Narratively framed as "guild fees." |

---

## 10 · Future Extensions (Not In Scope)

These can layer on without architectural changes:

- **Sealed-bid auctions** for land plots (Phase 7)
- **Agent price trend detection** via linear regression on price memories
- **Gini coefficient** tracking for wealth inequality
- **Seasonal stockpiling** — agents buy extra before winter if they detect rising prices
- **Price charts** in Director's console (sparkline data is already in store)
- **Agent-to-agent trade comparison** view in UI
