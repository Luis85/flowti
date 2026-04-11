import { describe, it, expect, vi } from 'vitest';
import { createRecipeLoader } from '../../../src/infrastructure/entity/recipe-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const validRecipe = {
	id: 'recipe-farm-wheat',
	name: 'Farm Wheat',
	outputs: [{ item_id: 'item-wheat', quantity: 2 }],
	ticks_per_cycle: 10,
};

const recipeWithInputs = {
	id: 'recipe-bake-bread',
	name: 'Bake Bread',
	inputs: [{ item_id: 'item-wheat', quantity: 2 }],
	outputs: [{ item_id: 'item-bread', quantity: 1 }],
	ticks_per_cycle: 5,
	required_skill: 'cooking',
	min_skill_level: 1,
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

describe('RecipeLoader', () => {
	it('loads valid recipe files', async () => {
		const vault = createMockVault({
			'recipes/farm-wheat.json': JSON.stringify(validRecipe),
			'recipes/bake-bread.json': JSON.stringify(recipeWithInputs),
		});
		const loader = createRecipeLoader(logger);
		const result = await loader.loadFromVault(vault, 'recipes/');
		expect(result.items).toHaveLength(2);
		expect(result.errors).toHaveLength(0);
		const ids = result.items.map(r => r.id);
		expect(ids).toContain('recipe-farm-wheat');
		expect(ids).toContain('recipe-bake-bread');
	});

	it('parses recipe with inputs correctly', async () => {
		const vault = createMockVault({
			'recipes/bake-bread.json': JSON.stringify(recipeWithInputs),
		});
		const loader = createRecipeLoader(logger);
		const result = await loader.loadFromVault(vault, 'recipes/');
		expect(result.items).toHaveLength(1);
		const recipe = result.items[0];
		expect(recipe?.inputs).toHaveLength(1);
		expect(recipe?.inputs[0]?.item_id).toBe('item-wheat');
		expect(recipe?.required_skill).toBe('cooking');
	});

	it('collects schema failure in errors', async () => {
		const invalidRecipe = { id: 'recipe-broken', name: 'Broken', ticks_per_cycle: 5 };
		const vault = createMockVault({
			'recipes/broken.json': JSON.stringify(invalidRecipe),
		});
		const loader = createRecipeLoader(logger);
		const result = await loader.loadFromVault(vault, 'recipes/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('recipes/broken.json');
	});

	it('collects duplicate id as error', async () => {
		const vault = createMockVault({
			'recipes/a.json': JSON.stringify(validRecipe),
			'recipes/b.json': JSON.stringify(validRecipe),
		});
		const loader = createRecipeLoader(logger);
		const result = await loader.loadFromVault(vault, 'recipes/');
		expect(result.items).toHaveLength(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.message).toContain('Duplicate recipe id recipe-farm-wheat');
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const loader = createRecipeLoader(logger);
		const result = await loader.loadFromVault(vault, 'recipes/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
