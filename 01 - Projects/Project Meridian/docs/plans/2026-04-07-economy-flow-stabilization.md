# Economy Flow Stabilization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the economy death spiral so the simulation sustains day-over-day with gold circulation, rested agents, and differentiated personalities.

**Architecture:** 7 independent fixes — 2 MDSL rewrites, 2 config changes, 1 quest system tweak, 1 new BT condition + MDSL branch, 3 data file edits. All changes are small, independently testable, and commit separately.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, JSON data files.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-07-economy-flow-stabilization-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: MDSL Reordering & Config Fixes

### Task 1: Reorder settler.mdsl — work before sell

**Files:**
- Modify: `jobs/settler.mdsl`

- [ ] **Step 1: Rewrite settler.mdsl**

Replace `jobs/settler.mdsl` with the reordered version. Work/seek-work come first, then buy-tools, then sell:

```
root [Job] {
    selector {
        /* Harvest food from farm if stock available */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [Harvest]
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

        /* Sell excess at market — but only if not hungry and above reserve */
        sequence {
            condition [AtLocation, "market"]
            condition [HasFoodReserve]
            flip { condition [IsHungry] }
            action [SellAtMarket]
        }
        /* Go to market to sell if carrying excess and not hungry */
        sequence {
            condition [HasFoodReserve]
            flip { condition [IsHungry] }
            action [SeekMarket]
        }

        action [Wander]
    }
}
```

- [ ] **Step 2: Verify BT loads**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass. The MDSL is loaded and parsed by the BT system during integration tests.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/settler.mdsl"
git commit -m "fix(meridian): reorder settler BT — work before sell to fix economy stall"
```

---

### Task 2: Reorder craftsman.mdsl — work before sell

**Files:**
- Modify: `jobs/craftsman.mdsl`

- [ ] **Step 1: Rewrite craftsman.mdsl**

Replace `jobs/craftsman.mdsl` with the reordered version:

```
root [Job] {
    selector {
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

        action [Wander]
    }
}
```

- [ ] **Step 2: Verify BT loads**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/jobs/craftsman.mdsl"
git commit -m "fix(meridian): reorder craftsman BT — work before sell to fix economy stall"
```

---

### Task 3: Set travel and rest commitment ticks

**Files:**
- Modify: `configs/game-config.json`

- [ ] **Step 1: Update commitment_ticks in game-config.json**

In `configs/game-config.json`, in the `commitment_ticks` object, change these values:

```json
"seek_work": 15,
"seek_food": 10,
"seek_rest": 10,
"seek_water": 10,
"seek_market": 15,
"seek_social": 10,
"seek_quest": 10,
"seek_delivery": 10,
"seek_supply": 10,
"seek_job_facility": 10,
"rest": 20
```

Also add a new entry (not currently in the config):
```json
"seek_leisure": 10
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass. Config defaults in schema match, runtime reads from file.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "fix(meridian): add travel and rest commitment ticks — prevent mid-journey preemption"
```

---

### Task 4: Assign agent traits

**Files:**
- Modify: `agents/aldric.json`
- Modify: `agents/bram.json`
- Modify: `agents/celia.json`

- [ ] **Step 1: Update aldric.json**

Change `"traits": []` to `"traits": ["hardy"]`

- [ ] **Step 2: Update bram.json**

Change `"traits": []` to `"traits": ["brave"]`

- [ ] **Step 3: Update celia.json**

Change `"traits": []` to `"traits": ["curious"]`

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass. Trait IDs match defined traits in `traits/` directory.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/agents/"
git commit -m "fix(meridian): assign traits — hardy Aldric, brave Bram, curious Celia"
```

---

## Chunk 2: Quest Cleanup & Social Emergency

### Task 5: Immediate quest board cleanup

**Files:**
- Modify: `src/infrastructure/systems/quest-evaluation-system.ts:26-28`
- Test: `tests/infrastructure/systems/quest-evaluation-system.test.ts`

- [ ] **Step 1: Write failing test**

In `tests/infrastructure/systems/quest-evaluation-system.test.ts`, add a test that verifies completed quests are removed immediately (not waiting for expiry):

```typescript
it('removes completed quests immediately regardless of expiry', () => {
	const board = worldEntity.get(QuestBoardComponent);
	board.state = {
		...board.state,
		quests: [
			{
				id: 'q-fresh',
				type: 'repair',
				state: 'completed',
				facilityId: 'loc-bakery',
				createdTick: 90,
				expiryTicks: 480,
				claimedBy: 'agent-aldric',
				repairProgress: 50,
				reward: 25,
			},
		],
	};
	board.markDirty();

	// Tick 100 — quest was completed at tick ~95, expiry at tick 570
	// Current code would NOT remove it (100 - 90 = 10 < 480)
	system.execute({ ...deps, tickCount: 100 });

	expect(board.state.quests).toHaveLength(0);
});
```

Adapt the test setup to match the existing test file patterns (look at how `worldEntity`, `board`, `deps`, and `system` are created in the existing tests).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/quest-evaluation-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — completed quest not removed because expiry hasn't passed.

- [ ] **Step 3: Fix the staleCompleted filter**

In `src/infrastructure/systems/quest-evaluation-system.ts`, line 26-28, change:

```typescript
const staleCompleted = board.state.quests.filter(
	q => q.state === 'completed' && deps.tickCount - q.createdTick > q.expiryTicks,
);
```

to:

```typescript
const staleCompleted = board.state.quests.filter(
	q => q.state === 'completed',
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/quest-evaluation-system.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/quest-evaluation-system.ts"
git add "01 - Projects/Project Meridian/tests/infrastructure/systems/quest-evaluation-system.test.ts"
git commit -m "fix(meridian): remove completed quests immediately — clean board for new generation"
```

---

### Task 6: Add IsSociallyCritical condition

**Files:**
- Modify: `src/domain/schemas/ranges.ts:19-20`
- Modify: `src/infrastructure/entity/bt-conditions-survival.ts:7, 9, 62+`
- Modify: `src/infrastructure/entity/bt-conditions.ts:13+`
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`

- [ ] **Step 1: Add social to NEED_CRITICAL_THRESHOLDS**

In `src/domain/schemas/ranges.ts`, line 19-20, change:

```typescript
/** Social intentionally excluded — not a survival need; discomfort only. */
export const NEED_CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, thirst: 20 } as const;
```

to:

```typescript
/** Social included at lower threshold — extreme isolation triggers P0.5 emergency via IsSociallyCritical (not NeedsCritical). */
export const NEED_CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, thirst: 20, social: 15 } as const;
```

**Important:** Do NOT add social to the `NeedsCritical()` function — it stays checking only hunger/energy/thirst. The social threshold is used by the new `IsSociallyCritical` condition only.

- [ ] **Step 2: Add IsSociallyCritical to ConditionMethods interface**

In `src/infrastructure/entity/bt-conditions.ts`, add to the `ConditionMethods` interface (after line 56, `IsAtLeisure`):

```typescript
IsSociallyCritical(): boolean;
```

- [ ] **Step 3: Add IsSociallyCritical to SurvivalKeys and implementation**

In `src/infrastructure/entity/bt-conditions-survival.ts`:

Update the `SurvivalKeys` type (line 7) to include the new condition:
```typescript
type SurvivalKeys = 'IsHungry' | 'IsThirsty' | 'IsExhausted' | 'IsRecovering' | 'IsLonely' | 'NeedsCritical' | 'NeedsTools' | 'NeedsEquipment' | 'IsSociallyCritical';
```

Add the implementation after `NeedsCritical()` (after line 45):

```typescript
IsSociallyCritical(): boolean {
	return actor.get(NeedsComponent).state.social < NEED_CRITICAL_THRESHOLDS.social;
},
```

- [ ] **Step 4: Write failing test**

In `tests/infrastructure/entity/bt-conditions.test.ts`, add:

```typescript
describe('IsSociallyCritical', () => {
	it('returns true when social below critical threshold (15)', () => {
		setNeeds({ hunger: 80, energy: 80, thirst: 80, social: 10 });
		expect(conditions.IsSociallyCritical()).toBe(true);
	});

	it('returns false when social at or above critical threshold', () => {
		setNeeds({ hunger: 80, energy: 80, thirst: 80, social: 15 });
		expect(conditions.IsSociallyCritical()).toBe(false);
	});

	it('returns false when social is healthy', () => {
		setNeeds({ hunger: 80, energy: 80, thirst: 80, social: 50 });
		expect(conditions.IsSociallyCritical()).toBe(false);
	});
});
```

Adapt `setNeeds` and `conditions` to match the existing test file's setup pattern (look at how other conditions like `NeedsCritical` are tested).

- [ ] **Step 5: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass including new IsSociallyCritical tests.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/ranges.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-survival.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions.ts"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): add IsSociallyCritical condition — social < 15 triggers P0.5 emergency"
```

---

### Task 7: Add P0.5 social emergency branch to base.mdsl

**Files:**
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Add P0.5 branch**

In `behavior-trees/base.mdsl`, after the P0 block (after line 61, after the closing `}` of the P0 sequence) and before the P1 block (line 63), add:

```
        /* P0.5: Social emergency — extreme isolation */
        sequence {
            condition [IsSociallyCritical]
            selector {
                sequence {
                    condition [NearAgentClose]
                    action [Talk]
                }
                action [SeekSocial]
            }
        }

```

This fires independently of `NeedsCritical`. Since `IsSociallyCritical` is NOT part of `NeedsCritical`, the P-1 commitment guard (`IsCommitted AND !NeedsCritical`) still works normally — `SeekSocial` commitments are honored and the agent isn't re-preempted by their own social-critical state.

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass. Integration tests validate BT parsing.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "fix(meridian): add P0.5 social emergency branch — rescues agents below social 15"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: no new errors.

- [ ] **Step 4: Verify commit history**

Run: `git log --oneline -8`
Expected: 7 clean commits for the stabilization increment.
