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
import { setupTrainViewSubscriptions } from "./TrainMainViewSubscriptions";

// Re-export for backward compat
export { VIEW_TYPE_TRAIN_MAIN } from "./types";

/** Context interface for subscription handlers. */
export interface TrainViewContext {
	getTrainId: () => string | null;
	setActiveThoughtIndex: (index: number) => void;
	scheduleRender: () => void;
}

export class TrainMainView extends ItemView {
	private eventBus: IEventBus;
	private trainService: TrainService;
	private unsubscribes: (() => void)[] = [];
	private trainId: string | null = null;
	private activeThoughtIndex = 0;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;

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
	}

	async setState(state: Record<string, unknown>, result: import("obsidian").ViewStateResult): Promise<void> {
		if (state?.trainId && typeof state.trainId === "string") {
			this.trainId = state.trainId;
			this.activeThoughtIndex = 0;
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

		const timeline = this.trainService.getTimeline(train.id);
		const activeThought = timeline[this.activeThoughtIndex] ?? null;

		this.renderHeader(el, train);
		this.renderNavBar(el, timeline);

		if (activeThought) {
			this.renderThoughtDetail(el, activeThought, train);
			this.renderBranchLinks(el, activeThought, train);
		}

		this.renderActions(el, train);
	}

	private renderEmptyState(el: HTMLElement): void {
		const empty = el.createDiv({ cls: "flowti-train-empty" });
		empty.createEl("p", { text: "No active train. Start one from the command palette or ribbon." });
	}

	private renderHeader(el: HTMLElement, train: TrainState): void {
		const header = el.createDiv({ cls: "flowti-train-header" });

		const titleRow = header.createDiv({ cls: "flowti-train-title-row" });
		const icon = titleRow.createSpan({ cls: "flowti-train-icon" });
		setIcon(icon, "train-front");
		titleRow.createSpan({ cls: "flowti-train-title", text: `Train: ${train.title}` });

		const badge = titleRow.createSpan({ cls: `flowti-train-status flowti-train-status-${train.status}` });
		badge.setText(train.status);
	}

	private renderNavBar(el: HTMLElement, timeline: ThoughtNode[]): void {
		const nav = el.createDiv({ cls: "flowti-train-nav" });

		const prevBtn = nav.createEl("button", { cls: "flowti-train-nav-btn", text: "◄ Prev" });
		if (this.activeThoughtIndex <= 0) {
			prevBtn.disabled = true;
			prevBtn.addClass("flowti-train-nav-disabled");
		} else {
			prevBtn.addEventListener("click", () => {
				this.activeThoughtIndex--;
				this.emitThoughtActivated(timeline[this.activeThoughtIndex]);
				this.render();
			});
		}

		const counter = nav.createSpan({ cls: "flowti-train-nav-counter" });
		counter.setText(timeline.length > 0
			? `Thought ${this.activeThoughtIndex + 1} of ${timeline.length}`
			: "No thoughts yet");

		const nextBtn = nav.createEl("button", { cls: "flowti-train-nav-btn", text: "Next ►" });
		if (this.activeThoughtIndex >= timeline.length - 1) {
			nextBtn.disabled = true;
			nextBtn.addClass("flowti-train-nav-disabled");
		} else {
			nextBtn.addEventListener("click", () => {
				this.activeThoughtIndex++;
				this.emitThoughtActivated(timeline[this.activeThoughtIndex]);
				this.render();
			});
		}
	}

	private renderThoughtDetail(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		const detail = el.createDiv({ cls: "flowti-train-detail" });

		detail.createEl("h3", { cls: "flowti-train-thought-title", text: thought.title });

		const meta = detail.createDiv({ cls: "flowti-train-thought-meta" });
		const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		// Find the relation direction for this thought
		const relation = train.relations.find((r) => r.toId === thought.id);
		const directionLabel = relation ? `→ ${relation.direction}` : "root";

		meta.setText(`Created: ${time} · Order: #${thought.order + 1} · ${directionLabel}`);
	}

	private renderBranchLinks(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
		const branches = this.trainService.getBranches(train.id, thought.id);
		if (branches.length === 0) return;

		const section = el.createDiv({ cls: "flowti-train-branches" });
		section.createEl("h4", { text: "Branches:" });

		for (const branch of branches) {
			const link = section.createDiv({ cls: "flowti-train-branch-link" });
			link.createSpan({ text: `↗ ${branch.title}` });
			link.addEventListener("click", () => {
				// Find branch index in timeline, or switch to it
				const timeline = this.trainService.getTimeline(train.id);
				const idx = timeline.findIndex((t) => t.id === branch.id);
				if (idx >= 0) {
					this.activeThoughtIndex = idx;
				}
				this.emitThoughtActivated(branch);
				this.render();
			});
		}
	}

	private renderActions(el: HTMLElement, train: TrainState): void {
		const actions = el.createDiv({ cls: "flowti-train-actions" });

		// Open in editor — opens the active thought's vault note
		const timeline = this.trainService.getTimeline(train.id);
		const activeThought = timeline[this.activeThoughtIndex];
		if (activeThought) {
			const openBtn = actions.createEl("button", { cls: "flowti-train-action-btn", text: "Open in Editor" });
			const openIcon = openBtn.createSpan({ cls: "flowti-train-action-icon" });
			setIcon(openIcon, "file-text");
			openBtn.addEventListener("click", () => {
				void this.app.workspace.openLinkText(activeThought.path, "");
			});
		}

		// Resume capture — reopens the capture modal
		if (train.status !== "completed") {
			const resumeBtn = actions.createEl("button", { cls: "flowti-train-action-btn flowti-train-action-primary", text: "Resume Capture" });
			const resumeIcon = resumeBtn.createSpan({ cls: "flowti-train-action-icon" });
			setIcon(resumeIcon, "plus-circle");
			resumeBtn.addEventListener("click", () => {
				void this.eventBus.emit("ui.startTrain", {});
			});
		}
	}

	// ── Helpers ──────────────────────────────────────────────

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
			setActiveThoughtIndex: (index: number) => { this.activeThoughtIndex = index; },
			scheduleRender: () => this.scheduleRender(),
		};
	}
}
