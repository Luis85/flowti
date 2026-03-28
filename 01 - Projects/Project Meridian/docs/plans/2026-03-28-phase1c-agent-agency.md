# Phase 1C: Agent Agency — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver 4 new game systems (DayNight, Perception, BehaviorTree, Movement), a seeded PRNG, vault-loaded world locations and behavior trees, and plugin settings — the first agents that perceive, decide, and act.

**Architecture:** Pure domain functions (tested in isolation) wrapped in thin infrastructure GameSystem wrappers. JSON behavior trees validated with Zod. World locations loaded from vault. Plugin settings hot-swapped at runtime.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), Zod (schema validation), Vitest, ESLint (63 rules on src, 27 on tests)

**Design Spec:** `docs/specs/2026-03-28-phase1c-agent-agency-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`day-night.ts`, `day-night.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **Coverage target:** 80% statements, 80% lines
- **ESLint:** Run `npx eslint src/ tests/ --config configs/eslint.config.mjs` — must pass with 0 errors
- **TypeScript:** Run `npx tsc --noEmit --project configs/tsconfig.json` — must pass with 0 errors
- **Full test:** Run `npx vitest run --config configs/vitest.config.ts` — all tests must pass

---

## Chunk A: Foundation — Data Interfaces, RNG, Schemas

### Task A1: Add TimeState and PerceptionState to component-data.ts

**Files:**
- Modify: `src/domain/core/component-data.ts`

- [ ] **Step 1: Add interfaces**

Append to `src/domain/core/component-data.ts`:

```typescript
export interface TimeState {
	phase: 'dawn' | 'day' | 'dusk' | 'night';
	tickInCycle: number;
	dayCount: number;
}

export interface PerceptionState {
	nearbyAgents: { id: string; distance: number }[];
	nearbyLocations: { id: string; type: string; distance: number }[];
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts"
git commit -m "feat(meridian): add TimeState + PerceptionState domain interfaces"
```

---

### Task A2: GameRNG — Seeded PRNG

**Files:**
- Create: `src/domain/core/game-rng.ts`
- Create: `tests/domain/core/game-rng.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/core/game-rng.test.ts
import { describe, it, expect } from 'vitest';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

describe('createGameRNG', () => {
	it('same seed produces same sequence', () => {
		const a = createGameRNG(42);
		const b = createGameRNG(42);
		expect(a.next()).toBe(b.next());
		expect(a.next()).toBe(b.next());
		expect(a.next()).toBe(b.next());
	});

	it('different seeds produce different sequences', () => {
		const a = createGameRNG(1);
		const b = createGameRNG(2);
		expect(a.next()).not.toBe(b.next());
	});

	it('next() returns values in [0, 1)', () => {
		const rng = createGameRNG(123);
		for (let i = 0; i < 100; i++) {
			const v = rng.next();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('range() stays within bounds', () => {
		const rng = createGameRNG(456);
		for (let i = 0; i < 100; i++) {
			const v = rng.range(10, 20);
			expect(v).toBeGreaterThanOrEqual(10);
			expect(v).toBeLessThan(20);
		}
	});

	it('chance(0) always returns false', () => {
		const rng = createGameRNG(789);
		for (let i = 0; i < 50; i++) {
			expect(rng.chance(0)).toBe(false);
		}
	});

	it('chance(1) always returns true', () => {
		const rng = createGameRNG(101);
		for (let i = 0; i < 50; i++) {
			expect(rng.chance(1)).toBe(true);
		}
	});

	it('chance(0.5) produces both true and false over many rolls', () => {
		const rng = createGameRNG(202);
		const results = Array.from({ length: 200 }, () => rng.chance(0.5));
		expect(results.some(r => r === true)).toBe(true);
		expect(results.some(r => r === false)).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/game-rng.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement GameRNG**

```typescript
// src/domain/core/game-rng.ts

export interface GameRNG {
	next(): number;
	range(min: number, max: number): number;
	chance(probability: number): boolean;
}

/** Mulberry32 — fast 32-bit seeded PRNG. */
export function createGameRNG(seed: number): GameRNG {
	let state = seed | 0;

	function next(): number {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	return {
		next,
		range(min: number, max: number): number {
			return min + next() * (max - min);
		},
		chance(probability: number): boolean {
			if (probability <= 0) return false;
			if (probability >= 1) return true;
			return next() < probability;
		},
	};
}

/** Hash a string to a 32-bit integer for RNG seeding. */
export function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return hash;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/game-rng.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (7 tests).

- [ ] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/game-rng.ts" "01 - Projects/Project Meridian/tests/domain/core/game-rng.test.ts"
git commit -m "feat(meridian): GameRNG — seeded mulberry32 PRNG with TDD"
```

---

### Task A3: LocationSchema + BehaviorTreeSchema

**Files:**
- Create: `src/domain/schemas/location-schema.ts`
- Create: `src/domain/schemas/behavior-tree-schema.ts`

- [ ] **Step 1: Create LocationSchema**

```typescript
// src/domain/schemas/location-schema.ts
import { z } from 'zod';
import { PositionSchema } from './common.js';

export const LOCATION_TYPES = ['rest', 'food', 'social', 'work', 'market'] as const;

export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	type: z.enum(LOCATION_TYPES),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
});

export type WorldLocation = z.infer<typeof LocationSchema>;
```

- [ ] **Step 2: Create BehaviorTreeSchema**

```typescript
// src/domain/schemas/behavior-tree-schema.ts
import { z } from 'zod';

const BTConditionSchema = z.object({
	type: z.literal('condition'),
	check: z.string(),
	params: z.record(z.unknown()).default({}),
});

const BTActionSchema = z.object({
	type: z.literal('action'),
	action: z.string(),
	params: z.record(z.unknown()).default({}),
});

export const BTNodeSchema: z.ZodType<BTNode> = z.lazy(() =>
	z.discriminatedUnion('type', [
		z.object({ type: z.literal('selector'), children: z.array(BTNodeSchema) }),
		z.object({ type: z.literal('sequence'), children: z.array(BTNodeSchema) }),
		BTConditionSchema,
		BTActionSchema,
	]),
);

export const BehaviorTreeSchema = z.object({
	id: z.string(),
	root: BTNodeSchema,
});

export type BTNode =
	| { type: 'selector'; children: BTNode[] }
	| { type: 'sequence'; children: BTNode[] }
	| { type: 'condition'; check: string; params: Record<string, unknown> }
	| { type: 'action'; action: string; params: Record<string, unknown> };

export type BehaviorTree = z.infer<typeof BehaviorTreeSchema>;
```

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/location-schema.ts" "01 - Projects/Project Meridian/src/domain/schemas/behavior-tree-schema.ts"
git commit -m "feat(meridian): LocationSchema + BehaviorTreeSchema — Zod validation"
```

---

## Chunk B: Pure Domain Functions

### Task B1: advanceTime — Day/Night Cycle

**Files:**
- Create: `src/domain/systems/day-night.ts`
- Create: `tests/domain/systems/day-night.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/day-night.test.ts
import { describe, it, expect } from 'vitest';
import { advanceTime } from '../../../src/domain/systems/day-night.js';

const defaultConfig = {
	ticks_per_day: 480,
	day_night: {
		dawn: { start: 0, end: 59 },
		day: { start: 60, end: 299 },
		dusk: { start: 300, end: 359 },
		night: { start: 360, end: 479 },
	},
};

describe('advanceTime', () => {
	it('returns dawn at tick 0', () => {
		const result = advanceTime(0, defaultConfig);
		expect(result.state.phase).toBe('dawn');
		expect(result.state.tickInCycle).toBe(0);
		expect(result.state.dayCount).toBe(0);
	});

	it('returns day at tick 60', () => {
		const result = advanceTime(60, defaultConfig);
		expect(result.state.phase).toBe('day');
	});

	it('returns dusk at tick 300', () => {
		const result = advanceTime(300, defaultConfig);
		expect(result.state.phase).toBe('dusk');
	});

	it('returns night at tick 360', () => {
		const result = advanceTime(360, defaultConfig);
		expect(result.state.phase).toBe('night');
	});

	it('wraps back to dawn on new cycle', () => {
		const result = advanceTime(480, defaultConfig);
		expect(result.state.phase).toBe('dawn');
		expect(result.state.tickInCycle).toBe(0);
		expect(result.state.dayCount).toBe(1);
	});

	it('increments dayCount each full cycle', () => {
		expect(advanceTime(960, defaultConfig).state.dayCount).toBe(2);
		expect(advanceTime(1440, defaultConfig).state.dayCount).toBe(3);
	});

	it('phaseChanged is true on dawn→day transition', () => {
		// tick 59 = dawn, tick 60 = day
		const atDawn = advanceTime(59, defaultConfig);
		const atDay = advanceTime(60, defaultConfig);
		expect(atDawn.state.phase).toBe('dawn');
		expect(atDay.state.phase).toBe('day');
		expect(atDay.phaseChanged).toBe(true);
		expect(atDay.previousPhase).toBe('dawn');
	});

	it('phaseChanged is false within same phase', () => {
		const result = advanceTime(100, defaultConfig);
		expect(result.phaseChanged).toBe(false);
	});

	it('falls back to night if no phase matches', () => {
		const gapConfig = {
			ticks_per_day: 100,
			day_night: {
				dawn: { start: 0, end: 10 },
				day: { start: 20, end: 50 },
				dusk: { start: 60, end: 70 },
				night: { start: 80, end: 99 },
			},
		};
		// tick 15 falls in a gap
		const result = advanceTime(15, gapConfig);
		expect(result.state.phase).toBe('night');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/day-night.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement advanceTime**

```typescript
// src/domain/systems/day-night.ts
import type { TimeState } from '../core/component-data.js';

export interface DayNightConfig {
	ticks_per_day: number;
	day_night: {
		dawn: { start: number; end: number };
		day: { start: number; end: number };
		dusk: { start: number; end: number };
		night: { start: number; end: number };
	};
}

export interface DayNightResult {
	state: TimeState;
	phaseChanged: boolean;
	previousPhase: string;
}

const PHASE_ORDER: readonly TimeState['phase'][] = ['dawn', 'day', 'dusk', 'night'];

function resolvePhase(tickInCycle: number, phases: DayNightConfig['day_night']): TimeState['phase'] {
	for (const phase of PHASE_ORDER) {
		const range = phases[phase];
		if (tickInCycle >= range.start && tickInCycle <= range.end) {
			return phase;
		}
	}
	return 'night';
}

function resolvePreviousPhase(tickInCycle: number, ticksPerDay: number, phases: DayNightConfig['day_night']): string {
	const prevTick = tickInCycle === 0 ? ticksPerDay - 1 : tickInCycle - 1;
	return resolvePhase(prevTick, phases);
}

export function advanceTime(
	currentTick: number,
	config: DayNightConfig,
): DayNightResult {
	const tickInCycle = currentTick % config.ticks_per_day;
	const dayCount = Math.floor(currentTick / config.ticks_per_day);
	const phase = resolvePhase(tickInCycle, config.day_night);
	const previousPhase = resolvePreviousPhase(tickInCycle, config.ticks_per_day, config.day_night);
	const phaseChanged = phase !== previousPhase;

	return {
		state: { phase, tickInCycle, dayCount },
		phaseChanged,
		previousPhase,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/day-night.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/day-night.ts" "01 - Projects/Project Meridian/tests/domain/systems/day-night.test.ts"
git commit -m "feat(meridian): advanceTime pure function with TDD"
```

---

### Task B2: resolvePerception — Distance-Based Awareness

**Files:**
- Create: `src/domain/systems/perception.ts`
- Create: `tests/domain/systems/perception.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/perception.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePerception } from '../../../src/domain/systems/perception.js';
import type { PerceptionInput } from '../../../src/domain/systems/perception.js';

const defaultConfig = { base_multiplier: 20, night_multiplier: 0.5 };

function makeInput(overrides: Partial<PerceptionInput> = {}): PerceptionInput {
	return {
		agentPos: { x: 0, y: 0 },
		agentIQ: 10,
		agents: [],
		locations: [],
		timePhase: 'day',
		...overrides,
	};
}

describe('resolvePerception', () => {
	it('detects agents within radius', () => {
		const input = makeInput({
			agents: [{ id: 'a1', pos: { x: 100, y: 0 } }],
		});
		// radius = 20 * 10 = 200, agent at distance 100 → within
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(1);
		expect(result.nearbyAgents[0]?.id).toBe('a1');
	});

	it('excludes agents outside radius', () => {
		const input = makeInput({
			agents: [{ id: 'a1', pos: { x: 300, y: 0 } }],
		});
		// radius = 200, agent at distance 300 → outside
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
	});

	it('detects locations within radius', () => {
		const input = makeInput({
			locations: [{ id: 'loc1', type: 'food', pos: { x: 50, y: 0 } }],
		});
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyLocations).toHaveLength(1);
		expect(result.nearbyLocations[0]?.type).toBe('food');
	});

	it('IQ scaling expands radius', () => {
		const input = makeInput({
			agentIQ: 20,
			agents: [{ id: 'a1', pos: { x: 350, y: 0 } }],
		});
		// radius = 20 * 20 = 400, agent at 350 → within
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(1);
	});

	it('low IQ shrinks radius', () => {
		const input = makeInput({
			agentIQ: 5,
			agents: [{ id: 'a1', pos: { x: 150, y: 0 } }],
		});
		// radius = 20 * 5 = 100, agent at 150 → outside
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
	});

	it('night multiplier reduces radius', () => {
		const input = makeInput({
			timePhase: 'night',
			agents: [{ id: 'a1', pos: { x: 150, y: 0 } }],
		});
		// radius = 20 * 10 * 0.5 = 100, agent at 150 → outside
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
	});

	it('results sorted by distance (nearest first)', () => {
		const input = makeInput({
			agents: [
				{ id: 'far', pos: { x: 150, y: 0 } },
				{ id: 'near', pos: { x: 50, y: 0 } },
			],
		});
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents[0]?.id).toBe('near');
		expect(result.nearbyAgents[1]?.id).toBe('far');
	});

	it('includes distance in results', () => {
		const input = makeInput({
			agents: [{ id: 'a1', pos: { x: 30, y: 40 } }],
		});
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents[0]?.distance).toBeCloseTo(50, 1);
	});

	it('returns empty arrays when nothing is nearby', () => {
		const result = resolvePerception(makeInput(), defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
		expect(result.nearbyLocations).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/perception.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolvePerception**

```typescript
// src/domain/systems/perception.ts
import type { PerceptionState } from '../core/component-data.js';

export interface PerceptionInput {
	agentPos: { x: number; y: number };
	agentIQ: number;
	agents: { id: string; pos: { x: number; y: number } }[];
	locations: { id: string; type: string; pos: { x: number; y: number } }[];
	timePhase: string;
}

export interface PerceptionConfig {
	base_multiplier: number;
	night_multiplier: number;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

export function resolvePerception(
	input: PerceptionInput,
	config: PerceptionConfig,
): PerceptionState {
	let radius = config.base_multiplier * input.agentIQ;
	if (input.timePhase === 'night') {
		radius *= config.night_multiplier;
	}

	const nearbyAgents = input.agents
		.map(a => ({ id: a.id, distance: distance(input.agentPos, a.pos) }))
		.filter(a => a.distance <= radius)
		.sort((a, b) => a.distance - b.distance);

	const nearbyLocations = input.locations
		.map(l => ({ id: l.id, type: l.type, distance: distance(input.agentPos, l.pos) }))
		.filter(l => l.distance <= radius)
		.sort((a, b) => a.distance - b.distance);

	return { nearbyAgents, nearbyLocations };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/perception.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/perception.ts" "01 - Projects/Project Meridian/tests/domain/systems/perception.test.ts"
git commit -m "feat(meridian): resolvePerception pure function with TDD"
```

---

### Task B3: evaluateBT — Behavior Tree Evaluator

**Files:**
- Create: `src/domain/systems/behavior-tree.ts`
- Create: `tests/domain/systems/behavior-tree.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/behavior-tree.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateBT } from '../../../src/domain/systems/behavior-tree.js';
import type { BTNode, BTContext } from '../../../src/domain/systems/behavior-tree.js';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

function makeContext(overrides: Partial<BTContext> = {}): BTContext {
	return {
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: { value: 0, bucket: 'stressed' },
		perception: { nearbyAgents: [], nearbyLocations: [] },
		timePhase: 'day',
		rng: createGameRNG(42),
		...overrides,
	};
}

describe('evaluateBT', () => {
	it('action node always succeeds and returns action', () => {
		const node: BTNode = { type: 'action', action: 'idle', params: {} };
		const result = evaluateBT(node, makeContext());
		expect(result.status).toBe('success');
		expect(result.action).toBe('idle');
	});

	it('selector returns first succeeding child', () => {
		const node: BTNode = {
			type: 'selector',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'hunger' } },
				{ type: 'action', action: 'idle', params: {} },
			],
		};
		// hunger=50, not critical → condition fails → selector tries idle → success
		const result = evaluateBT(node, makeContext());
		expect(result.action).toBe('idle');
	});

	it('sequence fails on first failing child', () => {
		const node: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'hunger' } },
				{ type: 'action', action: 'eat', params: {} },
			],
		};
		// hunger=50, not critical → condition fails → sequence fails
		const result = evaluateBT(node, makeContext());
		expect(result.status).toBe('failure');
		expect(result.action).toBeNull();
	});

	it('need_critical condition succeeds when need is below threshold', () => {
		const node: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'energy' } },
				{ type: 'action', action: 'rest', params: {} },
			],
		};
		const ctx = makeContext({ needs: { hunger: 50, energy: 10, social: 50 } });
		const result = evaluateBT(node, ctx);
		expect(result.status).toBe('success');
		expect(result.action).toBe('rest');
	});

	it('need_below condition with custom threshold', () => {
		const node: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 40 } },
				{ type: 'action', action: 'eat', params: {} },
			],
		};
		const ctx = makeContext({ needs: { hunger: 30, energy: 50, social: 50 } });
		const result = evaluateBT(node, ctx);
		expect(result.action).toBe('eat');
	});

	it('mood_is condition matches bucket', () => {
		const node: BTNode = { type: 'condition', check: 'mood_is', params: { bucket: 'stressed' } };
		const result = evaluateBT(node, makeContext());
		expect(result.status).toBe('success');
	});

	it('time_is condition matches phase', () => {
		const node: BTNode = { type: 'condition', check: 'time_is', params: { phase: 'day' } };
		const result = evaluateBT(node, makeContext());
		expect(result.status).toBe('success');
	});

	it('nearby_location condition succeeds when location type present', () => {
		const ctx = makeContext({
			perception: {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'loc1', type: 'food', distance: 50 }],
			},
		});
		const node: BTNode = { type: 'condition', check: 'nearby_location', params: { locationType: 'food' } };
		const result = evaluateBT(node, ctx);
		expect(result.status).toBe('success');
	});

	it('nearby_agent condition succeeds when agents nearby', () => {
		const ctx = makeContext({
			perception: {
				nearbyAgents: [{ id: 'a1', distance: 30 }],
				nearbyLocations: [],
			},
		});
		const node: BTNode = { type: 'condition', check: 'nearby_agent', params: {} };
		const result = evaluateBT(node, ctx);
		expect(result.status).toBe('success');
	});

	it('chance condition uses RNG', () => {
		// With a fixed seed, chance(0.5) should be deterministic
		const node: BTNode = { type: 'condition', check: 'chance', params: { probability: 0.5 } };
		const result1 = evaluateBT(node, makeContext());
		const result2 = evaluateBT(node, makeContext()); // same seed → same result
		expect(result1.status).toBe(result2.status);
	});

	it('move_to_nearest action passes locationType in params', () => {
		const node: BTNode = { type: 'action', action: 'move_to_nearest', params: { locationType: 'rest' } };
		const result = evaluateBT(node, makeContext());
		expect(result.action).toBe('move_to_nearest');
		expect(result.params.locationType).toBe('rest');
	});

	it('nested selector/sequence combination', () => {
		const tree: BTNode = {
			type: 'selector',
			children: [
				{
					type: 'sequence',
					children: [
						{ type: 'condition', check: 'need_critical', params: { need: 'energy' } },
						{ type: 'action', action: 'rest', params: {} },
					],
				},
				{
					type: 'sequence',
					children: [
						{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 40 } },
						{ type: 'action', action: 'eat', params: {} },
					],
				},
				{ type: 'action', action: 'idle', params: {} },
			],
		};
		// energy=10 (critical) → rest
		const ctx1 = makeContext({ needs: { hunger: 50, energy: 10, social: 50 } });
		expect(evaluateBT(tree, ctx1).action).toBe('rest');

		// energy=50, hunger=30 (below 40) → eat
		const ctx2 = makeContext({ needs: { hunger: 30, energy: 50, social: 50 } });
		expect(evaluateBT(tree, ctx2).action).toBe('eat');

		// all fine → idle
		const ctx3 = makeContext({ needs: { hunger: 50, energy: 50, social: 50 } });
		expect(evaluateBT(tree, ctx3).action).toBe('idle');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/behavior-tree.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement evaluateBT**

```typescript
// src/domain/systems/behavior-tree.ts
import type { NeedsState, MoodState, PerceptionState } from '../core/component-data.js';
import type { GameRNG } from '../core/game-rng.js';

export type BTNode =
	| { type: 'selector'; children: BTNode[] }
	| { type: 'sequence'; children: BTNode[] }
	| { type: 'condition'; check: string; params: Record<string, unknown> }
	| { type: 'action'; action: string; params: Record<string, unknown> };

export interface BTContext {
	needs: NeedsState;
	mood: MoodState;
	perception: PerceptionState;
	timePhase: string;
	rng: GameRNG;
}

export type BTStatus = 'success' | 'failure';

export interface BTResult {
	status: BTStatus;
	action: string | null;
	params: Record<string, unknown>;
}

const CRITICAL_THRESHOLDS: Record<string, number> = {
	hunger: 20,
	energy: 15,
	social: 25,
};

const CONDITION_CHECKS: Record<string, (ctx: BTContext, params: Record<string, unknown>) => boolean> = {
	need_critical(ctx, params) {
		const need = params.need as string;
		const threshold = CRITICAL_THRESHOLDS[need] ?? 20;
		return (ctx.needs as Record<string, number>)[need] < threshold;
	},
	need_below(ctx, params) {
		const need = params.need as string;
		const threshold = params.threshold as number;
		return (ctx.needs as Record<string, number>)[need] < threshold;
	},
	mood_is(ctx, params) {
		return ctx.mood.bucket === params.bucket;
	},
	time_is(ctx, params) {
		return ctx.timePhase === params.phase;
	},
	nearby_location(ctx, params) {
		const locationType = params.locationType as string;
		return ctx.perception.nearbyLocations.some(l => l.type === locationType);
	},
	nearby_agent(ctx) {
		return ctx.perception.nearbyAgents.length > 0;
	},
	chance(ctx, params) {
		return ctx.rng.chance(params.probability as number);
	},
};

const FAILURE: BTResult = { status: 'failure', action: null, params: {} };

export function evaluateBT(node: BTNode, context: BTContext): BTResult {
	switch (node.type) {
		case 'action':
			return { status: 'success', action: node.action, params: node.params };

		case 'condition': {
			const check = CONDITION_CHECKS[node.check];
			if (check === undefined) return FAILURE;
			return check(context, node.params)
				? { status: 'success', action: null, params: {} }
				: FAILURE;
		}

		case 'selector':
			for (const child of node.children) {
				const result = evaluateBT(child, context);
				if (result.status === 'success') return result;
			}
			return FAILURE;

		case 'sequence': {
			let lastResult: BTResult = { status: 'success', action: null, params: {} };
			for (const child of node.children) {
				const result = evaluateBT(child, context);
				if (result.status === 'failure') return FAILURE;
				if (result.action !== null) lastResult = result;
			}
			return lastResult;
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/behavior-tree.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (12 tests).

- [ ] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-tree.ts" "01 - Projects/Project Meridian/tests/domain/systems/behavior-tree.test.ts"
git commit -m "feat(meridian): evaluateBT pure function with TDD — selector/sequence/conditions/actions"
```

---

### Task B4: computeMovement — Position Stepping

**Files:**
- Create: `src/domain/systems/movement.ts`
- Create: `tests/domain/systems/movement.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/movement.test.ts
import { describe, it, expect } from 'vitest';
import { computeMovement } from '../../../src/domain/systems/movement.js';

describe('computeMovement', () => {
	it('moves toward target along x axis', () => {
		const result = computeMovement({
			currentPos: { x: 0, y: 0 },
			targetPos: { x: 100, y: 0 },
			speed: 10,
			deltaTicks: 1,
		});
		expect(result.newPos.x).toBeCloseTo(10, 1);
		expect(result.newPos.y).toBeCloseTo(0, 1);
		expect(result.arrived).toBe(false);
	});

	it('moves toward target along y axis', () => {
		const result = computeMovement({
			currentPos: { x: 0, y: 0 },
			targetPos: { x: 0, y: 100 },
			speed: 10,
			deltaTicks: 1,
		});
		expect(result.newPos.y).toBeCloseTo(10, 1);
		expect(result.arrived).toBe(false);
	});

	it('normalises diagonal movement', () => {
		const result = computeMovement({
			currentPos: { x: 0, y: 0 },
			targetPos: { x: 100, y: 100 },
			speed: 10,
			deltaTicks: 1,
		});
		const dist = Math.sqrt(result.newPos.x ** 2 + result.newPos.y ** 2);
		expect(dist).toBeCloseTo(10, 1);
	});

	it('arrives when within step distance', () => {
		const result = computeMovement({
			currentPos: { x: 95, y: 0 },
			targetPos: { x: 100, y: 0 },
			speed: 10,
			deltaTicks: 1,
		});
		expect(result.arrived).toBe(true);
		expect(result.newPos.x).toBe(100);
		expect(result.newPos.y).toBe(0);
	});

	it('already at target returns arrived', () => {
		const result = computeMovement({
			currentPos: { x: 50, y: 50 },
			targetPos: { x: 50, y: 50 },
			speed: 10,
			deltaTicks: 1,
		});
		expect(result.arrived).toBe(true);
		expect(result.newPos).toEqual({ x: 50, y: 50 });
	});

	it('deltaTicks scales movement', () => {
		const result = computeMovement({
			currentPos: { x: 0, y: 0 },
			targetPos: { x: 100, y: 0 },
			speed: 5,
			deltaTicks: 3,
		});
		expect(result.newPos.x).toBeCloseTo(15, 1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/movement.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeMovement**

```typescript
// src/domain/systems/movement.ts

export interface MovementInput {
	currentPos: { x: number; y: number };
	targetPos: { x: number; y: number };
	speed: number;
	deltaTicks: number;
}

export interface MovementResult {
	newPos: { x: number; y: number };
	arrived: boolean;
}

export function computeMovement(input: MovementInput): MovementResult {
	const dx = input.targetPos.x - input.currentPos.x;
	const dy = input.targetPos.y - input.currentPos.y;
	const dist = Math.sqrt(dx * dx + dy * dy);

	const stepSize = input.speed * input.deltaTicks;

	if (dist <= stepSize) {
		return { newPos: { ...input.targetPos }, arrived: true };
	}

	const nx = dx / dist;
	const ny = dy / dist;

	return {
		newPos: {
			x: input.currentPos.x + nx * stepSize,
			y: input.currentPos.y + ny * stepSize,
		},
		arrived: false,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/movement.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/movement.ts" "01 - Projects/Project Meridian/tests/domain/systems/movement.test.ts"
git commit -m "feat(meridian): computeMovement pure function with TDD"
```

---

## Chunk C: Components + Data Loaders

### Task C1: TimeComponent + PerceptionComponent

**Files:**
- Create: `src/infrastructure/components/time-component.ts`
- Create: `src/infrastructure/components/perception-component.ts`

- [ ] **Step 1: Create TimeComponent**

```typescript
// src/infrastructure/components/time-component.ts
import type { TimeState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class TimeComponent extends TrackedComponent {
	constructor(public state: TimeState) { super(); }
}
```

- [ ] **Step 2: Create PerceptionComponent**

```typescript
// src/infrastructure/components/perception-component.ts
import type { PerceptionState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class PerceptionComponent extends TrackedComponent {
	constructor(public state: PerceptionState) { super(); }
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/components/time-component.ts" "01 - Projects/Project Meridian/src/infrastructure/components/perception-component.ts"
git commit -m "feat(meridian): TimeComponent + PerceptionComponent"
```

---

### Task C2: Location Loader + BT Loader

**Files:**
- Create: `src/infrastructure/entity/location-loader.ts`
- Create: `src/infrastructure/entity/bt-loader.ts`
- Create: `tests/infrastructure/entity/location-loader.test.ts`
- Create: `tests/infrastructure/entity/bt-loader.test.ts`

- [ ] **Step 1: Write location loader tests**

```typescript
// tests/infrastructure/entity/location-loader.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createLocationLoader } from '../../../src/infrastructure/entity/location-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const validLocation = {
	id: 'loc-tavern',
	name: 'The Rusty Anchor',
	type: 'rest',
	position: { x: 300, y: 200 },
	capacity: 5,
};

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> {
			return Object.keys(files).filter(f => f.startsWith(path));
		},
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('LocationLoader', () => {
	it('loads valid location', async () => {
		const vault = createMockVault({ 'locations/tavern.json': JSON.stringify(validLocation) });
		const loader = createLocationLoader(logger);
		const result = await loader.loadFromVault(vault, 'locations/');
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.id).toBe('loc-tavern');
	});

	it('skips invalid location and collects error', async () => {
		const vault = createMockVault({ 'locations/bad.json': '{"invalid": true}' });
		const loader = createLocationLoader(logger);
		const result = await loader.loadFromVault(vault, 'locations/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const loader = createLocationLoader(logger);
		const result = await loader.loadFromVault(vault, 'locations/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Write BT loader tests**

```typescript
// tests/infrastructure/entity/bt-loader.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createBTLoader } from '../../../src/infrastructure/entity/bt-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const validBT = {
	id: 'bt-merchant',
	root: {
		type: 'selector',
		children: [
			{ type: 'action', action: 'idle', params: {} },
		],
	},
};

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> {
			return Object.keys(files).filter(f => f.startsWith(path));
		},
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('BTLoader', () => {
	it('loads valid BT definition', async () => {
		const vault = createMockVault({ 'bt/merchant.json': JSON.stringify(validBT) });
		const loader = createBTLoader(logger);
		const result = await loader.loadFromVault(vault, 'bt/');
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.id).toBe('bt-merchant');
	});

	it('skips invalid BT and collects error', async () => {
		const vault = createMockVault({ 'bt/bad.json': '{"id": "bad"}' });
		const loader = createBTLoader(logger);
		const result = await loader.loadFromVault(vault, 'bt/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/location-loader.test.ts tests/infrastructure/entity/bt-loader.test.ts --config configs/vitest.config.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement both loaders**

Both follow the same pattern as `agent-spawner.ts`. Extract a generic loader to keep it DRY:

```typescript
// src/infrastructure/entity/location-loader.ts
import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { LocationSchema, type WorldLocation } from '../../domain/schemas/location-schema.js';

export interface LoadResult<T> {
	items: T[];
	errors: { file: string; message: string }[];
}

export function createLocationLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<WorldLocation>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<WorldLocation>> {
			const items: WorldLocation[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);

			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					items.push(LocationSchema.parse(parsed));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('LocationLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}

			logger.info('LocationLoader', `Loaded ${String(items.length)} locations, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
```

```typescript
// src/infrastructure/entity/bt-loader.ts
import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { BehaviorTreeSchema, type BehaviorTree } from '../../domain/schemas/behavior-tree-schema.js';
import type { LoadResult } from './location-loader.js';

export function createBTLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<BehaviorTree>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<BehaviorTree>> {
			const items: BehaviorTree[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);

			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					items.push(BehaviorTreeSchema.parse(parsed));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('BTLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}

			logger.info('BTLoader', `Loaded ${String(items.length)} behavior trees, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/location-loader.test.ts tests/infrastructure/entity/bt-loader.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (5 tests).

- [ ] **Step 6: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/location-loader.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/bt-loader.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/"
git commit -m "feat(meridian): LocationLoader + BTLoader — vault data pipeline"
```

---

## Chunk D: Infrastructure GameSystem Wrappers

### Task D1: DayNightSystem

**Files:**
- Create: `src/infrastructure/systems/day-night-system.ts`
- Create: `tests/infrastructure/systems/day-night-system.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests that verify: the system writes TimeComponent on the world entity, emits DayPhaseChanged on transitions, and does not emit when phase stays the same. Use the same test pattern from Phase 1B systems — construct a world entity with TimeComponent, create deps with GameConfigSchema.parse({}), execute the system, and check the component state + event bus.

The world entity is a plain ExcaliburJS Actor with a TimeComponent attached. The system reads `deps.tickCount` and `deps.config` (which has `ticks_per_day` and `day_night` from the schema defaults).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/day-night-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement DayNightSystem**

```typescript
// src/infrastructure/systems/day-night-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { advanceTime } from '../../domain/systems/day-night.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';

export function createDayNightSystem(
	worldEntity: () => Actor,
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

			time.state = result.state;
			time.markDirty();

			if (result.phaseChanged) {
				deps.eventBus.emit({
					type: 'DayPhaseChanged',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'DayNightSystem',
					payload: {
						oldPhase: result.previousPhase,
						newPhase: result.state.phase,
						dayCount: result.state.dayCount,
					},
				});
			}
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/day-night-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/day-night-system.test.ts"
git commit -m "feat(meridian): DayNightSystem — ECS wrapper for time cycle"
```

---

### Task D2: PerceptionSystem

**Files:**
- Create: `src/infrastructure/systems/perception-system.ts`
- Create: `tests/infrastructure/systems/perception-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests should verify: the system reads agent positions + IQ + time phase, calls resolvePerception, writes PerceptionComponent on each agent. Use AgentActors with known positions and a world entity with TimeComponent set to a known phase. Check that PerceptionComponent is updated with correct nearby lists.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement PerceptionSystem**

```typescript
// src/infrastructure/systems/perception-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { resolvePerception } from '../../domain/systems/perception.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { AttributesComponent } from '../components/attributes-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { TimeComponent } from '../components/time-component.js';

export function createPerceptionSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'PerceptionSystem',
		priority: SystemPriority.PERCEPTION,

		execute(deps: GameCoreDeps): void {
			const timePhase = worldEntity().get(TimeComponent).state.phase;
			const allAgents = agents();
			const allLocations = locations();

			for (const agent of allAgents) {
				const attrs = agent.get(AttributesComponent);
				const perception = agent.get(PerceptionComponent);

				const result = resolvePerception(
					{
						agentPos: { x: agent.pos.x, y: agent.pos.y },
						agentIQ: attrs.state.IQ,
						agents: allAgents
							.filter(a => a.agentId !== agent.agentId)
							.map(a => ({ id: a.agentId, pos: { x: a.pos.x, y: a.pos.y } })),
						locations: allLocations.map(l => ({
							id: l.id,
							type: l.type,
							pos: { x: l.position.x, y: l.position.y },
						})),
						timePhase,
					},
					deps.config.perception,
				);

				perception.state = result;
				perception.markDirty();
			}
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/perception-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/perception-system.test.ts"
git commit -m "feat(meridian): PerceptionSystem — ECS wrapper for spatial awareness"
```

---

### Task D3: BehaviorTreeSystem

**Files:**
- Create: `src/infrastructure/systems/behavior-tree-system.ts`
- Create: `tests/infrastructure/systems/behavior-tree-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests should verify: the system reads needs/mood/perception/time, constructs BTContext with a per-agent RNG, evaluates the BT, writes `btAction` and `movementTarget` to the blackboard, and emits `BTActionSelected`. Test with a simple BT that always picks `idle` and one that picks `move_to_nearest` when a location is in perception.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement BehaviorTreeSystem**

```typescript
// src/infrastructure/systems/behavior-tree-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { evaluateBT, type BTNode } from '../../domain/systems/behavior-tree.js';
import { createGameRNG, hashString } from '../../domain/core/game-rng.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { TimeComponent } from '../components/time-component.js';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
	btDefinitions: Record<string, BTNode>,
	worldEntity: () => Actor,
	baseSeed: number,
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,

		execute(deps: GameCoreDeps): void {
			const timePhase = worldEntity().get(TimeComponent).state.phase;

			for (const agent of agents()) {
				const btRoot = btDefinitions[agent.kind] ?? btDefinitions['default'];
				if (btRoot === undefined) continue;

				const needs = agent.get(NeedsComponent);
				const mood = agent.get(MoodComponent);
				const perception = agent.get(PerceptionComponent);
				const bb = agent.get(BlackboardComponent);

				const seed = (baseSeed ^ deps.tickCount ^ hashString(agent.agentId)) >>> 0;
				const rng = createGameRNG(seed);

				const result = evaluateBT(btRoot, {
					needs: needs.state,
					mood: mood.state,
					perception: perception.state,
					timePhase,
					rng,
				});

				bb.state.btAction = result.action;

				// Resolve movement target from perception if action requires it
				if (result.action === 'move_to_nearest') {
					const locationType = result.params.locationType as string;
					const loc = perception.state.nearbyLocations.find(l => l.type === locationType);
					bb.state.movementTarget = loc !== undefined ? { id: loc.id, type: loc.type } : null;
				} else if (result.action === 'move_to_agent') {
					const nearest = perception.state.nearbyAgents[0];
					bb.state.movementTarget = nearest !== undefined ? { id: nearest.id, type: 'agent' } : null;
				} else {
					bb.state.movementTarget = null;
				}

				bb.markDirty();

				if (result.action !== null) {
					deps.eventBus.emit({
						type: 'BTActionSelected',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'BehaviorTreeSystem',
						payload: { agentId: agent.agentId, action: result.action, params: result.params },
					});
				}
			}
		},
	};
}
```

Note: The BT lookup uses `agent.kind` to find the BT definition — this maps "merchant" → `btDefinitions['merchant']`. The wiring code in game-view will build this map from loaded BTs (keyed by BT `id` field, e.g., `"bt-merchant"` → strip prefix, or use a mapping). Alternatively, key by `agent.behavior_tree` which must match a BT `id`. The implementer should follow whichever convention the game-view wiring establishes. The key lookup logic may need adjustment during integration.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts"
git commit -m "feat(meridian): BehaviorTreeSystem — ECS wrapper with RNG + blackboard writes"
```

---

### Task D4: MovementSystem

**Files:**
- Create: `src/infrastructure/systems/movement-system.ts`
- Create: `tests/infrastructure/systems/movement-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests should verify: the system reads movementTarget from blackboard, computes movement, updates actor position, emits AgentArrived on arrival and clears the target. Also test that idle agents (no target) are skipped.

The system needs to resolve the movement target position. Since `bb.state.movementTarget` stores `{ id, type }`, the system needs access to the location list and agent list to get the actual `{ x, y }` coordinates. Accept `locations: () => WorldLocation[]` and `agents: () => AgentActor[]` as constructor params.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement MovementSystem**

```typescript
// src/infrastructure/systems/movement-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { computeMovement } from '../../domain/systems/movement.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

interface MovementTarget {
	id: string;
	type: string;
}

export function createMovementSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'MovementSystem',
		priority: SystemPriority.MOVEMENT,

		execute(deps: GameCoreDeps): void {
			const allAgents = agents();
			const allLocations = locations();

			for (const agent of allAgents) {
				const bb = agent.get(BlackboardComponent);
				const target = bb.state.movementTarget as MovementTarget | null | undefined;
				if (target == null) continue;

				// Resolve target position
				let targetPos: { x: number; y: number } | null = null;
				let targetType = target.type;

				if (target.type === 'agent') {
					const targetAgent = allAgents.find(a => a.agentId === target.id);
					if (targetAgent !== undefined) {
						targetPos = { x: targetAgent.pos.x, y: targetAgent.pos.y };
					}
				} else {
					const loc = allLocations.find(l => l.id === target.id);
					if (loc !== undefined) {
						targetPos = { x: loc.position.x, y: loc.position.y };
					}
				}

				if (targetPos === null) {
					bb.state.movementTarget = null;
					bb.markDirty();
					continue;
				}

				const attrs = agent.get(AttributesComponent);
				const speed = attrs.state.DX / deps.config.formulas.basic_speed_divisor;

				const result = computeMovement({
					currentPos: { x: agent.pos.x, y: agent.pos.y },
					targetPos,
					speed,
					deltaTicks: 1,
				});

				agent.pos.x = result.newPos.x;
				agent.pos.y = result.newPos.y;

				if (result.arrived) {
					deps.eventBus.emit({
						type: 'AgentArrived',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MovementSystem',
						payload: { agentId: agent.agentId, targetId: target.id, targetType },
					});
					bb.state.movementTarget = null;
					bb.markDirty();
				}
			}
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/movement-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/movement-system.test.ts"
git commit -m "feat(meridian): MovementSystem — ECS wrapper with target resolution + arrival events"
```

---

## Chunk E: Settings + World Data + Build

### Task E1: Plugin Settings

**Files:**
- Modify: `src/domain/core/settings.ts`
- Modify: `src/infrastructure/settings/settings-tab.ts`
- Modify: `src/plugin.ts`

- [ ] **Step 1: Add new settings fields**

In `src/domain/core/settings.ts`, add to `MeridianSettings`:

```typescript
/** Target ticks per second. Default: 60 */
tickRate: number;
/** Seconds per full day/night cycle. Default: 120 */
dayCycleDuration: number;
/** Base perception radius multiplier. Default: 150 */
perceptionRadius: number;
```

And to `DEFAULT_SETTINGS`:

```typescript
tickRate: 60,
dayCycleDuration: 120,
perceptionRadius: 150,
```

- [ ] **Step 2: Add settings UI controls**

In `src/infrastructure/settings/settings-tab.ts`, add a "Simulation" heading with 3 sliders after the Development section:

- **Tick rate** — slider 1–120, step 1
- **Day cycle duration** — slider 30–600, step 10 (seconds)
- **Perception radius** — slider 50–500, step 10

- [ ] **Step 3: Wire settings to config in plugin.ts**

In `applySettings()`, after the performance tracker update, add:

```typescript
if (this.gameDeps !== null) {
	Object.assign(this.gameDeps, {
		logger: this.logger,
		performanceTracker: this.performanceTracker,
	});
	// Hot-swap simulation settings
	const config = this.gameDeps.config;
	config.ticks_per_day = Math.round(
		this.settings.dayCycleDuration * 1000 / config.tick_interval_ms,
	);
	config.perception.base_multiplier = this.settings.perceptionRadius;
}
```

- [ ] **Step 4: Run typecheck + lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/settings.ts" "01 - Projects/Project Meridian/src/infrastructure/settings/settings-tab.ts" "01 - Projects/Project Meridian/src/plugin.ts"
git commit -m "feat(meridian): plugin settings — tick rate, day cycle, perception radius"
```

---

### Task E2: World Data Files

**Files:**
- Create: `locations/tavern.json`
- Create: `locations/market.json`
- Create: `locations/town-square.json`
- Create: `locations/workshop.json`
- Create: `behavior-trees/bt-merchant.json`
- Create: `behavior-trees/bt-guard.json`
- Create: `behavior-trees/bt-scholar.json`
- Create: `behavior-trees/bt-artisan.json`
- Modify: `agents/elena.json` — update `behavior_tree` from `.md` to match BT id
- Modify: `agents/marcus.json` — same
- Modify: `agents/wren.json` — same
- Modify: `agents/sable.json` — same

- [ ] **Step 1: Create 4 location files**

Location positions should spread across the game area (roughly 800×600). Types: tavern=rest, market=food, town-square=social, workshop=work.

- [ ] **Step 2: Create 4 BT files**

Each BT is a selector with prioritised need-based sequences:
- **bt-merchant**: hungry→food, tired→rest, lonely→social, default→idle
- **bt-guard**: tired→rest (guards push through hunger), hungry→food, default→idle
- **bt-scholar**: tired→rest (scholars burn out fast), hungry→food, lonely→social, default→idle
- **bt-artisan**: hungry→food, tired→rest, lonely→social, default→idle (similar to merchant but different threshold tuning)

Each sequence checks `need_below` (not just `need_critical`) with per-kind thresholds to give distinct behavior personalities.

- [ ] **Step 3: Update agent behavior_tree fields**

Update each agent JSON's `behavior_tree` field to match the BT file's `id`:
- elena.json: `"behavior_tree": "bt-merchant"`
- marcus.json: `"behavior_tree": "bt-guard"`
- wren.json: `"behavior_tree": "bt-scholar"`
- sable.json: `"behavior_tree": "bt-artisan"`

- [ ] **Step 4: Update vite.config.ts**

Add two more `copyDir` calls in `assembleVaultOverlay()`:

```typescript
// Location data → 03 - Resources/Locations/
copyDir(
	resolve(projectRoot, 'locations'),
	resolve(distDir, '03 - Resources/Locations'),
	'.json',
);

// Behavior trees → 03 - Resources/BehaviorTrees/
copyDir(
	resolve(projectRoot, 'behavior-trees'),
	resolve(distDir, '03 - Resources/BehaviorTrees'),
	'.json',
);
```

- [ ] **Step 5: Build and verify dist/ structure**

Run: `cd "01 - Projects/Project Meridian" && npm run build`
Expected: dist/ now includes `03 - Resources/Locations/*.json` and `03 - Resources/BehaviorTrees/*.json`.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/locations/" "01 - Projects/Project Meridian/behavior-trees/" "01 - Projects/Project Meridian/agents/" "01 - Projects/Project Meridian/configs/vite.config.ts"
git commit -m "feat(meridian): world data — 4 locations + 4 behavior trees + agent BT refs"
```

---

## Chunk F: Wiring + Integration + Verification

### Task F1: Wire Systems in game-view.ts

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Add imports and wiring**

After the existing Phase 1B system registration block:
1. Import `Actor` from excalibur, `TimeComponent`, `PerceptionComponent`, `createLocationLoader`, `createBTLoader`, `createDayNightSystem`, `createPerceptionSystem`, `createBehaviorTreeSystem`, `createMovementSystem`
2. Create world entity: `const worldEntity = new Actor(); worldEntity.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));`
3. Add world entity to scene
4. Add `PerceptionComponent` to each spawned agent: `agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));`
5. Load locations: `const locationResult = await locationLoader.loadFromVault(vaultAdapter, '03 - Resources/Locations');`
6. Load BTs: `const btResult = await btLoader.loadFromVault(vaultAdapter, '03 - Resources/BehaviorTrees');`
7. Build BT definitions map: `Record<string, BTNode>` keyed by BT id
8. Register 4 new systems with tick runner (DayNight, Perception, BehaviorTree, Movement)

- [ ] **Step 2: Run typecheck + lint + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): wire Phase 1C systems — day/night, perception, BT, movement"
```

---

### Task F2: Integration Tests

**Files:**
- Create: `tests/integration/agency-integration.test.ts`

- [ ] **Step 1: Write integration tests**

3 tests:
1. **Full tick: hungry agent seeks food** — Create agent with low hunger, a food location within perception range, register all 8 systems, run one tick. Verify BT selected `move_to_nearest`, movement stepped toward the food location.
2. **Night reduces perception** — Same setup but time phase is night. Place food location just outside night-reduced radius. Verify agent does NOT detect it and falls back to idle.
3. **Agent arrives at location** — Create agent very close to target. Run tick. Verify `AgentArrived` event emitted.

- [ ] **Step 2: Run integration tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/agency-integration.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/agency-integration.test.ts"
git commit -m "test(meridian): agency integration tests — full tick, night perception, arrival"
```

---

### Task F3: Full Verification

- [ ] **Step 1: Run complete quality gate suite**

Run:
```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ tests/ --config configs/eslint.config.mjs
npx vitest run --config configs/vitest.config.ts
npm run build
```

Expected: 0 errors, 0 warnings, ~244+ tests pass, build succeeds.

- [ ] **Step 2: Verify exit criteria checklist**

| Criterion | Evidence |
|-----------|----------|
| DayNight cycles phases | day-night.test.ts + system test |
| Perception with night penalty | perception.test.ts + integration test |
| BT evaluates JSON trees | behavior-tree.test.ts + system test |
| Movement toward targets | movement.test.ts + system test |
| GameRNG seeded + deterministic | game-rng.test.ts |
| Locations loaded from vault | location-loader.test.ts |
| Agents seek food/rest/social | integration: hungry agent → food |
| Events emitted correctly | system tests + integration |
| No regressions | Full suite run |
| Plugin settings | settings.ts changes |

- [ ] **Step 3: Final commit**

```bash
git add "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 1C complete — agent agency (DayNight, Perception, BT, Movement)"
```
