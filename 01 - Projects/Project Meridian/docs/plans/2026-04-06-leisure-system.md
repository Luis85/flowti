# Leisure System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly rest days, 4 leisure locations, and a personality-driven BT branch so agents have meaningful free time, express personality through leisure choices, and spend accumulated gold.

**Architecture:** Additive feature — no existing systems change. New `LeisureSystem` follows `RestSystem` pattern. New BT P2.5 branch between work and thirst. `IsWorkHours` gains one-line rest-day check. Leisure locations are standard `WorldLocation` JSON with a new `leisure` config block. Agent selection uses need-weighted + GURPS-attribute scoring.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, ExcaliburJS ECS components.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-06-leisure-system-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

---

## Chunk 1: Schema, Config, and Location Data

### Task 1: Add LeisureConfigSchema to location schema

**Files:**
- Modify: `src/domain/schemas/location-schema.ts:4,27-38`
- Test: `tests/domain/schemas/location-schema.test.ts` (existing)

- [ ] **Step 1: Add `'leisure'` to LOCATION_TYPES**

In `src/domain/schemas/location-schema.ts`, line 4:

```typescript
// Before:
export const LOCATION_TYPES = ['rest', 'food', 'social', 'work', 'market', 'water'] as const;

// After:
export const LOCATION_TYPES = ['rest', 'food', 'social', 'work', 'market', 'water', 'leisure'] as const;
```

- [ ] **Step 2: Add LeisureConfigSchema before LocationSchema**

After `ProductionSchema` (after line 25), add:

```typescript
const LeisureEffectsSchema = z.object({
	social: z.number().default(0),
	mood: z.number().default(0),
	energy: z.number().default(0),
	skill_xp: z.number().default(0),
});

export const LeisureConfigSchema = z.object({
	cost: z.number().min(0),
	effects: LeisureEffectsSchema,
	attribute_bonus: z.string().nullable().default(null),
	ticks_per_visit: z.number().int().min(1).default(15),
}).nullable().default(null);
```

- [ ] **Step 3: Add `leisure` field to LocationSchema**

After `production: ProductionSchema,` (line 34), add:

```typescript
leisure: LeisureConfigSchema,
```

- [ ] **Step 4: Export the new types**

After `export type Production = ...` (line 42), add:

```typescript
export type LeisureConfig = z.infer<typeof LeisureConfigSchema>;
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/ --config configs/vitest.config.ts`
Expected: all pass (existing location tests use `type: 'rest'|'food'|etc` which still work; `leisure` defaults to `null`).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/location-schema.ts"
git commit -m "feat(meridian): add LeisureConfigSchema to location schema"
```

---

### Task 2: Add rest_day_interval and leisure_mood_threshold to game config

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts:346-349`
- Modify: `configs/game-config.json`

- [ ] **Step 1: Add config fields to GameConfigSchema**

In `src/domain/schemas/game-config-schema.ts`, after `commitment_ticks` line (line 346), add:

```typescript
rest_day_interval: z.number().int().min(1).default(7),
leisure_mood_threshold: z.number().default(-20),
```

- [ ] **Step 2: Add values to game-config.json**

Add to `configs/game-config.json` (at root level, e.g., after `"commitment_ticks": {...}`):

```json
"rest_day_interval": 7,
"leisure_mood_threshold": -20
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/config/ --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "feat(meridian): add rest_day_interval and leisure_mood_threshold config"
```

---

### Task 3: Create 4 leisure location JSON files

**Files:**
- Create: `locations/tavern.json`
- Create: `locations/park.json`
- Create: `locations/library.json`
- Create: `locations/bathhouse.json`

- [ ] **Step 1: Create tavern.json**

```json
{
  "id": "loc-tavern",
  "name": "Tavern",
  "type": "leisure",
  "position": { "x": 250, "y": 280, "region": "market-square" },
  "production": null,
  "leisure": {
    "cost": 3,
    "effects": { "social": 15, "mood": 5, "energy": 0, "skill_xp": 0 },
    "attribute_bonus": null,
    "ticks_per_visit": 20
  }
}
```

- [ ] **Step 2: Create park.json**

```json
{
  "id": "loc-park",
  "name": "Park",
  "type": "leisure",
  "position": { "x": 120, "y": 220, "region": "residential" },
  "production": null,
  "leisure": {
    "cost": 0,
    "effects": { "social": 5, "mood": 8, "energy": 0, "skill_xp": 0 },
    "attribute_bonus": null,
    "ticks_per_visit": 15
  }
}
```

- [ ] **Step 3: Create library.json**

```json
{
  "id": "loc-library",
  "name": "Library",
  "type": "leisure",
  "position": { "x": 320, "y": 150, "region": "residential" },
  "production": null,
  "leisure": {
    "cost": 1,
    "effects": { "social": 0, "mood": 3, "energy": 0, "skill_xp": 1 },
    "attribute_bonus": "IQ",
    "ticks_per_visit": 20
  }
}
```

- [ ] **Step 4: Create bathhouse.json**

```json
{
  "id": "loc-bathhouse",
  "name": "Bathhouse",
  "type": "leisure",
  "position": { "x": 200, "y": 350, "region": "residential" },
  "production": null,
  "leisure": {
    "cost": 2,
    "effects": { "social": 0, "mood": 5, "energy": 20, "skill_xp": 0 },
    "attribute_bonus": "HT",
    "ticks_per_visit": 15
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/locations/"
git commit -m "feat(meridian): add 4 leisure locations — tavern, park, library, bathhouse"
```

---

## Chunk 2: Working Memory, BT Conditions, and BT Actions

### Task 4: Add leisureTarget to WorkingMemory

**Files:**
- Modify: `src/infrastructure/entity/bt-working-memory.ts:8-36,42-73`

- [ ] **Step 1: Add `leisureTarget` to WorkingMemory interface**

In the `WorkingMemory` interface (after `insideFacility: boolean;`, line 30), add:

```typescript
leisureTarget: string | null;
```

- [ ] **Step 2: Initialize in createWorkingMemory**

In the return object (after `insideFacility: false,`, line 64), add:

```typescript
leisureTarget: null,
```

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: errors in `behavior-agent-factory.ts` (the returned agent object doesn't expose `leisureTarget` yet — that's OK, we'll wire it in Task 6).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-working-memory.ts"
git commit -m "feat(meridian): add leisureTarget to WorkingMemory"
```

---

### Task 5: Add leisure methods to BehaviorAgent interface

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts:52-185`

- [ ] **Step 1: Add leisureTarget to working memory section**

After `insideFacility: boolean;` (line 96), add:

```typescript
leisureTarget: string | null;
```

- [ ] **Step 2: Add condition methods**

After `ShouldSleep(): boolean;` (line 145), add:

```typescript
IsRestDay(): boolean;
IsMoodLow(): boolean;
IsAtLeisure(): boolean;
```

- [ ] **Step 3: Add action methods**

After `Wander(): ActionResult;` (line 181), add:

```typescript
ChooseLeisure(): ActionResult;
SeekLeisureTarget(): ActionResult;
Leisure(): ActionResult;
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts"
git commit -m "feat(meridian): add leisure conditions and actions to BehaviorAgent interface"
```

---

### Task 6: Implement BT conditions — IsRestDay, IsMoodLow, IsAtLeisure, modify IsWorkHours

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions.ts:18-59,179-187`
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts` (wire leisureTarget + new conditions)

- [ ] **Step 1: Add to ConditionMethods interface**

In `bt-conditions.ts`, after `ShouldSleep(): boolean;` (line 58), add:

```typescript
IsRestDay(): boolean;
IsMoodLow(): boolean;
IsAtLeisure(): boolean;
```

- [ ] **Step 2: Implement IsRestDay**

Inside the return object of `createConditions`, after the `ShouldSleep` method, add:

```typescript
IsRestDay(): boolean {
	const time = worldEntity().get(TimeComponent).state;
	return time.dayCount > 0 && time.dayCount % config.rest_day_interval === 0;
},
```

Note: `config` is `deps.config` (already destructured at line 72). `rest_day_interval` is on `GameConfig` (added in Task 2).

- [ ] **Step 3: Implement IsMoodLow**

```typescript
IsMoodLow(): boolean {
	const moodValue = actor.get(MoodComponent).state.value;
	return moodValue < config.leisure_mood_threshold;
},
```

This requires importing `MoodComponent`. Check if it's already imported in `bt-conditions.ts` — if not, add the import.

- [ ] **Step 4: Implement IsAtLeisure**

```typescript
IsAtLeisure(): boolean {
	return memory.btAction === 'leisure' && memory.atLocation === memory.leisureTarget;
},
```

- [ ] **Step 5: Modify IsWorkHours to return false on rest days**

In the existing `IsWorkHours()` method (line 179), add an early return at the top:

```typescript
IsWorkHours(): boolean {
	// Rest days: no work
	const time = worldEntity().get(TimeComponent).state;
	if (time.dayCount > 0 && time.dayCount % config.rest_day_interval === 0) return false;
	const phase = time.phase;
	if (phase === 'day') return true;
	if (phase === 'dawn') {
		return time.tickInCycle >= config.day_night.dawn.start + wakeOffset;
	}
	return false;
},
```

- [ ] **Step 6: Wire leisureTarget in behavior-agent-factory.ts**

In `behavior-agent-factory.ts`, in the `agent` object, after `get insideFacility()` / `set insideFacility(v)`, add:

```typescript
get leisureTarget() { return memory.leisureTarget; },
set leisureTarget(v) { memory.leisureTarget = v; },
```

- [ ] **Step 7: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: errors about missing action methods (ChooseLeisure, etc.) — those come in Task 7.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): implement IsRestDay, IsMoodLow, IsAtLeisure conditions + rest-day IsWorkHours"
```

---

### Task 7: Implement BT actions — ChooseLeisure, SeekLeisureTarget, Leisure

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts:22-58,60-68`

- [ ] **Step 1: Add to ActionMethods interface**

In `bt-actions.ts`, after `Wander(): ActionResult;` in the `ActionMethods` interface, add:

```typescript
ChooseLeisure(): ActionResult;
SeekLeisureTarget(): ActionResult;
Leisure(): ActionResult;
```

- [ ] **Step 2: Implement ChooseLeisure**

Inside the return object of `createActions`, add:

```typescript
ChooseLeisure(): ActionResult {
	const locations = deps.getLocations();
	const gold = actor.get(WalletComponent).state.gold;
	const needs = actor.get(NeedsComponent).state;
	const moodValue = actor.get(MoodComponent).state.value;
	const attrComp = actor.get(AttributesComponent);
	const baseline = deps.config.jobs.aptitude_baseline;
	const knownSet = new Set(memory.knownLocations);

	const candidates: { id: string; score: number }[] = [];

	for (const loc of locations) {
		if (loc.leisure === null) continue;
		if (!knownSet.has(loc.id)) continue;
		if (loc.leisure.cost > gold) continue;

		// Need weight: sum of effects scaled by how much the agent needs them
		let needWeight = 0;
		if (loc.leisure.effects.social > 0) {
			needWeight += (100 - needs.social) / 100 * loc.leisure.effects.social;
		}
		if (loc.leisure.effects.mood > 0) {
			const moodNeed = (100 - Math.max(0, Math.min(200, moodValue + 100)) / 2) / 100;
			needWeight += moodNeed * loc.leisure.effects.mood;
		}
		if (loc.leisure.effects.energy > 0) {
			needWeight += (100 - needs.energy) / 100 * loc.leisure.effects.energy;
		}
		if (loc.leisure.effects.skill_xp > 0) {
			needWeight += loc.leisure.effects.skill_xp * 5;
		}

		// Attribute bonus: personality pull
		let attrBonus = 0;
		if (loc.leisure.attribute_bonus !== null) {
			attrBonus = attrComp.getByName(loc.leisure.attribute_bonus) / baseline * 3;
		}

		// Distance penalty
		const dist = Math.hypot(loc.position.x - actor.pos.x, loc.position.y - actor.pos.y);
		const distPenalty = dist / 100;

		candidates.push({ id: loc.id, score: needWeight + attrBonus - distPenalty });
	}

	if (candidates.length === 0) return FAILED;

	candidates.sort((a, b) => b.score - a.score);
	memory.leisureTarget = candidates[0]!.id;
	beginAction('choose_leisure');
	return SUCCEEDED;
},
```

Note: `MoodComponent` may need to be imported. Check if it's already imported in `bt-actions.ts` — if not, add it.

- [ ] **Step 3: Implement SeekLeisureTarget**

```typescript
SeekLeisureTarget(): ActionResult {
	if (memory.leisureTarget === null) return FAILED;
	beginAction('seek_leisure');
	memory.movementTarget = { id: memory.leisureTarget, type: 'location' };
	if (memory.atLocation === memory.leisureTarget) return SUCCEEDED;
	return RUNNING;
},
```

- [ ] **Step 4: Implement Leisure**

```typescript
Leisure(): ActionResult {
	if (memory.leisureTarget === null || memory.atLocation !== memory.leisureTarget) return FAILED;
	const loc = deps.getLocations().find(l => l.id === memory.leisureTarget);
	if (loc?.leisure === null || loc?.leisure === undefined) return FAILED;

	// Set commitment from location's ticks_per_visit
	if (memory.commitmentTicks <= 0) {
		memory.commitmentTicks = loc.leisure.ticks_per_visit;
		memory.committedAction = 'leisure';
	}
	beginAction('leisure');
	return RUNNING;
},
```

- [ ] **Step 5: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean (all interface methods now implemented).

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git commit -m "feat(meridian): implement ChooseLeisure, SeekLeisureTarget, Leisure BT actions"
```

---

## Chunk 3: LeisureSystem, BT Integration, Game View Registration

### Task 8: Create LeisureSystem

**Files:**
- Create: `src/infrastructure/systems/leisure-system.ts`
- Create: `tests/infrastructure/systems/leisure-system.test.ts`
- Modify: `src/domain/core/tick-scheduler.ts:32` (add LEISURE priority)

- [ ] **Step 1: Add LEISURE priority constant**

In `src/domain/core/tick-scheduler.ts`, after `SOCIALIZE: 6.7,` (line 33), add:

```typescript
LEISURE: 6.75,
```

- [ ] **Step 2: Create leisure-system.ts**

Create `src/infrastructure/systems/leisure-system.ts`:

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import type { Actor } from 'excalibur';

export function createLeisureSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	worldEntity: () => Actor,
	getLocationActors?: () => Map<string, Actor>,
): GameSystem {
	// Track which agent is currently at which leisure location (for first-tick detection)
	const activeLeisure = new Map<string, string>();

	return {
		name: 'LeisureSystem',
		priority: SystemPriority.LEISURE,

		execute(deps: GameCoreDeps): void {
			const locationList = locations();
			const locationActors = getLocationActors?.() ?? new Map<string, Actor>();

			for (const agent of agents()) {
				const ba = agent.behaviorAgent;
				const btAction = ba.btAction;

				if (btAction !== 'leisure') {
					// Emit LeisureComplete if agent was previously at leisure
					if (activeLeisure.has(agent.agentId)) {
						deps.eventBus.emit({
							type: 'LeisureComplete',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'LeisureSystem',
							payload: {
								agentId: agent.agentId,
								locationId: activeLeisure.get(agent.agentId),
							},
						});
						activeLeisure.delete(agent.agentId);
					}
					continue;
				}

				const targetId = ba.leisureTarget;
				if (targetId === null) continue;

				const loc = locationList.find(l => l.id === targetId);
				if (loc?.leisure === null || loc?.leisure === undefined) continue;
				const leisure = loc.leisure;

				// First tick at this leisure location — deduct gold, emit events
				const previousTarget = activeLeisure.get(agent.agentId);
				if (previousTarget !== targetId) {
					activeLeisure.set(agent.agentId, targetId);

					// Deduct cost from agent wallet
					if (leisure.cost > 0) {
						const wallet = agent.get(WalletComponent);
						wallet.state = { ...wallet.state, gold: wallet.state.gold - leisure.cost };
						wallet.markDirty();

						// Credit facility fund
						const locActor = locationActors.get(targetId);
						if (locActor?.has(FacilityComponent) === true) {
							const facility = locActor.get(FacilityComponent);
							facility.state = { ...facility.state, fund: facility.state.fund + leisure.cost };
							facility.markDirty();
						}

						// Append LedgerEntry to EconomyComponent (matches RestSystem pattern)
						const world = worldEntity();
						const economy = world.get(EconomyComponent);
						economy.state = {
							...economy.state,
							ledger: [
								...economy.state.ledger,
								{
									tick: deps.tickCount,
									type: 'purchase' as const,
									from: agent.agentId,
									to: targetId,
									itemId: null,
									quantity: 0,
									gold: leisure.cost,
								},
							],
						};
						economy.markDirty();

						// Emit GoldFlowed for monetary policy
						deps.eventBus.emit({
							type: 'GoldFlowed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'LeisureSystem',
							payload: {
								category: 'transfer' as const,
								subcategory: 'leisure',
								amount: leisure.cost,
								fromEntity: agent.agentId,
								toEntity: targetId,
							},
						});
					}

					// Skill XP on first tick only
					if (leisure.effects.skill_xp > 0) {
						const skills = ba.skills;
						const existing = skills.find(s => s.id === 'study');
						if (existing !== undefined) {
							existing.points += leisure.effects.skill_xp;
						} else {
							skills.push({ id: 'study', points: leisure.effects.skill_xp, use_count: 0, use_bonus: 0 });
						}
					}

					deps.eventBus.emit({
						type: 'LeisureStarted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'LeisureSystem',
						payload: {
							agentId: agent.agentId,
							locationId: targetId,
							locationName: loc.name,
							cost: leisure.cost,
						},
					});
				}

				// Per-tick effects (gradual application)
				const ticksPerVisit = leisure.ticks_per_visit;

				if (leisure.effects.social > 0) {
					const needs = agent.get(NeedsComponent);
					const socialGain = leisure.effects.social / ticksPerVisit;
					needs.state = { ...needs.state, social: Math.min(100, needs.state.social + socialGain) };
					needs.markDirty();
				}

				if (leisure.effects.energy > 0) {
					const needs = agent.get(NeedsComponent);
					const energyGain = leisure.effects.energy / ticksPerVisit;
					needs.state = { ...needs.state, energy: Math.min(100, needs.state.energy + energyGain) };
					needs.markDirty();
				}

				// Mood effect: create a positive memory on first tick (uses existing memory→mood pipeline)
				if (leisure.effects.mood > 0 && previousTarget !== targetId) {
					const memComp = agent.get(MemoryComponent);
					memComp.state = {
						...memComp.state,
						entries: [
							...memComp.state.entries,
							{
								tick: deps.tickCount,
								event: `leisure_${loc.id}`,
								outcome: 'positive' as const,
								significance: Math.ceil(leisure.effects.mood / 2),
								relatedAgent: null,
							},
						],
					};
					memComp.markDirty();
				}
			}
		},
	};
}
```

- [ ] **Step 3: Write tests**

Create `tests/infrastructure/systems/leisure-system.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createLeisureSystem } from '../../../src/infrastructure/systems/leisure-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import { Actor } from 'excalibur';

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

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 50, social: 40, thirst: 80 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 250, y: 280, region: 'test' }, relationships: '',
		tools: [], color: '#b0b0b0', behavior_tree: 'bt/test.md', job: null, property: [],
		...overrides,
	};
}

const tavernLocation: WorldLocation = {
	id: 'loc-tavern', name: 'Tavern', type: 'leisure',
	position: { x: 250, y: 280, region: 'market-square' },
	capacity: 10, color: '#808080', production: null, region: null,
	leisure: { cost: 3, effects: { social: 15, mood: 5, energy: 0, skill_xp: 0 }, attribute_bonus: null, ticks_per_visit: 20 },
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 100,
		writeFile: null,
	};
}

function mockBehaviorAgent(overrides: Record<string, unknown> = {}) {
	return {
		btAction: 'leisure',
		leisureTarget: 'loc-tavern',
		skills: [],
		...overrides,
	};
}

describe('LeisureSystem', () => {
	it('deducts gold from agent on first tick at leisure location', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		(agent as unknown as Record<string, unknown>).behaviorAgent = mockBehaviorAgent();

		const locActor = new Actor();
		locActor.addComponent(new FacilityComponent({ stock: [], fund: 0, workProgress: 0, status: 'idle', workerId: null }));

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
			() => new Map([['loc-tavern', locActor]]),
		);
		system.execute(createDeps());

		expect(agent.get(WalletComponent).state.gold).toBe(47); // 50 - 3
		expect(locActor.get(FacilityComponent).state.fund).toBe(3);
	});

	it('applies per-tick social recovery', () => {
		const agent = new AgentActor(createTestAgent({ needs: { hunger: 80, energy: 50, social: 40, thirst: 80 } }), defaultMoodConfig);
		(agent as unknown as Record<string, unknown>).behaviorAgent = mockBehaviorAgent();

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
		);
		system.execute(createDeps());

		const social = agent.get(NeedsComponent).state.social;
		expect(social).toBeGreaterThan(40); // 40 + 15/20 = 40.75
	});

	it('creates positive memory for mood effect', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		(agent as unknown as Record<string, unknown>).behaviorAgent = mockBehaviorAgent();

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
		);
		system.execute(createDeps());

		const entries = agent.get(MemoryComponent).state.entries;
		const leisureMemory = entries.find(e => e.event === 'leisure_loc-tavern');
		expect(leisureMemory).toBeDefined();
		expect(leisureMemory?.outcome).toBe('positive');
	});

	it('emits GoldFlowed and LeisureStarted events', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GoldFlowed', e => events.push(e));
		eventBus.on('LeisureStarted', e => events.push(e));

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		(agent as unknown as Record<string, unknown>).behaviorAgent = mockBehaviorAgent();

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
		);
		system.execute(createDeps(eventBus));

		expect(events.some(e => e.type === 'GoldFlowed')).toBe(true);
		expect(events.some(e => e.type === 'LeisureStarted')).toBe(true);
	});

	it('does not deduct gold on subsequent ticks (only first tick)', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		(agent as unknown as Record<string, unknown>).behaviorAgent = mockBehaviorAgent();

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
		);
		const deps = createDeps();
		system.execute(deps); // first tick: -3g
		system.execute(deps); // second tick: no deduction

		expect(agent.get(WalletComponent).state.gold).toBe(47); // still 47, not 44
	});

	it('emits LeisureComplete when agent stops leisure', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('LeisureComplete', e => events.push(e));

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const ba = mockBehaviorAgent();
		(agent as unknown as Record<string, unknown>).behaviorAgent = ba;

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
		);
		const deps = createDeps(eventBus);
		system.execute(deps); // start leisure
		ba.btAction = 'wander'; // agent stops
		system.execute(deps);

		expect(events.length).toBe(1);
		expect(events[0]?.type).toBe('LeisureComplete');
	});

	it('skips agents not doing leisure', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		(agent as unknown as Record<string, unknown>).behaviorAgent = mockBehaviorAgent({ btAction: 'work' });

		const system = createLeisureSystem(
			() => [agent],
			() => [tavernLocation],
			() => new Actor(),
		);
		system.execute(createDeps());

		expect(agent.get(WalletComponent).state.gold).toBe(50); // unchanged
	});
});
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/leisure-system.test.ts --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts" "01 - Projects/Project Meridian/src/infrastructure/systems/leisure-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/leisure-system.test.ts"
git commit -m "feat(meridian): create LeisureSystem — gold flow, social/energy recovery, positive memories"
```

---

### Task 9: Add P2.5 leisure branch to base.mdsl

**Files:**
- Modify: `behavior-trees/base.mdsl:70-77`

- [ ] **Step 1: Insert P2.5 branch**

In `behavior-trees/base.mdsl`, after the P2 block (after line 76, `}`), add:

```
        /* P2.5: Leisure — rest day or stressed */
        sequence {
            selector {
                condition [IsRestDay]
                condition [IsMoodLow]
            }
            condition [IsWorkHours]
            action [ChooseLeisure]
            action [SeekLeisureTarget]
            action [Leisure] while(IsAtLeisure)
        }
```

Note: `IsWorkHours` guard ensures agents don't seek leisure at night (they sleep instead). On rest days, `IsWorkHours` returns false for work (P2) but the leisure branch explicitly checks it — wait, that's contradictory. On rest days, `IsWorkHours` returns false, so the leisure branch would also fail.

**CORRECTION**: The leisure branch should NOT use `IsWorkHours`. It should use `IsDaytime` or a dedicated `IsLeisureHours` check. On rest days, `IsWorkHours` returns false (which is correct for blocking work), but leisure should still be allowed during daytime hours. Use `IsDaytime` instead:

```
        /* P2.5: Leisure — rest day or stressed */
        sequence {
            selector {
                condition [IsRestDay]
                condition [IsMoodLow]
            }
            condition [IsDaytime]
            action [ChooseLeisure]
            action [SeekLeisureTarget]
            action [Leisure] while(IsAtLeisure)
        }
```

`IsDaytime` already exists in `bt-conditions.ts` (line 170) — returns true when phase is `'day'`. This is slightly more restrictive than `IsWorkHours` (no dawn), but leisure during daytime only is reasonable.

- [ ] **Step 2: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): add P2.5 leisure BT branch — rest days and stress-driven breaks"
```

---

### Task 10: Register LeisureSystem in game-view.ts and add FacilityComponent to leisure locations

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Add FacilityComponent to leisure-type locations**

In `game-view.ts`, find the block that adds `FacilityComponent` to rest and market locations (around lines 168-188). After the market block, add:

```typescript
// Add FacilityComponent to leisure-type locations (receive gold from agent visits)
if (loc.type === 'leisure' && loc.production === null) {
	marker.addComponent(new FacilityComponent({
		stock: [],
		fund: 0,
		workProgress: 0,
		status: 'idle',
		workerId: null,
	}));
}
```

- [ ] **Step 2: Import and register LeisureSystem**

Find where other systems are registered (search for `createRestSystem` or `createFeedSystem`). Add the import at the top of the file:

```typescript
import { createLeisureSystem } from '../systems/leisure-system.js';
```

Then register it alongside the other systems:

```typescript
tickRunner.register(createLeisureSystem(getAgents, getLocations, getWorldEntity, getLocationActors));
```

- [ ] **Step 3: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Run typecheck + lint**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs 2>&1 | grep "error"`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): register LeisureSystem + FacilityComponent on leisure locations"
```

---

### Task 11: Full verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npm test`
Expected: lint (0 errors) + typecheck (0 errors) + all tests pass.

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Project Meridian" && npm run build`
Expected: clean build.
