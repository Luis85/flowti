import type {
	FolderMapping,
	ReconcileProgress,
	ReconcileStats,
} from "src/types";
import { getMappingLabel } from "src/utils";
import { ReconcileCallbacks, IFileSyncService, ReconcileMappingProgress, IReconcileContext } from "./types";
import { LogService } from "./LogService";
import type { INoticeService } from "./NoticeService";
import { createNoOpNoticeService } from "./NoticeService";

/**
 * Orchestrates bulk reconciliation operations across folder mappings.
 *
 * @remarks
 * The ReconcileService manages the high-level reconciliation workflow:
 * - Coordinates multiple folder mappings sequentially
 * - Provides progress tracking and cancellation support
 * - Acquires exclusive locks to prevent conflicts with watchers
 * - Updates UI components (status bar, dashboard) with progress
 *
 * Reconciliation is a bulk sync operation that scans source folders and
 * ensures all files are synchronized to the vault. It differs from watcher
 * sync in that it processes all files, not just changed ones.
 *
 * @example
 * ```typescript
 * const reconcile = new ReconcileService(ctx, fileSync, noticeService);
 *
 * // Reconcile on startup (if enabled in settings)
 * await reconcile.reconcileOnStart();
 *
 * // Manual reconcile of all mappings
 * await reconcile.reconcileAll();
 *
 * // Reconcile single mapping
 * await reconcile.reconcileSingleMapping('mapping-id-123');
 *
 * // Cancel running reconciliation
 * reconcile.cancel();
 * ```
 *
 * @category Services
 */
export class ReconcileService {
	private running = false;
	private cancelled = false;
	private notice: INoticeService;

	/**
	 * Creates a new ReconcileService instance.
	 *
	 * @param ctx - Context providing settings, stats, and UI access
	 * @param fileSync - The file sync service for actual file operations
	 * @param notice - Optional notice service for user notifications
	 */
	constructor(
		private ctx: IReconcileContext,
		private fileSync: IFileSyncService,
		notice?: INoticeService
	) {
		this.notice = notice ?? createNoOpNoticeService();
	}

	/**
	 * Checks if a reconciliation is currently in progress.
	 * @returns `true` if reconciliation is running
	 */
	isRunning() {
		return this.running;
	}

	/**
	 * Requests cancellation of the current reconciliation.
	 *
	 * @remarks
	 * Cancellation is cooperative - the current file will complete processing
	 * before the reconciliation stops. Progress will show "cancelled" phase.
	 */
	cancel() {
		this.cancelled = true;
	}

	/**
	 * Performs reconciliation on plugin startup if enabled in settings.
	 *
	 * @remarks
	 * Called automatically during plugin initialization. Only reconciles
	 * mappings that have both `enabled` and `reconcileOnStart` set to true.
	 */
	async reconcileOnStart(): Promise<void> {
		const settings = this.ctx.settings;
		const syncOnStart = settings.syncOnStart ?? true;
		if (!syncOnStart) return;

		const mappings = settings.folderMappings.filter(
			(m) => m.enabled && m.reconcileOnStart !== false
		);
		if (mappings.length === 0) return;

		LogService.info("Reconcile", "Starting reconcile on startup", {
			details: { mappingCount: mappings.length },
		});

		await this.reconcileMappings(mappings, {
			onProgress: (p, meta) => this.defaultProgressToUi(p, meta),
			onMappingDone: (m, stats) => this.defaultDoneNotice(m, stats),
		});
	}

	/**
	 * Reconciles multiple folder mappings sequentially.
	 *
	 * @remarks
	 * This is the core reconciliation method. It:
	 * 1. Acquires an exclusive operation lock (blocks watchers)
	 * 2. Processes each mapping in sequence
	 * 3. Reports progress via callbacks
	 * 4. Updates stats and UI after each mapping
	 * 5. Releases the lock when done
	 *
	 * Only one reconciliation can run at a time. If already running, this
	 * method returns immediately without action.
	 *
	 * @param mappings - Array of folder mappings to reconcile
	 * @param cb - Callbacks for progress and completion notifications
	 */
	async reconcileMappings(
		mappings: FolderMapping[],
		cb: ReconcileCallbacks
	): Promise<void> {
		if (this.running) return;
		this.running = true;
		this.cancelled = false;

		const mappingTotal = mappings.length;
		let mappingIndex = 0;

		// Acquire exclusive reconcile lock - blocks watcher syncs
		LogService.debug("Reconcile", "Acquiring operation lock for reconciliation");
		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.fileSync.getOperationLock().acquireReconcile();
			LogService.debug("Reconcile", "Operation lock acquired");
		} catch (e) {
			LogService.error("Reconcile", "Failed to acquire operation lock", {
				details: { error: String(e) },
			});
			this.running = false;
			return;
		}

		// Helper to safely call callbacks with error boundary
		const safeCallback = <T extends unknown[]>(
			fn: ((...args: T) => void) | undefined,
			...args: T
		) => {
			if (!fn) return;
			try {
				fn(...args);
			} catch (e) {
				LogService.error("Reconcile", `Callback error: ${String(e)}`, {
					details: { error: String(e) },
				});
			}
		};

		try {
			for (const m of mappings) {
				mappingIndex++;
				const meta = { mappingIndex, mappingTotal };

				if (this.cancelled) break;

				const label = getMappingLabel(m);

				safeCallback(
					cb.onProgress,
					{
						mappingId: m.id,
						mappingLabel: label,
						phase: "scanning",
						total: undefined,
						scanned: 0,
						processed: 0,
						skipped: 0,
						errors: 0,
					},
					meta
				);

				let res: ReconcileStats;
				try {
					res = await this.fileSync.reconcileMapping(m, (p: ReconcileMappingProgress) => {
						if (this.cancelled) return;

						safeCallback(
							cb.onProgress,
							{
								mappingId: m.id,
								mappingLabel: label,
								phase: "syncing",
								total:
									typeof p.total === "number"
										? p.total
										: undefined,
								scanned: p.scanned ?? 0,
								processed: p.processed ?? 0,
								skipped: p.skipped ?? 0,
								errors: p.errors ?? 0,
								current: p.current,
							},
							meta
						);
					});
				} catch (e) {
					const errorMessage = e instanceof Error ? e.message : String(e);
					LogService.error("Reconcile", `Mapping failed: ${label}`, {
						mappingId: m.id,
						details: { error: errorMessage },
					});

					safeCallback(
						cb.onProgress,
						{
							mappingId: m.id,
							mappingLabel: label,
							phase: "error",
							scanned: 0,
							processed: 0,
							skipped: 0,
							errors: 1,
							errorMessage,
						},
						meta
					);
					continue; // Skip to next mapping
				}

				if (this.cancelled) {
					safeCallback(
						cb.onProgress,
						{
							mappingId: m.id,
							mappingLabel: label,
							phase: "cancelled",
							scanned: res.scanned,
							processed: res.processed,
							skipped: res.skipped,
							errors: res.errors,
						},
						meta
					);
					break;
				}

				safeCallback(
					cb.onProgress,
					{
						mappingId: m.id,
						mappingLabel: label,
						phase: "done",
						scanned: res.scanned,
						processed: res.processed,
						skipped: res.skipped,
						errors: res.errors,
					},
					meta
				);

				safeCallback(cb.onMappingDone, m, res);
				this.ctx.applyReconcileStats(m.id, res);

				LogService.info("Reconcile", `Mapping complete: ${label}`, {
					mappingId: m.id,
					details: {
						scanned: res.scanned,
						processed: res.processed,
						skipped: res.skipped,
						errors: res.errors,
					},
				});
			}
		} finally {
			this.running = false;
			this.ctx.setReconcileSnapshot?.(null);
			this.ctx.statusbar?.clearReconcileProgress?.();
			this.ctx.statusbar?.onStatsChanged();

			// Release operation lock to allow watchers to resume
			if (releaseOp) {
				LogService.debug("Reconcile", "Releasing operation lock");
				releaseOp();
			}
		}
	}

	private defaultProgressToUi(
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	) {
		this.ctx.setReconcileSnapshot?.(p);
		this.ctx.statusbar?.setReconcileProgress?.(p, meta);
	}

	private defaultDoneNotice(m: FolderMapping, res: ReconcileStats) {
		const label = getMappingLabel(m);
		this.notice.show(
			`[${label}] Reconcile done: scanned ${res.scanned}, ✅${res.processed}, ⏭️${res.skipped}, ⚠️${res.errors}`,
			6000
		);
	}

	/**
	 * Reconciles a single folder mapping by its ID.
	 *
	 * @param mappingId - The unique identifier of the mapping to reconcile
	 * @returns `true` if reconciliation was started, `false` if already running or mapping not found
	 *
	 * @example
	 * ```typescript
	 * const success = await reconcile.reconcileSingleMapping('mapping-123');
	 * if (!success) {
	 *   console.log('Could not start reconciliation');
	 * }
	 * ```
	 */
	async reconcileSingleMapping(mappingId: string): Promise<boolean> {
		if (this.running) {
			this.notice.show("Reconcile already in progress");
			return false;
		}

		const mapping = this.ctx.settings.folderMappings.find(
			(m) => m.id === mappingId
		);
		if (!mapping) {
			LogService.warn("Reconcile", `Mapping not found: ${mappingId}`);
			return false;
		}

		LogService.info(
			"Reconcile",
			`Starting reconcile for: ${getMappingLabel(mapping)}`,
			{
				mappingId,
			}
		);

		await this.reconcileMappings([mapping], {
			onProgress: (p, meta) => this.defaultProgressToUi(p, meta),
			onMappingDone: (m, stats) => this.defaultDoneNotice(m, stats),
		});

		return true;
	}

	/**
	 * Reconciles all enabled folder mappings.
	 *
	 * @remarks
	 * This is typically called from the dashboard's "Reconcile All" button.
	 * Only mappings with `enabled: true` are processed.
	 *
	 * @returns `true` if reconciliation was started, `false` if already running or no enabled mappings
	 */
	async reconcileAll(): Promise<boolean> {
		if (this.running) {
			this.notice.show("Reconcile already in progress");
			return false;
		}

		const mappings = this.ctx.settings.folderMappings.filter(
			(m) => m.enabled
		);
		if (mappings.length === 0) {
			this.notice.show("No enabled mappings to reconcile");
			return false;
		}

		LogService.info("Reconcile", "Starting reconcile for all mappings", {
			details: { mappingCount: mappings.length },
		});

		await this.reconcileMappings(mappings, {
			onProgress: (p, meta) => this.defaultProgressToUi(p, meta),
			onMappingDone: (m, stats) => this.defaultDoneNotice(m, stats),
		});

		return true;
	}
}
