# Generic Job BT Design

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Replace per-job `.mdsl` files with a single `default.mdsl` generic tree. Fix the root cause of employed agents never working.

---

## Problem

The facility production feature added 8 new jobs (`blacksmith`, `water_carrier`, `innkeeper`, `bartender`, `bathhouse_keeper`, `librarian`, `park_keeper`, `shopkeeper`) but created no `.mdsl` files for them. The world-loader composes job trees by merging `base.mdsl` with `jobs/<jobName>.mdsl`. When no file exists, `loadComposed` fails and the job isn't added to `jobTrees`. At runtime, `swapBehaviorTree('water_carrier')` falls back to `joblessMdsl` — which replaces `branch [Job]` with `action [Wander]`.

**Result:** Agents claim jobs correctly (3/3 employed by tick 300) but run the jobless tree. They wander indefinitely, never travel to their facility, never trigger `Work`, and earn zero wages. The economy is frozen.

**Secondary bug:** The three existing trees (`settler.mdsl`, `craftsman.mdsl`, `guard.mdsl`) use `AtLocation, "market"` — stale after the facility migration changed `AtLocation` to read `facility_type`. The correct value is `"market_stall"`.

---

## Design

### Single generic tree: `jobs/default.mdsl`

All three existing job trees share the same structure:

1. Equipment maintenance (repair/buy tools/equipment)
2. Collect produced goods if at facility with stock
3. Work at facility while work hours
4. Travel to facility
5. Fallback wander

The only variation is which item to collect (settler: food, craftsman: tools). The generic tree uses `CollectProduced` which already picks the first available stock item — no item-specific gating needed.

For service and area_effect facility kinds, step 2 naturally skips because those facilities have no production stock (`FacilityHasStock` returns false). Step 3 (`Work`) still fires — the ServiceSystem and AreaEffectSystem both key off `btAction === 'work'` to pay wages and fire pulses.

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
                sequence {
                    condition [NeedsRepair]
                    condition [HasTools]
                    action [RepairWithTools]
                }
                sequence {
                    condition [NeedsEquipment]
                    condition [CanAffordItem, "equipment"]
                    selector {
                        sequence {
                            condition [AtLocation, "market_stall"]
                            condition [FacilityHasStock, "equipment"]
                            action [BuyItem, "equipment"]
                        }
                        action [SeekMarket]
                    }
                }
                sequence {
                    condition [NeedsRepair]
                    condition [CanAffordItem, "tools"]
                    selector {
                        sequence {
                            condition [AtLocation, "market_stall"]
                            condition [FacilityHasStock, "tools"]
                            action [BuyItem, "tools"]
                        }
                        action [SeekMarket]
                    }
                }
            }
        }

        /* Collect any produced goods from facility stock.
         * No FacilityHasStock guard — CollectProduced returns FAILED on
         * empty stock (bt-actions-needs.ts:74). Service/area_effect
         * facilities naturally skip because their stock is always empty. */
        sequence {
            condition [AtJobFacility]
            action [CollectProduced]
        }

        /* Work at facility */
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsWorkHours)
        }

        /* Travel to work */
        sequence {
            condition [HasJob]
            action [SeekWork]
        }

        action [Wander]
    }
}
```

**Note on collect ordering:** The existing `craftsman.mdsl` placed collect-produced *before* equipment maintenance so craftsmen self-supply tools before repair. The generic tree reverses this (equipment first). This is an acceptable simplification — craftsmen who need repair will seek tools at market first, or collect on the next tick. The one-tick delay is negligible and avoids tree complexity for a single role.

### World-loader fallback

Change `world-loader.ts` to load `jobs/default.mdsl` once at startup. For any job name without a dedicated `.mdsl` file, use the default tree instead of failing.

```typescript
// Load default job tree (fallback for jobs without custom .mdsl)
let defaultJobMdsl: string | null = null;
const defaultResult = await mdslLoader.loadComposed(vault, `${btPath}/base.mdsl`, `${jobsPath}/default.mdsl`);
collectErrors('jobs', defaultResult.errors, errors);
if (defaultResult.mdsl !== null) defaultJobMdsl = defaultResult.mdsl;

for (const jobName of jobNames) {
    const result = await mdslLoader.loadComposed(vault, `${btPath}/base.mdsl`, `${jobsPath}/${jobName}.mdsl`);
    if (result.mdsl !== null) {
        jobTrees[jobName] = result.mdsl;
        btMdslDefinitions[jobName] = result.mdsl;
    } else if (defaultJobMdsl !== null) {
        // Fallback to default — suppress missing-file errors (expected, not a problem)
        jobTrees[jobName] = defaultJobMdsl;
        btMdslDefinitions[jobName] = defaultJobMdsl;
        logger.info('WorldLoader', `Job "${jobName}" has no custom tree — using default`);
    } else {
        // No custom tree AND no default — this is a real error
        collectErrors('jobs', result.errors, errors);
    }
}
```

### Files deleted

| File | Reason |
|------|--------|
| `jobs/settler.mdsl` | Replaced by `default.mdsl` |
| `jobs/craftsman.mdsl` | Replaced by `default.mdsl` |
| `jobs/guard.mdsl` | Replaced by `default.mdsl` |

No backward compatibility shims. The `default.mdsl` covers all three roles identically.

### Files created

| File | Content |
|------|---------|
| `jobs/default.mdsl` | Generic job tree (shown above) |

### Files modified

| File | Change |
|------|--------|
| `src/infrastructure/engine/world-loader.ts` | Add default.mdsl fallback logic, suppress missing-file errors when fallback exists, update `btMdslDefinitions` for fallback jobs |
| `src/infrastructure/ui/bt-inspector-view.ts` | Replace hardcoded settler/craftsman/guard entries with single `default` entry pointing to `jobs/default.mdsl` |

### `FacilityHasStock` condition check

Review the existing `FacilityHasStock(itemId)` condition. If it doesn't support a wildcard, simplify the collect branch to:

```
sequence {
    condition [AtJobFacility]
    action [CollectProduced]
}
```

`CollectProduced` already handles the empty-stock case by returning FAILED (line 74 of `bt-actions-needs.ts`: `if (stockItem === undefined) return FAILED`). The extra condition is an optimization, not a correctness requirement.

---

## Test strategy

**Existing tests:** The `bt-loader.test.ts` and `bt-actions.test.ts` suites verify tree composition and action behavior. No new test files needed — extend existing suites.

**New test cases:**
- `world-loader.test.ts`: job without custom `.mdsl` falls back to `default.mdsl`
- `world-loader.test.ts`: job WITH custom `.mdsl` still uses custom tree (future extensibility)
- `bt-loader.test.ts`: `default.mdsl` composes with `base.mdsl` and parses clean

**Recording verification (manual):**
- Agents with `water_carrier` / `craftsman` jobs show `seek_work` then `work` actions during day phase
- `ProductionComplete` events fire within 200 ticks of employment
- Wages flow: `GoldFlowed` events with `subcategory: 'wage'`
- Well stock increases (water produced)
- Workshop stock increases (tools produced)

---

## Success criteria

| Metric | Target |
|--------|--------|
| Agents working | All employed agents show `work` action during day phase |
| Production | At least 1 `ProductionComplete` event within first 200 ticks |
| Wages | Non-zero wages in daily summary by end of day 1 |
| Water economy | Well stock > 10 by tick 500 |
| No regressions | Full test suite passes (1493+) |

---

## Scope exclusions

- No custom per-job trees for the 8 new roles (deferred until roles diverge in gameplay)
- No changes to base.mdsl (P2 `branch [Job]` mechanism unchanged)
- No changes to FacilitySystem, ServiceSystem, or AreaEffectSystem (they already key off `btAction === 'work'`)
- Guard patrol behavior (future iteration)
