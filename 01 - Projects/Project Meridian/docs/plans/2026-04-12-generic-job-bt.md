# Generic Job BT Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-job `.mdsl` files with a single `default.mdsl` generic tree so all 11 job roles drive agents to work at their facilities.

**Architecture:** Create `jobs/default.mdsl` with the equipment→collect→work→seek→wander flow. Modify `world-loader.ts` to load the default tree as a fallback for jobs without a custom `.mdsl` file. Delete the three old per-job trees. Update `bt-inspector-view.ts` to reference the new file.

**Tech Stack:** TypeScript strict, Vitest, mistreevous 4.3.1 MDSL syntax, Obsidian plugin runtime.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-12-generic-job-bt-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/<path> --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

**Working directory:** All `cd` commands go to `01 - Projects/Project Meridian`. The git root is `c:\Projects\flowti`; use full paths for `git mv`/`git rm`.

---

## File Structure

**Created:**
- `jobs/default.mdsl` — generic job tree covering production, service, and area_effect facility kinds

**Modified:**
- `src/infrastructure/engine/world-loader.ts:165-180` — add default.mdsl fallback for jobs without custom trees
- `src/infrastructure/ui/bt-inspector-view.ts:174-185` — replace hardcoded settler/craftsman/guard entries with default
- `tests/infrastructure/engine/world-loader.test.ts` — update existing tests + add fallback test cases

**Deleted:**
- `jobs/settler.mdsl`
- `jobs/craftsman.mdsl`
- `jobs/guard.mdsl`

---

## Chunk 1: Implementation (4 tasks)

### Task 1: Create `jobs/default.mdsl`

**Files:**
- Create: `jobs/default.mdsl`

- [ ] **Step 1: Create the file**

Create `jobs/default.mdsl` with the tree from the spec:

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

        /* Collect produced goods — skips for service/area_effect (empty stock) */
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

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/default.mdsl"
git commit -m "feat(meridian): add generic default.mdsl job tree"
```

---

### Task 2: Update world-loader fallback + tests

**Files:**
- Modify: `src/infrastructure/engine/world-loader.ts:165-180`
- Modify: `tests/infrastructure/engine/world-loader.test.ts`

- [ ] **Step 1: Write failing test for default fallback**

Add to `tests/infrastructure/engine/world-loader.test.ts`:

```typescript
it('falls back to default.mdsl for jobs without custom tree', async () => {
    const vault = createMockVault({
        '01 - Projects/Project Meridian/behavior-trees/base.mdsl': baseMdsl,
        '01 - Projects/Project Meridian/jobs/default.mdsl': jobMdsl,
        // Note: no settler.mdsl, guard.mdsl, or craftsman.mdsl
    });

    const loader = createWorldLoader(logger, loaderConfig);
    const result = await loader.load(vault);

    // All 3 jobs should get the default tree
    expect(result.jobTrees['settler']).toBeDefined();
    expect(result.jobTrees['guard']).toBeDefined();
    expect(result.jobTrees['craftsman']).toBeDefined();
    expect(result.jobTrees['settler']).toContain('Wander');
});

it('prefers custom tree over default when both exist', async () => {
    const customMdsl = 'root [Job] {\n    action [Work]\n}\n';
    const vault = createMockVault({
        '01 - Projects/Project Meridian/behavior-trees/base.mdsl': baseMdsl,
        '01 - Projects/Project Meridian/jobs/default.mdsl': jobMdsl,
        '01 - Projects/Project Meridian/jobs/settler.mdsl': customMdsl,
    });

    const loader = createWorldLoader(logger, loaderConfig);
    const result = await loader.load(vault);

    // settler gets custom, others get default
    expect(result.jobTrees['settler']).toContain('Work');
    expect(result.jobTrees['settler']).not.toContain('Wander');
    expect(result.jobTrees['guard']).toContain('Wander');
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/infrastructure/engine/world-loader.test.ts --config configs/vitest.config.ts`
Expected: FAIL — the two new tests fail because world-loader doesn't have fallback logic yet.

- [ ] **Step 3: Implement the fallback in world-loader.ts**

Replace lines 165-180 of `src/infrastructure/engine/world-loader.ts`:

```typescript
// Compose job trees from config definitions
const jobNames = Object.keys(config.jobDefinitions ?? {});
if (baseMdsl !== '') {
    // Load default job tree (fallback for jobs without custom .mdsl)
    let defaultJobMdsl: string | null = null;
    const defaultResult = await mdslLoader.loadComposed(
        vault,
        `${btPath}/base.mdsl`,
        `${jobsPath}/default.mdsl`,
    );
    collectErrors('jobs', defaultResult.errors, errors);
    if (defaultResult.mdsl !== null) defaultJobMdsl = defaultResult.mdsl;

    for (const jobName of jobNames) {
        const result = await mdslLoader.loadComposed(
            vault,
            `${btPath}/base.mdsl`,
            `${jobsPath}/${jobName}.mdsl`,
        );
        if (result.mdsl !== null) {
            jobTrees[jobName] = result.mdsl;
            btMdslDefinitions[jobName] = result.mdsl;
        } else if (defaultJobMdsl !== null) {
            jobTrees[jobName] = defaultJobMdsl;
            btMdslDefinitions[jobName] = defaultJobMdsl;
            logger.info('WorldLoader', `Job "${jobName}" has no custom tree — using default`);
        } else {
            collectErrors('jobs', result.errors, errors);
        }
    }
}
```

- [ ] **Step 4: Update existing tests that reference old tree files**

In `world-loader.test.ts`, update the two existing tests that provide `settler.mdsl`/`guard.mdsl`/`craftsman.mdsl` in their vault mocks. Add `default.mdsl` to each vault mock alongside the custom files:

For the `'loads all resource types including job MDSL trees'` test (line 87):
```typescript
'01 - Projects/Project Meridian/jobs/default.mdsl': jobMdsl,
```
Add this line to the vault mock alongside the existing settler/guard/craftsman entries.

For the `'loads job trees keyed by job name'` test (line 160):
```typescript
'01 - Projects/Project Meridian/jobs/default.mdsl': jobMdsl,
```
Add this line to the vault mock.

- [ ] **Step 5: Run tests — all pass**

Run: `npx vitest run tests/infrastructure/engine/world-loader.test.ts --config configs/vitest.config.ts`
Expected: All tests pass including the two new ones.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/world-loader.ts" \
       "01 - Projects/Project Meridian/tests/infrastructure/engine/world-loader.test.ts"
git commit -m "feat(meridian): world-loader falls back to default.mdsl for jobs without custom trees"
```

---

### Task 3: Update bt-inspector-view.ts

**Files:**
- Modify: `src/infrastructure/ui/bt-inspector-view.ts:174-185`

- [ ] **Step 1: Replace the three hardcoded entries**

Replace lines 174-185:

```typescript
// Old:
// { label: 'settler (base + settler)', makeRef: (root) => ({ kind: 'job', branchPath: `${root}/jobs/settler.mdsl`, ... }) },
// { label: 'craftsman (base + craftsman)', makeRef: ... },
// { label: 'guard (base + guard)', makeRef: ... },

// New:
{
    label: 'default (base + default)',
    makeRef: (root) => ({ kind: 'job', branchPath: `${root}/jobs/default.mdsl`, basePath: `${root}/behavior-trees/base.mdsl` }),
},
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/ui/bt-inspector-view.ts"
git commit -m "refactor(meridian): bt-inspector shows default job tree instead of deleted per-job entries"
```

---

### Task 4: Delete old per-job trees + deploy + full verify

**Files:**
- Delete: `jobs/settler.mdsl`
- Delete: `jobs/craftsman.mdsl`
- Delete: `jobs/guard.mdsl`

- [ ] **Step 1: Delete the three files**

```bash
cd "c:/Projects/flowti"
git rm "01 - Projects/Project Meridian/jobs/settler.mdsl" \
       "01 - Projects/Project Meridian/jobs/craftsman.mdsl" \
       "01 - Projects/Project Meridian/jobs/guard.mdsl"
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: 1493+ passing. No regressions.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: clean (0 errors).

- [ ] **Step 4: Deploy default.mdsl to production vault**

```bash
cp "c:/Projects/flowti/01 - Projects/Project Meridian/jobs/default.mdsl" \
   "c:/Projects/meridian/03 - Resources/jobs/default.mdsl"
# Also remove old files from production vault
rm -f "c:/Projects/meridian/03 - Resources/jobs/settler.mdsl" \
      "c:/Projects/meridian/03 - Resources/jobs/craftsman.mdsl" \
      "c:/Projects/meridian/03 - Resources/jobs/guard.mdsl"
```

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(meridian): delete per-job trees (settler, craftsman, guard) — replaced by default.mdsl"
```

---

## Completion

After all tasks land and tests pass:

1. Rebuild the Obsidian plugin (`npm run build` from the project root)
2. Run a recording session — verify success criteria from the spec:
   - Employed agents show `seek_work` then `work` actions during day phase
   - `ProductionComplete` events fire
   - Non-zero wages in daily summary
   - Well stock increases (water produced)
