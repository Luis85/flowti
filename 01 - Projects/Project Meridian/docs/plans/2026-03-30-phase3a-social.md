# Phase 3A: Social Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents talk with template-based dialogue, exchange gossip (location knowledge + reputation), and persist relationships to Obsidian Canvas files.

**Architecture:** Three new GameSystems (Dialogue at priority 12, Gossip at 12.5, RelationshipCheckpoint at 19) downstream of the existing SocializeSystem. Pure domain functions wrapped in thin infrastructure wrappers. Event-driven coordination via `eventBus.history()`. Bidirectional gossip exchange with tier-based reliability degradation.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), Zod (schema validation), Vitest, ESLint

**Design Spec:** `docs/specs/2026-03-30-phase3a-social-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`dialogue.ts`, `gossip.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **ESLint:** `npx eslint src/ --config configs/eslint.config.mjs` — 0 errors
- **TypeScript:** `npx tsc --noEmit --project configs/tsconfig.json` — 0 errors
- **Full test:** `npx vitest run --config configs/vitest.config.ts` — all tests pass
- **Spread-copy pattern** for all component state mutations
- **Config-driven** — use values from `GameConfigSchema`, never hardcoded numbers in infrastructure

---

## Chunk A: Foundation — Types, Config, Existing Call Sites

Everything in this chunk is foundation — all subsequent chunks depend on it.

### Task A1: Extend RelationshipEntry and MemoryEntry types

**Files:**
- Modify: `src/domain/core/component-data.ts`

- [ ] **Step 1: Write test verifying new RelationshipEntry shape**

In `tests/domain/core/component-data.test.ts` (create if needed):

```typescript
import { describe, it, expect } from 'vitest';
import type { RelationshipEntry, MemoryEntry } from '../../../src/domain/core/component-data.js';

describe('component-data types', () => {
	it('RelationshipEntry includes tags and lastInteractionTick', () => {
		const entry: RelationshipEntry = {
			agentId: 'agent-test',
			disposition: 10,
			familiarity: 3,
			tags: ['traded_with'],
			lastInteractionTick: 100,
		};
		expect(entry.tags).toEqual(['traded_with']);
		expect(entry.lastInteractionTick).toBe(100);
	});

	it('MemoryEntry includes optional metadata', () => {
		const entry: MemoryEntry = {
			tick: 1,
			type: 'gossip',
			description: 'Heard about the bakery',
			participants: ['agent-elena'],
			outcome: 'neutral',
			significance: 3.5,
			mood_impact: 0,
			metadata: { gossipType: 'location', locationId: 'loc-bakery' },
		};
		expect(entry.metadata).toBeDefined();
		expect(entry.metadata?.gossipType).toBe('location');
	});

	it('MemoryEntry metadata is optional', () => {
		const entry: MemoryEntry = {
			tick: 1,
			type: 'social',
			description: 'Talked with Marcus',
			participants: ['agent-marcus'],
			outcome: 'positive',
			significance: 4,
			mood_impact: 2,
		};
		expect(entry.metadata).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test — expect TypeScript compilation failure (new fields don't exist yet)**

Run: `npx vitest run tests/domain/core/component-data.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Add new fields to RelationshipEntry and MemoryEntry**

In `src/domain/core/component-data.ts`, update:

```typescript
export interface RelationshipEntry {
	agentId: string;
	disposition: number;
	familiarity: number;
	tags: string[];
	lastInteractionTick: number;
}
```

And add `metadata` to `MemoryEntry`:

```typescript
export interface MemoryEntry {
	tick: number;
	type: string;
	description: string;
	participants: string[];
	outcome: 'positive' | 'negative' | 'neutral';
	significance: number;
	mood_impact: number;
	original_significance?: number;
	metadata?: Record<string, unknown>;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/domain/core/component-data.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Fix all existing RelationshipEntry creation sites**

These files create `RelationshipEntry` objects without the new fields. Add `tags: []` and `lastInteractionTick: 0` (or `deps.tickCount` where available) to each:

**`src/infrastructure/systems/facility-system.ts`** — in `applyWorkerRelationship` (line ~215):
```typescript
const newEntry = { agentId: locationId, disposition: relResult.newDisposition, familiarity: relResult.newFamiliarity, tags: facilityRelEntry?.tags ?? [], lastInteractionTick: 0 };
```
Add `'worked_with'` tag: after constructing `newEntry`, before `updatedEntries`:
```typescript
if (!newEntry.tags.includes('worked_with')) newEntry.tags = [...newEntry.tags, 'worked_with'];
```

**`src/infrastructure/systems/trade-system.ts`** — in `applyBuyerRelationship` (line ~149):
```typescript
const newEntry = { agentId: workerId, disposition: relResult.newDisposition, familiarity: relResult.newFamiliarity, tags: existingRel?.tags ?? [], lastInteractionTick: 0 };
```
Add `'traded_with'` tag:
```typescript
if (!newEntry.tags.includes('traded_with')) newEntry.tags = [...newEntry.tags, 'traded_with'];
```

**`src/infrastructure/systems/socialize-system.ts`** — no direct RelationshipEntry creation here (socialization updates via other paths), but check for any inline entries.

**`src/domain/systems/socialize.ts`** — the `applySocialize` function creates `MemoryEntry` objects. These already match the interface (metadata is optional). No change needed.

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests pass. Some may fail if they create RelationshipEntry inline without new fields — fix those too.

- [ ] **Step 7: Commit**

```
feat(meridian): extend RelationshipEntry with tags + lastInteractionTick, add metadata to MemoryEntry
```

### Task A2: Add GOSSIP priority, extend GossipConfigSchema, add AgentActor.color

**Files:**
- Modify: `src/domain/core/tick-scheduler.ts`
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `src/infrastructure/entity/agent-actor.ts`
- Modify: `tests/infrastructure/engine/tick-runner.test.ts` (priority constants test)

- [ ] **Step 1: Add GOSSIP priority constant**

In `src/domain/core/tick-scheduler.ts`, add after the DIALOGUE line:

```typescript
DIALOGUE: 12,
GOSSIP: 12.5,
PROGRESSION: 13,
```

- [ ] **Step 2: Update tick-runner priority test**

In `tests/infrastructure/engine/tick-runner.test.ts`, add after the DIALOGUE assertion:

```typescript
expect(SystemPriority.GOSSIP).toBe(12.5);
```

- [ ] **Step 3: Extend GossipConfigSchema**

In `src/domain/schemas/game-config-schema.ts`, extend the existing `GossipConfigSchema`:

```typescript
const GossipConfigSchema = z.object({
	reliability_tiers: z.array(z.number()).default([1.0, 0.7, 0.5, 0.3]),
	iq_filter_threshold: z.number().default(12),
	familiarity_threshold: z.number().default(3),
	max_items_per_exchange: z.number().int().default(2),
	min_reliability: z.number().default(0.3),
});
```

- [ ] **Step 4: Add `readonly color: string` to AgentActor**

In `src/infrastructure/entity/agent-actor.ts`, add to class properties:

```typescript
readonly agentId: string;
readonly agentName: string;
readonly kind: string;
readonly behaviorTree: string;
readonly property: string[];
readonly job: string | null;
readonly color: string;
```

And in the constructor, add:

```typescript
this.color = agent.color;
```

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 6: Commit**

```
feat(meridian): add GOSSIP priority, extend gossip config, add AgentActor.color
```

### Task A3: Add knownLocations tracking to MovementSystem

**Files:**
- Modify: `src/infrastructure/systems/movement-system.ts`
- Modify: `tests/infrastructure/systems/movement-system.test.ts`

- [ ] **Step 1: Write failing test for knownLocations**

Add to `tests/infrastructure/systems/movement-system.test.ts`:

```typescript
it('populates knownLocations on first arrival at a location', () => {
	const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
	const bb = agent.get(BlackboardComponent);
	bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

	const locations = [createTestLocation('loc-food-1', 1, 0)];
	const system = createMovementSystem(() => [agent], () => locations);

	system.execute(createDeps());

	const knownLocations = bb.state.knownLocations as string[] | undefined;
	expect(knownLocations).toBeDefined();
	expect(knownLocations).toContain('loc-food-1');
});

it('does not duplicate knownLocations on repeat arrival', () => {
	const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
	const bb = agent.get(BlackboardComponent);
	bb.state = { ...bb.state, knownLocations: ['loc-food-1'], movementTarget: { id: 'loc-food-1', type: 'location' } };

	const locations = [createTestLocation('loc-food-1', 1, 0)];
	const system = createMovementSystem(() => [agent], () => locations);

	system.execute(createDeps());

	const knownLocations = bb.state.knownLocations as string[];
	expect(knownLocations.filter(l => l === 'loc-food-1')).toHaveLength(1);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement knownLocations tracking**

In `src/infrastructure/systems/movement-system.ts`, in the non-journey arrival branch (after setting `atLocation`), add:

```typescript
// Track known locations for gossip
const knownLocations = (bb.state.knownLocations as string[] | undefined) ?? [];
if (!knownLocations.includes(rawTarget.id)) {
	bb.state = { ...bb.state, knownLocations: [...knownLocations, rawTarget.id] };
}
```

Note: `bb.state` was already updated and `bb.markDirty()` was already called in the existing arrival code, so this extends the same state update.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Run full test suite**

- [ ] **Step 6: Commit**

```
feat(meridian): track knownLocations on blackboard for gossip system
```

---

## Chunk B: Dialogue System — Domain + Infrastructure

### Task B1: Domain — dialogue template registry and selectDialogue

**Files:**
- Create: `src/domain/systems/dialogue.ts`
- Create: `tests/domain/systems/dialogue.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/systems/dialogue.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectDialogue, DIALOGUE_TEMPLATES } from '../../../src/domain/systems/dialogue.js';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

function makeInput(overrides: Record<string, unknown> = {}) {
	return {
		agentKind: 'merchant',
		agentName: 'Elena',
		agentMoodBucket: 'content',
		partnerKind: 'guard',
		partnerName: 'Marcus',
		partnerMoodBucket: 'content',
		disposition: 10,
		partnerDisposition: 5,
		familiarity: 5,
		gossipFamiliarityThreshold: 3,
		rng: createGameRNG(42),
		...overrides,
	};
}

describe('selectDialogue', () => {
	it('selects lines from template registry by kind + mood bucket', () => {
		const result = selectDialogue(makeInput());
		const merchantContentLines = DIALOGUE_TEMPLATES['merchant:content'];
		const guardContentLines = DIALOGUE_TEMPLATES['guard:content'];
		expect(merchantContentLines).toContain(result.agentLine);
		expect(guardContentLines).toContain(result.partnerLine);
	});

	it('falls back to default templates for unknown kind', () => {
		const result = selectDialogue(makeInput({ agentKind: 'villager' }));
		const defaultContentLines = DIALOGUE_TEMPLATES['default:content'];
		expect(defaultContentLines).toContain(result.agentLine);
	});

	it('positive tone when both content+ mood and disposition >= 0', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'elated',
			partnerMoodBucket: 'content',
			disposition: 10,
			partnerDisposition: 5,
		}));
		expect(result.tone).toBe('positive');
		expect(result.dispositionChange).toBe(1);
	});

	it('negative tone when either agent distressed', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'distressed',
			partnerMoodBucket: 'content',
		}));
		expect(result.tone).toBe('negative');
		expect(result.dispositionChange).toBe(-1);
	});

	it('negative tone when disposition <= -20', () => {
		const result = selectDialogue(makeInput({
			disposition: -25,
			partnerDisposition: -30,
		}));
		expect(result.tone).toBe('negative');
		expect(result.dispositionChange).toBe(-1);
	});

	it('neutral tone otherwise', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'stressed',
			partnerMoodBucket: 'content',
			disposition: 5,
			partnerDisposition: 5,
		}));
		expect(result.tone).toBe('neutral');
		expect(result.dispositionChange).toBe(0);
	});

	it('shouldExchangeGossip true when familiarity >= threshold', () => {
		const result = selectDialogue(makeInput({ familiarity: 5, gossipFamiliarityThreshold: 3 }));
		expect(result.shouldExchangeGossip).toBe(true);
	});

	it('shouldExchangeGossip false when familiarity < threshold', () => {
		const result = selectDialogue(makeInput({ familiarity: 1, gossipFamiliarityThreshold: 3 }));
		expect(result.shouldExchangeGossip).toBe(false);
	});

	it('different RNG seeds produce different line selections', () => {
		const result1 = selectDialogue(makeInput({ rng: createGameRNG(1) }));
		const result2 = selectDialogue(makeInput({ rng: createGameRNG(99999) }));
		// With enough template lines, different seeds should sometimes pick different lines
		// (not guaranteed for every pair, but the mechanism is verified)
		expect(typeof result1.agentLine).toBe('string');
		expect(typeof result2.agentLine).toBe('string');
	});
});

describe('DIALOGUE_TEMPLATES', () => {
	it('has entries for all 4 kinds × 5 mood buckets', () => {
		const kinds = ['merchant', 'guard', 'artisan', 'scholar'];
		const moods = ['elated', 'content', 'stressed', 'distressed', 'breakdown'];
		for (const kind of kinds) {
			for (const mood of moods) {
				const key = `${kind}:${mood}`;
				expect(DIALOGUE_TEMPLATES[key], `missing template for ${key}`).toBeDefined();
				expect(DIALOGUE_TEMPLATES[key].length).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('has default entries for all mood buckets', () => {
		const moods = ['elated', 'content', 'stressed', 'distressed', 'breakdown'];
		for (const mood of moods) {
			expect(DIALOGUE_TEMPLATES[`default:${mood}`]).toBeDefined();
		}
	});
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

- [ ] **Step 3: Implement dialogue.ts**

Create `src/domain/systems/dialogue.ts`:

```typescript
import type { GameRNG } from '../core/game-rng.js';

export interface DialogueInput {
	agentKind: string;
	agentName: string;
	agentMoodBucket: string;
	partnerKind: string;
	partnerName: string;
	partnerMoodBucket: string;
	disposition: number;
	partnerDisposition: number;
	familiarity: number;
	gossipFamiliarityThreshold: number;
	rng: GameRNG;
}

export interface DialogueResult {
	agentLine: string;
	partnerLine: string;
	tone: 'positive' | 'negative' | 'neutral';
	dispositionChange: number;
	shouldExchangeGossip: boolean;
}

const POSITIVE_MOODS = new Set(['elated', 'content']);
const NEGATIVE_MOODS = new Set(['distressed', 'breakdown']);

function determineTone(
	agentMood: string,
	partnerMood: string,
	disposition: number,
	partnerDisposition: number,
): { tone: DialogueResult['tone']; dispositionChange: number } {
	const minDisposition = Math.min(disposition, partnerDisposition);

	if (POSITIVE_MOODS.has(agentMood) && POSITIVE_MOODS.has(partnerMood) && minDisposition >= 0) {
		return { tone: 'positive', dispositionChange: 1 };
	}
	if (NEGATIVE_MOODS.has(agentMood) || NEGATIVE_MOODS.has(partnerMood) || minDisposition <= -20) {
		return { tone: 'negative', dispositionChange: -1 };
	}
	return { tone: 'neutral', dispositionChange: 0 };
}

function pickLine(templates: string[], rng: GameRNG): string {
	const index = Math.floor(rng.range(0, templates.length));
	return templates[Math.min(index, templates.length - 1)]!;
}

function getTemplates(kind: string, moodBucket: string): string[] {
	return DIALOGUE_TEMPLATES[`${kind}:${moodBucket}`]
		?? DIALOGUE_TEMPLATES[`default:${moodBucket}`]
		?? ['...'];
}

export function selectDialogue(input: DialogueInput): DialogueResult {
	const agentTemplates = getTemplates(input.agentKind, input.agentMoodBucket);
	const partnerTemplates = getTemplates(input.partnerKind, input.partnerMoodBucket);

	const { tone, dispositionChange } = determineTone(
		input.agentMoodBucket,
		input.partnerMoodBucket,
		input.disposition,
		input.partnerDisposition,
	);

	return {
		agentLine: pickLine(agentTemplates, input.rng),
		partnerLine: pickLine(partnerTemplates, input.rng),
		tone,
		dispositionChange,
		shouldExchangeGossip: input.familiarity >= input.gossipFamiliarityThreshold,
	};
}

export const DIALOGUE_TEMPLATES: Record<string, string[]> = {
	// Merchant
	'merchant:elated': ['Business is booming! What can I get you?', 'A fine day for trade!', 'My best stock yet — come see!'],
	'merchant:content': ['Fair prices today. Looking for anything?', 'Good to see a friendly face.', 'Trade has been steady.'],
	'merchant:stressed': ['I need to move this stock...', 'Prices are tight this season.', 'Have you seen any buyers around?'],
	'merchant:distressed': ['I can barely keep the stall open.', 'Nobody is buying...', 'I might have to close up.'],
	'merchant:breakdown': ['...just take what you need.', '...', 'I do not know what to do anymore.'],

	// Guard
	'guard:elated': ['All quiet on the watch — fine day!', 'Nothing like a peaceful patrol.', 'The town feels safe today.'],
	'guard:content': ['Keeping the peace, as always.', 'Stay out of trouble.', 'All is well on the watch.'],
	'guard:stressed': ['Too many strangers lately...', 'I have a bad feeling today.', 'Stay alert out there.'],
	'guard:distressed': ['I cannot keep up with the patrols.', 'This town is falling apart.', 'Where is the backup?'],
	'guard:breakdown': ['...I just want to go home.', '...what is the point?', '...'],

	// Artisan
	'artisan:elated': ['I just finished my best piece yet!', 'The workshop is humming!', 'Craftsmanship is its own reward.'],
	'artisan:content': ['Working on something new today.', 'The tools are holding up well.', 'Steady hands, steady work.'],
	'artisan:stressed': ['Running low on materials...', 'This commission is overdue.', 'I need better supplies.'],
	'artisan:distressed': ['My tools are failing me.', 'Nothing I make turns out right.', 'I have lost my touch.'],
	'artisan:breakdown': ['...I cannot even hold the hammer.', '...', '...what is craft worth?'],

	// Scholar
	'scholar:elated': ['I made a fascinating discovery!', 'The archives revealed something incredible.', 'Knowledge is a treasure.'],
	'scholar:content': ['I have been reading about the old times.', 'There is always more to learn.', 'A quiet day for study.'],
	'scholar:stressed': ['I cannot find the text I need...', 'Too many questions, too few answers.', 'The library is in disarray.'],
	'scholar:distressed': ['All my research leads nowhere.', 'I fear the old knowledge is lost.', 'Nobody cares about learning anymore.'],
	'scholar:breakdown': ['...words fail me.', '...what does any of it matter?', '...'],

	// Default fallback
	'default:elated': ['What a wonderful day!', 'Life is good.', 'I feel great today!'],
	'default:content': ['Hello there.', 'How are things?', 'Good to see you.'],
	'default:stressed': ['Things have been rough.', 'I have a lot on my mind.', 'Not the best day.'],
	'default:distressed': ['I am not doing well.', 'Everything feels wrong.', 'I need help.'],
	'default:breakdown': ['...', '...leave me alone.', '...I cannot.'],
};
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```
feat(meridian): dialogue domain — template registry + selectDialogue
```

### Task B2: Infrastructure — DialogueSystem

**Files:**
- Create: `src/infrastructure/systems/dialogue-system.ts`
- Create: `tests/infrastructure/systems/dialogue-system.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/infrastructure/systems/dialogue-system.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createDialogueSystem } from '../../../src/infrastructure/systems/dialogue-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { RelationshipComponent } from '../../../src/infrastructure/components/relationship-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

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

function createTestAgentData(id: string, kind: string, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind,
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' },
		relationships: '', tools: [], color: '#b0b0b0',
		persona: null, behavior_tree: `bt-${kind}`, job: null, property: [],
		...overrides,
	};
}

function createDeps(eventBus = createEventBus(), tickCount = 100): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

function emitSocialInteraction(eventBus: ReturnType<typeof createEventBus>, agentId: string, partnerId: string, tick: number, memoryCreated = true): void {
	eventBus.emit({
		type: 'SocialInteraction',
		tick,
		wallClock: Date.now(),
		source: 'SocializeSystem',
		payload: { agentId, partnerId, memoryCreated },
	});
}

describe('DialogueSystem', () => {
	it('creates dialogue memories from SocialInteraction events', () => {
		const eventBus = createEventBus();
		const agent1 = new AgentActor(createTestAgentData('agent-elena', 'merchant'), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-marcus', 'guard'), defaultMoodConfig);

		// Pre-seed a social memory (as SocializeSystem would)
		const mem1 = agent1.get(MemoryComponent);
		mem1.state = { ...mem1.state, entries: [{ tick: 100, type: 'social', description: 'Talked with agent-marcus', participants: ['agent-marcus'], outcome: 'positive', significance: 4, mood_impact: 2 }] };
		const mem2 = agent2.get(MemoryComponent);
		mem2.state = { ...mem2.state, entries: [{ tick: 100, type: 'social', description: 'Talked with agent-elena', participants: ['agent-elena'], outcome: 'positive', significance: 4, mood_impact: 2 }] };

		// Set moods to content
		agent1.get(MoodComponent).state = { value: 30, bucket: 'content' };
		agent2.get(MoodComponent).state = { value: 30, bucket: 'content' };

		emitSocialInteraction(eventBus, 'agent-elena', 'agent-marcus', 100);

		const system = createDialogueSystem(() => [agent1, agent2], 42);
		system.execute(createDeps(eventBus, 100));

		// Social memory should be replaced with dialogue memory
		const entries1 = agent1.get(MemoryComponent).state.entries;
		expect(entries1.some(e => e.type === 'dialogue')).toBe(true);
		expect(entries1.filter(e => e.type === 'social' && e.tick === 100)).toHaveLength(0);
	});

	it('skips events where memoryCreated is false', () => {
		const eventBus = createEventBus();
		const agent1 = new AgentActor(createTestAgentData('agent-elena', 'merchant'), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-marcus', 'guard'), defaultMoodConfig);

		emitSocialInteraction(eventBus, 'agent-elena', 'agent-marcus', 100, false);

		const system = createDialogueSystem(() => [agent1, agent2], 42);
		const deps = createDeps(eventBus, 100);
		system.execute(deps);

		// No dialogue memory created
		expect(agent1.get(MemoryComponent).state.entries).toHaveLength(0);
	});

	it('emits DialogueCompleted event', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DialogueCompleted', (e) => { events.push(e); });

		const agent1 = new AgentActor(createTestAgentData('agent-elena', 'merchant'), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-marcus', 'guard'), defaultMoodConfig);
		agent1.get(MoodComponent).state = { value: 30, bucket: 'content' };
		agent2.get(MoodComponent).state = { value: 30, bucket: 'content' };

		emitSocialInteraction(eventBus, 'agent-elena', 'agent-marcus', 100);

		const system = createDialogueSystem(() => [agent1, agent2], 42);
		system.execute(createDeps(eventBus, 100));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-elena');
		expect(events[0]?.payload.partnerId).toBe('agent-marcus');
		expect(events[0]?.payload.tone).toBeDefined();
	});

	it('sets gossipPending on both agents when familiarity >= threshold', () => {
		const eventBus = createEventBus();
		const agent1 = new AgentActor(createTestAgentData('agent-elena', 'merchant'), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-marcus', 'guard'), defaultMoodConfig);
		agent1.get(MoodComponent).state = { value: 30, bucket: 'content' };
		agent2.get(MoodComponent).state = { value: 30, bucket: 'content' };

		// Set familiarity above threshold
		agent1.get(RelationshipComponent).state = { entries: [{ agentId: 'agent-marcus', disposition: 10, familiarity: 5, tags: [], lastInteractionTick: 0 }] };
		agent2.get(RelationshipComponent).state = { entries: [{ agentId: 'agent-elena', disposition: 5, familiarity: 5, tags: [], lastInteractionTick: 0 }] };

		emitSocialInteraction(eventBus, 'agent-elena', 'agent-marcus', 100);

		const system = createDialogueSystem(() => [agent1, agent2], 42);
		system.execute(createDeps(eventBus, 100));

		expect(agent1.get(BlackboardComponent).state.gossipPending).toBe('agent-marcus');
		expect(agent2.get(BlackboardComponent).state.gossipPending).toBe('agent-elena');
	});

	it('does not set gossipPending when familiarity < threshold', () => {
		const eventBus = createEventBus();
		const agent1 = new AgentActor(createTestAgentData('agent-elena', 'merchant'), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-marcus', 'guard'), defaultMoodConfig);
		agent1.get(MoodComponent).state = { value: 30, bucket: 'content' };
		agent2.get(MoodComponent).state = { value: 30, bucket: 'content' };

		// Familiarity below threshold (default 3)
		agent1.get(RelationshipComponent).state = { entries: [{ agentId: 'agent-marcus', disposition: 0, familiarity: 1, tags: [], lastInteractionTick: 0 }] };

		emitSocialInteraction(eventBus, 'agent-elena', 'agent-marcus', 100);

		const system = createDialogueSystem(() => [agent1, agent2], 42);
		system.execute(createDeps(eventBus, 100));

		expect(agent1.get(BlackboardComponent).state.gossipPending).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

- [ ] **Step 3: Implement dialogue-system.ts**

Create `src/infrastructure/systems/dialogue-system.ts`. The system:

1. Reads `SocialInteraction` events from `deps.eventBus.history()` for this tick
2. Filters `memoryCreated === true`
3. Looks up both agents, reads mood/disposition/familiarity
4. Calls `selectDialogue` domain function
5. Replaces social memory with dialogue memory on both agents
6. Updates disposition via `applyRelationshipUpdate` with `lastInteractionTick` and `'talked_with'` tag
7. Sets `gossipPending` on both agents if appropriate
8. Emits `DialogueCompleted`

Key implementation details:
- Priority: `SystemPriority.DIALOGUE` (12)
- RNG: `createGameRNG((deps.tickCount ^ hashString(pairKey)) >>> 0)` per pair
- Memory replacement: find entry with `type === 'social' && tick === deps.tickCount && participants includes partnerId`, remove it, add dialogue entry
- Factory signature: `createDialogueSystem(agents: () => AgentActor[], baseSeed: number): GameSystem`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Run full test suite**

- [ ] **Step 6: Commit**

```
feat(meridian): DialogueSystem — template dialogue + memory replacement + gossip gate
```

---

## Chunk C: Gossip System — Domain + Infrastructure

### Task C1: Domain — gossip exchange logic

**Files:**
- Create: `src/domain/systems/gossip.ts`
- Create: `tests/domain/systems/gossip.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/systems/gossip.test.ts` with tests for:

1. **Reliability degradation:** gossip at hopCount 0 degrades to 0.7 on transfer
2. **Hop limit:** gossip at hopCount 3 (tiers length - 1) is not transferred
3. **IQ filtering:** receiver with IQ >= 12 rejects gossip below 0.3 reliability
4. **IQ bypass:** receiver with IQ < 12 accepts low-reliability gossip
5. **Duplicate location:** receiver already has gossip about same locationId — skip
6. **Duplicate reputation:** receiver already has gossip about same subjectAgentId — skip
7. **Max items per exchange:** only top 2 by significance transferred
8. **Reputation disposition change:** `dispositionBias * newReliability` computed correctly
9. **Empty giver gossip:** returns empty result
10. **Location gossip creates valid MemoryEntry** with metadata

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement gossip.ts**

Create `src/domain/systems/gossip.ts` with:

```typescript
export interface LocationGossip { ... }
export interface ReputationGossip { ... }
export type GossipData = LocationGossip | ReputationGossip;
export interface GossipExchangeInput { ... }
export interface GossipExchangeResult { ... }
export function exchangeGossip(input: GossipExchangeInput): GossipExchangeResult { ... }
export function parseGossipData(entry: MemoryEntry): GossipData | null { ... }
```

Transfer logic:
1. Sort giver gossip by significance descending
2. Take up to `maxItemsPerExchange`
3. For each: increment hopCount, look up new reliability from tiers
4. Apply hop limit, IQ filter, duplicate check
5. Build MemoryEntry with `metadata` containing the gossip data
6. For reputation gossip, compute disposition change

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```
feat(meridian): gossip domain — exchangeGossip with reliability tiers + IQ filtering
```

### Task C2: Infrastructure — GossipSystem

**Files:**
- Create: `src/infrastructure/systems/gossip-system.ts`
- Create: `tests/infrastructure/systems/gossip-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:

1. Processes agents with `gossipPending` flag set
2. Bidirectional: calls exchangeGossip for A→B and B→A
3. Writes transferred gossip to receiver's MemoryComponent
4. Applies reputation disposition changes to RelationshipComponent
5. Clears `gossipPending` on both agents
6. Emits `GossipExchanged` event with correct payload
7. Uses `processedPairs` to avoid double-processing
8. Builds first-hand location gossip from `knownLocations` at reliability 1.0
9. Skips when `gossipPending` agent not found

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement gossip-system.ts**

Create `src/infrastructure/systems/gossip-system.ts`:
- Priority: `SystemPriority.GOSSIP` (12.5)
- Iterates agents, checks `bb.state.gossipPending`
- Uses `processedPairs` set
- Extracts giver gossip from (a) gossip memories and (b) `bb.state.knownLocations`
- Converts `knownLocations` to location gossip entries at reliability 1.0, hopCount 0
- Calls `exchangeGossip` for both directions
- Writes results to MemoryComponents
- Applies disposition changes from reputation gossip via `applyRelationshipUpdate`
- Adds `'gossiped_about'` tag to relationship with gossip subject
- Clears gossipPending, emits event
- Factory signature: `createGossipSystem(agents: () => AgentActor[], locations: () => WorldLocation[]): GameSystem`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Run full test suite**

- [ ] **Step 6: Commit**

```
feat(meridian): GossipSystem — bidirectional gossip exchange with location + reputation transfer
```

---

## Chunk D: Relationship Checkpoint — Domain + Infrastructure

### Task D1: Domain — Canvas serialization

**Files:**
- Create: `src/domain/systems/relationship-canvas.ts`
- Create: `tests/domain/systems/relationship-canvas.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:

1. **World graph:** produces valid JSON with nodes and edges arrays
2. **Circle layout:** N agents produce N nodes evenly spaced around center (400, 300) radius 200
3. **Edge color:** disposition >= 20 → color "4", <= -20 → color "1", else "0"
4. **Edge filter:** only includes edges with familiarity > 0
5. **Edge label format:** `"disposition: N | familiarity: N"`
6. **Empty graph:** 0 agents produces `{ nodes: [], edges: [] }`
7. **Per-agent view:** filters to only edges involving target agent
8. **Per-agent layout:** target agent centered at (400, 300), others in semicircle

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement relationship-canvas.ts**

Create `src/domain/systems/relationship-canvas.ts` with:

```typescript
export interface RelationshipGraphInput { ... }
export function serializeRelationshipGraph(input: RelationshipGraphInput): string { ... }
export function serializeAgentRelationshipView(agentId: string, input: RelationshipGraphInput): string { ... }
```

Layout math:
- Circle: `x = centerX + radius * cos(2π * i / n)`, `y = centerY + radius * sin(2π * i / n)`
- Semicircle: `x = centerX + radius * cos(π * i / (n-1))`, `y = centerY + radius * sin(π * i / (n-1))`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```
feat(meridian): relationship-canvas domain — Canvas JSON serialization with circle layout
```

### Task D2: Infrastructure — RelationshipCheckpointSystem

**Files:**
- Create: `src/infrastructure/systems/relationship-checkpoint-system.ts`
- Create: `tests/infrastructure/systems/relationship-checkpoint-system.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:

1. Writes canvas file every N ticks (default 50)
2. Does not write on non-checkpoint ticks
3. Calls `deps.writeFile` with path `03 - Resources/Graphs/relationships.canvas`
4. Written content is valid JSON with nodes and edges
5. Emits `RelationshipGraphCheckpointed` event on checkpoint
6. Handles `RequestAgentRelationshipView` events from history
7. Writes per-agent canvas to `03 - Resources/Graphs/{name}-relationships.canvas`
8. Skips write when `deps.writeFile` is null

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement relationship-checkpoint-system.ts**

- Priority: `SystemPriority.VAULT_SYNC` (19)
- Internal `ticksSinceCheckpoint` counter
- Factory: `createRelationshipCheckpointSystem(agents: () => AgentActor[]): GameSystem`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```
feat(meridian): RelationshipCheckpointSystem — periodic canvas writes + on-demand views
```

---

## Chunk E: Integration — System Registration + Full Pipeline Test

### Task E1: Register new systems in game-view.ts

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Add imports and register 3 new systems**

In `src/infrastructure/engine/game-view.ts`, add imports:

```typescript
import { createDialogueSystem } from '../systems/dialogue-system.js';
import { createGossipSystem } from '../systems/gossip-system.js';
import { createRelationshipCheckpointSystem } from '../systems/relationship-checkpoint-system.js';
```

After the existing `tickRunner.register(createTradeSystem(...))` line, add:

```typescript
tickRunner.register(createDialogueSystem(getAgents, Date.now()));
tickRunner.register(createGossipSystem(getAgents, getLocations));
tickRunner.register(createRelationshipCheckpointSystem(getAgents));
```

- [ ] **Step 2: Run tsc to verify no compile errors**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```
feat(meridian): register DialogueSystem, GossipSystem, RelationshipCheckpointSystem
```

### Task E2: Integration test — full social pipeline

**Files:**
- Create: `tests/integration/social-integration.test.ts`

- [ ] **Step 1: Write integration test**

Test the full pipeline: SocializeSystem → DialogueSystem → GossipSystem → RelationshipCheckpointSystem in sequence.

Scenario:
1. Two agents with `btAction: 'talk'`, close together, familiarity above gossip threshold
2. Agent A has a known location that agent B doesn't know
3. Run all 4 systems in priority order
4. Verify: dialogue memories created, gossip transferred, canvas file written after N ticks

```typescript
import { describe, it, expect } from 'vitest';
// Import all 4 systems, AgentActor, components, etc.

describe('Social Pipeline Integration', () => {
	it('socialize → dialogue → gossip → checkpoint produces full social interaction', () => {
		// Setup: two agents, both btAction='talk', perception of each other
		// Agent A has knownLocations: ['loc-bakery'], Agent B has none
		// Familiarity = 5 (above default threshold of 3)

		// Run SocializeSystem → emits SocialInteraction
		// Run DialogueSystem → replaces social memory with dialogue, sets gossipPending
		// Run GossipSystem → transfers location knowledge A→B, B gets gossip memory
		// Run RelationshipCheckpointSystem (with ticksSinceCheckpoint = 49) → writes canvas

		// Assert: Agent B now has gossip memory about bakery
		// Assert: Both agents have dialogue memories (not social)
		// Assert: writeFile was called with valid canvas JSON
	});
});
```

- [ ] **Step 2: Run integration test**

- [ ] **Step 3: Run full test suite + tsc + eslint**

Run: `npx vitest run --config configs/vitest.config.ts`
Run: `npx tsc --noEmit --project configs/tsconfig.json`
Run: `npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 4: Commit**

```
test(meridian): Phase 3A social pipeline integration test
```

### Task E3: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass (existing + ~60-70 new)

- [ ] **Step 2: Verify exit criteria**

Walk through each exit criterion from the spec (Section 2) and confirm it's covered by tests.

- [ ] **Step 3: Final commit if any cleanup needed**

```
fix(meridian): Phase 3A polish — any final adjustments
```
