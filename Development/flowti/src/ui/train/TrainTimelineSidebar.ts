/**
 * Train Timeline Sidebar — vertical timeline view showing the thought graph.
 *
 * Extends ItemView directly (same pattern as TrainMainView).
 * Renders a vertical node list with connectors, branch indentation,
 * and active-node highlighting. Syncs bidirectionally with TrainMainView
 * via `train.thought.activated`.
 *
 * Layout: header → scrollable node list (main chain + branch forks).
 * Event subscriptions: TrainTimelineSidebarSubscriptions.ts
 */

import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { ThoughtNode, TrainState } from "../../domain/train/types";
import { VIEW_TYPE_TRAIN_TIMELINE } from "./types";
import { setupTrainTimelineSubscriptions } from "./TrainTimelineSidebarSubscriptions";

// Re-export for backward compat
export { VIEW_TYPE_TRAIN_TIMELINE } from "./types";

/** Context interface for subscription handlers. */
export interface TrainTimelineContext {
	getTrainId: () => string | null;
	setTrainId: (id: string | null) => void;
	setActiveThoughtId: (id: string | null) => void;
	scheduleRender: () => void;
}

export class TrainTimelineSidebar extends ItemView {
	private eventBus: IEventBus;
	private trainService: TrainService;
	private unsubscribes: (() => void)[] = [];
	private trainId: string | null = null;
	private activeThoughtId: string | null = null;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, trainService: TrainService) {
		super(leaf);
		this.eventBus = eventBus;
		this.trainService = trainService;
	}

	getViewType(): string {
		return VIEW_TYPE_TRAIN_TIMELINE;
	}

	getDisplayText(): string {
		const train = this.getTrain();
		return train ? `Timeline: ${train.title}` : "Train Timeline";
	}

	getIcon(): string {
		return "git-branch";
	}

	async onOpen(): Promise<void> {
		this.containerEl.addClass("ft-hide-header");

		if (!this.trainId) {
			const active = this.trainService.getActiveTrain();
			if (active) {
				this.trainId = active.id;
			}
		}

		this.render();
		this.unsubscribes = setupTrainTimelineSubscriptions(this.buildContext(), this.eventBus);
	}

	async setState(state: Record<string, unknown>, result: import("obsidian").ViewStateResult): Promise<void> {
		if (state?.trainId && typeof state.trainId === "string") {
			this.trainId = state.trainId;
		}
		if (state?.activeThoughtId && typeof state.activeThoughtId === "string") {
			this.activeThoughtId = state.activeThoughtId;
		}
		this.render();
		await super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return {
			trainId: this.trainId ?? null,
			activeThoughtId: this.activeThoughtId ?? null,
		};
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

		this.renderHeader(el, train);
		this.renderTimeline(el, train);
	}

	private renderEmptyState(el: HTMLElement): void {
		const empty = el.createDiv({ cls: "flowti-timeline-empty" });
		empty.createEl("p", { text: "No active train." });
	}

	private renderHeader(el: HTMLElement, train: TrainState): void {
		const header = el.createDiv({ cls: "flowti-timeline-header" });

		const titleRow = header.createDiv({ cls: "flowti-timeline-title-row" });
		const icon = titleRow.createSpan({ cls: "flowti-timeline-icon" });
		setIcon(icon, "train-front");
		titleRow.createSpan({ cls: "flowti-timeline-title", text: train.title });

		const badge = titleRow.createSpan({ cls: `flowti-timeline-status flowti-timeline-status-${train.status}` });
		badge.setText(train.status);
	}

	private renderTimeline(el: HTMLElement, train: TrainState): void {
		const container = el.createDiv({ cls: "flowti-timeline-container" });
		const timeline = this.trainService.getTimeline(train.id);

		if (timeline.length === 0) {
			container.createDiv({ cls: "flowti-timeline-empty-chain", text: "No thoughts yet" });
			return;
		}

		// Render each node in the main chain, with branch sub-trees
		for (let i = 0; i < timeline.length; i++) {
			const thought = timeline[i];
			this.renderNode(container, thought, train, 0);

			// Render branches for this thought
			const branches = this.trainService.getBranches(train.id, thought.id);
			for (const branch of branches) {
				this.renderNode(container, branch, train, 1);
			}
		}
	}

	private renderNode(
		container: HTMLElement,
		thought: ThoughtNode,
		train: TrainState,
		depth: number,
	): void {
		const isActive = thought.id === this.activeThoughtId;
		const cls = [
			"flowti-timeline-node",
			isActive ? "flowti-timeline-node-active" : "",
			depth > 0 ? "flowti-timeline-node-branch" : "",
		].filter(Boolean).join(" ");

		const node = container.createDiv({ cls });

		if (depth > 0) {
			node.style.paddingLeft = `${depth * 16}px`;
		}

		// Connector line + bullet
		const bulletRow = node.createDiv({ cls: "flowti-timeline-bullet-row" });

		const bullet = bulletRow.createSpan({
			cls: `flowti-timeline-bullet ${isActive ? "flowti-timeline-bullet-active" : ""}`,
		});
		bullet.setText(isActive ? "●" : "○");

		if (depth > 0) {
			const branchIndicator = bulletRow.createSpan({ cls: "flowti-timeline-branch-indicator" });
			branchIndicator.setText("↗");
		}

		// Title
		bulletRow.createSpan({
			cls: "flowti-timeline-node-title",
			text: thought.title,
		});

		// Timestamp
		const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		node.createDiv({
			cls: "flowti-timeline-node-time",
			text: time,
		});

		// Click to navigate
		node.addEventListener("click", () => {
			this.activeThoughtId = thought.id;
			void this.eventBus.emit("train.thought.activated", {
				trainId: train.id,
				thoughtId: thought.id,
			});
			this.render();
		});
	}

	// ── Helpers ──────────────────────────────────────────────

	private getTrain(): TrainState | undefined {
		if (this.trainId) {
			return this.trainService.getTrain(this.trainId);
		}
		return this.trainService.getActiveTrain();
	}

	private buildContext(): TrainTimelineContext {
		return {
			getTrainId: () => this.trainId,
			setTrainId: (id: string | null) => { this.trainId = id; },
			setActiveThoughtId: (id: string | null) => { this.activeThoughtId = id; },
			scheduleRender: () => this.scheduleRender(),
		};
	}
}
