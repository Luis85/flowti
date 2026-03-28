import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { LocationSchema, type WorldLocation } from '../../domain/schemas/location-schema.js';

export interface LoadResult<T> {
	items: T[];
	errors: { file: string; message: string }[];
}

export function createLocationLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<WorldLocation>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<WorldLocation>> {
			const items: WorldLocation[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);
			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					items.push(LocationSchema.parse(parsed));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('LocationLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}
			logger.info('LocationLoader', `Loaded ${String(items.length)} locations, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
