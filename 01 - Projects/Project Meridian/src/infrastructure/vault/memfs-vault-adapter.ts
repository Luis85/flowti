import { Result } from '../../domain/core/result.js';
import type { ResultValue } from '../../domain/core/result.js';
import type { VaultAdapter } from '../../domain/core/platform.js';

export function createMemfsVaultAdapter(files: Record<string, string>): VaultAdapter {
	const store = new Map(Object.entries(files));

	return {
		readFile(path: string): Promise<ResultValue<string>> {
			const content = store.get(path);
			if (content === undefined) {
				return Promise.resolve(Result.err({
					code: 'FILE_NOT_FOUND',
					message: `File not found: ${path}`,
					system: 'VaultAdapter',
					recoverable: true,
				}));
			}
			return Promise.resolve(Result.ok(content));
		},

		writeFile(path: string, content: string): Promise<ResultValue<void>> {
			store.set(path, content);
			return Promise.resolve(Result.ok(undefined));
		},

		deleteFile(path: string): Promise<ResultValue<void>> {
			store.delete(path);
			return Promise.resolve(Result.ok(undefined));
		},

		listFiles(directory: string): Promise<string[]> {
			return Promise.resolve([...store.keys()].filter((key) => key.startsWith(directory)));
		},

		exists(path: string): Promise<boolean> {
			return Promise.resolve(store.has(path));
		},
	};
}
