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
