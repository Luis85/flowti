import { describe, it, expect, vi } from 'vitest';
import { createFacilityTypeLoader, validateFacilityTypes } from '../../../src/infrastructure/entity/facility-type-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';
import type { FacilityType } from '../../../src/domain/schemas/facility-type-schema.js';
import type { Recipe } from '../../../src/domain/schemas/recipe-schema.js';

const productionType = {
	id: 'smithy',
	primary_job: 'smith',
	kind: 'production',
	allowed_recipes: ['recipe-smithy-equipment'],
};

const serviceType = {
	id: 'tavern',
	primary_job: 'innkeeper',
	kind: 'service',
	staffed_effects: { mood: 5, energy: 2, social: 3, skill_xp: 1 },
	unstaffed_effects: { mood: 1, energy: 0, social: 1, skill_xp: 0 },
};

const areaEffectType = {
	id: 'shrine',
	primary_job: 'priest',
	kind: 'area_effect',
	modifier: { kind: 'mood', delta_per_tick: 1 },
	radius: 5,
};

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> { return Object.keys(files).filter(f => f.startsWith(path)); },
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('FacilityTypeLoader', () => {
	it('loads valid facility type files', async () => {
		const vault = createMockVault({
			'facility-types/smithy.json': JSON.stringify(productionType),
			'facility-types/tavern.json': JSON.stringify(serviceType),
		});
		const loader = createFacilityTypeLoader(logger);
		const result = await loader.loadFromVault(vault, 'facility-types/');
		expect(result.items).toHaveLength(2);
		expect(result.errors).toHaveLength(0);
		const ids = result.items.map(t => t.id);
		expect(ids).toContain('smithy');
		expect(ids).toContain('tavern');
	});

	it('collects schema failure in errors', async () => {
		const invalid = { id: 'bogus', primary_job: 'none', kind: 'invalid_kind' };
		const vault = createMockVault({
			'facility-types/bogus.json': JSON.stringify(invalid),
		});
		const loader = createFacilityTypeLoader(logger);
		const result = await loader.loadFromVault(vault, 'facility-types/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('facility-types/bogus.json');
	});

	it('collects duplicate id as error', async () => {
		const vault = createMockVault({
			'facility-types/a.json': JSON.stringify(productionType),
			'facility-types/b.json': JSON.stringify(productionType),
		});
		const loader = createFacilityTypeLoader(logger);
		const result = await loader.loadFromVault(vault, 'facility-types/');
		expect(result.items).toHaveLength(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.message).toContain('Duplicate facility type id smithy');
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const loader = createFacilityTypeLoader(logger);
		const result = await loader.loadFromVault(vault, 'facility-types/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});

describe('validateFacilityTypes', () => {
	const productionFacility: FacilityType = {
		id: 'smithy',
		primary_job: 'smith',
		default_wage: 3,
		default_fund: 200,
		funding: 'facility',
		capacity: 1,
		kind: 'production',
		allowed_recipes: ['recipe-smithy-equipment'],
	};

	const serviceFacility: FacilityType = {
		id: 'tavern',
		primary_job: 'innkeeper',
		default_wage: 3,
		default_fund: 200,
		funding: 'facility',
		capacity: 1,
		kind: 'service',
		staffed_effects: { mood: 5, energy: 2, social: 3, skill_xp: 1 },
		unstaffed_effects: { mood: 1, energy: 0, social: 1, skill_xp: 0 },
		cost_per_visit: 0,
		ticks_per_visit: 20,
		restock_threshold_per_item: {},
	};

	const areaEffectFacility: FacilityType = {
		id: 'shrine',
		primary_job: 'priest',
		default_wage: 3,
		default_fund: 200,
		funding: 'facility',
		capacity: 1,
		kind: 'area_effect',
		modifier: { kind: 'mood', delta_per_tick: 1 },
		radius: 5,
		ticks_per_pulse: 30,
	};

	const knownRecipe: Recipe = {
		id: 'recipe-smithy-equipment',
		name: 'Smithy Equipment',
		inputs: [],
		outputs: [{ item_id: 'item-sword', quantity: 1 }],
		ticks_per_cycle: 10,
		required_skill: null,
		min_skill_level: 0,
	};

	it('passes when production type references an existing recipe', () => {
		expect(() => validateFacilityTypes([productionFacility], [knownRecipe])).not.toThrow();
	});

	it('throws when production type references an unknown recipe', () => {
		const orphan: FacilityType = {
			...productionFacility,
			allowed_recipes: ['recipe-missing'],
		};
		expect(() => validateFacilityTypes([orphan], [knownRecipe])).toThrow(/smithy.*recipe-missing/);
	});

	it('ignores non-production kinds', () => {
		expect(() => validateFacilityTypes([serviceFacility, areaEffectFacility], [])).not.toThrow();
	});
});
