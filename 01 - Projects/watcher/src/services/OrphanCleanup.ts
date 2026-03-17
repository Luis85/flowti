/**
 * Orphan cleanup logic for reconciliation.
 *
 * Removes vault files that no longer have a corresponding source file.
 * Extracted from FileSyncService to reduce its size and isolate
 * the cleanup concern.
 *
 * @module OrphanCleanup
 */

import type { App } from "obsidian";
import type { FolderMapping } from "../types";
import { toVaultPath, isAllowedByExtensions, isPathExcluded } from "../utils";
import { LogService } from "./LogService";

export class OrphanCleanup {
	constructor(private app: App) {}

	/**
	 * Removes vault files that no longer have a corresponding source file.
	 * Called during reconciliation when deletionHandling is enabled.
	 */
	async cleanupOrphans(
		mapping: FolderMapping,
		existingSourcePaths: Set<string>
	): Promise<{ deleted: number; errors: number }> {
		let deleted = 0;
		let errors = 0;

		const targetBase = toVaultPath(mapping.targetFolder);
		const vaultFiles = await this.walkVaultFiles(targetBase);

		for (const vaultFilePath of vaultFiles) {
			const normalizedVaultPath = toVaultPath(vaultFilePath);

			// Calculate relative path from target folder
			const prefix = targetBase.endsWith("/")
				? targetBase
				: targetBase + "/";
			if (!normalizedVaultPath.startsWith(prefix)) continue;
			const relativePath = normalizedVaultPath.slice(prefix.length);
			if (!relativePath) continue;

			// Check extension filter
			if (
				!isAllowedByExtensions(
					relativePath,
					mapping.fileExtensions ?? []
				)
			)
				continue;

			// Check exclusion patterns
			if (isPathExcluded(relativePath, mapping.excludePatterns ?? []))
				continue;

			// Check if source has this file (both sets use forward-slash normalized paths)
			if (existingSourcePaths.has(relativePath)) continue;

			// This is an orphan — trash it
			try {
				const tFile =
					this.app.vault.getAbstractFileByPath(normalizedVaultPath);
				if (tFile) {
					await this.app.vault.trash(tFile, true);
					deleted++;
					LogService.debug("Reconcile", `Orphan trashed`, {
						mappingId: mapping.id,
						filePath: normalizedVaultPath,
					});
				}
			} catch (e) {
				errors++;
				LogService.warn(
					"Reconcile",
					`Failed to trash orphan: ${String(e)}`,
					{
						mappingId: mapping.id,
						filePath: normalizedVaultPath,
					}
				);
			}
		}

		return { deleted, errors };
	}

	/**
	 * Recursively lists all files in a vault folder using Obsidian's adapter.
	 */
	private async walkVaultFiles(basePath: string): Promise<string[]> {
		const out: string[] = [];
		const stack: string[] = [basePath];

		while (stack.length > 0) {
			const dir = stack.pop()!;
			try {
				const listing = await this.app.vault.adapter.list(dir);
				if (listing?.files) {
					out.push(...listing.files);
				}
				if (listing?.folders) {
					stack.push(...listing.folders);
				}
			} catch {
				continue;
			}
		}

		return out;
	}
}
