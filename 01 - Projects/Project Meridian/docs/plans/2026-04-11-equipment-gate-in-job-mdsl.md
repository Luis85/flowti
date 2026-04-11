# Equipment Gate in Job MDSL Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move equipment maintenance from low-priority base.mdsl branches into each job's MDSL as the first branch, so agents proactively repair or buy equipment before starting work.

**Architecture:** Pure MDSL changes — no TypeScript code. Add an equipment maintenance gate to settler.mdsl, craftsman.mdsl, and guard.mdsl. Remove duplicate/dead branches from settler.mdsl and base.mdsl. All conditions and actions already exist.

**Tech Stack:** mistreevous BT (MDSL).

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-11-equipment-gate-in-job-mdsl-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Job MDSL Updates

### Task 1: Update settler.mdsl with equipment gate

**Files:**
- Modify: `01 - Projects/Project Meridian/jobs/settler.mdsl`

- [ ] **Step 1: Replace settler.mdsl contents**

Replace the entire contents of `01 - Projects/Project Meridian/jobs/settler.mdsl` with:

```
root [Job] {
    selector {
        /* Equipment maintenance before work */
        sequence {
            condition [HasJob]
            selector {
                condition [NeedsEquipment]
                condition [NeedsRepair]
            }
            selector {
                /* Option 1: Repair immediately if has tools */
                sequence {
                    condition [NeedsRepair]
                    condition [HasTools]
                    action [RepairWithTools]
                }
                /* Option 2: Buy new equipment if missing/depleted */
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
                /* Option 3: Buy tools for future repair */
                sequence {
                    condition [NeedsRepair]
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

        /* Collect produced food from farm */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [CollectProduced]
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

Note: The old `NeedsTools` buy-tools branches (lines 22-34 of the previous version) are removed — the equipment gate's Option 3 supersedes them.

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass (MDSL changes don't affect unit tests, but this verifies no regression).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/settler.mdsl"
git commit -m "feat(meridian): add equipment maintenance gate to settler.mdsl"
```

---

### Task 2: Update craftsman.mdsl with equipment gate

**Files:**
- Modify: `01 - Projects/Project Meridian/jobs/craftsman.mdsl`

- [ ] **Step 1: Replace craftsman.mdsl contents**

Replace the entire contents of `01 - Projects/Project Meridian/jobs/craftsman.mdsl` with:

```
root [Job] {
    selector {
        /* Collect produced tools from workshop */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "tools"]
            action [CollectProduced]
        }

        /* Equipment maintenance before work (after CollectProduced so craftsman can self-supply tools) */
        sequence {
            condition [HasJob]
            selector {
                condition [NeedsEquipment]
                condition [NeedsRepair]
            }
            selector {
                /* Option 1: Repair immediately if has tools */
                sequence {
                    condition [NeedsRepair]
                    condition [HasTools]
                    action [RepairWithTools]
                }
                /* Option 2: Buy new equipment if missing/depleted */
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
                /* Option 3: Buy tools for future repair */
                sequence {
                    condition [NeedsRepair]
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

Note: The gate is placed AFTER `CollectProduced` so the craftsman picks up produced tools first. If NeedsRepair is true after collecting, Option 1 fires immediately — no market trip needed.

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/craftsman.mdsl"
git commit -m "feat(meridian): add equipment maintenance gate to craftsman.mdsl"
```

---

### Task 3: Update guard.mdsl with equipment gate

**Files:**
- Modify: `01 - Projects/Project Meridian/jobs/guard.mdsl`

- [ ] **Step 1: Replace guard.mdsl contents**

Replace the entire contents of `01 - Projects/Project Meridian/jobs/guard.mdsl` with:

```
root [Job] {
    selector {
        /* Equipment maintenance before work */
        sequence {
            condition [HasJob]
            selector {
                condition [NeedsEquipment]
                condition [NeedsRepair]
            }
            selector {
                /* Option 1: Repair immediately if has tools */
                sequence {
                    condition [NeedsRepair]
                    condition [HasTools]
                    action [RepairWithTools]
                }
                /* Option 2: Buy new equipment if missing/depleted */
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
                /* Option 3: Buy tools for future repair */
                sequence {
                    condition [NeedsRepair]
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

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/guard.mdsl"
git commit -m "feat(meridian): add equipment maintenance gate to guard.mdsl"
```

---

## Chunk 2: Remove Dead Branches from base.mdsl

### Task 4: Remove P4.45 and P4.5 from base.mdsl

**Files:**
- Modify: `01 - Projects/Project Meridian/behavior-trees/base.mdsl:200-240`

- [ ] **Step 1: Remove P4.45 repair branch**

In `01 - Projects/Project Meridian/behavior-trees/base.mdsl`, find and delete this block (currently lines 200-224):

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

Including the trailing blank line.

- [ ] **Step 2: Remove P4.5 buy equipment branch**

In the same file, find and delete this block (previously lines 226-240):

```
        /* P4.5: Buy equipment if affordable, available, and not recovering */
        sequence {
            flip { condition [IsRecovering] }
            flip { condition [IsNighttime] }
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

Including the trailing blank line.

The result: after P4.3 (claim quest) the next branch should be P4.6 (supply chain).

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "refactor(meridian): remove P4.45 and P4.5 — now handled by job MDSL gates"
```
