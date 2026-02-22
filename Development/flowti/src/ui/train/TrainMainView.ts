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
import { TrainBreadcrumbPanel } from "./TrainBreadcrumbPanel";
import { TrainHistoryPanel } from "./TrainHistoryPanel";
import { getCanvasPath } from "../../domain/train/helpers";
import { InputModal, ConfirmModal } from "../modals";

// Re-export for backward compat
export { VIEW_TYPE_TRAIN_MAIN } from "./types";

/** Context interface for subscription handlers. */
export interface TrainViewContext {
	getTrainId: () => string | null;
	setTrainId: (trainId: string) => void;
	setActiveThoughtId: (id: string | null) => void;
	scheduleRender: () => void;
}

export interface TrainViewSettings {
	trainFolder: string;
	trainCanvasEnabled: boolean;
	trainCanvasAutoOpen: boolean;
}

export class TrainMainView extends ItemView {
	private eventBus: IEventBus;
	private trainService: TrainService;
	private getTrainSettings: () => TrainViewSettings;
	private unsubscribes: (() => void)[] = [];
	private trainId: string | null = null;
	private activeThoughtId: string | null = null;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private statsPanel!: TrainStatsPanel;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		trainService: TrainService,
		getTrainSettings?: () => TrainViewSettings,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.trainService = trainService;
		this.getTrainSettings = getTrainSettings ?? (() => ({
			trainFolder: "",
			trainCanvasEnabled: true,
			trainCanvasAutoOpen: false,
		}));
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
			const trainChanged = this.trainId !== state.trainId;
			this.trainId = state.trainId;
			// Only reset activeThoughtId when switching to a different train
			if (trainChanged) {
				this.activeThoughtId = null;
			}
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

		// 1. Header
		this.renderHeader(el, train);

		// 2. Parent train link
		if (train.parentTrainId) {
			this.renderParentLink(el, train.parentTrainId);
		}

		// 3. Nav bar + inline controls (combined row — most actionable element)
		this.renderNavBar(el, allThoughts, activeThought, train);

		// 4. Stats panel
		const statsEl = el.createDiv({ cls: "ft-section ft-train-stats-section" });
		this.statsPanel = new TrainStatsPanel(statsEl, panelDeps);
		this.statsPanel.render(train);

		// 5–9. Active thought sections
		if (activeThought) {
			this.renderThoughtDetail(el, activeThought, train);
			this.renderCanvasCallout(el, train);
			this.renderContentPreview(el, activeThought);
			this.renderBranchLinks(el, activeThought, train);
			this.renderMergeSection(el, activeThought, train);
		} else {
			this.renderCanvasCallout(el, train);
		}

		// 10. Breadcrumb (last — grows fast during a session)
		const breadcrumbEl = el.createDiv({ cls: "ft-section ft-train-breadcrumb-section" });
		const breadcrumb = new TrainBreadcrumbPanel(breadcrumbEl, panelDeps);
		breadcrumb.render(train, activeThought);
	}

	private renderEmptyState(el: HTMLElement): void {
		const historyEl = el.createDiv({ cls: "ft-train-empty" });
		const panel = new TrainHistoryPanel(historyEl, {
			trainService: this.trainService,
			onSelectTrain: (trainId) => {
				this.trainId = trainId;
				this.activeThoughtId = null;
				this.render();
			},
			onRenameTrain: (trainId, currentTitle) => {
				new InputModal(this.app, {
					title: "Rename Train",
					inputName: "New title",
					inputDesc: "Enter a new name for this train",
					defaultValue: currentTitle,
					submitLabel: "Rename",
					onSubmit: (newTitle) => {
						if (newTitle !== currentTitle) {
							void this.trainService.renameTrain(trainId, newTitle).then((ok) => {
								if (ok) this.render();
							});
						}
					},
				}).open();
			},
			onDeleteTrain: (trainId, title) => {
				new ConfirmModal(this.app, {
					message: `Delete train "${title}"? This removes the train from history. Thought notes are preserved.`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.trainService.deleteTrain(trainId).then((ok) => {
							if (ok) {
								if (this.trainId === trainId) {
									this.trainId = null;
									this.activeThoughtId = null;
								}
								this.render();
							}
						});
					},
				}).open();
			},
		});
		panel.render();
	}

	private renderHeader(el: HTMLElement, train: TrainState): void {
		const header = el.createDiv({ cls: "ft-section" });

		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = titleRow.createSpan();
		setIcon(icon, "train-front");
		titleRow.createEl("h3", { cls: "ft-heading ft-train-title", text: `Train: ${train.title}` });

		// Rename button (pencil icon)
		const renameBtn = titleRow.createEl("button", {
			cls: "clickable-icon ft-train-rename-btn",
		});
		renameBtn.ariaLabel = "Rename train";
		setIcon(renameBtn, "pencil");
		renameBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.showRenameInput(train);
		});

		const badge = titleRow.createSpan({ cls: `ft-badge ft-badge-muted ft-train-status ft-train-status-${train.status}` });
		badge.setText(train.status);

		// Spacer pushes buttons to the right
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

	private renderNavBar(
		el: HTMLElement,
		allThoughts: ThoughtNode[],
		activeThought: ThoughtNode | null,
		train: TrainState,
	): void {
		const navWrapper = el.createDiv({ cls: "ft-section ft-train-nav-wrapper" });

		const nav = navWrapper.createDiv({ cls: "ft-flex ft-items-center ft-justify-between ft-gap-2 ft-train-nav-bar" });
		const activeIdx = activeThought ? allThoughts.findIndex((t) => t.id === activeThought.id) : -1;

		// Left: ◄ Prev
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

		// Center: inline controls
		if (train.status !== "completed") {
			const controls = nav.createDiv({ cls: "ft-detail-actions ft-flex ft-items-center ft-gap-1" });
			this.renderInlineControls(controls, train);
		}

		// Right: Merge Down / Next ► / Add Thought (context-aware, graph-based)
		// Priority: merge-down (branch endpoint) > next (sorted list) > add thought (end of list)
		const mergeDownTargetId = (activeThought && train.status !== "completed")
			? this.trainService.findMergeDownTarget(train.id, activeThought.id)
			: null;
		const hasNext = activeIdx >= 0 && activeIdx < allThoughts.length - 1;

		if (mergeDownTargetId) {
			// Branch endpoint → Merge Down (always takes priority)
			const target = train.thoughts.find((t) => t.id === mergeDownTargetId);
			const mergeBtn = nav.createEl("button", {
				cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-merge-down-btn",
			});
			const mdIcon = mergeBtn.createSpan();
			setIcon(mdIcon, "git-merge");
			mergeBtn.appendText(` Merge down${target ? ` → ${target.title}` : ""}`);
			mergeBtn.addEventListener("click", () => {
				void this.trainService.mergeBranch(train.id, activeThought!.id, mergeDownTargetId);
			});
		} else if (hasNext) {
			const nextBtn = nav.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn" });
			nextBtn.setText("Next ►");
			nextBtn.addEventListener("click", () => {
				const next = allThoughts[activeIdx + 1];
				this.activeThoughtId = next.id;
				this.emitThoughtActivated(next);
				this.render();
			});
		} else if (activeThought && train.status !== "completed") {
			// End of sorted list, not a branch endpoint → Add Thought
			const addBtn = nav.createEl("button", {
				cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-add-thought-btn",
			});
			const addIcon = addBtn.createSpan();
			setIcon(addIcon, "plus-circle");
			addBtn.appendText(" Add Thought");
			addBtn.addEventListener("click", () => {
				const fromThoughtId = this.activeThoughtId ?? undefined;
				void this.eventBus.emit("ui.startTrain", { fromThoughtId });
			});
		}

		// Counter on its own row below controls
		const counter = navWrapper.createDiv({ cls: "ft-text-sm ft-text-muted ft-text-center ft-train-nav-counter" });
		counter.setText(allThoughts.length > 0
			? `Thought ${activeIdx + 1} of ${allThoughts.length}`
			: "No thoughts yet");
	}

	private renderInlineControls(container: HTMLElement, train: TrainState): void {
		if (train.status === "running") {
			this.addNavButton(container, "Pause", "pause", async () => {
				await this.trainService.pause(train.id);
				this.scheduleRender();
			});
			this.addNavButton(container, "Complete", "check-circle", async () => {
				await this.trainService.completeTrain(train.id);
				this.scheduleRender();
			});
		} else if (train.status === "paused") {
			this.addNavButton(container, "Resume", "play", () => {
				const fromThoughtId = this.activeThoughtId ?? undefined;
				void this.eventBus.emit("ui.startTrain", { fromThoughtId });
			}, true);
			this.addNavButton(container, "Complete", "check-circle", async () => {
				await this.trainService.completeTrain(train.id);
				this.scheduleRender();
			});
		}
	}

	private addNavButton(
		bar: HTMLElement,
		label: string,
		icon: string,
		onClick: () => void | Promise<void>,
		primary = false,
	): void {
		const cls = primary
			? "ft-btn ft-btn-primary ft-btn-sm"
			: "ft-btn ft-btn-secondary ft-btn-sm";
		const btn = bar.createEl("button", { cls });
		const iconEl = btn.createSpan();
		setIcon(iconEl, icon);
		btn.appendText(` ${label}`);
		btn.addEventListener("click", () => { void onClick(); });
	}

	/** Render a canvas callout card — shows canvas status, clickable to open. */
	private renderCanvasCallout(el: HTMLElement, train: TrainState): void {
		const canvasPath = this.getCanvasPathForTrain(train);
		if (!canvasPath) return;

		const callout = el.createDiv({ cls: "ft-section ft-train-canvas-callout ft-flex ft-items-center ft-gap-2" });
		const icon = callout.createSpan();
		setIcon(icon, "layout-dashboard");

		const canvasExists = this.app?.vault?.getAbstractFileByPath(canvasPath);

		if (canvasExists) {
			callout.createSpan({ cls: "ft-text-sm", text: `Canvas: ${train.title}` });
			const openBtn = callout.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm" });
			openBtn.setText("Open");
			openBtn.addEventListener("click", () => {
				if (this.app?.workspace) {
					void this.app.workspace.openLinkText(canvasPath, "", false);
				}
			});
		} else {
			callout.createSpan({ cls: "ft-text-sm ft-text-muted", text: "Canvas will be created on first thought" });
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

	// ── Merge UI ─────────────────────────────────────────────

	private renderMergeSection(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		// Only show merge UI on running/paused trains
		if (train.status === "completed") return;

		// Show existing outgoing merges from this thought
		const outgoingMerges = train.relations.filter(
			(r) => r.fromId === thought.id && r.direction === "merge",
		);

		// Skip section entirely if no existing merges to display
		if (outgoingMerges.length === 0) return;

		const section = el.createDiv({ cls: "ft-section ft-train-merge-section" });

		// Existing merges with undo
		const mergeHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mb-1" });
		const headerIcon = mergeHeader.createSpan();
		setIcon(headerIcon, "git-merge");
		mergeHeader.createSpan({ cls: "ft-heading-sm", text: "Merged into" });

		for (const merge of outgoingMerges) {
			const target = train.thoughts.find((t) => t.id === merge.toId);
			if (!target) continue;

			const row = section.createDiv({ cls: "ft-train-merge-link ft-flex ft-items-center ft-gap-2 ft-pl-2" });
			row.createSpan({ cls: "ft-text-sm", text: `→ ${target.title}` });

			const undoBtn = row.createEl("button", {
				cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-merge-undo",
			});
			undoBtn.ariaLabel = "Undo merge";
			setIcon(undoBtn, "undo-2");
			undoBtn.addEventListener("click", () => {
				void this.trainService.undoMerge(train.id, thought.id, target.id);
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

	/** Derive the canvas path for a train from settings. */
	private getCanvasPathForTrain(train: TrainState): string | null {
		const { trainFolder, trainCanvasEnabled } = this.getTrainSettings();
		if (!trainCanvasEnabled || !trainFolder) return null;
		return getCanvasPath(train.title, trainFolder);
	}

	private showRenameInput(train: TrainState): void {
		new InputModal(this.app, {
			title: "Rename Train",
			inputName: "New title",
			inputDesc: "Enter a new name for this train",
			defaultValue: train.title,
			submitLabel: "Rename",
			onSubmit: (newTitle) => {
				if (newTitle !== train.title) {
					void this.trainService.renameTrain(train.id, newTitle).then((ok) => {
						if (ok) this.render();
					});
				}
			},
		}).open();
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
