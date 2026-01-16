import * as fs from "fs";
import * as path from "path";
import type { App } from "obsidian";
import type {
	FolderMapping,
	SyncChangeType,
	SyncResult,
	ConflictDecision,
	ReconcileStats,
} from "../types";
import { FileWatcherSettings } from "../settings/types";

/**
 * FileSyncService
 * - Sync single file (watch events)
 * - Reconcile mapping (bulk scan + sync) with performance optimizations:
 *   - throttled progress
 *   - cached ensureFolder
 *   - skip unchanged (size + mtime tolerance) on reconcile
 *   - concurrency worker pool
 *   - optional stability checks on reconcile (default OFF)
 *   - (best effort) pre-index target folder (adapter-dependent)
 */
export class FileSyncService {
	private settings: FileWatcherSettings;

	constructor(private app: App, settings: FileWatcherSettings) {
		this.settings = settings;
	}

	updateSettings(settings: FileWatcherSettings) {
		this.settings = settings;
	}

	// ===========================
	// Public: sync single file
	// ===========================
	async syncFile(
		mapping: FolderMapping,
		sourceFilePath: string,
		_changeType: SyncChangeType
	): Promise<SyncResult> {
		// for watch events we keep behavior conservative (stability check if enabled)
		return this.syncFileInternal(mapping, sourceFilePath, {
			verifyStability: this.settings.verifyFileStability === true,
			skipUnchanged: false, // watcher event should sync (conflict strategy decides)
			ensuredFolders: this.createEnsuredFolderCache(),
			targetIndex: undefined,
		});
	}

	async reconcileFolder(
		mapping: FolderMapping,
		folderAbsPath: string,
		onProgress?: (p: {
			total: number;
			scanned: number;
			processed: number;
			skipped: number;
			errors: number;
			current?: string;
		}) => void
	): Promise<ReconcileStats> {
		// Safety: folder must be inside mapping.sourceFolder
		const rel = path.relative(mapping.sourceFolder, folderAbsPath);
		if (
			rel.startsWith("..") ||
			(path.isAbsolute(rel) === false && rel.includes(":"))
		) {
			return { scanned: 0, processed: 0, skipped: 0, errors: 0 };
		}

		// We reuse reconcileMapping logic but scan only this folder subtree.
		// Easiest: temporarily call internal walk with folderAbsPath
		const stats: ReconcileStats = {
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		};

		if (!mapping.enabled) return stats;
		if (!folderAbsPath || !fs.existsSync(folderAbsPath)) return stats;

		const global = this.settings.reconcile;
		const overrides = mapping.reconcileOverrides ?? {};

		const reconcileConcurrency = this.clampNumber(
			overrides.concurrency ?? global.parallelism ?? 8,
			1,
			16
		);
		const progressThrottleMs = this.clampNumber(
			overrides.progressThrottleMs ?? global.progressThrottleMs ?? 250,
			25,
			2000
		);

		const verifyStabilityOnReconcile =
			overrides.verifyStability ??
			global.disableStabilityCheckDuringReconcile ??
			false;

		const skipUnchangedOnReconcile =
			overrides.skipUnchanged ?? global.fastSkipUnchanged ?? true;

		const all = await this.walkFiles(folderAbsPath, true);
		const files = all.filter((filePath) => {
			if (!this.isAllowedByExtension(mapping, filePath)) return false;
			if (
				this.settings.ignoreOneDriveTemp &&
				this.isOneDriveTemp(filePath)
			)
				return false;
			return true;
		});

		const total = files.length;

		const progress = this.createProgressEmitter(
			onProgress,
			progressThrottleMs
		);
		progress.emit({ total, ...stats }, true);

		const ensuredFolders = this.createEnsuredFolderCache();
		const targetIndex = await this.tryBuildTargetIndex(mapping);

		let cursor = 0;

		const worker = async () => {
			while (true) {
				const i = cursor++;
				if (i >= files.length) return;

				const filePath = files[i];
				stats.scanned++;

				const res = await this.syncFileInternal(mapping, filePath, {
					verifyStability:
						verifyStabilityOnReconcile &&
						this.settings.verifyFileStability === true,
					skipUnchanged: skipUnchangedOnReconcile,
					ensuredFolders,
					targetIndex,
				});

				if (!res.ok) stats.errors++;
				else if (res.action === "skipped") stats.skipped++;
				else stats.processed++;

				progress.emit({ total, ...stats, current: filePath });
			}
		};

		await Promise.all(Array.from({ length: reconcileConcurrency }, worker));

		progress.emit({ total, ...stats }, true);
		return stats;
	}

	// ===========================
	// Public: reconcile mapping
	// ===========================
	async reconcileMapping(
		mapping: FolderMapping,
		onProgress?: (p: {
			total: number;
			scanned: number;
			processed: number;
			skipped: number;
			errors: number;
			current?: string;
		}) => void
	): Promise<ReconcileStats> {
		const stats: ReconcileStats = {
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		};

		if (!mapping.enabled) return stats;
		if (!mapping.sourceFolder) return stats;
		if (!fs.existsSync(mapping.sourceFolder)) return stats;

		// ---- Tuning (safe defaults for 10k MD files) ----
		const reconcileConcurrency = this.clampNumber(
			(mapping as any).reconcileConcurrency ?? 4,
			1,
			8
		);
		const progressThrottleMs = this.clampNumber(
			(mapping as any).progressThrottleMs ?? 150,
			50,
			1000
		);

		// Reconcile defaults:
		// - stability checks OFF (files are usually stable at start)
		// - skipUnchanged ON (massive win)
		const verifyStabilityOnReconcile =
			(mapping as any).verifyStabilityOnReconcile ?? false;
		const skipUnchangedOnReconcile =
			(mapping as any).skipUnchangedOnReconcile ?? true;

		// ---- Scan once -> stable total ----
		const all = await this.walkFiles(
			mapping.sourceFolder,
			mapping.watchSubfolders
		);
		const files = all.filter((filePath) => {
			if (!this.isAllowedByExtension(mapping, filePath)) return false;
			if (
				this.settings.ignoreOneDriveTemp &&
				this.isOneDriveTemp(filePath)
			)
				return false;
			return true;
		});

		const total = files.length;

		// ---- Progress throttling ----
		const progress = this.createProgressEmitter(
			onProgress,
			progressThrottleMs
		);
		progress.emit({ total, ...stats }, true);

		// ---- Reconcile caches ----
		const ensuredFolders = this.createEnsuredFolderCache();
		const targetIndex = await this.tryBuildTargetIndex(mapping);

		// ---- Concurrency worker pool ----
		let cursor = 0;

		const worker = async () => {
			while (true) {
				const i = cursor++;
				if (i >= files.length) return;

				const filePath = files[i];
				stats.scanned++;
				progress.emit({ total, ...stats, current: filePath });

				const res = await this.syncFileInternal(mapping, filePath, {
					verifyStability:
						verifyStabilityOnReconcile &&
						this.settings.verifyFileStability === true,
					skipUnchanged: skipUnchangedOnReconcile,
					ensuredFolders,
					targetIndex,
				});

				if (!res.ok) {
					stats.errors++;
					progress.emit({ total, ...stats, current: filePath });
					continue;
				}

				if (res.action === "skipped") stats.skipped++;
				else stats.processed++;

				progress.emit({ total, ...stats, current: filePath });
			}
		};

		await Promise.all(Array.from({ length: reconcileConcurrency }, worker));

		progress.emit({ total, ...stats }, true);
		return stats;
	}

	// ===========================
	// Internal: core sync
	// ===========================
	private async syncFileInternal(
		mapping: FolderMapping,
		sourceFilePath: string,
		opts: {
			verifyStability: boolean;
			skipUnchanged: boolean;
			ensuredFolders: EnsuredFolderCache;
			targetIndex?: TargetIndex;
		}
	): Promise<SyncResult> {
		try {
			// Target path (vault)
			const rel = path.relative(mapping.sourceFolder, sourceFilePath);
			const targetPathRaw = path.join(mapping.targetFolder, rel);
			const targetPath = this.toVaultPath(targetPathRaw);

			// Ensure parent folder exists (cached)
			await this.ensureFolderCached(
				path.posix.dirname(targetPath),
				opts.ensuredFolders
			);

			// Optional stability check (OneDrive)
			if (opts.verifyStability) {
				const stable = await this.waitForStability(sourceFilePath);
				if (!stable) {
					return {
						ok: true,
						action: "skipped",
						targetPath,
						reason: "not_stable",
					};
				}
			}

			// Skip unchanged (reconcile)
			if (opts.skipUnchanged) {
				const same = await this.isUnchangedQuick(
					sourceFilePath,
					targetPath,
					opts.targetIndex
				);
				if (same) {
					return {
						ok: true,
						action: "skipped",
						targetPath,
						reason: "unchanged",
					};
				}
			}

			// Conflict resolution
			const targetExists = await this.existsFast(
				targetPath,
				opts.targetIndex
			);
			let finalTargetPath = targetPath;

			if (targetExists) {
				const decision = await this.resolveConflict(
					mapping,
					sourceFilePath,
					targetPath,
					opts.targetIndex
				);
				if (decision.action === "skip") {
					return {
						ok: true,
						action: "skipped",
						targetPath,
						reason: "conflict_skip",
					};
				}
				finalTargetPath = decision.targetPath;
			}

			// Read + write
			const buf = fs.readFileSync(sourceFilePath);
			const ab = buf.buffer.slice(
				buf.byteOffset,
				buf.byteOffset + buf.byteLength
			);

			await this.app.vault.adapter.writeBinary(finalTargetPath, ab);

			// Update index (best effort) so later checks get faster
			if (opts.targetIndex) {
				try {
					const srcStat = fs.statSync(sourceFilePath);
					opts.targetIndex.statByPath.set(finalTargetPath, {
						mtimeMs: srcStat.mtimeMs,
						size: srcStat.size,
					});
					opts.targetIndex.exists.add(finalTargetPath);
				} catch {
					// ignore
				}
			}

			return {
				ok: true,
				action: "processed",
				targetPath: finalTargetPath,
			};
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			return { ok: false, error: err };
		}
	}

	// ===========================
	// Target indexing (best effort)
	// ===========================
	private async tryBuildTargetIndex(
		mapping: FolderMapping
	): Promise<TargetIndex | undefined> {
		// Build an index only when reconcile is expected to be large.
		// If adapter doesn't support listing, we just skip indexing.
		const idx: TargetIndex = {
			exists: new Set<string>(),
			statByPath: new Map<string, { mtimeMs: number; size: number }>(),
		};

		// Many Obsidian adapters implement list(). If not, this will throw.
		// list() returns: { files: string[]; folders: string[] } (depending on adapter)
		try {
			const base = this.toVaultPath(mapping.targetFolder);
			const listing = await this.app.vault.adapter.list(base);

			if (!listing) return undefined;

			const files: string[] = Array.isArray(listing.files)
				? listing.files
				: [];
			for (const p of files) idx.exists.add(this.toVaultPath(p));

			// NOTE: We do NOT stat every file (can be expensive). We'll stat lazily on demand.
			return idx;
		} catch {
			return undefined;
		}
	}

	private async existsFast(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<boolean> {
		const p = this.toVaultPath(vaultPath);
		if (idx?.exists.has(p)) return true;
		return this.app.vault.adapter.exists(p);
	}

	private async statFast(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<{ mtimeMs: number; size: number } | null> {
		const p = this.toVaultPath(vaultPath);
		const cached = idx?.statByPath.get(p);
		if (cached) return cached;

		const s = await this.safeStat(p);
		if (s && idx) idx.statByPath.set(p, s);
		return s;
	}

	/**
	 * Quick "unchanged" check:
	 * - if target doesn't exist => not unchanged
	 * - if size differs => changed
	 * - if mtime is within tolerance => unchanged
	 */
	private async isUnchangedQuick(
		sourceFilePath: string,
		targetPath: string,
		idx?: TargetIndex
	): Promise<boolean> {
		const p = this.toVaultPath(targetPath);

		// Fast exists
		const exists = await this.existsFast(p, idx);
		if (!exists) return false;

		// Source stat
		let src: fs.Stats;
		try {
			src = fs.statSync(sourceFilePath);
		} catch {
			return false;
		}

		// Target stat (lazy)
		const tgt = await this.statFast(p, idx);
		if (!tgt) return false;

		if (tgt.size !== src.size) return false;

		// Vault mtime can be off slightly; tolerate.
		const MTIME_TOLERANCE_MS = 1500;
		const dt = Math.abs(tgt.mtimeMs - src.mtimeMs);
		if (dt <= MTIME_TOLERANCE_MS) return true;

		return false;
	}

	// ===========================
	// Conflicts
	// ===========================
	private async resolveConflict(
		mapping: FolderMapping,
		sourceFilePath: string,
		targetPath: string,
		idx?: TargetIndex
	): Promise<ConflictDecision> {
		const strategy = mapping.conflictResolution;

		if (strategy === "overwrite")
			return { action: "overwrite", targetPath };
		if (strategy === "skip") return { action: "skip", targetPath };

		if (strategy === "keepNewer") {
			const srcStat = fs.statSync(sourceFilePath);
			const targetStat = await this.statFast(targetPath, idx);

			// If we can't stat target, default overwrite
			if (!targetStat) return { action: "overwrite", targetPath };

			if (srcStat.mtimeMs > targetStat.mtimeMs) {
				return { action: "overwrite", targetPath };
			}
			return { action: "skip", targetPath };
		}

		// rename
		const renamed = await this.makeRenamedTarget(targetPath, idx);
		return { action: "rename", targetPath: renamed };
	}

	private async makeRenamedTarget(
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
		while (await this.existsFast(candidate, idx)) {
			candidate = `${dir}/${name} (conflict ${stamp} ${i})${ext}`.replace(
				/\/+/g,
				"/"
			);
			i++;
		}
		return candidate;
	}

	// ===========================
	// Utilities: folder ensure cache
	// ===========================
	private createEnsuredFolderCache(): EnsuredFolderCache {
		return { ensured: new Set<string>() };
	}

	private async ensureFolderCached(
		folderPath: string,
		cache: EnsuredFolderCache
	) {
		const fp = folderPath.replace(/\\/g, "/");
		if (cache.ensured.has(fp)) return;

		const parts = fp.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (cache.ensured.has(current)) continue;

			if (!(await this.app.vault.adapter.exists(current))) {
				await this.app.vault.createFolder(current);
			}
			cache.ensured.add(current);
		}

		cache.ensured.add(fp);
	}

	// ===========================
	// Utilities: walk + filters
	// ===========================
	private isAllowedByExtension(
		mapping: FolderMapping,
		filePath: string
	): boolean {
		const list = mapping.fileExtensions ?? [];
		if (list.length === 0) return true;
		const ext = path.extname(filePath).toLowerCase();
		return list.includes(ext);
	}

	private isOneDriveTemp(filePath: string): boolean {
		const name = path.basename(filePath).toLowerCase();

		if (name.startsWith("~$")) return true;
		if (name.endsWith(".tmp") || name.endsWith(".temp")) return true;
		if (name.endsWith(".swp")) return true;
		if (name === "thumbs.db") return true;
		if (name === ".ds_store") return true;

		if (name.startsWith("~") && name.includes(".") === false) return true;

		return false;
	}

	private async walkFiles(
		root: string,
		includeSubfolders: boolean
	): Promise<string[]> {
		const out: string[] = [];
		const stack: string[] = [root];

		while (stack.length) {
			const dir = stack.pop()!;
			let entries: fs.Dirent[];
			try {
				entries = fs.readdirSync(dir, { withFileTypes: true });
			} catch {
				continue;
			}

			for (const ent of entries) {
				const full = path.join(dir, ent.name);

				// ignore dotfiles/dirs
				if (ent.name.startsWith(".")) continue;

				if (ent.isDirectory()) {
					if (includeSubfolders) stack.push(full);
					continue;
				}
				if (ent.isFile()) out.push(full);
			}
		}

		return out;
	}

	// ===========================
	// Utilities: stat/stability
	// ===========================
	private async safeStat(
		vaultPath: string
	): Promise<{ mtimeMs: number; size: number } | null> {
		try {
			const s = await this.app.vault.adapter.stat(vaultPath);
			if (!s) return null;
			return { mtimeMs: s.mtime, size: s.size };
		} catch {
			return null;
		}
	}

	private async waitForStability(filePath: string): Promise<boolean> {
		const interval = Math.max(100, this.settings.stabilityCheckInterval);
		const checks = Math.max(1, this.settings.stabilityChecks);

		let lastSize = -1;
		let lastMtime = -1;
		let stableCount = 0;

		for (let i = 0; i < checks * 3; i++) {
			try {
				const st = fs.statSync(filePath);
				if (st.size === lastSize && st.mtimeMs === lastMtime) {
					stableCount++;
					if (stableCount >= checks) return true;
				} else {
					stableCount = 0;
					lastSize = st.size;
					lastMtime = st.mtimeMs;
				}
			} catch {
				stableCount = 0;
			}

			await new Promise((r) => window.setTimeout(r, interval));
		}
		return false;
	}

	// ===========================
	// Utilities: misc
	// ===========================
	private toVaultPath(p: string): string {
		return p.replace(/\\/g, "/");
	}

	private clampNumber(n: number, min: number, max: number): number {
		if (!Number.isFinite(n)) return min;
		return Math.max(min, Math.min(max, n));
	}

	private createProgressEmitter(
		onProgress: ((p: any) => void) | undefined,
		throttleMs: number
	): {
		emit: (p: any, force?: boolean) => void;
	} {
		let lastEmit = 0;
		return {
			emit: (p: any, force = false) => {
				if (!onProgress) return;
				const now = Date.now();
				if (!force && now - lastEmit < throttleMs) return;
				lastEmit = now;
				onProgress(p);
			},
		};
	}
}

// ===========================
// Internal types (no "any")
// ===========================
type EnsuredFolderCache = {
	ensured: Set<string>;
};

type TargetIndex = {
	exists: Set<string>;
	statByPath: Map<string, { mtimeMs: number; size: number }>;
};
