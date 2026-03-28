import type { z } from 'zod';
import type { VaultAdapter } from '../../domain/core/platform.js';
import type { Logger } from '../../domain/core/logger.js';
import { createVaultLoader } from './vault-loader.js';

export interface DirectoryLoadResult<T> {
	loaded: T[];
	quarantined: string[];
}

export interface VaultDirectoryLoader {
	loadDirectory<T>(directory: string, schema: z.ZodType<T>): Promise<DirectoryLoadResult<T>>;
}

export function createVaultDirectoryLoader(
	adapter: VaultAdapter,
	logger?: Logger,
): VaultDirectoryLoader {
	const entityLoader = createVaultLoader();

	return {
		async loadDirectory<T>(directory: string, schema: z.ZodType<T>): Promise<DirectoryLoadResult<T>> {
			const files = await adapter.listFiles(directory);
			const loaded: T[] = [];
			const quarantined: string[] = [];

			for (const filePath of files) {
				const readResult = await adapter.readFile(filePath);
				if (!readResult.ok) {
					quarantined.push(filePath);
					logger?.warn('VaultSync', `Could not read ${filePath}: ${readResult.error.message}`);
					continue;
				}

				const validateResult = entityLoader.loadEntity(readResult.value, schema, filePath);
				if (!validateResult.ok) {
					quarantined.push(filePath);
					logger?.warn('VaultSync', `Invalid file ${filePath}: ${validateResult.error.message}`);
					continue;
				}

				loaded.push(validateResult.value);
			}

			logger?.info('VaultSync', `Loaded ${loaded.length} entities from ${directory}, quarantined ${quarantined.length}`);
			return { loaded, quarantined };
		},
	};
}
