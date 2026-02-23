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
import { BUILT_IN_TRAIN_TYPES } from "../../domain/train/types";
import type { Session, ClosureResponse, ClosureTemplate } from "../../domain/session/types";
import { SESSION_TYPE_CONFIGS } from "../../domain/session/types";
import { resolveClosureTemplate } from "../../domain/session/helpers";
import { SessionClosureOverlay } from "../session/SessionClosureOverlay";
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
	getSessionId: () => string | null;
	setTrainId: (trainId: string) => void;
	setActiveThoughtId: (id: string | null) => void;
	scheduleRender: () => void;
}

export interface TrainViewSettings {
	trainFolder: string;
	trainCanvasEnabled: boolean;
	trainCanvasAutoOpen: boolean;
}

/** Optional closure ritual dependencies — when provided, train detail shows closure after completion. */
export interface TrainClosureDeps {
	getSession: (sessionId: string) => Session | null;
	completeClosure: (sessionId: string, response: ClosureResponse) => void;
	skipClosure: (sessionId: string) => void;
}

export class TrainMainView extends ItemView {
	private eventBus: IEventBus;
	private trainService: TrainService;
	private getTrainSettings: () => TrainViewSettings;
	private closureDeps: TrainClosureDeps | null;
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
		closureDeps?: TrainClosureDeps,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.trainService = trainService;
		this.getTrainSettings = getTrainSettings ?? (() => ({
			trainFolder: "",
			trainCanvasEnabled: true,
			trainCanvasAutoOpen: false,
		}));
		this.closureDeps = closureDeps ?? null;
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
		this.statsPanel?.destroy();
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
		this.statsPanel?.destroy();
		const el = this.contentEl;
		el.empty();

		const train = this.getTrain();
		if (!train) {
			this.renderEmptyState(el);
			return;
		}

		// Closure ritual: when train is completed and session is "reviewing", show overlay
		const linkedSession = this.closureDeps && train.sessionId
			? this.closureDeps.getSession(train.sessionId)
			: null;
		if (linkedSession?.status === "reviewing" && this.closureDeps) {
			this.renderHeader(el, train);
			this.renderClosureOverlay(el, linkedSession, train);
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

		// 3. Completed train: show completion callout + stats summary
		if (train.status === "completed") {
			this.renderCompletionCallout(el, train);

			const statsEl = el.createDiv({ cls: "ft-section ft-train-stats-section" });
			this.statsPanel = new TrainStatsPanel(statsEl, panelDeps);
			this.statsPanel.render(train);
			return;
		}

		// 4. Nav bar + inline controls (combined row — most actionable element)
		this.renderNavBar(el, allThoughts, activeThought, train);

		// 5. Stats panel (with active thought position indicator)
		const statsEl = el.createDiv({ cls: "ft-section ft-train-stats-section" });
		this.statsPanel = new TrainStatsPanel(statsEl, panelDeps);
		const activeIdx = activeThought ? allThoughts.findIndex((t) => t.id === activeThought.id) : -1;
		const activePosition = activeIdx >= 0
			? { index: activeIdx, total: allThoughts.length }
			: undefined;
		this.statsPanel.render(train, activePosition);

		// 6–10. Active thought sections
		if (activeThought) {
			this.renderThoughtDetail(el, activeThought, train);
			this.renderCanvasCallout(el, train);
			this.renderContentPreview(el, activeThought);
			this.renderBranchLinks(el, activeThought, train);
			this.renderMergeSection(el, activeThought, train);
		} else {
			this.renderCanvasCallout(el, train);
		}

		// 11. Breadcrumb (last — grows fast during a session)
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

	private renderCompletionCallout(el: HTMLElement, train: TrainState): void {
		const section = el.createDiv({ cls: "ft-section ft-train-completion-callout" });

		// Icon + heading row
		const headingRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = headingRow.createSpan({ cls: "ft-icon-muted" });
		setIcon(iconEl, "check-circle");
		headingRow.createEl("h3", { cls: "ft-heading-sm", text: "Ride complete" });

		// Summary line
		let branchCount = 0;
		for (const thought of train.thoughts) {
			branchCount += this.trainService.getBranches(train.id, thought.id).length;
		}
		const elapsed = this.computeElapsedLabel(train);
		const parts = [`${train.thoughts.length} thought${train.thoughts.length !== 1 ? "s" : ""}`];
		if (branchCount > 0) parts.push(`${branchCount} branch${branchCount !== 1 ? "es" : ""}`);
		if (elapsed) parts.push(elapsed);
		section.createDiv({ cls: "ft-text-sm ft-text-muted", text: parts.join(" · ") });

		// Artifact links
		const linksRow = section.createDiv({ cls: "ft-flex ft-flex-col ft-gap-1 ft-mt-2" });

		// Summary note link
		const summaryPath = this.getSummaryPath(train);
		if (summaryPath && this.app?.vault?.getAbstractFileByPath(summaryPath)) {
			const summaryRow = linksRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const summaryIcon = summaryRow.createSpan({ cls: "ft-icon-muted" });
			setIcon(summaryIcon, "file-text");
			const summaryLink = summaryRow.createEl("a", { cls: "ft-text-sm", text: `${train.title} — Summary` });
			summaryLink.addEventListener("click", (e) => {
				e.preventDefault();
				if (this.app?.workspace) {
					void this.app.workspace.openLinkText(summaryPath, "", false);
				}
			});
		}

		// Canvas link
		const canvasPath = this.getCanvasPathForTrain(train);
		if (canvasPath && this.app?.vault?.getAbstractFileByPath(canvasPath)) {
			const canvasRow = linksRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const canvasIcon = canvasRow.createSpan({ cls: "ft-icon-muted" });
			setIcon(canvasIcon, "layout-dashboard");
			const canvasLink = canvasRow.createEl("a", { cls: "ft-text-sm", text: `${train.title}.canvas` });
			canvasLink.addEventListener("click", (e) => {
				e.preventDefault();
				if (this.app?.workspace) {
					void this.app.workspace.openLinkText(canvasPath, "", false);
				}
			});
		}

		// CTA
		const ctaRow = section.createDiv({ cls: "ft-mt-3" });
		const cta = ctaRow.createEl("button", { cls: "ft-btn ft-btn-primary" });
		cta.setText("Start a new ride");
		cta.addEventListener("click", () => {
			void this.eventBus.emit("ui.startTrain", {});
		});
	}

	private computeElapsedLabel(train: TrainState): string {
		if (!train.createdAt) return "";
		const start = new Date(train.createdAt).getTime();
		const end = train.completedAt
			? new Date(train.completedAt).getTime()
			: Date.now();
		const mins = Math.floor(Math.max(0, end - start) / 60_000);
		if (mins < 1) return "< 1 min";
		return `${mins} min`;
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

		// Summary note link (file-text icon) — only when summary exists
		const summaryPath = this.getSummaryPath(train);
		if (summaryPath && this.app?.vault?.getAbstractFileByPath(summaryPath)) {
			const summaryBtn = titleRow.createEl("button", {
				cls: "clickable-icon ft-train-summary-btn",
			});
			summaryBtn.ariaLabel = "Open summary note";
			setIcon(summaryBtn, "file-text");
			summaryBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (this.app?.workspace) {
					void this.app.workspace.openLinkText(summaryPath, "", false);
				}
			});
		}

		const badge = titleRow.createSpan({ cls: `ft-badge ft-badge-muted ft-train-status ft-train-status-${train.status}` });
		badge.setText(train.status);

		// Type badge
		const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
		const typeLabel = typeConfig?.label ?? "Free-form";
		const typeBadge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-type-badge" });
		const typeIcon = typeBadge.createSpan();
		setIcon(typeIcon, typeConfig?.icon ?? "pen-line");
		typeBadge.appendText(` ${typeLabel}`);

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

		// Graph-based navigation: follow relations instead of flat order
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		const prevRelation = activeThought
			? train.relations.find((r) => r.toId === activeThought.id && r.direction === "next")
			: null;
		const prevThought = prevRelation ? thoughtById.get(prevRelation.fromId) ?? null : null;
		const nextRelation = activeThought
			? train.relations.find((r) => r.fromId === activeThought.id && r.direction === "next")
			: null;
		const nextThought = nextRelation ? thoughtById.get(nextRelation.toId) ?? null : null;

		// Left: ◄ Prev
		const prevBtn = nav.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-prev-btn" });
		prevBtn.setText("◄ Prev");
		if (!prevThought) {
			prevBtn.disabled = true;
			prevBtn.addClass("ft-train-nav-disabled");
		} else {
			prevBtn.addEventListener("click", () => {
				this.activeThoughtId = prevThought.id;
				this.emitThoughtActivated(prevThought);
				this.render();
			});
		}

		// Center: inline controls
		if (train.status !== "completed") {
			const controls = nav.createDiv({ cls: "ft-detail-actions ft-flex ft-items-center ft-gap-1" });
			this.renderInlineControls(controls, train);
		}

		// Right group: Merge Down / Next ► / Add Thought + End
		const rightGroup = nav.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		const mergeDownInfo = (activeThought && train.status !== "completed")
			? this.trainService.findMergeDownTarget(train.id, activeThought.id)
			: null;

		if (mergeDownInfo) {
			const target = mergeDownInfo.targetId
				? train.thoughts.find((t) => t.id === mergeDownInfo.targetId)
				: null;
			const mergeBtn = rightGroup.createEl("button", {
				cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-merge-down-btn",
			});
			const mdIcon = mergeBtn.createSpan();
			setIcon(mdIcon, "git-merge");
			mergeBtn.appendText(` Merge down${target ? ` \u2192 ${target.title}` : ""}`);
			mergeBtn.addEventListener("click", () => {
				const fromThoughtId = activeThought!.id;
				void this.eventBus.emit("ui.startTrain", { fromThoughtId, mergeDown: true });
			});
		} else if (nextThought) {
			const nextBtn = rightGroup.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-next-btn" });
			nextBtn.setText("Next ►");
			nextBtn.addEventListener("click", () => {
				this.activeThoughtId = nextThought.id;
				this.emitThoughtActivated(nextThought);
				this.render();
			});
		} else if (activeThought && train.status !== "completed") {
			const addBtn = rightGroup.createEl("button", {
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

		// End button — last in the row (far right)
		const headNode = this.trainService.getHeadNode(train.id);
		if (headNode && activeThought && headNode.id !== activeThought.id) {
			const jumpBtn = rightGroup.createEl("button", {
				cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-jump-to-end-btn",
			});
			const jumpIcon = jumpBtn.createSpan();
			setIcon(jumpIcon, "fast-forward");
			jumpBtn.appendText(" End");
			jumpBtn.addEventListener("click", () => {
				this.activeThoughtId = headNode.id;
				this.emitThoughtActivated(headNode);
				this.render();
			});
		}

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

		const titleRow = detail.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		titleRow.createEl("h3", { cls: "ft-heading-sm ft-train-thought-title", text: thought.title });

		// Merged badge — shown when this thought was merged into another
		const isMerged = train.relations.some((r) => r.fromId === thought.id && r.direction === "merge");
		if (isMerged) {
			const badge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-merged-badge" });
			badge.setText("merged");
		}

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

	/** Derive the canvas path for a train from its per-train folder. */
	private getCanvasPathForTrain(train: TrainState): string | null {
		const { trainCanvasEnabled } = this.getTrainSettings();
		if (!trainCanvasEnabled || !train.folderPath) return null;
		return getCanvasPath(train.title, train.folderPath);
	}

	private getSummaryPath(train: TrainState): string | null {
		const folder = train.folderPath;
		if (!folder) return null;
		return `${folder}/${train.title} — Summary.md`;
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

	/** Render closure ritual overlay in place of normal train content. */
	private renderClosureOverlay(el: HTMLElement, session: Session, train: TrainState): void {
		const typeTemplates = this.getTypeClosureTemplates();
		const template = resolveClosureTemplate(session, undefined, typeTemplates);
		const deps = this.closureDeps!;

		const overlay = new SessionClosureOverlay(el, session, template, {
			onSubmit: (response) => {
				deps.completeClosure(session.id, response);
				// Close timeline sidebar after closure
				void this.eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id, forceClose: true });
			},
			onSkip: () => {
				deps.skipClosure(session.id);
				void this.eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id, forceClose: true });
			},
		});
		overlay.render();
	}

	/** Collect type-specific closure templates from built-in session type configs. */
	private getTypeClosureTemplates(): Record<string, ClosureTemplate> | undefined {
		const result: Record<string, ClosureTemplate> = {};
		let hasAny = false;
		for (const [type, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}
		return hasAny ? result : undefined;
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
			getSessionId: () => {
				const train = this.getTrain();
				return train?.sessionId ?? null;
			},
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
