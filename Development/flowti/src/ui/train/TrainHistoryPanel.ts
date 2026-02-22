/**
 * Train History Panel — browsable list of all trains when no train is focused.
 *
 * Replaces the empty state in TrainMainView with compact train cards
 * showing title, status badge, thought count, branch count, and duration.
 * Includes status filter buttons (All / Active / Completed).
 */

import { setIcon } from "obsidian";
import type { TrainState } from "../../domain/train/types";
import type { TrainService } from "../../domain/train/TrainService";

export type TrainStatusFilter = "all" | "active" | "completed";

export interface TrainHistoryPanelDeps {
	trainService: TrainService;
	onSelectTrain: (trainId: string) => void;
}

export class TrainHistoryPanel {
	private filter: TrainStatusFilter = "all";

	constructor(
		private el: HTMLElement,
		private deps: TrainHistoryPanelDeps,
	) {}

	render(): void {
		this.el.empty();
		this.el.addClass("ft-train-history");

		this.renderHeader();
		this.renderFilterBar();
		this.renderTrainList();
	}

	private renderHeader(): void {
		const header = this.el.createDiv({ cls: "ft-section ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "train-front");
		header.createEl("h3", { cls: "ft-heading", text: "Train History" });
	}

	private renderFilterBar(): void {
		const bar = this.el.createDiv({ cls: "ft-train-history-filters ft-flex ft-gap-1" });

		const filters: { label: string; value: TrainStatusFilter }[] = [
			{ label: "All", value: "all" },
			{ label: "Active", value: "active" },
			{ label: "Completed", value: "completed" },
		];

		for (const f of filters) {
			const btn = bar.createEl("button", {
				cls: `ft-btn ft-btn-sm ft-train-filter-btn ${this.filter === f.value ? "ft-btn-primary" : "ft-btn-ghost"}`,
				text: f.label,
			});
			btn.dataset.filter = f.value;
			btn.addEventListener("click", () => {
				this.filter = f.value;
				this.render();
			});
		}
	}

	private renderTrainList(): void {
		const allTrains = this.deps.trainService.getAllTrains();
		const filtered = this.filterTrains([...allTrains]);

		if (filtered.length === 0) {
			const empty = this.el.createDiv({ cls: "ft-train-history-empty" });
			if (allTrains.length === 0) {
				empty.setText("No trains yet. Start one from the command palette or ribbon.");
			} else {
				empty.setText("No trains match this filter.");
			}
			return;
		}

		const list = this.el.createDiv({ cls: "ft-train-history-list" });

		// Sort: newest first
		filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		for (const train of filtered) {
			this.renderCard(list, train);
		}
	}

	private renderCard(container: HTMLElement, train: TrainState): void {
		const card = container.createDiv({ cls: "ft-train-history-card" });
		card.dataset.trainId = train.id;

		// Top row: icon + title + status badge
		const top = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = top.createSpan();
		setIcon(icon, "train-front");
		top.createSpan({ cls: "ft-train-history-title", text: train.title });

		const badge = top.createSpan({
			cls: `ft-badge ft-badge-muted ft-train-status ft-train-status-${train.status}`,
			text: train.status,
		});
		badge.addClass("ft-train-history-status");

		// Stats row: thoughts · branches · duration
		const stats = card.createDiv({ cls: "ft-train-history-stats ft-text-sm ft-text-muted" });
		const branchCount = train.relations.filter((r) => r.direction === "branch").length;
		const duration = this.computeDuration(train);
		stats.setText(`${train.thoughts.length} thoughts · ${branchCount} branches · ${duration}`);

		// Date row
		const date = card.createDiv({ cls: "ft-train-history-date ft-text-sm ft-text-muted" });
		const dateLabel = train.status === "completed" ? "Completed" : "Started";
		const dateValue = train.status === "completed" && train.completedAt
			? new Date(train.completedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
			: new Date(train.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
		date.setText(`${dateLabel} ${dateValue}`);

		card.addEventListener("click", () => {
			this.deps.onSelectTrain(train.id);
		});
	}

	private filterTrains(trains: TrainState[]): TrainState[] {
		if (this.filter === "all") return trains;
		if (this.filter === "active") {
			return trains.filter((t) => t.status === "running" || t.status === "paused");
		}
		return trains.filter((t) => t.status === "completed");
	}

	private computeDuration(train: TrainState): string {
		const start = new Date(train.createdAt).getTime();
		const end = train.completedAt
			? new Date(train.completedAt).getTime()
			: (train.pausedAt ? new Date(train.pausedAt).getTime() : Date.now());
		const mins = Math.round((end - start) / 60_000);
		return `${mins}m`;
	}
}
