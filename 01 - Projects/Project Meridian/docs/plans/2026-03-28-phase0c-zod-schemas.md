# Phase 0C: Zod Schemas — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
n**Dependencies:** Chunk B (Result type must exist for error handling)
**Produces:** AgentSchema, TraitSchema, all sub-schemas — Zod validation foundation

**Goal:** Establish the project scaffold, core primitives (Result, EventBus, Logger), Zod schemas, vault loading, game config, and trait system — the foundation all future phases build on.

**Architecture:** Obsidian plugin hosting an ExcaliburJS engine in a custom leaf view. TypeScript strict mode, Vite build, ESLint architecture enforcement. All game entities are ExcaliburJS ECS entities/actors with custom components. Vault markdown files are the persistence layer, Zod-validated at load time.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+, Zod, Vitest, Vite, ESLint (flat config), Obsidian Plugin API

**GDD Reference:** `01 - Projects/Project Meridian/Project Meridian.md` — §2, §12, §14, §16, §23, §29, §30, §34, §36

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`result-type.ts`, `result-type.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **Coverage target:** 80% statements, 80% lines

---

## Chunk C: Zod Schemas

### Task C1: Agent Schema and Sub-Schemas

**Files:**
- Create: `src/domain/schemas/common.ts`
- Create: `src/domain/schemas/agent-schema.ts`
- Create: `src/domain/schemas/trait-schema.ts`
- Create: `tests/domain/schemas/agent-schema.test.ts`
- Create: `tests/domain/schemas/trait-schema.test.ts`

- [ ] **Step 1: Write failing tests for AgentSchema**

```typescript
// tests/domain/schemas/agent-schema.test.ts
import { describe, it, expect } from 'vitest';
import { AgentSchema } from '../../../src/domain/schemas/agent-schema.js';

describe('AgentSchema', () => {
	const validAgent = {
		id: 'agent-merchant-elena',
		name: 'Elena Vasquez',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 14 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 50,
		wallet: { gold: 100 },
		position: { x: 100, y: 200, region: 'loc-marketplace' },
		behavior_tree: 'config/kinds/merchant-bt.json',
	};

	it('validates a well-formed agent', () => {
		const result = AgentSchema.safeParse(validAgent);
		expect(result.success).toBe(true);
	});

	it('rejects an agent with invalid id prefix', () => {
		const result = AgentSchema.safeParse({ ...validAgent, id: 'npc-elena' });
		expect(result.success).toBe(false);
	});

	it('rejects attributes outside range 1-20', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			attributes: { ST: 25, DX: 10, IQ: 10, HT: 10 },
		});
		expect(result.success).toBe(false);
	});

	it('applies defaults for optional arrays', () => {
		const result = AgentSchema.parse(validAgent);
		expect(result.memory).toEqual([]);
		expect(result.goals).toEqual([]);
		expect(result.skills).toEqual([]);
		expect(result.traits).toEqual([]);
		expect(result.inventory).toEqual([]);
		expect(result.property).toEqual([]);
		expect(result.tools).toEqual([]);
	});

	it('rejects needs outside 0-100 range', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			needs: { hunger: 150, energy: 50, social: 50 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects mood outside -100 to 100 range', () => {
		const result = AgentSchema.safeParse({ ...validAgent, mood: 200 });
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/agent-schema.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement common schemas and AgentSchema**

```typescript
// src/domain/schemas/common.ts
import { z } from 'zod';

export const PositionSchema = z.object({
	x: z.number(),
	y: z.number(),
	region: z.string().optional(),
});

export const MemoryEntrySchema = z.object({
	tick: z.number(),
	type: z.string(),
	description: z.string(),
	participants: z.array(z.string()).default([]),
	outcome: z.enum(['positive', 'negative', 'neutral']),
	significance: z.number().min(1).max(10),
	mood_impact: z.number(),
	original_significance: z.number().min(1).max(10).optional(),
});

export const GoalSchema = z.object({
	id: z.string(),
	type: z.enum(['aspirational', 'operational']),
	metric: z.string(),
	target: z.number(),
	priority: z.enum(['high', 'medium', 'low']),
	reward_xp: z.number().min(0),
	progress: z.number().min(0).default(0),
});

export const SkillEntrySchema = z.object({
	id: z.string(),
	points: z.number().int().min(0).default(0),
	use_count: z.number().int().min(0).default(0),
	use_bonus: z.number().int().min(0).max(3).default(0),
});

export const InventoryItemSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int().min(1),
	spoilage_remaining: z.number().nullable().default(null),
});

export const EquipmentSchema = z.object({
	head: z.string().nullable().default(null),
	body: z.string().nullable().default(null),
	hands: z.string().nullable().default(null),
	tool: z.string().nullable().default(null),
	accessory: z.string().nullable().default(null),
});

export const LLMConfigSchema = z.object({
	enabled: z.boolean().default(false),
	provider: z.string().default('cursor'),
	personality: z.union([z.string(), z.record(z.string())]).optional(),
	temperature: z.number().min(0).max(2).default(0.7),
	max_tokens: z.number().int().min(1).default(150),
});
```

```typescript
// src/domain/schemas/agent-schema.ts
import { z } from 'zod';
import {
	PositionSchema,
	MemoryEntrySchema,
	GoalSchema,
	SkillEntrySchema,
	InventoryItemSchema,
	EquipmentSchema,
	LLMConfigSchema,
} from './common.js';

export const AgentSchema = z.object({
	id: z.string().regex(/^agent-[a-z0-9-]+$/),
	name: z.string().min(1),
	kind: z.string(),
	attributes: z.object({
		ST: z.number().int().min(1).max(20),
		DX: z.number().int().min(1).max(20),
		IQ: z.number().int().min(1).max(20),
		HT: z.number().int().min(1).max(20),
	}),
	social: z.object({
		status: z.number().int().min(-4).max(8),
		reputation: z.number().int().min(-4).max(4),
		charisma: z.number().int().min(1).max(20),
	}),
	needs: z.object({
		hunger: z.number().min(0).max(100),
		energy: z.number().min(0).max(100),
		social: z.number().min(0).max(100),
	}),
	mood: z.number().min(-100).max(100).default(50),
	memory: z.array(MemoryEntrySchema).default([]),
	goals: z.array(GoalSchema).default([]),
	skills: z.array(SkillEntrySchema).default([]),
	inventory: z.array(InventoryItemSchema).default([]),
	equipment: EquipmentSchema.default({}),
	traits: z.array(z.string()).default([]),
	wallet: z.object({ gold: z.number().min(0) }),
	xp: z.number().min(0).default(0),
	level: z.number().int().min(1).default(1),
	position: PositionSchema,
	relationships: z.string().default('graphs/relationships.canvas'),
	llm: LLMConfigSchema.optional(),
	tools: z.array(z.string()).default([]),
	behavior_tree: z.string(),
	job: z.string().nullable().default(null),
	property: z.array(z.string()).default([]),
});

export type Agent = z.infer<typeof AgentSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/agent-schema.test.ts --config configs/vitest.config.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write failing tests for TraitSchema**

```typescript
// tests/domain/schemas/trait-schema.test.ts
import { describe, it, expect } from 'vitest';
import { TraitSchema } from '../../../src/domain/schemas/trait-schema.js';

describe('TraitSchema', () => {
	const validTrait = {
		id: 'trait-unkillable',
		name: 'Unkillable',
		description: 'This agent cannot die.',
		category: 'survival',
		effects: [
			{ system: 'MortalityCheck', modifier: { prevent_death: true, auto_recover_ticks: 150 } },
		],
		assignable_by: 'director',
		stackable: false,
		conflicts_with: [],
	};

	it('validates a well-formed trait', () => {
		const result = TraitSchema.safeParse(validTrait);
		expect(result.success).toBe(true);
	});

	it('rejects invalid category', () => {
		const result = TraitSchema.safeParse({ ...validTrait, category: 'invalid' });
		expect(result.success).toBe(false);
	});

	it('rejects invalid id prefix', () => {
		const result = TraitSchema.safeParse({ ...validTrait, id: 'bonus-speed' });
		expect(result.success).toBe(false);
	});

	it('validates all assignable_by values', () => {
		for (const by of ['director', 'definition', 'milestone', 'inherited']) {
			const result = TraitSchema.safeParse({ ...validTrait, assignable_by: by });
			expect(result.success).toBe(true);
		}
	});
});
```

- [ ] **Step 6: Implement TraitSchema**

```typescript
// src/domain/schemas/trait-schema.ts
import { z } from 'zod';

export const TraitEffectSchema = z.object({
	system: z.string(),
	modifier: z.record(z.unknown()),
});

export const TraitSchema = z.object({
	id: z.string().regex(/^trait-[a-z0-9-]+$/),
	name: z.string().min(1),
	description: z.string(),
	category: z.enum(['survival', 'social', 'economic', 'work', 'special']),
	effects: z.array(TraitEffectSchema),
	assignable_by: z.enum(['director', 'definition', 'milestone', 'inherited']),
	stackable: z.boolean().default(false),
	conflicts_with: z.array(z.string()).default([]),
});

export type Trait = z.infer<typeof TraitSchema>;
```

- [ ] **Step 7: Run all schema tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/schemas/ --config configs/vitest.config.ts`
Expected: PASS (10 tests).

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/" "01 - Projects/Project Meridian/tests/domain/schemas/"
git commit -m "feat(meridian): Zod schemas for Agent, Trait, and all sub-schemas"
```

---

