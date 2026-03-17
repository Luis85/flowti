/**
 * Conflict resolution logic for file sync operations.
 *
 * Extracted from FileSyncService to reduce its size and isolate
 * the conflict resolution concern.
 *
 * @module ConflictResolver
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { App } from "obsidian";
import type { FolderMapping, ConflictDecision } from "../types";
import type { TargetIndex } from "./types";
import { toVaultPath } from "../utils";

export class ConflictResolver {
	constructor(private app: App) {}

	/**
	 * Resolves a conflict for forward sync (source → vault).
	 */
	async resolveForward(
		mapping: FolderMapping,
		sourceFilePath: string,
		targetPath: string,
		targetIndex?: TargetIndex
	): Promise<ConflictDecision> {
		const strategy = mapping.conflictResolution;

		if (strategy === "overwrite")
			return { action: "overwrite", targetPath };
		if (strategy === "skip") return { action: "skip", targetPath };

		if (strategy === "keepNewer") {
			const srcStat = await fsp.stat(sourceFilePath);
			const targetStat = await this.vaultStatFast(targetPath, targetIndex);

			// If we can't stat target, default overwrite
			if (!targetStat) return { action: "overwrite", targetPath };

			if (srcStat.mtimeMs > targetStat.mtimeMs) {
				return { action: "overwrite", targetPath };
			}
			return { action: "skip", targetPath };
		}

		// rename
		const renamed = await this.makeRenamedVaultPath(targetPath, targetIndex);
		return { action: "rename", targetPath: renamed };
	}

	/**
	 * Resolves a conflict for reverse sync (vault → source).
	 * Uses reverseConflictResolution if set, otherwise falls back to conflictResolution.
	 */
	async resolveReverse(
		mapping: FolderMapping,
		vaultFilePath: string,
		externalPath: string
	): Promise<ConflictDecision> {
		const strategy =
			mapping.reverseConflictResolution ?? mapping.conflictResolution;

		if (strategy === "overwrite") {
			return { action: "overwrite", targetPath: externalPath };
		}
		if (strategy === "skip") {
			return { action: "skip", targetPath: externalPath };
		}

		if (strategy === "keepNewer") {
			const vaultStat = await this.app.vault.adapter.stat(
				toVaultPath(vaultFilePath)
			);
			let externalStat: fs.Stats | null = null;
			try {
				externalStat = await fsp.stat(externalPath);
			} catch {
				// External doesn't exist, overwrite
				return { action: "overwrite", targetPath: externalPath };
			}

			if (!vaultStat) {
				return { action: "skip", targetPath: externalPath };
			}

			if (vaultStat.mtime > externalStat.mtimeMs) {
				return { action: "overwrite", targetPath: externalPath };
			}
			return { action: "skip", targetPath: externalPath };
		}

		// rename - create unique filename
		const renamed = await this.makeRenamedExternalPath(externalPath);
		return { action: "rename", targetPath: renamed };
	}

	// ===========================
	// Renamed path generation
	// ===========================

	private async makeRenamedVaultPath(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<string> {
		const dir = path.posix.dirname(vaultPath);
		const base = path.posix.basename(vaultPath);
		const ext = path.posix.extname(base);
		const name = base.slice(0, base.length - ext.length);

		const stamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.replace("T", " ")
			.slice(0, 19);

		let candidate = `${dir}/${name} (conflict ${stamp})${ext}`.replace(
			/\/+/g,
			"/"
		);

		let i = 2;
		const MAX_ATTEMPTS = 1000;
		while (i <= MAX_ATTEMPTS && (await this.vaultExistsFast(candidate, idx))) {
			candidate = `${dir}/${name} (conflict ${stamp} ${i})${ext}`.replace(
				/\/+/g,
				"/"
			);
			i++;
		}
		if (i > MAX_ATTEMPTS) {
			throw new Error(
				`Could not find unique conflict filename after ${MAX_ATTEMPTS} attempts: ${candidate}`
			);
		}
		return candidate;
	}

	private async makeRenamedExternalPath(
		externalPath: string
	): Promise<string> {
		const dir = path.dirname(externalPath);
		const base = path.basename(externalPath);
		const ext = path.extname(base);
		const name = base.slice(0, base.length - ext.length);

		const stamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.replace("T", " ")
			.slice(0, 19);

		let candidate = path.join(dir, `${name} (conflict ${stamp})${ext}`);

		let i = 2;
		const MAX_ATTEMPTS = 1000;
		while (i <= MAX_ATTEMPTS) {
			try {
				await fsp.access(candidate);
				// File exists, try next
				candidate = path.join(
					dir,
					`${name} (conflict ${stamp} ${i})${ext}`
				);
				i++;
			} catch {
				// File doesn't exist, use this path
				break;
			}
		}
		if (i > MAX_ATTEMPTS) {
			throw new Error(
				`Could not find unique conflict filename after ${MAX_ATTEMPTS} attempts: ${candidate}`
			);
		}
		return candidate;
	}

	// ===========================
	// Vault helpers
	// ===========================

	private async vaultExistsFast(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<boolean> {
		const p = toVaultPath(vaultPath);
		if (idx?.exists.has(p)) return true;
		return this.app.vault.adapter.exists(p);
	}

	private async vaultStatFast(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<{ mtimeMs: number; size: number } | null> {
		const p = toVaultPath(vaultPath);
		const cached = idx?.statByPath.get(p);
		if (cached) return cached;

		try {
			const s = await this.app.vault.adapter.stat(p);
			if (!s) return null;
			return { mtimeMs: s.mtime, size: s.size };
		} catch {
			return null;
		}
	}
}
