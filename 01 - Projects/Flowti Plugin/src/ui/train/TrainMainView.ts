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

import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { ThoughtNode, TrainState } from "../../domain/train/types";
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
import { ConfirmModal } from "../modals";
import {
	renderHeader as renderTrainHeader,
	renderCompletionCallout as renderTrainCompletionCallout,
	renderThoughtDetail as renderTrainThoughtDetail,
	renderContentPreview as renderTrainContentPreview,
	renderCanvasCallout as renderTrainCanvasCallout,
	renderParentLink as renderTrainParentLink,
	renderBranchLinks as renderTrainBranchLinks,
	renderMergeSection as renderTrainMergeSection,
	renderNavBar as renderTrainNavBar,
	getCanvasPathForTrain as getCanvasPathHelper,
	showRenameInput as showRenameInputHelper,
} from "./TrainMainViewRenderers";

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
			onSelectTrain: (trainId) => { this.trainId = trainId; this.activeThoughtId = null; this.render(); },
			onRenameTrain: (trainId, currentTitle) => {
				showRenameInputHelper(this.app, { id: trainId, title: currentTitle } as TrainState, this.trainService, () => this.render());
			},
			onDeleteTrain: (trainId, title) => {
				new ConfirmModal(this.app, {
					message: `Delete train "${title}"? This removes the train from history. Thought notes are preserved.`,
					confirmLabel: "Delete",
					onConfirm: () => { void this.trainService.deleteTrain(trainId).then((ok) => { if (ok) { if (this.trainId === trainId) { this.trainId = null; this.activeThoughtId = null; } this.render(); } }); },
				}).open();
			},
		});
		panel.render();
	}

	private renderCompletionCallout(el: HTMLElement, train: TrainState): void {
		renderTrainCompletionCallout(el, train, this.trainService, this.eventBus, this.app, (t) => this.getCanvasPathForTrain(t));
	}

	private renderHeader(el: HTMLElement, train: TrainState): void {
		renderTrainHeader(el, train, this.eventBus, this.app, (t) => this.showRenameInput(t));
	}

	private renderNavBar(el: HTMLElement, allThoughts: ThoughtNode[], activeThought: ThoughtNode | null, train: TrainState): void {
		renderTrainNavBar(
			el, allThoughts, activeThought, train,
			this.trainService, this.eventBus,
			(thought) => { this.activeThoughtId = thought.id; this.emitThoughtActivated(thought); this.render(); },
			() => this.scheduleRender(),
			() => this.activeThoughtId,
		);
	}

	private renderCanvasCallout(el: HTMLElement, train: TrainState): void {
		renderTrainCanvasCallout(el, train, this.getCanvasPathForTrain(train), this.app);
	}

	private renderThoughtDetail(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		renderTrainThoughtDetail(el, thought, train);
		// Re-bind note link click to use this view's app reference
		const noteLink = el.querySelector(".ft-train-note-link");
		if (noteLink) {
			const newLink = noteLink.cloneNode(true) as HTMLElement;
			noteLink.replaceWith(newLink);
			newLink.addEventListener("click", () => {
				if (this.app?.workspace) void this.app.workspace.openLinkText(thought.path, "", false);
			});
		}
	}

	private renderContentPreview(el: HTMLElement, thought: ThoughtNode): void {
		renderTrainContentPreview(el, thought, this.app);
	}

	private renderParentLink(el: HTMLElement, parentTrainId: string): void {
		renderTrainParentLink(el, parentTrainId, this.trainService, (id) => {
			this.trainId = id;
			this.activeThoughtId = null;
			this.render();
		});
	}

	private renderBranchLinks(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		renderTrainBranchLinks(el, thought, train, this.trainService, (id) => {
			this.activeThoughtId = id;
			const t = train.thoughts.find((th) => th.id === id);
			if (t) this.emitThoughtActivated(t);
			this.render();
		});
	}

	private renderMergeSection(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		renderTrainMergeSection(el, thought, train, this.trainService);
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
		return getCanvasPathHelper(train, trainCanvasEnabled);
	}

	private showRenameInput(train: TrainState): void {
		showRenameInputHelper(this.app, train, this.trainService, () => this.render());
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
