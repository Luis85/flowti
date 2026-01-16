import FileWatcherPlugin from "src/main";
import { setTooltip } from "obsidian";
import type { ReconcileProgress } from "src/types";
import { truncatePath, getMappingLabel } from "src/utils";

export class StatusBarService {
	private el: HTMLElement;

	// new: reconcile snapshot for compact UI + modal
	private reconcile: ReconcileProgress | null = null;
	private reconcileMeta: {
		mappingIndex: number;
		mappingTotal: number;
	} | null = null;

	constructor(private plugin: FileWatcherPlugin) {
		this.el = plugin.addStatusBarItem();
		this.el.addClass("filewatcher-status");

		// Click opens modal (we'll wire this via plugin)
		this.el.addEventListener("click", () => {
			this.plugin.openReconcileModal?.();
		});

		this.render();
	}

	/** Called by ReconcileService to show compact progress */
	setReconcileProgress(
		p: ReconcileProgress,
		meta?: { mappingIndex: number; mappingTotal: number }
	) {
		this.reconcile = p;
		this.reconcileMeta = meta ?? this.reconcileMeta;
		this.render();
	}

	clearReconcileProgress() {
		this.reconcile = null;
		this.reconcileMeta = null;
		this.render();
	}

	render() {
		const s = this.plugin.stats;
		const active = this.plugin.manager?.activeCount() ?? 0;

		// --- Compact status text ---
		if (
			this.reconcile &&
			(this.reconcile.phase === "scanning" ||
				this.reconcile.phase === "syncing")
		) {
			const mIdx = this.reconcileMeta?.mappingIndex ?? 1;
			const mTot = this.reconcileMeta?.mappingTotal ?? 1;
			const total = this.reconcile.total ?? 0;
			const scanned = this.reconcile.scanned ?? 0;

			// super compact: R 1/3 · 120/860 · ✅40 ⏭️70 ⚠️0
			const scanPart = total > 0 ? `${scanned}/${total}` : `${scanned}`;
			this.el.setText(
				`R ${mIdx}/${mTot} · ${scanPart} · ✅${this.reconcile.processed} ⏭️${this.reconcile.skipped} ⚠️${this.reconcile.errors}`
			);
		} else {
			this.el.setText(
				`Sync ${active} · ✅${s.filesProcessed} ⏭️${s.filesSkipped} ⚠️${s.errors}`
			);
		}

		// --- Tooltip keeps details ---
		const lines: string[] = [];
		lines.push(`Active mappings: ${active}`);
		lines.push(`Processed: ${s.filesProcessed}`);
		lines.push(`Skipped: ${s.filesSkipped}`);
		lines.push(`Errors: ${s.errors}`);
		if (s.lastProcessed) lines.push(`Last: ${s.lastProcessed}`);

		if (this.reconcile) {
			lines.push("");
			lines.push("Reconcile:");
			const label =
				this.reconcile.mappingLabel ?? this.reconcile.mappingId;
			lines.push(`- Mapping: ${label}`);
			lines.push(`- Phase: ${this.reconcile.phase}`);
			if (typeof this.reconcile.total === "number")
				lines.push(`- Total: ${this.reconcile.total}`);
			lines.push(`- Scanned: ${this.reconcile.scanned}`);
			lines.push(
				`- ✅${this.reconcile.processed} ⏭️${this.reconcile.skipped} ⚠️${this.reconcile.errors}`
			);
			if (this.reconcile.current)
				lines.push(`- Current: ${truncatePath(this.reconcile.current, 80)}`);
		}

		lines.push("");
		lines.push("Per mapping:");
		for (const m of this.plugin.settings.folderMappings) {
			const ms = s.perMappingStats[m.id] ?? {
				processed: 0,
				skipped: 0,
				errors: 0,
			};
			const label = getMappingLabel(m);
			lines.push(
				`- ${label}: ✅${ms.processed} ⏭️${ms.skipped} ⚠️${ms.errors}`
			);
		}

		setTooltip(this.el, lines.join("\n"), { placement: "top" });
	}

	onStatsChanged() {
		this.render();
	}

	destroy() {
		this.el.detach();
	}
}
