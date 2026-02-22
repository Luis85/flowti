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
	private collapsedNodes = new Set<string>();

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
		const empty = el.createDiv({ cls: "ft-timeline-empty ft-train-empty" });
		const iconEl = empty.createDiv();
		setIcon(iconEl, "train-front");
		empty.createEl("p", { text: "No active train." });
	}

	private renderHeader(el: HTMLElement, train: TrainState): void {
		const header = el.createDiv({ cls: "ft-section ft-timeline-header" });

		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = titleRow.createSpan();
		setIcon(icon, "train-front");
		titleRow.createSpan({ cls: "ft-heading-sm ft-timeline-title", text: train.title });

		const badge = titleRow.createSpan({ cls: `ft-badge ft-badge-muted ft-timeline-status ft-timeline-status-${train.status}` });
		badge.setText(train.status);

		// Compact stat line
		let branchCount = 0;
		for (const thought of train.thoughts) {
			branchCount += this.trainService.getBranches(train.id, thought.id).length;
		}
		const elapsed = train.createdAt
			? Math.floor((Date.now() - new Date(train.createdAt).getTime()) / 60_000)
			: 0;
		header.createDiv({
			cls: "ft-text-sm ft-text-muted ft-timeline-stat-line",
			text: `${train.thoughts.length} thoughts · ${branchCount} branches · ${elapsed} min`,
		});
	}

	private renderTimeline(el: HTMLElement, train: TrainState): void {
		const container = el.createDiv({ cls: "ft-timeline-container" });
		const timeline = this.trainService.getTimeline(train.id);

		if (timeline.length === 0) {
			container.createDiv({ cls: "ft-timeline-empty-chain", text: "No thoughts yet" });
			return;
		}

		// Chain-based rendering: walk the "next" chain at depth 0,
		// and for each node render "branch" forks as new chains at depth+1.
		// "next" continuations stay flat; only "branch" increases depth.
		this.renderChain(container, timeline[0], train, 0);

		// Auto-scroll active node into view
		setTimeout(() => {
			const active = container.querySelector(".ft-timeline-node-active");
			active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}, 0);
	}

	/**
	 * Walk a "next" chain starting from `start`, rendering each node at `depth`.
	 * For each node, render "branch" children as new chains at `depth + 1`.
	 * This keeps linear continuations flat and only indents true forks.
	 *
	 * @param isBranchStart  true for the first node of a branch chain (shows connector)
	 * @param isLastBranch   true when this is the last branch sibling (shows └─ vs ├─)
	 */
	private renderChain(
		container: HTMLElement,
		start: ThoughtNode,
		train: TrainState,
		depth: number,
		isBranchStart = false,
		isLastBranch = false,
	): void {
		let current: ThoughtNode | null = start;
		const visited = new Set<string>();
		let isFirst = true;

		while (current && !visited.has(current.id)) {
			visited.add(current.id);

			// Only the first node of a branch chain gets the connector character
			const showConnector = isFirst && isBranchStart;
			const isLast = showConnector && isLastBranch;
			this.renderNode(container, current, train, depth, isLast, showConnector);
			isFirst = false;

			// Render "branch" children as new chains at depth+1 (unless collapsed or depth capped)
			if (!this.collapsedNodes.has(current.id) && depth < 5) {
				const branches = this.trainService.getBranches(train.id, current.id);
				for (let i = 0; i < branches.length; i++) {
					const isLastChild = i === branches.length - 1;
					this.renderChain(container, branches[i], train, depth + 1, true, isLastChild);
				}
			}

			// Follow the "next" child at the SAME depth (linear continuation)
			const nextRelation = train.relations.find(
				(r) => r.fromId === current!.id && r.direction === "next",
			);
			if (nextRelation) {
				current = train.thoughts.find((t) => t.id === nextRelation.toId) ?? null;
			} else {
				current = null;
			}
		}
	}

	private renderNode(
		container: HTMLElement,
		thought: ThoughtNode,
		train: TrainState,
		depth: number,
		isLast: boolean,
		showConnector = false,
	): void {
		const isActive = thought.id === this.activeThoughtId;
		const cls = [
			"ft-timeline-node",
			isActive ? "ft-timeline-node-active" : "",
			depth > 0 ? "ft-timeline-node-branch" : "",
		].filter(Boolean).join(" ");

		const node = container.createDiv({ cls });

		if (depth > 0) {
			node.style.paddingLeft = `${depth * 16}px`;
		}

		// Connector line + bullet
		const bulletRow = node.createDiv({ cls: "ft-timeline-bullet-row" });

		// Tree connector character — only on the first node of a branch fork
		if (showConnector) {
			const connector = bulletRow.createSpan({ cls: "ft-timeline-connector" });
			connector.setText(isLast ? "└─" : "├─");
		}

		const bullet = bulletRow.createSpan({
			cls: `ft-timeline-bullet ${isActive ? "ft-timeline-bullet-active" : ""}`,
		});
		bullet.setText(isActive ? "●" : "○");

		// Title
		bulletRow.createSpan({
			cls: "ft-timeline-node-title",
			text: thought.title,
		});

		// Child count badge + collapse chevron (only "branch" forks — "next" continuations render inline)
		const branchCount = this.trainService.getBranches(train.id, thought.id).length;
		if (branchCount > 0) {
			const isCollapsed = this.collapsedNodes.has(thought.id);
			const chevron = bulletRow.createSpan({ cls: "ft-timeline-chevron" });
			chevron.setText(isCollapsed ? "▸" : "▾");
			chevron.addEventListener("click", (e) => {
				e.stopPropagation();
				if (this.collapsedNodes.has(thought.id)) {
					this.collapsedNodes.delete(thought.id);
				} else {
					this.collapsedNodes.add(thought.id);
				}
				this.render();
			});

			bulletRow.createSpan({
				cls: "ft-badge ft-badge-muted ft-text-sm ft-timeline-branch-badge",
				text: `+${branchCount}`,
			});
		}

		// Merge indicators
		const hasOutgoingMerge = train.relations.some(
			(r) => r.fromId === thought.id && r.direction === "merge",
		);
		const hasIncomingMerge = train.relations.some(
			(r) => r.toId === thought.id && r.direction === "merge",
		);
		if (hasOutgoingMerge) {
			bulletRow.createSpan({
				cls: "ft-badge ft-badge-accent ft-text-sm ft-timeline-merge-badge",
				text: "⤴ merged",
			});
		}
		if (hasIncomingMerge) {
			bulletRow.createSpan({
				cls: "ft-badge ft-badge-info ft-text-sm ft-timeline-merge-target-badge",
				text: "⤵ target",
			});
		}

		// Timestamp
		const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		node.createDiv({
			cls: "ft-text-sm ft-text-faint ft-timeline-node-time",
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
