# Mistreevous BT Migration & Economy Foundation — Design Spec

> **Date:** 2026-04-01
> **Status:** Approved (brainstorm validated)
> **Scope:** Replace custom BT engine with mistreevous, restructure agent roles, fix economy loop, agent-carried logistics, typed BehaviorAgent replacing stringly-typed blackboard.
> **Context:** The custom BT has no RUNNING state (causes oscillation), the blackboard is untyped (`Record<string, unknown>`), the bakery supply chain is broken (no inter-facility transfer), agent roles have job/BT mismatches, and gold sinks are buggy. This spec designs a foundational simulation that sustains 4 agents over multi-day runs.

---

## Success Criteria

1. All 4 agents sustain themselves over a multi-day simulation — they eat, rest, work, earn gold, buy food, and don't starve or go bankrupt
2. Supply chains are agent-driven — wheat physically moves from farm to bakery via an agent carrying it
3. Each agent has a meaningful distinct role — no duplicate jobs, no job/BT mismatches
4. The BT oscillation class of bugs is eliminated — agents commit to actions via RUNNING state and guards
5. Gold sinks and faucets are balanced — rest payment works correctly, facilities don't drain to zero without recourse
6. The economy survives without welfare bailouts as the primary mechanism — welfare is a safety net, not the main income loop

---

## 1 · The Economic Loop — A Day in the Village

### 1.1 The World

Six locations, four agents, three production facilities, one supply chain:

```
Farm (wheat) ──agent carries──▸ Bakery (wheat→bread) ──agent buys──▸ Agents eat bread
Workshop (leather-goods) ──agent buys──▸ Agents equip/trade
Tavern (rest), Town Square (social), Market (trade hub)
```

### 1.2 The Roles

| Agent | Kind | Job | Role BT Branch | Economic Function |
|-------|------|-----|----------------|-------------------|
| **Marcus** | guard | guard | `branch-guard` | Patrols town square, buys food/rest, earns treasury stipend |
| **Elena** | merchant | merchant | `branch-merchant` | Buys goods from facilities, hauls between locations, sells at market |
| **Sable** | artisan | leatherworker | `branch-artisan` | Works workshop, produces leather-goods, buys food |
| **Wren** | scholar | farmer | `branch-scholar` | Works the farm, produces wheat, buys food |

Key changes from current state:

- Marcus is no longer a duplicate farmer — he's a guard (matches his `kind`)
- Elena is no longer a baker with a merchant BT — she's a full merchant who hauls goods
- The merchant role is the logistics backbone — Elena carries wheat from farm to bakery, and distributes bread
- Each agent has a unique job at a unique facility (or role)

### 1.3 The Supply Chain

```
Wren works Farm → produces wheat (stored in Farm stock)
Elena picks up wheat from Farm (free) → carries to Bakery → deposits in Bakery stock
Bakery auto-produces bread when stocked with wheat (communal oven, no dedicated baker)
Elena picks up bread from Bakery (free) → carries to Market/Town Square
Elena deposits bread at destination facility stock → Agents buy bread from facility at food_price (3 gold)
Sable works Workshop → produces leather-goods (stored in Workshop stock)
```

**Bread distribution is passive, not agent-to-agent.** Elena's `DeliverCargo` action deposits goods into a destination facility's stock. Agents buy bread from facilities using the existing `Buy` action. There is no agent-to-agent trade — Elena is a treasury-funded hauler/distributor, not a direct seller. This keeps the trade system simple and avoids the need for a `Sell` action.

**Pickup is free for hauling agents.** Elena doesn't pay for goods she picks up — she's performing a public logistics service funded by her merchant stipend from the treasury. The `PickupCargo` action transfers goods from facility stock to the agent's `haulCargo` without gold exchange.

The bakery problem is solved structurally — wheat arrives via Elena's hauling behavior, not via a broken inter-facility system. If Elena is sick or busy, the bakery runs out of wheat and bread production stalls. That's emergent, not a bug.

### 1.4 Gold Flow

**Important: Production rates are daytime-only.** Agents only work during the `day` phase (ticks 60-299 = 240 ticks). All wage/production estimates below use 240 ticks, not 480.

```
Treasury (1000 start, +50 regen/day "off-screen trade")
  ├──guard stipend──▸ Marcus (2/day)
  ├──merchant stipend──▸ Elena (8/day)
  ├──facility subsidy──▸ Any facility with fund < 100 (30/day each)
  ├──welfare──▸ Any agent below threshold (safety net)
  ├──◂──tax (10%)── All facility wages
  └──◂──trade tariff (10%)── All purchase transactions

Farm fund (200 start)
  ├──wage──▸ Wren (3/cycle × 8 cycles/day = ~24/day)
  └──◂──treasury subsidy when fund < 100 (30/day)

Bakery fund (200 start)
  ├──(no wage — auto-process, no worker)
  └──◂──bread sales──Agent wallets (3/bread)

Workshop fund (200 start)
  ├──wage──▸ Sable (3/cycle × 6 cycles/day = ~18/day)
  └──◂──treasury subsidy when fund < 100 (30/day)

Tavern fund (0 start)
  └──◂──rest payments──Agent wallets (1/rest)

Elena's wallet (120 start)
  ├──◂──merchant stipend from treasury (8/day)
  └──food/rest purchases──▸ facilities
```

Every gold transfer is agent-to-facility, facility-to-agent, or treasury-to-agent. No gold vanishes. The rest payment bug is fixed by making the tavern a proper facility with a fund.

**Treasury sustainability at steady state:**
- Income: 50 regen + ~4.2 wage tax (10% of ~42) + ~1.5 trade tariff ≈ **55.7 gold/day**
- Outflows: 2 guard + 8 merchant + ~30 avg subsidy (farm+workshop intermittent) + ~5 welfare ≈ **45 gold/day**
- Net: **+10.7 gold/day** — sustainable. As more agents and facilities are added, natural economic activity grows and `treasury_regen` becomes less important.

### 1.5 Facility Revenue Model

At 4 agents, the economy is too small for fully self-sustaining market forces. The treasury acts as a **central bank**, funded by `treasury_regen_per_day` (default 50 gold) representing off-screen economic activity (trade caravans, passing travelers). As more agents and facilities are added, natural circulation grows and regen becomes less important.

**Farm:** Pays Wren ~24 gold/day in wages (3/cycle × 8 daytime cycles). Has no direct revenue — wheat is picked up for free by Elena. The treasury subsidy (30/day when fund < 100) keeps it solvent. The farm fund oscillates around the subsidy threshold: drains to ~76 by end of day, gets topped up to 106, drains again. Stable.

**Bakery:** Auto-produces bread from wheat Elena delivers. No wages paid. Income from direct bread sales to agents at `food_price` (3 gold). Bakery fund grows slowly from sales, no drain. Stable.

**Workshop:** Pays Sable ~18 gold/day in wages (3/cycle × 6 daytime cycles). No revenue until leather-goods trading is implemented. Treasury subsidy keeps it solvent, same oscillation pattern as the farm. Stable.

**If Elena stops hauling:** The bakery runs out of wheat, bread production stalls, agents can't buy food, hunger rises, welfare kicks in as a safety net. The supply chain failure is emergent and visible — not a silent bug.

### 1.5.1 Elena's Merchant Economics

Elena has no production facility. She earns a `merchant_stipend` from the treasury (default 8 gold/day), paid at day boundary alongside the guard stipend. This funds her food and rest purchases (~4-6 gold/day in food + rest).

Elena's hauling work is a public service — she picks up goods for free and deposits them at destination facilities for free. Her value is keeping the supply chain running, not direct profit. This is the correct model for a 4-agent village. As the economy scales:
- Future: merchant markup (Elena buys wholesale, sells retail)
- Future: hauling fees (source facility pays per delivery)
- Future: independent trade routes between towns

### 1.5.2 Facility Subsidy Safety Net

Production facilities whose fund drops below `facility_subsidy_threshold` (default 100 gold) receive a `facility_subsidy_per_day` (default 30 gold) from the treasury at day boundary. This prevents permanent insolvency while maintaining economic pressure — the subsidy is a lifeline, not a profit source. The subsidy is paid during `DayNightSystem.processDayBoundary()`, after welfare and before the daily report.

### 1.6 Bakery Auto-Processing

The bakery has no dedicated worker. When wheat is in stock, it produces bread automatically at a slower rate (`auto_ticks_per_cycle: 40`, double the normal `ticks_per_cycle: 20`). No wages are paid for auto-processing. If a baker agent is added later, they override auto-processing with faster production and earn wages. The facility system handles this via a new `auto_process` flag on the production schema.

### 1.7 Treasury Stipends

Agents without production facilities receive stipends from the treasury at day boundary, paid during `processDayBoundary()` after welfare processing and before the daily report, using the same ledger pattern as welfare grants.

| Role | Config Key | Default | Justification |
|------|-----------|---------|---------------|
| Guard | `config.economy.guard_stipend` | 2 gold/day | Patrol is a public service |
| Merchant | `config.economy.merchant_stipend` | 8 gold/day | Logistics is a public service, covers food/rest costs |

This establishes a pattern for non-production roles. Future roles (healer, teacher, priest) can use the same mechanism. Stipends are only paid if the treasury has sufficient funds; if the treasury is depleted, stipends are skipped and a `StipendSkipped` event is emitted.

### 1.8 Tavern as Proper Facility

The tavern receives rest payments into a fund. No one works there (yet), so there are no wages to pay — it's a pure gold sink. The tavern fund could later pay a tavern-keeper's wages. A new `fund` field on non-production locations enables this.

---

## 2 · Mistreevous Integration — The BehaviorAgent

### 2.1 Replacing the Blackboard

The current `BlackboardComponent` (`Record<string, unknown>`) is replaced by a typed `BehaviorAgent` object per `AgentActor`. This object is what mistreevous receives as its `agent` parameter. It serves three purposes:

1. **State facade** — typed read/write properties that proxy to ECS components
2. **Condition functions** — boolean methods the BT calls (e.g., `IsHungry()`, `HasFood()`)
3. **Action functions** — methods that return `State.RUNNING`, `State.SUCCEEDED`, or `State.FAILED`

### 2.2 BehaviorAgent Interface

```typescript
interface BehaviorAgent {
    // ── State (proxied from ECS components, read-only) ──
    readonly hunger: number;
    readonly energy: number;
    readonly social: number;
    readonly gold: number;
    readonly mood: number;
    readonly moodBucket: string;
    readonly timePhase: string;
    readonly job: string | null;
    readonly position: { x: number; y: number };
    readonly inventory: InventoryItem[];
    readonly nearbyAgents: PerceivedAgent[];
    readonly nearbyLocations: PerceivedLocation[];
    readonly nearbyFacilities: PerceivedFacility[];

    // ── BT working memory (owned by this object, NOT on ECS) ──
    movementTarget: MovementTarget | null;
    journey: JourneyState | null;
    atLocation: string | null;
    currentRegion: string | null;
    haulCargo: CargoState | null;
    socialCooldowns: Map<string, number>;
    committedAction: string | null;

    // ── Conditions (called by mistreevous) ──
    IsHungry(): boolean;
    IsExhausted(): boolean;
    IsLonely(): boolean;
    NeedsCritical(): boolean;
    HasFood(): boolean;
    HasGold(amount: number): boolean;
    CanAffordFood(): boolean;
    AtLocation(type: string): boolean;
    NearLocation(type: string): boolean;
    NearAgent(): boolean;
    NearAgentClose(): boolean;
    IsDaytime(): boolean;
    IsNighttime(): boolean;
    HasJob(): boolean;
    AtJobFacility(): boolean;
    FacilityHasStock(itemId: string): boolean;
    HasCargo(): boolean;
    CargoDestinationNearby(): boolean;
    FacilityNeedsSupply(): boolean;

    // ── Actions (called by mistreevous, return State) ──
    Eat(): State;
    Rest(): State;
    SeekFood(): State;
    SeekRest(): State;
    SeekWork(): State;
    SeekSocial(): State;
    SeekMarket(): State;
    Work(): State;
    Talk(): State;
    Buy(): State;
    PickupCargo(): State;
    DeliverCargo(): State;
    SeekDeliveryTarget(): State;
    SeekSupplySource(): State;
    Idle(): State;
    Wander(): State;
}
```

### 2.3 Supporting Types

```typescript
interface PerceivedAgent {
    id: string;
    position: { x: number; y: number };
    distance: number;
}

interface PerceivedLocation {
    id: string;
    type: string;
    position: { x: number; y: number };
    distance: number;
}

interface PerceivedFacility {
    id: string;
    job: string;
    stock: { item_id: string; quantity: number }[];
    distance: number;
    hasUnmetInput: boolean;  // true when facility has input requirement with zero stock
}

interface CargoState {
    itemId: string;
    quantity: number;
    source: string;       // facility ID where goods were picked up
    destination: string;  // facility ID where goods should be delivered
}

// MovementTarget and JourneyState already exist in component-data.ts
// InventoryItem already exists in common.ts schema
```

### 2.4 Key Design Decisions

- **No more `Record<string, unknown>`** — every field is typed at compile time
- **Actions return State** — `RUNNING` means "I'm doing this, keep going next tick", `SUCCEEDED` means "done", `FAILED` means "can't do this"
- **Movement is internal to actions** — `SeekFood()` sets `movementTarget` and returns `RUNNING` until arrival, then `SUCCEEDED`. The MovementSystem reads `movementTarget` from the BehaviorAgent, not a blackboard
- **Cargo system** — `haulCargo` is the new primitive for agent-carried logistics. `PickupCargo()` transfers goods from a facility's stock into the agent's cargo (free for hauling agents). `DeliverCargo()` deposits cargo at the destination facility's stock
- **Conditions use thresholds from GameConfig** — `IsHungry()` reads `config.needs.hunger_threshold`, not a hardcoded value
- **Getters proxy live state** — read-only properties are implemented as getters that read directly from ECS components. No snapshot sync step is needed

### 2.5 Factory Function

```typescript
function createBehaviorAgent(
    actor: AgentActor,
    locations: WorldLocation[],
    locationActors: Map<string, Actor>,
    worldEntity: Actor,
    config: GameConfig,
): BehaviorAgent
```

Created once per agent at world initialization. Read-only properties use getters that proxy live ECS component state. Action methods mutate components and return State values.

### 2.6 Determinism

Mistreevous accepts a `random()` option. We pass the existing `GameRNG` seeded per-agent per-tick:

```typescript
new BehaviourTree(definition, agent, {
    random: () => gameRng.next(agent.id, deps.tickCount),
    getDeltaTime: () => config.tick_interval_ms,
});
```

---

## 3 · MDSL Tree Architecture — Layered Composition

### 3.1 The Base Tree

Every agent runs this shared survival layer. Role-specific behavior is delegated via `branch [Role]`.

```
root {
    selector {

        /* P0: Critical survival — any need at dangerous levels */
        sequence {
            condition [NeedsCritical]
            selector {
                sequence {
                    condition [IsHungry]
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    action [SeekFood] while(IsHungry)
                }
                sequence {
                    condition [IsExhausted]
                    action [SeekRest] while(IsExhausted)
                }
            }
        }

        /* P1: Hunger — not critical but below comfort threshold */
        sequence {
            condition [IsHungry]
            selector {
                sequence {
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                sequence {
                    condition [CanAffordFood]
                    action [SeekFood] while(IsHungry)
                }
                sequence {
                    condition [HasJob]
                    action [SeekWork]
                }
            }
        }

        /* P2: Energy — rest when tired */
        sequence {
            condition [IsExhausted]
            action [SeekRest] while(IsExhausted)
        }

        /* P3: Role-specific behavior (day) */
        sequence {
            condition [IsDaytime]
            branch [Role]
        }

        /* P4: Social needs */
        sequence {
            condition [IsLonely]
            condition [NearAgentClose]
            action [Talk] while(IsLonely)
        }
        sequence {
            condition [IsLonely]
            action [SeekSocial] while(IsLonely)
        }

        /* P5: Night behavior */
        sequence {
            condition [IsNighttime]
            action [SeekRest]
        }

        /* P6: Fallback */
        action [Wander]
    }
}
```

Key features:

- **`while` guards** — `action [Eat] while(IsHungry)` means eating continues (RUNNING) until hunger is satisfied, then the guard aborts. No more oscillation
- **`branch [Role]`** — resolved at tree construction from the agent's `kind`
- **Priority is structural** — survival > hunger > energy > role work > social > night rest > wander

### 3.2 Role Branches

**branch-merchant (Elena):**

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

        /* Pick up goods from facilities that overproduce */
        sequence {
            condition [FacilityNeedsSupply]
            action [SeekSupplySource]
        }
        sequence {
            condition [AtLocation, "food"]
            condition [FacilityHasStock, "wheat"]
            action [PickupCargo]
        }

        /* Trade at market */
        sequence {
            condition [NearLocation, "market"]
            action [SeekMarket]
        }

        action [Wander]
    }
}
```

**branch-artisan (Sable):**

```
root [Role] {
    selector {
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsDaytime)
        }
        sequence {
            condition [HasJob]
            action [SeekWork]
        }
        action [Wander]
    }
}
```

**branch-scholar (Wren):**

```
root [Role] {
    selector {
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsDaytime)
        }
        sequence {
            condition [HasJob]
            action [SeekWork]
        }
        action [Wander]
    }
}
```

**branch-guard (Marcus):**

```
root [Role] {
    selector {
        /* Patrol: head to town square, then wander nearby */
        sequence {
            condition [AtLocation, "social"]
            action [Wander] while(IsDaytime)
        }
        sequence {
            action [SeekSocial]
        }
    }
}
```

### 3.3 MDSL File Organization

```
behavior-trees/
    base.mdsl
    branch-merchant.mdsl
    branch-artisan.mdsl
    branch-scholar.mdsl
    branch-guard.mdsl
```

**Composition mechanism:** The loader reads `base.mdsl` and the agent-specific `branch-{kind}.mdsl`, then concatenates them into a single MDSL string. Both files share the name `Role` for the branch reference: `base.mdsl` uses `branch [Role]` and each branch file defines `root [Role] { ... }`. The concatenated string is passed to the `BehaviourTree` constructor. Each agent gets their own `BehaviourTree` instance with the composed tree.

**Validation:** Mistreevous's `validateDefinition()` is called on the composed MDSL before constructing the tree. This replaces the custom `bt-lint.ts` for syntactic validation. Semantic validation (do all referenced condition/action names exist on the BehaviorAgent?) is performed at build time by checking method names against the `BehaviorAgent` interface.

---

## 4 · Action Semantics — How RUNNING State Changes the Systems

### 4.1 Action Lifecycle

Each action follows a three-phase pattern matching mistreevous callbacks:

| Phase | Mistreevous | What happens |
|-------|-------------|--------------|
| **Start** | `entry` callback | Set movement target, emit event, initialize state |
| **Tick** | Action returns `RUNNING` | MovementSystem moves agent, systems process ongoing effects |
| **End** | `exit` callback or `SUCCEEDED`/`FAILED` | Clean up state, emit completion event |

### 4.2 Action Definitions

| Action | Returns RUNNING while... | Succeeds when | Fails when | Guard |
|--------|--------------------------|---------------|------------|-------|
| `Eat` | Consuming (1 tick per food unit) | Hunger satisfied or food exhausted | No food in inventory | `while(IsHungry)` |
| `Rest` | At rest location | Energy above threshold | — | `while(IsExhausted)` |
| `SeekFood` | Moving toward food source | Arrives at food facility/merchant | No food source exists | `while(IsHungry)` |
| `SeekRest` | Moving toward rest location | Arrives at rest location | No rest location reachable | `while(IsExhausted)` |
| `SeekWork` | Moving toward job facility | Arrives at facility | No job or facility unreachable | — |
| `SeekSocial` | Moving toward nearest agent | Arrives near another agent | No agents in perception | `while(IsLonely)` |
| `SeekMarket` | Moving toward market area | Arrives at market | — | — |
| `Work` | Work progress accumulating | Cycle completes (wage paid) | No input, facility insolvent | `while(IsDaytime)` |
| `Talk` | Socializing with nearby agent | Social need recovered | Partner walks away | `while(IsLonely)` |
| `Buy` | At facility, transaction processing | Item purchased | No gold or no stock | — |
| `PickupCargo` | At source facility | Goods transferred to haulCargo | Facility has no output stock | — |
| `DeliverCargo` | Moving to destination | Goods deposited at destination | — | — |
| `SeekDeliveryTarget` | Moving toward delivery dest | Arrives at destination | — | — |
| `SeekSupplySource` | Moving toward surplus facility | Arrives at source | No facility needs supply | — |
| `Wander` | Always | Never (runs until guard aborts) | — | — |
| `Idle` | Always | Never | — | — |

### 4.3 Systems That Remain as Tick-Based

- `NeedsDecaySystem` — needs decay regardless of what agents are doing
- `MoodSystem` — mood is derived, recalculated each tick
- `PerceptionSystem` — updates nearbyAgents/nearbyLocations each tick
- `MemoryDecaySystem` — memory significance fades each tick
- `DayNightSystem` — time advances each tick, plus guard stipend at day boundary
- `MovementSystem` — physics/velocity runs each tick, reads from BehaviorAgent
- `FacilitySystem` — production cycles tick independently, plus auto-process
- `DialogueSystem` — reacts to social interaction events
- `GossipSystem` — reacts to dialogue events
- `RelationshipCheckpointSystem` — periodic vault write
- `TraitResolverSystem` — computed once at startup, not per-tick

### 4.4 Systems That Collapse Into BehaviorAgent Actions

- `FeedSystem` → `Eat()` action method
- `RestSystem` → `Rest()` action method
- `TradeSystem` → `Buy()` action method
- `BehaviorTreeSystem` → thin `step()` caller

The BehaviorTreeSystem reduces to:

```typescript
execute(deps: GameCoreDeps): void {
    for (const agent of agents()) {
        agent.behaviorTree.step();
    }
}
```

No sync step is needed — the BehaviorAgent's read-only properties are getters that proxy live ECS component state. Perception data is already updated by `PerceptionSystem` (priority 3) before `BehaviorTreeSystem` (priority 5) runs.

---

## 5 · Agent Data Changes

### 5.1 Revised Agent JSON

| Agent | Kind | Job | BT | Starting Gold | Key Inventory |
|-------|------|-----|-----|---------------|---------------|
| **Wren** | scholar | farmer | scholar | 80 | 3 bread, quill-pen, star-chart |
| **Elena** | merchant | merchant | merchant | 120 | 2 bread, herb-bundle |
| **Sable** | artisan | leatherworker | artisan | 45 | 3 bread, leather-scraps, dye-red |
| **Marcus** | guard | guard | guard | 35 | 3 bread, torch |

### 5.2 Revised Location JSON

**Farm** — unchanged production, wage 3/cycle:

```json
{
    "production": {
        "job": "farmer",
        "output": { "item_id": "wheat", "quantity": 1 },
        "input": null,
        "wage": 3,
        "ticks_per_cycle": 30
    }
}
```

**Bakery** — add `auto_process: true, auto_ticks_per_cycle: 40`:

```json
{
    "production": {
        "job": "baker",
        "output": { "item_id": "bread", "quantity": 1 },
        "input": { "item_id": "wheat", "quantity": 1 },
        "wage": 4,
        "ticks_per_cycle": 20,
        "auto_process": true,
        "auto_ticks_per_cycle": 40
    }
}
```

**Workshop** — reduce wage to 3/cycle (from 5) to match farm scale:

```json
{
    "production": {
        "job": "leatherworker",
        "output": { "item_id": "leather-goods", "quantity": 1 },
        "input": null,
        "wage": 3,
        "ticks_per_cycle": 40
    }
}
```

**Tavern** — add fund support for rest payments. The tavern Actor receives a `FacilityComponent` with `production: null` but `fund > 0`. Rest payments from `RestSystem` credit the tavern's facility fund instead of vanishing into the ledger.

---

## 6 · Technical Architecture

### 6.1 New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `mistreevous` | BT engine | ~492KB (bundled by Vite) |
| `lotto-draw` | Transitive dep | 24KB, zero deps |

Both are devDependencies. Zero runtime dep policy maintained — Vite bundles them.

### 6.2 New Files

```
src/domain/systems/behavior-agent.ts          ← BehaviorAgent interface
src/domain/systems/cargo.ts                   ← PickupCargo/DeliverCargo pure logic
src/infrastructure/entity/behavior-agent-factory.ts  ← createBehaviorAgent()
src/infrastructure/systems/behavior-tree-system.ts   ← Rewrite: thin step() caller
src/infrastructure/entity/bt-loader.ts               ← Rewrite: .mdsl loading + composition

behavior-trees/base.mdsl
behavior-trees/branch-merchant.mdsl
behavior-trees/branch-artisan.mdsl
behavior-trees/branch-scholar.mdsl
behavior-trees/branch-guard.mdsl

tests/domain/systems/behavior-agent.test.ts
tests/domain/systems/cargo.test.ts
tests/infrastructure/entity/bt-loader.test.ts
tests/infrastructure/systems/behavior-tree-system.test.ts
tests/integration/mistreevous-integration.test.ts
```

### 6.3 Deleted Files

```
src/domain/systems/behavior-tree.ts
src/domain/systems/bt-actions.ts
src/domain/systems/bt-conditions.ts
src/domain/systems/bt-lint.ts
src/infrastructure/components/blackboard-component.ts
src/infrastructure/systems/feed-system.ts
src/infrastructure/systems/trade-system.ts

behavior-trees/bt-guard.json
behavior-trees/bt-merchant.json
behavior-trees/bt-artisan.json
behavior-trees/bt-scholar.json

tests/domain/systems/behavior-tree.test.ts
tests/domain/systems/bt-actions.test.ts
tests/domain/systems/bt-conditions.test.ts
tests/domain/systems/bt-lint.test.ts
tests/infrastructure/systems/feed-system.test.ts
tests/infrastructure/systems/trade-system.test.ts
```

**Note:** All test files that reference `BlackboardComponent` must be updated to use `BehaviorAgent` instead. This affects tests for: `facility-system`, `movement-system`, `socialize-system`, `dialogue-system`, `gossip-system`, `perception-system`, and all integration tests (`smoke-test`, `balance-smoke`, `economy-integration`, `agency-integration`, `social-integration`, etc.).
```

### 6.4 Modified Files

```
src/domain/core/component-data.ts          ← Remove BlackboardState, add CargoState
src/domain/schemas/location-schema.ts      ← Add auto_process, auto_ticks_per_cycle to ProductionSchema
src/domain/schemas/game-config-schema.ts   ← Add guard_stipend, merchant_stipend, facility_subsidy_threshold, facility_subsidy_per_day, treasury_regen_per_day (activate), trade_tariff_rate, food_price: 3, tax_rate: 10%, need thresholds
src/domain/systems/facility.ts             ← Add auto-process path (no-worker production at slower rate)
src/infrastructure/entity/agent-actor.ts   ← Remove BlackboardComponent, add BehaviorAgent + BehaviourTree refs
src/infrastructure/entity/agent-spawner.ts ← Construct BehaviorAgent and BehaviourTree per agent
src/infrastructure/systems/facility-system.ts   ← Add auto-process logic (no-worker production at slower rate)
src/infrastructure/systems/rest-system.ts       ← Fix: rest payment credits tavern facility fund (not deleted — gold handling stays in infra)
src/infrastructure/systems/movement-system.ts   ← Read from BehaviorAgent instead of BlackboardComponent
src/infrastructure/systems/socialize-system.ts  ← Read from BehaviorAgent instead of BlackboardComponent
src/infrastructure/systems/dialogue-system.ts   ← Read social state from BehaviorAgent
src/infrastructure/systems/gossip-system.ts     ← Read state from BehaviorAgent
src/infrastructure/systems/day-night-system.ts  ← Add stipend payments, facility subsidies, treasury regen, trade tariff
src/infrastructure/systems/perception-system.ts ← Write to BehaviorAgent instead of BlackboardComponent
src/infrastructure/systems/trait-resolver-system.ts ← Compute once at startup, not per-tick

agents/marcus.json    ← job: "guard", behavior_tree: "guard"
agents/elena.json     ← job: "merchant", behavior_tree: "merchant"
agents/wren.json      ← job: "farmer", behavior_tree: "scholar"

locations/bakery.json ← Add auto_process, auto_ticks_per_cycle
locations/farm.json   ← (unchanged, wage stays 3)
locations/workshop.json ← Reduce wage to 3 (from 5)
locations/tavern.json ← Add fund support
```

### 6.5 Unchanged Files

All domain pure logic for needs, mood, memory, day-night, perception, pathfinding, steering, crossing-point, arrival-spread, dialogue, gossip, relationship, relationship-canvas, skill-progression, daily-report. All infrastructure plumbing: EventBus, TickRunner, TickSystem, WorldLoader. All schemas except location and game-config.

### 6.6 Implementation Order (Vertical Slice)

1. Install mistreevous, create `BehaviorAgent` interface and factory
2. Write `base.mdsl` + `branch-merchant.mdsl`
3. Wire `BehaviourTree.step()` into `BehaviorTreeSystem`
4. Implement `SeekFood`, `Eat`, `SeekRest`, `Rest` actions (survival base)
5. Implement `PickupCargo`, `DeliverCargo`, `SeekSupplySource`, `SeekDeliveryTarget` (merchant branch)
6. Run Elena through a multi-day simulation — verify she hauls wheat, bakery produces bread, she distributes bread, she eats and rests
7. Replicate: implement remaining role branches, update other agent JSON files
8. Fix economy flows: tavern fund, farm pickup fee, guard stipend
9. Integration tests: full 4-agent multi-day balance smoke
