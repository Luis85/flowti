import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { BehaviorTreeSchema, type BehaviorTree } from '../../domain/schemas/behavior-tree-schema.js';
import type { LoadResult } from './location-loader.js';

export function createBTLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<BehaviorTree>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<BehaviorTree>> {
			const items: BehaviorTree[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);
			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					items.push(BehaviorTreeSchema.parse(parsed));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('BTLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}
			logger.info('BTLoader', `Loaded ${String(items.length)} behavior trees, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
