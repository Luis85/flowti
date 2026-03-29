import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { TraitDefinitionSchema } from '../../domain/schemas/trait-definition-schema.js';
import type { TraitDefinition } from '../../domain/systems/trait-resolver.js';
import type { LoadResult } from './location-loader.js';

export function createTraitLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<TraitDefinition>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<TraitDefinition>> {
			const items: TraitDefinition[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);

			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					const data = TraitDefinitionSchema.parse(parsed);
					items.push({
						id: data.id,
						effects: data.effects.map(e => ({
							system: e.system,
							modifier: e.modifier,
						})),
						conflicts_with: data.conflicts_with,
					});
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('TraitLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}

			logger.info('TraitLoader', `Loaded ${String(items.length)} trait definitions, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
