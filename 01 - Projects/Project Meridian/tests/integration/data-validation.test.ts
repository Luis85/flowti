import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSchema } from '../../src/domain/schemas/agent-schema.js';
import { LocationSchema } from '../../src/domain/schemas/location-schema.js';
import { RegionSchema } from '../../src/domain/schemas/region-schema.js';
import { TraitDefinitionSchema } from '../../src/domain/schemas/trait-definition-schema.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

function loadJsonFiles(dir: string): { name: string; data: unknown }[] {
	const fullPath = resolve(projectRoot, dir);
	try {
		return readdirSync(fullPath)
			.filter(f => f.endsWith('.json'))
			.map(f => ({
				name: f,
				data: JSON.parse(readFileSync(resolve(fullPath, f), 'utf-8')) as unknown,
			}));
	} catch {
		return [];
	}
}

describe('Shipped Data Validation', () => {
	describe('agents/', () => {
		const files = loadJsonFiles('agents');

		it('has at least one agent file', () => {
			expect(files.length).toBeGreaterThan(0);
		});

		for (const { name, data } of files) {
			it(`${name} passes AgentSchema validation`, () => {
				const result = AgentSchema.safeParse(data);
				if (!result.success) {
					expect.fail(`${name} failed validation: ${result.error.message}`);
				}
			});
		}
	});

	describe('locations/', () => {
		const files = loadJsonFiles('locations');

		it('has at least one location file', () => {
			expect(files.length).toBeGreaterThan(0);
		});

		for (const { name, data } of files) {
			it(`${name} passes LocationSchema validation`, () => {
				const result = LocationSchema.safeParse(data);
				if (!result.success) {
					expect.fail(`${name} failed validation: ${result.error.message}`);
				}
			});
		}
	});

	describe('traits/', () => {
		const files = loadJsonFiles('traits');

		it('has at least one trait file', () => {
			expect(files.length).toBeGreaterThan(0);
		});

		for (const { name, data } of files) {
			it(`${name} passes TraitDefinitionSchema validation`, () => {
				const result = TraitDefinitionSchema.safeParse(data);
				if (!result.success) {
					expect.fail(`${name} failed validation: ${result.error.message}`);
				}
			});
		}
	});

	it('GameConfigSchema parses with social and stamina defaults', () => {
		const config = GameConfigSchema.parse({});
		expect(config.social.recovery_rate).toBe(3.0);
		expect(config.social.cooldown_ticks).toBe(20);
		expect(config.stamina.movement_energy_cost).toBe(0.005);
		expect(config.needs.food_recovery_rate).toBe(30);
		expect(config.perception.interaction_radius).toBe(25);
	});

	describe('Phase 2E economy config additions', () => {
		it('parses with food_price default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.food_price).toBe(3);
		});

		it('parses with rest_price default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.rest_price).toBe(1);
		});

		it('parses with ledger_retention_days default (facility_start_fund deprecated)', () => {
			const config = GameConfigSchema.parse({});
			// facility_start_fund still in schema for back-compat; facility types use default_fund now
			expect(config.economy.facility_start_fund).toBe(200);
		});

		it('parses with ledger_retention_days default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.ledger_retention_days).toBe(7);
		});

		it('retains existing economy fields', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.tax_base_rate).toBe(0.10);
			expect(config.economy.welfare_threshold_gold).toBe(10);
			expect(config.economy.welfare_reward_min).toBe(15);
		});
	});

	describe('LocationSchema facility fields', () => {
		it('defaults active_recipe to null when not specified', () => {
			const loc = LocationSchema.parse({
				id: 'loc-test',
				name: 'Test',
				facility_type: 'rest_inn',
				position: { x: 0, y: 0 },
			});
			expect(loc.active_recipe).toBeNull();
		});

		it('parses location with facility_type + active_recipe', () => {
			const loc = LocationSchema.parse({
				id: 'loc-farm',
				name: 'Farm',
				facility_type: 'farm',
				active_recipe: 'recipe-farm-wheat',
				position: { x: 100, y: 100 },
			});
			expect(loc.facility_type).toBe('farm');
			expect(loc.active_recipe).toBe('recipe-farm-wheat');
		});
	});

	describe('RegionSchema', () => {
		it('parses a region with polygon bounds', () => {
			const region = RegionSchema.parse({
				id: 'region-test',
				name: 'Test',
				bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			});
			expect(region.bounds).toHaveLength(3);
			expect(region.connections).toEqual([]);
			expect(region.rest_tier).toBeNull();
		});

		it('parses connections with travel_cost', () => {
			const region = RegionSchema.parse({
				id: 'region-test',
				name: 'Test',
				bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
				connections: [{ regionId: 'region-other', travel_cost: 2 }],
			});
			expect(region.connections).toHaveLength(1);
			expect(region.connections[0].travel_cost).toBe(2);
		});

		it('defaults travel_cost to 1', () => {
			const region = RegionSchema.parse({
				id: 'region-test',
				name: 'Test',
				bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
				connections: [{ regionId: 'region-other' }],
			});
			expect(region.connections[0].travel_cost).toBe(1);
		});

		it('rejects fewer than 3 vertices', () => {
			expect(() => RegionSchema.parse({
				id: 'region-test',
				name: 'Test',
				bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
			})).toThrow();
		});

		it('parses rest_tier', () => {
			const region = RegionSchema.parse({
				id: 'region-test',
				name: 'Test',
				bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
				rest_tier: 'outdoors',
			});
			expect(region.rest_tier).toBe('outdoors');
		});
	});
});
