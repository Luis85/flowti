# Harden & Deepen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interleave code hardening (split god objects, coverage push, performance budget) with simulation deepening (wage competition, supply chain routing, complete mood system).

**Architecture:** Split two monolithic files into focused modules (4 files from factory, 6 from day-night). Add wage comparison and supply chain routing as new BT conditions/actions in the split modules. Extend tick-runner with budget observability using existing PerformanceTracker. Wire remaining mood factors from existing components.

**Tech Stack:** TypeScript (strict), Vitest, ExcaliburJS ECS, Mistreevous BT, Zod schemas

**Spec:** `docs/specs/2026-04-04-harden-and-deepen-design.md`

**Run commands from:** `cd "01 - Projects/Project Meridian"`

**Test command:** `npx vitest run --config configs/vitest.config.ts`

**Single test:** `npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Lint:** `npx eslint src/ --config configs/eslint.config.mjs`

**Typecheck:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Split behavior-agent-factory.ts

### Task 1: Create bt-working-memory.ts

**Files:**
- Create: `src/infrastructure/entity/bt-working-memory.ts`
- Test: `tests/infrastructure/entity/bt-working-memory.test.ts`
- Read: `src/infrastructure/entity/behavior-agent-factory.ts:40-77` (current closure vars)
- Read: `src/domain/systems/behavior-agent.ts` (BehaviorAgent interface)

- [ ] **Step 1: Write the test file**

```typescript
// tests/infrastructure/entity/bt-working-memory.test.ts
import { describe, it, expect } from 'vitest';
import { createWorkingMemory } from '../../../src/infrastructure/entity/bt-working-memory.js';

describe('createWorkingMemory', () => {
	it('initializes all fields to defaults', () => {
		const mem = createWorkingMemory(10); // price_memory_max
		expect(mem.movementTarget).toBeNull();
		expect(mem.journey).toBeNull();
		expect(mem.atLocation).toBeNull();
		expect(mem.currentRegion).toBe('');
		expect(mem.haulCargo).toBeNull();
		expect(mem.socialCooldowns.size).toBe(0);
		expect(mem.committedAction).toBeNull();
		expect(mem.btAction).toBeNull();
		expect(mem.gossipPending).toBeNull();
		expect(mem.knownLocations).toEqual([]);
		expect(mem.traitModifiers).toBeNull();
		expect(mem.skills).toEqual([]);
		expect(mem.feedingAt).toBeNull();
		expect(mem.restingAt).toBeNull();
		expect(mem.arrivalSlot).toBeNull();
		expect(mem.buyTargetItem).toBeNull();
		expect(mem.unemployedTicks).toBe(0);
		expect(mem.recovering).toBe(false);
	});

	it('creates priceMemories with given capacity', () => {
		const mem = createWorkingMemory(5);
		expect(mem.priceMemories.capacity).toBe(5);
	});
});

describe('recordPriceObservation', () => {
	it('adds observation to priceMemories buffer', () => {
		const mem = createWorkingMemory(10);
		mem.recordPriceObservation('food', 3, 'loc-market', 100);
		expect(mem.priceMemories.size).toBe(1);
	});

	it('evicts oldest when buffer full', () => {
		const mem = createWorkingMemory(2);
		mem.recordPriceObservation('food', 3, 'loc-a', 1);
		mem.recordPriceObservation('food', 4, 'loc-b', 2);
		mem.recordPriceObservation('food', 5, 'loc-c', 3);
		expect(mem.priceMemories.size).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/entity/bt-working-memory.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement bt-working-memory.ts**

Create `src/infrastructure/entity/bt-working-memory.ts`. Extract the working memory state from `behavior-agent-factory.ts` lines 43-76 into a factory function. The interface must match `BehaviorAgent`'s field names exactly.

```typescript
import type { MovementTarget, SkillEntry, ModifierMap } from '../../domain/systems/behavior-agent.js';
import type { JourneyState, CargoState } from '../../domain/core/component-data.js';
import type { PriceMemory } from '../../domain/systems/price-memory.js';
import { CircularBuffer } from 'mnemonist';

export interface WorkingMemory {
	movementTarget: MovementTarget | null;
	journey: JourneyState | null;
	atLocation: string | null;
	currentRegion: string;
	haulCargo: CargoState | null;
	readonly socialCooldowns: Map<string, number>;
	committedAction: string | null;
	btAction: string | null;
	gossipPending: string | null;
	knownLocations: string[];
	traitModifiers: ModifierMap | null;
	skills: SkillEntry[];
	feedingAt: string | null;
	restingAt: string | null;
	arrivalSlot: number | null;
	buyTargetItem: string | null;
	unemployedTicks: number;
	recovering: boolean;
	priceMemories: CircularBuffer<PriceMemory>;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
}

export function createWorkingMemory(priceMemoryMax: number): WorkingMemory {
	const priceMemories = new CircularBuffer<PriceMemory>(Array, priceMemoryMax);

	return {
		movementTarget: null,
		journey: null,
		atLocation: null,
		currentRegion: '',
		haulCargo: null,
		socialCooldowns: new Map<string, number>(),
		committedAction: null,
		btAction: null,
		gossipPending: null,
		knownLocations: [],
		traitModifiers: null,
		skills: [],
		feedingAt: null,
		restingAt: null,
		arrivalSlot: null,
		buyTargetItem: null,
		unemployedTicks: 0,
		recovering: false,
		priceMemories,
		recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void {
			priceMemories.push({ itemId, price, locationId, tick });
		},
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/entity/bt-working-memory.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/entity/bt-working-memory.ts tests/infrastructure/entity/bt-working-memory.test.ts
git commit -m "feat(meridian): extract bt-working-memory from factory"
```

---

### Task 2: Create bt-conditions.ts

**Files:**
- Create: `src/infrastructure/entity/bt-conditions.ts`
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`
- Read: `src/infrastructure/entity/behavior-agent-factory.ts:255-460` (all condition methods)

- [ ] **Step 1: Write the test file**

Create `tests/infrastructure/entity/bt-conditions.test.ts`. Test each condition group with mock working memory, mock actor, and mock deps. Focus on the conditions' boolean logic, not ECS wiring.

Key test groups:
- Need conditions (IsHungry, IsExhausted, IsRecovering, IsLonely, IsThirsty, NeedsCritical)
- Inventory conditions (HasFood, HasFoodReserve, HasGold, CanAffordFood, HasWater, HasTradeGoods, NeedsTools, NeedsEquipment, CanAffordItem, HasCargo, HasNoJob)
- Job conditions (HasJob, OpenFacilityNearby, OpenProductionFacilityNearby)
- Spatial conditions (AtLocation, NearLocation, NearAgent, NearAgentClose, AtJobFacility, CargoDestinationNearby)
- Time conditions (IsDaytime, IsNighttime, IsWorkHours)
- Facility conditions (FacilityHasStock, FacilityNeedsSupply)
- Knowledge conditions (KnowsFoodSource)

Port the existing tests from `tests/infrastructure/entity/behavior-agent-factory.test.ts` that test conditions — move them here, adjusting imports to use the new `createConditions` function.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/entity/bt-conditions.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement bt-conditions.ts**

Create `src/infrastructure/entity/bt-conditions.ts`. Extract all condition methods from `behavior-agent-factory.ts` lines 255-460. Each condition is a named function in the returned object. The function receives `WorkingMemory`, `AgentActor`, and `BehaviorAgentDeps`.

Key pattern — each condition reads from working memory or ECS components:

```typescript
import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
// ... component imports ...

export function createConditions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
) {
	return {
		IsHungry(): boolean {
			return actor.get(NeedsComponent).state.hunger < deps.config.needs.hunger_threshold;
		},
		// ... all other conditions extracted verbatim from factory ...
	};
}
```

**Important:** The `resolveNearbyFacilities` helper is passed as a parameter (not reimplemented). It stays in the factory as the composition layer that connects cache, perception, and location actors.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/entity/bt-conditions.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/entity/bt-conditions.ts tests/infrastructure/entity/bt-conditions.test.ts
git commit -m "feat(meridian): extract bt-conditions from factory"
```

---

### Task 3: Create bt-actions.ts

**Files:**
- Create: `src/infrastructure/entity/bt-actions.ts`
- Test: `tests/infrastructure/entity/bt-actions.test.ts`
- Read: `src/infrastructure/entity/behavior-agent-factory.ts:462-951` (all action methods)

- [ ] **Step 1: Write the test file**

Create `tests/infrastructure/entity/bt-actions.test.ts`. Test each action group. Port existing action tests from `behavior-agent-factory.test.ts`.

Key test groups:
- Life actions (Eat, Drink, Rest, FillWaterskin)
- Economy actions (Harvest, SellAtMarket, BuyItem, SeekFood, SeekBestFoodSource, SeekWater, SeekMarket, Buy)
- Work actions (SeekWork, Work, ClaimBestJob, ClaimJob, ReleaseJob)
- Supply actions (PickupCargo, DeliverCargo, SeekSupplySource, SeekDeliveryTarget)
- Social actions (Talk, SeekSocial)
- Navigation actions (SeekRest, Wander, Idle)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement bt-actions.ts**

Create `src/infrastructure/entity/bt-actions.ts`. Extract all action methods from the factory. Same pattern as conditions — receives `WorkingMemory`, `AgentActor`, `BehaviorAgentDeps`, plus `resolveNearbyFacilities`.

```typescript
import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { ActionResult, PerceivedFacility } from '../../domain/systems/behavior-agent.js';

const SUCCEEDED: ActionResult = 'mistreevous.succeeded';
const FAILED: ActionResult = 'mistreevous.failed';
const RUNNING: ActionResult = 'mistreevous.running';

export function createActions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
) {
	return {
		Eat(): ActionResult { /* extracted verbatim */ },
		// ... all other actions ...
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/entity/bt-actions.ts tests/infrastructure/entity/bt-actions.test.ts
git commit -m "feat(meridian): extract bt-actions from factory"
```

---

### Task 4: Rewire behavior-agent-factory.ts as slim orchestrator

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts` (rewrite to ~80 lines)
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts` (becomes integration test)

- [ ] **Step 1: Rewrite factory to compose from modules**

Replace the entire `createBehaviorAgent` body with:

```typescript
import { createWorkingMemory } from './bt-working-memory.js';
import { createConditions } from './bt-conditions.js';
import { createActions } from './bt-actions.js';
import type { BehaviorAgent, PerceivedFacility } from '../../domain/systems/behavior-agent.js';
// ... remaining imports for components, cache ...

export interface BehaviorAgentDeps { /* unchanged */ }

export function createBehaviorAgent(deps: BehaviorAgentDeps): BehaviorAgent {
	const { actor, config, getLocationActors, getLocations, tickCount } = deps;
	const memory = createWorkingMemory(config.economy.price_memory_max);

	// Per-tick facility cache (internal, not on WorkingMemory)
	let cachedFacilities: PerceivedFacility[] | null = null;
	let cachedFacilitiesTick = -1;

	// Wake stagger offset
	const dawnDuration = config.day_night.dawn.end - config.day_night.dawn.start + 1;
	const staggerSeed = actor.agentId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
	const wakeOffset = Math.abs(staggerSeed) % Math.floor(dawnDuration / 2);

	function resolveNearbyFacilities(): PerceivedFacility[] {
		// ... existing cache + perception logic, unchanged ...
	}

	const conditions = createConditions(memory, actor, deps, resolveNearbyFacilities);
	const actions = createActions(memory, actor, deps, resolveNearbyFacilities);

	return {
		// Read-only state properties (computed from ECS components)
		get hunger() { return actor.get(NeedsComponent).state.hunger; },
		get energy() { return actor.get(NeedsComponent).state.energy; },
		// ... all other getters ...

		// Working memory — delegate to memory object
		get movementTarget() { return memory.movementTarget; },
		set movementTarget(v) { memory.movementTarget = v; },
		// ... all other memory fields with get/set ...

		// Spread conditions and actions
		...conditions,
		...actions,

		// Utility methods
		tickUnemployment() { memory.unemployedTicks++; },
		recordPriceObservation: memory.recordPriceObservation,
	};
}
```

- [ ] **Step 2: Update existing tests to integration tests**

The existing `behavior-agent-factory.test.ts` continues testing the composed BehaviorAgent. Verify it still passes without changes (the public interface is unchanged).

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass. The BehaviorAgent interface contract is preserved.

- [ ] **Step 4: Run typecheck and lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/entity/behavior-agent-factory.ts tests/infrastructure/entity/behavior-agent-factory.test.ts
git commit -m "refactor(meridian): slim behavior-agent-factory — delegates to bt-conditions, bt-actions, bt-working-memory"
```

---

### Task 5: Add wage field to PerceivedFacility + BetterPayAvailable + SwitchJob

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts:20-27` (add `wage` to PerceivedFacility)
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts` (add `wage` to resolveNearbyFacilities)
- Modify: `src/infrastructure/entity/bt-conditions.ts` (add BetterPayAvailable)
- Modify: `src/infrastructure/entity/bt-actions.ts` (add SwitchJob)
- Modify: `src/domain/systems/behavior-agent.ts` (add BetterPayAvailable + SwitchJob to interface)
- Test: `tests/infrastructure/entity/bt-conditions.test.ts` (add wage tests)
- Test: `tests/infrastructure/entity/bt-actions.test.ts` (add SwitchJob tests)

- [ ] **Step 1: Write failing tests for BetterPayAvailable**

Add to `bt-conditions.test.ts`:

```typescript
describe('BetterPayAvailable', () => {
	it('returns false when agent has no job', () => { /* ... */ });
	it('returns false when no open facilities nearby', () => { /* ... */ });
	it('returns false when no facility offers higher effective wage', () => { /* ... */ });
	it('returns true when open facility offers higher wage', () => { /* ... */ });
	it('accounts for aptitude efficiency in effective wage comparison', () => { /* ... */ });
});
```

- [ ] **Step 2: Write failing tests for SwitchJob**

Add to `bt-actions.test.ts`:

```typescript
describe('SwitchJob', () => {
	it('returns FAILED when no better facility available', () => { /* ... */ });
	it('releases current job and claims better one', () => { /* ... */ });
	it('emits JobSwitched event with old/new details', () => { /* ... */ });
	it('triggers BT swap via swapBehaviorTree', () => { /* ... */ });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/infrastructure/entity/bt-conditions.test.ts tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: FAIL — BetterPayAvailable and SwitchJob not defined

- [ ] **Step 4: Add `wage` to PerceivedFacility interface**

In `src/domain/systems/behavior-agent.ts`:

```typescript
export interface PerceivedFacility {
	id: string;
	job: string;
	stock: { item_id: string; quantity: number }[];
	distance: number;
	hasUnmetInput: boolean;
	workerId: string | null;
	wage: number;  // NEW
}
```

- [ ] **Step 5: Populate `wage` in resolveNearbyFacilities**

In `behavior-agent-factory.ts`, add `wage` to the facility push:

```typescript
facilities.push({
	id: nearLoc.id,
	job: locData.production?.job ?? '',
	stock: [...facility.state.stock],
	distance: nearLoc.distance,
	hasUnmetInput,
	workerId: facility.state.workerId,
	wage: locData.production?.wage ?? 0,
});
```

- [ ] **Step 6: Implement BetterPayAvailable condition**

In `bt-conditions.ts`, add:

```typescript
BetterPayAvailable(): boolean {
	if (actor.job === null) return false;
	const facilities = resolveNearbyFacilities();
	const jobsConfig = deps.config.jobs;
	const baseline = jobsConfig?.aptitude_baseline ?? 10;
	const attrs = actor.get(AttributesComponent).state as unknown as Record<string, number>;

	// Current job effective wage
	const currentFacility = facilities.find(f => f.workerId === actor.agentId);
	const currentWage = currentFacility?.wage ?? 0;
	const currentJobDef = jobsConfig?.definitions[actor.job];
	const currentApt = currentJobDef !== undefined ? (attrs[currentJobDef.primary_attribute] ?? baseline) : baseline;
	const currentEffective = currentWage * (currentApt / baseline);

	// Best available open position
	for (const f of facilities) {
		if (f.workerId !== null) continue; // occupied
		if (f.job === '') continue;
		const jobDef = jobsConfig?.definitions[f.job];
		const apt = jobDef !== undefined ? (attrs[jobDef.primary_attribute] ?? baseline) : baseline;
		const effective = f.wage * (apt / baseline);
		if (effective > currentEffective) return true;
	}
	return false;
},
```

- [ ] **Step 7: Implement SwitchJob action**

In `bt-actions.ts`, add:

```typescript
SwitchJob(): ActionResult {
	const facilities = resolveNearbyFacilities();
	const jobsConfig = deps.config.jobs;
	const baseline = jobsConfig?.aptitude_baseline ?? 10;
	const attrs = actor.get(AttributesComponent).state as unknown as Record<string, number>;

	const currentWage = facilities.find(f => f.workerId === actor.agentId)?.wage ?? 0;
	const currentJobDef = actor.job !== null ? jobsConfig?.definitions[actor.job] : undefined;
	const currentApt = currentJobDef !== undefined ? (attrs[currentJobDef.primary_attribute] ?? baseline) : baseline;
	const currentEffective = currentWage * (currentApt / baseline);

	let bestFacility: PerceivedFacility | null = null;
	let bestEffective = currentEffective;
	for (const f of facilities) {
		if (f.workerId !== null || f.job === '') continue;
		const jobDef = jobsConfig?.definitions[f.job];
		const apt = jobDef !== undefined ? (attrs[jobDef.primary_attribute] ?? baseline) : baseline;
		const effective = f.wage * (apt / baseline);
		if (effective > bestEffective) { bestFacility = f; bestEffective = effective; }
	}

	if (bestFacility === null) return FAILED;

	const oldJob = actor.job;
	actor.job = bestFacility.job;
	memory.btAction = 'switch_job';
	deps.eventBus.emit({
		type: 'JobSwitched',
		tick: deps.tickCount(),
		wallClock: Date.now(),
		source: 'BehaviorAgent',
		payload: { agentId: actor.agentId, oldJob, newJob: bestFacility.job, oldWage: currentWage, newWage: bestFacility.wage },
	});
	deps.swapBehaviorTree?.(bestFacility.job);
	return SUCCEEDED;
},
```

- [ ] **Step 8: Add to BehaviorAgent interface**

In `behavior-agent.ts`, add to conditions section: `BetterPayAvailable(): boolean;`
Add to actions section: `SwitchJob(): ActionResult;`

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

- [ ] **Step 10: Run typecheck and lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(meridian): wage comparison — BetterPayAvailable condition + SwitchJob action"
```

---

## Chunk 2: Split day-night-system.ts

### Task 6: Extend TimeState with dayBoundaryThisTick

**Files:**
- Modify: `src/domain/core/component-data.ts:51-55`
- Modify: `tests/domain/core/component-data.test.ts` (if exists)

- [ ] **Step 1: Add field to TimeState**

```typescript
export interface TimeState {
	phase: 'dawn' | 'day' | 'dusk' | 'night';
	tickInCycle: number;
	dayCount: number;
	dayBoundaryThisTick: boolean;  // NEW — initialized to false
}
```

- [ ] **Step 2: Fix all TimeState literals in tests and source**

Search for `TimeState` object literals and add `dayBoundaryThisTick: false`. Use: `npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -50` to find all locations.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(meridian): add dayBoundaryThisTick to TimeState"
```

---

### Task 7: Slim day-night-system.ts — set boundary flag, extract processDayBoundary

**Files:**
- Modify: `src/infrastructure/systems/day-night-system.ts` (remove processDayBoundary body, set flag instead)

- [ ] **Step 1: Modify day-night-system execute()**

In `createDayNightSystem`, change the execute method:

1. At the **start** of execute, clear the flag: `time.state = { ...time.state, dayBoundaryThisTick: false };`
2. Replace the `processDayBoundary(...)` call with: `time.state = { ...time.state, dayBoundaryThisTick: true }; time.markDirty();`
3. Keep only treasury regen in this file. Ledger pruning and daily summary reset move to `daily-report-system.ts` (Task 12).

- [ ] **Step 2: Run existing day-night-system tests**

Run: `npx vitest run tests/infrastructure/systems/day-night-system.test.ts --config configs/vitest.config.ts`

Expect some failures — tests that checked welfare/stipend/subsidy behavior will fail since those are no longer in this system. Mark those tests with `it.todo()` for now — they'll be moved to the new system test files.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/systems/day-night-system.ts tests/infrastructure/systems/day-night-system.test.ts
git commit -m "refactor(meridian): slim day-night-system — set dayBoundaryThisTick flag, defer boundary work"
```

---

### Task 8: Create welfare-system.ts

**Files:**
- Create: `src/infrastructure/systems/welfare-system.ts`
- Create: `tests/infrastructure/systems/welfare-system.test.ts`

- [ ] **Step 1: Write tests** — port welfare tests from day-night-system.test.ts

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Implement welfare-system.ts**

Extract `processWelfare()` from day-night-system.ts. Create as a standard `GameSystem` at priority `0.8`. Check `time.state.dayBoundaryThisTick` at start — return early if false.

**Prerequisite:** Before implementing Tasks 8-12, add the five new priority constants to `SystemPriority` in `src/domain/core/tick-scheduler.ts`:

```typescript
WELFARE: 0.8,
STIPEND: 0.81,
SUBSIDY: 0.82,
EQUIPMENT_DECAY: 0.83,
DAILY_REPORT: 0.84,
```

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
// ... imports ...

export function createWelfareSystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
): GameSystem {
	return {
		name: 'WelfareSystem',
		priority: SystemPriority.WELFARE,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;

			const economy = entity.get(EconomyComponent);
			const agentList = getAgents();
			// ... processWelfare logic extracted verbatim ...
		},
	};
}
```

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Register in game-view.ts** — add to system registration list after DayNightSystem

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): extract welfare-system from day-night"
```

---

### Task 9: Create stipend-system.ts

Same pattern as Task 8. Extract `processStipends()`. Priority `0.81`. Port stipend tests.

- [ ] **Step 1-6:** Follow identical pattern — create system, test, register, commit.

```bash
git commit -m "feat(meridian): extract stipend-system from day-night"
```

---

### Task 10: Create subsidy-system.ts

Extract `processFacilitySubsidies()`. Priority `0.82`. Port subsidy tests.

- [ ] **Step 1-6:** Follow identical pattern.

```bash
git commit -m "feat(meridian): extract subsidy-system from day-night"
```

---

### Task 11: Create equipment-decay-system.ts

Extract the equipment decay loop (lines 343-356 of original). Priority `0.83`. Port equipment decay tests.

- [ ] **Step 1-6:** Follow identical pattern.

```bash
git commit -m "feat(meridian): extract equipment-decay-system from day-night"
```

---

### Task 12: Create daily-report-system.ts + economy health metrics

**Files:**
- Create: `src/infrastructure/systems/daily-report-system.ts`
- Create: `tests/infrastructure/systems/daily-report-system.test.ts`
- Modify: `src/domain/core/component-data.ts` (extend DailySummary with health metrics)

Extract `checkEconomyLiveness()` + `writeDailyReport()` + gold snapshot + ledger pruning + daily summary reset. Priority `0.84`.

**New economy health metrics** added to `DailySummary`:

```typescript
interface DailySummary {
	totalWages: number;
	totalTax: number;
	totalSales: number;
	totalConsumption: number;
	// NEW — economy health dashboard
	avgWage: number;
	wageSpread: number;
	vacancyCount: number;
	unemploymentCount: number;
	jobSwitchesThisDay: number;
	supplyDeliveries: number;
}
```

The system computes these by scanning facilities and agents at day boundary.

- [ ] **Step 1-6:** Create, test, register, commit.

```bash
git commit -m "feat(meridian): extract daily-report-system + economy health metrics"
```

---

### Task 13: Clean up — remove extracted functions from day-night-system.ts

**Files:**
- Modify: `src/infrastructure/systems/day-night-system.ts` (delete processWelfare, processStipends, processFacilitySubsidies, checkEconomyLiveness, writeDailyReport, collectFacilities)
- Modify: `tests/infrastructure/systems/day-night-system.test.ts` (remove todo'd tests, keep only time advancement + flag tests)

- [ ] **Step 1: Delete extracted functions** from day-night-system.ts

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

- [ ] **Step 3: Run typecheck and lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors. day-night-system.ts should be well under 350 lines.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(meridian): clean day-night-system — remove extracted functions"
```

---

## Chunk 3: Supply Chain Routing + Coverage Push

### Task 14: Add planSupplyRoute domain function

**Files:**
- Modify: `src/domain/systems/cargo.ts` (add planSupplyRoute)
- Create or modify: `tests/domain/systems/cargo.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('planSupplyRoute', () => {
	it('returns null when knownLocations is empty', () => { /* ... */ });
	it('returns null when no facility produces needed input', () => { /* ... */ });
	it('returns route when source has output and destination needs input', () => { /* ... */ });
	it('picks nearest source when multiple candidates exist', () => { /* ... */ });
	it('handles cross-region route via regionGraph', () => { /* ... */ });
	it('returns null when known location is absent from facilityData (stale)', () => { /* ... */ });
});
```

- [ ] **Step 2: Implement planSupplyRoute**

Pure function — no ECS, no side effects. Takes known locations, facility data, current region, region graph. Returns `{ sourceId, destinationId, itemId, waypoints }` or null.

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meridian): planSupplyRoute domain function for knowledge-based delivery"
```

---

### Task 15: Add KnowsSupplyRoute condition + enhanced delivery actions

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions.ts`
- Modify: `src/infrastructure/entity/bt-actions.ts`
- Modify: `src/domain/systems/behavior-agent.ts` (add to interface)
- Tests in respective test files

- [ ] **Step 1: Write failing tests for KnowsSupplyRoute**

- [ ] **Step 2: Write failing tests for enhanced DeliverCargo (multi-hop)**

- [ ] **Step 3: Implement KnowsSupplyRoute** — calls planSupplyRoute, caches result in working memory

- [ ] **Step 4: Enhance DeliverCargo** — reads cached route, initiates journey if cross-region

- [ ] **Step 5: Add SupplyDelivered event** emission on delivery completion

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(meridian): knowledge-based supply chain routing — KnowsSupplyRoute + multi-hop delivery"
```

---

### Task 16: Coverage push — close branch gaps in existing systems

**Files:**
- Modify: `tests/infrastructure/systems/movement-system.test.ts`
- Modify: `tests/infrastructure/systems/facility-system.test.ts`
- Modify: `tests/infrastructure/systems/rest-system.test.ts`

- [ ] **Step 1: Add movement-system edge case tests**

Target: journey waypoint navigation, exhaustion during movement, arrival spread with multiple agents, target not found.

- [ ] **Step 2: Add facility-system edge case tests**

Target: private production path, tool multiplier, aptitude efficiency with missing job config, insolvency check.

- [ ] **Step 3: Add rest-system edge case tests**

Target: public shelter gold deduction, facility fund credit, outdoor rest fallback.

- [ ] **Step 4: Run coverage report**

Run: `npx vitest run --config configs/vitest.config.ts --coverage 2>&1 | grep -E "All files|Branches"`
Target: Branches ≥ 80%

- [ ] **Step 5: Commit**

```bash
git commit -m "test(meridian): coverage push — close branch gaps in movement, facility, rest systems"
```

---

## Chunk 4: Performance Budget + Mood Wiring

### Task 17: Add performance budget to tick-runner

**Files:**
- Modify: `src/infrastructure/engine/tick-runner.ts`
- Modify: `tests/infrastructure/engine/tick-runner.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('tick budget', () => {
	it('emits TickBudgetExceeded when tick exceeds budget', () => {
		// Create a mock system with artificial delay
		// Verify event emission with elapsedMs and breakdown
	});
	it('does not emit when tick is within budget', () => { /* ... */ });
});
```

- [ ] **Step 2: Implement budget check**

After `deps.performanceTracker.completeTick(currentTick)`, capture the return value and check against budget:

```typescript
const tickPerf = deps.performanceTracker.completeTick(currentTick);
const budgetMs = deps.config.performance?.budget_ms ?? 300;
if (tickPerf !== null && tickPerf.totalMs > budgetMs) {
	deps.eventBus.emit({
		type: 'TickBudgetExceeded',
		tick: currentTick,
		wallClock: Date.now(),
		source: 'TickRunner',
		payload: { elapsedMs: tickPerf.totalMs, breakdown: tickPerf.systems },
	});
	deps.logger.warn('TickRunner', `Budget exceeded: ${tickPerf.totalMs.toFixed(1)}ms > ${budgetMs}ms`);
}
```

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meridian): tick budget observability — warn when tick exceeds 300ms"
```

---

### Task 18: Wire goalProgress and equipmentCondition mood factors

**Files:**
- Modify: `src/infrastructure/systems/mood-system.ts`
- Modify: `tests/infrastructure/systems/mood-system.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('goalProgress mood factor', () => {
	it('returns 0 for unemployed agent', () => { /* ... */ });
	it('returns high value for agent with matching aptitude', () => { /* ... */ });
	it('returns low value for agent with mismatched aptitude', () => { /* ... */ });
});

describe('equipmentCondition mood factor', () => {
	it('returns 0.5 when agent has no chargeable items', () => { /* ... */ });
	it('returns 1.0 when all tools at full charges', () => { /* ... */ });
	it('returns 0.0 when all tools depleted', () => { /* ... */ });
});
```

- [ ] **Step 2: Implement goalProgress**

In `mood-system.ts`, compute from job + aptitude config:

```typescript
let goalProgress = 0;
if (entity.job !== null && deps.config.jobs !== undefined) {
	const jobDef = deps.config.jobs.definitions[entity.job];
	if (jobDef !== undefined) {
		const attrs = entity.get(AttributesComponent).state as unknown as Record<string, number>;
		const attrValue = attrs[jobDef.primary_attribute] ?? 10;
		goalProgress = clamp(attrValue / (deps.config.jobs.aptitude_baseline * 2), 0, 1);
	}
}
```

- [ ] **Step 3: Implement equipmentCondition**

```typescript
let equipmentCondition = 0.5;
const inv = entity.get(InventoryComponent);
const chargeable = inv.state.items.filter(i => i.charges !== undefined);
if (chargeable.length > 0) {
	const totalCharges = chargeable.reduce((sum, i) => sum + (i.charges ?? 0), 0);
	const DEFAULT_MAX_CHARGES = 5;
	const maxCharges = chargeable.length * DEFAULT_MAX_CHARGES;
	equipmentCondition = clamp(totalCharges / maxCharges, 0, 1);
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meridian): wire goalProgress + equipmentCondition mood factors — 7/7 complete"
```

---

### Task 19: Final verification

- [ ] **Step 1: Run full npm test**

Run: `npm test`
Expected: lint (0 errors), typecheck (clean), tests (all pass)

- [ ] **Step 2: Run coverage**

Run: `npx vitest run --config configs/vitest.config.ts --coverage 2>&1 | grep -E "All files"`
Expected: Statements ≥80%, Branches ≥80%, Functions ≥80%, Lines ≥80%

- [ ] **Step 3: Verify success criteria**

| Metric | Target | Check |
|--------|--------|-------|
| behavior-agent-factory.ts lines | <100 | `wc -l src/infrastructure/entity/behavior-agent-factory.ts` |
| day-night-system.ts lines | <100, complexity <10 | `wc -l src/infrastructure/systems/day-night-system.ts` + `npx eslint src/infrastructure/systems/day-night-system.ts --config configs/eslint.config.mjs` |
| Branch coverage | ≥80% | Coverage report |
| Lint errors | 0 | eslint output |
| Mood factors wired | 7/7 | Inspect mood-system.ts |
| Performance observability | Yes | tick-runner budget check |
| Wage competition | Yes | BetterPayAvailable + SwitchJob |
| Supply chains | Yes | KnowsSupplyRoute + planSupplyRoute |

- [ ] **Step 4: Commit any final fixes**

```bash
git commit -m "chore(meridian): harden-and-deepen phase complete — all success criteria met"
```
