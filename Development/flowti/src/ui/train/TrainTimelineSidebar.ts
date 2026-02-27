/**
 * Train Timeline Sidebar — git-graph style vertical timeline.
 *
 * Renders a VS Code-like git graph with colored lane rails, circular node
 * dots, and fork connectors. The timeline is rendered bottom-to-top so the
 * newest thought appears at the top (stacking metaphor).
 *
 * Layout: header → scrollable graph timeline (main chain + branch forks).
 * Event subscriptions: TrainTimelineSidebarSubscriptions.ts
 */

import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { ThoughtNode, TrainState } from "../../domain/train/types";
import type { TrainViewSettings } from "./TrainMainView";
import { VIEW_TYPE_TRAIN_TIMELINE } from "./types";
import { setupTrainTimelineSubscriptions } from "./TrainTimelineSidebarSubscriptions";

// Re-export for backward compat
export { VIEW_TYPE_TRAIN_TIMELINE } from "./types";

// ── Graph Layout ─────────────────────────────────────────

/** A single row in the computed graph layout. */
export interface GraphRow {
	thought: ThoughtNode;
	/** Lane index (0 = main chain, 1+ = branch depth). */
	lane: number;
	/** Snapshot of which lanes are active at this row, keyed by lane index → CSS color. */
	activeLanes: Map<number, string>;
	/** True for the first node of a branch chain (shows fork connector). */
	isBranchStart: boolean;
	/** Lane of the parent that forked this branch. */
	parentLane: number;
}

/** CSS color values for each graph lane. Defined via custom properties with hex fallbacks. */
export const LANE_COLORS = [
	"var(--ft-lane-0)",
	"var(--ft-lane-1)",
	"var(--ft-lane-2)",
	"var(--ft-lane-3)",
	"var(--ft-lane-4)",
	"var(--ft-lane-5)",
];

/** Width of each lane column in pixels. */
export const LANE_WIDTH = 20;

/**
 * Compute graph layout rows by walking the train thought graph.
 *
 * Pure function — walks "next" chains at the same lane and "branch" forks
 * at lane+1. Collapsed nodes suppress their branch children.
 *
 * Returns rows in top-to-bottom (root-first) order. The caller should
 * reverse the array for bottom-to-top rendering.
 */
export function computeGraphLayout(
	timeline: ThoughtNode[],
	train: TrainState,
	getBranches: (trainId: string, thoughtId: string) => ThoughtNode[],
	collapsedNodes: Set<string>,
): GraphRow[] {
	const rows: GraphRow[] = [];
	const activeLanes = new Map<number, string>();

	function walk(
		start: ThoughtNode,
		lane: number,
		isBranchStart: boolean,
		parentLane: number,
	): void {
		let current: ThoughtNode | null = start;
		const visited = new Set<string>();
		let isFirst = true;

		activeLanes.set(lane, LANE_COLORS[lane % LANE_COLORS.length]);

		while (current && !visited.has(current.id)) {
			visited.add(current.id);

			rows.push({
				thought: current,
				lane,
				activeLanes: new Map(activeLanes),
				isBranchStart: isFirst && isBranchStart,
				parentLane,
			});
			isFirst = false;

			// Recurse into branches (unless collapsed or depth capped)
			if (!collapsedNodes.has(current.id) && lane < 5) {
				const branches = getBranches(train.id, current.id);
				for (const branch of branches) {
					walk(branch, lane + 1, true, lane);
				}
			}

			// Follow the "next" chain at the same lane
			const nextRel = train.relations.find(
				(r) => r.fromId === current!.id && r.direction === "next",
			);
			current = nextRel
				? train.thoughts.find((t) => t.id === nextRel.toId) ?? null
				: null;
		}

		// Close lane when branch ends (main chain at lane 0 stays open)
		if (lane > 0) {
			activeLanes.delete(lane);
		}
	}

	if (timeline.length > 0) {
		walk(timeline[0], 0, false, 0);
	}

	return rows;
}

// ── Context ──────────────────────────────────────────────

/** Context interface for subscription handlers. */
export interface TrainTimelineContext {
	getTrainId: () => string | null;
	setTrainId: (id: string | null) => void;
	setActiveThoughtId: (id: string | null) => void;
	scheduleRender: () => void;
}

// ── View ─────────────────────────────────────────────────

export class TrainTimelineSidebar extends ItemView {
	private eventBus: IEventBus;
	private trainService: TrainService;
	private getTrainSettings: () => TrainViewSettings;
	private unsubscribes: (() => void)[] = [];
	private trainId: string | null = null;
	private activeThoughtId: string | null = null;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private collapsedNodes = new Set<string>();

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
		this.contentEl.addClass("ft-timeline-sidebar");

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
		this.renderGraphTimeline(el, train);
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

		// Open Train Main View button (Inc 1)
		const openBtn = titleRow.createEl("button", {
			cls: "ft-btn ft-btn-ghost ft-btn-sm ft-timeline-open-train-btn",
		});
		openBtn.ariaLabel = "Open train detail";
		const openBtnIcon = openBtn.createSpan();
		setIcon(openBtnIcon, "maximize-2");
		openBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("ui.openTrainView", { trainId: train.id });
		});

		// Open Canvas button — visible when canvas file exists
		const canvasPath = this.getCanvasPath(train);
		if (canvasPath && this.app?.vault?.getAbstractFileByPath(canvasPath)) {
			const canvasBtn = titleRow.createEl("button", {
				cls: "ft-btn ft-btn-ghost ft-btn-sm ft-timeline-open-canvas-btn",
			});
			canvasBtn.ariaLabel = "Open canvas";
			const canvasIcon = canvasBtn.createSpan();
			setIcon(canvasIcon, "layout-dashboard");
			canvasBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (this.app?.workspace) {
					void this.app.workspace.openLinkText(canvasPath, "", false);
				}
			});
		}

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

	// ── Graph Timeline ───────────────────────────────────────

	private renderGraphTimeline(el: HTMLElement, train: TrainState): void {
		const container = el.createDiv({ cls: "ft-timeline-container ft-graph-timeline" });
		const timeline = this.trainService.getTimeline(train.id);

		if (timeline.length === 0) {
			container.createDiv({ cls: "ft-timeline-empty-chain", text: "No thoughts yet" });
			return;
		}

		const rows = computeGraphLayout(
			timeline, train,
			(tid, nid) => this.trainService.getBranches(tid, nid),
			this.collapsedNodes,
		);
		const maxLane = Math.max(...rows.map((r) => r.lane), 0);

		// Build merge target lane lookup: sourceId → targetLane
		const laneByThought = new Map<string, number>();
		for (const row of rows) {
			laneByThought.set(row.thought.id, row.lane);
		}
		const mergeTargetLanes = new Map<string, number>();
		for (const rel of train.relations) {
			if (rel.direction === "merge") {
				const targetLane = laneByThought.get(rel.toId);
				if (targetLane !== undefined) {
					mergeTargetLanes.set(rel.fromId, targetLane);
				}
			}
		}

		// Reverse for bottom-to-top rendering (newest at top)
		const reversed = [...rows].reverse();

		for (let i = 0; i < reversed.length; i++) {
			const mergeTargetLane = mergeTargetLanes.get(reversed[i].thought.id) ?? null;
			this.renderGraphRow(container, reversed[i], train, maxLane, i === 0, mergeTargetLane);
		}

		// Auto-scroll active node into view
		setTimeout(() => {
			const active = container.querySelector(".ft-timeline-node-active");
			active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}, 0);
	}

	private renderGraphRow(
		container: HTMLElement,
		row: GraphRow,
		train: TrainState,
		maxLane: number,
		isHead = false,
		mergeTargetLane: number | null = null,
	): void {
		const { thought, lane, activeLanes, isBranchStart, parentLane } = row;
		const isActive = thought.id === this.activeThoughtId;

		const cls = [
			"ft-timeline-node",
			"ft-graph-node",
			isActive ? "ft-timeline-node-active" : "",
			lane > 0 ? "ft-timeline-node-branch" : "",
		].filter(Boolean).join(" ");

		const node = container.createDiv({ cls });

		// ── Graph cell: lane rails + node dot ──
		const graphCell = node.createDiv({ cls: "ft-graph-cell" });
		const cellWidth = (maxLane + 1) * LANE_WIDTH + 4;
		graphCell.style.width = `${cellWidth}px`;
		graphCell.style.minWidth = `${cellWidth}px`;

		// Vertical rails for each active lane
		for (const [laneIdx, color] of activeLanes) {
			const rail = graphCell.createDiv({ cls: "ft-graph-rail" });
			rail.style.left = `${laneIdx * LANE_WIDTH + LANE_WIDTH / 2 - 1}px`;
			rail.style.backgroundColor = color;
		}

		// Fork connector for branch start (horizontal line from parent lane to branch lane)
		if (isBranchStart && parentLane !== lane) {
			const forkColor = activeLanes.get(lane) ?? LANE_COLORS[lane % LANE_COLORS.length];
			const fork = graphCell.createDiv({ cls: "ft-graph-fork" });
			const fromX = parentLane * LANE_WIDTH + LANE_WIDTH / 2;
			const toX = lane * LANE_WIDTH + LANE_WIDTH / 2;
			fork.style.left = `${fromX}px`;
			fork.style.width = `${toX - fromX}px`;
			fork.style.backgroundColor = forkColor;
		}

		// Merge connector for branch endpoint merging back to target lane
		if (mergeTargetLane !== null && mergeTargetLane !== lane) {
			const mergeColor = activeLanes.get(lane) ?? LANE_COLORS[lane % LANE_COLORS.length];
			const merge = graphCell.createDiv({ cls: "ft-graph-merge" });
			const fromX = Math.min(lane, mergeTargetLane) * LANE_WIDTH + LANE_WIDTH / 2;
			const toX = Math.max(lane, mergeTargetLane) * LANE_WIDTH + LANE_WIDTH / 2;
			merge.style.left = `${fromX}px`;
			merge.style.width = `${toX - fromX}px`;
			merge.style.borderBottomColor = mergeColor;

			// Arrow pointing toward the target lane
			const arrow = merge.createDiv({ cls: "ft-graph-merge-arrow" });
			arrow.style.borderTopColor = mergeColor;
			// Position arrow at the target end
			if (mergeTargetLane < lane) {
				arrow.addClass("ft-graph-merge-arrow-left");
			} else {
				arrow.addClass("ft-graph-merge-arrow-right");
			}
		}

		// Node circle (dot)
		const dotColor = activeLanes.get(lane) ?? LANE_COLORS[lane % LANE_COLORS.length];
		const dotCls = ["ft-graph-dot"];
		if (isActive) dotCls.push("ft-graph-dot-active");
		if (isHead) dotCls.push("ft-graph-dot-head");
		const dot = graphCell.createDiv({ cls: dotCls.join(" ") });
		dot.style.left = `${lane * LANE_WIDTH + LANE_WIDTH / 2}px`;
		dot.style.backgroundColor = dotColor;

		// ── Content area ──
		const content = node.createDiv({ cls: "ft-graph-content" });

		// Title
		content.createSpan({ cls: "ft-timeline-node-title", text: thought.title });

		// Collapse chevron + branch count badge
		const branchCount = this.trainService.getBranches(train.id, thought.id).length;
		if (branchCount > 0) {
			const isCollapsed = this.collapsedNodes.has(thought.id);
			const chevron = content.createSpan({ cls: "ft-timeline-chevron" });
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

			content.createSpan({
				cls: "ft-badge ft-badge-muted ft-text-sm ft-timeline-branch-badge",
				text: `+${branchCount}`,
			});
		}

		// Branch status badge (clickable — cycles through statuses)
		const isBranchOrigin = train.relations.some(
			(r) => r.direction === "branch" && r.toId === thought.id,
		);
		if (isBranchOrigin && thought.branchStatus) {
			const statusCls = `ft-branch-status-${thought.branchStatus}`;
			const badge = content.createSpan({
				cls: `ft-badge ft-text-sm ft-branch-status-badge ${statusCls}`,
				text: thought.branchStatus,
			});
			badge.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.cycleBranchStatus(train.id, thought.id, thought.branchStatus ?? null);
			});
		} else if (isBranchOrigin) {
			// No status yet — show a subtle "tag" button
			const tagBtn = content.createSpan({
				cls: "ft-branch-status-tag clickable-icon ft-text-sm",
			});
			setIcon(tagBtn, "tag");
			tagBtn.ariaLabel = "Set branch status";
			tagBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.cycleBranchStatus(train.id, thought.id, null);
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
			content.createSpan({
				cls: "ft-badge ft-badge-accent ft-text-sm ft-timeline-merge-badge",
				text: "⤴ merged",
			});
		}
		if (hasIncomingMerge) {
			content.createSpan({
				cls: "ft-badge ft-badge-info ft-text-sm ft-timeline-merge-target-badge",
				text: "⤵ target",
			});
		}

		// Timestamp
		const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		content.createSpan({ cls: "ft-text-sm ft-text-faint ft-graph-time", text: time });

		// Click to navigate — activates thought AND opens detail view
		node.addEventListener("click", () => {
			this.activeThoughtId = thought.id;
			void this.eventBus.emit("train.thought.activated", {
				trainId: train.id,
				thoughtId: thought.id,
			});
			void this.eventBus.emit("ui.openTrainView", { trainId: train.id });
			this.render();
		});
	}

	// ── Helpers ──────────────────────────────────────────────

	/** Cycle branch status: null → exploring → promising → stale → null. */
	private async cycleBranchStatus(trainId: string, thoughtId: string, current: string | null): Promise<void> {
		const cycle = [null, "exploring", "promising", "stale"] as const;
		const idx = cycle.indexOf(current as typeof cycle[number]);
		const next = cycle[(idx + 1) % cycle.length];
		if (next === null) {
			await this.trainService.clearBranchStatus(trainId, thoughtId);
		} else {
			await this.trainService.setBranchStatus(trainId, thoughtId, next);
		}
		this.render();
	}

	/** Derive the canvas path for a train from its per-train folder. */
	private getCanvasPath(train: TrainState): string | null {
		const { trainCanvasEnabled } = this.getTrainSettings();
		if (!trainCanvasEnabled || !train.folderPath) return null;
		return `${train.folderPath}/${train.title}.canvas`;
	}

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
