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
			// Non-overridden defaults still apply
			expect(result.data.needs.hunger_decay).toBe(0.5);
		}
	});

	it('accepts partial nested overrides', () => {
		const result = GameConfigSchema.safeParse({
			needs: { hunger_decay: 1.0 },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.needs.hunger_decay).toBe(1.0);
			expect(result.data.needs.energy_decay).toBe(0.25);
		}
	});

	it('cascades defaults through doubly-nested mood config', () => {
		const result = GameConfigSchema.safeParse({ mood: {} });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.mood.factor_weights.needs).toBe(30);
			expect(result.data.mood.external_modifier_cap).toBe(30);
			expect(result.data.mood.buckets).toHaveLength(5);
			expect(result.data.mood.rock_bottom_threshold).toBe(-40);
		}
	});

	it('includes mood buckets and skill_roll_modifiers defaults', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.mood.buckets[0]?.name).toBe('elated');
			expect(result.data.mood.buckets[4]?.name).toBe('breakdown');
			expect(result.data.mood.skill_roll_modifiers.elated).toBe(1);
			expect(result.data.mood.skill_roll_modifiers.breakdown).toBe(-3);
		}
	});

	it('includes status section defaults', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status.evaluation_interval_ticks).toBe(100);
		}
	});

	it('accepts custom world_health tiers override', () => {
		const customTiers = [
			{ name: 'only', max: 100, positive_event_multiplier: 1.0, negative_event_multiplier: 1.0 },
		];
		const result = GameConfigSchema.safeParse({ world_health: { tiers: customTiers } });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.world_health.tiers).toHaveLength(1);
			expect(result.data.world_health.tiers[0]?.name).toBe('only');
		}
	});

	it('includes default world_health tiers (5 tiers)', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.world_health.tiers).toHaveLength(5);
			expect(result.data.world_health.tiers[0]?.name).toBe('critical');
			expect(result.data.world_health.tiers[4]?.name).toBe('booming');
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
		if (!result.ok) expect(result.error.code).toBe('CONFIG_PARSE_ERROR');
	});

	it('returns error for invalid config values', () => {
		const result = loadGameConfig('{ "tick_interval_ms": 10 }');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('CONFIG_SCHEMA_INVALID');
	});
});
