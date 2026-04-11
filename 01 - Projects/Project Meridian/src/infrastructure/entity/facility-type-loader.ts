import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { FacilityTypeSchema, type FacilityType } from '../../domain/schemas/facility-type-schema.js';
import type { Recipe } from '../../domain/schemas/recipe-schema.js';
import type { LoadResult } from './location-loader.js';

export function createFacilityTypeLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<FacilityType>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<FacilityType>> {
			const items: FacilityType[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);
			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					const facilityType = FacilityTypeSchema.parse(parsed);
					if (items.some(t => t.id === facilityType.id)) {
						throw new Error(`Duplicate facility type id ${facilityType.id}`);
					}
					items.push(facilityType);
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('FacilityTypeLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}
			logger.info('FacilityTypeLoader', `Loaded ${String(items.length)} facility types, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}

/**
 * Cross-reference check: every allowed_recipes entry on a production kind
 * must exist in the supplied recipe collection. Throws on first missing reference.
 */
export function validateFacilityTypes(
	types: ReadonlyArray<FacilityType>,
	recipes: ReadonlyArray<Recipe>,
): void {
	const recipeIds = new Set(recipes.map(r => r.id));
	for (const type of types) {
		if (type.kind !== 'production') continue;
		for (const recipeId of type.allowed_recipes) {
			if (!recipeIds.has(recipeId)) {
				throw new Error(`Facility type '${type.id}' references unknown recipe '${recipeId}'`);
			}
		}
	}
}
