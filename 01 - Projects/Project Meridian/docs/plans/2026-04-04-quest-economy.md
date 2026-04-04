# Quest Economy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Facilities autonomously generate quests, agents claim and complete them for gold + memory + mood, abandoned facilities self-heal through repair quests, and agents go inside facilities when working.

**Architecture:** Four workstreams executed sequentially: (1) debt fixes to clean the foundation, (2) facility abandonment as a quest trigger, (3) the quest system (schema, board, generation, evaluation, 9 BT methods), (4) facility interior with perception filtering. Each system follows the dual-layer pattern (pure domain function + infrastructure ECS wrapper). Quest board lives on the world entity. BT conditions/actions added to the existing extracted modules (bt-conditions.ts, bt-actions.ts).

**Tech Stack:** TypeScript (strict), Vitest, ExcaliburJS ECS, Mistreevous BT, Zod schemas

**Spec:** `docs/specs/2026-04-04-quest-economy-design.md`

**Run commands from:** `cd "01 - Projects/Project Meridian"`

**Test command:** `npx vitest run --config configs/vitest.config.ts`

**Single test:** `npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Lint:** `npx eslint src/ --config configs/eslint.config.mjs`

**Typecheck:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Debt Fixes

### Task 1: Typed attribute accessor (I4)

**Files:**
- Modify: `src/infrastructure/components/attributes-component.ts`
- Modify: `src/infrastructure/entity/bt-conditions.ts` (1 cast site)
- Modify: `src/infrastructure/entity/bt-actions.ts` (2 cast sites)
- Modify: `src/infrastructure/systems/mood-system.ts` (1 cast site)
- Modify: `src/infrastructure/systems/facility-system.ts` (1 cast site)
- Test: `tests/infrastructure/components/attributes-component.test.ts` (create if needed)

- [ ] **Step 1: Add getByName() to AttributesComponent**

In `src/infrastructure/components/attributes-component.ts`, add:

```typescript
getByName(name: string): number {
	return (this.state as Record<string, number>)[name] ?? 0;
}
```

- [ ] **Step 2: Replace all 5 cast sites**

Search for `as unknown as Record<string, number>` across the codebase. Replace each with `actor.get(AttributesComponent).getByName(fieldName)`. There are 5 occurrences:

1. `bt-conditions.ts` — BetterPayAvailable (1 site)
2. `bt-actions.ts` — SwitchJob, ClaimBestJob (2 sites)
3. `mood-system.ts` — goalProgress (1 site)
4. `facility-system.ts` — aptitude efficiency (1 site)

- [ ] **Step 3: Run typecheck and tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: Clean typecheck, all tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(meridian): typed attribute accessor — replace 5 unsafe casts with getByName()"
```

---

### Task 2: maxCharges from item registry (I2)

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts` (add items map)
- Modify: `src/infrastructure/systems/mood-system.ts` (use item registry)

- [ ] **Step 1: Add items map to game-config**

In `src/domain/schemas/game-config-schema.ts`, add an `items` section:

```typescript
items: z.record(z.string(), z.object({
	name: z.string().default(''),
	baseValue: z.number().default(0),
	maxCharges: z.number().optional(),
})).default({
	equipment: { name: 'Equipment', baseValue: 10, maxCharges: 5 },
	tools: { name: 'Tools', baseValue: 8, maxCharges: 5 },
	waterskin: { name: 'Waterskin', baseValue: 3, maxCharges: 3 },
}),
```

- [ ] **Step 2: Update mood-system to use item registry**

In `mood-system.ts`, replace the `DEFAULT_MAX_CHARGES = 5` block:

```typescript
const itemDefs = deps.config.items;
let equipmentCondition = 0.5;
const inv = entity.get(InventoryComponent);
const chargeable = inv.state.items.filter(i => i.charges !== undefined);
if (chargeable.length > 0) {
	let totalRatio = 0;
	for (const item of chargeable) {
		const maxCh = itemDefs[item.item_id]?.maxCharges ?? 5;
		totalRatio += (item.charges ?? 0) / maxCh;
	}
	equipmentCondition = clamp(totalRatio / chargeable.length, 0, 1);
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/infrastructure/systems/mood-system.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(meridian): maxCharges from item registry — no more hardcoded DEFAULT_MAX_CHARGES"
```

---

### Task 3: EconomyHealthMetrics (I1)

**Files:**
- Modify: `src/domain/core/component-data.ts` (extend DailySummary, add 'quest_reward' to LedgerEntry)
- Modify: `src/infrastructure/systems/daily-report-system.ts` (compute metrics)
- Test: `tests/infrastructure/systems/daily-report-system.test.ts`

- [ ] **Step 1: Extend DailySummary interface**

In `src/domain/core/component-data.ts`, replace the DailySummary interface:

```typescript
export interface DailySummary {
	totalWages: number;
	totalTax: number;
	totalSales: number;
	totalConsumption: number;
	avgWage: number;
	wageSpread: number;
	vacancyCount: number;
	unemploymentCount: number;
	jobSwitchesThisDay: number;
	supplyDeliveries: number;
	questsCompletedThisDay: number;
}
```

Add `'quest_reward'` to the LedgerEntry type union:

```typescript
type: 'wage' | 'purchase' | 'tax' | 'consumption' | 'welfare' | 'stipend' | 'subsidy' | 'quest_reward';
```

- [ ] **Step 2: Fix all DailySummary literals**

Run `npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -50` to find all locations that construct DailySummary objects. Add the new fields with defaults (0 for all numeric fields). This will affect multiple source and test files.

- [ ] **Step 3: Compute metrics in daily-report-system**

In `daily-report-system.ts`, before the daily summary reset, compute the metrics by scanning facilities and agents:

```typescript
// Compute economy health metrics
const agentJobs = agentList.map(a => a.job);
const unemploymentCount = agentJobs.filter(j => j === null).length;

const facilityStates = locationData.map(loc => {
	const locActor = locationActors.get(loc.id);
	if (locActor === undefined || !locActor.has(FacilityComponent)) return null;
	return { wage: loc.production?.wage ?? 0, workerId: locActor.get(FacilityComponent).state.workerId };
}).filter((f): f is NonNullable<typeof f> => f !== null);

const wages = facilityStates.map(f => f.wage);
const avgWage = wages.length > 0 ? wages.reduce((s, w) => s + w, 0) / wages.length : 0;
const wageSpread = wages.length > 0 ? Math.max(...wages) - Math.min(...wages) : 0;
const vacancyCount = facilityStates.filter(f => f.workerId === null).length;

const dayEvents = deps.eventBus.history().filter(e => e.tick > deps.tickCount - deps.config.ticks_per_day);
const jobSwitchesThisDay = dayEvents.filter(e => e.type === 'JobSwitched').length;
const supplyDeliveries = dayEvents.filter(e => e.type === 'SupplyDelivered').length;
const questsCompletedThisDay = dayEvents.filter(e => e.type === 'QuestCompleted').length;
```

Set these on the dailySummary before resetting.

- [ ] **Step 4: Write tests for metrics computation**

Add tests to `daily-report-system.test.ts`:
- Verify avgWage, vacancyCount computed from facility data
- Verify unemploymentCount computed from agent jobs
- Verify event-based counters (jobSwitches, supplyDeliveries, questsCompleted)

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): EconomyHealthMetrics — avgWage, vacancies, unemployment, quest tracking"
```

---

## Chunk 2: Facility Abandonment

### Task 4: Add 'abandoned' status to FacilityState

**Files:**
- Modify: `src/domain/core/component-data.ts` (FacilityState status union)
- Modify: `src/domain/systems/facility.ts` (FacilityTickResult status union)
- Modify: `src/infrastructure/systems/facility-system.ts` (add early-exit guard)
- Modify: `src/infrastructure/systems/subsidy-system.ts` (skip abandoned)

- [ ] **Step 1: Extend FacilityState status**

In `component-data.ts`, change:
```typescript
status: 'idle' | 'producing' | 'auto' | 'abandoned';
```

In `facility.ts`, change `FacilityTickResult`:
```typescript
status: 'idle' | 'producing' | 'auto' | 'abandoned';
```

- [ ] **Step 2: Add early-exit guard in facility-system**

In `src/infrastructure/systems/facility-system.ts`, inside the facility processing loop, add before the `applyFacilityTick` call:

```typescript
if (facility.state.status === 'abandoned') continue;
```

- [ ] **Step 3: Skip abandoned facilities in subsidy-system**

In `src/infrastructure/systems/subsidy-system.ts`, add guard:

```typescript
if (facility.state.status === 'abandoned') continue;
```

- [ ] **Step 4: Run typecheck to find broken literals**

Run: `npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -30`

Fix any test files that construct FacilityState with the old status union.

- [ ] **Step 5: Run tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): add 'abandoned' facility status — guard in facility-system and subsidy-system"
```

---

### Task 5: Create abandonment-system

**Files:**
- Create: `src/infrastructure/systems/abandonment-system.ts`
- Create: `tests/infrastructure/systems/abandonment-system.test.ts`
- Modify: `src/domain/core/tick-scheduler.ts` (verify ABANDONMENT priority exists)
- Modify: `src/infrastructure/engine/game-view.ts` (register system)

- [ ] **Step 1: Write test file**

```typescript
// tests/infrastructure/systems/abandonment-system.test.ts
import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createAbandonmentSystem } from '../../../src/infrastructure/systems/abandonment-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

// Tests:
// - Sets status to 'abandoned' when fund <= 0 and no worker
// - Emits FacilityAbandoned event
// - Does not abandon if worker is present
// - Does not abandon if fund > 0
// - Restores facility when fund > 0 and status is 'abandoned'
// - Emits FacilityRestored event
// - Does not re-abandon already abandoned facility
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/systems/abandonment-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement abandonment-system**

```typescript
// src/infrastructure/systems/abandonment-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export function createAbandonmentSystem(
	getLocationActors: () => Map<string, Actor>,
	getLocations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'AbandonmentSystem',
		priority: SystemPriority.ABANDONMENT,

		execute(deps: GameCoreDeps): void {
			const locationActors = getLocationActors();
			const locations = getLocations();

			for (const loc of locations) {
				const locActor = locationActors.get(loc.id);
				if (locActor === undefined || !locActor.has(FacilityComponent)) continue;
				const facility = locActor.get(FacilityComponent);

				if (facility.state.status !== 'abandoned' && facility.state.fund <= 0 && facility.state.workerId === null) {
					facility.state = { ...facility.state, status: 'abandoned' };
					facility.markDirty();
					deps.eventBus.emit({
						type: 'FacilityAbandoned',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'AbandonmentSystem',
						payload: { facilityId: loc.id, lastWorker: null },
					});
				} else if (facility.state.status === 'abandoned' && facility.state.fund > 0) {
					facility.state = { ...facility.state, status: 'idle' };
					facility.markDirty();
					deps.eventBus.emit({
						type: 'FacilityRestored',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'AbandonmentSystem',
						payload: { facilityId: loc.id, newFund: facility.state.fund },
					});
				}
			}
		},
	};
}
```

- [ ] **Step 4: Register in game-view.ts**

Add import and register after MonetaryPolicySystem:
```typescript
import { createAbandonmentSystem } from '../systems/abandonment-system.js';
// ...
tickRunner.register(createAbandonmentSystem(getLocationActors, getLocations));
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/infrastructure/systems/abandonment-system.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): abandonment-system — detect fund=0 → abandon, fund>0 → restore"
```

---

## Chunk 3: Quest Infrastructure

### Task 6: Quest schema + QuestBoardComponent

**Files:**
- Create: `src/domain/schemas/quest-schema.ts`
- Create: `src/infrastructure/components/quest-board-component.ts`
- Modify: `src/domain/schemas/game-config-schema.ts` (add quests config)
- Modify: `src/domain/core/tick-scheduler.ts` (add QUEST_GENERATION priority)

- [ ] **Step 1: Create quest schema**

```typescript
// src/domain/schemas/quest-schema.ts
import { z } from 'zod';

export const QUEST_TYPES = ['supply', 'restock', 'repair'] as const;
export const QUEST_STATES = ['open', 'claimed', 'completed', 'expired'] as const;

export const QuestSchema = z.object({
	id: z.string(),
	type: z.enum(QUEST_TYPES),
	facilityId: z.string(),
	itemId: z.string().nullable(),
	quantity: z.number().default(1),
	reward: z.number(),
	rewardXp: z.number().default(5),
	state: z.enum(QUEST_STATES).default('open'),
	claimedBy: z.string().nullable().default(null),
	createdTick: z.number(),
	expiryTicks: z.number(),
});

export type Quest = z.infer<typeof QuestSchema>;
export type QuestType = (typeof QUEST_TYPES)[number];
export type QuestState = (typeof QUEST_STATES)[number];

/** Runtime-only extension — repairProgress not persisted. */
export type QuestRuntime = Quest & { repairProgress: number };
```

- [ ] **Step 2: Create QuestBoardComponent**

```typescript
// src/infrastructure/components/quest-board-component.ts
import type { QuestRuntime } from '../../domain/schemas/quest-schema.js';
import { TrackedComponent } from './tracked-component.js';

export interface QuestBoardState {
	quests: QuestRuntime[];
}

export class QuestBoardComponent extends TrackedComponent {
	constructor(public state: QuestBoardState) { super(); }
}
```

- [ ] **Step 3: Add quests config to GameConfigSchema**

In `game-config-schema.ts`, add before the closing of the main schema:

```typescript
quests: z.object({
	max_open: z.number().default(5),
	expiry_ticks: z.number().default(960),
	supply_reward_multiplier: z.number().default(1.5),
	restock_reward: z.number().default(10),
	repair_reward: z.number().default(25),
	repair_ticks: z.number().default(30),
	repair_fund_injection: z.number().default(100),
	restock_threshold: z.number().default(3),
}).default({}),
```

Add activity cost entries to defaults:
```typescript
repair:      { hunger: 1.2, thirst: 1.1, energy: 1.3 },
seek_quest:  { hunger: 1.0, thirst: 1.0, energy: 1.0 },
claim_quest: { hunger: 1.0, thirst: 1.0, energy: 1.0 },
```

- [ ] **Step 4: Add QUEST_GENERATION priority**

In `tick-scheduler.ts`:
```typescript
QUEST_GENERATION: 7.1,
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): quest schema + QuestBoardComponent + quests config"
```

---

### Task 7: Quest generation system

**Files:**
- Create: `src/infrastructure/systems/quest-generation-system.ts`
- Create: `tests/infrastructure/systems/quest-generation-system.test.ts`
- Modify: `src/infrastructure/engine/game-view.ts` (register + add QuestBoardComponent to world entity)

- [ ] **Step 1: Write test file**

Tests:
- Skips when dayBoundaryThisTick is false
- Generates supply quest when facility has unmet input
- Generates restock quest when market stock below threshold
- Generates repair quest when facility is abandoned
- Respects max_open limit
- Does not generate duplicate quest for same facility
- Cleans up expired quests
- Quest ID format is q-{facilityId}-{tick}

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement quest-generation-system**

The system takes `worldEntity`, `getLocationActors`, `getLocations`. On day boundary:
1. Clean expired quests
2. For each facility, check conditions and generate appropriate quest type
3. Push new quest to QuestBoardComponent

- [ ] **Step 4: Register in game-view.ts**

Add QuestBoardComponent to world entity:
```typescript
worldEntity.addComponent(new QuestBoardComponent({ quests: [] }));
```

Register system:
```typescript
tickRunner.register(createQuestGenerationSystem(getWorldEntity, getLocationActors, getLocations));
```

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): quest-generation-system — supply, restock, repair quests from facility needs"
```

---

### Task 8: Quest evaluation system

**Files:**
- Create: `src/infrastructure/systems/quest-evaluation-system.ts`
- Create: `tests/infrastructure/systems/quest-evaluation-system.test.ts`
- Modify: `src/infrastructure/engine/game-view.ts` (register)

- [ ] **Step 1: Write test file**

Tests:
- Expires open quests past expiry_ticks
- Emits QuestExpired event
- Does not expire claimed quests
- Increments repairProgress for repair quests with agent at facility and btAction='repair'
- Does not increment repairProgress when agent not at facility
- Correct system name and priority

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement quest-evaluation-system**

The system needs access to agents (to check btAction and atLocation for repair progress). Signature:

```typescript
export function createQuestEvaluationSystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
): GameSystem
```

Priority: `SystemPriority.QUEST_EVALUATION` (7).

- [ ] **Step 4: Register in game-view.ts**

```typescript
tickRunner.register(createQuestEvaluationSystem(getWorldEntity, getAgents));
```

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): quest-evaluation-system — expiry + repair progress tracking"
```

---

## Chunk 4: Quest BT Integration

### Task 9: Quest working memory + BehaviorAgent interface

**Files:**
- Modify: `src/infrastructure/entity/bt-working-memory.ts` (add 3 fields)
- Modify: `src/domain/systems/behavior-agent.ts` (add 9 methods + 3 fields)
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts` (wire new fields + add getQuestBoard to deps)

- [ ] **Step 1: Add working memory fields**

In `bt-working-memory.ts`, add to WorkingMemory interface and createWorkingMemory:
```typescript
activeQuest: QuestRuntime | null;        // null
cachedAvailableQuest: QuestRuntime | null; // null
insideFacility: boolean;                   // false
```

- [ ] **Step 2: Add to BehaviorAgent interface**

In `behavior-agent.ts`, add the 3 working memory fields and 9 methods (4 conditions + 5 actions) as specified in the spec §6.6.

- [ ] **Step 3: Add getQuestBoard to BehaviorAgentDeps**

In `behavior-agent-factory.ts`:
```typescript
getQuestBoard?: () => QuestBoardState;
```

Wire the new working memory fields as get/set proxies on the agent object.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Errors about missing implementations in bt-conditions and bt-actions (expected — we add those next)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meridian): quest working memory + BehaviorAgent interface — 9 new BT methods"
```

---

### Task 10: Quest conditions (4 methods)

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions.ts`
- Modify: `tests/infrastructure/entity/bt-conditions.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:
- `HasQuest()` — true when activeQuest is set, false otherwise
- `QuestAvailable()` — finds open quest on board, caches it, returns true; returns false when no quests
- `QuestAvailable()` — scores by reward/distance, picks best
- `QuestAtFacility()` — true when atLocation matches quest facilityId
- `QuestCargoReady()` — true for supply quest when agent has item; true for repair quest always

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement 4 conditions**

Add `HasQuest`, `QuestAvailable`, `QuestAtFacility`, `QuestCargoReady` to `createConditions`. The `QuestAvailable` condition reads the quest board via `deps.getQuestBoard?.()`. Pass `getQuestBoard` through the `createConditions` signature.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meridian): quest conditions — HasQuest, QuestAvailable, QuestAtFacility, QuestCargoReady"
```

---

### Task 11: Quest actions (5 methods)

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts`
- Modify: `tests/infrastructure/entity/bt-actions.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:
- `ClaimQuest()` — claims cached quest, sets state, emits event; fails if already claimed
- `ClaimQuest()` — re-reads board state (race condition guard)
- `SeekQuestFacility()` — sets movementTarget, returns RUNNING/SUCCEEDED
- `WorkRepair()` — sets btAction='repair', returns RUNNING
- `CompleteQuest()` — supply: transfers item, pays reward, creates positive memory, emits events
- `CompleteQuest()` — repair: restores facility, injects fund, creates memory
- `CompleteQuest()` — emits QuestRewardSkipped when treasury can't pay
- `AbandonQuest()` — resets quest to open, creates negative memory, emits event

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement 5 actions**

Add `ClaimQuest`, `SeekQuestFacility`, `WorkRepair`, `CompleteQuest`, `AbandonQuest` to `createActions`. Pass `getQuestBoard` through the `createActions` signature. Each action accesses the board, memory component, wallet, inventory, and event bus as needed.

Key implementation details:
- `ClaimQuest` must re-read quest state from board (not trust cached value)
- `CompleteQuest` creates MemoryEntry with `description` and `participants` fields
- `CompleteQuest` adds `'quest_reward'` ledger entry
- `AbandonQuest` resets repairProgress to 0

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 6: Run typecheck and lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(meridian): quest actions — ClaimQuest, SeekQuestFacility, WorkRepair, CompleteQuest, AbandonQuest"
```

---

## Chunk 5: Facility Interior + Final Verification

### Task 12: insideFacility flag + movement system

**Files:**
- Modify: `src/infrastructure/systems/movement-system.ts`
- Modify: `tests/infrastructure/systems/movement-system.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:
- Sets `insideFacility = true` when arriving at location with FacilityComponent
- Sets `insideFacility = false` when departing (atLocation cleared)
- Does not set insideFacility when arriving at non-facility location

- [ ] **Step 2: Implement in movement-system**

When the system sets `atLocation`, check if the location has a FacilityComponent:
```typescript
const locActor = locationActors.get(newLocation);
if (locActor !== undefined && locActor.has(FacilityComponent)) {
	agent.behaviorAgent.insideFacility = true;
} else {
	agent.behaviorAgent.insideFacility = false;
}
```

When `atLocation` is cleared: `agent.behaviorAgent.insideFacility = false;`

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(meridian): insideFacility flag set by movement-system on facility arrival/departure"
```

---

### Task 13: Perception filtering for inside agents

**Files:**
- Modify: `src/infrastructure/systems/perception-system.ts`
- Modify: `tests/infrastructure/systems/perception-system.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:
- Agent inside facility is excluded from other agents' nearbyAgents
- Agent inside facility only sees agents at the same location
- Agent NOT inside facility sees normally (no change to existing behavior)

- [ ] **Step 2: Implement perception filtering**

In the perception system, when building `agentInputs`:
- Exclude agents with `insideFacility = true` from the general pool
- For agents with `insideFacility = true`, only include other agents at the same `atLocation`

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(meridian): perception excludes agents inside facilities"
```

---

### Task 14: Rendering — hide agents + facility sizing + occupancy badge

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts`
- Modify: `src/infrastructure/engine/game-view.ts` (facility sprite scaling)

- [ ] **Step 1: Hide agent sprites when inside facility**

In `debug-overlay.ts`, in the update loop where agent sprites are positioned/updated, add:

```typescript
if (agent.behaviorAgent?.insideFacility === true) {
	agent.graphics.visible = false;
} else {
	agent.graphics.visible = true;
}
```

- [ ] **Step 2: Add facility sprite scaling**

In `game-view.ts`, where location marker actors are created, scale facility locations:

```typescript
if (loc.production !== null) {
	marker.scale = ex.vec(2.0, 2.0);
}
```

- [ ] **Step 3: Add occupancy badge**

In `debug-overlay.ts`, add an occupancy counter for facilities. Scan agents, count those with `insideFacility === true` grouped by `atLocation`. Display as a label on the facility actor.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 5: Run typecheck and lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): facility interior rendering — hide agents, scale facilities, occupancy badge"
```

---

### Task 15: Final verification

- [ ] **Step 1: Run full npm test**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

- [ ] **Step 2: Run typecheck and lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors

- [ ] **Step 3: Verify success criteria**

| Metric | Target | Check |
|--------|--------|-------|
| Quest generation | Autonomous at day boundary | Run integration test |
| Quest completion | Gold + memory + mood | Verify CompleteQuest tests |
| Facility abandonment | fund=0 → abandoned | Verify abandonment tests |
| Repair quests | Restore abandoned facilities | Verify repair flow tests |
| Inside facility | Agents hidden, perception filtered | Verify movement + perception tests |
| Attribute casts | 0 remaining | `grep -r "as unknown as Record" src/` |
| EconomyHealthMetrics | Computed at day boundary | Verify daily-report tests |
| maxCharges | From item registry | Verify mood-system tests |
| Lint errors | 0 | eslint output |
| Quest reward ledger | 'quest_reward' type | Verify CompleteQuest tests |

- [ ] **Step 4: Commit any final fixes**

```bash
git commit -m "chore(meridian): quest-economy increment complete — all success criteria met"
```
