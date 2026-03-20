/**
 * Monitor tab — real-time agent internals: brain state, process health,
 * LLM status, event stream, and nearby agents.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";

const STATE_COLORS: Record<string, string> = {
	idle: "#3b82f6",
	wandering: "#6b7280",
	working: "#22c55e",
	"walking-to": "#f59e0b",
	"on-break": "#a855f7",
	talking: "#06b6d4",
	waiting: "#f59e0b",
};

const EVENT_COLORS: Record<string, string> = {
	response: "#22c55e",
	thinking: "#f59e0b",
	"using-tool": "#a855f7",
	"tool-complete": "#a855f7",
	error: "#ef4444",
	"task-started": "#3b82f6",
	"task-completed": "#3b82f6",
	"permission-request": "#f59e0b",
};

function relativeTime(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	return `${Math.floor(min / 60)}h`;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export class PanelMonitor extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agentName: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		css`
			:host { display: block; }

			.status-grid {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 2px 10px;
				font-size: 11px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--border);
				margin-bottom: 8px;
			}

			.status-label {
				color: var(--text-secondary);
				text-transform: uppercase;
				font-size: 10px;
				font-weight: 600;
			}

			.status-value {
				color: var(--text-primary);
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.state-badge {
				display: inline-block;
				padding: 1px 6px;
				border-radius: 3px;
				font-size: 10px;
				font-weight: 600;
				color: #fff;
			}

			.dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.dot--alive { background: #22c55e; }
			.dot--dead { background: #ef4444; }

			.lock-icon { font-size: 10px; opacity: 0.7; }

			.section-title {
				font-size: 10px;
				color: var(--text-secondary);
				text-transform: uppercase;
				font-weight: 600;
				margin-bottom: 4px;
			}

			.event-stream {
				display: flex;
				flex-direction: column;
				gap: 2px;
				margin-bottom: 8px;
				max-height: 200px;
				overflow-y: auto;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.event-entry {
				display: flex;
				align-items: baseline;
				gap: 6px;
				font-size: 11px;
				padding: 2px 0;
			}

			.event-time {
				color: var(--text-muted);
				font-size: 10px;
				min-width: 24px;
				text-align: right;
			}

			.event-type {
				font-size: 9px;
				font-weight: 600;
				padding: 1px 4px;
				border-radius: 2px;
				color: #fff;
				white-space: nowrap;
			}

			.event-summary {
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
			}

			.nearby-list {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.nearby-entry {
				display: flex;
				justify-content: space-between;
				font-size: 11px;
				color: var(--text-primary);
			}

			.nearby-dist {
				color: var(--text-muted);
				font-size: 10px;
			}

			.empty-msg {
				color: var(--text-muted);
				font-style: italic;
				font-size: 11px;
			}
		`,
	];

	store!: DashboardStore;
	agentName = "";

	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	protected renderContent() {
		if (!this.store || !this.agentName) return html``;

		return html`
			${this.renderStatusGrid()}
			<div class="section-title">Events</div>
			${this.renderEventStream()}
			<div class="section-title">Nearby</div>
			${this.renderNearby()}
		`;
	}

	private renderStatusGrid() {
		const brainState = this.store.agentStates.get(this.agentName) ?? "idle";
		const stateColor = STATE_COLORS[brainState] ?? STATE_COLORS["idle"];
		const processAlive = this.store.isProcessAlive(this.agentName);
		const llmStatus = this.store.llmStatus.get(this.agentName);
		const llmState = llmStatus?.state ?? "idle";
		const scene = capitalize(this.store.currentScene);
		const taskLocked = this.store.taskLockedAgents.has(this.agentName);
		const pos = this.store.agentPositions.get(this.agentName);

		return html`
			<div class="status-grid">
				<span class="status-label">Brain</span>
				<span class="status-value">
					<span class="state-badge" style="background:${stateColor}">${brainState}</span>
					${taskLocked ? html`<span class="lock-icon">&#x1F512;</span>` : nothing}
				</span>

				<span class="status-label">Process</span>
				<span class="status-value">
					<span class="dot ${processAlive ? "dot--alive" : "dot--dead"}"></span>
					${processAlive ? "alive" : "dead"}
				</span>

				<span class="status-label">LLM</span>
				<span class="status-value">${llmState}</span>

				<span class="status-label">Scene</span>
				<span class="status-value">${scene}</span>

				${pos ? html`
					<span class="status-label">Position</span>
					<span class="status-value">${Math.round(pos.x)}, ${Math.round(pos.y)}</span>
				` : nothing}
			</div>
		`;
	}

	private renderEventStream() {
		const log = this.store.agentEventLog.get(this.agentName) ?? [];
		if (log.length === 0) {
			return html`<div class="empty-msg">No events yet.</div>`;
		}

		const now = Date.now();
		const recent = [...log].reverse().slice(0, 20);

		return html`
			<div class="event-stream">
				${recent.map((entry) => {
					const color = EVENT_COLORS[entry.type] ?? "#6b7280";
					return html`
						<div class="event-entry">
							<span class="event-time">${relativeTime(now - entry.timestamp)}</span>
							<span class="event-type" style="background:${color}">${entry.type}</span>
							<span class="event-summary">${entry.summary}</span>
						</div>
					`;
				})}
			</div>
		`;
	}

	private renderNearby() {
		const myPos = this.store.agentPositions.get(this.agentName);
		if (!myPos) return html`<div class="empty-msg">Position unknown.</div>`;

		const nearby: { name: string; distance: number; state: string }[] = [];
		for (const [name, pos] of this.store.agentPositions) {
			if (name === this.agentName) continue;
			const dx = pos.x - myPos.x;
			const dy = pos.y - myPos.y;
			const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
			if (dist <= 300) {
				const state = this.store.agentStates.get(name) ?? "idle";
				nearby.push({ name, distance: dist, state });
			}
		}
		nearby.sort((a, b) => a.distance - b.distance);

		if (nearby.length === 0) {
			return html`<div class="empty-msg">No agents nearby.</div>`;
		}

		return html`
			<div class="nearby-list">
				${nearby.map((n) => {
					const agent = this.store.agents.find((a) => a.name === n.name);
					const display = agent?.persona ?? n.name;
					return html`
						<div class="nearby-entry">
							<span>${display} <span class="nearby-dist">${n.state}</span></span>
							<span class="nearby-dist">${n.distance}px</span>
						</div>
					`;
				})}
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-monitor")) customElements.define("ft-game-panel-monitor", PanelMonitor);
