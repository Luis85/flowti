# Phase 2E: Economy & Social Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the economy work. Agents earn gold from facility jobs, buy food and rest with gold, and develop skills through work. Facilities produce goods when staffed and supplied. A world economy ledger tracks all transactions, with daily markdown reports written to the vault. Relationships form as agents interact economically.

**Architecture:** Pure domain functions (tested in isolation) wrapped in thin infrastructure GameSystem wrappers. FacilitySystem iterates facilities (not agents) for production. TradeSystem handles direct facility sales. FeedSystem switches from location-based to inventory-based consumption. EconomyComponent on world entity tracks all transactions. DayNightSystem writes daily reports and runs welfare checks.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), Zod (schema validation), Vitest, ESLint

**Design Spec:** `docs/specs/2026-03-29-phase2e-economy-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`facility.ts`, `trade.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` -> `tests/foo/bar.test.ts`
- **TDD:** Write failing test -> implement -> verify -> commit
- **ESLint:** `npx eslint src/ tests/ --config configs/eslint.config.mjs` -- 0 errors
- **TypeScript:** `npx tsc --noEmit --project configs/tsconfig.json` -- 0 errors
- **Full test:** `npx vitest run --config configs/vitest.config.ts` -- all tests pass
- **No magic numbers** in infrastructure/systems/ -- use named constants or config values
- **Spread-copy pattern** for all component state mutations (e.g. `comp.state = { ...comp.state, field: value }`)
- **Config-driven** -- use values from `GameConfigSchema`, never hardcoded numbers in infrastructure
- **Centralized event debug logging** via `eventBus.onAny()` already in place -- no per-system debug lines needed

---

## Chunk A: Schema + Config + Components + Data Types

Everything in this chunk is foundation -- all subsequent chunks depend on it.

### Task A1: Schema + Config Changes

**Files:**
- Modify: `src/domain/schemas/location-schema.ts`
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `src/domain/core/tick-scheduler.ts`
- Create: `src/domain/systems/food-items.ts`
- Modify: `src/domain/systems/bt-actions.ts`
- Modify: `src/infrastructure/systems/behavior-tree-system.ts`

- [ ] **Step 1: Add ProductionSchema to LocationSchema**

In `src/domain/schemas/location-schema.ts`, add the `ProductionSchema` and extend `LocationSchema`:

```typescript
// Add after LOCATION_TYPES
const ProductionOutputSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int(),
});

const ProductionInputSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int(),
});

export const ProductionSchema = z.object({
	job: z.string(),
	output: ProductionOutputSchema,
	input: ProductionInputSchema.nullable().default(null),
	wage: z.number().default(5),
	ticks_per_cycle: z.number().int().default(30),
}).nullable().default(null);
```

Add `production: ProductionSchema` as a new field on `LocationSchema`:

```typescript
export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	type: z.enum(LOCATION_TYPES),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#808080'),
	production: ProductionSchema,
});
```

Export `ProductionSchema` and `Production` type:

```typescript
export type Production = z.infer<typeof ProductionSchema>;
```

- [ ] **Step 2: Add economy config fields to EconomyConfigSchema**

In `src/domain/schemas/game-config-schema.ts`, add to `EconomyConfigSchema`:

```typescript
food_price: z.number().default(2),
rest_price: z.number().default(1),
facility_start_fund: z.number().default(200),
ledger_retention_days: z.number().int().default(7),
```

- [ ] **Step 3: Create FOOD_ITEMS constant**

Create `src/domain/systems/food-items.ts`:

```typescript
/** Consumable food items — only items agents can eat, not raw materials. */
export const FOOD_ITEMS = new Set(['bread']);
```

- [ ] **Step 4: Add new actions to KNOWN_ACTIONS**

In `src/domain/systems/bt-actions.ts`, add `'buy'` and `'seek_market'` to `KNOWN_ACTIONS`:

```typescript
export const KNOWN_ACTIONS = new Set([
	'idle',
	'seek_food',
	'seek_rest',
	'seek_social',
	'seek_work',
	'seek_market',
	'interact',
	'socialize',
	'eat',
	'rest',
	'talk',
	'work',
	'buy',
]);
```

- [ ] **Step 5: Add `seek_market` to LOCATION_ACTIONS**

In `src/infrastructure/systems/behavior-tree-system.ts`, add to `LOCATION_ACTIONS`:

```typescript
const LOCATION_ACTIONS: Record<string, string> = {
	seek_food: 'food',
	seek_rest: 'rest',
	seek_social: 'social',
	seek_work: 'work',
	seek_market: 'market',
};
```

- [ ] **Step 6: Add FACILITY alias to SystemPriority**

In `src/domain/core/tick-scheduler.ts`, add `FACILITY: 6,` as an alias for the `JOB` slot:

```typescript
export const SystemPriority = {
	TRAIT_RESOLVER: 0.5,
	DAY_NIGHT: 0.7,
	NEEDS_DECAY: 1,
	MOOD: 2,
	PERCEPTION: 3,
	MEMORY: 4,
	BEHAVIOR_TREE: 5,
	MOVEMENT: 5.5,
	JOB: 6,
	FACILITY: 6,
	REST: 6.5,
	FEED: 6.6,
	SOCIALIZE: 6.7,
	// ... rest unchanged
} as const;
```

- [ ] **Step 7: Run typecheck + lint**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/location-schema.ts" \
  "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" \
  "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts" \
  "01 - Projects/Project Meridian/src/domain/systems/food-items.ts" \
  "01 - Projects/Project Meridian/src/domain/systems/bt-actions.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts"
git commit -m "feat(meridian): Phase 2E schemas — ProductionSchema, economy config, food items, new actions"
```

---

### Task A2: Component Data Types + ECS Components

**Files:**
- Modify: `src/domain/core/component-data.ts`
- Create: `src/infrastructure/components/facility-component.ts`
- Create: `src/infrastructure/components/relationship-component.ts`
- Create: `src/infrastructure/components/economy-component.ts`
- Create: `src/infrastructure/components/wallet-component.ts`
- Create: `src/infrastructure/components/inventory-component.ts`

- [ ] **Step 1: Add data types to component-data.ts**

In `src/domain/core/component-data.ts`, add:

```typescript
export interface FacilityState {
	stock: { item_id: string; quantity: number }[];
	fund: number;
	workProgress: number;
	status: 'idle' | 'producing';
	workerId: string | null;
}

export interface RelationshipEntry {
	agentId: string;
	disposition: number;
	familiarity: number;
}

export interface RelationshipState {
	entries: RelationshipEntry[];
}

export interface LedgerEntry {
	tick: number;
	type: 'wage' | 'purchase' | 'tax' | 'consumption' | 'welfare';
	from: string;
	to: string;
	itemId: string | null;
	quantity: number;
	gold: number;
}

export interface DailySummary {
	totalWages: number;
	totalTax: number;
	totalSales: number;
	totalConsumption: number;
}

export interface EconomyState {
	treasury: number;
	ledger: LedgerEntry[];
	dailySummary: DailySummary;
}

export interface WalletState {
	gold: number;
}

export interface InventoryState {
	items: { item_id: string; quantity: number }[];
}
```

- [ ] **Step 2: Create FacilityComponent**

Create `src/infrastructure/components/facility-component.ts`:

```typescript
import type { FacilityState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class FacilityComponent extends TrackedComponent {
	constructor(public state: FacilityState) { super(); }
}
```

- [ ] **Step 3: Create RelationshipComponent**

Create `src/infrastructure/components/relationship-component.ts`:

```typescript
import type { RelationshipState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class RelationshipComponent extends TrackedComponent {
	constructor(public state: RelationshipState) { super(); }
}
```

- [ ] **Step 4: Create EconomyComponent**

Create `src/infrastructure/components/economy-component.ts`:

```typescript
import type { EconomyState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class EconomyComponent extends TrackedComponent {
	constructor(public state: EconomyState) { super(); }
}
```

- [ ] **Step 5: Create WalletComponent**

Create `src/infrastructure/components/wallet-component.ts`:

```typescript
import type { WalletState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class WalletComponent extends TrackedComponent {
	constructor(public state: WalletState) { super(); }
}
```

- [ ] **Step 6: Create InventoryComponent**

Create `src/infrastructure/components/inventory-component.ts`:

```typescript
import type { InventoryState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class InventoryComponent extends TrackedComponent {
	constructor(public state: InventoryState) { super(); }
}
```

- [ ] **Step 7: Run typecheck + lint**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/components/facility-component.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/components/relationship-component.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/components/economy-component.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/components/wallet-component.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/components/inventory-component.ts"
git commit -m "feat(meridian): Phase 2E components — Facility, Relationship, Economy, Wallet, Inventory"
```

---

### Task A3: AgentActor + GameCoreDeps Extensions

**Files:**
- Modify: `src/infrastructure/entity/agent-actor.ts`
- Modify: `src/domain/core/game-deps.ts`
- Modify: ALL test files with `createDeps()` helpers (13 files)

- [ ] **Step 1: Add `job` field and new components to AgentActor**

In `src/infrastructure/entity/agent-actor.ts`:

Add imports:

```typescript
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
```

Add after `readonly property: string[];`:

```typescript
readonly job: string | null;
```

In the constructor, after `this.property = [...agent.property];`:

```typescript
this.job = agent.job ?? null;
```

In the constructor, after the TraitsComponent line, add:

```typescript
this.addComponent(new WalletComponent({ gold: agent.wallet.gold }));
this.addComponent(new InventoryComponent({
	items: agent.inventory.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
}));
this.addComponent(new RelationshipComponent({ entries: [] }));
```

- [ ] **Step 2: Add `writeFile` to GameCoreDeps**

In `src/domain/core/game-deps.ts`:

```typescript
export interface GameCoreDeps {
	/** Hot-swappable — plugin.applySettings() replaces on settings change */
	logger: Logger;
	readonly eventBus: EventBus;
	readonly config: GameConfig;
	/** Hot-swappable — plugin.applySettings() replaces on settings change */
	performanceTracker: PerformanceTracker;
	/** Current tick number — set by the tick runner before system execution each tick */
	tickCount: number;
	/** Vault file writer — null in tests, real adapter in production */
	writeFile: ((path: string, content: string) => Promise<void>) | null;
}
```

- [ ] **Step 3: Update ALL createDeps() helpers to include `writeFile: null`**

Update ALL test files that have `createDeps()`. Grep for `createDeps` in `tests/` and add `writeFile: null` to each. The affected files are:

1. `tests/infrastructure/systems/rest-system.test.ts`
2. `tests/infrastructure/systems/feed-system.test.ts`
3. `tests/infrastructure/systems/socialize-system.test.ts`
4. `tests/infrastructure/systems/behavior-tree-system.test.ts`
5. `tests/infrastructure/systems/movement-system.test.ts`
6. `tests/infrastructure/systems/perception-system.test.ts`
7. `tests/infrastructure/systems/memory-decay-system.test.ts`
8. `tests/infrastructure/systems/needs-decay-system.test.ts`
9. `tests/infrastructure/systems/mood-system.test.ts`
10. `tests/infrastructure/systems/trait-resolver-system.test.ts`
11. `tests/integration/consequences-integration.test.ts`
12. `tests/integration/agency-integration.test.ts`
13. `tests/integration/life-systems-integration.test.ts`
14. `tests/integration/smoke-test.test.ts`

In each file, find `createDeps()` function and add `writeFile: null` to the returned object, e.g.:

```typescript
function createDeps(...): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}
```

- [ ] **Step 4: Update plugin.ts to include writeFile**

In `src/plugin.ts`, in `initializeGame()`, update the `gameDeps` construction to include `writeFile: null`. This will be updated to the real vault adapter in Task E2.

```typescript
this.gameDeps = {
	logger: this.logger,
	eventBus: this.batchableEventBus,
	config,
	performanceTracker: this.performanceTracker,
	tickCount: 0,
	writeFile: null,
};
```

- [ ] **Step 5: Run typecheck + lint + full tests**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts
```

Expected: 0 errors, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/agent-actor.ts" \
  "01 - Projects/Project Meridian/src/domain/core/game-deps.ts" \
  "01 - Projects/Project Meridian/src/plugin.ts" \
  "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): Phase 2E deps — AgentActor job/wallet/inventory, GameCoreDeps writeFile"
```

---

### Task A4: Data Validation Tests

**Files:**
- Create: `tests/integration/data-validation.test.ts`

- [ ] **Step 1: Write data validation tests**

```typescript
// tests/integration/data-validation.test.ts
import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { LocationSchema, ProductionSchema } from '../../src/domain/schemas/location-schema.js';

describe('Phase 2E data validation', () => {
	describe('GameConfigSchema economy additions', () => {
		it('parses with food_price default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.food_price).toBe(2);
		});

		it('parses with rest_price default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.rest_price).toBe(1);
		});

		it('parses with facility_start_fund default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.facility_start_fund).toBe(200);
		});

		it('parses with ledger_retention_days default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.ledger_retention_days).toBe(7);
		});

		it('retains existing economy fields', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.tax_rate).toBe(0.05);
			expect(config.economy.welfare_threshold_gold).toBe(10);
			expect(config.economy.welfare_reward_min).toBe(15);
		});
	});

	describe('ProductionSchema', () => {
		it('defaults to null when not specified', () => {
			const loc = LocationSchema.parse({
				id: 'loc-test',
				name: 'Test',
				type: 'rest',
				position: { x: 0, y: 0 },
			});
			expect(loc.production).toBeNull();
		});

		it('parses farm production', () => {
			const production = ProductionSchema.parse({
				job: 'farmer',
				output: { item_id: 'wheat', quantity: 1 },
				input: null,
				wage: 3,
				ticks_per_cycle: 30,
			});
			expect(production).not.toBeNull();
			expect(production?.job).toBe('farmer');
			expect(production?.output.item_id).toBe('wheat');
			expect(production?.input).toBeNull();
		});

		it('parses bakery production with input', () => {
			const production = ProductionSchema.parse({
				job: 'baker',
				output: { item_id: 'bread', quantity: 1 },
				input: { item_id: 'wheat', quantity: 1 },
				wage: 4,
				ticks_per_cycle: 20,
			});
			expect(production).not.toBeNull();
			expect(production?.input?.item_id).toBe('wheat');
		});

		it('applies wage default', () => {
			const production = ProductionSchema.parse({
				job: 'test',
				output: { item_id: 'item', quantity: 1 },
			});
			expect(production?.wage).toBe(5);
		});
	});

	describe('LocationSchema with production', () => {
		it('parses location with production block', () => {
			const loc = LocationSchema.parse({
				id: 'loc-farm',
				name: 'Farm',
				type: 'food',
				position: { x: 100, y: 100 },
				production: {
					job: 'farmer',
					output: { item_id: 'wheat', quantity: 1 },
					wage: 3,
					ticks_per_cycle: 30,
				},
			});
			expect(loc.production).not.toBeNull();
			expect(loc.production?.job).toBe('farmer');
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/data-validation.test.ts"
git commit -m "test(meridian): Phase 2E data validation — ProductionSchema, economy config"
```

---

## Chunk B: Pure Domain Functions (TDD)

All tasks in this chunk are independent of each other -- they can be done in any order or in parallel. Each produces a pure domain function with full tests.

### Task B1: applyFacilityTick -- Production Cycle Logic

**Files:**
- Create: `src/domain/systems/facility.ts`
- Create: `tests/domain/systems/facility.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/facility.test.ts
import { describe, it, expect } from 'vitest';
import { applyFacilityTick } from '../../../src/domain/systems/facility.js';

describe('applyFacilityTick', () => {
	const baseInput = {
		hasWorker: true,
		workerJob: 'farmer',
		facilityJob: 'farmer',
		workProgress: 0,
		ticksPerCycle: 30,
		hasRequiredInput: true,
		wage: 3,
		taxRate: 0.05,
		facilityFund: 200,
		workerGold: 50,
	};

	it('returns idle when no worker', () => {
		const result = applyFacilityTick({ ...baseInput, hasWorker: false });
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_worker');
		expect(result.cycleComplete).toBe(false);
		expect(result.newWorkProgress).toBe(0);
	});

	it('returns idle when missing required input', () => {
		const result = applyFacilityTick({ ...baseInput, hasRequiredInput: false });
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_input');
		expect(result.cycleComplete).toBe(false);
	});

	it('increments work progress when producing', () => {
		const result = applyFacilityTick({ ...baseInput, workProgress: 10 });
		expect(result.status).toBe('producing');
		expect(result.newWorkProgress).toBe(11);
		expect(result.cycleComplete).toBe(false);
		expect(result.idleReason).toBeNull();
	});

	it('completes cycle when workProgress reaches ticksPerCycle', () => {
		const result = applyFacilityTick({ ...baseInput, workProgress: 29 });
		expect(result.cycleComplete).toBe(true);
		expect(result.newWorkProgress).toBe(0);
		expect(result.produceOutput).toBe(true);
		expect(result.consumeInput).toBe(true);
	});

	it('calculates net wage and tax correctly', () => {
		const result = applyFacilityTick({ ...baseInput, workProgress: 29 });
		// wage=3, taxRate=0.05 => tax=0.15, netWage=2.85
		expect(result.taxCollected).toBeCloseTo(0.15);
		expect(result.workerGoldChange).toBeCloseTo(2.85);
		expect(result.facilityFundChange).toBe(-3);
	});

	it('pays partial wage when facility fund is insufficient', () => {
		const result = applyFacilityTick({
			...baseInput,
			workProgress: 29,
			facilityFund: 2,
		});
		expect(result.cycleComplete).toBe(true);
		// Can only pay 2 out of 3 wage
		expect(result.facilityFundChange).toBe(-2);
		expect(result.taxCollected).toBeCloseTo(0.1);
		expect(result.workerGoldChange).toBeCloseTo(1.9);
	});

	it('does not consume input when none required (null input)', () => {
		const result = applyFacilityTick({
			...baseInput,
			workProgress: 29,
			hasRequiredInput: true,
		});
		expect(result.consumeInput).toBe(true);
	});

	it('does not pay when facility fund is zero', () => {
		const result = applyFacilityTick({
			...baseInput,
			workProgress: 29,
			facilityFund: 0,
		});
		expect(result.cycleComplete).toBe(true);
		expect(result.facilityFundChange).toBe(0);
		expect(result.workerGoldChange).toBe(0);
		expect(result.taxCollected).toBe(0);
		expect(result.produceOutput).toBe(true);
	});

	it('starts at workProgress 0 for first tick', () => {
		const result = applyFacilityTick(baseInput);
		expect(result.newWorkProgress).toBe(1);
		expect(result.status).toBe('producing');
	});

	it('returns job mismatch as no_worker', () => {
		const result = applyFacilityTick({
			...baseInput,
			workerJob: 'baker',
			facilityJob: 'farmer',
		});
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_worker');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/facility.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement applyFacilityTick**

```typescript
// src/domain/systems/facility.ts

export interface FacilityTickInput {
	hasWorker: boolean;
	workerJob: string | null;
	facilityJob: string;
	workProgress: number;
	ticksPerCycle: number;
	hasRequiredInput: boolean;
	wage: number;
	taxRate: number;
	facilityFund: number;
	workerGold: number;
}

export interface FacilityTickResult {
	newWorkProgress: number;
	status: 'idle' | 'producing';
	cycleComplete: boolean;
	workerGoldChange: number;
	facilityFundChange: number;
	taxCollected: number;
	consumeInput: boolean;
	produceOutput: boolean;
	idleReason: 'no_worker' | 'no_input' | null;
}

const IDLE_RESULT: Omit<FacilityTickResult, 'idleReason'> = {
	newWorkProgress: 0,
	status: 'idle',
	cycleComplete: false,
	workerGoldChange: 0,
	facilityFundChange: 0,
	taxCollected: 0,
	consumeInput: false,
	produceOutput: false,
};

export function applyFacilityTick(input: FacilityTickInput): FacilityTickResult {
	// Check for valid worker
	if (!input.hasWorker || input.workerJob !== input.facilityJob) {
		return { ...IDLE_RESULT, idleReason: 'no_worker' };
	}

	// Check for required input materials
	if (!input.hasRequiredInput) {
		return { ...IDLE_RESULT, idleReason: 'no_input' };
	}

	// Increment progress
	const nextProgress = input.workProgress + 1;

	// Check if cycle completes
	if (nextProgress >= input.ticksPerCycle) {
		// Calculate payment
		const actualWage = Math.min(input.wage, input.facilityFund);
		const tax = actualWage * input.taxRate;
		const netWage = actualWage - tax;

		return {
			newWorkProgress: 0,
			status: 'producing',
			cycleComplete: true,
			workerGoldChange: netWage,
			facilityFundChange: -actualWage,
			taxCollected: tax,
			consumeInput: true,
			produceOutput: true,
			idleReason: null,
		};
	}

	return {
		newWorkProgress: nextProgress,
		status: 'producing',
		cycleComplete: false,
		workerGoldChange: 0,
		facilityFundChange: 0,
		taxCollected: 0,
		consumeInput: false,
		produceOutput: false,
		idleReason: null,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass** (10 tests)

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/facility.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Lint + commit**

```bash
cd "01 - Projects/Project Meridian" && npx eslint src/domain/systems/facility.ts tests/domain/systems/facility.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/facility.ts" "01 - Projects/Project Meridian/tests/domain/systems/facility.test.ts"
git commit -m "feat(meridian): applyFacilityTick pure function with TDD — production cycle logic"
```

---

### Task B2: applyTrade -- Buy/Sell Logic

**Files:**
- Create: `src/domain/systems/trade.ts`
- Create: `tests/domain/systems/trade.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/trade.test.ts
import { describe, it, expect } from 'vitest';
import { applyTrade } from '../../../src/domain/systems/trade.js';

describe('applyTrade', () => {
	const baseInput = {
		agentGold: 50,
		price: 2,
		facilityFund: 100,
		itemId: 'bread',
		quantity: 1,
	};

	it('succeeds when agent has enough gold', () => {
		const result = applyTrade(baseInput);
		expect(result.success).toBe(true);
		expect(result.agentGoldChange).toBe(-2);
		expect(result.facilityFundChange).toBe(2);
		expect(result.failReason).toBeNull();
	});

	it('fails when agent has no gold', () => {
		const result = applyTrade({ ...baseInput, agentGold: 0 });
		expect(result.success).toBe(false);
		expect(result.failReason).toBe('no_gold');
		expect(result.agentGoldChange).toBe(0);
		expect(result.facilityFundChange).toBe(0);
	});

	it('fails when agent has insufficient gold', () => {
		const result = applyTrade({ ...baseInput, agentGold: 1, price: 2 });
		expect(result.success).toBe(false);
		expect(result.failReason).toBe('no_gold');
	});

	it('handles exact gold match', () => {
		const result = applyTrade({ ...baseInput, agentGold: 2, price: 2 });
		expect(result.success).toBe(true);
		expect(result.agentGoldChange).toBe(-2);
	});

	it('deducts correct amount for higher prices', () => {
		const result = applyTrade({ ...baseInput, price: 10 });
		expect(result.success).toBe(true);
		expect(result.agentGoldChange).toBe(-10);
		expect(result.facilityFundChange).toBe(10);
	});
});
```

- [ ] **Step 2: Implement applyTrade**

```typescript
// src/domain/systems/trade.ts

export interface TradeInput {
	agentGold: number;
	price: number;
	facilityFund: number;
	itemId: string;
	quantity: number;
}

export interface TradeResult {
	success: boolean;
	agentGoldChange: number;
	facilityFundChange: number;
	failReason: 'no_gold' | 'no_stock' | null;
}

export function applyTrade(input: TradeInput): TradeResult {
	if (input.agentGold < input.price) {
		return {
			success: false,
			agentGoldChange: 0,
			facilityFundChange: 0,
			failReason: 'no_gold',
		};
	}

	return {
		success: true,
		agentGoldChange: -input.price,
		facilityFundChange: input.price,
		failReason: null,
	};
}
```

- [ ] **Step 3: Run tests** (5 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/trade.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/trade.ts tests/domain/systems/trade.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/trade.ts" "01 - Projects/Project Meridian/tests/domain/systems/trade.test.ts"
git commit -m "feat(meridian): applyTrade pure function with TDD — buy/sell logic"
```

---

### Task B3: applySkillProgression -- Skill-by-Use

**Files:**
- Create: `src/domain/systems/skill-progression.ts`
- Create: `tests/domain/systems/skill-progression.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/skill-progression.test.ts
import { describe, it, expect } from 'vitest';
import { applySkillProgression } from '../../../src/domain/systems/skill-progression.js';

describe('applySkillProgression', () => {
	const defaultThresholds = [10, 25, 50, 100, 200];
	const maxUseBonus = 3;

	it('increments points and use count', () => {
		const result = applySkillProgression({
			points: 5,
			useCount: 3,
			useBonus: 0,
			thresholds: defaultThresholds,
			maxUseBonus,
		});
		expect(result.newPoints).toBe(6);
		expect(result.newUseCount).toBe(4);
		expect(result.newUseBonus).toBe(0);
		expect(result.improved).toBe(false);
	});

	it('improves use_bonus when crossing first threshold', () => {
		const result = applySkillProgression({
			points: 9,
			useCount: 9,
			useBonus: 0,
			thresholds: defaultThresholds,
			maxUseBonus,
		});
		expect(result.newUseCount).toBe(10);
		expect(result.newUseBonus).toBe(1);
		expect(result.improved).toBe(true);
	});

	it('improves use_bonus when crossing second threshold', () => {
		const result = applySkillProgression({
			points: 24,
			useCount: 24,
			useBonus: 1,
			thresholds: defaultThresholds,
			maxUseBonus,
		});
		expect(result.newUseCount).toBe(25);
		expect(result.newUseBonus).toBe(2);
		expect(result.improved).toBe(true);
	});

	it('caps use_bonus at maxUseBonus', () => {
		const result = applySkillProgression({
			points: 99,
			useCount: 99,
			useBonus: 3,
			thresholds: defaultThresholds,
			maxUseBonus,
		});
		expect(result.newUseBonus).toBe(3);
		expect(result.improved).toBe(false);
	});

	it('does not improve between thresholds', () => {
		const result = applySkillProgression({
			points: 14,
			useCount: 14,
			useBonus: 1,
			thresholds: defaultThresholds,
			maxUseBonus,
		});
		expect(result.newUseBonus).toBe(1);
		expect(result.improved).toBe(false);
	});

	it('handles starting from zero', () => {
		const result = applySkillProgression({
			points: 0,
			useCount: 0,
			useBonus: 0,
			thresholds: defaultThresholds,
			maxUseBonus,
		});
		expect(result.newPoints).toBe(1);
		expect(result.newUseCount).toBe(1);
		expect(result.improved).toBe(false);
	});
});
```

- [ ] **Step 2: Implement applySkillProgression**

```typescript
// src/domain/systems/skill-progression.ts

export interface SkillProgressionInput {
	points: number;
	useCount: number;
	useBonus: number;
	thresholds: number[];
	maxUseBonus: number;
}

export interface SkillProgressionResult {
	newPoints: number;
	newUseCount: number;
	newUseBonus: number;
	improved: boolean;
}

export function applySkillProgression(input: SkillProgressionInput): SkillProgressionResult {
	const newPoints = input.points + 1;
	const newUseCount = input.useCount + 1;

	// Calculate how many thresholds the new count has crossed
	let bonus = 0;
	for (const threshold of input.thresholds) {
		if (newUseCount >= threshold) {
			bonus++;
		}
	}

	const newUseBonus = Math.min(bonus, input.maxUseBonus);
	const improved = newUseBonus > input.useBonus;

	return { newPoints, newUseCount, newUseBonus, improved };
}
```

- [ ] **Step 3: Run tests** (6 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/skill-progression.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/skill-progression.ts tests/domain/systems/skill-progression.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/skill-progression.ts" "01 - Projects/Project Meridian/tests/domain/systems/skill-progression.test.ts"
git commit -m "feat(meridian): applySkillProgression pure function with TDD — skill-by-use"
```

---

### Task B4: applyRelationshipUpdate -- Disposition/Familiarity

**Files:**
- Create: `src/domain/systems/relationship.ts`
- Create: `tests/domain/systems/relationship.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/relationship.test.ts
import { describe, it, expect } from 'vitest';
import { applyRelationshipUpdate } from '../../../src/domain/systems/relationship.js';

describe('applyRelationshipUpdate', () => {
	it('increases disposition and familiarity', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 0,
			currentFamiliarity: 0,
			dispositionChange: 1,
			familiarityChange: 1,
		});
		expect(result.newDisposition).toBe(1);
		expect(result.newFamiliarity).toBe(1);
	});

	it('clamps disposition to +100', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 99,
			currentFamiliarity: 0,
			dispositionChange: 5,
			familiarityChange: 0,
		});
		expect(result.newDisposition).toBe(100);
	});

	it('clamps disposition to -100', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: -98,
			currentFamiliarity: 0,
			dispositionChange: -5,
			familiarityChange: 0,
		});
		expect(result.newDisposition).toBe(-100);
	});

	it('clamps familiarity at 0 minimum', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 0,
			currentFamiliarity: 1,
			dispositionChange: 0,
			familiarityChange: -5,
		});
		expect(result.newFamiliarity).toBe(0);
	});

	it('handles fractional changes', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 0,
			currentFamiliarity: 0,
			dispositionChange: 0.5,
			familiarityChange: 0.5,
		});
		expect(result.newDisposition).toBe(0.5);
		expect(result.newFamiliarity).toBe(0.5);
	});

	it('handles zero changes', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 10,
			currentFamiliarity: 5,
			dispositionChange: 0,
			familiarityChange: 0.5,
		});
		expect(result.newDisposition).toBe(10);
		expect(result.newFamiliarity).toBe(5.5);
	});
});
```

- [ ] **Step 2: Implement applyRelationshipUpdate**

```typescript
// src/domain/systems/relationship.ts
import { clamp } from '../core/math-utils.js';

export interface RelationshipUpdateInput {
	currentDisposition: number;
	currentFamiliarity: number;
	dispositionChange: number;
	familiarityChange: number;
}

export interface RelationshipUpdateResult {
	newDisposition: number;
	newFamiliarity: number;
}

export function applyRelationshipUpdate(input: RelationshipUpdateInput): RelationshipUpdateResult {
	return {
		newDisposition: clamp(input.currentDisposition + input.dispositionChange, -100, 100),
		newFamiliarity: Math.max(0, input.currentFamiliarity + input.familiarityChange),
	};
}
```

- [ ] **Step 3: Run tests** (6 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/relationship.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/relationship.ts tests/domain/systems/relationship.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/relationship.ts" "01 - Projects/Project Meridian/tests/domain/systems/relationship.test.ts"
git commit -m "feat(meridian): applyRelationshipUpdate pure function with TDD — disposition + familiarity"
```

---

### Task B5: generateDailyReport -- Markdown Report

**Files:**
- Create: `src/domain/systems/daily-report.ts`
- Create: `tests/domain/systems/daily-report.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/daily-report.test.ts
import { describe, it, expect } from 'vitest';
import { generateDailyReport } from '../../../src/domain/systems/daily-report.js';
import type { LedgerEntry, DailySummary } from '../../../src/domain/core/component-data.js';

describe('generateDailyReport', () => {
	const baseSummary: DailySummary = {
		totalWages: 45,
		totalTax: 5,
		totalSales: 12,
		totalConsumption: 8,
	};

	const baseLedger: LedgerEntry[] = [
		{ tick: 100, type: 'wage', from: 'loc-farm', to: 'agent-marcus', itemId: null, quantity: 0, gold: 3 },
		{ tick: 120, type: 'purchase', from: 'agent-marcus', to: 'loc-bakery', itemId: 'bread', quantity: 1, gold: 2 },
	];

	const baseInput = {
		dayCount: 1,
		summary: baseSummary,
		treasury: 55,
		facilities: [
			{ name: 'Hillside Farm', produced: [{ item: 'wheat', qty: 2 }], workerName: 'Marcus', status: 'producing' },
			{ name: 'Hearthstone Bakery', produced: [{ item: 'bread', qty: 1 }], workerName: 'Wren', status: 'producing' },
		],
		transactions: baseLedger,
		agents: [
			{ name: 'Marcus', gold: 38, goldChange: 1 },
			{ name: 'Wren', gold: 80, goldChange: 0 },
		],
	};

	it('generates frontmatter with Dataview-queryable fields', () => {
		const result = generateDailyReport(baseInput);
		expect(result.frontmatter).toContain('day: 1');
		expect(result.frontmatter).toContain('total_wages: 45');
		expect(result.frontmatter).toContain('total_tax: 5');
		expect(result.frontmatter).toContain('total_sales: 12');
		expect(result.frontmatter).toContain('total_consumption: 8');
		expect(result.frontmatter).toContain('treasury_balance: 55');
	});

	it('generates body with Production section', () => {
		const result = generateDailyReport(baseInput);
		expect(result.body).toContain('## Production');
		expect(result.body).toContain('Hillside Farm');
		expect(result.body).toContain('Marcus');
	});

	it('generates body with Transactions section', () => {
		const result = generateDailyReport(baseInput);
		expect(result.body).toContain('## Transactions');
		expect(result.body).toContain('wage');
		expect(result.body).toContain('purchase');
	});

	it('generates body with Agent Balances section', () => {
		const result = generateDailyReport(baseInput);
		expect(result.body).toContain('## Agent Balances');
		expect(result.body).toContain('Marcus');
		expect(result.body).toContain('38');
	});

	it('wraps frontmatter in YAML delimiters', () => {
		const result = generateDailyReport(baseInput);
		expect(result.frontmatter.startsWith('---\n')).toBe(true);
		expect(result.frontmatter.endsWith('\n---')).toBe(true);
	});

	it('includes facility count in frontmatter', () => {
		const result = generateDailyReport(baseInput);
		expect(result.frontmatter).toContain('active_facilities: 2');
	});

	it('handles empty transactions', () => {
		const result = generateDailyReport({ ...baseInput, transactions: [] });
		expect(result.body).toContain('## Transactions');
		expect(result.body).toContain('No transactions');
	});
});
```

- [ ] **Step 2: Implement generateDailyReport**

```typescript
// src/domain/systems/daily-report.ts
import type { LedgerEntry, DailySummary } from '../core/component-data.js';

export interface DailyReportInput {
	dayCount: number;
	summary: DailySummary;
	treasury: number;
	facilities: {
		name: string;
		produced: { item: string; qty: number }[];
		workerName: string | null;
		status: string;
	}[];
	transactions: LedgerEntry[];
	agents: { name: string; gold: number; goldChange: number }[];
}

export interface DailyReportOutput {
	frontmatter: string;
	body: string;
}

export function generateDailyReport(input: DailyReportInput): DailyReportOutput {
	const activeFacilities = input.facilities.filter(f => f.status === 'producing').length;
	const idleFacilities = input.facilities.length - activeFacilities;
	const itemsProduced = input.facilities.reduce((sum, f) => sum + f.produced.reduce((s, p) => s + p.qty, 0), 0);
	const itemsConsumed = input.transactions.filter(t => t.type === 'consumption').reduce((sum, t) => sum + t.quantity, 0);

	const frontmatter = [
		'---',
		`day: ${String(input.dayCount)}`,
		`total_wages: ${String(input.summary.totalWages)}`,
		`total_tax: ${String(input.summary.totalTax)}`,
		`total_sales: ${String(input.summary.totalSales)}`,
		`total_consumption: ${String(input.summary.totalConsumption)}`,
		`treasury_balance: ${String(input.treasury)}`,
		`active_facilities: ${String(activeFacilities)}`,
		`idle_facilities: ${String(idleFacilities)}`,
		`items_produced: ${String(itemsProduced)}`,
		`items_consumed: ${String(itemsConsumed)}`,
		'---',
	].join('\n');

	const productionRows = input.facilities.map(f => {
		const produced = f.produced.map(p => `${String(p.qty)}x ${p.item}`).join(', ') || 'none';
		return `| ${f.name} | ${f.workerName ?? 'none'} | ${produced} | ${f.status} |`;
	}).join('\n');

	const transactionRows = input.transactions.length > 0
		? input.transactions.map(t =>
			`| ${String(t.tick)} | ${t.type} | ${t.from} | ${t.to} | ${t.itemId ?? '-'} | ${String(t.gold)} |`,
		).join('\n')
		: 'No transactions this day.';

	const agentRows = input.agents.map(a => {
		const changeStr = a.goldChange >= 0 ? `+${String(a.goldChange)}` : String(a.goldChange);
		return `| ${a.name} | ${String(a.gold)} | ${changeStr} |`;
	}).join('\n');

	const body = [
		`# Day ${String(input.dayCount)} Economy Report`,
		'',
		'## Production',
		'| Facility | Worker | Items Produced | Status |',
		'|----------|--------|----------------|--------|',
		productionRows,
		'',
		'## Transactions',
		input.transactions.length > 0
			? [
				'| Tick | Type | From | To | Item | Gold |',
				'|------|------|------|----|------|------|',
				transactionRows,
			].join('\n')
			: 'No transactions this day.',
		'',
		'## Agent Balances',
		'| Agent | Gold | Change |',
		'|-------|------|--------|',
		agentRows,
	].join('\n');

	return { frontmatter, body };
}
```

- [ ] **Step 3: Run tests** (7 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/daily-report.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/daily-report.ts tests/domain/systems/daily-report.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/daily-report.ts" "01 - Projects/Project Meridian/tests/domain/systems/daily-report.test.ts"
git commit -m "feat(meridian): generateDailyReport pure function with TDD — markdown economy report"
```

---

### Task B6: FOOD_ITEMS + Inventory Helpers

**Files:**
- Modify: `src/domain/systems/food-items.ts` (already created in A1 -- extend it)
- Create: `tests/domain/systems/food-items.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/food-items.test.ts
import { describe, it, expect } from 'vitest';
import { FOOD_ITEMS, findFoodInInventory, removeFromInventory } from '../../../src/domain/systems/food-items.js';

describe('FOOD_ITEMS', () => {
	it('contains bread', () => {
		expect(FOOD_ITEMS.has('bread')).toBe(true);
	});

	it('does not contain raw materials', () => {
		expect(FOOD_ITEMS.has('wheat')).toBe(false);
		expect(FOOD_ITEMS.has('leather-goods')).toBe(false);
	});
});

describe('findFoodInInventory', () => {
	it('finds bread in inventory', () => {
		const inventory = [
			{ item_id: 'torch', quantity: 1 },
			{ item_id: 'bread', quantity: 3 },
		];
		const result = findFoodInInventory(inventory);
		expect(result).not.toBeNull();
		expect(result?.item_id).toBe('bread');
	});

	it('returns null when no food items', () => {
		const inventory = [
			{ item_id: 'torch', quantity: 1 },
			{ item_id: 'wheat', quantity: 5 },
		];
		const result = findFoodInInventory(inventory);
		expect(result).toBeNull();
	});

	it('returns null for empty inventory', () => {
		const result = findFoodInInventory([]);
		expect(result).toBeNull();
	});
});

describe('removeFromInventory', () => {
	it('decrements item quantity', () => {
		const inventory = [
			{ item_id: 'bread', quantity: 3 },
			{ item_id: 'torch', quantity: 1 },
		];
		const result = removeFromInventory(inventory, 'bread', 1);
		expect(result).toHaveLength(2);
		const bread = result.find(i => i.item_id === 'bread');
		expect(bread?.quantity).toBe(2);
	});

	it('removes item entirely when quantity reaches zero', () => {
		const inventory = [
			{ item_id: 'bread', quantity: 1 },
			{ item_id: 'torch', quantity: 1 },
		];
		const result = removeFromInventory(inventory, 'bread', 1);
		expect(result).toHaveLength(1);
		expect(result[0].item_id).toBe('torch');
	});

	it('returns unchanged copy when item not found', () => {
		const inventory = [{ item_id: 'torch', quantity: 1 }];
		const result = removeFromInventory(inventory, 'bread', 1);
		expect(result).toHaveLength(1);
		expect(result[0].item_id).toBe('torch');
	});

	it('does not mutate original array', () => {
		const inventory = [{ item_id: 'bread', quantity: 3 }];
		const original = [...inventory.map(i => ({ ...i }))];
		removeFromInventory(inventory, 'bread', 1);
		expect(inventory[0].quantity).toBe(original[0].quantity);
	});
});
```

- [ ] **Step 2: Implement inventory helpers**

Update `src/domain/systems/food-items.ts`:

```typescript
/** Consumable food items — only items agents can eat, not raw materials. */
export const FOOD_ITEMS = new Set(['bread']);

export interface InventoryItem {
	item_id: string;
	quantity: number;
}

/** Find the first food item in the given inventory. */
export function findFoodInInventory(inventory: InventoryItem[]): InventoryItem | null {
	for (const item of inventory) {
		if (FOOD_ITEMS.has(item.item_id)) {
			return item;
		}
	}
	return null;
}

/** Return a new inventory array with the specified item decremented (or removed if qty reaches 0). */
export function removeFromInventory(
	inventory: InventoryItem[],
	itemId: string,
	amount: number,
): InventoryItem[] {
	return inventory
		.map(item => {
			if (item.item_id !== itemId) return { ...item };
			const newQty = item.quantity - amount;
			return newQty > 0 ? { ...item, quantity: newQty } : null;
		})
		.filter((item): item is InventoryItem => item !== null);
}
```

- [ ] **Step 3: Run tests** (10 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/food-items.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/food-items.ts tests/domain/systems/food-items.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/food-items.ts" "01 - Projects/Project Meridian/tests/domain/systems/food-items.test.ts"
git commit -m "feat(meridian): food items + inventory helpers with TDD — findFood, removeFromInventory"
```

---

## Chunk C: BT Conditions + Game Data Updates

Depends on Chunk A (schemas, components). Independent of Chunk B (pure functions).

### Task C1: New BT Conditions + BTContext Extensions

**Files:**
- Modify: `src/domain/systems/behavior-tree.ts`
- Create: `tests/domain/systems/bt-conditions.test.ts`

- [ ] **Step 1: Extend BTContext interface**

In `src/domain/systems/behavior-tree.ts`, update `BTContext`:

```typescript
export interface BTContext {
	needs: NeedsState;
	mood: MoodState;
	perception: PerceptionState;
	timePhase: string;
	rng: GameRNG;
	interactionRadius: number;
	wallet: number;
	inventory: { item_id: string; quantity: number }[];
	job: string | null;
	nearbyFacilities: {
		id: string;
		job: string;
		stock: { item_id: string; quantity: number }[];
	}[];
}
```

- [ ] **Step 2: Add new CONDITION_CHECKS**

In `src/domain/systems/behavior-tree.ts`, add to `CONDITION_CHECKS`:

```typescript
has_gold(ctx, params) {
	const amount = params.amount as number;
	return ctx.wallet >= amount;
},
has_item(ctx, params) {
	const itemId = params.itemId as string;
	return ctx.inventory.some(i => i.item_id === itemId && i.quantity > 0);
},
can_afford(ctx, params) {
	const price = params.price as number;
	// Check if any nearby facility has stock AND agent has enough gold
	const hasStock = ctx.nearbyFacilities.some(f => f.stock.length > 0);
	return hasStock && ctx.wallet >= price;
},
facility_has_stock(ctx, params) {
	const itemId = params.itemId as string;
	return ctx.nearbyFacilities.some(f =>
		f.stock.some(s => s.item_id === itemId && s.quantity > 0),
	);
},
has_job_facility(ctx) {
	if (ctx.job === null) return false;
	return ctx.nearbyFacilities.some(f => f.job === ctx.job);
},
```

- [ ] **Step 3: Write tests for new conditions**

```typescript
// tests/domain/systems/bt-conditions.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateBT, type BTContext, type BTNode } from '../../../src/domain/systems/behavior-tree.js';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

function createBaseContext(overrides: Partial<BTContext> = {}): BTContext {
	return {
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: { value: 0, bucket: 'stressed' },
		perception: { nearbyAgents: [], nearbyLocations: [] },
		timePhase: 'day',
		rng: createGameRNG(42),
		interactionRadius: 25,
		wallet: 50,
		inventory: [],
		job: null,
		nearbyFacilities: [],
		...overrides,
	};
}

describe('BT economy conditions', () => {
	describe('has_gold', () => {
		const bt: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'has_gold', params: { amount: 10 } },
				{ type: 'action', action: 'buy', params: {} },
			],
		};

		it('succeeds when wallet >= amount', () => {
			const ctx = createBaseContext({ wallet: 50 });
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('buy');
		});

		it('fails when wallet < amount', () => {
			const ctx = createBaseContext({ wallet: 5 });
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('has_item', () => {
		const bt: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'has_item', params: { itemId: 'bread' } },
				{ type: 'action', action: 'eat', params: {} },
			],
		};

		it('succeeds when item in inventory', () => {
			const ctx = createBaseContext({
				inventory: [{ item_id: 'bread', quantity: 2 }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('eat');
		});

		it('fails when item not in inventory', () => {
			const ctx = createBaseContext({ inventory: [] });
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('can_afford', () => {
		const bt: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'can_afford', params: { price: 2 } },
				{ type: 'action', action: 'buy', params: {} },
			],
		};

		it('succeeds when has gold and facility has stock', () => {
			const ctx = createBaseContext({
				wallet: 10,
				nearbyFacilities: [{ id: 'loc-bakery', job: 'baker', stock: [{ item_id: 'bread', quantity: 3 }] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('success');
		});

		it('fails when no nearby facilities have stock', () => {
			const ctx = createBaseContext({
				wallet: 10,
				nearbyFacilities: [{ id: 'loc-bakery', job: 'baker', stock: [] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});

		it('fails when not enough gold', () => {
			const ctx = createBaseContext({
				wallet: 1,
				nearbyFacilities: [{ id: 'loc-bakery', job: 'baker', stock: [{ item_id: 'bread', quantity: 1 }] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('facility_has_stock', () => {
		const bt: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'facility_has_stock', params: { itemId: 'bread' } },
				{ type: 'action', action: 'buy', params: {} },
			],
		};

		it('succeeds when facility has the item', () => {
			const ctx = createBaseContext({
				nearbyFacilities: [{ id: 'loc-bakery', job: 'baker', stock: [{ item_id: 'bread', quantity: 1 }] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('success');
		});

		it('fails when no facility has the item', () => {
			const ctx = createBaseContext({
				nearbyFacilities: [{ id: 'loc-farm', job: 'farmer', stock: [{ item_id: 'wheat', quantity: 5 }] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('has_job_facility', () => {
		const bt: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'has_job_facility', params: {} },
				{ type: 'action', action: 'work', params: {} },
			],
		};

		it('succeeds when agent job matches nearby facility', () => {
			const ctx = createBaseContext({
				job: 'farmer',
				nearbyFacilities: [{ id: 'loc-farm', job: 'farmer', stock: [] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('success');
		});

		it('fails when agent has no job', () => {
			const ctx = createBaseContext({
				job: null,
				nearbyFacilities: [{ id: 'loc-farm', job: 'farmer', stock: [] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});

		it('fails when no matching facility', () => {
			const ctx = createBaseContext({
				job: 'baker',
				nearbyFacilities: [{ id: 'loc-farm', job: 'farmer', stock: [] }],
			});
			const result = evaluateBT(bt, ctx);
			expect(result.status).toBe('failure');
		});
	});
});
```

- [ ] **Step 4: Update ALL existing BT tests + callers to include new BTContext fields**

Search for `evaluateBT(` calls and `BTContext` constructions in tests. Each must include:

```typescript
wallet: 50,
inventory: [],
job: null,
nearbyFacilities: [],
```

The affected file is `tests/infrastructure/systems/behavior-tree-system.test.ts`. The system builds the context internally, so the test fixtures for agents do not need BTContext changes, but the `createBehaviorTreeSystem` call in the test may need updating -- check if the system now passes the new fields. If the system constructs the context, then the system itself needs updating (Task C1 step 5 below).

- [ ] **Step 5: Update BehaviorTreeSystem to populate new BTContext fields**

In `src/infrastructure/systems/behavior-tree-system.ts`, the system constructs `BTContext` when calling `evaluateBT()`. Update the context construction:

Add imports:

```typescript
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { distance } from '../../domain/core/math-utils.js';
```

Update `createBehaviorTreeSystem` signature to accept `getLocationActors`:

```typescript
export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
	btDefinitions: Record<string, BTNode>,
	worldEntity: () => Actor,
	baseSeed: number,
	getLocationActors?: () => Map<string, Actor>,
	getLocations?: () => WorldLocation[],
): GameSystem {
```

In the `execute` method, before the agent loop, resolve location actors:

```typescript
const locationActorMap = getLocationActors?.() ?? new Map<string, Actor>();
const locationList = getLocations?.() ?? [];
```

In the context construction, add the new fields:

```typescript
const wallet = agent.get(WalletComponent);
const inv = agent.get(InventoryComponent);

// Resolve nearby facilities
const nearbyFacilities: BTContext['nearbyFacilities'] = [];
for (const loc of locationList) {
	if (loc.production === null) continue;
	const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
	if (dist > deps.config.perception.interaction_radius) continue;
	const locActor = locationActorMap.get(loc.id);
	if (locActor === undefined) continue;
	const facility = locActor.get(FacilityComponent);
	nearbyFacilities.push({
		id: loc.id,
		job: loc.production.job,
		stock: [...facility.state.stock],
	});
}

const result = evaluateBT(bt, {
	needs: needs.state,
	mood: mood.state,
	perception: perception.state,
	timePhase,
	rng,
	interactionRadius: deps.config.perception.interaction_radius,
	wallet: wallet.state.gold,
	inventory: [...inv.state.items],
	job: agent.job,
	nearbyFacilities,
});
```

**Note:** The `FacilityComponent` import in infrastructure is allowed -- infrastructure CAN import other infrastructure components. The `distance` import from `domain/core/math-utils.js` is also allowed (domain core utilities).

- [ ] **Step 6: Run tests + lint**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-tree.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts" \
  "01 - Projects/Project Meridian/tests/domain/systems/bt-conditions.test.ts" \
  "01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts"
git commit -m "feat(meridian): Phase 2E BT conditions — has_gold, has_item, can_afford, facility_has_stock, has_job_facility"
```

---

### Task C2: BT JSON Updates -- All 4 BTs with Economy Branches

**Files:**
- Modify: `behavior-trees/bt-merchant.json`
- Modify: `behavior-trees/bt-guard.json`
- Modify: `behavior-trees/bt-scholar.json`
- Modify: `behavior-trees/bt-artisan.json`

The updated BTs add economy conditions: eat from inventory, buy food when hungry, seek market, daytime-only work guard, and job facility awareness.

- [ ] **Step 1: Update bt-merchant.json (Elena -- no production match, idles/socializes)**

Elena is a merchant with no production facility. Her BT has economy branches for buying and eating from inventory, but no work-at-facility branches.

```json
{
	"id": "bt-merchant",
	"root": {
		"type": "selector",
		"children": [
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_critical", "params": { "need": "energy" } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_critical", "params": { "need": "energy" } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "seek_rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "has_item", "params": { "itemId": "bread" } },
					{ "type": "action", "action": "eat", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "can_afford", "params": { "price": 2 } },
					{ "type": "action", "action": "buy", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "has_gold", "params": { "amount": 2 } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "food" } },
					{ "type": "action", "action": "seek_food", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "social", "threshold": 40 } },
					{ "type": "condition", "check": "nearby_agent_close", "params": {} },
					{ "type": "action", "action": "talk", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "social", "threshold": 40 } },
					{ "type": "condition", "check": "nearby_agent", "params": {} },
					{ "type": "action", "action": "socialize", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "market" } },
					{ "type": "action", "action": "seek_market", "params": {} }
				]
			},
			{ "type": "action", "action": "idle", "params": {} }
		]
	}
}
```

- [ ] **Step 2: Update bt-guard.json (Marcus -- reassigned to farmer)**

Marcus is reassigned from guard to farmer. His BT adds economy branches and daytime-only work guard.

```json
{
	"id": "bt-guard",
	"root": {
		"type": "selector",
		"children": [
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_critical", "params": { "need": "energy" } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_critical", "params": { "need": "energy" } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "seek_rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 30 } },
					{ "type": "condition", "check": "has_item", "params": { "itemId": "bread" } },
					{ "type": "action", "action": "eat", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 30 } },
					{ "type": "condition", "check": "can_afford", "params": { "price": 2 } },
					{ "type": "action", "action": "buy", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 30 } },
					{ "type": "condition", "check": "has_gold", "params": { "amount": 2 } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "food" } },
					{ "type": "action", "action": "seek_food", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 30 } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "seek_work", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "food" } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "work", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "seek_work", "params": {} }
				]
			},
			{ "type": "action", "action": "idle", "params": {} }
		]
	}
}
```

- [ ] **Step 3: Update bt-scholar.json (Wren -- reassigned to baker)**

Wren is reassigned from scholar to baker. Her BT adds economy branches and daytime-only work guard.

```json
{
	"id": "bt-scholar",
	"root": {
		"type": "selector",
		"children": [
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "energy", "threshold": 40 } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "energy", "threshold": 40 } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "seek_rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "has_item", "params": { "itemId": "bread" } },
					{ "type": "action", "action": "eat", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "can_afford", "params": { "price": 2 } },
					{ "type": "action", "action": "buy", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "has_gold", "params": { "amount": 2 } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "food" } },
					{ "type": "action", "action": "seek_food", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 50 } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "seek_work", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "social", "threshold": 30 } },
					{ "type": "condition", "check": "nearby_agent_close", "params": {} },
					{ "type": "action", "action": "talk", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "social", "threshold": 30 } },
					{ "type": "condition", "check": "nearby_agent", "params": {} },
					{ "type": "action", "action": "socialize", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "food" } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "work", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "seek_work", "params": {} }
				]
			},
			{ "type": "action", "action": "idle", "params": {} }
		]
	}
}
```

- [ ] **Step 4: Update bt-artisan.json (Sable -- leatherworker, unchanged job)**

Sable's job stays leatherworker. BT gets economy branches.

```json
{
	"id": "bt-artisan",
	"root": {
		"type": "selector",
		"children": [
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 45 } },
					{ "type": "condition", "check": "has_item", "params": { "itemId": "bread" } },
					{ "type": "action", "action": "eat", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 45 } },
					{ "type": "condition", "check": "can_afford", "params": { "price": 2 } },
					{ "type": "action", "action": "buy", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 45 } },
					{ "type": "condition", "check": "has_gold", "params": { "amount": 2 } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "food" } },
					{ "type": "action", "action": "seek_food", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "hunger", "threshold": 45 } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "seek_work", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_critical", "params": { "need": "energy" } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_critical", "params": { "need": "energy" } },
					{ "type": "condition", "check": "nearby_location", "params": { "locationType": "rest" } },
					{ "type": "action", "action": "seek_rest", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "social", "threshold": 35 } },
					{ "type": "condition", "check": "nearby_agent_close", "params": {} },
					{ "type": "action", "action": "talk", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "need_below", "params": { "need": "social", "threshold": 35 } },
					{ "type": "condition", "check": "nearby_agent", "params": {} },
					{ "type": "action", "action": "socialize", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "at_location", "params": { "locationType": "work" } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "work", "params": {} }
				]
			},
			{
				"type": "sequence",
				"children": [
					{ "type": "condition", "check": "time_is", "params": { "phase": "day" } },
					{ "type": "condition", "check": "has_job_facility", "params": {} },
					{ "type": "action", "action": "seek_work", "params": {} }
				]
			},
			{ "type": "action", "action": "idle", "params": {} }
		]
	}
}
```

- [ ] **Step 5: Commit BT JSON updates**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/"
git commit -m "feat(meridian): Phase 2E BT updates — economy branches for all 4 agents"
```

---

### Task C3: Agent + Location Data Updates

**Files:**
- Modify: `agents/marcus.json`
- Modify: `agents/wren.json`
- Modify: `locations/farm.json`
- Modify: `locations/bakery.json`
- Modify: `locations/workshop.json`

- [ ] **Step 1: Reassign Marcus to farmer**

In `agents/marcus.json`, change:
- `"job": "gate-guard"` -> `"job": "farmer"`
- `"behavior_tree": "bt-guard"` stays (bt-guard is now updated with farm work branches)

- [ ] **Step 2: Reassign Wren to baker**

In `agents/wren.json`, change:
- `"job": "librarian"` -> `"job": "baker"`
- `"behavior_tree": "bt-scholar"` stays (bt-scholar is now updated with bakery work branches)

- [ ] **Step 3: Add production block to farm.json**

```json
{
	"id": "loc-farm",
	"name": "Hillside Farm",
	"type": "food",
	"position": { "x": 100, "y": 100 },
	"capacity": 8,
	"color": "#7cba3f",
	"production": {
		"job": "farmer",
		"output": { "item_id": "wheat", "quantity": 1 },
		"input": null,
		"wage": 3,
		"ticks_per_cycle": 30
	}
}
```

- [ ] **Step 4: Add production block to bakery.json**

```json
{
	"id": "loc-bakery",
	"name": "Hearthstone Bakery",
	"type": "food",
	"position": { "x": 350, "y": 350 },
	"capacity": 6,
	"color": "#d2691e",
	"production": {
		"job": "baker",
		"output": { "item_id": "bread", "quantity": 1 },
		"input": { "item_id": "wheat", "quantity": 1 },
		"wage": 4,
		"ticks_per_cycle": 20
	}
}
```

- [ ] **Step 5: Add production block to workshop.json**

```json
{
	"id": "loc-workshop",
	"name": "Craft Quarter Workshop",
	"type": "work",
	"position": { "x": 150, "y": 350 },
	"capacity": 6,
	"color": "#8b7355",
	"production": {
		"job": "leatherworker",
		"output": { "item_id": "leather-goods", "quantity": 1 },
		"input": null,
		"wage": 5,
		"ticks_per_cycle": 40
	}
}
```

- [ ] **Step 6: Run smoke test to validate data parses**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/smoke-test.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/agents/marcus.json" \
  "01 - Projects/Project Meridian/agents/wren.json" \
  "01 - Projects/Project Meridian/locations/farm.json" \
  "01 - Projects/Project Meridian/locations/bakery.json" \
  "01 - Projects/Project Meridian/locations/workshop.json"
git commit -m "feat(meridian): Phase 2E data — Marcus=farmer, Wren=baker, production blocks on facilities"
```

---

## Chunk D: Infrastructure System Wrappers

Depends on Chunks A (components), B (pure functions), and C (BT conditions). Each task is independent within this chunk.

### Task D1: FacilitySystem (priority 6)

**Files:**
- Create: `src/infrastructure/systems/facility-system.ts`
- Create: `tests/infrastructure/systems/facility-system.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/systems/facility-system.test.ts
import { describe, it, expect } from 'vitest';
import { createFacilitySystem } from '../../../src/infrastructure/systems/facility-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import { Actor } from 'excalibur';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	};
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

function createFarmLocation(): WorldLocation {
	return {
		id: 'loc-farm', name: 'Farm', type: 'food',
		position: { x: 100, y: 100 }, capacity: 8, color: '#7cba3f',
		production: { job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, wage: 3, ticks_per_cycle: 30 },
	};
}

function createBakeryLocation(): WorldLocation {
	return {
		id: 'loc-bakery', name: 'Bakery', type: 'food',
		position: { x: 350, y: 350 }, capacity: 6, color: '#d2691e',
		production: { job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: { item_id: 'wheat', quantity: 1 }, wage: 4, ticks_per_cycle: 20 },
	};
}

function createWorldEntity(): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury: 500,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
	return entity;
}

describe('FacilitySystem', () => {
	it('increments workProgress when worker is at facility with correct job', () => {
		const farmLoc = createFarmLocation();
		const agent = new AgentActor(createTestAgentData('agent-marcus', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'work' };
		bb.markDirty();

		const farmActor = new Actor({ x: 100, y: 100 });
		farmActor.addComponent(new FacilityComponent({
			stock: [], fund: 200, workProgress: 0, status: 'idle', workerId: null,
		}));

		const locationActors = new Map([['loc-farm', farmActor]]);
		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFacilitySystem(
			() => [agent],
			() => [farmLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(1);
		expect(facility.state.status).toBe('producing');
		expect(facility.state.workerId).toBe('agent-marcus');
	});

	it('pays wage and collects tax on cycle complete', () => {
		const farmLoc = createFarmLocation();
		const agent = new AgentActor(createTestAgentData('agent-marcus', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'work' };
		bb.markDirty();

		const farmActor = new Actor({ x: 100, y: 100 });
		farmActor.addComponent(new FacilityComponent({
			stock: [], fund: 200, workProgress: 29, status: 'producing', workerId: 'agent-marcus',
		}));

		const locationActors = new Map([['loc-farm', farmActor]]);
		const worldEntity = createWorldEntity();
		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ProductionComplete', (e: GameEvent) => { events.push(e); });

		const deps = createDeps(eventBus);
		const system = createFacilitySystem(
			() => [agent],
			() => [farmLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(0);
		expect(facility.state.stock).toEqual([{ item_id: 'wheat', quantity: 1 }]);

		const wallet = agent.get(WalletComponent);
		// wage=3, tax=0.15, net=2.85
		expect(wallet.state.gold).toBeCloseTo(52.85);

		expect(facility.state.fund).toBeCloseTo(197);

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.treasury).toBeCloseTo(500.15);
		expect(economy.state.ledger.length).toBeGreaterThan(0);

		expect(events).toHaveLength(1);
	});

	it('remains idle when no worker is present', () => {
		const farmLoc = createFarmLocation();
		const farmActor = new Actor({ x: 100, y: 100 });
		farmActor.addComponent(new FacilityComponent({
			stock: [], fund: 200, workProgress: 5, status: 'producing', workerId: 'agent-marcus',
		}));

		const locationActors = new Map([['loc-farm', farmActor]]);
		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFacilitySystem(
			() => [],
			() => [farmLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.status).toBe('idle');
		expect(facility.state.workerId).toBeNull();
	});

	it('bakery remains idle when no wheat in stock', () => {
		const bakeryLoc = createBakeryLocation();
		const agent = new AgentActor(createTestAgentData('agent-wren', 350, 350, { job: 'baker' }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'work' };
		bb.markDirty();

		const bakeryActor = new Actor({ x: 350, y: 350 });
		bakeryActor.addComponent(new FacilityComponent({
			stock: [], fund: 200, workProgress: 0, status: 'idle', workerId: null,
		}));

		const locationActors = new Map([['loc-bakery', bakeryActor]]);
		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFacilitySystem(
			() => [agent],
			() => [bakeryLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.status).toBe('idle');
	});

	it('bakery consumes wheat on cycle complete', () => {
		const bakeryLoc = createBakeryLocation();
		const agent = new AgentActor(createTestAgentData('agent-wren', 350, 350, { job: 'baker' }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'work' };
		bb.markDirty();

		const bakeryActor = new Actor({ x: 350, y: 350 });
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'wheat', quantity: 3 }], fund: 200, workProgress: 19, status: 'producing', workerId: 'agent-wren',
		}));

		const locationActors = new Map([['loc-bakery', bakeryActor]]);
		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFacilitySystem(
			() => [agent],
			() => [bakeryLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		const facility = bakeryActor.get(FacilityComponent);
		// wheat consumed (3-1=2), bread produced (+1)
		const wheat = facility.state.stock.find(s => s.item_id === 'wheat');
		const bread = facility.state.stock.find(s => s.item_id === 'bread');
		expect(wheat?.quantity).toBe(2);
		expect(bread?.quantity).toBe(1);
	});
});
```

- [ ] **Step 2: Implement FacilitySystem**

```typescript
// src/infrastructure/systems/facility-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyFacilityTick } from '../../domain/systems/facility.js';
import { applySkillProgression } from '../../domain/systems/skill-progression.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { distance } from '../../domain/core/math-utils.js';

function findItemInStock(stock: { item_id: string; quantity: number }[], itemId: string): number {
	const item = stock.find(s => s.item_id === itemId);
	return item?.quantity ?? 0;
}

function updateStock(
	stock: { item_id: string; quantity: number }[],
	itemId: string,
	delta: number,
): { item_id: string; quantity: number }[] {
	const existing = stock.find(s => s.item_id === itemId);
	if (existing !== undefined) {
		return stock.map(s =>
			s.item_id === itemId
				? { ...s, quantity: s.quantity + delta }
				: { ...s },
		).filter(s => s.quantity > 0);
	}
	if (delta > 0) {
		return [...stock.map(s => ({ ...s })), { item_id: itemId, quantity: delta }];
	}
	return stock.map(s => ({ ...s }));
}

export function createFacilitySystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'FacilitySystem',
		priority: SystemPriority.FACILITY,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const locationActors = getLocationActors();
			const world = worldEntity();
			const economy = world.get(EconomyComponent);
			const radius = deps.config.perception.interaction_radius;
			const taxRate = deps.config.economy.tax_rate;

			for (const loc of locationList) {
				if (loc.production === null) continue;

				const locActor = locationActors.get(loc.id);
				if (locActor === undefined) continue;

				const facility = locActor.get(FacilityComponent);
				const production = loc.production;

				// Find worker: agent within radius with btAction=work and matching job
				let worker: AgentActor | undefined;
				for (const agent of agentList) {
					const bb = agent.get(BlackboardComponent);
					const btAction = bb.state.btAction as string | undefined;
					if (btAction !== 'work') continue;
					if (agent.job !== production.job) continue;
					const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
					if (dist <= radius) {
						worker = agent;
						break;
					}
				}

				// Check input availability
				const hasRequiredInput = production.input === null
					|| findItemInStock(facility.state.stock, production.input.item_id) >= production.input.quantity;

				const result = applyFacilityTick({
					hasWorker: worker !== undefined,
					workerJob: worker?.job ?? null,
					facilityJob: production.job,
					workProgress: facility.state.workProgress,
					ticksPerCycle: production.ticks_per_cycle,
					hasRequiredInput,
					wage: production.wage,
					taxRate,
					facilityFund: facility.state.fund,
					workerGold: worker !== undefined ? worker.get(WalletComponent).state.gold : 0,
				});

				// Update facility state
				let newStock = [...facility.state.stock.map(s => ({ ...s }))];

				if (result.cycleComplete) {
					// Consume input
					if (result.consumeInput && production.input !== null) {
						newStock = updateStock(newStock, production.input.item_id, -production.input.quantity);
					}
					// Produce output
					if (result.produceOutput) {
						newStock = updateStock(newStock, production.output.item_id, production.output.quantity);
					}
				}

				facility.state = {
					stock: newStock,
					fund: facility.state.fund + result.facilityFundChange,
					workProgress: result.newWorkProgress,
					status: result.status,
					workerId: worker?.agentId ?? null,
				};
				facility.markDirty();

				if (result.cycleComplete && worker !== undefined) {
					// Pay worker
					const wallet = worker.get(WalletComponent);
					wallet.state = { ...wallet.state, gold: wallet.state.gold + result.workerGoldChange };
					wallet.markDirty();

					// Collect tax
					economy.state = {
						...economy.state,
						treasury: economy.state.treasury + result.taxCollected,
						ledger: [
							...economy.state.ledger,
							{
								tick: deps.tickCount,
								type: 'wage' as const,
								from: loc.id,
								to: worker.agentId,
								itemId: null,
								quantity: 0,
								gold: result.workerGoldChange,
							},
							{
								tick: deps.tickCount,
								type: 'tax' as const,
								from: worker.agentId,
								to: 'treasury',
								itemId: null,
								quantity: 0,
								gold: result.taxCollected,
							},
						],
						dailySummary: {
							...economy.state.dailySummary,
							totalWages: economy.state.dailySummary.totalWages + result.workerGoldChange + result.taxCollected,
							totalTax: economy.state.dailySummary.totalTax + result.taxCollected,
						},
					};
					economy.markDirty();

					// Skill progression
					const skillId = production.job;
					const agentSkills = worker.get(BlackboardComponent).state.skills as
						{ id: string; points: number; use_count: number; use_bonus: number }[] | undefined ?? [];
					const skill = agentSkills.find((s: { id: string }) => s.id === skillId);
					const progression = applySkillProgression({
						points: skill?.points ?? 0,
						useCount: skill?.use_count ?? 0,
						useBonus: skill?.use_bonus ?? 0,
						thresholds: deps.config.skills.use_thresholds,
						maxUseBonus: deps.config.skills.max_use_bonus,
					});

					const workerBb = worker.get(BlackboardComponent);
					const existingSkills = (workerBb.state.skills as { id: string; points: number; use_count: number; use_bonus: number }[] | undefined) ?? [];
					const updatedSkills = skill !== undefined
						? existingSkills.map((s: { id: string }) =>
							s.id === skillId
								? { id: skillId, points: progression.newPoints, use_count: progression.newUseCount, use_bonus: progression.newUseBonus }
								: s,
						)
						: [...existingSkills, { id: skillId, points: progression.newPoints, use_count: progression.newUseCount, use_bonus: progression.newUseBonus }];

					workerBb.state = { ...workerBb.state, skills: updatedSkills };
					workerBb.markDirty();

					if (progression.improved) {
						deps.eventBus.emit({
							type: 'SkillImproved',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'FacilitySystem',
							payload: { agentId: worker.agentId, skillId, newUseBonus: progression.newUseBonus },
						});
					}

					// Relationship: worker familiarity +1 with facility
					const rel = worker.get(RelationshipComponent);
					const existingEntry = rel.state.entries.find(e => e.agentId === loc.id);
					const relUpdate = applyRelationshipUpdate({
						currentDisposition: existingEntry?.disposition ?? 0,
						currentFamiliarity: existingEntry?.familiarity ?? 0,
						dispositionChange: 0,
						familiarityChange: 1,
					});

					const newEntries = existingEntry !== undefined
						? rel.state.entries.map(e =>
							e.agentId === loc.id
								? { ...e, disposition: relUpdate.newDisposition, familiarity: relUpdate.newFamiliarity }
								: { ...e },
						)
						: [...rel.state.entries.map(e => ({ ...e })), { agentId: loc.id, disposition: relUpdate.newDisposition, familiarity: relUpdate.newFamiliarity }];

					rel.state = { entries: newEntries };
					rel.markDirty();

					// Emit production event
					deps.eventBus.emit({
						type: 'ProductionComplete',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'FacilitySystem',
						payload: {
							facilityId: loc.id,
							workerId: worker.agentId,
							outputItem: production.output.item_id,
							outputQty: production.output.quantity,
							wage: result.workerGoldChange,
							taxCollected: result.taxCollected,
						},
					});

					// Check facility insolvency
					if (facility.state.fund <= 0) {
						deps.eventBus.emit({
							type: 'FacilityInsolvent',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'FacilitySystem',
							payload: { facilityId: loc.id, fund: 0, unpaidWage: production.wage - (-result.facilityFundChange) },
						});
					}
				}

				// Emit idle event when status changed to idle
				if (result.status === 'idle' && result.idleReason !== null) {
					deps.eventBus.emit({
						type: 'FacilityIdle',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'FacilitySystem',
						payload: { facilityId: loc.id, reason: result.idleReason },
					});
				}
			}
		},
	};
}
```

- [ ] **Step 3: Run tests** (5 tests), lint

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/facility-system.test.ts --config configs/vitest.config.ts
npx eslint src/infrastructure/systems/facility-system.ts tests/infrastructure/systems/facility-system.test.ts --config configs/eslint.config.mjs
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/facility-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/facility-system.test.ts"
git commit -m "feat(meridian): FacilitySystem — production cycles, wages, tax, skill progression"
```

---

### Task D2: TradeSystem (priority 11)

**Files:**
- Create: `src/infrastructure/systems/trade-system.ts`
- Create: `tests/infrastructure/systems/trade-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests should verify:
- Agent with `btAction='buy'` at facility with stock and enough gold -> item added to inventory, gold deducted
- Agent with insufficient gold -> PurchaseFailed event
- Agent at facility with no stock -> PurchaseFailed event
- Ledger entries created on successful purchase
- Relationship update on purchase (buyer familiarity +0.5 with facility worker)

Use the same `createTestAgentData` and `createDeps` patterns from Task D1.

```typescript
// tests/infrastructure/systems/trade-system.test.ts
import { describe, it, expect } from 'vitest';
import { createTradeSystem } from '../../../src/infrastructure/systems/trade-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import { Actor } from 'excalibur';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	};
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('TradeSystem', () => {
	it('agent buys bread from facility with stock', () => {
		const bakeryLoc: WorldLocation = {
			id: 'loc-bakery', name: 'Bakery', type: 'food',
			position: { x: 350, y: 350 }, capacity: 6, color: '#d2691e',
			production: { job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: { item_id: 'wheat', quantity: 1 }, wage: 4, ticks_per_cycle: 20 },
		};
		const agent = new AgentActor(createTestAgentData('agent-elena', 350, 350), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'buy' };
		bb.markDirty();

		const bakeryActor = new Actor({ x: 350, y: 350 });
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'bread', quantity: 3 }], fund: 100, workProgress: 0, status: 'idle', workerId: null,
		}));

		const locationActors = new Map([['loc-bakery', bakeryActor]]);
		const worldEntity = new Actor();
		worldEntity.addComponent(new EconomyComponent({
			treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
		}));

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('PurchaseComplete', (e: GameEvent) => { events.push(e); });

		const deps = createDeps(eventBus);
		const system = createTradeSystem(
			() => [agent],
			() => [bakeryLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(48); // 50 - 2 (food_price)

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'bread', quantity: 1 });

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock.find(s => s.item_id === 'bread')?.quantity).toBe(2);
		expect(facility.state.fund).toBe(102); // 100 + 2

		expect(events).toHaveLength(1);
	});

	it('emits PurchaseFailed when agent has no gold', () => {
		const bakeryLoc: WorldLocation = {
			id: 'loc-bakery', name: 'Bakery', type: 'food',
			position: { x: 350, y: 350 }, capacity: 6, color: '#d2691e',
			production: { job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null, wage: 4, ticks_per_cycle: 20 },
		};
		const agent = new AgentActor(createTestAgentData('agent-elena', 350, 350, { wallet: { gold: 0 } }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'buy' };
		bb.markDirty();

		const bakeryActor = new Actor({ x: 350, y: 350 });
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'bread', quantity: 1 }], fund: 100, workProgress: 0, status: 'idle', workerId: null,
		}));

		const locationActors = new Map([['loc-bakery', bakeryActor]]);
		const worldEntity = new Actor();
		worldEntity.addComponent(new EconomyComponent({
			treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
		}));

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('PurchaseFailed', (e: GameEvent) => { events.push(e); });

		const deps = createDeps(eventBus);
		const system = createTradeSystem(
			() => [agent],
			() => [bakeryLoc],
			() => locationActors,
			() => worldEntity,
		);
		system.execute(deps);

		expect(events).toHaveLength(1);
		expect(events[0].payload.reason).toBe('no_gold');
	});
});
```

- [ ] **Step 2: Implement TradeSystem**

```typescript
// src/infrastructure/systems/trade-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyTrade } from '../../domain/systems/trade.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { distance } from '../../domain/core/math-utils.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { FOOD_ITEMS } from '../../domain/systems/food-items.js';

export function createTradeSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'TradeSystem',
		priority: SystemPriority.TRADE,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const locationActors = getLocationActors();
			const world = worldEntity();
			const economy = world.get(EconomyComponent);
			const radius = deps.config.perception.interaction_radius;
			const foodPrice = deps.config.economy.food_price;

			for (const agent of agentList) {
				const bb = agent.get(BlackboardComponent);
				const btAction = bb.state.btAction as string | undefined;
				if (btAction !== 'buy') continue;

				const wallet = agent.get(WalletComponent);
				const inv = agent.get(InventoryComponent);

				// Find nearest facility with food stock within radius
				let bestLoc: WorldLocation | undefined;
				let bestActor: Actor | undefined;
				let bestDist = Infinity;
				let bestFoodItem: { item_id: string; quantity: number } | undefined;

				for (const loc of locationList) {
					if (loc.production === null) continue;
					const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
					if (dist > radius || dist >= bestDist) continue;

					const locActor = locationActors.get(loc.id);
					if (locActor === undefined) continue;

					const facility = locActor.get(FacilityComponent);
					const foodInStock = facility.state.stock.find(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0);
					if (foodInStock === undefined) continue;

					bestLoc = loc;
					bestActor = locActor;
					bestDist = dist;
					bestFoodItem = foodInStock;
				}

				if (bestLoc === undefined || bestActor === undefined || bestFoodItem === undefined) {
					deps.eventBus.emit({
						type: 'PurchaseFailed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { buyerId: agent.agentId, facilityId: null, reason: 'no_stock' },
					});
					continue;
				}

				const result = applyTrade({
					agentGold: wallet.state.gold,
					price: foodPrice,
					facilityFund: bestActor.get(FacilityComponent).state.fund,
					itemId: bestFoodItem.item_id,
					quantity: 1,
				});

				if (!result.success) {
					deps.eventBus.emit({
						type: 'PurchaseFailed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { buyerId: agent.agentId, facilityId: bestLoc.id, reason: result.failReason },
					});
					continue;
				}

				// Update wallet
				wallet.state = { ...wallet.state, gold: wallet.state.gold + result.agentGoldChange };
				wallet.markDirty();

				// Add item to inventory
				const existingItem = inv.state.items.find(i => i.item_id === bestFoodItem.item_id);
				const newItems = existingItem !== undefined
					? inv.state.items.map(i =>
						i.item_id === bestFoodItem.item_id
							? { ...i, quantity: i.quantity + 1 }
							: { ...i },
					)
					: [...inv.state.items.map(i => ({ ...i })), { item_id: bestFoodItem.item_id, quantity: 1 }];
				inv.state = { items: newItems };
				inv.markDirty();

				// Update facility stock and fund
				const facility = bestActor.get(FacilityComponent);
				const updatedStock = facility.state.stock
					.map(s => s.item_id === bestFoodItem.item_id ? { ...s, quantity: s.quantity - 1 } : { ...s })
					.filter(s => s.quantity > 0);
				facility.state = { ...facility.state, stock: updatedStock, fund: facility.state.fund + result.facilityFundChange };
				facility.markDirty();

				// Ledger entries
				economy.state = {
					...economy.state,
					ledger: [
						...economy.state.ledger,
						{
							tick: deps.tickCount,
							type: 'purchase' as const,
							from: agent.agentId,
							to: bestLoc.id,
							itemId: bestFoodItem.item_id,
							quantity: 1,
							gold: foodPrice,
						},
					],
					dailySummary: {
						...economy.state.dailySummary,
						totalSales: economy.state.dailySummary.totalSales + foodPrice,
					},
				};
				economy.markDirty();

				// Relationship: buyer familiarity +0.5 with facility worker (if present)
				if (facility.state.workerId !== null) {
					const rel = agent.get(RelationshipComponent);
					const existingEntry = rel.state.entries.find(e => e.agentId === facility.state.workerId);
					const relResult = applyRelationshipUpdate({
						currentDisposition: existingEntry?.disposition ?? 0,
						currentFamiliarity: existingEntry?.familiarity ?? 0,
						dispositionChange: 0,
						familiarityChange: 0.5,
					});
					const newEntries = existingEntry !== undefined
						? rel.state.entries.map(e =>
							e.agentId === facility.state.workerId
								? { ...e, disposition: relResult.newDisposition, familiarity: relResult.newFamiliarity }
								: { ...e },
						)
						: [...rel.state.entries.map(e => ({ ...e })), { agentId: facility.state.workerId, disposition: relResult.newDisposition, familiarity: relResult.newFamiliarity }];
					rel.state = { entries: newEntries };
					rel.markDirty();
				}

				deps.eventBus.emit({
					type: 'PurchaseComplete',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'TradeSystem',
					payload: {
						buyerId: agent.agentId,
						facilityId: bestLoc.id,
						itemId: bestFoodItem.item_id,
						quantity: 1,
						price: foodPrice,
					},
				});
			}
		},
	};
}
```

- [ ] **Step 3: Run tests, lint, commit**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/trade-system.test.ts --config configs/vitest.config.ts
npx eslint src/infrastructure/systems/trade-system.ts tests/infrastructure/systems/trade-system.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/trade-system.test.ts"
git commit -m "feat(meridian): TradeSystem — buy action, facility purchases, ledger entries"
```

---

### Task D3: Modified FeedSystem -- Inventory-Based Consumption

**Files:**
- Modify: `src/infrastructure/systems/feed-system.ts`
- Modify: `tests/infrastructure/systems/feed-system.test.ts`

This is a **breaking change** from Phase 1D. FeedSystem no longer checks for nearby food locations. Instead, it checks agent inventory for food items.

- [ ] **Step 1: Update FeedSystem implementation**

Replace the location-based feed logic with inventory-based logic:

```typescript
// src/infrastructure/systems/feed-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyFeed, type FeedConfig } from '../../domain/systems/feed.js';
import { findFoodInInventory, removeFromInventory } from '../../domain/systems/food-items.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { EconomyComponent } from '../components/economy-component.js';

export function createFeedSystem(
	agents: () => AgentActor[],
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'FeedSystem',
		priority: SystemPriority.FEED,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const world = worldEntity();
			const economy = world.get(EconomyComponent);

			for (const agent of agentList) {
				const bb = agent.get(BlackboardComponent);
				const btAction = bb.state.btAction as string | undefined;

				if (btAction !== 'eat') {
					// Clear feeding state
					if (bb.state.feedingAt !== undefined) {
						bb.state = { ...bb.state, feedingAt: undefined };
						bb.markDirty();
					}
					continue;
				}

				// Check inventory for food item
				const inv = agent.get(InventoryComponent);
				const foodItem = findFoodInInventory(inv.state.items);
				if (foodItem === null) {
					if (bb.state.feedingAt !== undefined) {
						bb.state = { ...bb.state, feedingAt: undefined };
						bb.markDirty();
					}
					continue;
				}

				// Consume item from inventory
				const newItems = removeFromInventory(inv.state.items, foodItem.item_id, 1);
				inv.state = { items: newItems };
				inv.markDirty();

				// Apply hunger recovery
				const needs = agent.get(NeedsComponent);
				const feedConfig: FeedConfig = { recovery_rate: deps.config.needs.food_recovery_rate };
				const result = applyFeed({ currentHunger: needs.state.hunger }, feedConfig);

				needs.state = { ...needs.state, hunger: result.newHunger };
				needs.markDirty();

				// Ledger entry
				economy.state = {
					...economy.state,
					ledger: [
						...economy.state.ledger,
						{
							tick: deps.tickCount,
							type: 'consumption' as const,
							from: agent.agentId,
							to: 'consumed',
							itemId: foodItem.item_id,
							quantity: 1,
							gold: 0,
						},
					],
					dailySummary: {
						...economy.state.dailySummary,
						totalConsumption: economy.state.dailySummary.totalConsumption + 1,
					},
				};
				economy.markDirty();

				// Track feeding for first-tick event
				const previousFeedingAt = bb.state.feedingAt as string | undefined;
				if (previousFeedingAt !== 'inventory') {
					bb.state = { ...bb.state, feedingAt: 'inventory' };
					bb.markDirty();

					deps.eventBus.emit({
						type: 'FeedStarted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'FeedSystem',
						payload: { agentId: agent.agentId, locationId: null },
					});
				}

				// Emit ItemConsumed event
				deps.eventBus.emit({
					type: 'ItemConsumed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'FeedSystem',
					payload: { agentId: agent.agentId, itemId: foodItem.item_id },
				});
			}
		},
	};
}
```

**Important:** The function signature changes from `createFeedSystem(agents, locations)` to `createFeedSystem(agents, worldEntity)`. The `locations` parameter is removed. This is a breaking change that must be updated in game-view.ts wiring (Task E1).

- [ ] **Step 2: Update FeedSystem tests**

Replace ALL existing feed-system tests with inventory-based tests:

```typescript
// tests/infrastructure/systems/feed-system.test.ts
import { describe, it, expect } from 'vitest';
import { createFeedSystem } from '../../../src/infrastructure/systems/feed-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import { Actor } from 'excalibur';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	};
}

function createWorldEntity(): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
	return entity;
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('FeedSystem (inventory-based)', () => {
	it('consumes bread from inventory and recovers hunger', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'bread', quantity: 2 }] }),
			defaultMoodConfig,
		);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'eat' };
		bb.markDirty();

		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBeGreaterThan(50);

		const inv = agent.get(InventoryComponent);
		const bread = inv.state.items.find(i => i.item_id === 'bread');
		expect(bread?.quantity).toBe(1);
	});

	it('does not recover hunger when no food in inventory', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'torch', quantity: 1 }] }),
			defaultMoodConfig,
		);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'eat' };
		bb.markDirty();

		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBe(50);
	});

	it('emits ItemConsumed event on consumption', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'bread', quantity: 1 }] }),
			defaultMoodConfig,
		);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'eat' };
		bb.markDirty();

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ItemConsumed', (e: GameEvent) => { events.push(e); });

		const worldEntity = createWorldEntity();
		const deps = createDeps(eventBus);

		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		expect(events).toHaveLength(1);
		expect(events[0].payload.itemId).toBe('bread');
	});

	it('appends consumption ledger entry', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'bread', quantity: 1 }] }),
			defaultMoodConfig,
		);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'eat' };
		bb.markDirty();

		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger).toHaveLength(1);
		expect(economy.state.ledger[0].type).toBe('consumption');
	});

	it('skips agents not eating', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'bread', quantity: 5 }] }),
			defaultMoodConfig,
		);
		// btAction is not 'eat' -- defaults to undefined

		const worldEntity = createWorldEntity();
		const deps = createDeps();

		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const inv = agent.get(InventoryComponent);
		const bread = inv.state.items.find(i => i.item_id === 'bread');
		expect(bread?.quantity).toBe(5);
	});
});
```

- [ ] **Step 3: Run tests, lint, commit**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/feed-system.test.ts --config configs/vitest.config.ts
npx eslint src/infrastructure/systems/feed-system.ts tests/infrastructure/systems/feed-system.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/infrastructure/systems/feed-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/feed-system.test.ts"
git commit -m "feat(meridian): FeedSystem rewrite — inventory-based consumption, ledger entries"
```

---

### Task D4: Modified RestSystem -- Gold Cost for Public Shelter

**Files:**
- Modify: `src/infrastructure/systems/rest-system.ts`
- Modify: `tests/infrastructure/systems/rest-system.test.ts`

- [ ] **Step 1: Update resolveRestTier to check gold**

In `src/infrastructure/systems/rest-system.ts`, modify `resolveRestTier` to accept agent gold and rest price. When the tier would be `public_shelter` but agent has insufficient gold, downgrade to `outdoors`.

Add import for WalletComponent:

```typescript
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
```

Update `resolveRestTier`:

```typescript
function resolveRestTier(
	nearestRest: WorldLocation | undefined,
	agentProperty: string[],
	btAction: string | undefined,
	agentGold: number,
	restPrice: number,
): RestTier | null {
	if (nearestRest !== undefined) {
		if (agentProperty.includes(nearestRest.id)) return 'owned_home';
		// Public shelter requires gold -- downgrade to outdoors when broke
		return agentGold >= restPrice ? 'public_shelter' : 'outdoors';
	}
	if (btAction === undefined || btAction === 'idle') {
		return 'outdoors';
	}
	return null;
}
```

Update `createRestSystem` signature to accept `worldEntity`:

```typescript
export function createRestSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	worldEntity: () => Actor,
): GameSystem {
```

In the execute method, add gold deduction on first tick of public_shelter rest:

```typescript
// After applying rest result, before event emission:
if (restTier === 'public_shelter' && previousRestingAt !== currentRestingAt) {
	// One-time charge on entry
	const wallet = agent.get(WalletComponent);
	const world = worldEntity();
	const economy = world.get(EconomyComponent);
	wallet.state = { ...wallet.state, gold: wallet.state.gold - deps.config.economy.rest_price };
	wallet.markDirty();

	economy.state = {
		...economy.state,
		ledger: [
			...economy.state.ledger,
			{
				tick: deps.tickCount,
				type: 'purchase' as const,
				from: agent.agentId,
				to: nearestRest?.id ?? 'outdoors',
				itemId: null,
				quantity: 0,
				gold: deps.config.economy.rest_price,
			},
		],
	};
	economy.markDirty();
}
```

- [ ] **Step 2: Add new tests for gold-based rest**

Add to existing test file:

```typescript
it('downgrades to outdoors when agent cannot afford public shelter', () => {
	const agent = new AgentActor(
		createTestAgentData('agent-1', 300, 200, { wallet: { gold: 0 } }),
		defaultMoodConfig,
	);
	const loc = createRestLocation('loc-tavern', 300, 200);
	const worldEntity = new Actor();
	worldEntity.addComponent(new EconomyComponent({
		treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
	const deps = createDeps();

	const system = createRestSystem(() => [agent], () => [loc], () => worldEntity);
	system.execute(deps);

	const needs = agent.get(NeedsComponent);
	// Outdoors rate = 1.0, so energy should be 51
	expect(needs.state.energy).toBe(51);
});

it('deducts gold on public shelter entry', () => {
	const agent = new AgentActor(
		createTestAgentData('agent-1', 300, 200),
		defaultMoodConfig,
	);
	const loc = createRestLocation('loc-tavern', 300, 200);
	const worldEntity = new Actor();
	worldEntity.addComponent(new EconomyComponent({
		treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
	const deps = createDeps();

	const system = createRestSystem(() => [agent], () => [loc], () => worldEntity);
	system.execute(deps);

	const wallet = agent.get(WalletComponent);
	expect(wallet.state.gold).toBe(49); // 50 - 1 (rest_price)
});
```

**Note:** The existing tests need updating to accommodate the new `worldEntity` parameter. Add `worldEntity` to the `createRestSystem()` call in all existing tests.

- [ ] **Step 3: Run tests, lint, commit**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/rest-system.test.ts --config configs/vitest.config.ts
npx eslint src/infrastructure/systems/rest-system.ts tests/infrastructure/systems/rest-system.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/infrastructure/systems/rest-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/rest-system.test.ts"
git commit -m "feat(meridian): RestSystem — gold cost for public shelter, outdoors downgrade"
```

---

### Task D5: Modified DayNightSystem -- Welfare Check + Daily Report

**Files:**
- Modify: `src/infrastructure/systems/day-night-system.ts`

- [ ] **Step 1: Extend DayNightSystem with welfare + daily report**

The system already runs at priority 0.7. Add two new behaviors at day boundary (dawn tick 0, i.e. when `dayCount` increments):

1. **Welfare check:** for each agent with wallet gold below threshold, inject welfare gold from treasury
2. **Daily report:** generate and write report, then prune old ledger entries

```typescript
// src/infrastructure/systems/day-night-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { advanceTime } from '../../domain/systems/day-night.js';
import { generateDailyReport } from '../../domain/systems/daily-report.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { FacilityComponent } from '../components/facility-component.js';

export function createDayNightSystem(
	worldEntity: () => Actor,
	getAgents?: () => AgentActor[],
	getLocationActors?: () => Map<string, Actor>,
	getLocations?: () => WorldLocation[],
): GameSystem {
	return {
		name: 'DayNightSystem',
		priority: SystemPriority.DAY_NIGHT,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);

			const result = advanceTime(deps.tickCount, {
				ticks_per_day: deps.config.ticks_per_day,
				day_night: deps.config.day_night,
			});

			const oldPhase = time.state.phase;
			const oldDayCount = time.state.dayCount;
			time.state = result.state;
			time.markDirty();

			if (result.phaseChanged) {
				deps.eventBus.emit({
					type: 'DayPhaseChanged',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'DayNightSystem',
					payload: {
						oldPhase,
						newPhase: result.state.phase,
						dayCount: result.state.dayCount,
					},
				});
			}

			// Day boundary: new day started (dayCount incremented)
			if (result.state.dayCount > oldDayCount && result.state.dayCount > 0) {
				const agentList = getAgents?.() ?? [];
				const locationActors = getLocationActors?.() ?? new Map<string, Actor>();
				const locationList = getLocations?.() ?? [];

				// Only run economy features if EconomyComponent is attached
				const economyComponent = entity.has(EconomyComponent) ? entity.get(EconomyComponent) : null;

				if (economyComponent !== null) {
					// Welfare check
					const welfareThreshold = deps.config.economy.welfare_threshold_gold;
					const welfareAmount = deps.config.economy.welfare_reward_min;

					for (const agent of agentList) {
						const wallet = agent.get(WalletComponent);
						if (wallet.state.gold < welfareThreshold && economyComponent.state.treasury >= welfareAmount) {
							wallet.state = { ...wallet.state, gold: wallet.state.gold + welfareAmount };
							wallet.markDirty();

							economyComponent.state = {
								...economyComponent.state,
								treasury: economyComponent.state.treasury - welfareAmount,
								ledger: [
									...economyComponent.state.ledger,
									{
										tick: deps.tickCount,
										type: 'welfare' as const,
										from: 'treasury',
										to: agent.agentId,
										itemId: null,
										quantity: 0,
										gold: welfareAmount,
									},
								],
							};
							economyComponent.markDirty();

							deps.eventBus.emit({
								type: 'WelfareGranted',
								tick: deps.tickCount,
								wallClock: Date.now(),
								source: 'DayNightSystem',
								payload: {
									agentId: agent.agentId,
									amount: welfareAmount,
									treasuryRemaining: economyComponent.state.treasury,
								},
							});
						}
					}

					// Generate daily report
					const facilities = locationList
						.filter(loc => loc.production !== null)
						.map(loc => {
							const locActor = locationActors.get(loc.id);
							const facility = locActor !== undefined && locActor.has(FacilityComponent)
								? locActor.get(FacilityComponent)
								: null;
							return {
								name: loc.name,
								produced: facility !== null
									? facility.state.stock.map(s => ({ item: s.item_id, qty: s.quantity }))
									: [],
								workerName: facility?.state.workerId !== null
									? agentList.find(a => a.agentId === facility?.state.workerId)?.agentName ?? null
									: null,
								status: facility?.state.status ?? 'idle',
							};
						});

					// Derive agent gold changes from ledger
					const agentReportData = agentList.map(agent => {
						const wallet = agent.get(WalletComponent);
						const goldChange = economyComponent.state.ledger
							.filter(e => e.to === agent.agentId)
							.reduce((sum, e) => sum + e.gold, 0)
							- economyComponent.state.ledger
								.filter(e => e.from === agent.agentId)
								.reduce((sum, e) => sum + e.gold, 0);
						return { name: agent.agentName, gold: wallet.state.gold, goldChange };
					});

					const report = generateDailyReport({
						dayCount: oldDayCount,
						summary: { ...economyComponent.state.dailySummary },
						treasury: economyComponent.state.treasury,
						facilities,
						transactions: [...economyComponent.state.ledger],
						agents: agentReportData,
					});

					// Write report to vault
					if (deps.writeFile !== null) {
						const path = `03 - Resources/Economy/day-${String(oldDayCount)}.md`;
						const content = `${report.frontmatter}\n\n${report.body}`;
						void deps.writeFile(path, content);

						deps.eventBus.emit({
							type: 'DailyReportWritten',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'DayNightSystem',
							payload: { dayCount: oldDayCount, path },
						});
					}

					// Prune old ledger entries
					const retentionTicks = deps.config.economy.ledger_retention_days * deps.config.ticks_per_day;
					const cutoffTick = deps.tickCount - retentionTicks;
					const prunedLedger = economyComponent.state.ledger.filter(e => e.tick >= cutoffTick);

					// Reset daily summary
					economyComponent.state = {
						...economyComponent.state,
						ledger: prunedLedger,
						dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
					};
					economyComponent.markDirty();
				}
			}
		},
	};
}
```

- [ ] **Step 2: Update existing DayNightSystem tests**

The existing tests call `createDayNightSystem(getWorldEntity)` -- this still works since the new params are optional. Add new tests for welfare and reporting.

- [ ] **Step 3: Run tests, lint, commit**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts
npx eslint src/infrastructure/systems/day-night-system.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/infrastructure/systems/day-night-system.ts"
git commit -m "feat(meridian): DayNightSystem — welfare check, daily economy report, ledger pruning"
```

---

## Chunk E: Wiring + Integration + Verification

Depends on all previous chunks.

### Task E1: game-view.ts Wiring

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Add imports for new components and systems**

```typescript
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { createFacilitySystem } from '../systems/facility-system.js';
import { createTradeSystem } from '../systems/trade-system.js';
```

- [ ] **Step 2: Retain location actor references**

In `populateScene()`, replace the location marker loop with a version that retains references:

```typescript
// Add location markers and retain references for FacilityComponent queries
const locationActors = new Map<string, ex.Actor>();
for (const loc of world.locations) {
	const marker = createLocationMarker(loc);
	engine.currentScene.add(marker);

	if (loc.production !== null) {
		marker.addComponent(new FacilityComponent({
			stock: [],
			fund: deps.config.economy.facility_start_fund,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));
	}

	locationActors.set(loc.id, marker);
}
```

- [ ] **Step 3: Attach EconomyComponent to world entity**

After creating the world entity:

```typescript
worldEntity.addComponent(new EconomyComponent({
	treasury: deps.config.economy.treasury_start_sandbox,
	ledger: [],
	dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
}));
```

- [ ] **Step 4: Add entity query helpers**

```typescript
const getLocationActors = () => locationActors;
```

- [ ] **Step 5: Update existing system registrations**

Update `createDayNightSystem` to pass new optional params:

```typescript
tickRunner.register(createDayNightSystem(getWorldEntity, getAgents, getLocationActors, getLocations));
```

Update `createFeedSystem` signature change (no more locations, now takes worldEntity):

```typescript
tickRunner.register(createFeedSystem(getAgents, getWorldEntity));
```

Update `createRestSystem` to pass worldEntity:

```typescript
tickRunner.register(createRestSystem(getAgents, getLocations, getWorldEntity));
```

Update `createBehaviorTreeSystem` to pass location actor helpers:

```typescript
tickRunner.register(createBehaviorTreeSystem(getAgents, world.btDefinitions, getWorldEntity, Date.now(), getLocationActors, getLocations));
```

- [ ] **Step 6: Register new systems**

```typescript
tickRunner.register(createFacilitySystem(getAgents, getLocations, getLocationActors, getWorldEntity));
tickRunner.register(createTradeSystem(getAgents, getLocations, getLocationActors, getWorldEntity));
```

- [ ] **Step 7: Run typecheck + lint**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): Phase 2E wiring — location actors map, new systems, economy component"
```

---

### Task E2: plugin.ts writeFile Adapter

**Files:**
- Modify: `src/plugin.ts`

- [ ] **Step 1: Add writeFile vault adapter**

In `initializeGame()`, after creating `this.gameDeps`, set the writeFile to a real vault adapter:

```typescript
const vault = this.app.vault;
const writeFile = async (path: string, content: string): Promise<void> => {
	const existing = vault.getFileByPath(path);
	if (existing !== null) {
		await vault.modify(existing, content);
	} else {
		// Ensure parent folder exists
		const folderPath = path.substring(0, path.lastIndexOf('/'));
		const folder = vault.getFolderByPath(folderPath);
		if (folder === null) {
			await vault.createFolder(folderPath);
		}
		await vault.create(path, content);
	}
};

if (this.gameDeps !== null) {
	this.gameDeps.writeFile = writeFile;
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Project Meridian/src/plugin.ts"
git commit -m "feat(meridian): Phase 2E writeFile vault adapter — daily report writing"
```

---

### Task E3: Integration Tests

**Files:**
- Create: `tests/integration/economy-integration.test.ts`

- [ ] **Step 1: Write economy integration test**

```typescript
// tests/integration/economy-integration.test.ts
import { describe, it, expect } from 'vitest';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../src/infrastructure/components/blackboard-component.js';
import { WalletComponent } from '../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../src/infrastructure/components/inventory-component.js';
import { FacilityComponent } from '../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createFacilitySystem } from '../../src/infrastructure/systems/facility-system.js';
import { createTradeSystem } from '../../src/infrastructure/systems/trade-system.js';
import { createFeedSystem } from '../../src/infrastructure/systems/feed-system.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import { Actor } from 'excalibur';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 40, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	};
}

function createDeps(tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('Economy integration', () => {
	it('full cycle: agent works at farm, earns gold, buys bread, eats', () => {
		// Setup: farmer at farm
		const farmLoc: WorldLocation = {
			id: 'loc-farm', name: 'Farm', type: 'food',
			position: { x: 100, y: 100 }, capacity: 8, color: '#7cba3f',
			production: { job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, wage: 3, ticks_per_cycle: 2 },
		};
		const bakeryLoc: WorldLocation = {
			id: 'loc-bakery', name: 'Bakery', type: 'food',
			position: { x: 100, y: 100 }, capacity: 6, color: '#d2691e',
			production: { job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: { item_id: 'wheat', quantity: 1 }, wage: 4, ticks_per_cycle: 2 },
		};
		const locations = [farmLoc, bakeryLoc];

		const farmer = new AgentActor(createTestAgentData('agent-farmer', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		const baker = new AgentActor(createTestAgentData('agent-baker', 100, 100, { job: 'baker' }), defaultMoodConfig);
		const buyer = new AgentActor(createTestAgentData('agent-buyer', 100, 100, { inventory: [] }), defaultMoodConfig);

		// Setup facility actors
		const farmActor = new Actor({ x: 100, y: 100 });
		farmActor.addComponent(new FacilityComponent({ stock: [], fund: 200, workProgress: 1, status: 'producing', workerId: null }));
		const bakeryActor = new Actor({ x: 100, y: 100 });
		bakeryActor.addComponent(new FacilityComponent({ stock: [{ item_id: 'wheat', quantity: 1 }], fund: 200, workProgress: 1, status: 'producing', workerId: null }));

		const locationActors = new Map([['loc-farm', farmActor], ['loc-bakery', bakeryActor]]);
		const worldEntity = new Actor();
		worldEntity.addComponent(new EconomyComponent({ treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 } }));

		const allAgents = [farmer, baker, buyer];

		// Phase 1: Workers work (tick to complete cycle -- workProgress is 1, ticks_per_cycle is 2)
		const farmerBb = farmer.get(BlackboardComponent);
		farmerBb.state = { ...farmerBb.state, btAction: 'work' };
		farmerBb.markDirty();
		const bakerBb = baker.get(BlackboardComponent);
		bakerBb.state = { ...bakerBb.state, btAction: 'work' };
		bakerBb.markDirty();

		const deps = createDeps();
		const facilitySys = createFacilitySystem(() => allAgents, () => locations, () => locationActors, () => worldEntity);
		facilitySys.execute(deps);

		// Farmer should have earned gold
		const farmerWallet = farmer.get(WalletComponent);
		expect(farmerWallet.state.gold).toBeGreaterThan(50);

		// Bakery should have produced bread (wheat consumed)
		const bakeryFacility = bakeryActor.get(FacilityComponent);
		const bread = bakeryFacility.state.stock.find(s => s.item_id === 'bread');
		expect(bread?.quantity).toBe(1);

		// Phase 2: Buyer buys bread from bakery
		const buyerBb = buyer.get(BlackboardComponent);
		buyerBb.state = { ...buyerBb.state, btAction: 'buy' };
		buyerBb.markDirty();

		const tradeSys = createTradeSystem(() => allAgents, () => locations, () => locationActors, () => worldEntity);
		tradeSys.execute(deps);

		const buyerWallet = buyer.get(WalletComponent);
		expect(buyerWallet.state.gold).toBe(48); // 50 - 2

		const buyerInv = buyer.get(InventoryComponent);
		expect(buyerInv.state.items).toContainEqual({ item_id: 'bread', quantity: 1 });

		// Phase 3: Buyer eats bread
		buyerBb.state = { ...buyerBb.state, btAction: 'eat' };
		buyerBb.markDirty();

		const feedSys = createFeedSystem(() => allAgents, () => worldEntity);
		feedSys.execute(deps);

		const buyerNeeds = buyer.get(NeedsComponent);
		expect(buyerNeeds.state.hunger).toBeGreaterThan(40);

		const buyerInvAfter = buyer.get(InventoryComponent);
		const breadAfter = buyerInvAfter.state.items.find(i => i.item_id === 'bread');
		expect(breadAfter).toBeUndefined();

		// Ledger should have entries
		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run integration test**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/economy-integration.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/economy-integration.test.ts"
git commit -m "test(meridian): Phase 2E economy integration — full work-buy-eat cycle"
```

---

### Task E4: Smoke Test + README Updates

**Files:**
- Modify: `tests/integration/smoke-test.test.ts`
- Modify: `scripts/generate-readme.mjs`

- [ ] **Step 1: Update smoke test**

Add economy scenario to the existing smoke test. The smoke test's `createFeedSystem` call needs updating to the new signature. Also update all system wiring to match new signatures.

Update the system registration in the smoke test to include new systems and updated signatures:

```typescript
// In the smoke test's tick runner setup:
tickRunner.register(createFeedSystem(getAgents, getWorldEntity));
tickRunner.register(createRestSystem(getAgents, getLocations, getWorldEntity));
tickRunner.register(createDayNightSystem(getWorldEntity, getAgents, getLocationActors, getLocations));
// Add new systems:
tickRunner.register(createFacilitySystem(getAgents, getLocations, getLocationActors, getWorldEntity));
tickRunner.register(createTradeSystem(getAgents, getLocations, getLocationActors, getWorldEntity));
```

Add a new test case:

```typescript
it('economy: agent earns gold from facility work', () => {
	// Setup agent at farm with farmer job, run 30+ ticks, verify gold increased
	// This is a smoke test -- just verify no crashes
});
```

- [ ] **Step 2: Update README generator**

In `scripts/generate-readme.mjs`, add a section for the economy:

- Add FacilitySystem (priority 6) and TradeSystem (priority 11) to the system pipeline table
- Document production chain: Farm -> wheat, Bakery -> bread (requires wheat), Workshop -> leather-goods
- Document economy config values
- Document daily reports location

- [ ] **Step 3: Run full suite + build, commit**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts && npm run build
git add "01 - Projects/Project Meridian/tests/integration/smoke-test.test.ts" "01 - Projects/Project Meridian/scripts/generate-readme.mjs"
git commit -m "feat(meridian): Phase 2E smoke test + README updates — economy documentation"
```

---

### Task E5: Full Verification

- [ ] **Step 1: Run complete quality gates**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ tests/ --config configs/eslint.config.mjs
npx vitest run --config configs/vitest.config.ts
npm run build
```

Expected: 0 errors, 0 warnings, all tests pass (existing + 50+ new), build succeeds.

- [ ] **Step 2: Verify exit criteria**

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | FacilitySystem iterates facilities, checks worker + input, produces goods | facility.test.ts + facility-system.test.ts |
| 2 | Farm produces wheat, Bakery consumes wheat and produces bread | facility-system.test.ts (bakery test) |
| 3 | Workshop produces tools | workshop production block in JSON + FacilitySystem |
| 4 | TradeSystem processes buy action | trade.test.ts + trade-system.test.ts |
| 5 | FeedSystem consumes from inventory | food-items.test.ts + feed-system.test.ts |
| 6 | RestSystem deducts gold for public_shelter | rest-system.test.ts |
| 7 | No gold = no food (must work) | BT has_gold + can_afford conditions |
| 8 | Tax collected on wages | facility-system.test.ts |
| 9 | Economy ledger tracks transactions | economy-integration.test.ts |
| 10 | Daily report written to vault | day-night-system (writeFile) |
| 11 | Relationship tracking | relationship.test.ts + system-level updates |
| 12 | Skill progression | skill-progression.test.ts + FacilitySystem |
| 13 | BTs restructured with economic conditions | bt-conditions.test.ts + JSON files |
| 14 | New actions: buy, seek_market | bt-actions.ts + BT JSON |
| 15 | Welfare safety net | DayNightSystem welfare check |
| 16 | Daytime-only work guard | time_is day in BT JSONs |
| 17 | All Phase 0-1D tests pass | Full suite run |
| 18 | 50+ new tests | Test count in suite output |
| 19 | tsc, eslint, build green | Quality gate output |

- [ ] **Step 3: Final commit**

```bash
git add "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 2E complete — economy + social foundation"
```

---

## Learnings-Driven Requirements

These items reflect lessons from Phases 1B-1D. They are NOT optional.

### Test Fixture Requirements

ALL test agent fixtures MUST include these fields:

```typescript
// Required in every createTestAgentData helper:
color: '#b0b0b0',
persona: null,
property: [],
inventory: [],
wallet: { gold: 50 },
job: null,
```

When adding WalletComponent and InventoryComponent to AgentActor (Task A3), ALL existing test fixture helpers across the codebase must be updated to include proper `inventory` and `wallet` data. Grep for `createTestAgent` across `tests/` -- there are ~13 files.

### Spread-Copy Pattern

ALL component state mutations MUST use the spread-copy pattern:

```typescript
// CORRECT:
wallet.state = { ...wallet.state, gold: wallet.state.gold + amount };
wallet.markDirty();

// WRONG (direct mutation):
wallet.state.gold += amount;
```

### Config-Driven Values

NEVER hardcode numbers in infrastructure systems. ALL tuning values come from `GameConfigSchema`:

```typescript
// CORRECT:
const price = deps.config.economy.food_price;

// WRONG:
const price = 2;
```

### Centralized Event Debug Logging

The `eventBus.onAny()` handler already exists in `game-view.ts`. Do NOT add per-system `deps.logger.debug()` calls for event emissions -- they clutter the output. Only use `deps.logger.debug()` for system-specific diagnostic information (e.g., BT action transitions).

### WorldLoader

No changes to `world-loader.ts` are needed. The new systems read from `deps.config` (already available), entity component queries, and the new location actor references. State this explicitly when implementing so subagents do not wonder.

### Section 9 Documentation

After implementation completes, update the Phase 2E spec (`docs/specs/2026-03-29-phase2e-economy-design.md`) Section 9: Post-Implementation Notes with:
- Final test count
- Any deviations from spec
- Additional artifacts created

### Three Amigos Review + Polish

After all tasks complete and before merging: run a Three Amigos review (PO spec compliance, Architect code quality, Tester coverage gaps) followed by a polishing pass. This is standard procedure -- do not skip.

---

## Summary

| Chunk | Tasks | New Files | Modified Files | Estimated Tests |
|-------|-------|-----------|----------------|-----------------|
| A: Schema + Config + Components | A1-A4 | 7 | 18 | 12 |
| B: Pure Domain Functions | B1-B6 | 12 | 0 | 44 |
| C: BT Conditions + Data | C1-C3 | 1 | 9 | 14 |
| D: Infrastructure Systems | D1-D5 | 4 | 5 | 20 |
| E: Wiring + Integration | E1-E5 | 1 | 5 | 5 |
| **Total** | **22 tasks** | **25 files** | **37 files** | **~95 tests** |

**Dependency chain:** A -> B (independent) + C (depends on A) -> D (depends on A+B+C) -> E (depends on all)
