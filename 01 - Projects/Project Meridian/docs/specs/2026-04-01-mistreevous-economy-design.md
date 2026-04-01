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
Elena picks up wheat from Farm → carries to Bakery → deposits in Bakery stock
Bakery auto-produces bread when stocked with wheat (communal oven, no dedicated baker)
Elena picks up bread from Bakery → carries to Market area
Agents buy bread from Elena (nearby merchant with stock) or from Bakery directly
Sable works Workshop → produces leather-goods (stored in Workshop stock)
```

The bakery problem is solved structurally — wheat arrives via Elena's hauling behavior, not via a broken inter-facility system. If Elena is sick or busy, the bakery runs out of wheat and bread production stalls. That's emergent, not a bug.

### 1.4 Gold Flow

```
Treasury (500 start)
  ├──guard stipend──▸ Marcus (2/day)
  ├──welfare──▸ Any agent below threshold (safety net)
  └──◂──tax (5%)── All facility wages

Farm fund (200 start)
  ├──wage──▸ Wren (3/cycle, ~48/day)
  └──◂──pickup fee──Elena wallet (1/wheat)

Bakery fund (200 start)
  ├──(no wage — auto-process, no worker)
  └──◂──bread sales──Agent wallets (2/bread)

Workshop fund (200 start)
  ├──wage──▸ Sable (5/cycle, ~57/day)
  └──◂──leather sales── (future: agents buy leather-goods)

Tavern fund (0 start)
  └──◂──rest payments──Agent wallets (1/rest)

Elena's wallet (120 start)
  ├──◂──bread sales to agents
  └──food/rest/pickup purchases──▸ facilities
```

Every gold transfer is agent-to-facility or facility-to-agent. No gold vanishes. The rest payment bug is fixed by making the tavern a proper facility with a fund.

### 1.5 Farm Revenue

The farm pays Wren ~48 gold/day in wages but would have no income without a revenue mechanism. Elena pays a `pickup_price` (default 1 gold per unit) when collecting wheat from the farm stock. This gives the farm a revenue stream tied to demand.

Elena's profit per bread: bread sale price (2) minus wheat pickup cost (1) = 1 gold. If Elena stops buying wheat, the farm fund drains — but so does bread supply. Correct emergent outcome.

### 1.6 Bakery Auto-Processing

The bakery has no dedicated worker. When wheat is in stock, it produces bread automatically at a slower rate (`auto_ticks_per_cycle: 40`, double the normal `ticks_per_cycle: 20`). No wages are paid for auto-processing. If a baker agent is added later, they override auto-processing with faster production and earn wages. The facility system handles this via a new `auto_process` flag on the production schema.

### 1.7 Guard Stipend

Marcus has no production facility. The `DayNightSystem` pays a `guard_stipend` (configurable, default 2 gold/day) from the treasury at day boundary. This establishes a pattern for non-production roles: treasury-funded stipends. Future roles (healer, teacher, priest) can use the same mechanism.

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

### 2.3 Key Design Decisions

- **No more `Record<string, unknown>`** — every field is typed at compile time
- **Actions return State** — `RUNNING` means "I'm doing this, keep going next tick", `SUCCEEDED` means "done", `FAILED` means "can't do this"
- **Movement is internal to actions** — `SeekFood()` sets `movementTarget` and returns `RUNNING` until arrival, then `SUCCEEDED`. The MovementSystem reads `movementTarget` from the BehaviorAgent, not a blackboard
- **Cargo system** — `haulCargo` is the new primitive for agent-carried logistics. `PickupCargo()` takes goods from a facility's stock. `DeliverCargo()` deposits them
- **Conditions use thresholds from GameConfig** — `IsHungry()` reads `config.needs.hunger_threshold`, not a hardcoded value

### 2.4 Factory Function

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

### 2.5 Determinism

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
        sequence {
            condition [NearLocation, "social"]
            action [Wander] while(IsDaytime)
        }
        sequence {
            action [SeekMarket]
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

The loader reads `base.mdsl`, then registers the appropriate `branch-*.mdsl` as the `[Role]` subtree based on the agent's `kind`. Each agent gets their own `BehaviourTree` instance with the composed tree.

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
        agent.behaviorAgent.syncFromComponents(deps);
        agent.behaviorTree.step();
    }
}
```

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

**Farm** — add `pickup_price: 1`:

```json
{
    "production": {
        "job": "farmer",
        "output": { "item_id": "wheat", "quantity": 1 },
        "input": null,
        "wage": 3,
        "ticks_per_cycle": 30,
        "pickup_price": 1
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

**Tavern** — add fund support for rest payments.

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
src/infrastructure/systems/rest-system.ts
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
tests/infrastructure/systems/rest-system.test.ts
tests/infrastructure/systems/trade-system.test.ts
```

### 6.4 Modified Files

```
src/domain/core/component-data.ts          ← Remove BlackboardState, add CargoState
src/domain/schemas/location-schema.ts      ← Add auto_process, auto_ticks_per_cycle, pickup_price
src/domain/schemas/game-config-schema.ts   ← Add guard_stipend, need thresholds, pickup defaults
src/domain/systems/facility.ts             ← Add auto-process path, pickup fee logic
src/domain/systems/rest.ts                 ← Add facility fund payment (fix gold sink)
src/domain/systems/trade.ts                ← Support buying from agents (mobile vendor)
src/infrastructure/entity/agent-actor.ts   ← Remove BlackboardComponent, add BehaviorAgent + BehaviourTree refs
src/infrastructure/entity/agent-spawner.ts ← Construct BehaviorAgent and BehaviourTree per agent
src/infrastructure/systems/facility-system.ts   ← Add auto-process logic, pickup fee handling
src/infrastructure/systems/movement-system.ts   ← Read from BehaviorAgent instead of BlackboardComponent
src/infrastructure/systems/socialize-system.ts  ← Read from BehaviorAgent instead of BlackboardComponent
src/infrastructure/systems/dialogue-system.ts   ← Read social state from BehaviorAgent
src/infrastructure/systems/gossip-system.ts     ← Read state from BehaviorAgent
src/infrastructure/systems/day-night-system.ts  ← Add guard stipend payment
src/infrastructure/systems/perception-system.ts ← Write to BehaviorAgent instead of BlackboardComponent
src/infrastructure/systems/trait-resolver-system.ts ← Compute once at startup, not per-tick

agents/marcus.json    ← job: "guard", behavior_tree: "guard"
agents/elena.json     ← job: "merchant", behavior_tree: "merchant"
agents/wren.json      ← job: "farmer", behavior_tree: "scholar"

locations/bakery.json ← Add auto_process, auto_ticks_per_cycle
locations/farm.json   ← Add pickup_price
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
