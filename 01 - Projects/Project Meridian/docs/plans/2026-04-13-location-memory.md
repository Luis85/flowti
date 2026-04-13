# Location Memory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent `knownLocations` string array with a significance-based location memory system where agents discover locations through perception, arrival, and gossip — each with independent decay rates.

**Architecture:** New `locationMemories: LocationMemoryEntry[]` on WorkingMemory. `knownLocations` becomes a derived getter. Three existing systems gain write logic (PerceptionSystem, MovementSystem, GossipSystem). A new `LocationMemoryDecaySystem` handles decay. Domain-pure decay function follows the existing `applyMemoryDecay` pattern.

**Tech Stack:** TypeScript, ExcaliburJS ECS, Vitest

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-13-location-memory-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Data Structure + Decay Domain Function

### Task 1: Add LocationMemoryEntry to WorkingMemory

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-working-memory.ts`
- Modify: `01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts`

- [ ] **Step 1: Add LocationMemoryEntry interface to bt-working-memory.ts**

After the `AreaModifier` interface (line 39), add:

```typescript
export interface LocationMemoryEntry {
	locationId: string;
	facilityType: string;
	position: { x: number; y: number };
	significance: number;
	originalSignificance: number;
	source: 'visited' | 'perceived' | 'gossip';
	reliability: number;
	discoveredTick: number;
	lastRefreshedTick: number;
}
```

- [ ] **Step 2: Add locationMemories to WorkingMemory interface**

In the `WorkingMemory` interface (line 41), replace:
```typescript
	knownLocations: string[];
```
With:
```typescript
	locationMemories: LocationMemoryEntry[];
```

- [ ] **Step 3: Update createWorkingMemory initializer**

In `createWorkingMemory` (line 76), replace:
```typescript
		knownLocations: [],
```
With:
```typescript
		locationMemories: [],
```

- [ ] **Step 4: Update BehaviorAgent interface**

In `src/domain/systems/behavior-agent.ts`, replace:
```typescript
	knownLocations: string[];
```
With:
```typescript
	readonly knownLocations: string[];
	locationMemories: LocationMemoryEntry[];
```

Add the import at the top of the file:
```typescript
import type { LocationMemoryEntry } from '../../infrastructure/entity/bt-working-memory.js';
```

- [ ] **Step 5: Update behavior-agent-factory.ts**

In `behavior-agent-factory.ts`, replace the `knownLocations` getter/setter pair (lines 228-229):
```typescript
		get knownLocations() { return memory.knownLocations; },
		set knownLocations(v) { memory.knownLocations = v; },
```
With:
```typescript
		get knownLocations() {
			const threshold = deps.config.location_memory?.usable_threshold ?? 5;
			return memory.locationMemories
				.filter(m => m.significance >= threshold)
				.map(m => m.locationId);
		},
		get locationMemories() { return memory.locationMemories; },
		set locationMemories(v) { memory.locationMemories = v; },
```

Add `import type { LocationMemoryEntry } from './bt-working-memory.js';` if not already imported (it is via WorkingMemory but the type should be available).

- [ ] **Step 6: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: errors from `movement-system.ts:246` (writes to removed `knownLocations` setter) and possibly other consumers. Note the errors — they confirm the migration path.

- [ ] **Step 7: Fix movement-system.ts**

In `movement-system.ts`, replace lines 245-248:
```typescript
						// Track known locations for gossip
						if (!ba.knownLocations.includes(rawTarget.id)) {
							ba.knownLocations = [...ba.knownLocations, rawTarget.id];
						}
```
With:
```typescript
						// Track known locations — add or refresh visited entry
						const existing = ba.locationMemories.find(m => m.locationId === rawTarget.id);
						if (existing !== undefined) {
							existing.source = 'visited';
							existing.significance = deps.config.location_memory?.visited.significance ?? 50;
							existing.originalSignificance = existing.significance;
							existing.lastRefreshedTick = deps.tickCount;
						} else {
							const locData = locations().find(l => l.id === rawTarget.id);
							const sig = deps.config.location_memory?.visited.significance ?? 50;
							ba.locationMemories = [...ba.locationMemories, {
								locationId: rawTarget.id,
								facilityType: locData?.facility_type ?? '',
								position: locData !== undefined ? { x: locData.position.x, y: locData.position.y } : { x: 0, y: 0 },
								significance: sig,
								originalSignificance: sig,
								source: 'visited' as const,
								reliability: 1.0,
								discoveredTick: deps.tickCount,
								lastRefreshedTick: deps.tickCount,
							}];
						}
```

Note: `locations()` is the location list getter already available in the movement system's closure. Check the system factory's parameters to confirm.

- [ ] **Step 8: Run typecheck again**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: may still have errors if other files write to `knownLocations`. Fix any remaining setter references.

- [ ] **Step 9: Add location_memory config to game-config-schema.ts**

In `src/domain/schemas/game-config-schema.ts`, add a new schema after `PerceptionConfigSchema` (around line 170):

```typescript
const LocationMemoryConfigSchema = z.object({
	usable_threshold: z.number().default(5),
	decay_per_tick: z.number().default(0.025),
	visited: z.object({
		significance: z.number().default(50),
		min_lifespan_ticks: z.number().default(960),
	}).default({ significance: 50, min_lifespan_ticks: 960 }),
	perceived: z.object({
		significance: z.number().default(25),
		min_lifespan_ticks: z.number().default(480),
	}).default({ significance: 25, min_lifespan_ticks: 480 }),
	gossip: z.object({
		significance_multiplier: z.number().default(20),
		min_lifespan_ticks: z.number().default(480),
	}).default({ significance_multiplier: 20, min_lifespan_ticks: 480 }),
});
```

Then add it to the `GameConfigSchema` object (around line 322, after `perception`):

```typescript
	location_memory: withDefaults(LocationMemoryConfigSchema),
```

- [ ] **Step 10: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-working-memory.ts" "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts" "01 - Projects/Project Meridian/src/infrastructure/systems/movement-system.ts" "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git commit -m "feat(meridian): add LocationMemoryEntry to WorkingMemory, derive knownLocations"
```

---

### Task 2: Location memory decay domain function + system

**Files:**
- Create: `01 - Projects/Project Meridian/src/domain/systems/location-memory-decay.ts`
- Create: `01 - Projects/Project Meridian/tests/domain/systems/location-memory-decay.test.ts`
- Create: `01 - Projects/Project Meridian/src/infrastructure/systems/location-memory-decay-system.ts`
- Create: `01 - Projects/Project Meridian/tests/infrastructure/systems/location-memory-decay-system.test.ts`

- [ ] **Step 1: Write failing tests for domain function**

Create `tests/domain/systems/location-memory-decay.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyLocationMemoryDecay } from '../../../src/domain/systems/location-memory-decay.js';
import type { LocationMemoryEntry } from '../../../src/infrastructure/entity/bt-working-memory.js';

function makeEntry(overrides: Partial<LocationMemoryEntry> = {}): LocationMemoryEntry {
	return {
		locationId: 'loc-test',
		facilityType: 'rest_inn',
		position: { x: 100, y: 200 },
		significance: 50,
		originalSignificance: 50,
		source: 'visited',
		reliability: 1.0,
		discoveredTick: 0,
		lastRefreshedTick: 0,
		...overrides,
	};
}

const defaultConfig = {
	usable_threshold: 5,
	decay_per_tick: 0.025,
	visited: { significance: 50, min_lifespan_ticks: 960 },
	perceived: { significance: 25, min_lifespan_ticks: 480 },
	gossip: { significance_multiplier: 20, min_lifespan_ticks: 480 },
};

describe('applyLocationMemoryDecay', () => {
	it('does not decay entries within min_lifespan', () => {
		const entry = makeEntry({ lastRefreshedTick: 100 });
		const result = applyLocationMemoryDecay([entry], 500, defaultConfig);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.significance).toBe(50);
	});

	it('decays entries past min_lifespan at configured rate', () => {
		const entry = makeEntry({ lastRefreshedTick: 0 });
		const result = applyLocationMemoryDecay([entry], 961, defaultConfig);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.significance).toBeLessThan(50);
		expect(result.entries[0]!.significance).toBeCloseTo(50 - 0.025, 5);
	});

	it('prunes entries below usable_threshold', () => {
		const entry = makeEntry({ significance: 5.01, lastRefreshedTick: 0 });
		const result = applyLocationMemoryDecay([entry], 961, defaultConfig);
		expect(result.entries).toHaveLength(0);
		expect(result.prunedCount).toBe(1);
	});

	it('uses source-specific min_lifespan for perceived', () => {
		const entry = makeEntry({ source: 'perceived', significance: 25, originalSignificance: 25, lastRefreshedTick: 0 });
		// At tick 480, still within perceived min_lifespan (480)
		const noDecay = applyLocationMemoryDecay([entry], 480, defaultConfig);
		expect(noDecay.entries[0]!.significance).toBe(25);
		// At tick 481, past min_lifespan — decay should apply
		const decayed = applyLocationMemoryDecay([entry], 481, defaultConfig);
		expect(decayed.entries[0]!.significance).toBeLessThan(25);
	});

	it('uses source-specific min_lifespan for gossip', () => {
		const entry = makeEntry({ source: 'gossip', significance: 15, originalSignificance: 15, reliability: 0.75, lastRefreshedTick: 0 });
		const noDecay = applyLocationMemoryDecay([entry], 480, defaultConfig);
		expect(noDecay.entries[0]!.significance).toBe(15);
		const decayed = applyLocationMemoryDecay([entry], 481, defaultConfig);
		expect(decayed.entries[0]!.significance).toBeLessThan(15);
	});

	it('returns empty array for empty input', () => {
		const result = applyLocationMemoryDecay([], 100, defaultConfig);
		expect(result.entries).toHaveLength(0);
		expect(result.decayedCount).toBe(0);
		expect(result.prunedCount).toBe(0);
	});

	it('visited entry survives ~5.75 days (2760 ticks)', () => {
		let entry = makeEntry({ lastRefreshedTick: 0 });
		// Simulate 2760 ticks of decay
		for (let tick = 1; tick <= 2760; tick++) {
			const result = applyLocationMemoryDecay([entry], tick, defaultConfig);
			if (result.entries.length === 0) {
				// Entry pruned before expected — fail
				expect(tick).toBeGreaterThan(2700);
				return;
			}
			entry = result.entries[0]!;
		}
		// Should be very close to threshold by now
		expect(entry.significance).toBeLessThan(10);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/location-memory-decay.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement domain function**

Create `src/domain/systems/location-memory-decay.ts`:

```typescript
import type { LocationMemoryEntry } from '../../infrastructure/entity/bt-working-memory.js';

export interface LocationMemoryConfig {
	usable_threshold: number;
	decay_per_tick: number;
	visited: { significance: number; min_lifespan_ticks: number };
	perceived: { significance: number; min_lifespan_ticks: number };
	gossip: { significance_multiplier: number; min_lifespan_ticks: number };
}

export interface LocationMemoryDecayResult {
	entries: LocationMemoryEntry[];
	decayedCount: number;
	prunedCount: number;
}

function getMinLifespan(source: LocationMemoryEntry['source'], config: LocationMemoryConfig): number {
	switch (source) {
		case 'visited': return config.visited.min_lifespan_ticks;
		case 'perceived': return config.perceived.min_lifespan_ticks;
		case 'gossip': return config.gossip.min_lifespan_ticks;
	}
}

export function applyLocationMemoryDecay(
	entries: LocationMemoryEntry[],
	currentTick: number,
	config: LocationMemoryConfig,
): LocationMemoryDecayResult {
	if (entries.length === 0) {
		return { entries: [], decayedCount: 0, prunedCount: 0 };
	}

	let decayedCount = 0;
	let prunedCount = 0;
	const result: LocationMemoryEntry[] = [];

	for (const entry of entries) {
		const minLifespan = getMinLifespan(entry.source, config);
		const age = currentTick - entry.lastRefreshedTick;

		if (age <= minLifespan) {
			result.push(entry);
			continue;
		}

		const newSignificance = entry.significance - config.decay_per_tick;
		if (newSignificance < config.usable_threshold) {
			prunedCount++;
			continue;
		}

		result.push({ ...entry, significance: newSignificance });
		decayedCount++;
	}

	return { entries: result, decayedCount, prunedCount };
}
```

- [ ] **Step 4: Run domain tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/location-memory-decay.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for infrastructure system**

Create `tests/infrastructure/systems/location-memory-decay-system.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createLocationMemoryDecaySystem } from '../../../src/infrastructure/systems/location-memory-decay-system.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import type { LocationMemoryEntry } from '../../../src/infrastructure/entity/bt-working-memory.js';

function createDeps(tickCount = 1000): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

function makeEntry(overrides: Partial<LocationMemoryEntry> = {}): LocationMemoryEntry {
	return {
		locationId: 'loc-test',
		facilityType: 'rest_inn',
		position: { x: 100, y: 200 },
		significance: 50,
		originalSignificance: 50,
		source: 'visited',
		reliability: 1.0,
		discoveredTick: 0,
		lastRefreshedTick: 0,
		...overrides,
	};
}

function createMockAgent(locationMemories: LocationMemoryEntry[] = []): AgentActor {
	return {
		agentId: 'agent-test',
		behaviorAgent: { locationMemories },
	} as unknown as AgentActor;
}

describe('LocationMemoryDecaySystem', () => {
	it('decays location memories past min_lifespan', () => {
		const entry = makeEntry({ lastRefreshedTick: 0 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961); // past visited min_lifespan of 960

		system.execute(deps);

		expect(agent.behaviorAgent.locationMemories[0]!.significance).toBeLessThan(50);
	});

	it('prunes entries below threshold', () => {
		const entry = makeEntry({ significance: 5.01, lastRefreshedTick: 0 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961);

		system.execute(deps);

		expect(agent.behaviorAgent.locationMemories).toHaveLength(0);
	});

	it('emits LocationMemoryDecayed event when entries change', () => {
		const entry = makeEntry({ lastRefreshedTick: 0 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961);
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');

		system.execute(deps);

		const events = emitSpy.mock.calls.filter(c => c[0].type === 'LocationMemoryDecayed');
		expect(events).toHaveLength(1);
	});

	it('does nothing when no entries need decay', () => {
		const entry = makeEntry({ lastRefreshedTick: 900 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961); // 961 - 900 = 61, well within 960 min_lifespan
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');

		system.execute(deps);

		expect(agent.behaviorAgent.locationMemories[0]!.significance).toBe(50);
		const events = emitSpy.mock.calls.filter(c => c[0].type === 'LocationMemoryDecayed');
		expect(events).toHaveLength(0);
	});
});
```

- [ ] **Step 6: Implement infrastructure system**

Create `src/infrastructure/systems/location-memory-decay-system.ts`:

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyLocationMemoryDecay } from '../../domain/systems/location-memory-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createLocationMemoryDecaySystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'LocationMemoryDecaySystem',
		priority: SystemPriority.PERCEPTION + 0.5,

		execute(deps: GameCoreDeps): void {
			for (const agent of agents()) {
				const ba = agent.behaviorAgent;
				const result = applyLocationMemoryDecay(
					ba.locationMemories,
					deps.tickCount,
					deps.config.location_memory,
				);

				if (result.decayedCount > 0 || result.prunedCount > 0) {
					ba.locationMemories = result.entries;

					deps.eventBus.emit({
						type: 'LocationMemoryDecayed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'LocationMemoryDecaySystem',
						payload: {
							agentId: agent.agentId,
							decayedCount: result.decayedCount,
							prunedCount: result.prunedCount,
							remaining: result.entries.length,
						},
					});
				}
			}
		},
	};
}
```

- [ ] **Step 7: Run infrastructure tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/location-memory-decay-system.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 8: Add PERCEPTION_MEMORY priority to tick-scheduler.ts**

In `src/domain/core/tick-scheduler.ts`, add after `PERCEPTION: 3`:
```typescript
	LOCATION_MEMORY_DECAY: 3.5,
```

Then update the system to use this constant instead of `PERCEPTION + 0.5`.

- [ ] **Step 9: Run full typecheck + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean typecheck, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/location-memory-decay.ts" "01 - Projects/Project Meridian/tests/domain/systems/location-memory-decay.test.ts" "01 - Projects/Project Meridian/src/infrastructure/systems/location-memory-decay-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/location-memory-decay-system.test.ts" "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts"
git commit -m "feat(meridian): add location memory decay domain function + system"
```

---

## Chunk 2: Writers — Perception + Gossip

### Task 3: PerceptionSystem writes to locationMemories

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/perception-system.ts`
- Test: `01 - Projects/Project Meridian/tests/infrastructure/systems/perception-system.test.ts` (create if not exists, or add to existing)

- [ ] **Step 1: Write failing test**

Check if `tests/infrastructure/systems/perception-system.test.ts` exists. If not, create it. Add a test:

```typescript
it('adds perceived locations to agent locationMemories', () => {
	// Setup: agent at (100, 100), location at (120, 110) within perception radius
	// After execute, agent.behaviorAgent.locationMemories should contain the location
	// with source='perceived' and significance=25
});
```

The test should:
1. Create a mock agent with position, IQ, empty `locationMemories`, and a `behaviorAgent` with `locationMemories` getter/setter
2. Create a location within perception range
3. Run the system
4. Assert a `perceived` entry was created

- [ ] **Step 2: Implement perception write**

In `perception-system.ts`, after `perception.markDirty();` (line 85), add the location memory write block. Access `agent.behaviorAgent` (available since `agent` is an `AgentActor`):

```typescript
				// Update location memories from perception
				const locMemConfig = deps.config.location_memory;
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- behaviorAgent may be unset before init
				if (agent.behaviorAgent !== undefined) {
					const ba = agent.behaviorAgent;
					for (const nearLoc of result.nearbyLocations) {
						if (nearLoc.facility_type === '') continue;
						const existing = ba.locationMemories.find(m => m.locationId === nearLoc.id);
						if (existing !== undefined) {
							existing.lastRefreshedTick = deps.tickCount;
						} else {
							const locData = locationList.find(l => l.id === nearLoc.id);
							ba.locationMemories = [...ba.locationMemories, {
								locationId: nearLoc.id,
								facilityType: nearLoc.facility_type,
								position: locData !== undefined
									? { x: locData.position.x, y: locData.position.y }
									: { x: 0, y: 0 },
								significance: locMemConfig.perceived.significance,
								originalSignificance: locMemConfig.perceived.significance,
								source: 'perceived' as const,
								reliability: 1.0,
								discoveredTick: deps.tickCount,
								lastRefreshedTick: deps.tickCount,
							}];
						}
					}
				}
```

Note: `locationList` is already computed at line 22 of the system.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/perception-system.ts"
git commit -m "feat(meridian): PerceptionSystem writes perceived locations to locationMemories"
```

---

### Task 4: GossipSystem writes to locationMemories

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/gossip-system.ts`

- [ ] **Step 1: Implement gossip write**

In `gossip-system.ts`, after the existing gossip memory write blocks (after line 200 for A→B, and after the equivalent B→A block), add location memory writes.

For the A→B direction, after `partnerMem.markDirty();` add:

```typescript
					// Write location gossip to partner's locationMemories
					for (const item of aToBResult.transferred) {
						const meta = item.memory.metadata;
						if (meta?.['gossipType'] !== 'location') continue;
						const locId = meta['locationId'] as string;
						const existingLocMem = partnerBa.locationMemories.find(m => m.locationId === locId);
						if (existingLocMem !== undefined) {
							// Don't overwrite first-hand knowledge; refresh gossip if higher reliability
							if (existingLocMem.source !== 'gossip') continue;
							const newReliability = meta['reliability'] as number;
							if (newReliability > existingLocMem.reliability) {
								existingLocMem.reliability = newReliability;
								existingLocMem.significance = gossipConfig.significance_multiplier * newReliability;
								existingLocMem.originalSignificance = existingLocMem.significance;
								existingLocMem.lastRefreshedTick = deps.tickCount;
							}
							continue;
						}
						const pos = meta['position'] as { x: number; y: number };
						const reliability = meta['reliability'] as number;
						const sig = (deps.config.location_memory?.gossip.significance_multiplier ?? 20) * reliability;
						if (sig < (deps.config.location_memory?.usable_threshold ?? 5)) continue;
						partnerBa.locationMemories = [...partnerBa.locationMemories, {
							locationId: locId,
							facilityType: (meta['locationType'] as string) ?? '',
							position: { x: pos.x, y: pos.y },
							significance: sig,
							originalSignificance: sig,
							source: 'gossip' as const,
							reliability,
							discoveredTick: deps.tickCount,
							lastRefreshedTick: deps.tickCount,
						}];
					}
```

Add the mirror logic for B→A direction using `bToAResult.transferred` writing to `ba.locationMemories`.

- [ ] **Step 2: Read `gossipConfig.significance_multiplier` from config**

At the top of the gossip exchange block, where `gossipConfig` is read from `deps.config.gossip`, ensure `deps.config.location_memory` is also accessible. It is — it's on `GameConfig` via the schema.

- [ ] **Step 3: Run typecheck + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/gossip-system.ts"
git commit -m "feat(meridian): GossipSystem writes location gossip to locationMemories"
```

---

## Chunk 3: Consumer Updates + Wiring

### Task 5: Update SeekKnownRestLocation with source-tier preference

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts`

- [ ] **Step 1: Update SeekKnownRestLocation to iterate locationMemories**

Replace the current `SeekKnownRestLocation` action (around line 245-273) to iterate `memory.locationMemories` instead of `memory.knownLocations`, adding source-tier sorting:

```typescript
		SeekKnownRestLocation(): ActionResult {
			const registry = deps.getFacilityTypeRegistry?.();
			if (registry === undefined) return FAILED;
			const threshold = deps.config?.location_memory?.usable_threshold ?? 5;

			type RestCandidate = { id: string; distance: number; source: 'visited' | 'perceived' | 'gossip' };
			const sourcePriority = { visited: 0, perceived: 1, gossip: 2 };
			const candidates: RestCandidate[] = [];

			for (const locMem of memory.locationMemories) {
				if (locMem.significance < threshold) continue;
				const ft = registry.get(locMem.facilityType);
				if (ft?.kind !== 'service' || ft.staffed_effects.energy <= 0) continue;
				const dx = actor.pos.x - locMem.position.x;
				const dy = actor.pos.y - locMem.position.y;
				candidates.push({ id: locMem.locationId, distance: Math.sqrt(dx * dx + dy * dy), source: locMem.source });
			}
			if (candidates.length === 0) return FAILED;
			candidates.sort((a, b) => {
				const sp = sourcePriority[a.source] - sourcePriority[b.source];
				if (sp !== 0) return sp;
				return a.distance - b.distance;
			});

			const target = candidates[0]!;
			if (memory.atLocation === target.id) return SUCCEEDED;

			memory.movementTarget = { id: target.id, type: 'location' };
			memory.serviceTarget = target.id;
			beginAction(ctx, 'seek_service');
			return RUNNING;
		},
```

- [ ] **Step 2: Update KnowsRestLocation to use locationMemories**

In `bt-conditions-economy.ts`, update `KnowsRestLocation` to iterate `memory.locationMemories` instead of `memory.knownLocations`:

```typescript
		KnowsRestLocation(): boolean {
			const registry = deps.getFacilityTypeRegistry?.();
			if (registry === undefined) return false;
			const threshold = config.location_memory?.usable_threshold ?? 5;
			for (const locMem of memory.locationMemories) {
				if (locMem.significance < threshold) continue;
				const ft = registry.get(locMem.facilityType);
				if (ft?.kind === 'service' && ft.staffed_effects.energy > 0) return true;
			}
			return false;
		},
```

- [ ] **Step 3: Run typecheck + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-economy.ts"
git commit -m "feat(meridian): SeekKnownRestLocation prefers visited over gossip locations"
```

---

### Task 6: Register LocationMemoryDecaySystem in game-view.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Import and register the system**

In `game-view.ts`, add import:
```typescript
import { createLocationMemoryDecaySystem } from '../systems/location-memory-decay-system.js';
```

Find where systems are registered on the `tickRunner` (around line 330-345). Add after the existing system registrations:
```typescript
		tickRunner.register(createLocationMemoryDecaySystem(getAgents));
```

- [ ] **Step 2: Run typecheck + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 3: Build**

Run: `cd "01 - Projects/Project Meridian" && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): register LocationMemoryDecaySystem in game-view"
```

---

### Task 7: Remove diagnostic DebugNote from ChooseServiceFacility

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts`

- [ ] **Step 1: Remove the diagnostic events**

The diagnostic DebugNote events added during debugging (the `registry undefined` and `no candidates` emitters in `ChooseServiceFacility`) should be removed now that the root cause is fixed. Revert `ChooseServiceFacility` to its pre-diagnostic state but keep the new `SeekKnownRestLocation` action.

- [ ] **Step 2: Run typecheck + build**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts"
git commit -m "chore(meridian): remove diagnostic DebugNote from ChooseServiceFacility"
```
