import type { App, TAbstractFile, TFile } from 'obsidian';
import type { VaultChange, VaultFile, VaultPort } from '../../domain/shared/vault-port.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { extractFrontmatter } from '../vault/extract-frontmatter.js';

/**
 * VaultPort implementation backed by Obsidian's native vault and metadata cache.
 * Uses metadataCache.getFileCache for frontmatter when available;
 * falls back to the line-based extractFrontmatter parser otherwise.
 */
export class ObsidianVaultAdapter implements VaultPort {
	private readonly listeners = new Set<(change: VaultChange) => void>();
	private vaultSubs: ReadonlyArray<() => void> | null = null;

	constructor(private readonly app: App) {}

	async read(path: string): Promise<Result<VaultFile, string>> {
		const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
		if (file === null) return err(`File not found: ${path}`);
		try {
			const content = await this.app.vault.read(file);
			const cached = this.app.metadataCache.getFileCache(file);
			const frontmatter: Record<string, unknown> =
				cached?.frontmatter !== undefined
					? { ...cached.frontmatter }
					: extractFrontmatter(content);
			return ok({
				path,
				content,
				frontmatter,
				stat: { size: file.stat.size, ctime: file.stat.ctime, mtime: file.stat.mtime },
			});
		} catch (e) {
			return err(e instanceof Error ? e.message : String(e));
		}
	}

	async create(path: string, content: string): Promise<Result<void, string>> {
		try {
			await this.app.vault.create(path, content);
			return ok(undefined);
		} catch (e) {
			return err(e instanceof Error ? e.message : String(e));
		}
	}

	async update(path: string, content: string): Promise<Result<void, string>> {
		const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
		if (file === null) return err(`File not found: ${path}`);
		try {
			await this.app.vault.modify(file, content);
			return ok(undefined);
		} catch (e) {
			return err(e instanceof Error ? e.message : String(e));
		}
	}

	async delete(path: string): Promise<Result<void, string>> {
		const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
		if (file === null) return err(`File not found: ${path}`);
		try {
			await this.app.vault.delete(file);
			return ok(undefined);
		} catch (e) {
			return err(e instanceof Error ? e.message : String(e));
		}
	}

	exists(path: string): Promise<boolean> {
		return Promise.resolve(this.app.vault.getAbstractFileByPath(path) !== null);
	}

	list(folder: string): Promise<Result<string[], string>> {
		const files = this.app.vault.getFiles();
		// Root (empty folder) matches all; otherwise require a trailing slash
		// boundary so `"notes"` doesn't match `"notes-archive/foo.md"`.
		const prefix = folder === '' || folder.endsWith('/') ? folder : `${folder}/`;
		const paths = files.map((f) => f.path);
		return Promise.resolve(ok(prefix === '' ? paths : paths.filter((p) => p.startsWith(prefix))));
	}

	watch(listener: (change: VaultChange) => void): Unsubscribe {
		if (this.vaultSubs === null) this.attachVaultEvents();
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	/** Detach from Obsidian vault events.  Called by PluginCore at shutdown. */
	detach(): void {
		if (this.vaultSubs === null) return;
		for (const unsub of this.vaultSubs) unsub();
		this.vaultSubs = null;
		this.listeners.clear();
	}

	private attachVaultEvents(): void {
		const vault = this.app.vault;
		type EventRef = ReturnType<typeof vault.on>;
		const makeUnsub = (ref: EventRef): (() => void) => () => { vault.offref(ref); };
		this.vaultSubs = [
			makeUnsub(vault.on('create', (file: TAbstractFile) => { this.emit({ kind: 'create', path: file.path, at: Date.now() }); })),
			makeUnsub(vault.on('modify', (file: TAbstractFile) => { this.emit({ kind: 'modify', path: file.path, at: Date.now() }); })),
			makeUnsub(vault.on('delete', (file: TAbstractFile) => { this.emit({ kind: 'delete', path: file.path, at: Date.now() }); })),
			makeUnsub(vault.on('rename', (file: TAbstractFile, oldPath: string) => { this.emit({ kind: 'rename', path: file.path, oldPath, at: Date.now() }); })),
		];
	}

	private emit(change: VaultChange): void {
		for (const l of this.listeners) l(change);
	}
}
