import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';

describe('GameConfigSchema economy depth fields', () => {
	it('provides defaults for all new economy fields', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) return;
		const eco = result.data.economy;

		expect(eco.price_memory_max).toBe(20);
		expect(eco.price_memory_stale_ticks).toBe(200);
		expect(eco.demand_window_ticks).toBe(500);
		expect(eco.elasticity).toEqual({
			subsistence: 1.5,
			comfort: 1.0,
			trade_goods: 0.7,
			luxury: 0.4,
		});
	});

	it('provides defaults for monetary_policy section', () => {
		const result = GameConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) return;
		const mp = result.data.economy.monetary_policy;

		expect(mp.velocity_window_ticks).toBe(500);
		expect(mp.velocity_healthy_min).toBe(0.3);
		expect(mp.velocity_healthy_max).toBe(0.8);
		expect(mp.velocity_stagnant).toBe(0.2);
		expect(mp.velocity_overheated).toBe(1.5);
		expect(mp.velocity_critical).toBe(0.1);
		expect(mp.stimulus_trigger_ticks).toBe(50);
		expect(mp.stimulus_duration_ticks).toBe(100);
		expect(mp.caravan_cooldown_ticks).toBe(500);
		expect(mp.tax_base_rate).toBe(0.10);
		expect(mp.tax_stagnant_multiplier).toBe(0.5);
		expect(mp.tax_overheated_multiplier).toBe(1.5);
		expect(mp.admin_fee_rate).toBe(0.02);
	});

	it('allows overriding elasticity values', () => {
		const result = GameConfigSchema.safeParse({
			economy: { elasticity: { subsistence: 2.0 } },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.economy.elasticity.subsistence).toBe(2.0);
		}
	});

	it('rejects elasticity values above 3', () => {
		const result = GameConfigSchema.safeParse({
			economy: { elasticity: { subsistence: 5.0 } },
		});
		expect(result.success).toBe(false);
	});

	it('EconomyConfig includes tools and equipment params', () => {
		const config = GameConfigSchema.parse({});
		expect(config.economy.tools_output_multiplier).toBe(2);
		expect(config.economy.equipment_decay_reduction).toBe(0.2);
	});
});

describe('GameConfigSchema jobs config', () => {
	it('provides defaults for aptitude and job definitions', () => {
		const config = GameConfigSchema.parse({});
		expect(config.jobs.aptitude_baseline).toBe(12);
		expect(config.jobs.desperation_ticks).toBe(200);
		expect(config.jobs.definitions.settler.primary_attribute).toBe('HT');
		expect(config.jobs.definitions.guard.primary_attribute).toBe('ST');
		expect(config.jobs.definitions.craftsman.primary_attribute).toBe('DX');
	});

	it('allows overriding job definitions', () => {
		const config = GameConfigSchema.parse({
			jobs: { definitions: { miner: { primary_attribute: 'ST' } } },
		});
		expect(config.jobs.definitions.miner.primary_attribute).toBe('ST');
	});

	it('rejects invalid primary_attribute', () => {
		const result = GameConfigSchema.safeParse({
			jobs: { definitions: { miner: { primary_attribute: 'XX' } } },
		});
		expect(result.success).toBe(false);
	});
});
