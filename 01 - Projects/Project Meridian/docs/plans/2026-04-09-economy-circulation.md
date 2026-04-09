# Economy Circulation & Agent Resilience Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore gold circulation by enabling dusk selling, fix sleep resilience, and diagnose memory/leisure systems so the economy sustains long-term.

**Architecture:** 6 tasks across 2 chunks. Chunk 1 is BT/config changes (IsDusk condition, P2.75 sell block, P4.5 nighttime guard, hysteresis reduction). Chunk 2 is diagnostic-then-fix for memory and leisure systems. All changes independently testable.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, JSON data files.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-09-economy-circulation-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: BT & Config Fixes

### Task 1: Add IsDusk condition

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-context.ts` — add IsDusk method
- Modify: `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface and ContextKeys
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`

- [ ] **Step 1: Add IsDusk to ConditionMethods interface**

In `src/infrastructure/entity/bt-conditions.ts`, add after `IsAtLeisure(): boolean;` (line 56) and before `IsSociallyCritical(): boolean;`:

```typescript
IsDusk(): boolean;
```

- [ ] **Step 2: Add IsDusk to ContextKeys type**

In `src/infrastructure/entity/bt-conditions-context.ts`, update the `ContextKeys` type (line 6-9) to include `'IsDusk'`:

```typescript
type ContextKeys =
	| 'NearAgent' | 'NearAgentClose' | 'AtLocation' | 'NearLocation'
	| 'IsAtLeisure' | 'IsDaytime' | 'IsNighttime' | 'IsWorkHours'
	| 'ShouldSleep' | 'IsRestDay' | 'IsMoodLow' | 'IsDusk';
```

- [ ] **Step 3: Add IsDusk implementation**

In `src/infrastructure/entity/bt-conditions-context.ts`, add after the `IsDaytime()` method (after line 38):

```typescript
IsDusk(): boolean {
	return worldEntity().get(TimeComponent).state.phase === 'dusk';
},
```

- [ ] **Step 4: Write tests**

In `tests/infrastructure/entity/bt-conditions.test.ts`, add:

```typescript
describe('IsDusk', () => {
	it('returns true during dusk phase', () => {
		setPhase('dusk');
		expect(conditions.IsDusk()).toBe(true);
	});

	it('returns false during day phase', () => {
		setPhase('day');
		expect(conditions.IsDusk()).toBe(false);
	});

	it('returns false during night phase', () => {
		setPhase('night');
		expect(conditions.IsDusk()).toBe(false);
	});
});
```

Adapt `setPhase` and `conditions` to match the existing test file's setup pattern.

- [ ] **Step 5: Run typecheck and tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-context.ts"
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions.ts"
git add "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): add IsDusk condition for dusk-only sell window"
```

---

### Task 2: Add P2.75 sell block + strip job sell branches

**Files:**
- Modify: `behavior-trees/base.mdsl` — add P2.75 between P2 and P2.5
- Modify: `jobs/settler.mdsl` — remove sell branches, keep work + buy-tools
- Modify: `jobs/craftsman.mdsl` — remove sell branches, keep work only

- [ ] **Step 1: Add P2.75 sell block to base.mdsl**

In `behavior-trees/base.mdsl`, after the P2 block closing `}` (after line 83) and before the P2.5 leisure block (line 85), insert:

```
        /* P2.75: Sell excess goods during dusk */
        sequence {
            condition [IsDusk]
            flip { condition [IsRecovering] }
            flip { condition [ShouldSleep] }
            selector {
                /* At market — sell */
                sequence {
                    condition [AtLocation, "market"]
                    selector {
                        sequence {
                            condition [HasFoodReserve]
                            flip { condition [IsHungry] }
                            action [SellAtMarket]
                        }
                        sequence {
                            condition [HasTradeGoods]
                            flip { condition [IsHungry] }
                            action [SellAtMarket]
                        }
                    }
                }
                /* Go to market to sell */
                selector {
                    sequence {
                        condition [HasFoodReserve]
                        flip { condition [IsHungry] }
                        action [SeekMarket]
                    }
                    sequence {
                        condition [HasTradeGoods]
                        flip { condition [IsHungry] }
                        action [SeekMarket]
                    }
                }
            }
        }

```

- [ ] **Step 2: Strip sell branches from settler.mdsl**

Replace `jobs/settler.mdsl` with (work + buy-tools only, no sell):

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

        action [Wander]
    }
}
```

- [ ] **Step 3: Strip sell branches from craftsman.mdsl**

Replace `jobs/craftsman.mdsl` with (work only, no sell):

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

        action [Wander]
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass. Integration tests validate BT parsing.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git add "01 - Projects/Project Meridian/jobs/settler.mdsl"
git add "01 - Projects/Project Meridian/jobs/craftsman.mdsl"
git commit -m "feat(meridian): add P2.75 dusk sell block — agents sell excess at market during dusk"
```

---

### Task 3: Add nighttime guard to P4.5

**File:** `behavior-trees/base.mdsl`

- [ ] **Step 1: Add !IsNighttime to P4.5**

In `behavior-trees/base.mdsl`, find the P4.5 equipment purchase block. It currently starts with:

```
        /* P4.5: Buy equipment if affordable, available, and not recovering */
        sequence {
            flip { condition [IsRecovering] }
            condition [NeedsEquipment]
```

Add `flip { condition [IsNighttime] }` after the `IsRecovering` flip:

```
        /* P4.5: Buy equipment if affordable, available, and not recovering */
        sequence {
            flip { condition [IsRecovering] }
            flip { condition [IsNighttime] }
            condition [NeedsEquipment]
```

Note: `IsNighttime` returns true for both dusk AND night (`phase === 'night' || phase === 'dusk'`). This means equipment shopping only happens during dawn and day phases, which is correct — agents should work/shop during the day, sell at dusk, sleep at night.

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "fix(meridian): block equipment shopping at night — prevents sleep deprivation cycle"
```

---

### Task 4: Reduce recovery hysteresis

**File:** `configs/game-config.json`

- [ ] **Step 1: Change recovery_hysteresis from 50 to 30**

In `configs/game-config.json`, find `"recovery_hysteresis": 50` and change to:

```json
"recovery_hysteresis": 30
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass. Default value in schema should match or be overridden by config file.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "fix(meridian): reduce recovery hysteresis 50→30 — agents return to work faster after crashes"
```

---

## Chunk 2: Memory & Leisure Diagnostics

### Task 5: Diagnose and fix memory system

**Context for the implementer:**

All agents show 0/50 memory entries across 8 game days (10 snapshots). One quest_completed memory appeared for Bram at tick 1428 then vanished by Day 6 (~tick 2880).

**What the code shows:** Memories ARE created by specific systems:
- `LeisureSystem` (line 124-140): creates positive memory when `leisure.effects.mood > 0`
- `GossipSystem` (line 143-152): creates gossip memories
- `DialogueSystem` (line 116): creates dialogue memories
- `bt-actions-quest.ts` (line 153, 189): creates quest start/completion/abandonment memories

Memory decay in `applyMemoryDecay()`: prunes entries with significance < 1. Decay formula: `decayAmount = 0.1 / (originalSig / 5)`. For significance 5: decay = 0.1/tick. Memory drops from 5 to <1 in 40 ticks after `min_lifespan_ticks` expires.

**Two problems to investigate and fix:**

**Problem A: Common events don't create memories.** Production cycles, wages, eating, resting, buying, selling — none create memory entries. Only infrequent events (quests, leisure, dialogue, gossip) do. Agents who just work and eat all day accumulate zero memories.

**Investigation steps:**
1. Read `src/domain/core/component-data.ts` — check `MemoryEntry` type definition and what fields it needs
2. Confirm which systems currently write to MemoryComponent
3. Decide which common events should create memories: at minimum, `quest_completed` (already works), `trade/purchase` (buying food), `social/talk` (conversation), and optionally `production` (completing a work cycle)

**Fix:** Add memory creation to the systems that handle these events. The simplest approach: in `bt-actions-quest.ts` CompleteQuest (already creates memory — verify it works), in `TradeSystem` for purchases, in `DialogueSystem` or `SocializeSystem` for Talk actions. Each memory needs: `tick`, `type`, `description`, `participants`, `outcome`, `significance`, `mood_impact`.

**Problem B: Decay may be too aggressive.** A significance-5 memory lasts only `min_lifespan + ~40 ticks`. Check what `min_lifespan_ticks` defaults to in the schema. If it's low (e.g., 100), memories vanish within ~140 ticks (< 1/3 of a day). Consider increasing significance for important events or tuning the decay formula.

**Investigation steps:**
1. Read `GameConfigSchema` for `config.memory.min_lifespan_ticks` default value
2. Calculate effective memory lifetime for significance 3, 5, and 8
3. If lifetime is too short (< 1 day for significance 5), either increase `min_lifespan_ticks` or reduce the decay rate constant from 0.1 to something lower

**TDD approach:**
1. Write a test that creates an agent with a significance-5 memory at tick 0, runs memory decay at tick 960 (1 day), and expects the memory to still exist
2. Run test — if it fails, the decay is too aggressive
3. Tune `min_lifespan_ticks` or decay constant until the test passes
4. Write a test that verifies `TradeSystem` creates a memory entry on purchase
5. Implement the memory creation

- [ ] **Step 1: Investigate memory config defaults**

Read `src/domain/schemas/game-config-schema.ts` and find the `memory` config section. Check what `min_lifespan_ticks` defaults to. Calculate how long a significance-5 memory survives: `min_lifespan_ticks + (5 - 1) / (0.1 / (5/5))` = `min_lifespan_ticks + 40 ticks`.

- [ ] **Step 2: Write failing test for memory persistence**

In `tests/infrastructure/systems/memory-decay-system.test.ts`, add:

```typescript
it('significance-5 memory survives at least one full game day (480 ticks)', () => {
	const memory = [{
		tick: 0, type: 'quest_completed', description: 'completed repair',
		participants: [], outcome: 'positive' as const, significance: 5, mood_impact: 10,
	}];
	const agent = new AgentActor(createTestAgent(memory), defaultMoodConfig);
	const system = createMemoryDecaySystem(() => [agent]);

	// Run decay at end of day 1
	system.execute({ ...deps, tickCount: 480 });

	const memComp = agent.get(MemoryComponent);
	expect(memComp.state.entries.length).toBe(1);
	expect(memComp.state.entries[0].significance).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 3: Run test — if it fails, tune decay parameters**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/memory-decay-system.test.ts --config configs/vitest.config.ts`

If FAIL: increase `min_lifespan_ticks` in `game-config.json` (try 480 — one full day), or reduce the decay constant in `applyMemoryDecay` from 0.1 to 0.02. Choose whichever is simpler.

- [ ] **Step 4: Write failing test for trade purchase memory**

In `tests/infrastructure/systems/trade-system.test.ts`, add a test verifying that a successful purchase creates a memory entry on the buyer's MemoryComponent:

```typescript
it('creates a positive memory for the buyer on successful purchase', () => {
	// Set up agent with btAction='buy', place near facility with food in stock
	// Execute trade system
	// Assert: buyer's MemoryComponent has a new entry with type containing 'purchase'
});
```

Adapt to the existing trade-system test setup pattern.

- [ ] **Step 5: Implement trade purchase memory creation**

In `src/infrastructure/systems/trade-system.ts`, after a successful trade (inside the success branch of `applySuccessfulTrade()`), add memory creation:

```typescript
const memComp = buyer.get(MemoryComponent);
memComp.state = {
	...memComp.state,
	entries: [
		...memComp.state.entries,
		{
			tick: deps.tickCount,
			type: `purchase_${itemId}`,
			description: `Bought ${itemId} for ${price}g`,
			participants: [facilityId],
			outcome: 'positive' as const,
			significance: 3,
			mood_impact: 2,
		},
	],
};
memComp.markDirty();
```

Import `MemoryComponent` at the top of the file if not already imported.

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/" "01 - Projects/Project Meridian/tests/" "01 - Projects/Project Meridian/configs/"
git commit -m "fix(meridian): tune memory decay + add purchase memories — memories persist and accumulate"
```

---

### Task 6: Diagnose and fix leisure gold spending

**Context for the implementer:**

On Day 7 (rest day), agents visited leisure locations and hit social 100, but no leisure `GoldFlowed` events appeared in the simulation snapshot's gold flow summary. The LeisureSystem code (lines 62-108) DOES deduct gold and emit GoldFlowed — the code looks correct.

**Possible causes:**
1. Agents chose free Park (cost=0) instead of paid locations — the `if (leisure.cost > 0)` guard would skip gold deduction
2. The `GoldFlowed` event is emitted with `subcategory: 'leisure'` and `category: 'transfer'` — the snapshot's gold flow summary might group it under a different label than expected
3. The `ChooseLeisure` BT action's scoring algorithm may consistently prefer free locations over paid ones
4. The `Leisure` BT action may not set `btAction = 'leisure'` correctly, so the LeisureSystem's `if (btAction !== 'leisure') continue` guard skips the agent

**Investigation steps:**

- [ ] **Step 1: Read ChooseLeisure action scoring**

Read `src/infrastructure/entity/bt-actions-leisure.ts` — find the `ChooseLeisure` action. Check how it scores leisure locations. If cost is a negative factor in the score, agents will prefer free Park over paid Tavern/Library/Bathhouse.

- [ ] **Step 2: Read leisure location JSON files**

Read `locations/park.json`, `locations/tavern.json`, `locations/library.json`, `locations/bathhouse.json`. Check their `leisure` config blocks — costs, effects, ticks_per_visit.

- [ ] **Step 3: Check if ChooseLeisure considers gold affordability**

If an agent can't afford a location (gold < cost), it should be excluded. But if all agents have 100+ gold, affordability isn't the issue.

- [ ] **Step 4: Write test verifying gold deduction**

In `tests/infrastructure/systems/leisure-system.test.ts`, add:

```typescript
it('deducts gold from agent and credits facility on first leisure tick at paid location', () => {
	// Set up agent with btAction='leisure', leisureTarget='loc-tavern'
	// Tavern has cost=3
	// Initial wallet: 50g
	// Execute leisure system
	// Assert: wallet = 47g, facility fund increased by 3g
	// Assert: GoldFlowed event emitted with amount=3
});
```

- [ ] **Step 5: Run test — determine if code works or not**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/leisure-system.test.ts --config configs/vitest.config.ts`

If PASS: the code works, the issue is agent location choice (preferring free Park). Tune the scoring in `ChooseLeisure` to not penalize cost, or add a small bonus for paid locations.

If FAIL: debug the gold deduction path and fix.

- [ ] **Step 6: Apply fix based on diagnosis**

If the issue is scoring: adjust `ChooseLeisure` in `bt-actions-leisure.ts` so that cost is not a penalty factor (or is negligible). The goal is agents choosing a mix of locations based on personality/needs, not always defaulting to the cheapest.

If the issue is code: fix the broken path.

- [ ] **Step 7: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/" "01 - Projects/Project Meridian/tests/"
git commit -m "fix(meridian): ensure leisure spending fires — agents pay for paid leisure locations"
```

---

### Task 7: Final verification

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
Expected: clean commits for all tasks.
