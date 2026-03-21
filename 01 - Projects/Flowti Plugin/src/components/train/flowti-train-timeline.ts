/**
 * Train Timeline — git-graph style vertical timeline Lit component.
 *
 * Renders a VS Code-like git graph with colored lane rails, circular node
 * dots, and fork/merge connectors. The timeline is rendered bottom-to-top
 * so the newest thought appears at the top (stacking metaphor).
 *
 * This is a pure presentation component — it receives pre-computed data
 * props and emits CustomEvents for user actions.
 *
 * @fires thought-activated - When a thought node is clicked: `{ trainId, thoughtId }`
 * @fires open-train-view - When the "Open train detail" button is clicked: `{ trainId }`
 * @fires open-canvas - When the "Open canvas" button is clicked: `{ canvasPath }`
 * @fires toggle-collapse - When a collapse chevron is clicked: `{ thoughtId }`
 * @fires cycle-branch-status - When a branch status badge is clicked: `{ trainId, thoughtId, currentStatus }`
 */

import { html, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { trainTimelineStyles } from './flowti-train-timeline-styles.js';
import type { ThoughtNode, TrainState } from '../../domain/train/types.js';
import type { GraphRow } from '../../domain/train/graph-layout.js';
import { LANE_COLORS, LANE_WIDTH } from '../../domain/train/graph-layout.js';

export class FlowtiTrainTimeline extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		train: { type: Object },
		timeline: { type: Array },
		activeThoughtId: { type: String, attribute: 'active-thought-id' },
		graphRows: { type: Array },
		branchCounts: { attribute: false },
		canvasPath: { type: String, attribute: 'canvas-path' },
		canvasExists: { type: Boolean, attribute: 'canvas-exists' },
		collapsedNodes: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		trainTimelineStyles,
	];

	train: TrainState | null = null;
	timeline: ThoughtNode[] = [];
	activeThoughtId: string | null = null;
	graphRows: GraphRow[] = [];
	branchCounts: Map<string, number> = new Map();
	canvasPath: string | null = null;
	canvasExists = false;
	collapsedNodes: Set<string> = new Set();

	protected renderContent() {
		if (!this.train) {
			return html`
				<div class="timeline-empty">
					<p>No active train.</p>
				</div>
			`;
		}

		return html`
			${this.renderHeader(this.train)}
			${this.renderGraphTimeline(this.train)}
		`;
	}

	private renderHeader(train: TrainState) {
		let totalBranches = 0;
		for (const thought of train.thoughts) {
			totalBranches += this.branchCounts.get(thought.id) ?? 0;
		}
		const elapsed = train.createdAt
			? Math.floor((Date.now() - new Date(train.createdAt).getTime()) / 60_000)
			: 0;

		return html`
			<div class="timeline-header">
				<div class="title-row">
					<span class="title-text">${train.title}</span>
					<span class="status-badge">${train.status}</span>
					<button
						class="header-btn"
						aria-label="Open train detail"
						data-action="open-train"
						@click=${(e: Event) => this.onOpenTrainView(e, train.id)}
					>&#x2197;</button>
					${this.canvasPath && this.canvasExists
						? html`
							<button
								class="header-btn"
								aria-label="Open canvas"
								data-action="open-canvas"
								@click=${(e: Event) => this.onOpenCanvas(e)}
							>&#x25a6;</button>
						`
						: nothing}
				</div>
				<div class="stat-line">
					${train.thoughts.length} thoughts &middot; ${totalBranches} branches &middot; ${elapsed} min
				</div>
			</div>
		`;
	}

	private renderGraphTimeline(train: TrainState) {
		if (this.graphRows.length === 0) {
			return html`<div class="empty-chain">No thoughts yet</div>`;
		}

		const maxLane = Math.max(...this.graphRows.map((r) => r.lane), 0);

		// Build merge target lane lookup: sourceId -> targetLane
		const laneByThought = new Map<string, number>();
		for (const row of this.graphRows) {
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
		const reversed = [...this.graphRows].reverse();

		return html`
			<div class="graph-timeline">
				${reversed.map((row, i) => this.renderGraphRow(
					row, train, maxLane,
					i === 0,
					mergeTargetLanes.get(row.thought.id) ?? null,
				))}
			</div>
		`;
	}

	private renderGraphRow(
		row: GraphRow,
		train: TrainState,
		maxLane: number,
		isHead: boolean,
		mergeTargetLane: number | null,
	) {
		const { thought, lane, activeLanes, isBranchStart, parentLane } = row;
		const isActive = thought.id === this.activeThoughtId;
		const cellWidth = (maxLane + 1) * LANE_WIDTH + 4;
		const branchCount = this.branchCounts.get(thought.id) ?? 0;
		const isCollapsed = this.collapsedNodes.has(thought.id);

		const isBranchOrigin = train.relations.some(
			(r) => r.direction === "branch" && r.toId === thought.id,
		);
		const hasOutgoingMerge = train.relations.some(
			(r) => r.fromId === thought.id && r.direction === "merge",
		);
		const hasIncomingMerge = train.relations.some(
			(r) => r.toId === thought.id && r.direction === "merge",
		);

		const time = new Date(thought.createdAt).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});

		return html`
			<div
				class="graph-node ${isActive ? 'graph-node--active' : ''} ${lane > 0 ? 'graph-node--branch' : ''}"
				data-thought-id=${thought.id}
				@click=${() => this.onThoughtClick(train.id, thought.id)}
			>
				${this.renderGraphCell(cellWidth, lane, activeLanes, isBranchStart, parentLane, isActive, isHead, mergeTargetLane)}
				<div class="graph-content">
					<span class="node-title">${thought.title}</span>
					${branchCount > 0
						? html`
							<span
								class="chevron"
								data-action="toggle-collapse"
								@click=${(e: Event) => this.onToggleCollapse(e, thought.id)}
							>${isCollapsed ? '\u25B8' : '\u25BE'}</span>
							<span class="branch-badge">+${branchCount}</span>
						`
						: nothing}
					${isBranchOrigin && thought.branchStatus
						? html`
							<span
								class="branch-status-badge branch-status-${thought.branchStatus}"
								data-action="cycle-status"
								@click=${(e: Event) => this.onCycleBranchStatus(e, train.id, thought.id, thought.branchStatus ?? null)}
							>${thought.branchStatus}</span>
						`
						: nothing}
					${isBranchOrigin && !thought.branchStatus
						? html`
							<span
								class="tag-btn"
								data-action="cycle-status"
								aria-label="Set branch status"
								@click=${(e: Event) => this.onCycleBranchStatus(e, train.id, thought.id, null)}
							>&#x1f3f7;</span>
						`
						: nothing}
					${hasOutgoingMerge
						? html`<span class="merge-badge merge-badge--outgoing">\u2934 merged</span>`
						: nothing}
					${hasIncomingMerge
						? html`<span class="merge-badge merge-badge--incoming">\u2935 target</span>`
						: nothing}
					<span class="graph-time">${time}</span>
				</div>
			</div>
		`;
	}

	private renderGraphCell(
		cellWidth: number,
		lane: number,
		activeLanes: Map<number, string>,
		isBranchStart: boolean,
		parentLane: number,
		isActive: boolean,
		isHead: boolean,
		mergeTargetLane: number | null,
	) {
		const dotColor = activeLanes.get(lane) ?? LANE_COLORS[lane % LANE_COLORS.length];

		return html`
			<div class="graph-cell" style="width:${cellWidth}px;min-width:${cellWidth}px">
				${Array.from(activeLanes).map(([laneIdx, color]) => html`
					<div
						class="graph-rail"
						style="left:${laneIdx * LANE_WIDTH + LANE_WIDTH / 2 - 1}px;background-color:${color}"
					></div>
				`)}
				${isBranchStart && parentLane !== lane
					? html`
						<div
							class="graph-fork"
							style="left:${parentLane * LANE_WIDTH + LANE_WIDTH / 2}px;width:${(lane - parentLane) * LANE_WIDTH}px;background-color:${activeLanes.get(lane) ?? LANE_COLORS[lane % LANE_COLORS.length]}"
						></div>
					`
					: nothing}
				${mergeTargetLane !== null && mergeTargetLane !== lane
					? this.renderMergeConnector(lane, mergeTargetLane, activeLanes)
					: nothing}
				<div
					class="graph-dot ${isActive ? 'graph-dot--active' : ''} ${isHead ? 'graph-dot--head' : ''}"
					style="left:${lane * LANE_WIDTH + LANE_WIDTH / 2}px;background-color:${dotColor}"
				></div>
			</div>
		`;
	}

	private renderMergeConnector(
		lane: number,
		mergeTargetLane: number,
		activeLanes: Map<number, string>,
	) {
		const mergeColor = activeLanes.get(lane) ?? LANE_COLORS[lane % LANE_COLORS.length];
		const fromX = Math.min(lane, mergeTargetLane) * LANE_WIDTH + LANE_WIDTH / 2;
		const toX = Math.max(lane, mergeTargetLane) * LANE_WIDTH + LANE_WIDTH / 2;
		const arrowClass = mergeTargetLane < lane
			? 'graph-merge-arrow--left'
			: 'graph-merge-arrow--right';

		return html`
			<div
				class="graph-merge"
				style="left:${fromX}px;width:${toX - fromX}px;border-bottom-color:${mergeColor}"
			>
				<div
					class="graph-merge-arrow ${arrowClass}"
					style="border-top-color:${mergeColor}"
				></div>
			</div>
		`;
	}

	// ── Event dispatchers ──────────────────────────────────

	private onThoughtClick(trainId: string, thoughtId: string): void {
		this.dispatchEvent(
			new CustomEvent('thought-activated', {
				detail: { trainId, thoughtId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onOpenTrainView(e: Event, trainId: string): void {
		e.stopPropagation();
		this.dispatchEvent(
			new CustomEvent('open-train-view', {
				detail: { trainId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onOpenCanvas(e: Event): void {
		e.stopPropagation();
		this.dispatchEvent(
			new CustomEvent('open-canvas', {
				detail: { canvasPath: this.canvasPath },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onToggleCollapse(e: Event, thoughtId: string): void {
		e.stopPropagation();
		this.dispatchEvent(
			new CustomEvent('toggle-collapse', {
				detail: { thoughtId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onCycleBranchStatus(
		e: Event,
		trainId: string,
		thoughtId: string,
		currentStatus: string | null,
	): void {
		e.stopPropagation();
		this.dispatchEvent(
			new CustomEvent('cycle-branch-status', {
				detail: { trainId, thoughtId, currentStatus },
				bubbles: true,
				composed: true,
			}),
		);
	}
}

if (!customElements.get('flowti-train-timeline')) customElements.define('flowti-train-timeline', FlowtiTrainTimeline);
