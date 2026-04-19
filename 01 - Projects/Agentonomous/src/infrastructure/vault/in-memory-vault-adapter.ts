import type { VaultChange, VaultFile, VaultPort } from '../../domain/shared/vault-port.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { extractFrontmatter } from './extract-frontmatter.js';

type StoredFile = { content: string; ctime: number; mtime: number };

/**
 * In-memory VaultPort implementation.
 * Useful for tests and non-Obsidian environments (e.g. Storybook, web harness).
 * Holds files in a Map — nothing is persisted to disk, localStorage, or IndexedDB.
 *
 * Emits VaultChange events on create/update/delete so `watch` subscribers
 * see changes from the same adapter's mutating methods.
 */
export class InMemoryVaultAdapter implements VaultPort {
	private readonly files = new Map<string, StoredFile>();
	private readonly listeners = new Set<(change: VaultChange) => void>();

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
		this.emit({ kind: 'create', path, at: Date.now() });
		return Promise.resolve(ok(undefined));
	}

	update(path: string, content: string): Promise<Result<void, string>> {
		const f = this.files.get(path);
		if (f === undefined) return Promise.resolve(err(`File not found: ${path}`));
		this.files.set(path, { ...f, content, mtime: Date.now() });
		this.emit({ kind: 'modify', path, at: Date.now() });
		return Promise.resolve(ok(undefined));
	}

	delete(path: string): Promise<Result<void, string>> {
		const existed = this.files.delete(path);
		if (existed) this.emit({ kind: 'delete', path, at: Date.now() });
		return Promise.resolve(ok(undefined));
	}

	rename(oldPath: string, newPath: string): Promise<Result<void, string>> {
		const entry = this.files.get(oldPath);
		if (entry === undefined) return Promise.resolve(err(`not-found: ${oldPath}`));
		if (this.files.has(newPath)) return Promise.resolve(err(`target-exists: ${newPath}`));
		this.files.set(newPath, entry);
		this.files.delete(oldPath);
		this.emit({ kind: 'rename', path: newPath, oldPath, at: Date.now() });
		return Promise.resolve(ok(undefined));
	}

	exists(path: string): Promise<boolean> {
		return Promise.resolve(this.files.has(path));
	}

	list(folder: string): Promise<Result<string[], string>> {
		const prefix = folder === '' || folder.endsWith('/') ? folder : `${folder}/`;
		const paths = [...this.files.keys()];
		return Promise.resolve(ok(prefix === '' ? paths : paths.filter((p) => p.startsWith(prefix))));
	}

	watch(listener: (change: VaultChange) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	private emit(change: VaultChange): void {
		for (const l of this.listeners) l(change);
	}
}
