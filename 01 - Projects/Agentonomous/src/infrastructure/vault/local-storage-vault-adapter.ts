import type { VaultFile, VaultPort } from '../../domain/shared/vault-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { extractFrontmatter } from './extract-frontmatter.js';

type StoredFile = { content: string; ctime: number; mtime: number };

/**
 * In-memory VaultPort implementation.
 * Useful for tests and non-Obsidian environments (e.g. Storybook, web harness).
 * Does NOT persist to localStorage — the name reflects its role as a lightweight
 * non-Obsidian backend (no filesystem, no IndexedDB).
 */
export class LocalStorageVaultAdapter implements VaultPort {
	private readonly files = new Map<string, StoredFile>();

	async read(path: string): Promise<Result<VaultFile, string>> {
		const f = this.files.get(path);
		if (f === undefined) return err(`File not found: ${path}`);
		return ok({
			path,
			content: f.content,
			frontmatter: extractFrontmatter(f.content),
			stat: { size: f.content.length, ctime: f.ctime, mtime: f.mtime },
		});
	}

	async create(path: string, content: string): Promise<Result<void, string>> {
		if (this.files.has(path)) return err(`File already exists: ${path}`);
		this.files.set(path, { content, ctime: Date.now(), mtime: Date.now() });
		return ok(undefined);
	}

	async update(path: string, content: string): Promise<Result<void, string>> {
		const f = this.files.get(path);
		if (f === undefined) return err(`File not found: ${path}`);
		this.files.set(path, { ...f, content, mtime: Date.now() });
		return ok(undefined);
	}

	async delete(path: string): Promise<Result<void, string>> {
		this.files.delete(path);
		return ok(undefined);
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async list(folder: string): Promise<Result<string[], string>> {
		return ok([...this.files.keys()].filter((k) => k.startsWith(folder)));
	}
}
