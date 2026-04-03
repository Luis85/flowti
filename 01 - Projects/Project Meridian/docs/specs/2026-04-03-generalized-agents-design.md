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
- `behavior_tree` — all agents use the same base BT.
- `job` — agents start unemployed, self-select at runtime.

### Schema changes
- `AgentSchema`: remove `kind`, `behavior_tree`, `job` as required fields. Make them optional with defaults (`job: null`) for backward compat during migration.
- `AgentActor`: `kind` becomes an empty string or is derived from current job. `behaviorTreeDef` is removed — all agents load the same base BT.

---

## 2. Job Modules — BT Fragments

Job-specific work behaviors move from `behavior-trees/branch-*.mdsl` to `jobs/*.mdsl`. Each file defines a `root [Job]` subtree that plugs into the base BT's work slot.

### File layout
```
jobs/
  settler.mdsl       — harvest, sell food, work at farm
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

### Loading
The world loader discovers job modules dynamically by scanning `jobs/*.mdsl` (or the deployed equivalent), instead of iterating a hardcoded `BT_KINDS` array. Each file's name (without extension) becomes the job key. The base BT is composed with each job module to produce a complete tree per job type.

### Runtime resolution
`branch [Job]` in the base BT resolves by looking up `agent.job` in the loaded job definitions map. If the agent has no job (`job === null`), the branch node fails and the BT falls through to wander.

---

## 3. Base BT — One Tree For All

The base BT is shared by every agent. Two changes from current:

1. `branch [Role]` → `branch [Job]` — resolves dynamically from `agent.job`
2. `ClaimJob` → `ClaimBestJob` — uses aptitude scoring

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
            condition [OpenFacilityNearby]
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
- `desperation_ticks` — how many ticks an agent stays unemployed before accepting any job regardless of score.

### ClaimBestJob action

Replaces `ClaimJob`. Behavior:

1. Collect all open facilities in perception range (where `workerId === null`).
2. For each, look up the job's `primary_attribute` from config.
3. Score = agent's value of that attribute. Higher is better.
4. Pick the highest-scoring facility and claim it (`actor.job = facility.job`).
5. If no open facilities, return FAILED.

**Desperation fallback:** Track `unemployedTicks` in working memory. Increment each tick when `HasNoJob`. When `unemployedTicks >= desperation_ticks`, `ClaimBestJob` skips scoring and claims the nearest open facility regardless of fit. Reset to 0 when a job is claimed.

### Productivity modifier

In `FacilitySystem`, when calculating production ticks, apply an efficiency multiplier based on worker aptitude:

```
efficiency = workerAttribute / aptitude_baseline
effective_ticks_per_cycle = ticks_per_cycle / efficiency
```

Where `workerAttribute` is the worker's value for the job's `primary_attribute`.

**Examples** (baseline = 12, ticks_per_cycle = 25):
- Agent with DX 14 crafting: `25 / (14/12) = 21.4 ticks` — 17% faster
- Agent with DX 10 crafting: `25 / (10/12) = 30 ticks` — 20% slower
- Agent with DX 12 crafting: `25 / (12/12) = 25 ticks` — baseline

No hard caps. The formula naturally produces reasonable ranges for typical attribute values (8-16).

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
- `behavior-trees/base.mdsl` — `branch [Role]` → `branch [Job]`, `ClaimJob` → `ClaimBestJob`
- `agents/*.json` — remove `kind`, `behavior_tree`, `job`
- `configs/game-config.json` — add `jobs` section
- `src/domain/schemas/game-config-schema.ts` — add `JobsConfigSchema`
- `src/domain/schemas/agent-schema.ts` — make `kind`, `behavior_tree`, `job` optional
- `src/infrastructure/entity/agent-actor.ts` — remove `kind` dependency, derive from job
- `src/infrastructure/entity/behavior-agent-factory.ts` — replace `ClaimJob` with `ClaimBestJob`, add `unemployedTicks` tracking
- `src/infrastructure/systems/facility-system.ts` — apply aptitude efficiency modifier
- `src/infrastructure/engine/world-loader.ts` — scan `jobs/` dynamically instead of `BT_KINDS`
- `src/infrastructure/engine/game-view.ts` — compose base BT with job modules dynamically, resolve `branch [Job]` from `agent.job`
- `configs/vite.config.ts` — copy `jobs/` to dist

### Backward compatibility
During migration, `kind` and `behavior_tree` become optional schema fields that are ignored at runtime. The `job` field defaults to `null` (unemployed). Old agent files still parse but the fields have no effect.

---

## 6. What Changes for the Player

- Agents arrive as blank slates and find their own work
- High-attribute agents naturally gravitate to matching jobs
- Mismatched workers are slower but functional — no dead-stop
- If a facility opens up, the best available unemployed agent claims it
- Desperate unemployed agents take whatever's available
- The economy self-organizes based on attribute distribution
