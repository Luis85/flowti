import type { VaultFile, VaultPort } from '../../domain/shared/vault-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { extractFrontmatter } from './extract-frontmatter.js';

type StoredFile = { content: string; ctime: number; mtime: number };

/**
 * In-memory VaultPort implementation.
 * Useful for tests and non-Obsidian environments (e.g. Storybook, web harness).
 * Holds files in a Map — nothing is persisted to disk, localStorage, or IndexedDB.
 */
export class InMemoryVaultAdapter implements VaultPort {
	private readonly files = new Map<string, StoredFile>();

	read(path: string): Promise<Result<VaultFile, string>> {
		const f = this.files.get(path);
		if (f === undefined) return Promise.resolve(err(`File not found: ${path}`));
		return Promise.resolve(ok({
			path,
			content: f.content,
			frontmatter: extractFrontmatter(f.content),
			stat: { size: f.content.length, ctime: f.ctime, mtime: f.mtime },
		}));
	}

	create(path: string, content: string): Promise<Result<void, string>> {
		if (this.files.has(path)) return Promise.resolve(err(`File already exists: ${path}`));
		this.files.set(path, { content, ctime: Date.now(), mtime: Date.now() });
		return Promise.resolve(ok(undefined));
	}

	update(path: string, content: string): Promise<Result<void, string>> {
		const f = this.files.get(path);
		if (f === undefined) return Promise.resolve(err(`File not found: ${path}`));
		this.files.set(path, { ...f, content, mtime: Date.now() });
		return Promise.resolve(ok(undefined));
	}

	delete(path: string): Promise<Result<void, string>> {
		this.files.delete(path);
		return Promise.resolve(ok(undefined));
	}

	exists(path: string): Promise<boolean> {
		return Promise.resolve(this.files.has(path));
	}

	list(folder: string): Promise<Result<string[], string>> {
		return Promise.resolve(ok([...this.files.keys()].filter((k) => k.startsWith(folder))));
	}
}
