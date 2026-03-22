/**
 * Monitor tab — real-time agent internals: brain state, process health,
 * LLM status, event stream, and nearby agents.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import { AGENT_RESOURCES_CHANGED_EVENT, type DashboardStore } from "../store/dashboard-store.js";
import type { IEventBus, EventPayload } from "../../infrastructure/events/types.js";
import { CANVAS_SLICE_ORDER, CANVAS_SLICE_LABELS, formatCanvasPerfMs } from "./canvas-perf-labels.js";

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

function formatMem(bytes: number | null | undefined): string {
	if (bytes == null) return "—";
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(0)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}

function formatCpu(pct: number | null | undefined): string {
	if (pct == null) return "—";
	if (!Number.isFinite(pct)) return "—";
	return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export class PanelMonitor extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agentName: { type: String },
		eventBus: { attribute: false },
		agentCanvasPerfEnabled: { state: true },
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

			.resource-grid {
				margin-bottom: 6px;
			}

			.status-value.muted {
				color: var(--text-muted);
			}

			.resource-hint {
				font-size: 10px;
				color: var(--text-muted);
				margin: 0 0 10px;
				line-height: 1.35;
			}

			/* Canvas perf (this agent) — same sample window as Ask Bob world monitor */
			.canvas-perf-toolbar {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 8px;
				padding: 6px 8px;
				border: 1px solid var(--border);
				border-radius: 3px;
				background: var(--bg-secondary);
				font-size: 10px;
				color: var(--text-secondary);
				margin-bottom: 10px;
			}
			.canvas-perf-toggle {
				display: flex;
				align-items: center;
				gap: 6px;
				cursor: pointer;
				user-select: none;
				flex-shrink: 0;
			}
			.canvas-perf-toggle input {
				accent-color: var(--accent-gold);
				cursor: pointer;
			}
			.canvas-perf-hint {
				font-size: 9px;
				color: var(--text-muted);
				line-height: 1.35;
				flex: 1;
				text-align: right;
			}
			.canvas-perf-wait {
				font-size: 10px;
				color: var(--text-muted);
				margin: 0 0 10px;
			}
			.canvas-perf-panel {
				padding: 8px;
				border-radius: 3px;
				border: 1px solid var(--border);
				background: var(--bg-primary);
				font-size: 10px;
				color: var(--text-primary);
				margin-bottom: 12px;
			}
			.canvas-perf-meta {
				font-size: 9px;
				color: var(--text-muted);
				margin-bottom: 8px;
				line-height: 1.4;
			}
			.canvas-perf-grid {
				display: grid;
				grid-template-columns: 1fr;
				gap: 4px 0;
			}
			.canvas-perf-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 8px;
				font-size: 10px;
			}
			.canvas-perf-slice-name {
				color: var(--text-secondary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.canvas-perf-slice-ms {
				color: var(--accent-gold);
				font-variant-numeric: tabular-nums;
				flex-shrink: 0;
			}
			.canvas-perf-total {
				margin-top: 8px;
				padding-top: 8px;
				border-top: 1px solid var(--border);
				font-size: 10px;
				font-weight: 600;
				color: var(--text-primary);
				display: flex;
				justify-content: space-between;
			}
		`,
	];

	store!: DashboardStore;
	agentName = "";
	eventBus?: IEventBus;

	private agentCanvasPerfEnabled = false;
	private lastWorldPerfSample: EventPayload<"perf.agentWorld.sample"> | null = null;

	private unsubscribe: (() => void) | null = null;
	private perfBusUnsubs: Array<() => void> = [];

	private readonly onStoreStateChanged = (): void => {
		this.requestUpdate();
	};

	private readonly onAgentResourcesChanged = (): void => {
		this.requestUpdate();
	};

	connectedCallback(): void {
		super.connectedCallback();
		this.store?.addEventListener("state-changed", this.onStoreStateChanged);
		this.store?.addEventListener(AGENT_RESOURCES_CHANGED_EVENT, this.onAgentResourcesChanged);
		this.unsubscribe = () => {
			this.store?.removeEventListener("state-changed", this.onStoreStateChanged);
			this.store?.removeEventListener(AGENT_RESOURCES_CHANGED_EVENT, this.onAgentResourcesChanged);
		};
		this.refreshCanvasPerfBusListeners();
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.teardownCanvasPerfBusListeners();
		this.unsubscribe?.();
	}

	private teardownCanvasPerfBusListeners(): void {
		for (const u of this.perfBusUnsubs) {
			try {
				u();
			} catch {
				/* ignore */
			}
		}
		this.perfBusUnsubs = [];
	}

	private refreshCanvasPerfBusListeners(): void {
		this.teardownCanvasPerfBusListeners();
		if (!this.agentCanvasPerfEnabled || !this.eventBus) return;
		const bus = this.eventBus;
		this.perfBusUnsubs.push(
			bus.on("perf.agentWorld.sample", (ev) => {
				this.lastWorldPerfSample = ev.payload;
				this.requestUpdate();
			}),
		);
	}

	private handleCanvasPerfToggle(e: Event): void {
		const on = (e.target as HTMLInputElement).checked;
		this.agentCanvasPerfEnabled = on;
		if (!on) {
			this.teardownCanvasPerfBusListeners();
			this.lastWorldPerfSample = null;
		} else {
			this.refreshCanvasPerfBusListeners();
		}
		this.requestUpdate();
	}

	private getAgentCanvasRow(): {
		agentName: string;
		slices: Record<string, { avgMs: number; maxMs: number }>;
	} | null {
		const sample = this.lastWorldPerfSample;
		if (!sample?.perAgentCanvas?.agents) return null;
		return sample.perAgentCanvas.agents.find((a) => a.agentName === this.agentName) ?? null;
	}

	private renderCanvasPerfSection() {
		const hasBus = Boolean(this.eventBus);
		const row = this.agentCanvasPerfEnabled ? this.getAgentCanvasRow() : null;
		const sample = this.lastWorldPerfSample;

		return html`
			<div class="canvas-perf-toolbar">
				<label class="canvas-perf-toggle">
					<input
						type="checkbox"
						.checked=${this.agentCanvasPerfEnabled}
						@change=${this.handleCanvasPerfToggle}
					/>
					<span>Canvas perf</span>
				</label>
				<div class="canvas-perf-hint">
					${!hasBus
						? "Plugin event bus not wired — open Agent World from the Flowti plugin."
						: !this.agentCanvasPerfEnabled
							? "Per-frame slices for this agent (same ~4s window as world perf)."
							: "Live: perf.agentWorld.sample → perAgentCanvas."}
				</div>
			</div>
			${this.agentCanvasPerfEnabled && hasBus && !sample ? html`
				<div class="canvas-perf-wait">Waiting for first sample (~4s of canvas activity)…</div>
			` : nothing}
			${this.agentCanvasPerfEnabled && hasBus && sample && !row ? html`
				<div class="canvas-perf-wait">No slice data for <strong>${this.agentName}</strong> in the last window (agent idle or not in simulation).</div>
			` : nothing}
			${this.agentCanvasPerfEnabled && row ? html`
				<div class="canvas-perf-panel">
					<div class="canvas-perf-meta">
						Window: ${sample!.windowFrames} frames / ${formatCanvasPerfMs(sample!.windowDurationMs)} ms
						\u{2022} scene <strong style="color:var(--text-primary)">${sample!.sceneName}</strong>
					</div>
					<div class="canvas-perf-grid">
						${CANVAS_SLICE_ORDER.filter((k) => row!.slices[k]).map((k) => {
							const v = row!.slices[k]!;
							return html`
								<div class="canvas-perf-row">
									<span class="canvas-perf-slice-name" title="${k}">${CANVAS_SLICE_LABELS[k] ?? k}</span>
									<span class="canvas-perf-slice-ms">${formatCanvasPerfMs(v.avgMs)} / ${formatCanvasPerfMs(v.maxMs)} ms</span>
								</div>
							`;
						})}
						${Object.keys(row.slices)
							.filter((k) => !(CANVAS_SLICE_ORDER as readonly string[]).includes(k))
							.map((k) => {
								const v = row.slices[k]!;
								return html`
									<div class="canvas-perf-row">
										<span class="canvas-perf-slice-name" title="${k}">${k}</span>
										<span class="canvas-perf-slice-ms">${formatCanvasPerfMs(v.avgMs)} / ${formatCanvasPerfMs(v.maxMs)} ms</span>
									</div>
								`;
							})}
					</div>
					<div class="canvas-perf-total">
						<span>Σ avg / frame (slices)</span>
						<span>${formatCanvasPerfMs(
							Object.values(row.slices).reduce((s, v) => s + v.avgMs, 0),
						)} ms</span>
					</div>
				</div>
			` : nothing}
		`;
	}

	protected renderContent() {
		if (!this.store || !this.agentName) return html``;

		return html`
			${this.renderCanvasPerfSection()}
			${!this.store.cliSessionAvailable && this.store.cliSessionBlockedReason
				? html`<p class="resource-hint" style="margin-top:0">${this.store.cliSessionBlockedReason}</p>`
				: nothing}
			${this.renderStatusGrid()}
			<div class="section-title">System resources</div>
			${this.renderResources()}
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

				<span class="status-label">CLI host</span>
				<span class="status-value ${this.store.cliSessionAvailable ? "" : "muted"}">
					${this.store.cliSessionAvailable ? "Ready (spawn OK)" : "Unavailable"}
				</span>

				<span class="status-label">Scene</span>
				<span class="status-value">${scene}</span>

				${pos ? html`
					<span class="status-label">Position</span>
					<span class="status-value">${Math.round(pos.x)}, ${Math.round(pos.y)}</span>
				` : nothing}
			</div>
		`;
	}

	private renderResources() {
		const processAlive = this.store.isProcessAlive(this.agentName);
		const m = this.store.agentResourceMetrics.get(this.agentName);

		if (!processAlive) {
			return html`
				<div class="status-grid resource-grid">
					<span class="status-label">PID</span>
					<span class="status-value muted">—</span>
					<span class="status-label">RAM</span>
					<span class="status-value muted">—</span>
					<span class="status-label">CPU</span>
					<span class="status-value muted">—</span>
				</div>
				<p class="resource-hint">Resources appear when the agent CLI process is running.</p>
			`;
		}

		return html`
			<div class="status-grid resource-grid">
				<span class="status-label">PID</span>
				<span class="status-value">${m?.pid ?? "…"}</span>
				<span class="status-label">RAM</span>
				<span class="status-value" title="Resident set size (working set on Windows)">${formatMem(m?.rssBytes ?? null)}</span>
				<span class="status-label">CPU</span>
				<span class="status-value" title="Approximate share of CPU time since last resource poll (~4s)">${formatCpu(m?.cpuPercent ?? null)}</span>
			</div>
			<p class="resource-hint">CPU updates after the second sample. macOS shows an instantaneous % from ps.</p>
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
