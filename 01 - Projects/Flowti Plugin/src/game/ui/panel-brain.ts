/**
 * Brain tab — visualizes the agent's behavior tree, needs radar,
 * decision log, and personality-derived habits.
 */

import { html, css, nothing } from "lit";
import "./bt-tree-view.js";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import { STATE_COLORS, NEED_META, relativeTime } from "./game-ui-constants.js";
import { DECAY } from "../systems/needs-system.js";
import { deriveMovementStyle, deriveIdleStyle } from "../brain/agent-brain.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentNeeds } from "../systems/needs-system.js";
import type { AgentBlackboard } from "../systems/blackboard.js";

// ── Constants ────────────────────────────────────────────────────────

const BT_EVENT_TYPES = new Set([
	"goal-started", "goal-completed", "task-started", "task-completed",
	"seek-food", "seek-drink", "seek-rest", "seek-merchant", "seek-agent", "seek-quiet",
	"break", "thinking", "speaking", "using-tool", "error",
]);

const BT_EVENT_COLORS: Record<string, string> = {
	"goal-started": "#22c55e",
	"goal-completed": "#22c55e",
	"task-started": "#3b82f6",
	"task-completed": "#3b82f6",
	"seek-food": "#f97316",
	"seek-drink": "#06b6d4",
	"seek-rest": "#a855f7",
	"seek-merchant": "#d9aa4e",
	"seek-agent": "#f59e0b",
	"seek-quiet": "#8b6ed9",
	"break": "#a855f7",
	thinking: "#f59e0b",
	speaking: "#06b6d4",
	"using-tool": "#a855f7",
	error: "#ef4444",
};

// ── Radar geometry (static parts precomputed) ────────────────────────

const RADAR_CX = 90;
const RADAR_CY = 90;
const RADAR_R = 70;
const RADAR_AXES = NEED_META.length;

function radarPoint(index: number, value: number): { x: number; y: number } {
	const angle = (Math.PI * 2 * index) / RADAR_AXES - Math.PI / 2;
	const r = (value / 100) * RADAR_R;
	return { x: RADAR_CX + r * Math.cos(angle), y: RADAR_CY + r * Math.sin(angle) };
}

function pointsString(pts: ReadonlyArray<{ x: number; y: number }>): string {
	return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

const RADAR_RING_25 = pointsString(NEED_META.map((_, i) => radarPoint(i, 25)));
const RADAR_RING_50 = pointsString(NEED_META.map((_, i) => radarPoint(i, 50)));
const RADAR_RING_75 = pointsString(NEED_META.map((_, i) => radarPoint(i, 75)));
const RADAR_RING_100 = pointsString(NEED_META.map((_, i) => radarPoint(i, 100)));
const RADAR_AXIS_OUTER = NEED_META.map((_, i) => radarPoint(i, 100));
const RADAR_AXIS_LABEL = NEED_META.map((_, i) => radarPoint(i, 118));
const RADAR_AXIS_VALUE = NEED_META.map((_, i) => radarPoint(i, 130));

function radarPolygon(needs: AgentNeeds): string {
	return pointsString(NEED_META.map((m, i) => radarPoint(i, needs[m.key])));
}

type HealthTier = "good" | "warn" | "bad";

const FILL_BY_TIER: Record<HealthTier, string> = {
	good: "rgba(34, 197, 94, 0.25)",
	warn: "rgba(245, 158, 11, 0.25)",
	bad: "rgba(239, 68, 68, 0.25)",
};

const STROKE_BY_TIER: Record<HealthTier, string> = {
	good: "#22c55e",
	warn: "#f59e0b",
	bad: "#ef4444",
};

function needsHealthTier(needs: AgentNeeds): HealthTier {
	const avg = NEED_META.reduce((s, m) => s + needs[m.key], 0) / NEED_META.length;
	return avg >= 60 ? "good" : avg >= 35 ? "warn" : "bad";
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatRate(rate: number): string {
	if (rate > 0) return `+${rate.toFixed(1)}`;
	if (rate < 0) return rate.toFixed(1);
	return "0";
}

function rateClass(rate: number): string {
	if (rate > 0) return "rate-up";
	if (rate < 0) return "rate-down";
	return "rate-zero";
}

const DEFAULT_ATTR = 10;

// ── Component ────────────────────────────────────────────────────────

export class PanelBrain extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agent: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host { display: block; }

			.section {
				margin-bottom: 14px;
				padding-bottom: 10px;
				border-bottom: 1px solid var(--border);
			}
			.section:last-child {
				border-bottom: none;
				margin-bottom: 0;
			}
			.section-title {
				font-size: 10px;
				color: var(--text-secondary);
				text-transform: uppercase;
				font-weight: 600;
				letter-spacing: 0.5px;
				margin-bottom: 6px;
			}

			.state-hero {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 6px;
			}
			.state-badge {
				display: inline-block;
				padding: 3px 10px;
				border-radius: 3px;
				font-size: 13px;
				font-weight: 700;
				color: #fff;
				text-transform: uppercase;
				letter-spacing: 0.06em;
			}
			.state-glow {
				box-shadow: 0 0 12px var(--glow-color, rgba(59, 130, 246, 0.4));
			}
			.state-detail {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 2px 8px;
				font-size: 11px;
			}
			.state-label {
				color: var(--text-muted);
				text-transform: uppercase;
				font-size: 10px;
			}
			.state-value {
				color: var(--text-primary);
			}

			.radar-wrap {
				display: flex;
				justify-content: center;
				margin-bottom: 8px;
			}
			.radar-svg {
				width: 180px;
				height: 180px;
			}
			.radar-ring {
				fill: none;
				stroke: var(--border);
				stroke-width: 0.5;
			}
			.radar-axis {
				stroke: var(--border);
				stroke-width: 0.5;
			}
			.radar-fill {
				transition: all 0.4s ease;
			}
			.radar-label {
				font-size: 8px;
				fill: var(--text-secondary);
				text-anchor: middle;
				dominant-baseline: central;
			}
			.radar-value {
				font-size: 7px;
				fill: var(--text-muted);
				text-anchor: middle;
				dominant-baseline: central;
			}

			.needs-row {
				display: flex;
				align-items: center;
				gap: 4px;
				padding: 2px 0;
				font-size: 11px;
			}
			.needs-label {
				color: var(--text-secondary);
				min-width: 44px;
				font-size: 10px;
			}
			.needs-bar {
				height: 5px;
				border-radius: 3px;
				background: #1e293b;
				overflow: hidden;
				flex: 1;
			}
			.needs-bar-fill {
				height: 100%;
				border-radius: 3px;
				transition: width 0.3s ease;
			}
			.needs-pct {
				color: var(--text-muted);
				font-size: 9px;
				min-width: 26px;
				text-align: right;
				font-variant-numeric: tabular-nums;
			}
			.needs-rate {
				font-size: 9px;
				min-width: 32px;
				text-align: right;
				font-variant-numeric: tabular-nums;
			}
			.rate-up { color: #22c55e; }
			.rate-down { color: #ef4444; }
			.rate-zero { color: var(--text-dim); }

			.decision-log {
				display: flex;
				flex-direction: column;
				gap: 2px;
				max-height: 160px;
				overflow-y: auto;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}
			.decision-entry {
				display: flex;
				align-items: baseline;
				gap: 5px;
				font-size: 10px;
				padding: 1px 0;
			}
			.decision-time {
				color: var(--text-muted);
				font-size: 9px;
				min-width: 22px;
				text-align: right;
				font-variant-numeric: tabular-nums;
			}
			.decision-type {
				font-size: 8px;
				font-weight: 600;
				padding: 1px 4px;
				border-radius: 2px;
				color: #fff;
				white-space: nowrap;
			}
			.decision-summary {
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
				font-size: 10px;
			}

			.habits-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 4px 12px;
				font-size: 10px;
			}
			.habit-item {
				display: flex;
				justify-content: space-between;
				gap: 4px;
			}
			.habit-label {
				color: var(--text-muted);
			}
			.habit-value {
				color: var(--text-primary);
				font-weight: 600;
			}

			.empty-msg {
				color: var(--text-muted);
				font-style: italic;
				font-size: 11px;
			}
		`,
	];

	store!: DashboardStore;
	agent!: DashboardAgent;

	private readonly onStoreChanged = (): void => { this.requestUpdate(); };

	connectedCallback(): void {
		super.connectedCallback();
		this.store?.addEventListener("state-changed", this.onStoreChanged);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.store?.removeEventListener("state-changed", this.onStoreChanged);
	}

	protected renderContent() {
		if (!this.store || !this.agent) return html``;

		const name = this.agent.name;
		const needs = this.store.getAgentNeeds(name);
		const brainState: AgentBlackboard["intent"] = this.store.agentIntents.get(name) ?? "idle";
		const btSnapshot = this.store.btTreeState.get(name);

		return html`
			${this.renderStateMachine(brainState)}
			${needs ? this.renderNeedsRadar(needs) : nothing}
			${needs ? this.renderNeedsBars(needs, brainState) : nothing}
			<div class="section">
				<div class="section-title">Behavior Tree</div>
				<ft-game-bt-tree-view .snapshot=${btSnapshot}></ft-game-bt-tree-view>
			</div>
			${this.renderDecisionLog()}
			${this.renderHabits()}
		`;
	}

	private renderStateMachine(brainState: AgentBlackboard["intent"]) {
		const stateColor = STATE_COLORS[brainState] ?? STATE_COLORS["idle"];
		const llmStatus = this.store.llmStatus.get(this.agent.name);
		const llmState = llmStatus?.state ?? "idle";

		const log = this.store.agentEventLog.get(this.agent.name) ?? [];
		let lastGoalStart: { timestamp: number; summary: string } | undefined;
		let lastGoalComplete: { timestamp: number } | undefined;
		for (let i = log.length - 1; i >= 0; i--) {
			const e = log[i];
			if (!lastGoalStart && e.type === "goal-started") lastGoalStart = e;
			if (!lastGoalComplete && e.type === "goal-completed") lastGoalComplete = e;
			if (lastGoalStart && lastGoalComplete) break;
		}
		const goalName = lastGoalStart && (!lastGoalComplete || lastGoalStart.timestamp > lastGoalComplete.timestamp)
			? lastGoalStart.summary
			: "none";

		return html`
			<div class="section">
				<div class="section-title">Brain State</div>
				<div class="state-hero">
					<span
						class="state-badge state-glow"
						style="background:${stateColor};--glow-color:${stateColor}44"
					>${brainState}</span>
				</div>
				<div class="state-detail">
					<span class="state-label">Goal</span>
					<span class="state-value">${goalName}</span>
					<span class="state-label">LLM</span>
					<span class="state-value">${llmState}${llmState === "thinking" && llmStatus ? ` (${Math.round((Date.now() - llmStatus.since) / 1000)}s)` : ""}</span>
				</div>
			</div>
		`;
	}

	private renderNeedsRadar(needs: AgentNeeds) {
		const polygon = radarPolygon(needs);
		const tier = needsHealthTier(needs);

		return html`
			<div class="section">
				<div class="section-title">Needs Radar</div>
				<div class="radar-wrap">
					<svg class="radar-svg" viewBox="0 0 180 180">
						<polygon class="radar-ring" points="${RADAR_RING_25}" />
						<polygon class="radar-ring" points="${RADAR_RING_50}" />
						<polygon class="radar-ring" points="${RADAR_RING_75}" />
						<polygon class="radar-ring" points="${RADAR_RING_100}" />

						${RADAR_AXIS_OUTER.map((outer) => html`
							<line class="radar-axis"
								x1="${RADAR_CX}" y1="${RADAR_CY}"
								x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" />
						`)}

						<polygon class="radar-fill"
							points="${polygon}"
							fill="${FILL_BY_TIER[tier]}"
							stroke="${STROKE_BY_TIER[tier]}"
							stroke-width="1.5" />

						${NEED_META.map((m, i) => {
							const pt = radarPoint(i, needs[m.key]);
							return html`<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.5" fill="${m.color}" />`;
						})}

						${NEED_META.map((m, i) => html`
							<text class="radar-label" x="${RADAR_AXIS_LABEL[i].x.toFixed(1)}" y="${RADAR_AXIS_LABEL[i].y.toFixed(1)}">${m.label}</text>
							<text class="radar-value" x="${RADAR_AXIS_VALUE[i].x.toFixed(1)}" y="${RADAR_AXIS_VALUE[i].y.toFixed(1)}">${Math.round(needs[m.key])}%</text>
						`)}
					</svg>
				</div>
			</div>
		`;
	}

	private renderNeedsBars(needs: AgentNeeds, brainState: AgentBlackboard["intent"]) {
		const rates = DECAY[brainState] ?? {};

		return html`
			<div class="section">
				<div class="section-title">Needs &amp; Decay (${brainState})</div>
				${NEED_META.map(({ label, key, color }) => {
					const pct = Math.round(needs[key]);
					const rate = rates[key] ?? 0;
					return html`
						<div class="needs-row">
							<span class="needs-label">${label}</span>
							<div class="needs-bar">
								<div class="needs-bar-fill" style="width:${pct}%;background:${color}"></div>
							</div>
							<span class="needs-pct">${pct}%</span>
							<span class="needs-rate ${rateClass(rate)}">${formatRate(rate)}/s</span>
						</div>
					`;
				})}
			</div>
		`;
	}

	private renderDecisionLog() {
		const log = this.store.agentEventLog.get(this.agent.name) ?? [];
		const btEvents = log.filter((e) => BT_EVENT_TYPES.has(e.type));
		const recent = btEvents.slice(-15).reverse();

		if (recent.length === 0) {
			return html`
				<div class="section">
					<div class="section-title">Decision Narrative</div>
					<div class="empty-msg">No brain decisions yet.</div>
				</div>
			`;
		}

		const now = Date.now();
		return html`
			<div class="section">
				<div class="section-title">Decision Narrative</div>
				<div class="decision-log">
					${recent.map((entry) => {
						const color = BT_EVENT_COLORS[entry.type] ?? "#6b7280";
						return html`
							<div class="decision-entry">
								<span class="decision-time">${relativeTime(now - entry.timestamp)}</span>
								<span class="decision-type" style="background:${color}">${entry.type}</span>
								<span class="decision-summary">${entry.summary}</span>
							</div>
						`;
					})}
				</div>
			</div>
		`;
	}

	private renderHabits() {
		const attrs = this.agent.attributes ?? {};
		const dex = attrs.dex ?? DEFAULT_ATTR;
		const cha = attrs.cha ?? DEFAULT_ATTR;
		const int = attrs.int ?? DEFAULT_ATTR;
		const con = attrs.con ?? DEFAULT_ATTR;
		const wis = attrs.wis ?? DEFAULT_ATTR;

		const socialDrift = (cha / 20).toFixed(2);
		const breakThresh = (10 + con * 2).toString();
		const settlingMs = (200 + wis * 50).toString();
		const focusSec = ((5000 + (int / 20) * 25000) / 1000).toFixed(0);

		return html`
			<div class="section">
				<div class="section-title">Habits &amp; Personality</div>
				<div class="habits-grid">
					<div class="habit-item">
						<span class="habit-label">Movement</span>
						<span class="habit-value">${deriveMovementStyle(dex)}</span>
					</div>
					<div class="habit-item">
						<span class="habit-label">Idle</span>
						<span class="habit-value">${deriveIdleStyle(con)}</span>
					</div>
					<div class="habit-item">
						<span class="habit-label">Social drift</span>
						<span class="habit-value">${socialDrift}</span>
					</div>
					<div class="habit-item">
						<span class="habit-label">Focus span</span>
						<span class="habit-value">${focusSec}s</span>
					</div>
					<div class="habit-item">
						<span class="habit-label">Break threshold</span>
						<span class="habit-value">${breakThresh}</span>
					</div>
					<div class="habit-item">
						<span class="habit-label">Settling pause</span>
						<span class="habit-value">${settlingMs}ms</span>
					</div>
				</div>
				${this.agent.personality && this.agent.personality.length > 0 ? html`
					<div style="margin-top:6px;font-size:10px;color:var(--text-muted)">
						${this.agent.personality.join(" \u00B7 ")}
					</div>
				` : nothing}
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-brain")) customElements.define("ft-game-panel-brain", PanelBrain);
