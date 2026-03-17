import { setTooltip } from "obsidian";
import type { ReconcileProgress } from "src/types";
import { truncatePath, getMappingLabel } from "src/utils";
import type { IStatusBarContext } from "./types";

/** Minimum interval between render calls (ms) */
const RENDER_THROTTLE_MS = 100;

export class StatusBarService {
	private el: HTMLElement;

	// Reconcile snapshot for compact UI + modal
	private reconcile: ReconcileProgress | null = null;
	private reconcileMeta: {
		mappingIndex: number;
		mappingTotal: number;
	} | null = null;

	// Throttling state
	private lastRenderTime = 0;
	private pendingRender = false;
	private renderTimeout: number | null = null;

	// Store click handler reference for cleanup
	private clickHandler: () => void;

	constructor(private ctx: IStatusBarContext) {
		this.el = ctx.addStatusBarItem();
		this.el.addClass("filewatcher-status");

		// Click opens modal
		this.clickHandler = () => this.ctx.openDashboard?.();
		this.el.addEventListener("click", this.clickHandler);

		this.render();
	}

	/** Called by ReconcileService to show compact progress */
	setReconcileProgress(
		p: ReconcileProgress,
		meta?: { mappingIndex: number; mappingTotal: number }
	) {
		this.reconcile = p;
		this.reconcileMeta = meta ?? this.reconcileMeta;
		this.scheduleRender();
	}

	clearReconcileProgress() {
		this.reconcile = null;
		this.reconcileMeta = null;
		// Force immediate render when clearing to show final state
		this.renderImmediate();
	}

	render() {
		const s = this.ctx.stats;
		const active = this.ctx.getActiveWatcherCount();
		const watched = this.ctx.getTotalWatchedFileCount();

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
				`Sync ${active} · 👁${watched} · ✅${s.filesProcessed} ⏭️${s.filesSkipped} ⚠️${s.errors}`
			);
		}

		// --- Tooltip keeps details ---
		const lines: string[] = [];
		lines.push(`Active mappings: ${active}`);
		lines.push(`Watched files: ${watched}`);
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
		for (const m of this.ctx.settings.folderMappings) {
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
		this.scheduleRender();
	}

	/** Throttled render - prevents excessive DOM updates during reconcile */
	private scheduleRender() {
		const now = Date.now();
		const elapsed = now - this.lastRenderTime;

		if (elapsed >= RENDER_THROTTLE_MS) {
			// Enough time has passed, render immediately
			this.lastRenderTime = now;
			this.pendingRender = false;
			this.render();
		} else if (!this.pendingRender) {
			// Schedule a render for later
			this.pendingRender = true;
			const delay = RENDER_THROTTLE_MS - elapsed;
			this.renderTimeout = window.setTimeout(() => {
				this.lastRenderTime = Date.now();
				this.pendingRender = false;
				this.renderTimeout = null;
				this.render();
			}, delay);
		}
		// If pendingRender is already true, a render is scheduled - do nothing
	}

	/** Force immediate render, bypassing throttle */
	private renderImmediate() {
		if (this.renderTimeout !== null) {
			window.clearTimeout(this.renderTimeout);
			this.renderTimeout = null;
		}
		this.pendingRender = false;
		this.lastRenderTime = Date.now();
		this.render();
	}

	destroy() {
		// Clean up event listener
		this.el.removeEventListener("click", this.clickHandler);

		// Clean up pending timeout
		if (this.renderTimeout !== null) {
			window.clearTimeout(this.renderTimeout);
			this.renderTimeout = null;
		}

		this.el.detach();
	}
}
