# Phase 1D: Action Consequences — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make actions matter — rest recovers energy, food restores hunger, socializing creates memories, movement costs energy. Agents now have a self-sustaining life loop.

**Architecture:** Pure domain functions (tested in isolation) wrapped in thin infrastructure GameSystem wrappers. Location interaction via distance check against config-driven radius. Memory creation during socialization with per-pair cooldown.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), Zod (schema validation), Vitest, ESLint

**Design Spec:** `docs/specs/2026-03-29-phase1d-action-consequences-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`rest.ts`, `rest.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **ESLint:** `npx eslint src/ tests/ --config configs/eslint.config.mjs` — 0 errors
- **TypeScript:** `npx tsc --noEmit --project configs/tsconfig.json` — 0 errors
- **Full test:** `npx vitest run --config configs/vitest.config.ts` — all tests pass
- **No magic numbers** in infrastructure/systems/ — use named constants or config values

---

## Chunk A: Config + Schema + Priority Additions

### Task A1: Add config fields and SystemPriority values

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `src/domain/core/tick-scheduler.ts`
- Modify: `src/infrastructure/entity/agent-actor.ts`

- [ ] **Step 1: Add config schema fields**

In `src/domain/schemas/game-config-schema.ts`:

1. In `NeedsConfigSchema`, add:
```typescript
food_recovery_rate: z.number().default(1.5),
```

2. In `StaminaConfigSchema`, add:
```typescript
movement_energy_cost: z.number().default(0.1),
```

3. In `PerceptionConfigSchema`, add:
```typescript
interaction_radius: z.number().default(25),
```

4. Create a new `SocialConfigSchema` (before `GameConfigSchema`):
```typescript
const SocialConfigSchema = z.object({
	recovery_rate: z.number().default(0.5),
	memory_significance: z.number().int().default(3),
	memory_mood_impact: z.number().default(2),
	cooldown_ticks: z.number().int().default(50),
});
```

5. Add `social: withDefaults(SocialConfigSchema),` to the main `GameConfigSchema` object.

- [ ] **Step 2: Add SystemPriority values**

In `src/domain/core/tick-scheduler.ts`, add between MOVEMENT (5.5) and JOB (6):
```typescript
REST: 6.5,
FEED: 6.6,
SOCIALIZE: 6.7,
```

- [ ] **Step 3: Add `property` field to AgentActor**

In `src/infrastructure/entity/agent-actor.ts`, add after `readonly kind: string;`:
```typescript
readonly property: string[];
```

In the constructor, after `this.kind = agent.kind;`:
```typescript
this.property = [...agent.property];
```

- [ ] **Step 4: Run typecheck + lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/agent-actor.ts"
git commit -m "feat(meridian): Phase 1D config — social schema, stamina cost, interaction radius, agent property"
```

---

## Chunk B: Pure Domain Functions

### Task B1: applyRest — Energy Recovery

**Files:**
- Create: `src/domain/systems/rest.ts`
- Create: `tests/domain/systems/rest.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/rest.test.ts
import { describe, it, expect } from 'vitest';
import { applyRest } from '../../../src/domain/systems/rest.js';

const defaultConfig = {
	owned_home: { recovery_rate: 2.0, mood_effect: 2 },
	public_shelter: { recovery_rate: 1.5, mood_effect: 0 },
	outdoors: { recovery_rate: 1.0, mood_effect: -3 },
};

describe('applyRest', () => {
	it('recovers energy at owned_home rate', () => {
		const result = applyRest({ currentEnergy: 50, restTier: 'owned_home' }, defaultConfig);
		expect(result.newEnergy).toBe(52);
		expect(result.recovered).toBe(2);
		expect(result.moodEffect).toBe(2);
		expect(result.tier).toBe('owned_home');
	});

	it('recovers energy at public_shelter rate', () => {
		const result = applyRest({ currentEnergy: 50, restTier: 'public_shelter' }, defaultConfig);
		expect(result.newEnergy).toBe(51.5);
		expect(result.recovered).toBe(1.5);
		expect(result.moodEffect).toBe(0);
	});

	it('recovers energy at outdoors rate with negative mood', () => {
		const result = applyRest({ currentEnergy: 50, restTier: 'outdoors' }, defaultConfig);
		expect(result.newEnergy).toBe(51);
		expect(result.moodEffect).toBe(-3);
	});

	it('clamps energy to 100', () => {
		const result = applyRest({ currentEnergy: 99.5, restTier: 'owned_home' }, defaultConfig);
		expect(result.newEnergy).toBe(100);
		expect(result.recovered).toBe(0.5);
	});

	it('does not recover past 100', () => {
		const result = applyRest({ currentEnergy: 100, restTier: 'owned_home' }, defaultConfig);
		expect(result.newEnergy).toBe(100);
		expect(result.recovered).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement applyRest**

```typescript
// src/domain/systems/rest.ts
import { clamp } from '../core/math-utils.js';

export interface RestInput {
	currentEnergy: number;
	restTier: 'owned_home' | 'public_shelter' | 'outdoors';
}

export interface RestTierConfig {
	recovery_rate: number;
	mood_effect: number;
}

export interface RestConfig {
	owned_home: RestTierConfig;
	public_shelter: RestTierConfig;
	outdoors: RestTierConfig;
}

export interface RestResult {
	newEnergy: number;
	recovered: number;
	moodEffect: number;
	tier: string;
}

export function applyRest(input: RestInput, config: RestConfig): RestResult {
	const tierConfig = config[input.restTier];
	const newEnergy = clamp(input.currentEnergy + tierConfig.recovery_rate, 0, 100);
	return {
		newEnergy,
		recovered: newEnergy - input.currentEnergy,
		moodEffect: tierConfig.mood_effect,
		tier: input.restTier,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass** (5 tests)
- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/rest.ts" "01 - Projects/Project Meridian/tests/domain/systems/rest.test.ts"
git commit -m "feat(meridian): applyRest pure function with TDD"
```

---

### Task B2: applyFeed — Hunger Recovery

**Files:**
- Create: `src/domain/systems/feed.ts`
- Create: `tests/domain/systems/feed.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/feed.test.ts
import { describe, it, expect } from 'vitest';
import { applyFeed } from '../../../src/domain/systems/feed.js';

describe('applyFeed', () => {
	it('recovers hunger at configured rate', () => {
		const result = applyFeed({ currentHunger: 50 }, { recovery_rate: 1.5 });
		expect(result.newHunger).toBe(51.5);
		expect(result.recovered).toBe(1.5);
	});

	it('clamps hunger to 100', () => {
		const result = applyFeed({ currentHunger: 99.5 }, { recovery_rate: 1.5 });
		expect(result.newHunger).toBe(100);
	});

	it('does not recover past 100', () => {
		const result = applyFeed({ currentHunger: 100 }, { recovery_rate: 1.5 });
		expect(result.recovered).toBe(0);
	});
});
```

- [ ] **Step 2: Implement applyFeed**

```typescript
// src/domain/systems/feed.ts
import { clamp } from '../core/math-utils.js';

export interface FeedInput {
	currentHunger: number;
}

export interface FeedConfig {
	recovery_rate: number;
}

export interface FeedResult {
	newHunger: number;
	recovered: number;
}

export function applyFeed(input: FeedInput, config: FeedConfig): FeedResult {
	const newHunger = clamp(input.currentHunger + config.recovery_rate, 0, 100);
	return {
		newHunger,
		recovered: newHunger - input.currentHunger,
	};
}
```

- [ ] **Step 3: Run tests** (3 tests), commit

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/feed.ts" "01 - Projects/Project Meridian/tests/domain/systems/feed.test.ts"
git commit -m "feat(meridian): applyFeed pure function with TDD"
```

---

### Task B3: applySocialize — Social Recovery + Memory

**Files:**
- Create: `src/domain/systems/socialize.ts`
- Create: `tests/domain/systems/socialize.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/socialize.test.ts
import { describe, it, expect } from 'vitest';
import { applySocialize } from '../../../src/domain/systems/socialize.js';

const defaultConfig = {
	recovery_rate: 0.5,
	memory_significance: 3,
	memory_mood_impact: 2,
	cooldown_ticks: 50,
};

describe('applySocialize', () => {
	it('recovers social at configured rate', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.newSocial).toBe(50.5);
		expect(result.recovered).toBe(0.5);
	});

	it('creates memory when not on cooldown', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.memory).not.toBeNull();
		expect(result.memory?.type).toBe('social');
		expect(result.memory?.participants).toEqual(['agent-marcus']);
		expect(result.memory?.outcome).toBe('positive');
		expect(result.memory?.significance).toBe(3);
		expect(result.memory?.mood_impact).toBe(2);
	});

	it('does not create memory when on cooldown', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 120, lastSocialTick: 100,
		}, defaultConfig);
		// 120 - 100 = 20, < cooldown 50 → on cooldown
		expect(result.memory).toBeNull();
		expect(result.recovered).toBe(0.5); // social still recovers
	});

	it('creates memory when cooldown expired', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 200, lastSocialTick: 100,
		}, defaultConfig);
		// 200 - 100 = 100, >= cooldown 50 → ok
		expect(result.memory).not.toBeNull();
	});

	it('clamps social to 100', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 99.8, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.newSocial).toBe(100);
	});

	it('includes partner name in memory description', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.memory?.description).toContain('Marcus');
	});
});
```

- [ ] **Step 2: Implement applySocialize**

```typescript
// src/domain/systems/socialize.ts
import { clamp } from '../core/math-utils.js';
import type { MemoryEntry } from '../core/component-data.js';

export interface SocializeInput {
	agentId: string;
	agentName: string;
	partnerId: string;
	partnerName: string;
	currentSocial: number;
	currentTick: number;
	lastSocialTick: number | null;
}

export interface SocializeConfig {
	recovery_rate: number;
	memory_significance: number;
	memory_mood_impact: number;
	cooldown_ticks: number;
}

export interface SocializeResult {
	newSocial: number;
	recovered: number;
	memory: MemoryEntry | null;
}

export function applySocialize(input: SocializeInput, config: SocializeConfig): SocializeResult {
	const newSocial = clamp(input.currentSocial + config.recovery_rate, 0, 100);
	const recovered = newSocial - input.currentSocial;

	const onCooldown = input.lastSocialTick !== null
		&& (input.currentTick - input.lastSocialTick) < config.cooldown_ticks;

	const memory: MemoryEntry | null = onCooldown ? null : {
		tick: input.currentTick,
		type: 'social',
		description: `Talked with ${input.partnerName}`,
		participants: [input.partnerId],
		outcome: 'positive',
		significance: config.memory_significance,
		mood_impact: config.memory_mood_impact,
	};

	return { newSocial, recovered, memory };
}
```

- [ ] **Step 3: Run tests** (6 tests), quality gates, commit

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/socialize.ts" "01 - Projects/Project Meridian/tests/domain/systems/socialize.test.ts"
git commit -m "feat(meridian): applySocialize pure function with TDD — recovery + memory creation"
```

---

## Chunk C: Infrastructure GameSystem Wrappers

### Task C1: RestSystem (priority 6.5)

**Files:**
- Create: `src/infrastructure/systems/rest-system.ts`
- Create: `tests/infrastructure/systems/rest-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests should verify:
- Agent at rest location → energy increases, `RestStarted` event emitted (first tick only)
- Agent owns the location → `owned_home` tier applied
- Agent at rest location they don't own → `public_shelter` tier
- Agent idle but not at rest location → `outdoors` tier
- Agent with non-idle BT action and not at rest location → skipped

**Test fixture pattern** (use for all system tests in Chunk C):

```typescript
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
```

For ownership tests: `createTestAgentData('agent-1', 300, 200, { property: ['loc-tavern'] })`.
For location fixtures: `{ id: 'loc-tavern', name: 'Tavern', type: 'rest', position: { x: 300, y: 200 }, capacity: 8, color: '#6a5acd' }`.

Track "first tick" via `bb.state.restingAt` — set when agent starts resting, clear when agent leaves. Only emit event when `restingAt` was previously undefined.

- [ ] **Step 2: Implement RestSystem**

The system iterates agents each tick:
1. Find nearest rest-type location within `deps.config.perception.interaction_radius`
2. Determine rest tier (owned_home if `agent.property.includes(loc.id)`, else public_shelter)
3. If no rest location but btAction is `'idle'` or undefined → outdoors tier
4. Call `applyRest()`, write energy to NeedsComponent
5. Track `bb.state.restingAt` for first-tick event emission
6. Emit `RestStarted` only on entry

- [ ] **Step 3: Run tests, commit**

### Task C2: FeedSystem (priority 6.6)

**Files:**
- Create: `src/infrastructure/systems/feed-system.ts`
- Create: `tests/infrastructure/systems/feed-system.test.ts`

Same pattern as RestSystem but simpler:
- Find nearest food-type location within interaction radius
- Call `applyFeed()` with `deps.config.needs.food_recovery_rate`
- Track `bb.state.feedingAt` for first-tick event
- Emit `FeedStarted` on entry

### Task C3: SocializeSystem (priority 6.7)

**Files:**
- Create: `src/infrastructure/systems/socialize-system.ts`
- Create: `tests/infrastructure/systems/socialize-system.test.ts`

For each agent whose `btAction` is in `AGENT_SOCIAL_ACTIONS`:
1. Find nearest agent from PerceptionComponent within interaction radius
2. Read cooldown from blackboard: `bb.state[`lastSocial_${partnerId}`]`
3. Call `applySocialize()` for both agents
4. Write social to NeedsComponent for both
5. If memory returned: append to MemoryComponent for both, update cooldown in blackboard
6. Emit `SocialInteraction` event

### Task C4: Movement Energy Drain

**Files:**
- Modify: `src/infrastructure/systems/movement-system.ts`
- Update: `tests/infrastructure/systems/movement-system.test.ts`

When an agent is moving (has velocity):
1. Calculate `energyCost = speedPerTick * deps.config.stamina.movement_energy_cost`
2. Subtract from NeedsComponent energy (clamped to 0)
3. When energy reaches 0: emit `AgentExhausted` (crossing only, check oldEnergy > 0)
4. When energy < NEED_CRITICAL_THRESHOLDS.energy (15): scale velocity by `deps.config.stamina.exhaustion_speed_modifier` (0.5)

Add tests:
- Moving agent loses energy each tick
- Exhausted agent (energy < 15) moves at half speed
- AgentExhausted event emitted when energy crosses 0

---

## Chunk D: Wiring + Integration + Operational

### Task D1: Wire Systems in game-view.ts

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

In `populateScene()`, after the existing Phase 1C system registrations, add:

```typescript
import { createRestSystem } from '../systems/rest-system.js';
import { createFeedSystem } from '../systems/feed-system.js';
import { createSocializeSystem } from '../systems/socialize-system.js';

// After existing tickRunner.register calls:
tickRunner.register(createRestSystem(getAgents, getLocations));
tickRunner.register(createFeedSystem(getAgents, getLocations));
tickRunner.register(createSocializeSystem(getAgents));
```

Run typecheck + lint + tests. Commit.

### Task D2: Integration Tests

**Files:**
- Create: `tests/integration/consequences-integration.test.ts`

3 tests:
1. **Hungry agent at food location → hunger recovers** — Place agent at food location position, run tick, verify hunger increased
2. **Agent rests at tavern → energy recovers** — Place agent at rest location, run tick, verify energy increased, RestStarted emitted
3. **Two agents socialize → both gain memory** — Place two agents near each other, one with `socialize` BT action, run tick, verify both have new memory entries

### Task D3: Update Smoke Test

**Files:**
- Modify: `tests/integration/smoke-test.test.ts`

Add a test: "agents at locations recover needs after tick" — place agents with low needs at matching location types, run tick, verify at least one agent's need increased.

### Task D4: Update README Generator

**Files:**
- Modify: `scripts/generate-readme.mjs`

Add an "Action Consequences" section documenting:
- Rest recovery rates (3 tiers)
- Food recovery rate
- Social recovery rate + memory cooldown
- Movement energy cost
- Interaction radius

### Task D5: Full Verification

- [ ] **Step 1: Run complete quality gates**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ tests/ --config configs/eslint.config.mjs
npx vitest run --config configs/vitest.config.ts
npm run build
```

Expected: 0 errors, 0 warnings, ~334+ tests pass, build succeeds with updated README.

- [ ] **Step 2: Verify exit criteria**

| Criterion | Evidence |
|-----------|----------|
| Rest recovers energy by tier | rest.test.ts + rest-system.test.ts |
| Feed recovers hunger | feed.test.ts + feed-system.test.ts |
| Socialize recovers social + creates memories | socialize.test.ts + socialize-system.test.ts |
| Movement drains energy | movement-system.test.ts (updated) |
| Agents slow when exhausted | movement-system.test.ts |
| Social memory cooldown | socialize.test.ts |
| Events emitted correctly | system tests + integration |
| No regressions | Full suite run |
| README updated | Build output check |

- [ ] **Step 3: Verify README contains new "Action Consequences" section**

Run: `npm run build` and check `dist/README.md` contains rest tiers, food recovery, social cooldown, and energy cost sections.

- [ ] **Step 4: Final commit**

```bash
git add "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 1D complete — action consequences (rest, feed, socialize, energy cost)"
```

---

## Learnings-Driven Requirements

These items reflect lessons from Phases 1B–1C. They are NOT optional.

### Test Fixture Requirements

ALL test agent fixtures MUST include these fields (learned from Phase 1C where missing fields caused 34 test failures):

```typescript
// Required in every createTestAgent / createTestAgentData helper:
color: '#b0b0b0',
persona: null,
property: [],  // NEW in Phase 1D — add to all existing test fixtures too
```

When adding `property` to AgentActor (Task A1), also update ALL existing test fixture helpers across the codebase to include `property: []`. Grep for `createTestAgent` and `createTestAgentData` across `tests/` — there are ~10 files.

### WorldLoader

No changes to `world-loader.ts` are needed — RestSystem, FeedSystem, and SocializeSystem read from `deps.config` (already available) and entity queries (already wired). State this explicitly when implementing so the subagent doesn't wonder.

### data-validation.test.ts

Add a test verifying the new config sections parse correctly:

```typescript
it('GameConfigSchema parses with social and stamina defaults', () => {
	const config = GameConfigSchema.parse({});
	expect(config.social.recovery_rate).toBe(0.5);
	expect(config.social.cooldown_ticks).toBe(50);
	expect(config.stamina.movement_energy_cost).toBe(0.1);
	expect(config.needs.food_recovery_rate).toBe(1.5);
	expect(config.perception.interaction_radius).toBe(25);
});
```

### Section 9 Documentation

After implementation completes, update the Phase 1D spec (`docs/specs/2026-03-29-phase1d-action-consequences-design.md`) with a Section 9: Post-Implementation Notes covering:
- Final test count
- Any deviations from spec
- Additional artifacts created

### Three Amigos Review + Polish

After all tasks complete and before merging: run a Three Amigos review (PO spec compliance, Architect code quality, Tester coverage gaps) followed by a polishing pass. This is standard procedure — do not skip.
