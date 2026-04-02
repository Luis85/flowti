import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { ItemSchema, type Item } from '../../domain/schemas/item-schema.js';
import type { LoadResult } from './location-loader.js';

export function createItemLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<Item>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<Item>> {
			const items: Item[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);
			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					items.push(ItemSchema.parse(parsed));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('ItemLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}
			logger.info('ItemLoader', `Loaded ${String(items.length)} items, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
