import type { App, TFile } from 'obsidian';
import type { VaultFile, VaultPort } from '../../domain/shared/vault-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { extractFrontmatter } from '../vault/extract-frontmatter.js';

/**
 * VaultPort implementation backed by Obsidian's native vault and metadata cache.
 * Uses metadataCache.getFileCache for frontmatter when available;
 * falls back to the line-based extractFrontmatter parser otherwise.
 */
export class ObsidianVaultAdapter implements VaultPort {
	constructor(private readonly app: App) {}

	async read(path: string): Promise<Result<VaultFile, string>> {
		const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
		if (file === null) return err(`File not found: ${path}`);
		try {
			const content = await this.app.vault.read(file);
			const cached = this.app.metadataCache.getFileCache(file);
			const frontmatter: Record<string, unknown> =
				cached?.frontmatter !== undefined && cached.frontmatter !== null
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

	async exists(path: string): Promise<boolean> {
		return this.app.vault.getAbstractFileByPath(path) !== null;
	}

	async list(folder: string): Promise<Result<string[], string>> {
		const files = this.app.vault.getFiles();
		return ok(files.map((f) => f.path).filter((p) => p.startsWith(folder)));
	}
}
