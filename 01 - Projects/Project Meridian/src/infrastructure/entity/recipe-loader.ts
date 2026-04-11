import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { RecipeSchema, type Recipe } from '../../domain/schemas/recipe-schema.js';
import type { LoadResult } from './location-loader.js';

export function createRecipeLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<Recipe>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<Recipe>> {
			const items: Recipe[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);
			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					const recipe = RecipeSchema.parse(parsed);
					if (items.some(r => r.id === recipe.id)) {
						throw new Error(`Duplicate recipe id ${recipe.id}`);
					}
					items.push(recipe);
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('RecipeLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}
			logger.info('RecipeLoader', `Loaded ${String(items.length)} recipes, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
