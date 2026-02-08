/**
 * Shared worker pool for reconcile operations.
 *
 * Both `reconcileMapping` and `reconcileFolder` in FileSyncService use the same
 * concurrent worker pool pattern. This module extracts that pattern into a
 * reusable function to eliminate duplication.
 *
 * @module ReconcileWorkerPool
 */

import * as fsp from "fs/promises";
import { AsyncMutex } from "./AsyncMutex";
import type { FolderMapping, ReconcileStats, SyncResult } from "../types";
import type { SyncStateService } from "./SyncStateService";
import type {
	ReconcileMappingProgress,
	ReconcileFileEntry,
	SyncInternalOpts,
} from "./types";

export interface ReconcileWorkerPoolConfig {
	/** Files to process (pre-filtered) */
	filesToProcess: ReconcileFileEntry[];
	/** Number of files already skipped during pre-filtering (added to total) */
	initialSkipped: number;
	/** The folder mapping being reconciled */
	mapping: FolderMapping;
	/** Number of concurrent workers */
	concurrency: number;
	/** Minimum ms between progress callback invocations */
	progressThrottleMs: number;
	/** Progress callback */
	onProgress?: (p: ReconcileMappingProgress) => void;
	/** The sync function to call for each file */
	syncFile: (mapping: FolderMapping, filePath: string, opts: SyncInternalOpts) => Promise<SyncResult>;
	/** Options passed through to the sync function */
	syncOpts: SyncInternalOpts;
	/** Optional sync state service for recording successful syncs */
	syncState?: SyncStateService;
}

/**
 * Runs a concurrent worker pool that processes files through a sync function,
 * accumulates stats, and reports throttled progress.
 *
 * @returns The accumulated reconcile stats (scanned, processed, skipped, errors, deleted).
 */
export async function runReconcileWorkerPool(
	config: ReconcileWorkerPoolConfig
): Promise<ReconcileStats> {
	const {
		filesToProcess,
		initialSkipped,
		mapping,
		concurrency,
		progressThrottleMs,
		onProgress,
		syncFile,
		syncOpts,
		syncState,
	} = config;

	const stats: ReconcileStats = {
		scanned: 0,
		processed: 0,
		skipped: initialSkipped,
		errors: 0,
		deleted: 0,
	};

	const total = filesToProcess.length + initialSkipped;

	// Progress throttling
	let lastEmit = 0;
	const emitProgress = (current?: string, force = false) => {
		if (!onProgress) return;
		const now = Date.now();
		if (!force && now - lastEmit < progressThrottleMs) return;
		lastEmit = now;
		onProgress({ total, ...stats, current });
	};

	emitProgress(undefined, true);

	// Atomic cursor for concurrent workers
	const cursor = { value: 0 };
	const cursorLock = new AsyncMutex();

	const getNextIndex = async (): Promise<number> => {
		const release = await cursorLock.acquire();
		try {
			return cursor.value++;
		} finally {
			release();
		}
	};

	const worker = async () => {
		while (true) {
			const i = await getNextIndex();
			if (i >= filesToProcess.length) return;

			const { filePath, relativePath, stat } = filesToProcess[i];
			stats.scanned++;
			emitProgress(filePath);

			const res = await syncFile(mapping, filePath, syncOpts);

			if (!res.ok) {
				stats.errors++;
				emitProgress(filePath);
				continue;
			}

			if (res.action === "skipped") {
				stats.skipped++;
			} else {
				stats.processed++;

				// Record successful sync in state
				if (syncState) {
					try {
						const fileStat = stat ?? await fsp.stat(filePath);
						syncState.recordSync(
							mapping.id,
							mapping.sourceFolder,
							relativePath,
							{ mtimeMs: fileStat.mtimeMs, size: fileStat.size }
						);
					} catch {
						// Ignore stat errors
					}
				}
			}

			emitProgress(filePath);
		}
	};

	await Promise.all(Array.from({ length: concurrency }, worker));

	emitProgress(undefined, true);
	return stats;
}
