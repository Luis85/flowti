# Economy Depth: Local Information & Monetary Policy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local price information, price elasticity, demand tracking, and monetary policy to Project Meridian's economy, producing emergent economic behavior from simple agent rules.

**Architecture:** Pure domain functions (pricing, demand tracking, monetary policy, price memory) tested independently, then wired into the simulation via infrastructure system wrappers following the existing dual-layer pattern. All balance values are config-driven via `game-config-schema.ts`.

**Tech Stack:** TypeScript (strict), Zod v4, ExcaliburJS ECS, Vitest, flatqueue, mnemonist/circular-buffer

**Prerequisite:** The companion spec's BehaviorAgent + base economy loop (mistreevous migration) must be implemented first. This plan assumes BehaviorAgent, MDSL trees, and the base trade flow exist.

**Spec:** `docs/specs/2026-04-01-economy-depth-local-information-design.md`

**Project root for all commands:** `cd "01 - Projects/Project Meridian"`

---

## Chunk 1: Pure Domain Foundations

No game impact yet. Four pure domain modules with full test coverage. No ECS, no EventBus, no infrastructure.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install flatqueue and mnemonist**

```bash
cd "01 - Projects/Project Meridian"
npm install flatqueue mnemonist
```

- [ ] **Step 2: Verify imports work**

```bash
cd "01 - Projects/Project Meridian"
node -e "import('flatqueue').then(m => console.log('flatqueue OK:', typeof m.default))" 
node -e "import('mnemonist/circular-buffer.js').then(m => console.log('mnemonist OK:', typeof m.default))"
```

Expected: Both print OK with `function`.

- [ ] **Step 3: Verify tests still pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/package.json" "01 - Projects/Project Meridian/package-lock.json"
git commit -m "deps(meridian): add flatqueue and mnemonist for economy depth"
```

---

### Task 2: Pricing Formula — Pure Domain

**Files:**
- Create: `src/domain/systems/pricing.ts`
- Create: `tests/domain/systems/pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/systems/pricing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePostedPrice, type PricingInput } from '../../../src/domain/systems/pricing.js';

function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
	return {
		baseValue: 10,
		demandRate: 5,
		supplyCount: 5,
		locationHops: 0,
		elasticity: 1.0,
		pipelineModifiers: [],
		clampMin: 0.5,
		clampMax: 3.0,
		...overrides,
	};
}

describe('calculatePostedPrice', () => {
	it('returns baseValue when demand equals supply and no modifiers', () => {
		const price = calculatePostedPrice(baseInput());
		expect(price).toBe(10);
	});

	it('increases price when demand exceeds supply', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5 }));
		expect(price).toBeGreaterThan(10);
	});

	it('decreases price when supply exceeds demand', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 2, supplyCount: 5 }));
		expect(price).toBeLessThan(10);
	});

	it('amplifies scarcity with high elasticity (subsistence)', () => {
		const normal = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 1.0 }));
		const elastic = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 1.5 }));
		expect(elastic).toBeGreaterThan(normal);
	});

	it('dampens scarcity with low elasticity (luxury)', () => {
		const normal = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 1.0 }));
		const inelastic = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 0.4 }));
		expect(inelastic).toBeLessThan(normal);
	});

	it('increases price with location hops', () => {
		const local = calculatePostedPrice(baseInput({ locationHops: 0 }));
		const distant = calculatePostedPrice(baseInput({ locationHops: 3 }));
		expect(distant).toBeGreaterThan(local);
	});

	it('applies pipeline modifiers multiplicatively', () => {
		const price = calculatePostedPrice(baseInput({ pipelineModifiers: [1.2, 0.8] }));
		// 1.2 * 0.8 = 0.96 — slight discount
		expect(price).toBeCloseTo(10 * 0.96, 1);
	});

	it('clamps price to minimum', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 0, supplyCount: 100, clampMin: 0.5 }));
		expect(price).toBeGreaterThanOrEqual(10 * 0.5);
	});

	it('clamps price to maximum', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 100, supplyCount: 1, clampMax: 3.0 }));
		expect(price).toBeLessThanOrEqual(10 * 3.0);
	});

	it('handles zero supply without division error', () => {
		const price = calculatePostedPrice(baseInput({ supplyCount: 0 }));
		expect(price).toBeLessThanOrEqual(10 * 3.0);
		expect(Number.isFinite(price)).toBe(true);
	});

	it('handles zero demand', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 0 }));
		expect(price).toBeGreaterThanOrEqual(10 * 0.5);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/pricing.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/systems/pricing.ts`:

```typescript
export interface PricingInput {
	baseValue: number;
	demandRate: number;
	supplyCount: number;
	locationHops: number;
	elasticity: number;
	pipelineModifiers: number[];
	clampMin: number;
	clampMax: number;
}

export function calculatePostedPrice(input: PricingInput): number {
	const scarcityRaw = input.demandRate / Math.max(1, input.supplyCount);
	const scarcity = 1.0 + (scarcityRaw - 1.0) * input.elasticity;
	const locationMod = 1.0 + (input.locationHops * 0.1);
	const pipeline = input.pipelineModifiers.length > 0
		? input.pipelineModifiers.reduce((a, b) => a * b, 1.0)
		: 1.0;
	const raw = input.baseValue * scarcity * locationMod * pipeline;
	return clamp(raw, input.baseValue * input.clampMin, input.baseValue * input.clampMax);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/pricing.test.ts
```

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/pricing.ts" "01 - Projects/Project Meridian/tests/domain/systems/pricing.test.ts"
git commit -m "feat(meridian): add pricing formula with elasticity and clamping"
```

---

### Task 3: Demand Tracker — Pure Domain

**Files:**
- Create: `src/domain/systems/demand-tracker.ts`
- Create: `tests/domain/systems/demand-tracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/systems/demand-tracker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	createDemandTracker,
	recordConsumption,
	getDemandRate,
	type DemandTracker,
} from '../../../src/domain/systems/demand-tracker.js';

function emptyTracker(windowSize = 100): DemandTracker {
	return createDemandTracker(windowSize);
}

describe('DemandTracker', () => {
	it('returns 0 demand for unknown item', () => {
		const tracker = emptyTracker();
		expect(getDemandRate(tracker, 'bread', 50)).toBe(0);
	});

	it('records consumption and returns correct demand', () => {
		const tracker = emptyTracker();
		recordConsumption(tracker, 'bread', 1, 10);
		recordConsumption(tracker, 'bread', 2, 20);
		expect(getDemandRate(tracker, 'bread', 50)).toBe(3);
	});

	it('excludes events outside the window', () => {
		const tracker = emptyTracker(100);
		recordConsumption(tracker, 'bread', 1, 10);
		recordConsumption(tracker, 'bread', 1, 120);
		// At tick 150, window is [50, 150] — only tick 120 is in window
		expect(getDemandRate(tracker, 'bread', 150)).toBe(1);
	});

	it('prunes expired events on read', () => {
		const tracker = emptyTracker(100);
		recordConsumption(tracker, 'bread', 1, 10);
		recordConsumption(tracker, 'bread', 1, 20);
		recordConsumption(tracker, 'bread', 1, 130);
		getDemandRate(tracker, 'bread', 150);
		// After pruning, only tick 130 remains
		expect(tracker.events.get('bread')?.length).toBe(1);
	});

	it('tracks multiple items independently', () => {
		const tracker = emptyTracker();
		recordConsumption(tracker, 'bread', 3, 10);
		recordConsumption(tracker, 'wheat', 5, 10);
		expect(getDemandRate(tracker, 'bread', 50)).toBe(3);
		expect(getDemandRate(tracker, 'wheat', 50)).toBe(5);
	});

	it('handles window size of 0 — only current tick counts', () => {
		const tracker = emptyTracker(0);
		recordConsumption(tracker, 'bread', 1, 10);
		expect(getDemandRate(tracker, 'bread', 10)).toBe(1);
		expect(getDemandRate(tracker, 'bread', 11)).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/demand-tracker.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/systems/demand-tracker.ts`:

```typescript
export interface ConsumptionEvent {
	itemId: string;
	quantity: number;
	tick: number;
}

export interface DemandTracker {
	windowSize: number;
	events: Map<string, ConsumptionEvent[]>;
}

export function createDemandTracker(windowSize: number): DemandTracker {
	return { windowSize, events: new Map() };
}

export function recordConsumption(
	tracker: DemandTracker,
	itemId: string,
	quantity: number,
	tick: number,
): void {
	const list = tracker.events.get(itemId) ?? [];
	list.push({ itemId, quantity, tick });
	tracker.events.set(itemId, list);
}

export function getDemandRate(
	tracker: DemandTracker,
	itemId: string,
	currentTick: number,
): number {
	const list = tracker.events.get(itemId) ?? [];
	const cutoff = currentTick - tracker.windowSize;
	const inWindow = list.filter(e => e.tick >= cutoff);
	tracker.events.set(itemId, inWindow);
	return inWindow.reduce((sum, e) => sum + e.quantity, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/demand-tracker.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/demand-tracker.ts" "01 - Projects/Project Meridian/tests/domain/systems/demand-tracker.test.ts"
git commit -m "feat(meridian): add sliding-window demand tracker"
```

---

### Task 4: Price Memory — Pure Domain

**Files:**
- Create: `src/domain/systems/price-memory.ts`
- Create: `tests/domain/systems/price-memory.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/systems/price-memory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import CircularBuffer from 'mnemonist/circular-buffer';
import {
	isPriceStale,
	getRememberedPrice,
	getBestKnownSource,
	type PriceMemory,
} from '../../../src/domain/systems/price-memory.js';

function makeMemory(overrides: Partial<PriceMemory> = {}): PriceMemory {
	return { itemId: 'bread', price: 5, locationId: 'bakery', tick: 100, ...overrides };
}

function bufferWith(...memories: PriceMemory[]): CircularBuffer<PriceMemory> {
	const buf = new CircularBuffer<PriceMemory>(Array, 20);
	for (const m of memories) buf.push(m);
	return buf;
}

describe('isPriceStale', () => {
	it('returns false for fresh memory', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 150, 200)).toBe(false);
	});

	it('returns true for old memory', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 350, 200)).toBe(true);
	});

	it('returns false at exact boundary', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 300, 200)).toBe(false);
	});
});

describe('getRememberedPrice', () => {
	it('returns null for empty buffer', () => {
		const buf = bufferWith();
		expect(getRememberedPrice(buf, 'bread', 100, 200)).toBeNull();
	});

	it('returns null when all memories are stale', () => {
		const buf = bufferWith(makeMemory({ tick: 10 }));
		expect(getRememberedPrice(buf, 'bread', 500, 200)).toBeNull();
	});

	it('returns null for unknown item', () => {
		const buf = bufferWith(makeMemory({ itemId: 'wheat' }));
		expect(getRememberedPrice(buf, 'bread', 150, 200)).toBeNull();
	});

	it('returns freshest non-stale memory', () => {
		const buf = bufferWith(
			makeMemory({ tick: 80, price: 4 }),
			makeMemory({ tick: 120, price: 6 }),
		);
		const result = getRememberedPrice(buf, 'bread', 150, 200);
		expect(result?.price).toBe(6);
		expect(result?.tick).toBe(120);
	});

	it('skips stale entries and returns fresh one', () => {
		const buf = bufferWith(
			makeMemory({ tick: 10, price: 3 }),
			makeMemory({ tick: 120, price: 7 }),
		);
		const result = getRememberedPrice(buf, 'bread', 250, 200);
		expect(result?.price).toBe(7);
	});
});

describe('getBestKnownSource', () => {
	it('returns null for empty buffer', () => {
		const buf = bufferWith();
		expect(getBestKnownSource(buf, 'bread', 100, 200)).toBeNull();
	});

	it('returns cheapest non-stale source', () => {
		const buf = bufferWith(
			makeMemory({ locationId: 'bakery', price: 8, tick: 100 }),
			makeMemory({ locationId: 'market', price: 5, tick: 110 }),
		);
		expect(getBestKnownSource(buf, 'bread', 150, 200)).toBe('market');
	});

	it('ignores stale sources', () => {
		const buf = bufferWith(
			makeMemory({ locationId: 'bakery', price: 2, tick: 10 }),
			makeMemory({ locationId: 'market', price: 8, tick: 120 }),
		);
		expect(getBestKnownSource(buf, 'bread', 250, 200)).toBe('market');
	});

	it('evicts oldest memory when buffer is full', () => {
		const small = new CircularBuffer<PriceMemory>(Array, 3);
		small.push(makeMemory({ locationId: 'a', price: 1, tick: 10 }));
		small.push(makeMemory({ locationId: 'b', price: 2, tick: 20 }));
		small.push(makeMemory({ locationId: 'c', price: 3, tick: 30 }));
		small.push(makeMemory({ locationId: 'd', price: 0.5, tick: 40 }));
		// 'a' was evicted, 'd' is cheapest
		expect(getBestKnownSource(small, 'bread', 50, 200)).toBe('d');
		expect(small.size).toBe(3);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/price-memory.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/systems/price-memory.ts`:

```typescript
import type CircularBuffer from 'mnemonist/circular-buffer';

export interface PriceMemory {
	itemId: string;
	price: number;
	locationId: string;
	tick: number;
}

export function isPriceStale(memory: PriceMemory, currentTick: number, staleTicks: number): boolean {
	return (currentTick - memory.tick) > staleTicks;
}

export function getRememberedPrice(
	memories: CircularBuffer<PriceMemory>,
	itemId: string,
	currentTick: number,
	staleTicks: number,
): PriceMemory | null {
	let best: PriceMemory | null = null;
	for (const mem of memories) {
		if (mem.itemId !== itemId) continue;
		if (isPriceStale(mem, currentTick, staleTicks)) continue;
		if (best === null || mem.tick > best.tick) best = mem;
	}
	return best;
}

export function getBestKnownSource(
	memories: CircularBuffer<PriceMemory>,
	itemId: string,
	currentTick: number,
	staleTicks: number,
): string | null {
	let cheapest: PriceMemory | null = null;
	for (const mem of memories) {
		if (mem.itemId !== itemId) continue;
		if (isPriceStale(mem, currentTick, staleTicks)) continue;
		if (cheapest === null || mem.price < cheapest.price) cheapest = mem;
	}
	return cheapest?.locationId ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/price-memory.test.ts
```

Expected: All 11 tests pass.

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All existing tests + new tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/price-memory.ts" "01 - Projects/Project Meridian/tests/domain/systems/price-memory.test.ts"
git commit -m "feat(meridian): add price memory queries with staleness and best-source lookup"
```

---

## Chunk 2: Wire Into Simulation

Connect the pure domain modules to the ECS simulation. Extends schemas, config, and the existing trade flow.

**Scope note:** Tasks 6-7 pull forward the `monetary_policy` config section and `GoldFlow` type from the spec's Chunk 3 scope. This is intentional — it keeps all schema/type modifications in one chunk, avoiding a second round of `game-config-schema.ts` and `component-data.ts` edits in Chunk 3. The added fields are inert until Chunk 3 systems consume them.

**Deferred to companion spec plan:** The spec's Chunk 2 also includes extending BehaviorAgent with `priceMemories`, updating MDSL trees to use remembered-price variants, and adding `category` fields to item data files. These depend on the companion spec's BehaviorAgent implementation and are deferred to that plan. This plan covers the schema, config, and system infrastructure only.

---

### Task 5: Item Schema with Category

**Files:**
- Create: `src/domain/schemas/item-schema.ts`
- Modify: `src/domain/schemas/index.ts` (add re-export)
- Create: `tests/domain/schemas/item-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/schemas/item-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ItemSchema } from '../../../src/domain/schemas/item-schema.js';

describe('ItemSchema', () => {
	it('accepts a valid item with explicit category', () => {
		const result = ItemSchema.safeParse({
			id: 'bread',
			name: 'Bread',
			baseValue: 5,
			category: 'subsistence',
		});
		expect(result.success).toBe(true);
	});

	it('defaults category to trade_goods', () => {
		const result = ItemSchema.safeParse({
			id: 'leather',
			name: 'Leather',
			baseValue: 8,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.category).toBe('trade_goods');
		}
	});

	it('rejects invalid category', () => {
		const result = ItemSchema.safeParse({
			id: 'bread',
			name: 'Bread',
			baseValue: 5,
			category: 'mythical',
		});
		expect(result.success).toBe(false);
	});

	it('rejects negative baseValue', () => {
		const result = ItemSchema.safeParse({
			id: 'bread',
			name: 'Bread',
			baseValue: -1,
			category: 'subsistence',
		});
		expect(result.success).toBe(false);
	});

	it('accepts all four valid categories', () => {
		for (const cat of ['subsistence', 'comfort', 'trade_goods', 'luxury']) {
			const result = ItemSchema.safeParse({
				id: `test-${cat}`,
				name: `Test ${cat}`,
				baseValue: 10,
				category: cat,
			});
			expect(result.success, `category '${cat}' should be valid`).toBe(true);
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/schemas/item-schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/schemas/item-schema.ts`:

```typescript
import { z } from 'zod';

export const ITEM_CATEGORIES = ['subsistence', 'comfort', 'trade_goods', 'luxury'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	baseValue: z.number().min(0),
	category: z.enum(ITEM_CATEGORIES).default('trade_goods'),
});

export type Item = z.infer<typeof ItemSchema>;
```

- [ ] **Step 4: Add re-export to index.ts**

Read `src/domain/schemas/index.ts` and add the item-schema export at the appropriate location.

Add this line to the barrel exports:

```typescript
export { ItemSchema, ITEM_CATEGORIES, type Item, type ItemCategory } from './item-schema.js';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/schemas/item-schema.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/item-schema.ts" "01 - Projects/Project Meridian/src/domain/schemas/index.ts" "01 - Projects/Project Meridian/tests/domain/schemas/item-schema.test.ts"
git commit -m "feat(meridian): add item schema with category field for price elasticity"
```

---

### Task 6: Extend Game Config with Economy Depth Settings

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts` (lines 29-46, economy section)
- Create: `tests/domain/schemas/economy-config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/schemas/economy-config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';

describe('GameConfigSchema economy depth fields', () => {
	it('provides defaults for all new economy fields', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) return;
		const eco = result.data.economy;

		expect(eco.price_memory_max).toBe(20);
		expect(eco.price_memory_stale_ticks).toBe(200);
		expect(eco.demand_window_ticks).toBe(500);
		expect(eco.elasticity).toEqual({
			subsistence: 1.5,
			comfort: 1.0,
			trade_goods: 0.7,
			luxury: 0.4,
		});
	});

	it('provides defaults for monetary_policy section', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) return;
		const mp = result.data.economy.monetary_policy;

		expect(mp.velocity_window_ticks).toBe(500);
		expect(mp.velocity_healthy_min).toBe(0.3);
		expect(mp.velocity_healthy_max).toBe(0.8);
		expect(mp.velocity_stagnant).toBe(0.2);
		expect(mp.velocity_overheated).toBe(1.5);
		expect(mp.velocity_critical).toBe(0.1);
		expect(mp.stimulus_trigger_ticks).toBe(50);
		expect(mp.stimulus_duration_ticks).toBe(100);
		expect(mp.caravan_cooldown_ticks).toBe(500);
		expect(mp.tax_base_rate).toBe(0.10);
		expect(mp.tax_stagnant_multiplier).toBe(0.5);
		expect(mp.tax_overheated_multiplier).toBe(1.5);
		expect(mp.admin_fee_rate).toBe(0.02);
	});

	it('allows overriding elasticity values', () => {
		const result = GameConfigSchema.safeParse({
			economy: { elasticity: { subsistence: 2.0 } },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.economy.elasticity.subsistence).toBe(2.0);
		}
	});

	it('rejects elasticity values above 3', () => {
		const result = GameConfigSchema.safeParse({
			economy: { elasticity: { subsistence: 5.0 } },
		});
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/schemas/economy-config.test.ts
```

Expected: FAIL — fields don't exist yet.

- [ ] **Step 3: Add the new fields to game-config-schema.ts**

Open `src/domain/schemas/game-config-schema.ts`. Locate the `EconomyConfigSchema` (lines 29-46). Add the new fields after the existing ones (after `ledger_retention_days`):

```typescript
// Add after line 45 (ledger_retention_days):
price_memory_max: z.number().default(20),
price_memory_stale_ticks: z.number().default(200),
demand_window_ticks: z.number().default(500),
elasticity: z.record(z.string(), z.number().min(0).max(3)).default({
	subsistence: 1.5,
	comfort: 1.0,
	trade_goods: 0.7,
	luxury: 0.4,
}),
monetary_policy: z.object({
	velocity_window_ticks: z.number().default(500),
	velocity_healthy_min: z.number().default(0.3),
	velocity_healthy_max: z.number().default(0.8),
	velocity_stagnant: z.number().default(0.2),
	velocity_overheated: z.number().default(1.5),
	velocity_critical: z.number().default(0.1),
	stimulus_trigger_ticks: z.number().default(50),
	stimulus_duration_ticks: z.number().default(100),
	caravan_cooldown_ticks: z.number().default(500),
	tax_base_rate: z.number().default(0.10),
	tax_stagnant_multiplier: z.number().default(0.5),
	tax_overheated_multiplier: z.number().default(1.5),
	admin_fee_rate: z.number().default(0.02),
}).default({}),
```

Note: Zod v4 uses `withDefaults()` in this codebase — check how existing nested objects are wrapped and follow the same pattern.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/schemas/economy-config.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: No regressions. All existing economy config tests still pass with new defaults.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" "01 - Projects/Project Meridian/tests/domain/schemas/economy-config.test.ts"
git commit -m "feat(meridian): add economy depth config — elasticity, demand window, monetary policy"
```

---

### Task 7: GoldFlowed Event Type

**Files:**
- Modify: `src/domain/core/component-data.ts` (add GoldFlow type)
- Modify: `src/domain/core/events.ts` (document GoldFlowed event shape)

- [ ] **Step 1: Add GoldFlow type to component-data.ts**

Open `src/domain/core/component-data.ts`. Add after the `LedgerEntry` interface (around line 85):

```typescript
export type FlowCategory = 'faucet' | 'sink' | 'transfer';

export interface GoldFlow {
	category: FlowCategory;
	subcategory: string;
	amount: number;
	tick: number;
	fromEntity: string | null;
	toEntity: string | null;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts"
git commit -m "feat(meridian): add GoldFlow type for monetary policy ledger"
```

---

### Task 8: Economy System — Infrastructure Wrapper

This task creates the EconomySystem that wires the pricing formula and demand tracker into the tick pipeline. The existing `EconomyComponent` on the world entity already holds treasury, ledger, and daily summary. This system adds price recalculation using the flatqueue amortization pattern.

**Files:**
- Create: `src/domain/systems/economy.ts` (pure domain: recalc logic)
- Create: `src/infrastructure/systems/economy-system.ts` (infrastructure wrapper)
- Create: `tests/domain/systems/economy.test.ts`

- [ ] **Step 1: Write the failing tests for the domain function**

Create `tests/domain/systems/economy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	shouldRecalculate,
	recalculateFacilityPrices,
	type FacilityPricingContext,
} from '../../../src/domain/systems/economy.js';

function baseFacility(overrides: Partial<FacilityPricingContext> = {}): FacilityPricingContext {
	return {
		facilityId: 'bakery',
		items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 10 }],
		demandRates: { bread: 8 },
		locationHops: 0,
		pipelineModifiers: [],
		elasticityMap: { subsistence: 1.5, comfort: 1.0, trade_goods: 0.7, luxury: 0.4 },
		clampMin: 0.5,
		clampMax: 3.0,
		...overrides,
	};
}

describe('shouldRecalculate', () => {
	it('returns true when current tick >= scheduled tick', () => {
		expect(shouldRecalculate(100, 100)).toBe(true);
		expect(shouldRecalculate(100, 99)).toBe(true);
	});

	it('returns false when current tick < scheduled tick', () => {
		expect(shouldRecalculate(100, 101)).toBe(false);
	});
});

describe('recalculateFacilityPrices', () => {
	it('returns prices for all items', () => {
		const result = recalculateFacilityPrices(baseFacility());
		expect(result).toHaveProperty('bread');
		expect(result.bread).toBeGreaterThan(0);
	});

	it('applies elasticity per category', () => {
		const subsistence = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'bread', baseValue: 10, category: 'subsistence', stock: 5 }],
			demandRates: { bread: 10 },
		}));
		const luxury = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'gem', baseValue: 10, category: 'luxury', stock: 5 }],
			demandRates: { gem: 10 },
		}));
		expect(subsistence.bread).toBeGreaterThan(luxury.gem);
	});

	it('handles items with zero stock', () => {
		const result = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 0 }],
		}));
		expect(Number.isFinite(result.bread)).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/economy.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the domain function**

Create `src/domain/systems/economy.ts`:

```typescript
import { calculatePostedPrice } from './pricing.js';

export interface FacilityItemContext {
	itemId: string;
	baseValue: number;
	category: string;
	stock: number;
}

export interface FacilityPricingContext {
	facilityId: string;
	items: FacilityItemContext[];
	demandRates: Record<string, number>;
	locationHops: number;
	pipelineModifiers: number[];
	elasticityMap: Record<string, number>;
	clampMin: number;
	clampMax: number;
}

export function shouldRecalculate(currentTick: number, scheduledTick: number): boolean {
	return currentTick >= scheduledTick;
}

export function recalculateFacilityPrices(ctx: FacilityPricingContext): Record<string, number> {
	const prices: Record<string, number> = {};
	for (const item of ctx.items) {
		prices[item.itemId] = calculatePostedPrice({
			baseValue: item.baseValue,
			demandRate: ctx.demandRates[item.itemId] ?? 0,
			supplyCount: item.stock,
			locationHops: ctx.locationHops,
			elasticity: ctx.elasticityMap[item.category] ?? 1.0,
			pipelineModifiers: ctx.pipelineModifiers,
			clampMin: ctx.clampMin,
			clampMax: ctx.clampMax,
		});
	}
	return prices;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/economy.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Create the infrastructure wrapper**

Create `src/infrastructure/systems/economy-system.ts`:

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { shouldRecalculate, recalculateFacilityPrices, type FacilityItemContext } from '../../domain/systems/economy.js';
import { recordConsumption, getDemandRate, createDemandTracker, type DemandTracker } from '../../domain/systems/demand-tracker.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Item } from '../../domain/schemas/item-schema.js';
import type { Actor } from 'excalibur';
import FlatQueue from 'flatqueue';

export function createEconomySystem(
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
	itemRegistry: () => Map<string, Item>,
): GameSystem {
	const demandTracker: DemandTracker = createDemandTracker(0); // calibrated from config on first execute()
	const recalcQueue = new FlatQueue<string>();
	let initialized = false;

	return {
		name: 'EconomySystem',
		priority: SystemPriority.ECONOMY,

		execute(deps: GameCoreDeps): void {
			const locationList = locations();
			const locationActorMap = getLocationActors();
			const items = itemRegistry();
			const config = deps.config.economy;

			// Initialize recalc queue on first tick
			if (!initialized) {
				for (const loc of locationList) {
					if (loc.production !== null) {
						recalcQueue.push(loc.id, deps.tickCount);
					}
				}
				demandTracker.windowSize = config.demand_window_ticks;
				initialized = true;
			}

			// Listen for purchase events to record consumption
			// (EventBus listener registered externally — this system reads from the tracker)

			// Process facilities whose recalc tick has arrived
			while (recalcQueue.peek() !== undefined && shouldRecalculate(deps.tickCount, recalcQueue.peekValue()!)) {
				const facilityId = recalcQueue.pop()!;
				const locActor = locationActorMap.get(facilityId);
				if (locActor === undefined) continue;

				const facility = locActor.get(FacilityComponent);
				const facilityItems: FacilityItemContext[] = facility.state.stock.map(s => {
					const item = items.get(s.item_id);
					return {
						itemId: s.item_id,
						baseValue: item?.baseValue ?? 5,
						category: item?.category ?? 'trade_goods',
						stock: s.quantity,
					};
				});

				const demandRates: Record<string, number> = {};
				for (const fi of facilityItems) {
					demandRates[fi.itemId] = getDemandRate(demandTracker, fi.itemId, deps.tickCount);
				}

				const prices = recalculateFacilityPrices({
					facilityId,
					items: facilityItems,
					demandRates,
					locationHops: 0,
					pipelineModifiers: [],
					elasticityMap: config.elasticity,
					clampMin: config.price_clamp_min,
					clampMax: config.price_clamp_max,
				});

				// Store prices on facility (to be read by agents visiting)
				facility.state = { ...facility.state, currentPrices: prices ?? {} };
				facility.markDirty();

				// Re-queue for next recalculation
				recalcQueue.push(facilityId, deps.tickCount + config.recalculation_interval_ticks);
			}
		},
	};
}
```

**Note:** This wrapper references `facility.state.currentPrices` — the `FacilityState` interface in `component-data.ts` will need a `currentPrices?: Record<string, number>` field added. Check the existing `FacilityState` shape and add the field.

- [ ] **Step 6: Add `currentPrices` to FacilityState**

Open `src/domain/core/component-data.ts`, find the `FacilityState` interface, and add:

```typescript
currentPrices?: Record<string, number>;
```

The field is optional to avoid breaking existing FacilityState construction sites (~10 files). Systems that read it use `facility.state.currentPrices ?? {}`.

- [ ] **Step 7: Verify compilation**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 8: Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All tests pass. Existing FacilityState usages may need `currentPrices: {}` added to test fixtures.

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/economy.ts" "01 - Projects/Project Meridian/src/infrastructure/systems/economy-system.ts" "01 - Projects/Project Meridian/src/domain/core/component-data.ts" "01 - Projects/Project Meridian/tests/domain/systems/economy.test.ts"
git commit -m "feat(meridian): add EconomySystem with pricing recalculation and demand tracking"
```

---

### Task 9: Integration Test — Price Responds to Consumption

**Files:**
- Create: `tests/integration/economy-flow.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/economy-flow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePostedPrice } from '../../src/domain/systems/pricing.js';
import { createDemandTracker, recordConsumption, getDemandRate } from '../../src/domain/systems/demand-tracker.js';
import { recalculateFacilityPrices } from '../../src/domain/systems/economy.js';

describe('Economy flow integration', () => {
	it('price increases when consumption rises', () => {
		const tracker = createDemandTracker(100);
		const elasticityMap = { subsistence: 1.5, comfort: 1.0, trade_goods: 0.7, luxury: 0.4 };

		// Initial price with low demand
		const priceBefore = recalculateFacilityPrices({
			facilityId: 'bakery',
			items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 10 }],
			demandRates: { bread: getDemandRate(tracker, 'bread', 50) },
			locationHops: 0,
			pipelineModifiers: [],
			elasticityMap,
			clampMin: 0.5,
			clampMax: 3.0,
		});

		// Simulate heavy consumption
		for (let i = 0; i < 20; i++) {
			recordConsumption(tracker, 'bread', 1, 50 + i);
		}

		// Recalculate with new demand
		const priceAfter = recalculateFacilityPrices({
			facilityId: 'bakery',
			items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 5 }],
			demandRates: { bread: getDemandRate(tracker, 'bread', 70) },
			locationHops: 0,
			pipelineModifiers: [],
			elasticityMap,
			clampMin: 0.5,
			clampMax: 3.0,
		});

		expect(priceAfter.bread).toBeGreaterThan(priceBefore.bread);
	});

	it('subsistence items swing harder than luxury items under same conditions', () => {
		const tracker = createDemandTracker(100);
		const elasticityMap = { subsistence: 1.5, luxury: 0.4 };

		for (let i = 0; i < 15; i++) {
			recordConsumption(tracker, 'bread', 1, i);
			recordConsumption(tracker, 'gem', 1, i);
		}

		const breadPrice = calculatePostedPrice({
			baseValue: 10, demandRate: getDemandRate(tracker, 'bread', 20),
			supplyCount: 5, locationHops: 0, elasticity: 1.5,
			pipelineModifiers: [], clampMin: 0.5, clampMax: 3.0,
		});

		const gemPrice = calculatePostedPrice({
			baseValue: 10, demandRate: getDemandRate(tracker, 'gem', 20),
			supplyCount: 5, locationHops: 0, elasticity: 0.4,
			pipelineModifiers: [], clampMin: 0.5, clampMax: 3.0,
		});

		expect(breadPrice).toBeGreaterThan(gemPrice);
	});
});
```

- [ ] **Step 2: Run integration test**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/integration/economy-flow.test.ts
```

Expected: Both tests pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/economy-flow.test.ts"
git commit -m "test(meridian): add economy flow integration tests — price responds to demand"
```

---

## Chunk 3: Monetary Policy

Velocity tracking, faucet/sink ledger, progressive tax, and three-layer safety net.

---

### Task 10: Monetary Policy — Pure Domain

**Files:**
- Create: `src/domain/systems/monetary-policy.ts`
- Create: `tests/domain/systems/monetary-policy.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/systems/monetary-policy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	createMonetaryLedger,
	recordFlow,
	calculateMonetarySnapshot,
	getEffectiveTaxRate,
	evaluateSafetyNets,
	type MonetaryLedger,
	type GoldFlow,
} from '../../../src/domain/systems/monetary-policy.js';

function baseLedger(windowSize = 100): MonetaryLedger {
	return createMonetaryLedger(windowSize);
}

function transfer(amount: number, tick: number): GoldFlow {
	return { category: 'transfer', subcategory: 'purchase', amount, tick, fromEntity: 'agent-1', toEntity: 'bakery' };
}

function faucet(amount: number, tick: number): GoldFlow {
	return { category: 'faucet', subcategory: 'treasury_regen', amount, tick, fromEntity: null, toEntity: 'treasury' };
}

function sink(amount: number, tick: number): GoldFlow {
	return { category: 'sink', subcategory: 'repair', amount, tick, fromEntity: 'agent-1', toEntity: null };
}

describe('MonetaryLedger', () => {
	it('starts empty', () => {
		const ledger = baseLedger();
		expect(ledger.flows).toHaveLength(0);
	});

	it('records flows', () => {
		const ledger = baseLedger();
		recordFlow(ledger, transfer(10, 50));
		expect(ledger.flows).toHaveLength(1);
	});
});

describe('calculateMonetarySnapshot', () => {
	it('calculates money supply from all balances', () => {
		const ledger = baseLedger();
		const snap = calculateMonetarySnapshot(ledger, 50, [100, 50, 30], 200);
		expect(snap.moneySupply).toBe(380);
	});

	it('calculates velocity as transfers / money supply', () => {
		const ledger = baseLedger();
		recordFlow(ledger, transfer(10, 40));
		recordFlow(ledger, transfer(20, 45));
		const snap = calculateMonetarySnapshot(ledger, 50, [100], 0);
		expect(snap.velocity).toBeCloseTo(30 / 100);
	});

	it('excludes flows outside window', () => {
		const ledger = baseLedger(100);
		recordFlow(ledger, transfer(10, 10));
		recordFlow(ledger, transfer(20, 120));
		const snap = calculateMonetarySnapshot(ledger, 150, [100], 0);
		// Only tick 120 is in window [50, 150]
		expect(snap.velocity).toBeCloseTo(20 / 100);
	});

	it('separates faucets and sinks', () => {
		const ledger = baseLedger();
		recordFlow(ledger, faucet(50, 40));
		recordFlow(ledger, sink(10, 45));
		recordFlow(ledger, transfer(30, 48));
		const snap = calculateMonetarySnapshot(ledger, 50, [100], 0);
		expect(snap.faucetRate).toBe(50);
		expect(snap.sinkRate).toBe(10);
		expect(snap.netFlow).toBe(40);
	});

	it('handles zero money supply without division error', () => {
		const ledger = baseLedger();
		recordFlow(ledger, transfer(10, 40));
		const snap = calculateMonetarySnapshot(ledger, 50, [], 0);
		expect(snap.velocity).toBe(0);
	});

	it('prunes flows older than window', () => {
		const ledger = baseLedger(100);
		recordFlow(ledger, transfer(10, 10));
		recordFlow(ledger, transfer(20, 120));
		calculateMonetarySnapshot(ledger, 150, [100], 0);
		expect(ledger.flows).toHaveLength(1);
	});
});

describe('getEffectiveTaxRate', () => {
	it('returns base rate in healthy range', () => {
		expect(getEffectiveTaxRate(0.10, 0.5, { stagnant: 0.2, overheated: 1.5 }, { stagnant: 0.5, overheated: 1.5 }))
			.toBe(0.10);
	});

	it('reduces tax when stagnant', () => {
		expect(getEffectiveTaxRate(0.10, 0.1, { stagnant: 0.2, overheated: 1.5 }, { stagnant: 0.5, overheated: 1.5 }))
			.toBeCloseTo(0.05);
	});

	it('increases tax when overheated', () => {
		expect(getEffectiveTaxRate(0.10, 2.0, { stagnant: 0.2, overheated: 1.5 }, { stagnant: 0.5, overheated: 1.5 }))
			.toBeCloseTo(0.15);
	});
});

describe('evaluateSafetyNets', () => {
	it('returns no interventions when velocity is healthy', () => {
		const result = evaluateSafetyNets(0.5, 0, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).toHaveLength(0);
	});

	it('triggers stimulus after enough stagnant ticks', () => {
		const result = evaluateSafetyNets(0.1, 60, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).toContain('stimulus');
	});

	it('triggers emergency recovery at critical velocity', () => {
		const result = evaluateSafetyNets(0.05, 0, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).toContain('recovery_event');
	});

	it('does not trigger stimulus before threshold', () => {
		const result = evaluateSafetyNets(0.1, 30, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).not.toContain('stimulus');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/monetary-policy.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/systems/monetary-policy.ts`:

```typescript
import type { FlowCategory, GoldFlow } from '../core/component-data.js';

export type { GoldFlow };

export interface MonetaryLedger {
	flows: GoldFlow[];
	windowSize: number;
}

export interface MonetarySnapshot {
	moneySupply: number;
	velocity: number;
	faucetRate: number;
	sinkRate: number;
	netFlow: number;
}

export function createMonetaryLedger(windowSize: number): MonetaryLedger {
	return { flows: [], windowSize };
}

export function recordFlow(ledger: MonetaryLedger, flow: GoldFlow): void {
	ledger.flows.push(flow);
}

export function calculateMonetarySnapshot(
	ledger: MonetaryLedger,
	currentTick: number,
	allGoldBalances: number[],
	treasuryGold: number,
): MonetarySnapshot {
	const cutoff = currentTick - ledger.windowSize;
	const recent = ledger.flows.filter(f => f.tick >= cutoff);
	ledger.flows = recent;

	const moneySupply = allGoldBalances.reduce((a, b) => a + b, 0) + treasuryGold;

	let transferVolume = 0;
	let faucetTotal = 0;
	let sinkTotal = 0;

	for (const f of recent) {
		if (f.category === 'transfer') transferVolume += f.amount;
		else if (f.category === 'faucet') faucetTotal += f.amount;
		else if (f.category === 'sink') sinkTotal += f.amount;
	}

	return {
		moneySupply,
		velocity: moneySupply > 0 ? transferVolume / moneySupply : 0,
		faucetRate: faucetTotal,
		sinkRate: sinkTotal,
		netFlow: faucetTotal - sinkTotal,
	};
}

export function getEffectiveTaxRate(
	baseTax: number,
	velocity: number,
	thresholds: { stagnant: number; overheated: number },
	multipliers: { stagnant: number; overheated: number },
): number {
	if (velocity > thresholds.overheated) return baseTax * multipliers.overheated;
	if (velocity < thresholds.stagnant) return baseTax * multipliers.stagnant;
	return baseTax;
}

export function evaluateSafetyNets(
	velocity: number,
	consecutiveStagnantTicks: number,
	config: { stagnant: number; critical: number; stimulusTriggerTicks: number },
): string[] {
	const interventions: string[] = [];
	if (velocity < config.critical) {
		interventions.push('recovery_event');
	}
	if (velocity < config.stagnant && consecutiveStagnantTicks >= config.stimulusTriggerTicks) {
		interventions.push('stimulus');
	}
	return interventions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/systems/monetary-policy.test.ts
```

Expected: All 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/monetary-policy.ts" "01 - Projects/Project Meridian/tests/domain/systems/monetary-policy.test.ts"
git commit -m "feat(meridian): add monetary policy — velocity, ledger, tax, safety nets"
```

---

### Task 11: Monetary Policy System — Infrastructure Wrapper

**Files:**
- Create: `src/infrastructure/systems/monetary-policy-system.ts`

- [ ] **Step 1: Create the infrastructure wrapper**

Create `src/infrastructure/systems/monetary-policy-system.ts`:

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import {
	createMonetaryLedger,
	recordFlow,
	calculateMonetarySnapshot,
	getEffectiveTaxRate,
	evaluateSafetyNets,
	type MonetaryLedger,
	type GoldFlow,
} from '../../domain/systems/monetary-policy.js';
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import type { FlowCategory } from '../../domain/core/component-data.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';

export function createMonetaryPolicySystem(
	agents: () => AgentActor[],
	worldEntity: () => Actor,
): GameSystem {
	const ledger: MonetaryLedger = createMonetaryLedger(0);
	let consecutiveStagnantTicks = 0;
	let lastCaravanTick = -Infinity;

	return {
		name: 'MonetaryPolicySystem',
		priority: SystemPriority.MONETARY_POLICY,

		execute(deps: GameCoreDeps): void {
			const config = deps.config.economy.monetary_policy;
			ledger.windowSize = config.velocity_window_ticks;

			// Ingest GoldFlowed events from this tick into the ledger
			const goldEvents = deps.eventBus.history({ type: 'GoldFlowed' })
				.filter(e => e.tick === deps.tickCount);
			for (const e of goldEvents) {
				recordFlow(ledger, {
					category: e.payload.category as FlowCategory,
					subcategory: e.payload.subcategory as string,
					amount: e.payload.amount as number,
					tick: e.tick,
					fromEntity: (e.payload.fromEntity as string | null) ?? null,
					toEntity: (e.payload.toEntity as string | null) ?? null,
				});
			}

			// Collect gold balances
			const agentList = agents();
			const balances = agentList.map(a => a.get(WalletComponent).state.gold);
			const world = worldEntity();
			const economy = world.get(EconomyComponent);

			// Calculate snapshot
			const snapshot = calculateMonetarySnapshot(
				ledger,
				deps.tickCount,
				balances,
				economy.state.treasury,
			);

			// Track stagnation
			if (snapshot.velocity < config.velocity_stagnant) {
				consecutiveStagnantTicks++;
			} else {
				consecutiveStagnantTicks = 0;
			}

			// Evaluate safety nets
			const interventions = evaluateSafetyNets(
				snapshot.velocity,
				consecutiveStagnantTicks,
				{
					stagnant: config.velocity_stagnant,
					critical: config.velocity_critical,
					stimulusTriggerTicks: config.stimulus_trigger_ticks,
				},
			);

			// Emit events for interventions
			for (const intervention of interventions) {
				if (intervention === 'recovery_event') {
					if (deps.tickCount - lastCaravanTick < config.caravan_cooldown_ticks) continue;
					lastCaravanTick = deps.tickCount;
					deps.eventBus.emit({
						type: 'EmergencyCaravanRequested',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MonetaryPolicySystem',
						payload: { velocity: snapshot.velocity },
					});
				}

				if (intervention === 'stimulus') {
					deps.eventBus.emit({
						type: 'EconomicStimulusActivated',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MonetaryPolicySystem',
						payload: { velocity: snapshot.velocity, duration: config.stimulus_duration_ticks },
					});
				}
			}

			deps.logger.debug('MonetaryPolicySystem', {
				velocity: snapshot.velocity.toFixed(3),
				moneySupply: snapshot.moneySupply,
				netFlow: snapshot.netFlow,
				stagnantTicks: consecutiveStagnantTicks,
				interventions,
			});
		},
	};
}
```

- [ ] **Step 2: Add SystemPriority constant**

Open `src/domain/core/tick-scheduler.ts`. Add between ECONOMY (16) and WORLD_EVENT (17):

```typescript
MONETARY_POLICY: 16.5,
```

- [ ] **Step 3: Verify compilation**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/monetary-policy-system.ts" "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts"
git commit -m "feat(meridian): add MonetaryPolicySystem infrastructure wrapper at priority 16.5"
```

---

### Task 12: Wire GoldFlowed Events from Gold-Moving Systems

**Files:**
- Modify: `src/infrastructure/systems/trade-system.ts` (emit GoldFlowed after purchase)

- [ ] **Step 1: Add GoldFlowed emission to trade-system.ts**

Open `src/infrastructure/systems/trade-system.ts`. In the `applySuccessfulTrade` function, after the existing `PurchaseComplete` event emission (around line 107-118), add:

```typescript
// Emit GoldFlowed for monetary policy tracking
deps.eventBus.emit({
	type: 'GoldFlowed',
	tick: deps.tickCount,
	wallClock: Date.now(),
	source: 'TradeSystem',
	payload: {
		category: 'transfer' as const,
		subcategory: 'purchase',
		amount: foodPrice,
		fromEntity: agent.agentId,
		toEntity: target.location.id,
	},
});
```

Also add `GoldFlowed` emissions for tax if present. Check the current trade logic for where tax is deducted and add a corresponding 'transfer' flow with subcategory 'tax'.

**Scope note:** This task only wires `GoldFlowed` for the trade system (purchases + tax). Other gold-moving systems (facility wages, welfare grants, rest payments, stipends) should emit `GoldFlowed` as well, but are deferred to follow-up tasks. Velocity tracking will be incomplete until all gold flows are instrumented — acceptable for initial implementation since purchases are the dominant transaction type.

- [ ] **Step 2: Verify compilation**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All tests pass. Existing trade tests should not break since the new event is additive.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts"
git commit -m "feat(meridian): emit GoldFlowed events from trade system for monetary tracking"
```

---

### Task 13: Monetary Policy Integration Test

**Files:**
- Modify: `tests/integration/economy-flow.test.ts` (add monetary policy scenario)

- [ ] **Step 1: Add monetary policy integration test**

Add to `tests/integration/economy-flow.test.ts`:

```typescript
import {
	createMonetaryLedger,
	recordFlow,
	calculateMonetarySnapshot,
	getEffectiveTaxRate,
	evaluateSafetyNets,
} from '../../src/domain/systems/monetary-policy.js';

describe('Monetary policy domain flow', () => {
	it('velocity drops → stimulus triggers → tax adjusts', () => {
		const ledger = createMonetaryLedger(100);
		const balances = [100, 80, 60];
		const treasury = 200;

		// Healthy economy — lots of transfers
		for (let tick = 0; tick < 50; tick++) {
			recordFlow(ledger, {
				category: 'transfer', subcategory: 'purchase',
				amount: 5, tick, fromEntity: 'a', toEntity: 'b',
			});
		}

		const healthySnap = calculateMonetarySnapshot(ledger, 50, balances, treasury);
		expect(healthySnap.velocity).toBeGreaterThan(0.2);

		// Economy stagnates — no transfers for 100 ticks
		const stagnantSnap = calculateMonetarySnapshot(ledger, 200, balances, treasury);
		expect(stagnantSnap.velocity).toBe(0);

		// Safety nets trigger
		const interventions = evaluateSafetyNets(
			stagnantSnap.velocity, 60,
			{ stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 },
		);
		expect(interventions).toContain('stimulus');
		expect(interventions).toContain('recovery_event');

		// Tax rate adjusts
		const taxRate = getEffectiveTaxRate(
			0.10, stagnantSnap.velocity,
			{ stagnant: 0.2, overheated: 1.5 },
			{ stagnant: 0.5, overheated: 1.5 },
		);
		expect(taxRate).toBeCloseTo(0.05);
	});
});
```

**Note:** A full integration test exercising the MonetaryPolicySystem wrapper with a real EventBus (verifying GoldFlowed events flow through `eventBus.history()` → `recordFlow()` → snapshot → intervention events emitted) should be added as a follow-up infrastructure test in `tests/infrastructure/systems/monetary-policy-system.test.ts`. The domain flow test above validates the pure functions. The wrapper test should instantiate `createMonetaryPolicySystem()`, inject a test EventBus preloaded with GoldFlowed events, call `execute()`, and assert that `EconomicStimulusActivated` or `EmergencyCaravanRequested` events are emitted.
```

- [ ] **Step 2: Run integration test**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/integration/economy-flow.test.ts
```

Expected: All 3 integration tests pass.

- [ ] **Step 3: Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All tests pass. No regressions.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/economy-flow.test.ts"
git commit -m "test(meridian): add monetary policy integration test — stagnation triggers safety nets"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
cd "01 - Projects/Project Meridian"
npm test
```

Expected: lint + typecheck + all tests pass. Zero regressions.

- [ ] **Verify new file count**

New source files created: 7
- `src/domain/systems/pricing.ts`
- `src/domain/systems/demand-tracker.ts`
- `src/domain/systems/price-memory.ts`
- `src/domain/systems/economy.ts`
- `src/domain/systems/monetary-policy.ts`
- `src/domain/schemas/item-schema.ts`
- `src/infrastructure/systems/economy-system.ts`
- `src/infrastructure/systems/monetary-policy-system.ts`

New test files created: 5
- `tests/domain/systems/pricing.test.ts`
- `tests/domain/systems/demand-tracker.test.ts`
- `tests/domain/systems/price-memory.test.ts`
- `tests/domain/systems/economy.test.ts`
- `tests/domain/systems/monetary-policy.test.ts`
- `tests/domain/schemas/item-schema.test.ts`
- `tests/domain/schemas/economy-config.test.ts`
- `tests/integration/economy-flow.test.ts`

Modified files: 4
- `package.json` (new deps)
- `src/domain/schemas/game-config-schema.ts` (economy depth config)
- `src/domain/core/component-data.ts` (GoldFlow type, FacilityState.currentPrices)
- `src/domain/core/tick-scheduler.ts` (MONETARY_POLICY priority)
- `src/infrastructure/systems/trade-system.ts` (GoldFlowed emission)
- `src/domain/schemas/index.ts` (item-schema re-export)
