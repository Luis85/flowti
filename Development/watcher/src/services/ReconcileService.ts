import type FileWatcherPlugin from "src/main";
import { Notice } from "obsidian";
import type {
	FolderMapping,
	ReconcileProgress,
	ReconcileStats,
} from "src/types";
import { getMappingLabel } from "src/utils";
import { ReconcileCallbacks, IFileSyncService, ReconcileMappingProgress } from "./types";

export class ReconcileService {
	private running = false;
	private cancelled = false;

	constructor(
		private plugin: FileWatcherPlugin,
		private fileSync: IFileSyncService
	) {}

	isRunning() {
		return this.running;
	}

	cancel() {
		this.cancelled = true;
	}

	async reconcileOnStart(): Promise<void> {
		const settings = this.plugin.settings;
		const syncOnStart = settings.syncOnStart ?? true;
		if (!syncOnStart) return;

		const mappings = settings.folderMappings.filter(
			(m) => m.enabled && m.reconcileOnStart !== false
		);
		if (mappings.length === 0) return;

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

		try {
			for (const m of mappings) {
				mappingIndex++;
				const meta = { mappingIndex, mappingTotal };

				if (this.cancelled) break;

				const label = getMappingLabel(m);

				cb.onProgress?.(
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

						cb.onProgress?.(
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
					cb.onProgress?.(
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

				cb.onProgress?.(
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

				cb.onMappingDone?.(m, res);
				this.plugin.applyReconcileStats(m.id, res);
			}
		} finally {
			this.running = false;
			this.plugin.setReconcileSnapshot?.(null);
			this.plugin.statusbar?.clearReconcileProgress?.();
			this.plugin.statusbar?.onStatsChanged();
		}
	}

	private defaultProgressToUi(
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	) {
		this.plugin.setReconcileSnapshot?.(p);
		this.plugin.statusbar?.setReconcileProgress?.(p, meta);
	}

	private defaultDoneNotice(m: FolderMapping, res: ReconcileStats) {
		const label = getMappingLabel(m);
		new Notice(
			`[${label}] Reconcile done: scanned ${res.scanned}, ✅${res.processed}, ⏭️${res.skipped}, ⚠️${res.errors}`,
			6000
		);
	}
}
