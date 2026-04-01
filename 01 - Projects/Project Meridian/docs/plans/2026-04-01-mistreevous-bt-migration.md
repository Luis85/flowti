# Mistreevous BT Migration & Economy Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom BT engine with mistreevous, introduce typed BehaviorAgent objects replacing the stringly-typed blackboard, agent-carried supply chain logistics, and fix the economy loop so 4 agents sustain themselves over multi-day simulation runs.

**Architecture:** Layered BT composition (shared base MDSL + per-role branch MDSL) with mistreevous's RUNNING state and guard system eliminating oscillation bugs. BehaviorAgent objects serve as the mistreevous agent interface — typed getters proxy ECS component state, action methods return `State.RUNNING`/`SUCCEEDED`/`FAILED`. Three systems (FeedSystem, TradeSystem, old BehaviorTreeSystem) collapse into BehaviorAgent action methods. Economy fixes: tavern gets a proper fund, facilities get treasury subsidies, non-production agents get stipends, bakery auto-processes without a worker.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), mistreevous 4.3.1 (BT engine), Zod (schema validation), Vitest, ESLint

**Design Spec:** `docs/specs/2026-04-01-mistreevous-economy-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`behavior-agent.ts`, `cargo.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **ESLint:** `npx eslint src/ tests/ --config configs/eslint.config.mjs` — 0 errors
- **TypeScript:** `npx tsc --noEmit --project configs/tsconfig.json` — 0 errors
- **Full test:** `npx vitest run --config configs/vitest.config.ts` — all tests pass
- **No magic numbers** in infrastructure/systems/ — use named constants or config values
- **Spread-copy pattern** for all component state mutations (e.g., `comp.state = { ...comp.state, field: value }`)
- **Config-driven** — use values from `GameConfigSchema`, never hardcoded numbers in infrastructure

---

## Chunk A: Schema, Config & Data Foundation

Everything in this chunk is foundation — all subsequent chunks depend on it. No game behavior changes yet; these are pure data/type changes.

### Task A1: Install mistreevous

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mistreevous**

```bash
cd "01 - Projects/Project Meridian" && npm install --save-dev mistreevous
```

- [ ] **Step 2: Verify installation**

```bash
cd "01 - Projects/Project Meridian" && node -e "import('mistreevous').then(m => console.log(typeof m.BehaviourTree))"
```

Expected: `function`

- [ ] **Step 3: Verify build still passes**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/package.json" "01 - Projects/Project Meridian/package-lock.json"
git commit -m "chore(meridian): install mistreevous 4.3.1 BT engine"
```

---

### Task A2: Add CargoState and remove BlackboardState from component-data.ts

**Files:**
- Modify: `src/domain/core/component-data.ts`
- Test: existing tests should still compile (BlackboardState removal is deferred until consumers are updated)

- [ ] **Step 1: Add CargoState interface**

In `src/domain/core/component-data.ts`, add after the existing `InventoryState` interface:

```typescript
export interface CargoState {
	itemId: string;
	quantity: number;
	source: string;
	destination: string;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts"
git commit -m "feat(meridian): add CargoState type for agent-carried logistics"
```

---

### Task A3: Extend ProductionSchema with auto_process fields

**Files:**
- Modify: `src/domain/schemas/location-schema.ts`
- Test: `tests/domain/schemas/location-schema.test.ts` (if exists, else schema is tested via integration)

- [ ] **Step 1: Add auto_process fields to ProductionSchema**

In `src/domain/schemas/location-schema.ts`, add two fields to the `ProductionSchema` object:

```typescript
export const ProductionSchema = z.object({
	job: z.string(),
	output: ProductionOutputSchema,
	input: ProductionInputSchema.nullable().default(null),
	wage: z.number().default(5),
	ticks_per_cycle: z.number().int().default(30),
	auto_process: z.boolean().default(false),
	auto_ticks_per_cycle: z.number().int().default(60),
}).nullable().default(null);
```

- [ ] **Step 2: Verify types compile and all tests pass**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/location-schema.ts"
git commit -m "feat(meridian): add auto_process fields to ProductionSchema"
```

---

### Task A4: Extend EconomyConfigSchema with new fields

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts`

- [ ] **Step 1: Update EconomyConfigSchema**

In `src/domain/schemas/game-config-schema.ts`, replace the existing `EconomyConfigSchema` with:

```typescript
const EconomyConfigSchema = z.object({
	tax_base_rate: z.number().min(0).max(1).default(0.10),
	price_clamp_min: z.number().default(0.5),
	price_clamp_max: z.number().default(3.0),
	recalculation_interval_ticks: z.number().int().default(10),
	welfare_threshold_gold: z.number().default(10),
	welfare_reward_min: z.number().default(15),
	welfare_reward_max: z.number().default(25),
	max_active_welfare_quests: z.number().int().default(3),
	treasury_start_sandbox: z.number().default(1000),
	treasury_regen_per_day: z.number().default(50),
	circulation_floor_per_agent: z.number().default(50),
	loan_interest_per_day: z.number().default(0.01),
	food_price: z.number().default(3),
	rest_price: z.number().default(1),
	facility_start_fund: z.number().default(200),
	ledger_retention_days: z.number().int().default(7),
	guard_stipend: z.number().default(2),
	merchant_stipend: z.number().default(8),
	facility_subsidy_threshold: z.number().default(100),
	facility_subsidy_per_day: z.number().default(30),
});
```

Key changes from current:
- `tax_rate` → `tax_base_rate` (renamed, aligned with economy depth spec)
- Default from `0.05` → `0.10`
- `treasury_start_sandbox` from `500` → `1000`
- `treasury_regen_per_day` from `1` → `50`
- `food_price` from `2` → `3`
- New: `guard_stipend`, `merchant_stipend`, `facility_subsidy_threshold`, `facility_subsidy_per_day`

- [ ] **Step 2: Update any references to `tax_rate` in the codebase**

Search for `tax_rate` references and rename to `tax_base_rate`:

```bash
cd "01 - Projects/Project Meridian" && grep -rn "tax_rate" src/ tests/ --include="*.ts"
```

Update each reference found. The main location is `src/domain/systems/facility.ts` and `src/infrastructure/systems/facility-system.ts` where tax is applied on wages.

- [ ] **Step 3: Verify types compile and all tests pass**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/" "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): extend economy config — stipends, subsidies, rebalanced defaults"
```

---

### Task A5: Update agent JSON data files

**Files:**
- Modify: `agents/marcus.json`
- Modify: `agents/elena.json`
- Modify: `agents/wren.json`
- Modify: `agents/sable.json`

- [ ] **Step 1: Update marcus.json**

Change `"job": "farmer"` to `"job": "guard"` and `"behavior_tree": "bt-guard"` to `"behavior_tree": "guard"`.

- [ ] **Step 2: Update elena.json**

Change `"job": "baker"` to `"job": "merchant"` and `"behavior_tree": "bt-merchant"` to `"behavior_tree": "merchant"`.

- [ ] **Step 3: Update wren.json**

Keep `"job": "farmer"`. Change `"behavior_tree": "bt-scholar"` to `"behavior_tree": "scholar"`.

- [ ] **Step 4: Update sable.json**

Keep `"job": "leatherworker"`. Change `"behavior_tree": "bt-artisan"` to `"behavior_tree": "artisan"`.

- [ ] **Step 5: Verify data-validation integration test still passes**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/agents/"
git commit -m "fix(meridian): correct agent roles — unique jobs, no BT mismatches"
```

---

### Task A6: Update location JSON data files

**Files:**
- Modify: `locations/bakery.json`
- Modify: `locations/workshop.json`
- Modify: `locations/tavern.json`

- [ ] **Step 1: Update bakery.json**

Add `"auto_process": true` and `"auto_ticks_per_cycle": 40` to the production object.

- [ ] **Step 2: Update workshop.json**

Change `"wage": 5` to `"wage": 3`.

- [ ] **Step 3: Update tavern.json**

The tavern needs fund support for rest payments. Since it has no production, it doesn't use `ProductionSchema`. Instead, game-view.ts will add a `FacilityComponent` with `fund: 0` at runtime (Task D6). No JSON change needed here — but verify the tavern location file is valid and has `"type": "rest"`.

- [ ] **Step 4: Verify data loads correctly**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/locations/"
git commit -m "feat(meridian): bakery auto-process + workshop wage rebalance"
```

---

## Chunk B: BehaviorAgent Interface & BT Loader

This chunk creates the typed BehaviorAgent domain interface and the MDSL-based BT loader. No old code is deleted yet — new code runs alongside old code until Chunk C wires it in.

### Task B1: Create BehaviorAgent domain interface

**Files:**
- Create: `src/domain/systems/behavior-agent.ts`
- Test: `tests/domain/systems/behavior-agent.test.ts`

- [ ] **Step 1: Write the type test**

Create `tests/domain/systems/behavior-agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { BehaviorAgent, PerceivedAgent, PerceivedLocation, PerceivedFacility, CargoState } from '../../src/domain/systems/behavior-agent.js';

describe('BehaviorAgent interface', () => {
	it('defines all required condition methods', () => {
		const conditionNames: (keyof BehaviorAgent)[] = [
			'IsHungry', 'IsExhausted', 'IsLonely', 'NeedsCritical',
			'HasFood', 'HasGold', 'CanAffordFood',
			'AtLocation', 'NearLocation', 'NearAgent', 'NearAgentClose',
			'IsDaytime', 'IsNighttime',
			'HasJob', 'AtJobFacility', 'FacilityHasStock',
			'HasCargo', 'CargoDestinationNearby', 'FacilityNeedsSupply',
		];
		expect(conditionNames).toHaveLength(19);
	});

	it('defines all required action methods', () => {
		const actionNames: (keyof BehaviorAgent)[] = [
			'Eat', 'Rest', 'SeekFood', 'SeekRest', 'SeekWork',
			'SeekSocial', 'SeekMarket', 'Work', 'Talk', 'Buy',
			'PickupCargo', 'DeliverCargo', 'SeekDeliveryTarget',
			'SeekSupplySource', 'Idle', 'Wander',
		];
		expect(actionNames).toHaveLength(16);
	});

	it('exports supporting types', () => {
		const _agent: PerceivedAgent = { id: 'a', position: { x: 0, y: 0 }, distance: 0 };
		const _loc: PerceivedLocation = { id: 'l', type: 'food', position: { x: 0, y: 0 }, distance: 0 };
		const _fac: PerceivedFacility = { id: 'f', job: 'baker', stock: [], distance: 0, hasUnmetInput: false };
		const _cargo: CargoState = { itemId: 'wheat', quantity: 1, source: 'farm', destination: 'bakery' };
		expect(_agent).toBeDefined();
		expect(_loc).toBeDefined();
		expect(_fac).toBeDefined();
		expect(_cargo).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/behavior-agent.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the BehaviorAgent interface**

Create `src/domain/systems/behavior-agent.ts`:

```typescript
import type { CargoState, JourneyState } from '../core/component-data.js';

export interface PerceivedAgent {
	id: string;
	position: { x: number; y: number };
	distance: number;
}

export interface PerceivedLocation {
	id: string;
	type: string;
	position: { x: number; y: number };
	distance: number;
}

export interface PerceivedFacility {
	id: string;
	job: string;
	stock: { item_id: string; quantity: number }[];
	distance: number;
	hasUnmetInput: boolean;
}

export { type CargoState } from '../core/component-data.js';

export interface MovementTarget {
	id: string;
	type: 'agent' | 'location';
}

/** mistreevous State enum values used as return types */
export type ActionResult = 'mistreevous.succeeded' | 'mistreevous.failed' | 'mistreevous.running';

export interface BehaviorAgent {
	// ── State (proxied from ECS components, read-only) ──
	readonly hunger: number;
	readonly energy: number;
	readonly social: number;
	readonly gold: number;
	readonly mood: number;
	readonly moodBucket: string;
	readonly timePhase: string;
	readonly job: string | null;
	readonly position: { x: number; y: number };
	readonly inventory: { item_id: string; quantity: number }[];
	readonly nearbyAgents: PerceivedAgent[];
	readonly nearbyLocations: PerceivedLocation[];
	readonly nearbyFacilities: PerceivedFacility[];

	// ── BT working memory (owned by this object, NOT on ECS) ──
	movementTarget: MovementTarget | null;
	journey: JourneyState | null;
	atLocation: string | null;
	currentRegion: string | null;
	haulCargo: CargoState | null;
	socialCooldowns: Map<string, number>;
	committedAction: string | null;

	// ── Conditions (called by mistreevous) ──
	IsHungry(): boolean;
	IsExhausted(): boolean;
	IsLonely(): boolean;
	NeedsCritical(): boolean;
	HasFood(): boolean;
	HasGold(amount: number): boolean;
	CanAffordFood(): boolean;
	AtLocation(type: string): boolean;
	NearLocation(type: string): boolean;
	NearAgent(): boolean;
	NearAgentClose(): boolean;
	IsDaytime(): boolean;
	IsNighttime(): boolean;
	HasJob(): boolean;
	AtJobFacility(): boolean;
	FacilityHasStock(itemId: string): boolean;
	HasCargo(): boolean;
	CargoDestinationNearby(): boolean;
	FacilityNeedsSupply(): boolean;

	// ── Actions (called by mistreevous, return State) ──
	Eat(): ActionResult;
	Rest(): ActionResult;
	SeekFood(): ActionResult;
	SeekRest(): ActionResult;
	SeekWork(): ActionResult;
	SeekSocial(): ActionResult;
	SeekMarket(): ActionResult;
	Work(): ActionResult;
	Talk(): ActionResult;
	Buy(): ActionResult;
	PickupCargo(): ActionResult;
	DeliverCargo(): ActionResult;
	SeekDeliveryTarget(): ActionResult;
	SeekSupplySource(): ActionResult;
	Idle(): ActionResult;
	Wander(): ActionResult;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/behavior-agent.test.ts --config configs/vitest.config.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/tests/domain/systems/behavior-agent.test.ts"
git commit -m "feat(meridian): BehaviorAgent domain interface — typed BT contract"
```

---

### Task B2: Create cargo pure domain logic

**Files:**
- Create: `src/domain/systems/cargo.ts`
- Test: `tests/domain/systems/cargo.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/systems/cargo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickupCargo, deliverCargo } from '../../src/domain/systems/cargo.js';

describe('pickupCargo', () => {
	it('transfers 1 unit from facility stock to cargo', () => {
		const stock = [{ item_id: 'wheat', quantity: 5 }];
		const result = pickupCargo({ stock, itemId: 'wheat', source: 'loc-farm', destination: 'loc-bakery' });
		expect(result.cargo).toEqual({ itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-bakery' });
		expect(result.newStock).toEqual([{ item_id: 'wheat', quantity: 4 }]);
	});

	it('fails when item not in stock', () => {
		const stock = [{ item_id: 'bread', quantity: 3 }];
		const result = pickupCargo({ stock, itemId: 'wheat', source: 'loc-farm', destination: 'loc-bakery' });
		expect(result.cargo).toBeNull();
		expect(result.newStock).toEqual(stock);
	});

	it('removes item from stock when quantity reaches 0', () => {
		const stock = [{ item_id: 'wheat', quantity: 1 }];
		const result = pickupCargo({ stock, itemId: 'wheat', source: 'loc-farm', destination: 'loc-bakery' });
		expect(result.cargo).not.toBeNull();
		expect(result.newStock).toEqual([]);
	});
});

describe('deliverCargo', () => {
	it('adds cargo item to destination stock', () => {
		const stock = [{ item_id: 'bread', quantity: 2 }];
		const cargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-bakery' };
		const result = deliverCargo({ stock, cargo });
		expect(result).toEqual([
			{ item_id: 'bread', quantity: 2 },
			{ item_id: 'wheat', quantity: 1 },
		]);
	});

	it('increments existing item quantity', () => {
		const stock = [{ item_id: 'wheat', quantity: 3 }];
		const cargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-bakery' };
		const result = deliverCargo({ stock, cargo });
		expect(result).toEqual([{ item_id: 'wheat', quantity: 4 }]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/cargo.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement cargo.ts**

Create `src/domain/systems/cargo.ts`:

```typescript
import type { CargoState } from '../core/component-data.js';

interface StockItem {
	item_id: string;
	quantity: number;
}

interface PickupInput {
	stock: StockItem[];
	itemId: string;
	source: string;
	destination: string;
}

interface PickupResult {
	cargo: CargoState | null;
	newStock: StockItem[];
}

export function pickupCargo(input: PickupInput): PickupResult {
	const item = input.stock.find(s => s.item_id === input.itemId);
	if (item === undefined || item.quantity <= 0) {
		return { cargo: null, newStock: input.stock };
	}

	const newStock = input.stock
		.map(s => {
			if (s.item_id !== input.itemId) return { ...s };
			const newQty = s.quantity - 1;
			return newQty > 0 ? { ...s, quantity: newQty } : null;
		})
		.filter((s): s is StockItem => s !== null);

	return {
		cargo: { itemId: input.itemId, quantity: 1, source: input.source, destination: input.destination },
		newStock,
	};
}

interface DeliverInput {
	stock: StockItem[];
	cargo: CargoState;
}

export function deliverCargo(input: DeliverInput): StockItem[] {
	const existing = input.stock.find(s => s.item_id === input.cargo.itemId);
	if (existing !== undefined) {
		return input.stock.map(s =>
			s.item_id === input.cargo.itemId
				? { ...s, quantity: s.quantity + input.cargo.quantity }
				: { ...s },
		);
	}
	return [...input.stock.map(s => ({ ...s })), { item_id: input.cargo.itemId, quantity: input.cargo.quantity }];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/cargo.test.ts --config configs/vitest.config.ts
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/cargo.ts" "01 - Projects/Project Meridian/tests/domain/systems/cargo.test.ts"
git commit -m "feat(meridian): cargo pickup/deliver pure domain logic"
```

---

### Task B3: Create MDSL behavior tree files

**Files:**
- Create: `behavior-trees/base.mdsl`
- Create: `behavior-trees/branch-merchant.mdsl`
- Create: `behavior-trees/branch-artisan.mdsl`
- Create: `behavior-trees/branch-scholar.mdsl`
- Create: `behavior-trees/branch-guard.mdsl`

- [ ] **Step 1: Create base.mdsl**

Create `behavior-trees/base.mdsl` with the shared survival tree from spec §3.1.

- [ ] **Step 2: Create branch-merchant.mdsl**

Create `behavior-trees/branch-merchant.mdsl` with the merchant role from spec §3.2.

- [ ] **Step 3: Create branch-artisan.mdsl**

Create `behavior-trees/branch-artisan.mdsl` with the artisan role from spec §3.2.

- [ ] **Step 4: Create branch-scholar.mdsl**

Create `behavior-trees/branch-scholar.mdsl` with the scholar role from spec §3.2.

- [ ] **Step 5: Create branch-guard.mdsl**

Create `behavior-trees/branch-guard.mdsl` with the guard role from spec §3.2.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/"
git commit -m "feat(meridian): MDSL behavior tree definitions — base + 4 role branches"
```

---

### Task B4: Rewrite BT loader for MDSL + composition

**Files:**
- Modify: `src/infrastructure/entity/bt-loader.ts`
- Test: `tests/infrastructure/entity/bt-loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create/overwrite `tests/infrastructure/entity/bt-loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createMDSLLoader } from '../../src/infrastructure/entity/bt-loader.js';

const mockVault = {
	async list(_path: string) { return []; },
	async read(path: string) {
		const files: Record<string, string> = {
			'bt/base.mdsl': 'root { selector { branch [Role] action [Idle] } }',
			'bt/branch-guard.mdsl': 'root [Role] { selector { action [Wander] } }',
		};
		const content = files[path];
		if (content === undefined) throw new Error(`File not found: ${path}`);
		return content;
	},
};

const mockLogger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

describe('createMDSLLoader', () => {
	it('composes base + branch MDSL into a single string', async () => {
		const loader = createMDSLLoader(mockLogger);
		const result = await loader.loadComposed(mockVault, 'bt/base.mdsl', 'bt/branch-guard.mdsl');
		expect(result.mdsl).toContain('branch [Role]');
		expect(result.mdsl).toContain('root [Role]');
		expect(result.errors).toHaveLength(0);
	});

	it('returns error when base file is missing', async () => {
		const loader = createMDSLLoader(mockLogger);
		const result = await loader.loadComposed(mockVault, 'bt/missing.mdsl', 'bt/branch-guard.mdsl');
		expect(result.mdsl).toBeNull();
		expect(result.errors).toHaveLength(1);
	});

	it('validates composed MDSL via mistreevous', async () => {
		const loader = createMDSLLoader(mockLogger);
		const result = await loader.loadComposed(mockVault, 'bt/base.mdsl', 'bt/branch-guard.mdsl');
		expect(result.valid).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-loader.test.ts --config configs/vitest.config.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the MDSL loader**

Rewrite `src/infrastructure/entity/bt-loader.ts`:

```typescript
import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { convertMDSLToJSON, validateDefinition } from 'mistreevous';

export interface MDSLLoadResult {
	mdsl: string | null;
	valid: boolean;
	errors: { file: string; message: string }[];
}

export function createMDSLLoader(
	logger: Logger,
): { loadComposed(vault: VaultReader, basePath: string, branchPath: string): Promise<MDSLLoadResult> } {
	return {
		async loadComposed(vault: VaultReader, basePath: string, branchPath: string): Promise<MDSLLoadResult> {
			const errors: { file: string; message: string }[] = [];

			let baseMdsl: string;
			try {
				baseMdsl = await vault.read(basePath);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error('MDSLLoader', `Failed to read base MDSL: ${basePath}`, { error: message });
				errors.push({ file: basePath, message });
				return { mdsl: null, valid: false, errors };
			}

			let branchMdsl: string;
			try {
				branchMdsl = await vault.read(branchPath);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error('MDSLLoader', `Failed to read branch MDSL: ${branchPath}`, { error: message });
				errors.push({ file: branchPath, message });
				return { mdsl: null, valid: false, errors };
			}

			const composed = `${baseMdsl}\n\n${branchMdsl}`;

			try {
				const json = convertMDSLToJSON(composed);
				validateDefinition(json);
				logger.info('MDSLLoader', `Composed and validated MDSL: ${basePath} + ${branchPath}`);
				return { mdsl: composed, valid: true, errors };
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error('MDSLLoader', `MDSL validation failed`, { error: message });
				errors.push({ file: `${basePath}+${branchPath}`, message });
				return { mdsl: composed, valid: false, errors };
			}
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-loader.test.ts --config configs/vitest.config.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-loader.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-loader.test.ts"
git commit -m "feat(meridian): MDSL BT loader with base+branch composition"
```

---

## Chunk C: BehaviorAgent Factory & Survival Actions (Elena Vertical Slice)

This chunk implements the BehaviorAgent factory (infrastructure layer) with survival conditions/actions. Elena is used as the proving ground — by the end of this chunk, she can eat, rest, seek food, and buy bread. The old BT system is not deleted yet; the new system is wired in alongside.

### Task C1: Create BehaviorAgent factory — conditions

**Files:**
- Create: `src/infrastructure/entity/behavior-agent-factory.ts`
- Test: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

This is a large file. Implement in two sub-tasks: conditions first (C1), then actions (C2).

- [ ] **Step 1: Write failing tests for conditions**

Create `tests/infrastructure/entity/behavior-agent-factory.test.ts` with tests for each condition method. Use a test helper that creates a minimal `AgentActor` with known component values.

Test each condition:
- `IsHungry()` returns true when hunger < config threshold
- `IsExhausted()` returns true when energy < config threshold
- `IsLonely()` returns true when social < config threshold
- `NeedsCritical()` returns true when any need < critical threshold
- `HasFood()` returns true when inventory contains bread
- `HasGold(amount)` returns true when gold >= amount
- `CanAffordFood()` returns true when gold >= food_price
- `AtLocation(type)` returns true when atLocation matches a location of that type
- `NearLocation(type)` returns true when nearbyLocations contains a location of that type
- `NearAgent()` returns true when nearbyAgents is non-empty
- `NearAgentClose()` returns true when any nearbyAgent distance < interaction_radius
- `IsDaytime()` returns true when timePhase is 'day'
- `IsNighttime()` returns true when timePhase is 'night'
- `HasJob()` returns true when job is not null
- `AtJobFacility()` returns true when atLocation matches agent's job facility
- `FacilityHasStock(itemId)` returns true when any nearby facility has that item
- `HasCargo()` returns true when haulCargo is not null
- `CargoDestinationNearby()` returns true when cargo destination is in nearbyLocations
- `FacilityNeedsSupply()` returns true when any nearby facility has hasUnmetInput=true

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/behavior-agent-factory.test.ts --config configs/vitest.config.ts
```

Expected: FAIL

- [ ] **Step 3: Implement createBehaviorAgent — condition methods**

Create `src/infrastructure/entity/behavior-agent-factory.ts`. Implement the factory function with:
- Getter-based proxies for all read-only state (hunger, energy, social, gold, mood, etc.)
- All 19 condition methods reading from the proxied state
- Stub action methods (returning `'mistreevous.failed'`) — implemented in Task C2

The factory uses the closure pattern — it captures `actor`, `locations`, `locationActors`, `worldEntity`, `config` and creates an object with getters that read live component state.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/behavior-agent-factory.test.ts --config configs/vitest.config.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/behavior-agent-factory.test.ts"
git commit -m "feat(meridian): BehaviorAgent factory — 19 typed condition methods"
```

---

### Task C2: Implement survival action methods

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Test: `tests/infrastructure/entity/behavior-agent-factory.test.ts` (extend)

- [ ] **Step 1: Write failing tests for survival actions**

Add tests for: `Eat`, `Rest`, `SeekFood`, `SeekRest`, `Buy`, `Idle`, `Wander`.

Each test creates a BehaviorAgent, sets up the necessary state, calls the action, and asserts:
- Correct `ActionResult` return value (`RUNNING`, `SUCCEEDED`, `FAILED`)
- Correct side effects on components (hunger change, gold deduction, movement target set, etc.)

Key tests:
- `Eat()` returns RUNNING and decreases food quantity in inventory, increases hunger
- `Eat()` returns FAILED when no food in inventory
- `Rest()` returns RUNNING and increases energy
- `SeekFood()` sets movementTarget to nearest food location and returns RUNNING
- `SeekFood()` returns SUCCEEDED when already at food location
- `Buy()` deducts gold, adds bread to inventory, returns SUCCEEDED
- `Buy()` returns FAILED when insufficient gold
- `Idle()` always returns RUNNING
- `Wander()` always returns RUNNING

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement survival actions**

In the factory, replace stub action methods with real implementations:
- `Eat()`: calls `applyFeed()` from domain, updates NeedsComponent and InventoryComponent
- `Rest()`: calls `applyRest()` from domain, updates NeedsComponent, deducts gold for public_shelter
- `SeekFood()`: finds nearest food facility via nearbyLocations, sets movementTarget, returns RUNNING
- `SeekRest()`: finds nearest rest location, sets movementTarget, returns RUNNING
- `Buy()`: finds nearest facility with food stock, calls `applyTrade()`, updates wallet and inventory
- `Idle()`: returns RUNNING
- `Wander()`: sets a random nearby movementTarget, returns RUNNING

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/behavior-agent-factory.test.ts"
git commit -m "feat(meridian): BehaviorAgent survival actions — Eat, Rest, Buy, Seek*"
```

---

### Task C3: Implement merchant + work actions

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Test: `tests/infrastructure/entity/behavior-agent-factory.test.ts` (extend)

- [ ] **Step 1: Write failing tests for remaining actions**

Add tests for: `Work`, `Talk`, `SeekWork`, `SeekSocial`, `SeekMarket`, `PickupCargo`, `DeliverCargo`, `SeekDeliveryTarget`, `SeekSupplySource`.

Key tests:
- `Work()` returns RUNNING when at job facility during daytime
- `Work()` returns FAILED when not at job facility
- `Talk()` returns RUNNING when near another agent
- `PickupCargo()` transfers 1 unit from facility stock to haulCargo
- `PickupCargo()` returns FAILED when facility has no stock
- `DeliverCargo()` deposits cargo at destination facility stock, clears haulCargo
- `SeekDeliveryTarget()` sets movementTarget to cargo destination
- `SeekSupplySource()` sets movementTarget to facility with unmet input

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement remaining actions**

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/behavior-agent-factory.test.ts"
git commit -m "feat(meridian): BehaviorAgent work + merchant actions — full action set"
```

---

### Task C4: Rewrite BehaviorTreeSystem as thin step() caller

**Files:**
- Modify: `src/infrastructure/systems/behavior-tree-system.ts`
- Test: `tests/infrastructure/systems/behavior-tree-system.test.ts` (rewrite)

- [ ] **Step 1: Write failing tests for new BT system**

The new system simply iterates agents and calls `tree.step()`. Test that:
- `execute()` calls `step()` on each agent's BehaviourTree
- System priority is `SystemPriority.BEHAVIOR_TREE`
- System name is `'BehaviorTreeSystem'`

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Rewrite behavior-tree-system.ts**

Replace the entire file with a thin system that:
1. Takes a `agents: () => AgentActor[]` factory
2. In `execute()`, iterates agents and calls `agent.behaviorTree.step()` on each
3. Has no knowledge of BTContext, evaluateBT, or BlackboardComponent

The system signature changes from:
```typescript
createBehaviorTreeSystem(agents, btDefinitions, worldEntity, baseSeed, locationActors, locations, regions, regionGraph)
```
To:
```typescript
createBehaviorTreeSystem(agents: () => AgentActor[]): GameSystem
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts"
git commit -m "feat(meridian): BehaviorTreeSystem rewrite — thin mistreevous step() caller"
```

---

## Chunk D: Wire Everything Together — System Migration

This chunk updates AgentActor, AgentSpawner, and game-view to use the new BehaviorAgent + mistreevous pipeline. Updates all systems that read BlackboardComponent to read from BehaviorAgent instead. Deletes old code.

### Task D1: Update AgentActor — remove BlackboardComponent, add BehaviorAgent refs

**Files:**
- Modify: `src/infrastructure/entity/agent-actor.ts`

- [ ] **Step 1: Update AgentActor class**

Remove `BlackboardComponent` import and `addComponent(new BlackboardComponent({}))`.
Add public fields for the BehaviorAgent and BehaviourTree instances:

```typescript
import type { BehaviorAgent } from '../../domain/systems/behavior-agent.js';
import type { BehaviourTree } from 'mistreevous';

export class AgentActor extends Actor {
	// ... existing fields ...
	behaviorAgent!: BehaviorAgent;
	behaviorTree!: BehaviourTree;
	// ... constructor stays same minus BlackboardComponent ...
}
```

The `!` non-null assertion is used because these are set by the spawner after construction (mistreevous needs the actor to exist before creating the agent object).

- [ ] **Step 2: Do NOT commit yet**

This change will cause compilation errors in files that import BlackboardComponent. Tasks D2-D4 fix all consumers. The entire D1-D4 batch is committed atomically at the end of D4.

---

### Task D2: Update AgentSpawner — construct BehaviorAgent + BehaviourTree per agent

**Files:**
- Modify: `src/infrastructure/entity/agent-spawner.ts`

- [ ] **Step 1: Update spawnFromVault to construct BehaviorAgent and BehaviourTree**

After creating each `AgentActor`, the spawner needs access to locations, locationActors, worldEntity, config, and the MDSL loader to:
1. Load the composed MDSL (base + branch) for the agent's kind
2. Create the BehaviorAgent via factory
3. Create the BehaviourTree with the composed MDSL, agent object, and options
4. Assign both to the AgentActor

The spawner signature needs to expand to accept these dependencies.

- [ ] **Step 2: Commit**

---

### Task D3: Update movement-system.ts — read from BehaviorAgent

**Files:**
- Modify: `src/infrastructure/systems/movement-system.ts`
- Modify: `tests/infrastructure/systems/movement-system.test.ts`

- [ ] **Step 1: Replace BlackboardComponent reads with BehaviorAgent reads**

Change all `agent.get(BlackboardComponent)` to `agent.behaviorAgent`:
- `bb.state.movementTarget` → `agent.behaviorAgent.movementTarget`
- `bb.state.journey` → `agent.behaviorAgent.journey`
- `bb.state.atLocation` → `agent.behaviorAgent.atLocation`
- `bb.state.currentRegion` → `agent.behaviorAgent.currentRegion`

Write operations follow the same pattern — write directly to the BehaviorAgent properties.

- [ ] **Step 2: Update tests**

- [ ] **Step 3: Verify tests pass**

- [ ] **Step 4: Commit**

---

### Task D4: Update ALL remaining systems that use BlackboardComponent

**Files:**
- Modify: `src/infrastructure/systems/socialize-system.ts`
- Modify: `src/infrastructure/systems/dialogue-system.ts`
- Modify: `src/infrastructure/systems/gossip-system.ts`
- Modify: `src/infrastructure/systems/perception-system.ts`
- Modify: `src/infrastructure/systems/needs-decay-system.ts` (reads `traitModifiers` from blackboard)
- Modify: `src/infrastructure/systems/facility-system.ts` (reads `btAction` from blackboard)
- Modify: `src/infrastructure/systems/rest-system.ts` (reads `btAction`, `restingAt` from blackboard)
- Update corresponding test files for all above systems

**Important:** Run `grep -rn "BlackboardComponent\|blackboard" src/ --include="*.ts"` before starting to find ALL references. Every one must be migrated.

- [ ] **Step 1: Replace BlackboardComponent reads in each system**

Each system follows the same pattern: replace `agent.get(BlackboardComponent).state.xxx` with `agent.behaviorAgent.xxx`.

For `needs-decay-system.ts`: the `traitModifiers` data currently lives on the blackboard. Move it to a property on BehaviorAgent (already defined as BT working memory). The `TraitResolverSystem` writes trait modifiers once at startup — it should write to `agent.behaviorAgent.traitModifiers` instead of the blackboard.

For `facility-system.ts`: reads `btAction` to check if an agent is working. Replace with reading from `agent.behaviorAgent.committedAction`.

For `rest-system.ts`: reads `btAction` and `restingAt`. Replace with BehaviorAgent properties.

- [ ] **Step 2: Update corresponding tests for all modified systems**

- [ ] **Step 3: Verify all tests pass**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 4: Verify types compile**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 5: Atomic commit for entire D1-D4 batch**

```bash
git add "01 - Projects/Project Meridian/src/" "01 - Projects/Project Meridian/tests/"
git commit -m "feat(meridian): migrate all systems from BlackboardComponent to BehaviorAgent"
```

---

### Task D5: Delete old BT code and BlackboardComponent

**Files:**
- Delete: `src/domain/systems/behavior-tree.ts`
- Delete: `src/domain/systems/bt-actions.ts`
- Delete: `src/domain/systems/bt-conditions.ts`
- Delete: `src/domain/systems/bt-lint.ts`
- Delete: `src/infrastructure/components/blackboard-component.ts`
- Delete: `src/infrastructure/systems/feed-system.ts`
- Delete: `src/infrastructure/systems/trade-system.ts`
- Delete: `behavior-trees/bt-guard.json`
- Delete: `behavior-trees/bt-merchant.json`
- Delete: `behavior-trees/bt-artisan.json`
- Delete: `behavior-trees/bt-scholar.json`
- Delete corresponding test files

- [ ] **Step 1: Delete all listed source and test files**

- [ ] **Step 2: Remove BlackboardState from component-data.ts**

- [ ] **Step 3: Clean up `tests/infrastructure/components/game-components.test.ts`**

Remove the `BlackboardComponent` import and `describe('BlackboardComponent')` test block from this file.

- [ ] **Step 4: Remove imports of deleted modules from game-view.ts and other consumers**

- [ ] **Step 5: Verify all tests pass**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 6: Verify types compile**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 7: Verify lint passes**

```bash
cd "01 - Projects/Project Meridian" && npx eslint src/ tests/ --config configs/eslint.config.mjs
```

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(meridian): remove old BT engine, BlackboardComponent, FeedSystem, TradeSystem"
```

---

### Task D6: Update game-view.ts — wire new system registrations

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Update populateScene**

In the `populateScene` method:
1. Add FacilityComponent to tavern location (even though `production: null`)
2. Update treasury start to use new config value (1000)
3. Remove old system imports (createFeedSystem, createTradeSystem, old createBehaviorTreeSystem)
4. Add new system imports
5. Update the `createBehaviorTreeSystem` call to use the new thin signature
6. Remove `createFeedSystem` and `createTradeSystem` registrations

- [ ] **Step 2: Verify types compile and tests pass**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(meridian): wire new BT + economy systems in game-view"
```

---

## Chunk E: Economy Fixes

This chunk implements the economy mechanisms: facility auto-process, treasury regen, stipends, facility subsidies, and tavern fund fix.

### Task E1: Add facility auto-process logic

**Files:**
- Modify: `src/domain/systems/facility.ts`
- Modify: `src/infrastructure/systems/facility-system.ts`
- Test: `tests/domain/systems/facility.test.ts` (extend)
- Test: `tests/infrastructure/systems/facility-system.test.ts` (extend)

- [ ] **Step 1: Write failing test for auto-process**

Test that `applyFacilityTick()` with `hasWorker: false` and `autoProcess: true` produces output at the slower `autoTicksPerCycle` rate.

- [ ] **Step 2: Implement auto-process in domain**

Extend `applyFacilityTick` input with `autoProcess: boolean` and `autoTicksPerCycle: number`. When `hasWorker` is false and `autoProcess` is true, use `autoTicksPerCycle` instead of `ticksPerCycle`, produce output, but pay no wages.

- [ ] **Step 3: Wire in facility-system.ts**

Read `loc.production.auto_process` and `loc.production.auto_ticks_per_cycle` from location data and pass to `applyFacilityTick`.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meridian): facility auto-process — bakery produces bread without worker"
```

---

### Task E2: Add stipends, subsidies, and treasury regen to DayNightSystem

**Files:**
- Modify: `src/infrastructure/systems/day-night-system.ts`
- Test: `tests/infrastructure/systems/day-night-system.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

Test that at day boundary:
- Treasury regen adds `treasury_regen_per_day` to treasury
- Guard agents receive `guard_stipend` from treasury (treasury decreases, wallet increases)
- Merchant agents receive `merchant_stipend` from treasury
- Stipends are skipped when treasury is empty, and `StipendSkipped` event is emitted
- Facilities with fund < `facility_subsidy_threshold` receive `facility_subsidy_per_day`

- [ ] **Step 2: Implement in processDayBoundary**

Add to the day boundary logic in order:
1. Treasury regen: `treasury += config.economy.treasury_regen_per_day`
2. Welfare (existing)
3. Stipends: iterate agents, pay based on job (`guard` → guard_stipend, `merchant` → merchant_stipend)
4. Facility subsidies: iterate facilities, top up if fund < threshold
5. Daily report (existing)

Each payment creates a ledger entry and emits an event.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meridian): treasury regen, stipends, facility subsidies at day boundary"
```

---

### Task E3: Fix rest-system.ts — tavern fund payment

**Files:**
- Modify: `src/infrastructure/systems/rest-system.ts`
- Test: `tests/infrastructure/systems/rest-system.test.ts` (extend)

- [ ] **Step 1: Write failing test**

Test that when an agent pays for public_shelter rest, the gold is credited to the tavern's FacilityComponent fund (not just logged in ledger).

- [ ] **Step 2: Fix the gold sink bug**

In rest-system.ts, after deducting gold from the agent's wallet and recording the ledger entry, find the tavern's FacilityComponent and credit the fund:

```typescript
const tavernActor = locationActors().get(nearestRest.id);
if (tavernActor !== undefined) {
	const tavernFacility = tavernActor.get(FacilityComponent);
	if (tavernFacility !== undefined) {
		tavernFacility.state = { ...tavernFacility.state, fund: tavernFacility.state.fund + restPrice };
		tavernFacility.markDirty();
	}
}
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(meridian): rest payment credits tavern facility fund — no more gold sink"
```

---

### Task E4: Make TraitResolverSystem compute-once

**Files:**
- Modify: `src/infrastructure/systems/trait-resolver-system.ts`
- Test: `tests/infrastructure/systems/trait-resolver-system.test.ts`

- [ ] **Step 1: Modify system to compute once**

Add a `computed: boolean` flag (captured in closure). On first `execute()`, resolve all traits and write results to each agent's BehaviorAgent. On subsequent calls, skip.

- [ ] **Step 2: Run tests**

- [ ] **Step 3: Commit**

```bash
git commit -m "perf(meridian): TraitResolverSystem computes once at startup, not per-tick"
```

---

## Chunk F: Integration Tests & Multi-Day Balance Smoke

### Task F1: Mistreevous integration test — Elena vertical slice

**Files:**
- Create: `tests/integration/mistreevous-integration.test.ts`

- [ ] **Step 1: Write integration test**

Test a multi-tick simulation with Elena (merchant):
1. Create a minimal world with Farm, Bakery, Market, Tavern
2. Spawn Elena with merchant BT
3. Run 100 ticks
4. Assert: Elena has moved (position changed from start)
5. Assert: Elena has picked up cargo at some point (or is carrying cargo)
6. Assert: Elena's needs have decayed and been partially recovered

- [ ] **Step 2: Run test**

- [ ] **Step 3: Commit**

```bash
git commit -m "test(meridian): mistreevous integration — Elena vertical slice"
```

---

### Task F2: Full 4-agent multi-day balance smoke test

**Files:**
- Modify: `tests/integration/balance-smoke.test.ts`

- [ ] **Step 1: Update balance-smoke test**

Update to use the new system wiring (no BlackboardComponent references). Run 960 ticks (2 full in-game days). Assert:
1. No agent has hunger = 0 (no starvation)
2. No agent has gold = 0 for more than 1 consecutive day (welfare catches them)
3. Treasury is still positive
4. At least one facility has produced output
5. Bakery has received wheat (supply chain working)
6. At least one bread purchase has occurred

- [ ] **Step 2: Run test**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/balance-smoke.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(meridian): multi-day balance smoke — 4 agents, 2 days, economy sustains"
```

---

### Task F3: Update remaining integration tests

**Files:**
- Modify: `tests/integration/smoke-test.test.ts`
- Modify: `tests/integration/economy-integration.test.ts`
- Modify: `tests/integration/life-systems-integration.test.ts`
- Modify: `tests/integration/agency-integration.test.ts`
- Modify: `tests/integration/social-integration.test.ts`
- Modify: `tests/integration/consequences-integration.test.ts`

- [ ] **Step 1: Update each test to remove BlackboardComponent references**

Replace `agent.get(BlackboardComponent)` with `agent.behaviorAgent` throughout.

- [ ] **Step 2: Run full test suite**

```bash
cd "01 - Projects/Project Meridian" && npm test
```

Expected: All tests pass, lint clean, types clean.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(meridian): update all integration tests for BehaviorAgent migration"
```

---

### Task F4: Final verification

- [ ] **Step 1: Run full quality gate**

```bash
cd "01 - Projects/Project Meridian" && npm test
```

This runs lint + typecheck + all tests.

- [ ] **Step 2: Verify no remaining BlackboardComponent references**

```bash
cd "01 - Projects/Project Meridian" && grep -rn "BlackboardComponent\|BlackboardState\|blackboard" src/ tests/ --include="*.ts"
```

Expected: 0 results

- [ ] **Step 3: Verify no remaining old BT references**

```bash
cd "01 - Projects/Project Meridian" && grep -rn "evaluateBT\|BTContext\|bt-lint\|bt-actions\|bt-conditions" src/ tests/ --include="*.ts"
```

Expected: 0 results

- [ ] **Step 4: Commit summary**

```bash
git commit -m "feat(meridian): mistreevous BT migration complete — typed agents, economy foundation"
```
