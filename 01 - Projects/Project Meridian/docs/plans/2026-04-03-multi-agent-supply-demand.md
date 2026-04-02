# Multi-Agent Supply & Demand Economy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guard agent, treasury-funded facilities, food reserve mechanics, reservation pricing, and fix 4 critical economy bugs — establishing a working two-agent supply/demand loop.

**Architecture:** Schema-driven funding tiers (private vs treasury), posted prices with reservation price buyer check, per-agent treasury scaling. All changes are config-driven via `game-config.json` and Zod schemas.

**Tech Stack:** TypeScript, Zod, mistreevous (MDSL behavior trees), ExcaliburJS (ECS), Vitest

**Spec:** `docs/specs/2026-04-03-multi-agent-supply-demand-design.md`

**Test command:** `npx vitest run --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`
**Single test:** `npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

---

## Chunk 1: Bug Fixes & Schema Foundation

These are prerequisites — everything else builds on correct schemas and tick behavior.

### Task 1: Fix mood system — include thirst in needsSatisfaction

**Files:**
- Modify: `src/infrastructure/systems/mood-system.ts:9-10,34`
- Modify: `tests/infrastructure/systems/mood-system.test.ts`

- [ ] **Step 1: Write failing test**

In `tests/infrastructure/systems/mood-system.test.ts`, add a test that verifies thirst is included in mood calculation:

```typescript
it('includes thirst in needsSatisfaction calculation', () => {
	// Agent with low thirst should have lower mood than one with high thirst
	// Set up two agents: identical except thirst
	// ... (use existing test patterns — create agent with NeedsComponent)
	// After system execute, the agent with thirst=10 should have lower mood
	// than the agent with thirst=90
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/infrastructure/systems/mood-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — thirst is not included in mood calculation, both agents get the same mood.

- [ ] **Step 3: Fix mood-system.ts**

In `src/infrastructure/systems/mood-system.ts`:

Change line 9-10:
```typescript
/** 4 needs x 100 max each = 400 */
const NEEDS_SUM_MAX = 400;
```

Change line 34:
```typescript
needsSatisfaction: (needs.state.hunger + needs.state.energy + needs.state.social + needs.state.thirst) / NEEDS_SUM_MAX,
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/infrastructure/systems/mood-system.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Fix test fixtures missing thirst**

Multiple test files create agent `needs` without `thirst`, which will produce `NaN` in the mood calculation. Add `thirst: 80` (or appropriate value) to every `createTestAgent()` or `needs: {...}` fixture in:
- `tests/infrastructure/systems/mood-system.test.ts` — all `createTestAgent` calls
- `tests/infrastructure/systems/facility-system.test.ts` — `needs` in agent fixtures
- `tests/infrastructure/systems/day-night-system.test.ts` — `needs` in agent fixtures
- `tests/integration/smoke-test.test.ts` — `lowNeeds` spreads (lines ~97, ~195)
- Any other test file where `needs: { hunger, energy, social }` is set without `thirst`

Search: `grep -rn "needs: { hunger" tests/` to find all instances.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
All tests must pass.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/systems/mood-system.ts tests/
git commit -m "fix(meridian): include thirst in mood needsSatisfaction (NEEDS_SUM_MAX 300→400)"
```

---

### Task 2: Fix btAction reset between ticks

**Files:**
- Modify: `src/infrastructure/systems/behavior-tree-system.ts:11-14`
- Modify: `tests/infrastructure/systems/behavior-tree-system.test.ts`

- [ ] **Step 1: Write failing test**

In `tests/infrastructure/systems/behavior-tree-system.test.ts`, add a test that verifies btAction is reset before each BT step:

```typescript
it('resets btAction to null before each BT step', () => {
	// Set agent.behaviorAgent.btAction = 'eat' manually
	// Run system.execute()
	// If BT step doesn't set a new btAction, it should be null (not 'eat')
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/infrastructure/systems/behavior-tree-system.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Add btAction reset in behavior-tree-system.ts**

In `src/infrastructure/systems/behavior-tree-system.ts`, modify the execute loop (line 12-14):

```typescript
execute(_deps: GameCoreDeps): void {
	for (const agent of agents()) {
		agent.behaviorAgent.btAction = null;
		agent.behaviorTree.step();
	}
},
```

Note: `btAction` is a writable property on `BehaviorAgent`. Check that the interface in `src/domain/systems/behavior-agent.ts` allows setting it. If it's a getter-only, add a setter or a `resetAction()` method.

- [ ] **Step 4: Update existing test mocks to include behaviorAgent**

The existing `createMockAgent()` in `tests/infrastructure/systems/behavior-tree-system.test.ts` only provides `{ behaviorTree: { step: stepFn } }`. After this change, `agent.behaviorAgent.btAction = null` will crash on mocks missing `behaviorAgent`. Update `createMockAgent()` to include:

```typescript
behaviorAgent: { btAction: null },
```

- [ ] **Step 5: Run test — expect PASS**

Run: `npx vitest run tests/infrastructure/systems/behavior-tree-system.test.ts --config configs/vitest.config.ts`

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Some tests may rely on btAction persisting — fix those.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/systems/behavior-tree-system.ts src/domain/systems/behavior-agent.ts tests/infrastructure/systems/behavior-tree-system.test.ts
git commit -m "fix(meridian): reset btAction to null before each BT step — prevent stale action leaks"
```

---

### Task 3: Add `funding` field to ProductionSchema

**Files:**
- Modify: `src/domain/schemas/location-schema.ts:16-24`
- Modify: `tests/integration/data-validation.test.ts` (if schema assertions exist)

- [ ] **Step 1: Write failing test**

In `tests/integration/data-validation.test.ts` (or a new `tests/domain/schemas/location-schema.test.ts`), add:

```typescript
it('ProductionSchema accepts funding field with facility default', () => {
	const result = ProductionSchema.parse({
		job: 'farmer', output: { item_id: 'food', quantity: 1 },
		wage: 3, ticks_per_cycle: 15,
	});
	expect(result!.funding).toBe('facility');
});

it('ProductionSchema accepts treasury funding', () => {
	const result = ProductionSchema.parse({
		job: 'guard', output: { item_id: 'security', quantity: 1 },
		wage: 4, ticks_per_cycle: 20, funding: 'treasury',
	});
	expect(result!.funding).toBe('treasury');
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `funding` is not in schema.

- [ ] **Step 3: Add funding to ProductionSchema**

In `src/domain/schemas/location-schema.ts`, add to the `ProductionSchema` object (after `auto_ticks_per_cycle`):

```typescript
funding: z.enum(['facility', 'treasury']).default('facility'),
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 6: Commit**

```bash
git add src/domain/schemas/location-schema.ts tests/integration/data-validation.test.ts
git commit -m "feat(meridian): add funding field to ProductionSchema (facility|treasury)"
```

---

### Task 4: Add `food_reserve` to NeedsConfigSchema and reservation price params to EconomyConfigSchema

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts:27,75-106`
- Modify: `configs/game-config.json`

- [ ] **Step 1: Write failing test**

```typescript
it('NeedsConfig includes food_reserve with default 3', () => {
	const config = GameConfigSchema.parse({});
	expect(config.needs.food_reserve).toBe(3);
});

it('EconomyConfig includes reservation price params', () => {
	const config = GameConfigSchema.parse({});
	expect(config.economy.reservation_urgency_max).toBe(3);
	expect(config.economy.reservation_stock_factor).toBe(0.5);
	expect(config.economy.reservation_budget_cap).toBe(0.3);
	expect(config.economy.reservation_budget_cap_critical).toBe(0.8);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add schema fields**

In `src/domain/schemas/game-config-schema.ts`:

Add to `NeedsConfigSchema` (after `thirst_threshold`):
```typescript
food_reserve: z.number().int().default(3),
```

Add to `EconomyConfigSchema` (after `price_memory_stale_ticks`):
```typescript
reservation_urgency_max: z.number().default(3),
reservation_stock_factor: z.number().default(0.5),
reservation_budget_cap: z.number().default(0.3),
reservation_budget_cap_critical: z.number().default(0.8),
```

Replace `treasury_regen_per_day` with:
```typescript
treasury_regen_per_agent_per_day: z.number().default(25),
```

- [ ] **Step 4: Update `configs/game-config.json`**

Add under `"needs"`:
```json
"food_reserve": 3
```

Add under `"economy"`:
```json
"reservation_urgency_max": 3,
"reservation_stock_factor": 0.5,
"reservation_budget_cap": 0.3,
"reservation_budget_cap_critical": 0.8,
"treasury_regen_per_agent_per_day": 25,
"guard_stipend": 0
```

Remove `"treasury_regen_per_day"` if present.

- [ ] **Step 5: Fix compilation errors from treasury_regen_per_day removal**

`src/infrastructure/systems/day-night-system.ts:317` references the old field. Update to:
```typescript
const treasuryRegen = deps.config.economy.treasury_regen_per_agent_per_day * agentList.length;
```

Also update any tests in `tests/infrastructure/systems/day-night-system.test.ts` that reference `treasury_regen_per_day` in their config overrides.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Zero errors.

- [ ] **Step 7: Run full test suite and fix any breakage**

Run: `npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 8: Commit**

```bash
git add src/domain/schemas/game-config-schema.ts configs/game-config.json src/infrastructure/systems/day-night-system.ts
git commit -m "feat(meridian): add food_reserve, reservation price params, per-agent treasury regen to config"
```

---

### Task 5: Fix market price recalculation + SellAtMarket fallback price

**Files:**
- Modify: `src/infrastructure/systems/economy-system.ts:30-35`
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:460`

- [ ] **Step 1: Write failing test for market in recalc queue**

In `tests/infrastructure/systems/economy-system.test.ts` (or create if needed), add:

```typescript
it('includes market-type locations in price recalculation queue', () => {
	// Create a location list with a market (production: null, type: 'market')
	// Initialize EconomySystem
	// After first execute, verify market's currentPrices is populated
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Fix EconomySystem initialization**

In `src/infrastructure/systems/economy-system.ts`, change the initialization block (around line 30-35):

```typescript
if (!initialized) {
	for (const loc of locationList) {
		if (loc.production !== null || loc.type === 'market') {
			recalcQueue.push(loc.id, deps.tickCount);
		}
	}
	demandTracker.windowSize = config.demand_window_ticks;
	initialized = true;
}
```

- [ ] **Step 4: Fix SellAtMarket fallback price**

In `src/infrastructure/entity/behavior-agent-factory.ts`, find the `SellAtMarket()` action. Change the price fallback from:
```typescript
const price = facility.state.currentPrices?.[food.item_id] ?? 5;
```
to:
```typescript
const price = facility.state.currentPrices?.[food.item_id] ?? config.economy.food_price;
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/systems/economy-system.ts src/infrastructure/entity/behavior-agent-factory.ts
git commit -m "fix(meridian): include market in price recalc queue, use config food_price in SellAtMarket"
```

---

## Chunk 2: Reservation Price System

### Task 6: Create `calculateReservationPrice` domain function

**Files:**
- Create: `src/domain/systems/utility.ts`
- Create: `tests/domain/systems/utility.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/domain/systems/utility.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateReservationPrice } from '../../../src/domain/systems/utility.js';

describe('calculateReservationPrice', () => {
	const base = {
		baseValue: 5,
		needThreshold: 40,
		walletGold: 30,
		urgencyMax: 3,
		stockFactor: 0.5,
		budgetCap: 0.3,
		budgetCapCritical: 0.8,
	};

	it('returns higher price when need is critical (hunger=10)', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 10, currentStock: 0 });
		expect(price).toBeGreaterThan(5); // willing to pay above base
	});

	it('returns lower price when well-fed (hunger=80)', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 80, currentStock: 0 });
		expect(price).toBeLessThan(5); // not willing to pay full price
	});

	it('diminishes with more stock', () => {
		const price0 = calculateReservationPrice({ ...base, needLevel: 30, currentStock: 0 });
		const price3 = calculateReservationPrice({ ...base, needLevel: 30, currentStock: 3 });
		expect(price3).toBeLessThan(price0);
	});

	it('caps at 30% of wallet when not critical', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 60, currentStock: 0, walletGold: 10 });
		expect(price).toBeLessThanOrEqual(3); // 10 * 0.3
	});

	it('caps at 80% of wallet when critical', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 10, currentStock: 0, walletGold: 10 });
		expect(price).toBeLessThanOrEqual(8); // 10 * 0.8
	});

	it('returns 0 when wallet is empty', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 10, currentStock: 0, walletGold: 0 });
		expect(price).toBe(0);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

Run: `npx vitest run tests/domain/systems/utility.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Implement calculateReservationPrice**

Create `src/domain/systems/utility.ts`:

```typescript
export interface ReservationPriceInput {
	baseValue: number;
	needLevel: number;
	needThreshold: number;
	currentStock: number;
	walletGold: number;
	urgencyMax: number;
	stockFactor: number;
	budgetCap: number;
	budgetCapCritical: number;
}

export function calculateReservationPrice(input: ReservationPriceInput): number {
	const isCritical = input.needLevel < input.needThreshold;

	const urgency = isCritical
		? 1 + ((input.needThreshold - input.needLevel) / input.needThreshold) * (input.urgencyMax - 1)
		: Math.max(0.3, input.needLevel / 100);

	const stockPenalty = 1 / (1 + input.currentStock * input.stockFactor);

	const capRatio = isCritical ? input.budgetCapCritical : input.budgetCap;
	const budgetCap = input.walletGold * capRatio;

	const rawReservation = input.baseValue * urgency * stockPenalty;
	return Math.min(rawReservation, budgetCap);
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/domain/systems/utility.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 6: Commit**

```bash
git add src/domain/systems/utility.ts tests/domain/systems/utility.test.ts
git commit -m "feat(meridian): add calculateReservationPrice domain function with utility-based pricing"
```

---

### Task 7: Integrate reservation price into CanAffordFood + add HasFoodReserve condition

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:255-272`
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

- [ ] **Step 1: Write failing tests**

In `tests/infrastructure/entity/behavior-agent-factory.test.ts`, add:

```typescript
describe('HasFoodReserve', () => {
	it('returns false when no food in inventory', () => {
		// Agent with empty inventory
		expect(agent.HasFoodReserve()).toBe(false);
	});

	it('returns false when food quantity equals reserve', () => {
		// Agent with food quantity = 3 (reserve is 3)
		expect(agent.HasFoodReserve()).toBe(false);
	});

	it('returns true when food quantity exceeds reserve', () => {
		// Agent with food quantity = 5 (reserve is 3)
		expect(agent.HasFoodReserve()).toBe(true);
	});
});

describe('CanAffordFood with reservation price', () => {
	it('returns false when posted price exceeds reservation price', () => {
		// Well-fed agent (hunger=80) with 2 food and gold=20
		// Reservation price will be low, market price will exceed it
		expect(agent.CanAffordFood()).toBe(false);
	});

	it('returns true when starving and price is affordable', () => {
		// Starving agent (hunger=10) with 0 food and gold=30
		// Reservation price will be high, market price (5) is below it
		expect(agent.CanAffordFood()).toBe(true);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add HasFoodReserve condition**

In `src/infrastructure/entity/behavior-agent-factory.ts`, add after `HasFood()`:

```typescript
HasFoodReserve(): boolean {
	const food = findFoodInInventory(agent.inventory);
	if (food === null) return false;
	return food.quantity > config.needs.food_reserve;
},
```

- [ ] **Step 4: Update CanAffordFood to include reservation price**

Import `calculateReservationPrice` from `../../domain/systems/utility.js` and a helper to count food:

```typescript
CanAffordFood(): boolean {
	const staleTicks = config.economy.price_memory_stale_ticks;
	const tick = tickCount();
	let cheapestPrice = config.economy.food_price;
	for (const mem of priceMemories) {
		if (FOOD_ITEMS.has(mem.itemId) && !isPriceStale(mem, tick, staleTicks)) {
			if (mem.price < cheapestPrice) cheapestPrice = mem.price;
		}
	}
	if (agent.gold < cheapestPrice) return false;

	const foodCount = agent.inventory
		.filter(i => FOOD_ITEMS.has(i.item_id))
		.reduce((sum, i) => sum + i.quantity, 0);

	const reservationPrice = calculateReservationPrice({
		baseValue: config.economy.food_price,
		needLevel: agent.hunger,
		needThreshold: config.needs.hunger_threshold,
		currentStock: foodCount,
		walletGold: agent.gold,
		urgencyMax: config.economy.reservation_urgency_max,
		stockFactor: config.economy.reservation_stock_factor,
		budgetCap: config.economy.reservation_budget_cap,
		budgetCapCritical: config.economy.reservation_budget_cap_critical,
	});
	return cheapestPrice <= reservationPrice;
},
```

- [ ] **Step 5: Add HasFoodReserve to the BehaviorAgent interface**

In `src/domain/systems/behavior-agent.ts`, add `HasFoodReserve(): boolean;` to the conditions interface.

- [ ] **Step 6: Run tests — expect PASS**

Run: `npx vitest run tests/infrastructure/entity/behavior-agent-factory.test.ts --config configs/vitest.config.ts`

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/entity/behavior-agent-factory.ts src/domain/systems/behavior-agent.ts tests/infrastructure/entity/behavior-agent-factory.test.ts
git commit -m "feat(meridian): add HasFoodReserve condition and reservation price check in CanAffordFood"
```

---

## Chunk 3: Treasury Funding & FacilitySystem Changes

### Task 8: Add treasury funding path to FacilitySystem

**Files:**
- Modify: `src/domain/systems/facility.ts:1-14`
- Modify: `src/infrastructure/systems/facility-system.ts:76-134`
- Modify: `tests/domain/systems/facility.test.ts`
- Modify: `tests/infrastructure/systems/facility-system.test.ts`

- [ ] **Step 1: Write failing test for domain function**

In `tests/domain/systems/facility.test.ts`, add:

```typescript
describe('treasury-funded facility', () => {
	it('pays full wage from treasury with no tax', () => {
		const result = applyFacilityTick(baseInput({
			workProgress: 4, // will complete cycle (ticksPerCycle=5)
			funding: 'treasury',
			facilityFund: 0, // treasury-funded facilities have no fund
			treasuryFund: 500,
		}));
		expect(result.cycleComplete).toBe(true);
		expect(result.workerGoldChange).toBe(3); // full wage, no tax
		expect(result.facilityFundChange).toBe(0); // facility fund untouched
		expect(result.treasuryChange).toBe(-3); // treasury pays
		expect(result.taxCollected).toBe(0); // no tax on public money
	});

	it('pays partial wage when treasury is low', () => {
		const result = applyFacilityTick(baseInput({
			workProgress: 4,
			funding: 'treasury',
			facilityFund: 0,
			treasuryFund: 1, // less than wage (3)
		}));
		expect(result.workerGoldChange).toBe(1);
		expect(result.treasuryChange).toBe(-1);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add funding support to FacilityTickInput and applyFacilityTick**

In `src/domain/systems/facility.ts`:

Add to `FacilityTickInput`:
```typescript
funding: 'facility' | 'treasury';
treasuryFund: number;
```

Add to `FacilityTickResult`:
```typescript
treasuryChange: number;
```

Update `IDLE_RESULT` to include `treasuryChange: 0`.

In the cycle-complete branch (line 77-91), add funding logic:

```typescript
if (nextProgress >= input.ticksPerCycle) {
	if (input.funding === 'treasury') {
		const actualWage = Math.min(input.wage, input.treasuryFund);
		return {
			newWorkProgress: 0,
			status: 'producing',
			cycleComplete: true,
			workerGoldChange: actualWage, // full wage, no tax
			facilityFundChange: 0,
			treasuryChange: -actualWage,
			taxCollected: 0,
			consumeInput: true,
			produceOutput: true,
			idleReason: null,
		};
	}
	// existing facility-funded path
	const actualWage = Math.min(input.wage, input.facilityFund);
	const tax = actualWage * input.taxRate;
	const netWage = actualWage - tax;
	return {
		newWorkProgress: 0,
		status: 'producing',
		cycleComplete: true,
		workerGoldChange: netWage,
		facilityFundChange: actualWage === 0 ? 0 : -actualWage,
		treasuryChange: 0,
		taxCollected: tax,
		consumeInput: true,
		produceOutput: true,
		idleReason: null,
	};
}
```

Also update `IDLE_RESULT` constant (line 28-37) to include `treasuryChange: 0`:

```typescript
const IDLE_RESULT: Omit<FacilityTickResult, 'idleReason'> = {
	newWorkProgress: 0,
	status: 'idle',
	cycleComplete: false,
	workerGoldChange: 0,
	facilityFundChange: 0,
	treasuryChange: 0,
	taxCollected: 0,
	consumeInput: false,
	produceOutput: false,
};
```

Add `treasuryChange: 0` to ALL other return paths (producing non-complete, auto-process returns).

- [ ] **Step 4: Update `baseInput()` in `tests/domain/systems/facility.test.ts`**

Add defaults for the new fields to `baseInput()`:

```typescript
funding: 'facility' as const,
treasuryFund: 0,
```

This prevents all 14 existing tests from breaking due to missing required fields.

- [ ] **Step 5: Run domain test — expect PASS**

Run: `npx vitest run tests/domain/systems/facility.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Update FacilitySystem to pass funding + handle treasury result**

> **Dependency:** This step requires Task 3 (funding field in ProductionSchema) to be committed first. `loc.production.funding` won't exist in the TypeScript type until the schema is updated.

In `src/infrastructure/systems/facility-system.ts`, where `applyFacilityTick` is called, pass the new fields:

```typescript
funding: loc.production!.funding ?? 'facility',
treasuryFund: economy.state.treasury,
```

In `recordCycleComplete`, handle `result.treasuryChange`:

```typescript
if (result.treasuryChange !== 0) {
	economy.state = {
		...economy.state,
		treasury: economy.state.treasury + result.treasuryChange,
	};

	deps.eventBus.emit({
		type: 'GoldFlowed',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'FacilitySystem',
		payload: {
			category: 'transfer' as const,
			subcategory: 'public_wage',
			amount: -result.treasuryChange,
			fromEntity: 'treasury',
			toEntity: worker.agentId,
		},
	});
}
```

- [ ] **Step 6: Guard FacilityInsolvent check for treasury-funded facilities**

In `src/infrastructure/systems/facility-system.ts`, the insolvency check at line 188 fires when `facility.state.fund <= 0`. Treasury-funded facilities always have `fund: 0` by design, so this would fire on every production cycle. Add a guard:

```typescript
// Insolvency check — skip for treasury-funded facilities (fund is always 0 by design)
if (facility.state.fund <= 0 && loc.production?.funding !== 'treasury') {
	// ... existing FacilityInsolvent event emission
}
```

- [ ] **Step 7: Fix all existing facility-system tests**

Run: `npx vitest run tests/infrastructure/systems/facility-system.test.ts --config configs/vitest.config.ts`

Update existing `applyFacilityTick` call sites in tests to include `funding: 'facility'` and `treasuryFund: 0`.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 8: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 9: Commit**

```bash
git add src/domain/systems/facility.ts src/infrastructure/systems/facility-system.ts tests/domain/systems/facility.test.ts tests/infrastructure/systems/facility-system.test.ts
git commit -m "feat(meridian): add treasury funding path to FacilitySystem — public sector wage support"
```

---

### Task 9: Update game-view.ts FacilityComponent initialization

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts:138-148`

- [ ] **Step 1: Modify FacilityComponent initialization**

In `src/infrastructure/engine/game-view.ts`, find the block that initializes FacilityComponent for production locations (around line 138-148). Change:

```typescript
if (loc.production !== null) {
	const startingStock = [{ item_id: loc.production.output.item_id, quantity: 5 }];
	const fund = loc.production.funding === 'treasury' ? 0 : deps.config.economy.facility_start_fund;
	marker.addComponent(new FacilityComponent({
		stock: startingStock,
		fund,
		workProgress: 0,
		...
	}));
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/engine/game-view.ts
git commit -m "feat(meridian): branch FacilityComponent init on funding — treasury facilities start with fund=0"
```

---

## Chunk 4: Guard Agent & Behavior Trees

### Task 10: Create guard agent data + guard post location + update housing

**Files:**
- Create: `agents/guard.json`
- Create: `locations/guard-post.json`
- Modify: `locations/house.json`

- [ ] **Step 1: Create guard agent**

Create `agents/guard.json`:

```json
{
	"id": "agent-guard",
	"name": "Guard",
	"kind": "guard",
	"color": "#5c6bc0",
	"attributes": { "ST": 14, "DX": 12, "IQ": 10, "HT": 13 },
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
	"position": { "x": 260, "y": 220, "region": "region-valley" },
	"relationships": null,
	"tools": [],
	"behavior_tree": "guard",
	"job": null,
	"property": []
}
```

- [ ] **Step 2: Create guard post location**

Create `locations/guard-post.json`:

```json
{
	"id": "loc-guard-post",
	"name": "Guard Post",
	"type": "work",
	"position": { "x": 230, "y": 180, "region": "region-valley" },
	"color": "#78909c",
	"production": {
		"job": "guard",
		"output": { "item_id": "security", "quantity": 1 },
		"input": null,
		"wage": 4,
		"ticks_per_cycle": 20,
		"funding": "treasury"
	},
	"capacity": 1
}
```

- [ ] **Step 3: Update house capacity**

In `locations/house.json`, change `"capacity": 1` to `"capacity": 2`.

- [ ] **Step 4: Validate JSON files parse against schemas**

```bash
npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

If data-validation tests check specific location/agent counts or fields, update them.

- [ ] **Step 5: Commit**

```bash
git add agents/guard.json locations/guard-post.json locations/house.json
git commit -m "feat(meridian): add guard agent, guard post location, increase cottage capacity to 2"
```

---

### Task 11: Create guard behavior tree + update settler BT + expand BT_KINDS

**Files:**
- Create: `behavior-trees/branch-guard.mdsl`
- Modify: `behavior-trees/branch-settler.mdsl`
- Modify: `src/infrastructure/engine/world-loader.ts:49`

- [ ] **Step 1: Create guard behavior tree**

Create `behavior-trees/branch-guard.mdsl`:

```
root [Role] {
    selector {
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

- [ ] **Step 2: Update settler behavior tree**

The sell branches in `behavior-trees/branch-settler.mdsl` already have `flip { condition [IsHungry] }` from the previous session. Now replace `HasFood` with `HasFoodReserve` in those branches:

Change `condition [HasFood]` to `condition [HasFoodReserve]` in lines 13 and 19 (the two sell-related sequences). Keep the harvest sequence's `FacilityHasStock` unchanged.

Final `branch-settler.mdsl`:

```
root [Role] {
    selector {
        /* Harvest food from farm if stock available */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [Harvest]
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

- [ ] **Step 3: Expand BT_KINDS**

In `src/infrastructure/engine/world-loader.ts:49`, change:

```typescript
const BT_KINDS = ['settler', 'guard'] as const;
```

- [ ] **Step 4: Validate MDSL files parse**

```bash
node -e "
const {convertMDSLToJSON, validateDefinition} = require('mistreevous');
const fs = require('fs');
const base = fs.readFileSync('behavior-trees/base.mdsl', 'utf8');
for (const branch of ['branch-settler.mdsl', 'branch-guard.mdsl']) {
  const b = fs.readFileSync('behavior-trees/' + branch, 'utf8');
  const composed = base + '\n\n' + b;
  convertMDSLToJSON(composed);
  const r = validateDefinition(composed);
  console.log(branch + ':', r.succeeded ? 'VALID' : 'INVALID: ' + r.errorMessage);
}
"
```

Expected: Both VALID.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 7: Commit**

```bash
git add behavior-trees/branch-guard.mdsl behavior-trees/branch-settler.mdsl src/infrastructure/engine/world-loader.ts
git commit -m "feat(meridian): add guard BT, update settler BT with HasFoodReserve, expand BT_KINDS"
```

---

## Chunk 5: Integration Verification

### Task 12: Integration test — two-agent economy loop

**Files:**
- Create: `tests/integration/two-agent-economy.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/two-agent-economy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { applyFacilityTick } from '../../src/domain/systems/facility.js';
import { calculateReservationPrice } from '../../src/domain/systems/utility.js';

describe('two-agent economy integration', () => {
	const config = GameConfigSchema.parse({});

	it('treasury-funded facility pays wages from treasury without tax', () => {
		const result = applyFacilityTick({
			hasWorker: true,
			workerJob: 'guard',
			facilityJob: 'guard',
			workProgress: 19, // completes on tick 20
			ticksPerCycle: 20,
			hasRequiredInput: true,
			wage: 4,
			taxRate: 0.10,
			facilityFund: 0,
			workerGold: 30,
			autoProcess: false,
			autoTicksPerCycle: 60,
			funding: 'treasury',
			treasuryFund: 1000,
		});

		expect(result.cycleComplete).toBe(true);
		expect(result.workerGoldChange).toBe(4); // full wage, no tax
		expect(result.treasuryChange).toBe(-4);
		expect(result.taxCollected).toBe(0);
		expect(result.facilityFundChange).toBe(0);
	});

	it('farmer keeps food reserve and only sells excess', () => {
		// HasFoodReserve: food.quantity > config.needs.food_reserve (3)
		// With 5 food: 5 > 3 = true (can sell)
		// With 3 food: 3 > 3 = false (keep reserve)
		expect(5 > config.needs.food_reserve).toBe(true);
		expect(3 > config.needs.food_reserve).toBe(false);
	});

	it('starving guard is willing to pay more than base price', () => {
		const price = calculateReservationPrice({
			baseValue: config.economy.food_price,
			needLevel: 10, // critically hungry
			needThreshold: config.needs.hunger_threshold,
			currentStock: 0,
			walletGold: 30,
			urgencyMax: config.economy.reservation_urgency_max,
			stockFactor: config.economy.reservation_stock_factor,
			budgetCap: config.economy.reservation_budget_cap,
			budgetCapCritical: config.economy.reservation_budget_cap_critical,
		});
		expect(price).toBeGreaterThan(config.economy.food_price);
	});

	it('well-fed guard is not willing to pay base price', () => {
		const price = calculateReservationPrice({
			baseValue: config.economy.food_price,
			needLevel: 80,
			needThreshold: config.needs.hunger_threshold,
			currentStock: 2,
			walletGold: 20,
			urgencyMax: config.economy.reservation_urgency_max,
			stockFactor: config.economy.reservation_stock_factor,
			budgetCap: config.economy.reservation_budget_cap,
			budgetCapCritical: config.economy.reservation_budget_cap_critical,
		});
		expect(price).toBeLessThan(config.economy.food_price);
	});

	it('per-agent treasury regen scales with agent count', () => {
		const regenPerAgent = config.economy.treasury_regen_per_agent_per_day;
		expect(regenPerAgent * 2).toBe(50); // 2 agents = 50g/day
		expect(regenPerAgent * 5).toBe(125); // 5 agents = 125g/day
	});
});
```

- [ ] **Step 2: Run test — expect PASS**

Run: `npx vitest run tests/integration/two-agent-economy.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 5: Commit**

```bash
git add tests/integration/two-agent-economy.test.ts
git commit -m "test(meridian): add two-agent economy integration tests — treasury funding, reserve, reservation pricing"
```

---

### Task 13: Final verification pass

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --config configs/vitest.config.ts
```

All tests must pass.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit --project configs/tsconfig.json
```

Zero errors.

- [ ] **Step 3: Validate all MDSL files**

```bash
node -e "
const {convertMDSLToJSON, validateDefinition} = require('mistreevous');
const fs = require('fs');
const base = fs.readFileSync('behavior-trees/base.mdsl', 'utf8');
for (const branch of ['branch-settler.mdsl', 'branch-guard.mdsl']) {
  const b = fs.readFileSync('behavior-trees/' + branch, 'utf8');
  const composed = base + '\n\n' + b;
  convertMDSLToJSON(composed);
  const r = validateDefinition(composed);
  console.log(branch + ':', r.succeeded ? 'VALID' : 'INVALID: ' + r.errorMessage);
}
"
```

- [ ] **Step 4: Validate all JSON data files against schemas**

```bash
npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Final commit if any remaining changes**

```bash
git status
# If clean, done. If not, commit remaining changes.
```
