import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSchema } from '../../src/domain/schemas/agent-schema.js';
import { LocationSchema, ProductionSchema } from '../../src/domain/schemas/location-schema.js';
import { BehaviorTreeSchema } from '../../src/domain/schemas/behavior-tree-schema.js';
import { TraitDefinitionSchema } from '../../src/domain/schemas/trait-definition-schema.js';
import { KNOWN_ACTIONS } from '../../src/domain/systems/bt-actions.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import type { BTNode } from '../../src/domain/schemas/behavior-tree-schema.js';

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

function collectActions(node: BTNode): string[] {
	if (node.type === 'action') return [node.action];
	if ('children' in node) return node.children.flatMap(collectActions);
	return [];
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

	describe('behavior-trees/', () => {
		const files = loadJsonFiles('behavior-trees');

		it('has at least one BT file', () => {
			expect(files.length).toBeGreaterThan(0);
		});

		for (const { name, data } of files) {
			it(`${name} passes BehaviorTreeSchema validation`, () => {
				const result = BehaviorTreeSchema.safeParse(data);
				if (!result.success) {
					expect.fail(`${name} failed validation: ${result.error.message}`);
				}
			});
		}

		describe('BT action vocabulary', () => {
			for (const { name, data } of files) {
				it(`${name} uses only known actions`, () => {
					const result = BehaviorTreeSchema.safeParse(data);
					if (!result.success) return; // schema failure caught above
					const actions = collectActions(result.data.root);
					for (const action of actions) {
						expect(KNOWN_ACTIONS.has(action), `Unknown action "${action}" in ${name}`).toBe(true);
					}
				});
			}
		});
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
		expect(config.social.recovery_rate).toBe(0.5);
		expect(config.social.cooldown_ticks).toBe(50);
		expect(config.stamina.movement_energy_cost).toBe(0.1);
		expect(config.needs.food_recovery_rate).toBe(0.3);
		expect(config.perception.interaction_radius).toBe(25);
	});

	describe('Phase 2E economy config additions', () => {
		it('parses with food_price default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.food_price).toBe(2);
		});

		it('parses with rest_price default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.rest_price).toBe(1);
		});

		it('parses with facility_start_fund default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.facility_start_fund).toBe(200);
		});

		it('parses with ledger_retention_days default', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.ledger_retention_days).toBe(7);
		});

		it('retains existing economy fields', () => {
			const config = GameConfigSchema.parse({});
			expect(config.economy.tax_rate).toBe(0.05);
			expect(config.economy.welfare_threshold_gold).toBe(10);
			expect(config.economy.welfare_reward_min).toBe(15);
		});
	});

	describe('ProductionSchema', () => {
		it('defaults to null when not specified', () => {
			const loc = LocationSchema.parse({
				id: 'loc-test',
				name: 'Test',
				type: 'rest',
				position: { x: 0, y: 0 },
			});
			expect(loc.production).toBeNull();
		});

		it('parses farm production', () => {
			const production = ProductionSchema.parse({
				job: 'farmer',
				output: { item_id: 'wheat', quantity: 1 },
				input: null,
				wage: 3,
				ticks_per_cycle: 30,
			});
			expect(production).not.toBeNull();
			expect(production?.job).toBe('farmer');
			expect(production?.output.item_id).toBe('wheat');
			expect(production?.input).toBeNull();
		});

		it('parses bakery production with input', () => {
			const production = ProductionSchema.parse({
				job: 'baker',
				output: { item_id: 'bread', quantity: 1 },
				input: { item_id: 'wheat', quantity: 1 },
				wage: 4,
				ticks_per_cycle: 20,
			});
			expect(production).not.toBeNull();
			expect(production?.input?.item_id).toBe('wheat');
		});

		it('applies wage default', () => {
			const production = ProductionSchema.parse({
				job: 'test',
				output: { item_id: 'item', quantity: 1 },
			});
			expect(production?.wage).toBe(5);
		});
	});

	describe('LocationSchema with production', () => {
		it('parses location with production block', () => {
			const loc = LocationSchema.parse({
				id: 'loc-farm',
				name: 'Farm',
				type: 'food',
				position: { x: 100, y: 100 },
				production: {
					job: 'farmer',
					output: { item_id: 'wheat', quantity: 1 },
					wage: 3,
					ticks_per_cycle: 30,
				},
			});
			expect(loc.production).not.toBeNull();
			expect(loc.production?.job).toBe('farmer');
		});
	});
});
