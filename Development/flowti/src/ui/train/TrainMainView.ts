/**
 * Train Main View — a dedicated workspace for navigating thoughts in a train.
 *
 * Extends ItemView directly (not BaseHubView) because it renders a
 * single-train workspace rather than a tabbed hub shell.
 *
 * Layout: header → nav bar → thought detail → branch links → action buttons.
 * All mutations go through the EventBus; the view is purely reactive.
 *
 * Event subscriptions: TrainMainViewSubscriptions.ts
 */

import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { ThoughtNode, TrainState } from "../../domain/train/types";
import { VIEW_TYPE_TRAIN_MAIN } from "./types";
import type { TrainPanelDeps } from "./types";
import { setupTrainViewSubscriptions } from "./TrainMainViewSubscriptions";
import { TrainStatsPanel } from "./TrainStatsPanel";
import { TrainControlsPanel } from "./TrainControlsPanel";
import { TrainBreadcrumbPanel } from "./TrainBreadcrumbPanel";

// Re-export for backward compat
export { VIEW_TYPE_TRAIN_MAIN } from "./types";

/** Context interface for subscription handlers. */
export interface TrainViewContext {
	getTrainId: () => string | null;
	setTrainId: (trainId: string) => void;
	setActiveThoughtId: (id: string | null) => void;
	scheduleRender: () => void;
}

export class TrainMainView extends ItemView {
	private eventBus: IEventBus;
	private trainService: TrainService;
	private unsubscribes: (() => void)[] = [];
	private trainId: string | null = null;
	private activeThoughtId: string | null = null;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private statsPanel!: TrainStatsPanel;
	private controlsPanel!: TrainControlsPanel;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, trainService: TrainService) {
		super(leaf);
		this.eventBus = eventBus;
		this.trainService = trainService;
	}

	getViewType(): string {
		return VIEW_TYPE_TRAIN_MAIN;
	}

	getDisplayText(): string {
		const train = this.getTrain();
		return train ? `Train: ${train.title}` : "Train of Thoughts";
	}

	getIcon(): string {
		return "train-front";
	}

	async onOpen(): Promise<void> {
		this.containerEl.addClass("ft-hide-header");

		// If no trainId set via setState, try to find the active train
		if (!this.trainId) {
			const active = this.trainService.getActiveTrain();
			if (active) {
				this.trainId = active.id;
			}
		}

		this.render();
		this.unsubscribes = setupTrainViewSubscriptions(this.buildContext(), this.eventBus);

		// Re-render when a thought note is modified (updates content preview)
		if (this.app?.vault) {
			this.registerEvent(
				this.app.vault.on("modify", (file) => {
					const train = this.getTrain();
					if (train && train.thoughts.some((t) => t.path === file.path)) {
						this.scheduleRender();
					}
				}),
			);
		}
	}

	async setState(state: Record<string, unknown>, result: import("obsidian").ViewStateResult): Promise<void> {
		if (state?.trainId && typeof state.trainId === "string") {
			this.trainId = state.trainId;
			this.activeThoughtId = null;
			this.render();
		}
		await super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { trainId: this.trainId ?? null };
	}

	async onClose(): Promise<void> {
		if (this.renderTimer !== null) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Render scheduling ────────────────────────────────────

	scheduleRender(): void {
		if (this.renderTimer !== null) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.renderTimer = null;
			this.render();
		}, 16);
	}

	// ── Render ───────────────────────────────────────────────

	render(): void {
		const el = this.contentEl;
		el.empty();

		const train = this.getTrain();
		if (!train) {
			this.renderEmptyState(el);
			return;
		}

		const panelDeps = this.buildPanelDeps();

		const allThoughts = this.getSortedThoughts(train);
		const activeThought = this.resolveActiveThought(allThoughts);

		this.renderHeader(el, train);

		// Parent train link
		if (train.parentTrainId) {
			this.renderParentLink(el, train.parentTrainId);
		}

		// Stats panel
		const statsEl = el.createDiv({ cls: "ft-section ft-train-stats-section" });
		this.statsPanel = new TrainStatsPanel(statsEl, panelDeps);
		this.statsPanel.render(train);

		// Breadcrumb
		const breadcrumbEl = el.createDiv({ cls: "ft-section ft-train-breadcrumb-section" });
		const breadcrumb = new TrainBreadcrumbPanel(breadcrumbEl, panelDeps);
		breadcrumb.render(train, activeThought);

		this.renderNavBar(el, allThoughts, activeThought);

		if (activeThought) {
			this.renderThoughtDetail(el, activeThought, train);
			this.renderContentPreview(el, activeThought);
			this.renderBranchLinks(el, activeThought, train);
		}

		// Controls panel
		const controlsEl = el.createDiv({ cls: "ft-section ft-train-controls-section" });
		this.controlsPanel = new TrainControlsPanel(controlsEl, panelDeps);
		this.controlsPanel.render(train);
	}

	private renderEmptyState(el: HTMLElement): void {
		const empty = el.createDiv({ cls: "ft-train-empty" });
		const iconEl = empty.createDiv();
		setIcon(iconEl, "train-front");
		empty.createEl("p", { text: "No active train. Start one from the command palette or ribbon." });
	}

	private renderHeader(el: HTMLElement, train: TrainState): void {
		const header = el.createDiv({ cls: "ft-section" });

		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = titleRow.createSpan();
		setIcon(icon, "train-front");
		titleRow.createEl("h3", { cls: "ft-heading ft-train-title", text: `Train: ${train.title}` });

		const badge = titleRow.createSpan({ cls: `ft-badge ft-badge-muted ft-train-status ft-train-status-${train.status}` });
		badge.setText(train.status);

		// Spacer pushes toggle to the right
		const spacer = titleRow.createSpan();
		spacer.style.flex = "1";

		// Toggle timeline sidebar button
		const toggleBtn = titleRow.createEl("button", {
			cls: "ft-btn ft-btn-ghost ft-btn-sm",
		});
		toggleBtn.ariaLabel = "Toggle timeline sidebar";
		const toggleIcon = toggleBtn.createSpan();
		setIcon(toggleIcon, "panel-right");
		toggleBtn.addEventListener("click", () => {
			void this.eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id });
		});
	}

	private renderNavBar(el: HTMLElement, allThoughts: ThoughtNode[], activeThought: ThoughtNode | null): void {
		const nav = el.createDiv({ cls: "ft-section ft-flex ft-items-center ft-justify-between" });

		const activeIdx = activeThought ? allThoughts.findIndex((t) => t.id === activeThought.id) : -1;

		const prevBtn = nav.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn" });
		prevBtn.setText("◄ Prev");
		if (activeIdx <= 0) {
			prevBtn.disabled = true;
			prevBtn.addClass("ft-train-nav-disabled");
		} else {
			prevBtn.addEventListener("click", () => {
				const prev = allThoughts[activeIdx - 1];
				this.activeThoughtId = prev.id;
				this.emitThoughtActivated(prev);
				this.render();
			});
		}

		const counter = nav.createSpan({ cls: "ft-text-sm ft-text-muted ft-train-nav-counter" });
		counter.setText(allThoughts.length > 0
			? `Thought ${activeIdx + 1} of ${allThoughts.length}`
			: "No thoughts yet");

		const nextBtn = nav.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn" });
		nextBtn.setText("Next ►");
		if (activeIdx >= allThoughts.length - 1) {
			nextBtn.disabled = true;
			nextBtn.addClass("ft-train-nav-disabled");
		} else {
			nextBtn.addEventListener("click", () => {
				const next = allThoughts[activeIdx + 1];
				this.activeThoughtId = next.id;
				this.emitThoughtActivated(next);
				this.render();
			});
		}
	}

	private renderThoughtDetail(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		const detail = el.createDiv({ cls: "ft-section ft-train-detail" });

		detail.createEl("h3", { cls: "ft-heading-sm ft-train-thought-title", text: thought.title });

		const meta = detail.createDiv({ cls: "ft-detail-info-grid ft-train-thought-meta" });
		const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		// Find the relation direction for this thought
		const relation = train.relations.find((r) => r.toId === thought.id);
		const directionLabel = relation ? `→ ${relation.direction}` : "root";

		this.renderInfoRow(meta, "Created", time);
		this.renderInfoRow(meta, "Order", `#${thought.order + 1}`);
		this.renderInfoRow(meta, "Direction", directionLabel);

		// Clickable note link
		const noteLink = detail.createDiv({ cls: "ft-train-note-link ft-flex ft-items-center ft-gap-1 ft-text-sm" });
		const noteLinkIcon = noteLink.createSpan();
		setIcon(noteLinkIcon, "file-text");
		noteLink.createSpan({ text: thought.path.split("/").pop() ?? thought.path });
		noteLink.addEventListener("click", () => {
			if (this.app?.workspace) {
				void this.app.workspace.openLinkText(thought.path, "", false);
			}
		});
	}

	private renderInfoRow(grid: HTMLElement, label: string, value: string): void {
		grid.createDiv({ cls: "ft-detail-info-label", text: label });
		grid.createDiv({ cls: "ft-detail-info-value", text: value });
	}

	/** Render a truncated content preview from the thought's vault note. */
	private renderContentPreview(el: HTMLElement, thought: ThoughtNode): void {
		const preview = el.createDiv({ cls: "ft-train-content-preview" });

		if (!this.app?.vault) {
			preview.setText("(preview unavailable)");
			return;
		}

		preview.setText("Loading preview...");

		// Read the file asynchronously and show first ~200 chars
		const file = this.app.vault.getAbstractFileByPath(thought.path);
		if (file && "extension" in file) {
			void this.app.vault.read(file as import("obsidian").TFile).then((content) => {
				// Strip frontmatter
				const body = content.replace(/^---[\s\S]*?---\n?/, "").trim();
				const snippet = body.length > 200 ? body.slice(0, 200) + "…" : body;
				preview.setText(snippet || "(empty note)");
			}).catch(() => {
				preview.setText("(could not read note)");
			});
		} else {
			preview.setText("(note not found)");
		}
	}

	/** Render a link to the parent train when this is a nested train. */
	private renderParentLink(el: HTMLElement, parentTrainId: string): void {
		const parentTrain = this.trainService.getTrain(parentTrainId);
		if (!parentTrain) return;

		const link = el.createDiv({ cls: "ft-section ft-train-parent-link ft-flex ft-items-center ft-gap-1 ft-text-sm ft-text-muted" });
		const icon = link.createSpan();
		setIcon(icon, "arrow-up-left");
		link.appendText(`Parent: ${parentTrain.title}`);
		link.addEventListener("click", () => {
			this.trainId = parentTrainId;
			this.activeThoughtId = null;
			this.render();
		});
	}

	private renderBranchLinks(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		const branches = this.trainService.getBranches(train.id, thought.id);
		if (branches.length === 0) return;

		const section = el.createDiv({ cls: "ft-section ft-train-branches" });
		section.createEl("h4", { cls: "ft-heading-sm", text: "Branches" });

		for (const branch of branches) {
			const link = section.createDiv({ cls: "ft-train-branch-link" });
			const linkIcon = link.createSpan();
			setIcon(linkIcon, "git-branch");
			link.createSpan({ text: branch.title });
			link.addEventListener("click", () => {
				this.activeThoughtId = branch.id;
				this.emitThoughtActivated(branch);
				this.render();
			});
		}
	}

	// ── Helpers ──────────────────────────────────────────────

	/** Return all thoughts sorted by order — includes main chain AND branches. */
	private getSortedThoughts(train: TrainState): ThoughtNode[] {
		return [...train.thoughts].sort((a, b) => a.order - b.order);
	}

	/** Resolve the currently active thought by ID, falling back to the first thought. */
	private resolveActiveThought(sorted: ThoughtNode[]): ThoughtNode | null {
		if (sorted.length === 0) return null;
		if (this.activeThoughtId) {
			const found = sorted.find((t) => t.id === this.activeThoughtId);
			if (found) return found;
		}
		// Fall back to first thought and pin it
		this.activeThoughtId = sorted[0].id;
		return sorted[0];
	}

	private getTrain(): TrainState | undefined {
		if (this.trainId) {
			return this.trainService.getTrain(this.trainId);
		}
		return this.trainService.getActiveTrain();
	}

	private emitThoughtActivated(thought: ThoughtNode): void {
		void this.eventBus.emit("train.thought.activated", {
			trainId: thought.trainId,
			thoughtId: thought.id,
		});
	}

	private buildContext(): TrainViewContext {
		return {
			getTrainId: () => this.trainId,
			setTrainId: (trainId: string) => { this.trainId = trainId; },
			setActiveThoughtId: (id: string | null) => { this.activeThoughtId = id; },
			scheduleRender: () => this.scheduleRender(),
		};
	}

	private buildPanelDeps(): TrainPanelDeps {
		return {
			trainService: this.trainService,
			eventBus: this.eventBus,
			scheduleRender: () => this.scheduleRender(),
			getActiveThoughtId: () => this.activeThoughtId,
		};
	}
}
