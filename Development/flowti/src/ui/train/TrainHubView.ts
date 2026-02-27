/**
 * Train Hub — central management view for all Train of Thoughts sessions.
 *
 * Dashboard shows active train + aggregate stats.
 * Active tab lists running/paused trains with Resume/Pause/Open/Delete actions.
 * History tab lists completed trains with Open/Delete, searchable by title.
 *
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import { setIcon, type WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { TrainState, TrainStatus } from "../../domain/train/types";
import { BUILT_IN_TRAIN_TYPES } from "../../domain/train/types";
import { BaseHubView, type TabDef } from "../BaseHubView";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";
import { VIEW_TYPE_TRAIN_HUB } from "../../domain/hub/types";
export { VIEW_TYPE_TRAIN_HUB };

export type TrainHubPage = "active" | "history";

export type TrainSortBy = "recent" | "most-thoughts" | "longest";

export class TrainHubView extends BaseHubView<TrainHubPage> {
	private trainService: TrainService;
	private onboardingService: OnboardingService;
	private trains: readonly TrainState[] = [];
	private openTrainCb: (trainId: string) => void;
	private selectedTrainId: string | null = null;
	private typeFilter = "all";
	private sortBy: TrainSortBy = "recent";

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		trainService: TrainService,
		openTrain: (trainId: string) => void,
		onboardingService: OnboardingService,
	) {
		super(leaf, eventBus);
		this.trainService = trainService;
		this.openTrainCb = openTrain;
		this.onboardingService = onboardingService;
	}

	// ── Identity ────────────────────────────────────────────

	getViewType(): string { return VIEW_TYPE_TRAIN_HUB; }
	getHubId(): string { return "train-hub"; }
	getHubType(): "system" | "domain" | "user" { return "domain"; }
	getHubDisplayName(): string { return "Train Hub"; }
	getHubIcon(): string { return "train-front"; }

	// ── Tabs ────────────────────────────────────────────────

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "active", label: "Active", icon: "play", searchPlaceholder: "Search active trains..." },
			{ id: "history", label: "History", icon: "history", searchPlaceholder: "Search completed trains..." },
		];
	}

	// ── Top bar actions ─────────────────────────────────────

	renderTopBarActions(bar: HTMLElement): void {
		// Type filter dropdown
		const typeSelect = bar.createEl("select", { cls: "ft-train-hub-filter dropdown" });
		const allOpt = typeSelect.createEl("option", { text: "All types" });
		allOpt.value = "all";
		if (this.typeFilter === "all") allOpt.selected = true;
		for (const t of BUILT_IN_TRAIN_TYPES) {
			const opt = typeSelect.createEl("option", { text: t.label });
			opt.value = t.id;
			if (this.typeFilter === t.id) opt.selected = true;
		}
		typeSelect.addEventListener("change", () => {
			this.typeFilter = typeSelect.value;
			this.scheduleRender();
		});

		// Sort dropdown
		const sortSelect = bar.createEl("select", { cls: "ft-train-hub-sort dropdown" });
		const sortOptions: { value: TrainSortBy; label: string }[] = [
			{ value: "recent", label: "Most recent" },
			{ value: "most-thoughts", label: "Most thoughts" },
			{ value: "longest", label: "Longest duration" },
		];
		for (const opt of sortOptions) {
			const el = sortSelect.createEl("option", { text: opt.label });
			el.value = opt.value;
			if (this.sortBy === opt.value) el.selected = true;
		}
		sortSelect.addEventListener("change", () => {
			this.sortBy = sortSelect.value as TrainSortBy;
			this.scheduleRender();
		});
	}

	// ── Lifecycle ────────────────────────────────────────────

	onHubOpen(): void {
		this.refreshTrains();

		// Subscribe to train lifecycle events for re-render
		const events = [
			"train.started",
			"train.paused",
			"train.resumed",
			"train.completed",
			"train.deleted",
			"train.renamed",
			"train.thought.added",
		] as const;

		for (const eventName of events) {
			this.addUnsubscribe(
				this.eventBus.on(eventName, () => {
					this.refreshTrains();
					this.scheduleRender();
				}),
			);
		}
	}

	onHubClose(): void {
		// No extra cleanup needed beyond base class unsubscribes
	}

	// ── Tab change ──────────────────────────────────────────

	protected onTabChanged(): void {
		this.selectedTrainId = null;
		this.filterText = "";
		this.searchInput.value = "";
		this.typeFilter = "all";
		this.sortBy = "recent";
	}

	// ── Rendering ───────────────────────────────────────────

	onDashboardRender(): void {
		this.refreshTrains();
		this.dashboardEl.empty();

		this.renderOnboardingCallout(this.dashboardEl, this.onboardingService, {
			id: "train-hub-welcome",
			icon: "train-front",
			title: "Welcome to the Train Hub",
			description: "Capture streams of connected thoughts in timed rides. Review, resume, and explore your thought history.",
			suggestion: "Start a ride to capture your first train of thought.",
		});

		const container = this.dashboardEl.createDiv({ cls: "ft-p-4" });

		// ── Header ──
		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-4" });
		const iconEl = header.createSpan();
		setIcon(iconEl, "train-front");
		header.createEl("h2", { text: "Train hub", cls: "ft-heading ft-heading-lg ft-m-0" });

		// ── Stats cards ──
		const statsRow = container.createDiv({ cls: "ft-grid ft-grid-cols-4 ft-gap-3 ft-mb-4" });
		const activeTrain = this.getActiveTrains();
		const completedTrains = this.getCompletedTrains();
		const allTrains = this.trains;

		this.renderStatCard(statsRow, "train-front", "Total Trains", String(allTrains.length));
		this.renderStatCard(statsRow, "play", "Active", String(activeTrain.length));
		this.renderStatCard(statsRow, "check-circle", "Completed", String(completedTrains.length));
		this.renderStatCard(statsRow, "brain", "Avg Thoughts", this.computeAvgThoughts());

		// ── Active train card ──
		const running = this.trains.find((t) => t.status === "running");
		if (running) {
			const card = container.createDiv({ cls: "ft-card ft-p-3 ft-mb-4" });
			const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
			const runIcon = cardHeader.createSpan();
			setIcon(runIcon, "play");
			runIcon.style.color = "var(--text-success)";
			cardHeader.createSpan({ text: "Currently Running", cls: "ft-heading ft-heading-sm" });

			const cardBody = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-3" });
			cardBody.createSpan({ text: running.title, cls: "ft-text-bold" });
			cardBody.createSpan({ text: `${running.thoughts.length} thoughts`, cls: "ft-text-muted ft-text-sm" });

			const openBtn = cardBody.createEl("button", { text: "Open", cls: "ft-btn ft-btn-ghost ft-text-sm" });
			openBtn.addEventListener("click", () => this.openTrainCb(running.id));
		}

		// ── Paused train callout ──
		const paused = this.trains.find((t) => t.status === "paused");
		if (!running && paused) {
			const pausedCard = container.createDiv({ cls: "ft-card ft-p-3 ft-mb-4" });
			const pausedHeader = pausedCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
			const pauseIcon = pausedHeader.createSpan();
			setIcon(pauseIcon, "pause");
			pauseIcon.style.color = "var(--text-warning)";
			pausedHeader.createSpan({ text: "Paused", cls: "ft-heading ft-heading-sm" });

			const pausedBody = pausedCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-3" });
			pausedBody.createSpan({ text: paused.title, cls: "ft-text-bold" });
			pausedBody.createSpan({ text: `${paused.thoughts.length} thoughts`, cls: "ft-text-muted ft-text-sm" });

			const resumeBtn = pausedBody.createEl("button", { text: "Resume", cls: "ft-btn ft-btn-primary ft-text-sm" });
			resumeBtn.style.marginLeft = "auto";
			resumeBtn.addEventListener("click", () => {
				void this.eventBus.emit("ui.startTrain", {});
			});

			const openBtn = pausedBody.createEl("button", { text: "Open", cls: "ft-btn ft-btn-ghost ft-text-sm" });
			openBtn.addEventListener("click", () => this.openTrainCb(paused.id));
		}

		// ── Start a Ride callout ──
		if (!running && !paused) {
			const callout = container.createDiv({ cls: "ft-card ft-train-hub-start-callout ft-mb-4" });
			const calloutRow = callout.createDiv({ cls: "ft-flex ft-items-center ft-gap-3" });
			const calloutIcon = calloutRow.createSpan({ cls: "ft-icon-muted" });
			setIcon(calloutIcon, "train-front");
			const calloutText = calloutRow.createDiv();
			calloutText.createDiv({ text: "Ready for a new ride?", cls: "ft-heading ft-heading-sm" });
			calloutText.createDiv({ text: "Capture a stream of connected thoughts.", cls: "ft-text-muted ft-text-sm" });
			const startBtn = calloutRow.createEl("button", { text: "Start a ride", cls: "ft-btn ft-btn-primary ft-text-sm" });
			startBtn.style.marginLeft = "auto";
			startBtn.addEventListener("click", () => {
				void this.eventBus.emit("ui.startTrain", {});
			});
		}

		// ── Quick actions ──
		const actions = container.createDiv({ cls: "ft-flex ft-gap-2" });
		const activeBtn = actions.createEl("button", { text: "View active trains", cls: "ft-btn ft-btn-ghost ft-text-sm" });
		activeBtn.addEventListener("click", () => this.navigateTo("active"));
		const historyBtn = actions.createEl("button", { text: "View history", cls: "ft-btn ft-btn-ghost ft-text-sm" });
		historyBtn.addEventListener("click", () => this.navigateTo("history"));
	}

	onTabRender(tabId: TrainHubPage): void {
		this.refreshTrains();
		this.masterTreeEl.empty();
		this.detailPanelEl.empty();

		switch (tabId) {
			case "active":
				this.renderActiveTab();
				break;
			case "history":
				this.renderHistoryTab();
				break;
		}
	}

	// ── Active tab ──────────────────────────────────────────

	private renderActiveTab(): void {
		const trains = this.getActiveTrains();
		const filtered = this.applyFilter(trains);

		this.updateCountBadge(filtered.length);

		if (filtered.length === 0) {
			this.renderEmptyState(this.masterTreeEl, "No active trains", "Start a train from the command palette.");
			return;
		}

		for (const train of filtered) {
			const row = this.renderTrainRow(this.masterTreeEl, train);
			row.addEventListener("click", () => {
				this.selectedTrainId = train.id;
				this.renderActiveDetail(train);
			});
		}

		// Auto-select first or previously selected
		const selected = filtered.find((t) => t.id === this.selectedTrainId) ?? filtered[0];
		if (selected) {
			this.selectedTrainId = selected.id;
			this.renderActiveDetail(selected);
		}
	}

	private renderActiveDetail(train: TrainState): void {
		this.detailPanelEl.empty();
		const container = this.detailPanelEl.createDiv({ cls: "ft-p-3" });

		// Header
		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		header.createEl("h3", { text: train.title, cls: "ft-heading ft-heading-sm ft-m-0" });
		this.renderStatusBadge(header, train.status);

		// Info
		const info = container.createDiv({ cls: "ft-mb-3" });
		info.createDiv({ text: `Thoughts: ${train.thoughts.length}`, cls: "ft-text-sm ft-mb-1" });
		info.createDiv({ text: `Started: ${new Date(train.createdAt).toLocaleString()}`, cls: "ft-text-sm ft-text-muted ft-mb-1" });
		if (train.durationMinutes > 0) {
			info.createDiv({ text: `Duration: ${train.durationMinutes} min`, cls: "ft-text-sm ft-text-muted" });
		}

		// Actions
		const actions = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-3" });

		const openBtn = actions.createEl("button", { text: "Open", cls: "ft-btn ft-btn-ghost ft-text-sm" });
		openBtn.addEventListener("click", () => this.openTrainCb(train.id));

		if (train.status === "paused") {
			const resumeBtn = actions.createEl("button", { text: "Resume", cls: "ft-btn ft-btn-ghost ft-text-sm" });
			resumeBtn.addEventListener("click", () => {
				void this.trainService.resume(train.id);
			});
		} else if (train.status === "running") {
			const pauseBtn = actions.createEl("button", { text: "Pause", cls: "ft-btn ft-btn-ghost ft-text-sm" });
			pauseBtn.addEventListener("click", () => {
				void this.trainService.pause(train.id);
			});
		}

		const deleteBtn = actions.createEl("button", { text: "Delete", cls: "ft-btn ft-btn-ghost ft-text-sm ft-text-error" });
		deleteBtn.addEventListener("click", () => {
			void this.trainService.deleteTrain(train.id);
		});
	}

	// ── History tab ─────────────────────────────────────────

	private renderHistoryTab(): void {
		const trains = this.getCompletedTrains();
		const filtered = this.applyFilter(trains);

		this.updateCountBadge(filtered.length);

		if (filtered.length === 0) {
			this.renderEmptyState(this.masterTreeEl, "No completed trains", "Completed trains will appear here.");
			return;
		}

		for (const train of filtered) {
			const row = this.renderTrainRow(this.masterTreeEl, train);
			row.addEventListener("click", () => {
				this.selectedTrainId = train.id;
				this.renderHistoryDetail(train);
			});
		}

		const selected = filtered.find((t) => t.id === this.selectedTrainId) ?? filtered[0];
		if (selected) {
			this.selectedTrainId = selected.id;
			this.renderHistoryDetail(selected);
		}
	}

	private renderHistoryDetail(train: TrainState): void {
		this.detailPanelEl.empty();
		const container = this.detailPanelEl.createDiv({ cls: "ft-p-3" });

		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		header.createEl("h3", { text: train.title, cls: "ft-heading ft-heading-sm ft-m-0" });
		this.renderStatusBadge(header, train.status);

		const info = container.createDiv({ cls: "ft-mb-3" });
		info.createDiv({ text: `Thoughts: ${train.thoughts.length}`, cls: "ft-text-sm ft-mb-1" });
		info.createDiv({ text: `Started: ${new Date(train.createdAt).toLocaleString()}`, cls: "ft-text-sm ft-text-muted ft-mb-1" });
		if (train.completedAt) {
			info.createDiv({ text: `Completed: ${new Date(train.completedAt).toLocaleString()}`, cls: "ft-text-sm ft-text-muted" });
		}

		const actions = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-3" });
		const openBtn = actions.createEl("button", { text: "Open", cls: "ft-btn ft-btn-ghost ft-text-sm" });
		openBtn.addEventListener("click", () => this.openTrainCb(train.id));

		const deleteBtn = actions.createEl("button", { text: "Delete", cls: "ft-btn ft-btn-ghost ft-text-sm ft-text-error" });
		deleteBtn.addEventListener("click", () => {
			void this.trainService.deleteTrain(train.id);
		});
	}

	// ── Shared helpers ──────────────────────────────────────

	private refreshTrains(): void {
		this.trains = this.trainService.getAllTrains();
	}

	private getActiveTrains(): TrainState[] {
		return [...this.trains].filter((t) => t.status === "running" || t.status === "paused");
	}

	private getCompletedTrains(): TrainState[] {
		return [...this.trains].filter((t) => t.status === "completed").reverse();
	}

	private applyFilter(trains: TrainState[]): TrainState[] {
		let result = trains;

		// Type filter
		if (this.typeFilter !== "all") {
			result = result.filter((t) => (t.trainType ?? "free-form") === this.typeFilter);
		}

		// Text search
		if (this.filterText) {
			const lower = this.filterText.toLowerCase();
			result = result.filter((t) => t.title.toLowerCase().includes(lower));
		}

		// Sort
		result = [...result].sort((a, b) => {
			switch (this.sortBy) {
				case "most-thoughts":
					return b.thoughts.length - a.thoughts.length;
				case "longest": {
					const durA = this.computeDuration(a);
					const durB = this.computeDuration(b);
					return durB - durA;
				}
				case "recent":
				default:
					return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			}
		});

		return result;
	}

	private computeDuration(train: TrainState): number {
		if (!train.createdAt) return 0;
		const start = new Date(train.createdAt).getTime();
		const end = train.completedAt
			? new Date(train.completedAt).getTime()
			: (train.pausedAt ? new Date(train.pausedAt).getTime() : Date.now());
		return Math.max(0, end - start);
	}

	private renderTrainRow(container: HTMLElement, train: TrainState): HTMLElement {
		const row = container.createDiv({
			cls: `ft-list-item ft-px-3 ft-py-2 ft-cursor-pointer${train.id === this.selectedTrainId ? " ft-list-item-active" : ""}`,
		});
		const left = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		this.renderStatusBadge(left, train.status);
		left.createSpan({ text: train.title, cls: "ft-text-sm" });
		const right = row.createSpan({ text: `${train.thoughts.length}`, cls: "ft-badge ft-badge-muted ft-text-xs" });
		row.createDiv({ cls: "ft-flex ft-items-center ft-justify-between" }).append(left, right);
		// Re-structure: the row should contain the flex container
		row.empty();
		const flex = row.createDiv({ cls: "ft-flex ft-items-center ft-justify-between" });
		const leftSide = flex.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		this.renderStatusBadge(leftSide, train.status);
		leftSide.createSpan({ text: train.title, cls: "ft-text-sm" });
		const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
		leftSide.createSpan({ text: typeConfig?.label ?? "Free-form", cls: "ft-badge ft-badge-muted ft-text-xs ft-train-type-badge" });
		flex.createSpan({ text: `${train.thoughts.length}`, cls: "ft-badge ft-badge-muted ft-text-xs" });
		return row;
	}

	private renderStatusBadge(container: HTMLElement, status: TrainStatus): void {
		const badge = container.createSpan({ cls: "ft-badge ft-text-xs" });
		switch (status) {
			case "running":
				badge.setText("Running");
				badge.addClass("ft-badge-success");
				break;
			case "paused":
				badge.setText("Paused");
				badge.addClass("ft-badge-warning");
				break;
			case "completed":
				badge.setText("Completed");
				badge.addClass("ft-badge-muted");
				break;
		}
	}

	private renderStatCard(container: HTMLElement, icon: string, label: string, value: string): void {
		const card = container.createDiv({ cls: "ft-card ft-p-2 ft-text-center" });
		const iconEl = card.createDiv({ cls: "ft-mb-1" });
		setIcon(iconEl, icon);
		iconEl.style.opacity = "0.6";
		card.createDiv({ text: value, cls: "ft-heading ft-heading-sm" });
		card.createDiv({ text: label, cls: "ft-text-muted ft-text-xs" });
	}

	private renderEmptyState(container: HTMLElement, title: string, description: string): void {
		const empty = container.createDiv({ cls: "ft-p-4 ft-text-center" });
		const iconEl = empty.createDiv({ cls: "ft-mb-2" });
		setIcon(iconEl, "train-front");
		iconEl.style.opacity = "0.3";
		empty.createDiv({ text: title, cls: "ft-heading ft-heading-sm ft-mb-1" });
		empty.createDiv({ text: description, cls: "ft-text-muted ft-text-sm" });
	}

	private updateCountBadge(count: number): void {
		this.countBadge.setText(String(count));
		this.countBadge.classList.toggle("ft-hidden", count === 0);
	}

	private computeAvgThoughts(): string {
		if (this.trains.length === 0) return "0";
		const total = this.trains.reduce((sum, t) => sum + t.thoughts.length, 0);
		return (total / this.trains.length).toFixed(1);
	}
}
