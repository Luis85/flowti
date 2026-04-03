# Generalized Agents — Design Spec

> Agents are generic. Jobs are skill modules. Attributes create aptitude. The economy sorts the rest.

**Goal:** Remove hardcoded roles/kinds from agents. All agents share the same base behavior tree and self-select jobs based on attribute aptitude. Jobs are modular BT fragments that plug into a work slot dynamically.

**Motivation:** The current system creates specialized agents at birth (`kind: "settler"`, `behavior_tree: "settler"`, `job: "settler"`). An agent born a settler can never become a craftsman. This prevents emergent behavior — agents can't adapt to economic needs, fill gaps, or switch roles when circumstances change.

---

## 1. Agent Data — Stripped Down

Remove `kind`, `behavior_tree`, and `job` from agent JSON. Agents are defined purely by identity, attributes, and starting state. Personas (future) handle flavor and dialogue.

### Before
```json
{
  "id": "agent-settler",
  "name": "Settler",
  "kind": "settler",
  "behavior_tree": "settler",
  "job": "settler",
  "attributes": { "ST": 12, "DX": 12, "IQ": 12, "HT": 12 },
  ...
}
```

### After
```json
{
  "id": "agent-aldric",
  "name": "Aldric",
  "color": "#66bb6a",
  "attributes": { "ST": 12, "DX": 12, "IQ": 12, "HT": 12 },
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
  "wallet": { "gold": 30 },
  "xp": 0,
  "level": 1,
  "position": { "x": 250, "y": 200, "region": "region-market-square" },
  "relationships": null,
  "tools": [],
  "property": []
}
```

### Fields removed
- `kind` — no mechanical role. Persona handles identity later.
- `behavior_tree` — all agents use the same base BT (swapped on job claim).
- `job` — agents start unemployed, self-select at runtime.

### Schema changes
- `AgentSchema`: make `kind`, `behavior_tree`, `job` optional with defaults (`null`/empty) for backward compat during migration.
- `AgentActor`: `kind` derived from current job (for display). `behaviorTreeDef` removed.

---

## 2. Job Modules — BT Fragments

Job-specific work behaviors move from `behavior-trees/branch-*.mdsl` to `jobs/*.mdsl`. Each file defines a `root [Job] { ... }` subtree.

### File layout
```
jobs/
  settler.mdsl       — harvest, sell food, buy tools, work at farm
  guard.mdsl         — work at guard post (patrol later)
  craftsman.mdsl     — sell trade goods, work at workshop
```

### Example: `jobs/settler.mdsl`
```
root [Job] {
    selector {
        /* Harvest food from farm if stock available */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [Harvest]
        }
        /* Sell excess at market */
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
        /* Buy tools if needed */
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

### BT Composition — Static at Construction, Swapped at Job Change

**Critical constraint:** mistreevous resolves `branch [Name]` at tree construction time by inlining the named subtree. It is NOT a runtime lookup. This means:

1. **At world load time**, the loader composes one MDSL per job type: `base.mdsl + jobs/<jobname>.mdsl`. It also composes a "jobless" variant: `base.mdsl` alone, with `branch [Job]` replaced by `action [Wander]` (since there's no `root [Job]` to reference).
2. **Each composed MDSL is parsed into a tree definition** and stored in a `jobTrees: Record<string, string>` map (key = job name, value = composed MDSL). Plus a `joblessMdsl: string` for unemployed agents.
3. **Agents start with the jobless tree.** When `ClaimBestJob` fires, the agent's `BehaviourTree` instance is reconstructed from the claimed job's composed MDSL. When a job is released, it swaps back to the jobless tree.

### Runtime BT swap

When `ClaimBestJob` or `ReleaseJob` changes `agent.job`, the system must:
1. Look up the target MDSL from `jobTrees[newJob]` (or `joblessMdsl` for release)
2. Create a new `BehaviourTree(mdsl, behaviorAgent)` instance
3. Assign it to the agent's `behaviorTree` property on `AgentActor`

This swap is cheap — `BehaviourTree` construction is fast (just parsing + node factory). It only happens on job claim/release, not every tick.

### Loading
The world loader discovers job modules dynamically by scanning `jobs/*.mdsl` (via vault adapter), instead of iterating a hardcoded `BT_KINDS` array. The vault adapter must list `.mdsl` files (not just `.json` — update the `list` function or add an extension parameter).

---

## 3. Base BT — One Tree For All

The base BT is shared by every agent. Changes from current:

1. `branch [Role]` → `branch [Job]` — resolved at tree construction time per job type
2. `ClaimJob` → `ClaimBestJob` — uses aptitude scoring, triggers BT swap
3. New `ReleaseJob` action — for when facilities close or agents get displaced

### Updated base.mdsl
```
root {
    selector {
        /* P0: Critical survival — any need at dangerous levels */
        sequence {
            condition [NeedsCritical]
            selector {
                sequence {
                    condition [IsThirsty]
                    condition [HasWater]
                    action [Drink]
                }
                sequence {
                    condition [IsThirsty]
                    action [SeekWater]
                    action [FillWaterskin]
                    action [Drink]
                }
                sequence {
                    condition [IsHungry]
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "food"]
                    action [Buy]
                }
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    selector {
                        sequence {
                            condition [KnowsFoodSource]
                            action [SeekBestFoodSource] while(IsHungry)
                        }
                        action [SeekFood] while(IsHungry)
                    }
                    action [Buy]
                }
                sequence {
                    condition [IsExhausted]
                    action [SeekRest]
                    action [Rest] while(IsExhausted)
                }
            }
        }

        /* P1: Claim a job if unemployed and facility available */
        sequence {
            condition [IsWorkHours]
            condition [HasNoJob]
            condition [OpenProductionFacilityNearby]
            action [ClaimBestJob]
        }

        /* P2: Job-specific behavior (work hours, skip if exhausted) */
        sequence {
            condition [IsWorkHours]
            flip { condition [IsExhausted] }
            branch [Job]
        }

        /* P3: Thirsty — drink or refill */
        sequence {
            condition [IsThirsty]
            selector {
                sequence {
                    condition [HasWater]
                    action [Drink]
                }
                sequence {
                    action [SeekWater]
                    action [FillWaterskin]
                    action [Drink]
                }
            }
        }

        /* P4: Hungry — eat or buy */
        sequence {
            condition [IsHungry]
            selector {
                sequence {
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                sequence {
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "food"]
                    action [Buy]
                }
                sequence {
                    condition [CanAffordFood]
                    selector {
                        sequence {
                            condition [KnowsFoodSource]
                            action [SeekBestFoodSource]
                        }
                        action [SeekFood]
                    }
                    action [Buy]
                }
                sequence {
                    condition [HasJob]
                    action [SeekWork]
                }
            }
        }

        /* P4.5: Buy equipment if affordable, available, and not exhausted */
        sequence {
            flip { condition [IsExhausted] }
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

        /* P5: Energy — rest when tired */
        sequence {
            condition [IsExhausted]
            action [SeekRest]
            action [Rest] while(IsExhausted)
        }

        /* P6: Night — go home and sleep */
        sequence {
            condition [IsNighttime]
            action [SeekRest]
            action [Rest] while(IsNighttime)
        }

        /* P7: Fallback */
        action [Wander]
    }
}
```

### Jobless variant

For unemployed agents, `branch [Job]` has no target. The loader produces a jobless MDSL by replacing P2's `branch [Job]` with `action [Wander]`:

```
/* P2: No job — wander during work hours */
sequence {
    condition [IsWorkHours]
    flip { condition [IsExhausted] }
    action [Wander]
}
```

This is a string replacement at load time, not a runtime concern.

---

## 4. Job Aptitude & Scoring

### Job-attribute mapping

Defined in `game-config.json` under a new `jobs` section:

```json
{
  "jobs": {
    "aptitude_baseline": 12,
    "desperation_ticks": 200,
    "definitions": {
      "settler":   { "primary_attribute": "HT" },
      "guard":     { "primary_attribute": "ST" },
      "craftsman": { "primary_attribute": "DX" }
    }
  }
}
```

- `primary_attribute` — the attribute used to score aptitude for this job.
- `aptitude_baseline` — the "average" attribute value (default 12). Used for efficiency calculations.
- `desperation_ticks` — ticks an agent stays unemployed before accepting any job. At 500ms/tick, 200 ticks = 100 seconds of game time.

### ClaimBestJob action

Replaces `ClaimJob`. Behavior:

1. Collect all open **production** facilities in perception range (`workerId === null` AND `job !== ''`).
2. For each, look up the job's `primary_attribute` from `config.jobs.definitions`.
3. Score = agent's value of that attribute. Higher is better. Tiebreaker: nearest facility wins.
4. Pick the highest-scoring facility and claim it (`actor.job = facility.job`).
5. **Trigger BT swap:** reconstruct the agent's `BehaviourTree` from the job's composed MDSL.
6. If no open production facilities, return FAILED.

**Desperation fallback:** Track `unemployedTicks` in BehaviorAgent working memory (add to interface in `behavior-agent.ts` and factory closure in `behavior-agent-factory.ts`). Increment each tick when `HasNoJob` is true. When `unemployedTicks >= config.jobs.desperation_ticks`, `ClaimBestJob` skips scoring and claims the nearest open production facility. Reset to 0 when a job is claimed.

### OpenProductionFacilityNearby condition

Replaces `OpenFacilityNearby`. Same check but filters to facilities with a non-empty `job` field, excluding non-production locations (rest, water, market) that have `production: null`.

```typescript
OpenProductionFacilityNearby(): boolean {
    return agent.nearbyFacilities.some(f => f.workerId === null && f.job !== '');
},
```

### Job release

New `ReleaseJob` action (not currently in BT, used by systems):
1. Set `actor.job = null`
2. Reset `unemployedTicks = 0`
3. Swap BT back to jobless variant

Triggered by FacilitySystem when a facility's worker is detected at a non-existent or closed facility. Can also be called manually for future displacement mechanics.

### Productivity modifier

In `FacilitySystem.processFacilityTick`, when calculating production ticks, apply an efficiency multiplier based on worker aptitude:

```
efficiency = workerAttribute / aptitude_baseline
effective_ticks_per_cycle = Math.round(ticks_per_cycle / efficiency)
```

Where `workerAttribute` is the worker's value for the job's `primary_attribute`, read from the worker's `AttributesComponent`.

The jobs config is accessed via `deps.config.jobs` (add `jobs` to `GameConfigSchema`). The `processFacilityTick` function already receives `deps: GameCoreDeps` which includes `config`.

**Examples** (baseline = 12, ticks_per_cycle = 25):
- Agent with DX 14 crafting: `25 / (14/12) = 21 ticks` — 17% faster
- Agent with DX 10 crafting: `25 / (10/12) = 30 ticks` — 20% slower
- Agent with DX 12 crafting: `25 / (12/12) = 25 ticks` — baseline

---

## 5. Migration & Cleanup

### Files to remove
- `behavior-trees/branch-settler.mdsl`
- `behavior-trees/branch-guard.mdsl`
- `behavior-trees/branch-craftsman.mdsl`

### Files to create
- `jobs/settler.mdsl`
- `jobs/guard.mdsl`
- `jobs/craftsman.mdsl`

### Files to modify

| File | Change |
|------|--------|
| `behavior-trees/base.mdsl` | `branch [Role]` → `branch [Job]`, `ClaimJob` → `ClaimBestJob`, `OpenFacilityNearby` → `OpenProductionFacilityNearby` |
| `agents/*.json` | Remove `kind`, `behavior_tree`, `job` |
| `configs/game-config.json` | Add `jobs` section with aptitude config |
| `src/domain/schemas/game-config-schema.ts` | Add `JobsConfigSchema` with `aptitude_baseline`, `desperation_ticks`, `definitions` |
| `src/domain/schemas/agent-schema.ts` | Make `kind`, `behavior_tree`, `job` optional (backward compat) |
| `src/domain/systems/behavior-agent.ts` | Add `unemployedTicks: number` to BehaviorAgent interface, add `ClaimBestJob`, `ReleaseJob`, `OpenProductionFacilityNearby` |
| `src/infrastructure/entity/agent-actor.ts` | Remove `kind` hard field, derive from `job`. Remove `behaviorTreeDef`. Add mutable `behaviorTree` setter for BT swap. |
| `src/infrastructure/entity/behavior-agent-factory.ts` | Replace `ClaimJob` with `ClaimBestJob` (aptitude scoring + BT swap), add `ReleaseJob`, replace `OpenFacilityNearby` with `OpenProductionFacilityNearby`, add `unemployedTicks` tracking |
| `src/infrastructure/systems/facility-system.ts` | Apply aptitude efficiency modifier to `ticks_per_cycle` in `processFacilityTick`. Read worker's `AttributesComponent` + `config.jobs.definitions[production.job].primary_attribute`. |
| `src/infrastructure/engine/world-loader.ts` | Scan `jobs/*.mdsl` dynamically. Compose base + each job module. Produce jobless variant. Return `jobTrees` map + `joblessMdsl`. Remove `BT_KINDS`. |
| `src/infrastructure/engine/game-view.ts` | Initialize all agents with jobless BT. Store `jobTrees` map. Pass BT swap callback to `BehaviorAgentDeps` so `ClaimBestJob` can reconstruct trees. |
| `src/infrastructure/engine/debug-overlay.ts` | Replace `agent.kind` with `agent.job ?? 'unemployed'` in display |
| `src/domain/systems/world-validation.ts` | Remove `behaviorTree` field from agent validation (no longer required) |
| `configs/vite.config.ts` | Copy `jobs/` to dist (as `.mdsl` files). Update vault adapter `list` to support `.mdsl` extension param or separate listing. |

### Vault adapter change

The `createVaultAdapter.list()` currently filters for `.json` only. The MDSL loader uses `read()` directly (which works), but the new job scanner needs to list `.mdsl` files. Options:
- Add an extension parameter to `list(path, ext)`
- Or have the world loader use `read()` with known filenames derived from `config.jobs.definitions` keys

The simpler path: derive job names from `config.jobs.definitions` keys and `read()` each `jobs/<name>.mdsl` directly. No `list()` change needed.

### Backward compatibility
During migration, `kind`, `behavior_tree`, and `job` become optional schema fields. Old agent files still parse — the fields are simply ignored. `job` defaults to `null` (unemployed).

---

## 6. What Changes for the Player

- Agents arrive as blank slates and find their own work
- High-attribute agents naturally gravitate to matching jobs
- Mismatched workers are slower but functional — no dead-stop
- If a facility opens up, the best available unemployed agent claims it
- Desperate unemployed agents take whatever's available after ~100 seconds
- The economy self-organizes based on attribute distribution
