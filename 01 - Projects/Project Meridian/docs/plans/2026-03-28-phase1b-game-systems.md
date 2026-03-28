# Phase 1B: Core Life Systems + Agent Entity Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver 4 game systems (TraitResolver, NeedsDecay, Mood, Memory) and vault-loaded agent entities — the first agents with life that ticks.

**Architecture:** Pure domain functions (tested in isolation) wrapped in thin infrastructure GameSystem wrappers that read ECS components, call the function, write results, and emit events. Agent entities are loaded from vault JSON, validated with AgentSchema, and spawned as ExcaliburJS Actors with attached components.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), Zod (schema validation), Vitest, ESLint (63 rules on src, 27 on tests)

**Design Spec:** `docs/specs/2026-03-28-phase1b-game-systems-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`needs-decay.ts`, `needs-decay.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore` (one existing exception in `withDefaults()`)
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **Coverage target:** 80% statements, 80% lines
- **ESLint:** Run `npx eslint src/ tests/ --config configs/eslint.config.mjs` — must pass with 0 errors
- **TypeScript:** Run `npx tsc --noEmit --project configs/tsconfig.json` — must pass with 0 errors
- **Full test:** Run `npx vitest run --config configs/vitest.config.ts` — all tests must pass

---

## Chunk A: Domain Data Interfaces + New Components

### Task A1: Add AttributesState and SocialState to component-data.ts

**Files:**
- Modify: `src/domain/core/component-data.ts`

- [x] **Step 1: Add AttributesState and SocialState interfaces**

Append to `src/domain/core/component-data.ts`:

```typescript
export interface AttributesState {
	ST: number;
	DX: number;
	IQ: number;
	HT: number;
}

export interface SocialState {
	status: number;
	reputation: number;
	charisma: number;
}
```

- [x] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts"
git commit -m "feat(meridian): add AttributesState + SocialState domain interfaces"
```

---

### Task A2: Create AttributesComponent, SocialComponent, TraitsComponent

**Files:**
- Create: `src/infrastructure/components/attributes-component.ts`
- Create: `src/infrastructure/components/social-component.ts`
- Create: `src/infrastructure/components/traits-component.ts`
- Create: `tests/infrastructure/components/phase1b-components.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/components/phase1b-components.test.ts
import { describe, it, expect } from 'vitest';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { SocialComponent } from '../../../src/infrastructure/components/social-component.js';
import { TraitsComponent } from '../../../src/infrastructure/components/traits-component.js';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

describe('AttributesComponent', () => {
	it('holds AttributesState and extends TrackedComponent', () => {
		const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
		expect(comp.state.ST).toBe(12);
		expect(comp.state.IQ).toBe(14);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});
});

describe('SocialComponent', () => {
	it('holds SocialState and extends TrackedComponent', () => {
		const comp = new SocialComponent({ status: 2, reputation: 1, charisma: 14 });
		expect(comp.state.status).toBe(2);
		expect(comp.state.charisma).toBe(14);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});
});

describe('TraitsComponent', () => {
	it('holds trait IDs and extends TrackedComponent', () => {
		const comp = new TraitsComponent(['brave', 'strong']);
		expect(comp.traitIds).toEqual(['brave', 'strong']);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/components/phase1b-components.test.ts --config configs/vitest.config.ts`
Expected: FAIL — modules not found.

- [x] **Step 3: Implement all three components**

```typescript
// src/infrastructure/components/attributes-component.ts
import type { AttributesState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class AttributesComponent extends TrackedComponent {
	constructor(public state: AttributesState) { super(); }
}
```

```typescript
// src/infrastructure/components/social-component.ts
import type { SocialState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class SocialComponent extends TrackedComponent {
	constructor(public state: SocialState) { super(); }
}
```

```typescript
// src/infrastructure/components/traits-component.ts
import { TrackedComponent } from './tracked-component.js';

export class TraitsComponent extends TrackedComponent {
	constructor(public traitIds: string[]) { super(); }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/components/phase1b-components.test.ts --config configs/vitest.config.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass (~153).

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/components/attributes-component.ts" "01 - Projects/Project Meridian/src/infrastructure/components/social-component.ts" "01 - Projects/Project Meridian/src/infrastructure/components/traits-component.ts" "01 - Projects/Project Meridian/tests/infrastructure/components/phase1b-components.test.ts"
git commit -m "feat(meridian): AttributesComponent, SocialComponent, TraitsComponent"
```

---

## Chunk B: Pure Domain Functions

### Task B1: applyNeedsDecay Pure Function

**Files:**
- Create: `src/domain/systems/needs-decay.ts`
- Create: `tests/domain/systems/needs-decay.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/needs-decay.test.ts
import { describe, it, expect } from 'vitest';
import { applyNeedsDecay } from '../../../src/domain/systems/needs-decay.js';
import type { NeedsState } from '../../../src/domain/core/component-data.js';

function makeInput(overrides: Partial<{ state: Partial<NeedsState>; ht: number; chr: number }> = {}) {
	return {
		state: { hunger: 80, energy: 90, social: 70, ...overrides.state },
		hungerAttribute: overrides.ht ?? 10,
		energyAttribute: overrides.ht ?? 10,
		socialAttribute: overrides.chr ?? 10,
		modifiers: null,
	};
}

const defaultConfig = { hunger_decay: 0.5, energy_decay: 0.25, social_decay: 0.15 };

describe('applyNeedsDecay', () => {
	it('decays all three needs with default attributes (HT=10, Chr=10)', () => {
		const result = applyNeedsDecay(makeInput(), defaultConfig);
		// decay = rate / (attr/10) = rate / 1.0 = rate
		expect(result.state.hunger).toBe(79.5);
		expect(result.state.energy).toBe(89.75);
		expect(result.state.social).toBe(69.85);
	});

	it('scales decay inversely with attribute (HT=20 → half decay)', () => {
		const result = applyNeedsDecay(makeInput({ ht: 20 }), defaultConfig);
		// decay = 0.5 / (20/10) = 0.5 / 2 = 0.25
		expect(result.state.hunger).toBe(79.75);
	});

	it('applies trait modifier scale to decay rate', () => {
		const input = { ...makeInput(), modifiers: { hungerDecayScale: 2.0 } };
		const result = applyNeedsDecay(input, defaultConfig);
		// decay = 0.5 / 1.0 * 2.0 = 1.0
		expect(result.state.hunger).toBe(79);
	});

	it('emits NeedCritical when hunger drops below 20', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 20 } }), defaultConfig);
		const critical = result.events.find(e => e.type === 'NeedCritical' && e.need === 'hunger');
		expect(critical).toBeDefined();
		expect(critical?.threshold).toBe(20);
	});

	it('emits NeedCritical when energy drops below 15', () => {
		const result = applyNeedsDecay(makeInput({ state: { energy: 15 } }), defaultConfig);
		const critical = result.events.find(e => e.type === 'NeedCritical' && e.need === 'energy');
		expect(critical).toBeDefined();
		expect(critical?.threshold).toBe(15);
	});

	it('emits NeedCritical when social drops below 25', () => {
		const result = applyNeedsDecay(makeInput({ state: { social: 25 } }), defaultConfig);
		const critical = result.events.find(e => e.type === 'NeedCritical' && e.need === 'social');
		expect(critical).toBeDefined();
		expect(critical?.threshold).toBe(25);
	});

	it('emits AgentExhausted when energy reaches 0', () => {
		const result = applyNeedsDecay(makeInput({ state: { energy: 0.1 } }), defaultConfig);
		const exhausted = result.events.find(e => e.type === 'AgentExhausted');
		expect(exhausted).toBeDefined();
	});

	it('clamps values to [0, 100]', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 0.1 } }), defaultConfig);
		expect(result.state.hunger).toBe(0);
	});

	it('does not decay below 0', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 0 } }), defaultConfig);
		expect(result.state.hunger).toBe(0);
	});

	it('always emits NeedChanged for each need that changes', () => {
		const result = applyNeedsDecay(makeInput(), defaultConfig);
		const changed = result.events.filter(e => e.type === 'NeedChanged');
		expect(changed).toHaveLength(3);
	});

	it('does not emit NeedChanged when value is already 0', () => {
		const result = applyNeedsDecay(
			makeInput({ state: { hunger: 0, energy: 0, social: 0 } }),
			defaultConfig,
		);
		const changed = result.events.filter(e => e.type === 'NeedChanged');
		expect(changed).toHaveLength(0);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/needs-decay.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement applyNeedsDecay**

```typescript
// src/domain/systems/needs-decay.ts
import type { NeedsState } from '../core/component-data.js';

export interface NeedsDecayInput {
	state: NeedsState;
	hungerAttribute: number;
	energyAttribute: number;
	socialAttribute: number;
	modifiers: NeedsModifiers | null;
}

export interface NeedsModifiers {
	hungerDecayScale?: number;
	energyDecayScale?: number;
	socialDecayScale?: number;
}

export interface NeedEvent {
	type: 'NeedChanged' | 'NeedCritical' | 'AgentExhausted';
	need: 'hunger' | 'energy' | 'social';
	oldValue: number;
	newValue: number;
	threshold?: number;
}

export interface NeedsDecayResult {
	state: NeedsState;
	events: NeedEvent[];
}

interface NeedConfig {
	key: 'hunger' | 'energy' | 'social';
	decayRate: number;
	attribute: number;
	modifierScale: number;
	criticalThreshold: number;
}

const CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, social: 25 } as const;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

export function applyNeedsDecay(
	input: NeedsDecayInput,
	config: { hunger_decay: number; energy_decay: number; social_decay: number },
): NeedsDecayResult {
	const events: NeedEvent[] = [];
	const state = { ...input.state };

	const needs: NeedConfig[] = [
		{
			key: 'hunger',
			decayRate: config.hunger_decay,
			attribute: input.hungerAttribute,
			modifierScale: input.modifiers?.hungerDecayScale ?? 1.0,
			criticalThreshold: CRITICAL_THRESHOLDS.hunger,
		},
		{
			key: 'energy',
			decayRate: config.energy_decay,
			attribute: input.energyAttribute,
			modifierScale: input.modifiers?.energyDecayScale ?? 1.0,
			criticalThreshold: CRITICAL_THRESHOLDS.energy,
		},
		{
			key: 'social',
			decayRate: config.social_decay,
			attribute: input.socialAttribute,
			modifierScale: input.modifiers?.socialDecayScale ?? 1.0,
			criticalThreshold: CRITICAL_THRESHOLDS.social,
		},
	];

	for (const need of needs) {
		const oldValue = state[need.key];
		if (oldValue === 0) continue;

		const decay = need.decayRate / (need.attribute / 10) * need.modifierScale;
		const newValue = round2(clamp(oldValue - decay, 0, 100));
		state[need.key] = newValue;

		if (newValue !== oldValue) {
			events.push({ type: 'NeedChanged', need: need.key, oldValue, newValue });
		}

		if (newValue < need.criticalThreshold && newValue > 0) {
			events.push({ type: 'NeedCritical', need: need.key, oldValue, newValue, threshold: need.criticalThreshold });
		}

		if (need.key === 'energy' && newValue === 0) {
			events.push({ type: 'AgentExhausted', need: 'energy', oldValue, newValue });
		}
	}

	return { state, events };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/needs-decay.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (11 tests).

- [x] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/needs-decay.ts" "01 - Projects/Project Meridian/tests/domain/systems/needs-decay.test.ts"
git commit -m "feat(meridian): applyNeedsDecay pure function with TDD"
```

---

### Task B2: calculateMood Pure Function

**Files:**
- Create: `src/domain/systems/mood.ts`
- Create: `tests/domain/systems/mood.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/mood.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMood } from '../../../src/domain/systems/mood.js';
import type { MoodFactors } from '../../../src/domain/systems/mood.js';

const defaultWeights = {
	needs: 30, positive_memories: 20, negative_memories: 20,
	goal_progress: 10, wallet: 10, equipment: 5, relationships: 5,
};

const defaultBuckets = [
	{ name: 'elated', min: 60, max: 100 },
	{ name: 'content', min: 20, max: 59 },
	{ name: 'stressed', min: -19, max: 19 },
	{ name: 'distressed', min: -59, max: -20 },
	{ name: 'breakdown', min: -100, max: -60 },
];

const defaultConfig = { factor_weights: defaultWeights, buckets: defaultBuckets, external_modifier_cap: 30 };

function makeFactors(overrides: Partial<MoodFactors> = {}): MoodFactors {
	return {
		needsSatisfaction: 0.5,
		positiveMemories: 0,
		negativeMemories: 0,
		goalProgress: 0,
		walletHealth: 0,
		equipmentCondition: 0,
		relationshipQuality: 0,
		...overrides,
	};
}

describe('calculateMood', () => {
	it('full needs satisfaction with no other factors → positive mood', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), '', defaultConfig, 0);
		// positivePart = 1.0 * 30 = 30, negativePart = 0
		// raw = (30 / 100) * 200 - 100 = 60 - 100 = -40 ... wait, that's wrong
		// Actually: rawMood = ((positivePart - negativePart) / totalWeight) * 200 - 100
		// = (30 / 100) * 200 - 100 = 60 - 100 = -40
		// This is because only needs (weight 30 out of 100) is active
		// With 4 zeroed factors, mood skews low — this is expected
		expect(result.value).toBeGreaterThan(-50);
		expect(result.value).toBeLessThan(0);
		expect(result.bucket).toBe('distressed');
	});

	it('all factors at maximum → elated', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 0);
		// positivePart = 30+20+10+10+5+5 = 80, negativePart = 0
		// raw = (80/100)*200 - 100 = 160 - 100 = 60
		expect(result.value).toBe(60);
		expect(result.bucket).toBe('elated');
	});

	it('negative memories lower mood', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			negativeMemories: 1.0,
		}), '', defaultConfig, 0);
		// positivePart = 30, negativePart = 20
		// raw = ((30-20)/100)*200 - 100 = (10/100)*200 - 100 = 20 - 100 = -80
		expect(result.value).toBe(-80);
		expect(result.bucket).toBe('breakdown');
	});

	it('positive memories increase mood', () => {
		const baseResult = calculateMood(makeFactors({ needsSatisfaction: 0.5 }), '', defaultConfig, 0);
		const withPositive = calculateMood(makeFactors({ needsSatisfaction: 0.5, positiveMemories: 0.5 }), '', defaultConfig, 0);
		expect(withPositive.value).toBeGreaterThan(baseResult.value);
	});

	it('bucket changed flag is true when bucket transitions', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'content', defaultConfig, 0);
		expect(result.changed).toBe(true);
	});

	it('bucket changed flag is false when bucket stays the same', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'distressed', defaultConfig, 0);
		expect(result.changed).toBe(false);
	});

	it('external modifiers apply and clamp to [-100, 100]', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 50);
		// raw = 60, + 50 = 110, clamped to 100
		expect(result.value).toBe(100);
	});

	it('all factors zero → lowest possible mood', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 0,
		}), '', defaultConfig, 0);
		// positivePart = 0, negativePart = 0
		// raw = (0/100)*200 - 100 = -100
		expect(result.value).toBe(-100);
		expect(result.bucket).toBe('breakdown');
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/mood.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement calculateMood**

```typescript
// src/domain/systems/mood.ts

export interface MoodFactors {
	needsSatisfaction: number;
	positiveMemories: number;
	negativeMemories: number;
	goalProgress: number;
	walletHealth: number;
	equipmentCondition: number;
	relationshipQuality: number;
}

export interface MoodConfig {
	factor_weights: {
		needs: number;
		positive_memories: number;
		negative_memories: number;
		goal_progress: number;
		wallet: number;
		equipment: number;
		relationships: number;
	};
	buckets: { name: string; min: number; max: number }[];
	external_modifier_cap: number;
}

export interface MoodResult {
	value: number;
	bucket: string;
	changed: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function calculateMood(
	factors: MoodFactors,
	previousBucket: string,
	config: MoodConfig,
	externalModifiers: number,
): MoodResult {
	const w = config.factor_weights;

	const positivePart =
		factors.needsSatisfaction * w.needs
		+ factors.positiveMemories * w.positive_memories
		+ factors.goalProgress * w.goal_progress
		+ factors.walletHealth * w.wallet
		+ factors.equipmentCondition * w.equipment
		+ factors.relationshipQuality * w.relationships;

	const negativePart = factors.negativeMemories * w.negative_memories;

	const totalWeight = w.needs + w.positive_memories + w.negative_memories
		+ w.goal_progress + w.wallet + w.equipment + w.relationships;

	const rawMood = ((positivePart - negativePart) / totalWeight) * 200 - 100;
	const value = clamp(Math.round(rawMood + externalModifiers), -100, 100);

	let bucket = 'stressed';
	for (const b of config.buckets) {
		if (value >= b.min && value <= b.max) {
			bucket = b.name;
			break;
		}
	}

	return { value, bucket, changed: bucket !== previousBucket };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/mood.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (8 tests).

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/mood.ts" "01 - Projects/Project Meridian/tests/domain/systems/mood.test.ts"
git commit -m "feat(meridian): calculateMood pure function with TDD"
```

---

### Task B3: applyMemoryDecay Pure Function

**Files:**
- Create: `src/domain/systems/memory-decay.ts`
- Create: `tests/domain/systems/memory-decay.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/memory-decay.test.ts
import { describe, it, expect } from 'vitest';
import { applyMemoryDecay } from '../../../src/domain/systems/memory-decay.js';
import type { MemoryEntry, MemoryState } from '../../../src/domain/core/component-data.js';

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
	return {
		tick: 0,
		type: 'test',
		description: 'test event',
		participants: [],
		outcome: 'neutral',
		significance: 5,
		mood_impact: 0,
		...overrides,
	};
}

function makeState(entries: MemoryEntry[], maxEntries = 50): MemoryState {
	return { entries, maxEntries };
}

const defaultConfig = { min_lifespan_ticks: 20 };

describe('applyMemoryDecay', () => {
	it('does not decay entries within min lifespan', () => {
		const entry = makeEntry({ tick: 90, significance: 5 });
		const result = applyMemoryDecay(makeState([entry]), 100, defaultConfig);
		expect(result.state.entries[0]?.significance).toBe(5);
		expect(result.decayedCount).toBe(0);
	});

	it('decays entries past min lifespan', () => {
		const entry = makeEntry({ tick: 0, significance: 5 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		// decay = 0.1 / (5 / 5) = 0.1
		expect(result.state.entries[0]?.significance).toBeCloseTo(4.9, 2);
		expect(result.decayedCount).toBe(1);
	});

	it('sets original_significance on first decay', () => {
		const entry = makeEntry({ tick: 0, significance: 8 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		expect(result.state.entries[0]?.original_significance).toBe(8);
	});

	it('uses original_significance for subsequent decays', () => {
		const entry = makeEntry({ tick: 0, significance: 4.9, original_significance: 5 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		// decay = 0.1 / (5 / 5) = 0.1 (uses original_significance=5, not current 4.9)
		expect(result.state.entries[0]?.significance).toBeCloseTo(4.8, 2);
	});

	it('high-significance entries decay slower', () => {
		const highSig = makeEntry({ tick: 0, significance: 10 });
		const lowSig = makeEntry({ tick: 0, significance: 2 });
		const highResult = applyMemoryDecay(makeState([highSig]), 25, defaultConfig);
		const lowResult = applyMemoryDecay(makeState([lowSig]), 25, defaultConfig);
		// high: decay = 0.1 / (10/5) = 0.05 → 9.95
		// low: decay = 0.1 / (2/5) = 0.25 → 1.75
		expect(highResult.state.entries[0]?.significance).toBeCloseTo(9.95, 2);
		expect(lowResult.state.entries[0]?.significance).toBeCloseTo(1.75, 2);
	});

	it('prunes entries with significance < 1', () => {
		const entry = makeEntry({ tick: 0, significance: 0.5, original_significance: 1 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		expect(result.state.entries).toHaveLength(0);
		expect(result.prunedCount).toBe(1);
	});

	it('empty memory state is a no-op', () => {
		const result = applyMemoryDecay(makeState([]), 100, defaultConfig);
		expect(result.state.entries).toHaveLength(0);
		expect(result.decayedCount).toBe(0);
		expect(result.prunedCount).toBe(0);
	});

	it('enforces maxEntries by dropping lowest-significance', () => {
		const entries = [
			makeEntry({ tick: 0, significance: 3, type: 'low' }),
			makeEntry({ tick: 0, significance: 8, type: 'high' }),
			makeEntry({ tick: 0, significance: 5, type: 'mid' }),
		];
		const result = applyMemoryDecay(makeState(entries, 2), 25, defaultConfig);
		expect(result.state.entries).toHaveLength(2);
		expect(result.state.entries.find(e => e.type === 'low')).toBeUndefined();
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/memory-decay.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement applyMemoryDecay**

```typescript
// src/domain/systems/memory-decay.ts
import type { MemoryEntry, MemoryState } from '../core/component-data.js';

export interface MemoryDecayResult {
	state: MemoryState;
	decayedCount: number;
	prunedCount: number;
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

export function applyMemoryDecay(
	state: MemoryState,
	currentTick: number,
	config: { min_lifespan_ticks: number },
): MemoryDecayResult {
	if (state.entries.length === 0) {
		return { state, decayedCount: 0, prunedCount: 0 };
	}

	let decayedCount = 0;
	let prunedCount = 0;

	const decayed: MemoryEntry[] = [];

	for (const entry of state.entries) {
		const age = currentTick - entry.tick;
		if (age < config.min_lifespan_ticks) {
			decayed.push(entry);
			continue;
		}

		const originalSig = entry.original_significance ?? entry.significance;
		const decayAmount = 0.1 / (originalSig / 5);
		const newSignificance = round2(entry.significance - decayAmount);

		if (newSignificance < 1) {
			prunedCount++;
			continue;
		}

		decayed.push({
			...entry,
			significance: newSignificance,
			original_significance: originalSig,
		});
		decayedCount++;
	}

	// Enforce maxEntries — drop lowest-significance if over
	if (decayed.length > state.maxEntries) {
		decayed.sort((a, b) => b.significance - a.significance);
		const excess = decayed.length - state.maxEntries;
		decayed.splice(state.maxEntries, excess);
		prunedCount += excess;
	}

	return {
		state: { entries: decayed, maxEntries: state.maxEntries },
		decayedCount,
		prunedCount,
	};
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/memory-decay.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (8 tests).

- [x] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/memory-decay.ts" "01 - Projects/Project Meridian/tests/domain/systems/memory-decay.test.ts"
git commit -m "feat(meridian): applyMemoryDecay pure function with TDD"
```

---

## Chunk C: Agent Entity Pipeline

### Task C1: AgentActor Class

**Files:**
- Create: `src/infrastructure/entity/agent-actor.ts`

- [x] **Step 1: Implement AgentActor**

```typescript
// src/infrastructure/entity/agent-actor.ts
import { Actor } from 'excalibur';
import type { Agent } from '../../domain/schemas/agent-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { TraitsComponent } from '../components/traits-component.js';
import { calculateMood } from '../../domain/systems/mood.js';
import type { MoodConfig } from '../../domain/systems/mood.js';

export class AgentActor extends Actor {
	readonly agentId: string;
	readonly agentName: string;
	readonly kind: string;

	constructor(agent: Agent, moodConfig: MoodConfig) {
		super({ x: agent.position.x, y: agent.position.y });

		this.agentId = agent.id;
		this.agentName = agent.name;
		this.kind = agent.kind;

		this.addComponent(new NeedsComponent({ ...agent.needs }));

		// Bootstrap mood from needs — agent.mood (number) is discarded
		const needsSatisfaction = (agent.needs.hunger + agent.needs.energy + agent.needs.social) / 300;
		const initialMood = calculateMood(
			{
				needsSatisfaction,
				positiveMemories: 0,
				negativeMemories: 0,
				goalProgress: 0,
				walletHealth: 0,
				equipmentCondition: 0,
				relationshipQuality: 0,
			},
			'',
			moodConfig,
			0,
		);
		this.addComponent(new MoodComponent({ value: initialMood.value, bucket: initialMood.bucket }));

		this.addComponent(new MemoryComponent({
			entries: agent.memory.map(m => ({ ...m })),
			maxEntries: 50,
		}));
		this.addComponent(new BlackboardComponent({}));
		this.addComponent(new AttributesComponent({ ...agent.attributes }));
		this.addComponent(new SocialComponent({ ...agent.social }));
		this.addComponent(new TraitsComponent([...agent.traits]));
	}
}
```

- [x] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/agent-actor.ts"
git commit -m "feat(meridian): AgentActor — ExcaliburJS Actor with all game components"
```

---

### Task C2: Agent Spawner

**Files:**
- Create: `src/infrastructure/entity/agent-spawner.ts`
- Create: `tests/infrastructure/entity/agent-spawner.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/entity/agent-spawner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createAgentSpawner } from '../../../src/infrastructure/entity/agent-spawner.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { TraitsComponent } from '../../../src/infrastructure/components/traits-component.js';

const validAgent = {
	id: 'agent-elena',
	name: 'Elena',
	kind: 'merchant',
	attributes: { ST: 10, DX: 12, IQ: 14, HT: 11 },
	social: { status: 2, reputation: 1, charisma: 14 },
	needs: { hunger: 80, energy: 90, social: 70 },
	mood: 0,
	memory: [],
	goals: [],
	skills: [],
	inventory: [],
	equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
	traits: ['curious'],
	wallet: { gold: 50 },
	xp: 0,
	level: 1,
	position: { x: 100, y: 200, region: 'town-square' },
	relationships: 'graphs/relationships.canvas',
	tools: [],
	behavior_tree: 'bt/merchant.md',
	job: null,
	property: [],
};

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

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

describe('AgentSpawner', () => {
	it('spawns valid agent with correct components', async () => {
		const vault = createMockVault({ 'agents/elena.json': JSON.stringify(validAgent) });
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]).toBeInstanceOf(AgentActor);
		expect(result.agents[0]?.agentId).toBe('agent-elena');
		expect(result.agents[0]?.get(NeedsComponent).state.hunger).toBe(80);
		expect(result.agents[0]?.get(AttributesComponent).state.IQ).toBe(14);
		expect(result.agents[0]?.get(TraitsComponent).traitIds).toEqual(['curious']);
	});

	it('skips invalid agent and collects error', async () => {
		const vault = createMockVault({ 'agents/bad.json': '{"invalid": true}' });
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('agents/bad.json');
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});

	it('spawns multiple valid agents', async () => {
		const agent2 = { ...validAgent, id: 'agent-marcus', name: 'Marcus' };
		const vault = createMockVault({
			'agents/elena.json': JSON.stringify(validAgent),
			'agents/marcus.json': JSON.stringify(agent2),
		});
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(2);
	});

	it('skips non-JSON parse errors gracefully', async () => {
		const vault = createMockVault({ 'agents/broken.json': 'not json at all' });
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/agent-spawner.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement agent spawner**

```typescript
// src/infrastructure/entity/agent-spawner.ts
import type { Logger } from '../../domain/core/logger.js';
import { AgentSchema } from '../../domain/schemas/agent-schema.js';
import { AgentActor } from './agent-actor.js';
import type { MoodConfig } from '../../domain/systems/mood.js';

export interface VaultReader {
	list(path: string): Promise<string[]>;
	read(path: string): Promise<string>;
}

export interface SpawnResult {
	agents: AgentActor[];
	errors: { file: string; message: string }[];
}

export function createAgentSpawner(
	logger: Logger,
	moodConfig: MoodConfig,
): { spawnFromVault(vault: VaultReader, agentsPath: string): Promise<SpawnResult> } {
	return {
		async spawnFromVault(vault: VaultReader, agentsPath: string): Promise<SpawnResult> {
			const agents: AgentActor[] = [];
			const errors: { file: string; message: string }[] = [];

			const files = await vault.list(agentsPath);

			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					const agent = AgentSchema.parse(parsed);
					agents.push(new AgentActor(agent, moodConfig));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('AgentSpawner', `Failed to spawn agent from ${file}: ${message}`);
					errors.push({ file, message });
				}
			}

			logger.info('AgentSpawner', `Spawned ${String(agents.length)} agents, ${String(errors.length)} errors`);
			return { agents, errors };
		},
	};
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/agent-spawner.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (5 tests).

- [x] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/" "01 - Projects/Project Meridian/tests/infrastructure/entity/"
git commit -m "feat(meridian): AgentSpawner — vault → schema → ECS entity pipeline"
```

---

## Chunk D: Infrastructure GameSystem Wrappers

### Task D1: TraitResolverSystem

**Files:**
- Create: `src/infrastructure/systems/trait-resolver-system.ts`
- Create: `tests/infrastructure/systems/trait-resolver-system.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/systems/trait-resolver-system.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTraitResolverSystem } from '../../../src/infrastructure/systems/trait-resolver-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { TraitsComponent } from '../../../src/infrastructure/components/traits-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { TraitDefinition } from '../../../src/domain/systems/trait-resolver.js';

const traitDefs: Record<string, TraitDefinition> = {
	'hardy': {
		id: 'hardy',
		effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.8 } }],
		conflicts_with: [],
	},
	'frail': {
		id: 'frail',
		effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 1.5 } }],
		conflicts_with: ['hardy'],
	},
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn: vi.fn(), error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
	};
}

// Minimal agent data for creating AgentActors in tests
function createTestAgent(traits: string[]) {
	return {
		id: 'agent-test' as const,
		name: 'Test',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0,
		memory: [] as never[],
		goals: [] as never[],
		skills: [] as never[],
		inventory: [] as never[],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits,
		wallet: { gold: 50 },
		xp: 0,
		level: 1,
		position: { x: 0, y: 0, region: 'test' },
		relationships: '',
		tools: [] as never[],
		behavior_tree: 'bt/test.md',
		job: null,
		property: [] as never[],
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

describe('TraitResolverSystem', () => {
	it('writes modifier map to blackboard', () => {
		const agent = new AgentActor(createTestAgent(['hardy']), defaultMoodConfig);
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		system.execute(createDeps());

		const bb = agent.get(BlackboardComponent);
		const modifiers = bb.state.traitModifiers as Map<string, Record<string, unknown>> | undefined;
		expect(modifiers).toBeDefined();
		expect(modifiers?.get('NeedsDecaySystem')).toEqual({ hungerDecayScale: 0.8 });
	});

	it('writes empty map on trait conflict', () => {
		const agent = new AgentActor(createTestAgent(['hardy', 'frail']), defaultMoodConfig);
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		const deps = createDeps();
		system.execute(deps);

		const bb = agent.get(BlackboardComponent);
		const modifiers = bb.state.traitModifiers as Map<string, unknown> | undefined;
		expect(modifiers?.size).toBe(0);
		expect(deps.logger.warn).toHaveBeenCalled();
	});

	it('handles agent with no traits', () => {
		const agent = new AgentActor(createTestAgent([]), defaultMoodConfig);
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		system.execute(createDeps());

		const bb = agent.get(BlackboardComponent);
		const modifiers = bb.state.traitModifiers as Map<string, unknown> | undefined;
		expect(modifiers?.size).toBe(0);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/trait-resolver-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement TraitResolverSystem**

```typescript
// src/infrastructure/systems/trait-resolver-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { resolveTraitModifiers, type TraitDefinition } from '../../domain/systems/trait-resolver.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { TraitsComponent } from '../components/traits-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

export function createTraitResolverSystem(
	entities: () => AgentActor[],
	traitDefinitions: Record<string, TraitDefinition>,
): GameSystem {
	return {
		name: 'TraitResolverSystem',
		priority: SystemPriority.TRAIT_RESOLVER,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const traits = entity.get(TraitsComponent);
				const bb = entity.get(BlackboardComponent);

				const result = resolveTraitModifiers(traits.traitIds, traitDefinitions);
				if (result.ok) {
					bb.state.traitModifiers = result.value;
				} else {
					deps.logger.warn('TraitResolverSystem', `Agent ${entity.agentId}: ${result.error.message}`);
					bb.state.traitModifiers = new Map();
				}
				bb.markDirty();
			}
		},
	};
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/trait-resolver-system.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trait-resolver-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/trait-resolver-system.test.ts"
git commit -m "feat(meridian): TraitResolverSystem — ECS wrapper for trait resolution"
```

---

### Task D2: NeedsDecaySystem

**Files:**
- Create: `src/infrastructure/systems/needs-decay-system.ts`
- Create: `tests/infrastructure/systems/needs-decay-system.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/systems/needs-decay-system.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createNeedsDecaySystem } from '../../../src/infrastructure/systems/needs-decay-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

// Reuse the test agent helper from D1 (or inline it)
function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-test',
		name: 'Test',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0,
		memory: [],
		goals: [],
		skills: [],
		inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [],
		wallet: { gold: 50 },
		xp: 0,
		level: 1,
		position: { x: 0, y: 0, region: 'test' },
		relationships: '',
		tools: [],
		behavior_tree: 'bt/test.md',
		job: null,
		property: [],
		...overrides,
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
	};
}

describe('NeedsDecaySystem', () => {
	it('reads NeedsComponent and writes decayed values', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBeLessThan(80);
		expect(needs.state.energy).toBeLessThan(90);
		expect(needs.state.social).toBeLessThan(70);
		expect(needs.dirty).toBe(true);
	});

	it('reads modifiers from blackboard', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		// Set modifier on blackboard (as TraitResolverSystem would)
		const bb = agent.get(BlackboardComponent);
		const modMap = new Map([['NeedsDecaySystem', { hungerDecayScale: 2.0 }]]);
		bb.state.traitModifiers = modMap;

		const system = createNeedsDecaySystem(() => [agent]);
		const depsNoMod = createDeps();
		const agentNoMod = new AgentActor(createTestAgent(), defaultMoodConfig);
		const systemNoMod = createNeedsDecaySystem(() => [agentNoMod]);
		systemNoMod.execute(depsNoMod);
		system.execute(createDeps());

		// With 2x decay, hunger should drop more
		expect(agent.get(NeedsComponent).state.hunger).toBeLessThan(agentNoMod.get(NeedsComponent).state.hunger);
	});

	it('emits NeedChanged events via EventBus', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('NeedChanged', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events.length).toBeGreaterThan(0);
		expect(events[0]?.payload.agentId).toBe('agent-test');
	});

	it('emits NeedCritical when need drops below threshold', () => {
		const eventBus = createEventBus();
		const criticals: GameEvent[] = [];
		eventBus.on('NeedCritical', (e) => { criticals.push(e); });

		const agent = new AgentActor(createTestAgent({ needs: { hunger: 19.8, energy: 90, social: 70 } }), defaultMoodConfig);
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(criticals.length).toBeGreaterThan(0);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/needs-decay-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement NeedsDecaySystem**

```typescript
// src/infrastructure/systems/needs-decay-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyNeedsDecay, type NeedsModifiers } from '../../domain/systems/needs-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { ModifierMap } from '../../domain/systems/trait-resolver.js';
import { NeedsComponent } from '../components/needs-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

export function createNeedsDecaySystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'NeedsDecaySystem',
		priority: SystemPriority.NEEDS_DECAY,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const attrs = entity.get(AttributesComponent);
				const bb = entity.get(BlackboardComponent);

				const traitModifiers = bb.state.traitModifiers as ModifierMap | undefined;
				const needsMods = traitModifiers?.get('NeedsDecaySystem') as NeedsModifiers | undefined;

				const result = applyNeedsDecay(
					{
						state: needs.state,
						hungerAttribute: attrs.state.HT,
						energyAttribute: attrs.state.HT,
						socialAttribute: entity.get(
							(await import('../components/social-component.js')).SocialComponent,
						)?.state.charisma ?? 10,
						modifiers: needsMods ?? null,
					},
					deps.config.needs,
				);

				needs.state = result.state;
				needs.markDirty();

				for (const event of result.events) {
					deps.eventBus.emit({
						type: event.type,
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'NeedsDecaySystem',
						payload: { agentId: entity.agentId, ...event },
					});
				}
			}
		},
	};
}
```

**Wait** — the above has an `await import()` which is invalid in a synchronous `execute()`. Fix: import `SocialComponent` at the top of the file.

Replace the implementation with:

```typescript
// src/infrastructure/systems/needs-decay-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyNeedsDecay, type NeedsModifiers } from '../../domain/systems/needs-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { ModifierMap } from '../../domain/systems/trait-resolver.js';
import { NeedsComponent } from '../components/needs-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

export function createNeedsDecaySystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'NeedsDecaySystem',
		priority: SystemPriority.NEEDS_DECAY,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const attrs = entity.get(AttributesComponent);
				const social = entity.get(SocialComponent);
				const bb = entity.get(BlackboardComponent);

				const traitModifiers = bb.state.traitModifiers as ModifierMap | undefined;
				const needsMods = traitModifiers?.get('NeedsDecaySystem') as NeedsModifiers | undefined;

				const result = applyNeedsDecay(
					{
						state: needs.state,
						hungerAttribute: attrs.state.HT,
						energyAttribute: attrs.state.HT,
						socialAttribute: social.state.charisma,
						modifiers: needsMods ?? null,
					},
					deps.config.needs,
				);

				needs.state = result.state;
				needs.markDirty();

				for (const event of result.events) {
					deps.eventBus.emit({
						type: event.type,
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'NeedsDecaySystem',
						payload: { agentId: entity.agentId, ...event },
					});
				}
			}
		},
	};
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/needs-decay-system.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/needs-decay-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/needs-decay-system.test.ts"
git commit -m "feat(meridian): NeedsDecaySystem — ECS wrapper with trait modifiers + events"
```

---

### Task D3: MoodSystem

**Files:**
- Create: `src/infrastructure/systems/mood-system.ts`
- Create: `tests/infrastructure/systems/mood-system.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/systems/mood-system.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createMoodSystem } from '../../../src/infrastructure/systems/mood-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], behavior_tree: 'bt/test.md', job: null, property: [],
		...overrides,
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 100,
	};
}

describe('MoodSystem', () => {
	it('reads components and calculates mood', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps());

		const mood = agent.get(MoodComponent);
		expect(mood.state.value).toBeDefined();
		expect(mood.state.bucket).toBeDefined();
		expect(mood.dirty).toBe(true);
	});

	it('emits MoodChanged on bucket transition', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('MoodChanged', (e) => { events.push(e); });

		// Agent starts with mood from constructor (which may be 'distressed' due to partial factors)
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const prevBucket = agent.get(MoodComponent).state.bucket;

		// Manually set a different bucket to force a transition
		agent.get(MoodComponent).state.bucket = prevBucket === 'content' ? 'stressed' : 'content';

		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events.length).toBeGreaterThan(0);
		expect(events[0]?.payload.agentId).toBe('agent-test');
	});

	it('emits MoodBreakdown when entering breakdown', () => {
		const eventBus = createEventBus();
		const breakdowns: GameEvent[] = [];
		eventBus.on('MoodBreakdown', (e) => { breakdowns.push(e); });

		// Agent with zero needs → mood should be very low
		const agent = new AgentActor(
			createTestAgent({ needs: { hunger: 0, energy: 0, social: 0 } }),
			defaultMoodConfig,
		);
		// Force previous bucket to something other than breakdown
		agent.get(MoodComponent).state.bucket = 'content';

		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(breakdowns.length).toBeGreaterThan(0);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/mood-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement MoodSystem**

```typescript
// src/infrastructure/systems/mood-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { calculateMood, type MoodFactors } from '../../domain/systems/mood.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';

const MEMORY_WINDOW_TICKS = 50;
const MEMORY_SATURATION_COUNT = 10;

export function createMoodSystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'MoodSystem',
		priority: SystemPriority.MOOD,

		execute(deps: GameCoreDeps): void {
			const tickWindow = deps.tickCount - MEMORY_WINDOW_TICKS;

			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const mood = entity.get(MoodComponent);
				const memory = entity.get(MemoryComponent);

				const recentEntries = memory.state.entries.filter(e => e.tick >= tickWindow);
				const positiveCount = recentEntries.filter(e => e.outcome === 'positive').length;
				const negativeCount = recentEntries.filter(e => e.outcome === 'negative').length;

				const factors: MoodFactors = {
					needsSatisfaction: (needs.state.hunger + needs.state.energy + needs.state.social) / 300,
					positiveMemories: Math.min(positiveCount / MEMORY_SATURATION_COUNT, 1.0),
					negativeMemories: Math.min(negativeCount / MEMORY_SATURATION_COUNT, 1.0),
					goalProgress: 0,
					walletHealth: 0,
					equipmentCondition: 0,
					relationshipQuality: 0,
				};

				const result = calculateMood(factors, mood.state.bucket, deps.config.mood, 0);

				mood.state = { value: result.value, bucket: result.bucket };
				mood.markDirty();

				if (result.changed) {
					deps.eventBus.emit({
						type: 'MoodChanged',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MoodSystem',
						payload: {
							agentId: entity.agentId,
							oldBucket: mood.state.bucket,
							newBucket: result.bucket,
							value: result.value,
						},
					});

					if (result.bucket === 'breakdown') {
						deps.eventBus.emit({
							type: 'MoodBreakdown',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'MoodSystem',
							payload: { agentId: entity.agentId, value: result.value },
						});
					}
				}
			}
		},
	};
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/mood-system.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/mood-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/mood-system.test.ts"
git commit -m "feat(meridian): MoodSystem — ECS wrapper with memory window + bucket events"
```

---

### Task D4: MemoryDecaySystem

**Files:**
- Create: `src/infrastructure/systems/memory-decay-system.ts`
- Create: `tests/infrastructure/systems/memory-decay-system.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/systems/memory-decay-system.test.ts
import { describe, it, expect } from 'vitest';
import { createMemoryDecaySystem } from '../../../src/infrastructure/systems/memory-decay-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createTestAgent(memory: unknown[] = []) {
	return {
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0, memory, goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], behavior_tree: 'bt/test.md', job: null, property: [],
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 100,
	};
}

describe('MemoryDecaySystem', () => {
	it('decays memory entries past min lifespan', () => {
		const memory = [{
			tick: 0, type: 'test', description: 'old memory',
			participants: [], outcome: 'neutral' as const, significance: 5, mood_impact: 0,
		}];
		const agent = new AgentActor(createTestAgent(memory), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		system.execute(createDeps());

		const mem = agent.get(MemoryComponent);
		expect(mem.state.entries[0]?.significance).toBeLessThan(5);
		expect(mem.dirty).toBe(true);
	});

	it('emits MemoryDecayed when entries change', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('MemoryDecayed', (e) => { events.push(e); });

		const memory = [{
			tick: 0, type: 'test', description: 'old memory',
			participants: [], outcome: 'neutral' as const, significance: 5, mood_impact: 0,
		}];
		const agent = new AgentActor(createTestAgent(memory), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events).toHaveLength(1);
		expect(events[0]?.payload.agentId).toBe('agent-test');
	});

	it('does not emit when no entries change', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('MemoryDecayed', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events).toHaveLength(0);
	});
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/memory-decay-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement MemoryDecaySystem**

```typescript
// src/infrastructure/systems/memory-decay-system.ts
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyMemoryDecay } from '../../domain/systems/memory-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { MemoryComponent } from '../components/memory-component.js';

export function createMemoryDecaySystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'MemoryDecaySystem',
		priority: SystemPriority.MEMORY,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const memory = entity.get(MemoryComponent);
				const result = applyMemoryDecay(memory.state, deps.tickCount, deps.config.memory);

				if (result.decayedCount > 0 || result.prunedCount > 0) {
					memory.state = result.state;
					memory.markDirty();

					deps.eventBus.emit({
						type: 'MemoryDecayed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MemoryDecaySystem',
						payload: {
							agentId: entity.agentId,
							decayedCount: result.decayedCount,
							prunedCount: result.prunedCount,
						},
					});
				}
			}
		},
	};
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/memory-decay-system.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (3 tests).

- [x] **Step 5: Run full quality gates**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts`
Expected: 0 errors, all tests pass.

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/memory-decay-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/memory-decay-system.test.ts"
git commit -m "feat(meridian): MemoryDecaySystem — ECS wrapper with significance decay + pruning"
```

---

## Chunk E: Plugin Wiring + Integration + Verification

### Task E1: Wire Systems in game-view.ts + plugin.ts

**Files:**
- Modify: `src/plugin.ts`
- Modify: `src/infrastructure/engine/game-view.ts`

- [x] **Step 1: Update plugin.ts — store trait definitions and mood config**

In `initializeGame()`, after creating gameDeps, add:

```typescript
// Store trait definitions for system creation (hardcoded defaults for Phase 1B)
this.traitDefinitions = {};  // Empty for now — agents with traits will use vault-loaded defs later
```

Add field: `private traitDefinitions: Record<string, TraitDefinition> = {};`

Also expose `traitDefinitions` and `moodConfig` (from `config.mood`) for the game view to use when creating systems.

- [x] **Step 2: Update game-view.ts — spawn agents and register systems**

After the existing tick system registration block, add:

```typescript
// Spawn agents from vault
import { createAgentSpawner } from './agent-spawner.js';  // adjust path
import { AgentActor } from '../entity/agent-actor.js';
import { createTraitResolverSystem } from '../systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../systems/needs-decay-system.js';
import { createMoodSystem } from '../systems/mood-system.js';
import { createMemoryDecaySystem } from '../systems/memory-decay-system.js';

// After tick system registration:
const spawner = createAgentSpawner(this.deps.logger, this.deps.config.mood);
const spawnResult = await spawner.spawnFromVault(vaultAdapter, 'agents/');
for (const agent of spawnResult.agents) {
    this.engine.currentScene.add(agent);
}

// Entity query
const getAgents = (): AgentActor[] =>
    this.engine!.currentScene.actors.filter((a): a is AgentActor => a instanceof AgentActor);

// Register game systems with tick runner
tickRunner.register(createTraitResolverSystem(getAgents, traitDefinitions));
tickRunner.register(createNeedsDecaySystem(getAgents));
tickRunner.register(createMoodSystem(getAgents));
tickRunner.register(createMemoryDecaySystem(getAgents));
```

Note: `game-view.ts` `onOpen()` will need to become fully async to support the vault read. The `onOpen()` method is already `async` (Obsidian ItemView contract).

The exact wiring will need careful integration with the existing code. Follow the existing pattern — the changes to `game-view.ts` should be minimal: add imports, call spawner, register systems.

- [x] **Step 3: Run typecheck + lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [x] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass.

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/plugin.ts" "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): wire 4 game systems + agent spawner in plugin/game-view"
```

---

### Task E2: Integration Tests

**Files:**
- Create: `tests/integration/life-systems-integration.test.ts`

- [x] **Step 1: Write integration tests**

```typescript
// tests/integration/life-systems-integration.test.ts
import { describe, it, expect } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { createTraitResolverSystem } from '../../src/infrastructure/systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../../src/infrastructure/systems/needs-decay-system.js';
import { createMoodSystem } from '../../src/infrastructure/systems/mood-system.js';
import { createMemoryDecaySystem } from '../../src/infrastructure/systems/memory-decay-system.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { MoodComponent } from '../../src/infrastructure/components/mood-component.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../src/domain/core/events.js';
import type { TraitDefinition } from '../../src/domain/systems/trait-resolver.js';

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-elena', name: 'Elena', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], behavior_tree: 'bt/test.md', job: null, property: [],
		...overrides,
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

describe('Life Systems Integration', () => {
	it('full tick: 4 systems execute in order, needs decay → mood reacts', () => {
		const eventBus = createEventBus();
		const eventLog: string[] = [];
		eventBus.on('NeedChanged', () => { eventLog.push('NeedChanged'); });
		eventBus.on('MoodChanged', () => { eventLog.push('MoodChanged'); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const getAgents = () => [agent];

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createMemoryDecaySystem(getAgents));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config: GameConfigSchema.parse({}),
			performanceTracker: createPerformanceTracker(),
			tickCount: 0,
		};

		runner.tick(deps);

		// Needs should have decayed
		expect(agent.get(NeedsComponent).state.hunger).toBeLessThan(80);

		// NeedChanged should fire before MoodChanged (system priority ordering)
		const needIdx = eventLog.indexOf('NeedChanged');
		const moodIdx = eventLog.indexOf('MoodChanged');
		if (moodIdx >= 0) {
			expect(needIdx).toBeLessThan(moodIdx);
		}
	});

	it('trait modifiers flow through blackboard → affect needs decay', () => {
		const eventBus = createEventBus();
		const traitDefs: Record<string, TraitDefinition> = {
			'hardy': {
				id: 'hardy',
				effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.5 } }],
				conflicts_with: [],
			},
		};

		const agentWithTrait = new AgentActor(createTestAgent({ traits: ['hardy'] }), defaultMoodConfig);
		const agentWithout = new AgentActor(createTestAgent({ id: 'agent-other' }), defaultMoodConfig);

		const runner1 = createTickRunner(eventBus);
		runner1.register(createTraitResolverSystem(() => [agentWithTrait], traitDefs));
		runner1.register(createNeedsDecaySystem(() => [agentWithTrait]));

		const runner2 = createTickRunner(createEventBus());
		runner2.register(createTraitResolverSystem(() => [agentWithout], traitDefs));
		runner2.register(createNeedsDecaySystem(() => [agentWithout]));

		const config = GameConfigSchema.parse({});
		const deps1: GameCoreDeps = { logger: { debug() {}, info() {}, warn() {}, error() {} }, eventBus, config, performanceTracker: createPerformanceTracker(), tickCount: 0 };
		const deps2: GameCoreDeps = { logger: { debug() {}, info() {}, warn() {}, error() {} }, eventBus: createEventBus(), config, performanceTracker: createPerformanceTracker(), tickCount: 0 };

		runner1.tick(deps1);
		runner2.tick(deps2);

		// Hardy trait → 0.5x hunger decay → agent with trait should have more hunger remaining
		expect(agentWithTrait.get(NeedsComponent).state.hunger).toBeGreaterThan(
			agentWithout.get(NeedsComponent).state.hunger,
		);
	});

	it('event delivery order: NeedChanged before MoodChanged', () => {
		const eventBus = createEventBus();
		const order: string[] = [];
		eventBus.on('NeedChanged', () => { order.push('NeedChanged'); });
		eventBus.on('MoodChanged', () => { order.push('MoodChanged'); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		// Force bucket to something that will change after mood recalculation
		agent.get(MoodComponent).state.bucket = 'elated';

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(() => [agent], {}));
		runner.register(createNeedsDecaySystem(() => [agent]));
		runner.register(createMoodSystem(() => [agent]));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config: GameConfigSchema.parse({}),
			performanceTracker: createPerformanceTracker(),
			tickCount: 0,
		};

		runner.tick(deps);

		const needIdx = order.indexOf('NeedChanged');
		const moodIdx = order.indexOf('MoodChanged');
		expect(needIdx).toBeGreaterThanOrEqual(0);
		expect(moodIdx).toBeGreaterThan(needIdx);
	});
});
```

- [x] **Step 2: Run integration tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/life-systems-integration.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS (3 tests).

- [x] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/life-systems-integration.test.ts"
git commit -m "test(meridian): life systems integration tests — full tick, trait flow, event order"
```

---

### Task E3: Full Verification

- [x] **Step 1: Run complete quality gate suite**

Run:
```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ tests/ --config configs/eslint.config.mjs
npx vitest run --config configs/vitest.config.ts
npm run build
```

Expected: 0 errors, 0 warnings, ~193 tests pass, build succeeds.

- [x] **Step 2: Verify exit criteria checklist**

| Criterion | Evidence |
|-----------|----------|
| 4 systems execute in priority order | integration test: full tick with all 4 systems |
| Agents loaded from vault → ECS entities | agent-spawner.test.ts: valid agent → components |
| NeedsDecay with trait modifiers | needs-decay.test.ts + integration: trait flow |
| Mood from 3 available factors | mood.test.ts: factors → bucket mapping |
| Memory decay + pruning | memory-decay.test.ts: lifespan, significance, prune |
| TraitResolver → blackboard | trait-resolver-system.test.ts: modifier map written |
| Events emitted correctly | system tests + integration: event payloads verified |
| Phase 0 + 1A tests pass | Full suite run |

- [x] **Step 3: Final commit**

```bash
git add "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 1B complete — core life systems + agent entity pipeline"
```
