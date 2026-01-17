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

export class ReconcileService {
	private running = false;
	private cancelled = false;
	private notice: INoticeService;

	constructor(
		private ctx: IReconcileContext,
		private fileSync: IFileSyncService,
		notice?: INoticeService
	) {
		this.notice = notice ?? createNoOpNoticeService();
	}

	isRunning() {
		return this.running;
	}

	cancel() {
		this.cancelled = true;
	}

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

				const res: ReconcileStats =
					await this.fileSync.reconcileMapping(m, (p: ReconcileMappingProgress) => {
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
	 * Reconcile a single mapping by ID
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
	 * Reconcile all enabled mappings
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
