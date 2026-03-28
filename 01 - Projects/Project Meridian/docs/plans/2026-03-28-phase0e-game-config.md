# Phase 0E: Game Config — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
n**Dependencies:** Chunks B, C (Result type + Zod)
**Produces:** GameConfigSchema + loader — complete game-config.json specification

**Goal:** Establish the project scaffold, core primitives (Result, EventBus, Logger), Zod schemas, vault loading, game config, and trait system — the foundation all future phases build on.

**Architecture:** Obsidian plugin hosting an ExcaliburJS engine in a custom leaf view. TypeScript strict mode, Vite build, ESLint architecture enforcement. All game entities are ExcaliburJS ECS entities/actors with custom components. Vault markdown files are the persistence layer, Zod-validated at load time.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.29+, Zod, Vitest, Vite, ESLint (flat config), Obsidian Plugin API

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

## Chunk E: Game Config

### Task E1: GameConfig Schema and Loader

**Files:**
- Create: `src/domain/schemas/game-config-schema.ts`
- Create: `src/infrastructure/config/game-config-loader.ts`
- Create: `tests/infrastructure/config/game-config-loader.test.ts`

- [ ] **Step 1: Write failing tests for GameConfig**

```typescript
// tests/infrastructure/config/game-config-loader.test.ts
import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { loadGameConfig } from '../../../src/infrastructure/config/game-config-loader.js';

describe('GameConfigSchema', () => {
	it('validates a minimal config with all defaults applied', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.tick_interval_ms).toBe(500);
			expect(result.data.ticks_per_day).toBe(480);
			expect(result.data.mortality).toBe(true);
			expect(result.data.locale).toBe('en');
			expect(result.data.needs.hunger_decay).toBe(0.5);
			expect(result.data.economy.tax_rate).toBe(0.05);
		}
	});

	it('accepts overrides', () => {
		const result = GameConfigSchema.safeParse({
			tick_interval_ms: 100,
			mortality: false,
			locale: 'de',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.tick_interval_ms).toBe(100);
			expect(result.data.mortality).toBe(false);
			expect(result.data.locale).toBe('de');
		}
	});
});

describe('loadGameConfig', () => {
	it('loads config from JSON string using Result type', () => {
		const json = '{ "mortality": false }';
		const result = loadGameConfig(json);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.mortality).toBe(false);
			expect(result.value.tick_interval_ms).toBe(500);
		}
	});

	it('returns error for invalid JSON', () => {
		const result = loadGameConfig('not json');
		expect(result.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/config/ --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement GameConfigSchema**

```typescript
// src/domain/schemas/game-config-schema.ts
import { z } from 'zod';

export const GameConfigSchema = z.object({
	version: z.string().default('1.0.0'),
	locale: z.string().default('en'),
	tick_interval_ms: z.number().int().min(50).default(500),
	ticks_per_day: z.number().int().min(1).default(480),
	mortality: z.boolean().default(true),
	needs: z.object({
		hunger_decay: z.number().default(0.5),
		energy_decay: z.number().default(0.25),
		social_decay: z.number().default(0.15),
	}).default({}),
	stamina: z.object({
		recovery_per_idle_tick: z.number().default(0.05),
		exhaustion_speed_modifier: z.number().default(0.5),
		exhaustion_skill_penalty: z.number().default(-2),
	}).default({}),
	memory: z.object({
		max_entries: z.number().int().default(50),
		min_lifespan_ticks: z.number().int().default(20),
	}).default({}),
	economy: z.object({
		tax_rate: z.number().min(0).max(1).default(0.05),
		price_clamp_min: z.number().default(0.5),
		price_clamp_max: z.number().default(3.0),
		recalculation_interval_ticks: z.number().int().default(10),
		welfare_threshold_gold: z.number().default(10),
		welfare_reward_min: z.number().default(15),
		welfare_reward_max: z.number().default(25),
		max_active_welfare_quests: z.number().int().default(3),
		treasury_start_sandbox: z.number().default(500),
		treasury_regen_per_day: z.number().default(1),
		circulation_floor_per_agent: z.number().default(50),
		loan_interest_per_day: z.number().default(0.01),
	}).default({}),
	mood: z.object({
		factor_weights: z.object({
			needs: z.number().default(30),
			positive_memories: z.number().default(20),
			negative_memories: z.number().default(20),
			goal_progress: z.number().default(10),
			wallet: z.number().default(10),
			equipment: z.number().default(5),
			relationships: z.number().default(5),
		}).default({}),
		external_modifier_cap: z.number().default(30),
	}).default({}),
	mortality_config: z.object({
		starvation_collapse_ticks: z.number().int().default(50),
		starvation_death_ticks: z.number().int().default(100),
		despair_death_ticks: z.number().int().default(200),
		quest_danger_mortality_chance: z.number().min(0).max(1).default(0.1),
	}).default({}),
	perception: z.object({
		base_multiplier: z.number().default(20),
		night_multiplier: z.number().default(10),
	}).default({}),
	day_night: z.object({
		dawn: z.object({ start: z.number().default(0), end: z.number().default(59) }).default({}),
		day: z.object({ start: z.number().default(60), end: z.number().default(299) }).default({}),
		dusk: z.object({ start: z.number().default(300), end: z.number().default(359) }).default({}),
		night: z.object({ start: z.number().default(360), end: z.number().default(479) }).default({}),
	}).default({}),
	gossip: z.object({
		reliability_tiers: z.array(z.number()).default([1.0, 0.7, 0.5, 0.3]),
		iq_filter_threshold: z.number().default(12),
	}).default({}),
	crime: z.object({
		mood_threshold: z.number().default(-20),
	}).default({}),
	skills: z.object({
		use_thresholds: z.array(z.number().int()).default([10, 25, 50, 100, 200]),
		max_use_bonus: z.number().int().default(3),
	}).default({}),
	rest_tiers: z.object({
		owned_home: z.object({ recovery_rate: z.number().default(2.0), mood_effect: z.number().default(2) }).default({}),
		public_shelter: z.object({ recovery_rate: z.number().default(1.5), mood_effect: z.number().default(0) }).default({}),
		outdoors: z.object({ recovery_rate: z.number().default(1.0), mood_effect: z.number().default(-3) }).default({}),
	}).default({}),
	season: z.object({
		days_per_season: z.number().int().default(15),
	}).default({}),
	candidate_pool: z.object({
		size_min: z.number().int().default(3),
		size_max: z.number().int().default(5),
		weighted_count: z.number().int().default(2),
		refresh_days: z.number().int().default(5),
	}).default({}),
	world_events: z.object({
		evaluation_interval_ticks: z.number().int().default(50),
	}).default({}),
	canvas_checkpoint_interval_ticks: z.number().int().default(50),
	ui_bridge_snapshot_interval_ticks: z.number().int().default(10),
	vault_sync_debounce_ms: z.number().int().default(2000),
	llm: z.object({
		provider: z.string().default('cursor'),
		budget_daily_calls: z.number().int().default(50),
	}).default({}),
	formulas: z.object({
		basic_speed_divisor: z.number().default(4),
		carry_capacity_multiplier: z.number().default(5),
		trade_modifier_per_chr: z.number().default(0.02),
		social_reach_multiplier: z.number().default(0.5),
	}).default({}),
	bt: z.object({
		quest_wage_skip_multiplier: z.number().default(1.5),
	}).default({}),
	agent_creation: z.object({
		base_cost: z.number().default(50),
		cost_per_attribute_point: z.number().default(5),
		candidate_discount: z.number().default(0.7),
	}).default({}),
	world_health: z.object({
		tiers: z.array(z.object({
			name: z.string(),
			max: z.number(),
			positive_event_multiplier: z.number(),
			negative_event_multiplier: z.number(),
		})).default([
			{ name: 'critical', max: 20, positive_event_multiplier: 2.0, negative_event_multiplier: 0.3 },
			{ name: 'struggling', max: 40, positive_event_multiplier: 1.5, negative_event_multiplier: 0.6 },
			{ name: 'stable', max: 60, positive_event_multiplier: 1.0, negative_event_multiplier: 1.0 },
			{ name: 'thriving', max: 80, positive_event_multiplier: 0.8, negative_event_multiplier: 1.3 },
			{ name: 'booming', max: 100, positive_event_multiplier: 0.6, negative_event_multiplier: 1.5 },
		]),
	}).default({}),
	debug: z.boolean().default(false),
}).default({});

export type GameConfig = z.infer<typeof GameConfigSchema>;
```

- [ ] **Step 4: Implement config loader**

```typescript
// src/infrastructure/config/game-config-loader.ts
import { GameConfigSchema, type GameConfig } from '../../domain/schemas/game-config-schema.js';
import { Result, type ResultValue } from '../../domain/core/result.js';

export function loadGameConfig(jsonString: string): ResultValue<GameConfig> {
	let raw: unknown;
	try {
		raw = JSON.parse(jsonString);
	} catch {
		return Result.err({
			code: 'CONFIG_PARSE_ERROR',
			message: 'Failed to parse game-config.json',
			system: 'Config',
			recoverable: true,
		});
	}

	const validated = GameConfigSchema.safeParse(raw);
	if (!validated.success) {
		return Result.err({
			code: 'CONFIG_SCHEMA_INVALID',
			message: `game-config.json validation failed: ${validated.error.message}`,
			system: 'Config',
			recoverable: true,
		});
	}

	return Result.ok(validated.data);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/config/ --config configs/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" "01 - Projects/Project Meridian/src/infrastructure/config/" "01 - Projects/Project Meridian/tests/infrastructure/config/"
git commit -m "feat(meridian): GameConfig Zod schema with all defaults + config loader"
```

---

