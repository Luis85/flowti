/**
 * ask-bob.ts — Top-left launcher + panel: world overview, chat with Bob, per-agent detail, systems/perf.
 *
 * Product model: **Overview** = simulation + roster + costs at a glance; **Chat** = ask Bob;
 * **Agent** = drill-down when an agent is selected (canvas or chips); **Systems** = resources table, perf, logs.
 */

import { html, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import { askBobStyles } from "./ask-bob-styles.js";
import { AGENT_RESOURCES_CHANGED_EVENT, type ConversationTurn, type DashboardStore } from "../store/dashboard-store.js";
import type { IEventBus, EventPayload } from "../../infrastructure/events/types.js";
import type {
	IAgentWorldPerfDashboard,
	AgentWorldPerfSummary,
	AgentCanvasAggregateView,
} from "../../infrastructure/services/perfTypes.js";
import { CANVAS_SLICE_ORDER, CANVAS_SLICE_LABELS } from "./canvas-perf-labels.js";
import { AGENT_WAKE_DELAY } from "../engine-config.js";
import { afterNextPaint } from "../after-next-paint.js";
import type { DashboardAgent } from "../data/types.js";

const BOB_AGENT_NAME = "Bob";

const AGENT_STATE_COLORS: Record<string, string> = {
	idle: "#3b82f6",
	wandering: "#6b7280",
	working: "#22c55e",
	"walking-to": "#f59e0b",
	"on-break": "#a855f7",
	talking: "#06b6d4",
	waiting: "#f59e0b",
};

const AGENT_EVENT_COLORS: Record<string, string> = {
	response: "#22c55e",
	thinking: "#f59e0b",
	"using-tool": "#a855f7",
	"tool-complete": "#a855f7",
	error: "#ef4444",
	"task-started": "#3b82f6",
	"task-completed": "#3b82f6",
	"permission-request": "#f59e0b",
};

function capitalizeWord(s: string): string {
	return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function relativeTimeShort(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	return `${Math.floor(min / 60)}h`;
}

export class AskBob extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		eventBus: { attribute: false },
		perfDashboard: { attribute: false },
		open: { state: true },
		conversation: { state: true },
		thinking: { state: true },
		activeTab: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		askBobStyles,
	];


	store!: DashboardStore;
	/** When set (via `createAgentWorld` deps), enables live `perf.agentWorld.*` subscription. */
	eventBus?: IEventBus;
	/** Optional static ref (e.g. tests). Production uses {@link getPerfDashboard}. */
	perfDashboard?: IAgentWorldPerfDashboard;
	/** Lazy — resolves `PerfAggregator` after plugin layout ready. */
	getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined;

	private open = false;
	private conversation: readonly ConversationTurn[] = [];
	private thinking = false;
	private activeTab: "overview" | "chat" | "agent" | "systems" | "debug" = "overview";
	private expandedEntries = new Set<number>();

	private perfMonitorEnabled = false;
	private lastPerfSample: EventPayload<"perf.agentWorld.sample"> | null = null;
	private perfLocalSlowFrames = 0;

	private unsubscribe: (() => void) | null = null;
	private perfBusUnsubs: Array<() => void> = [];

	private readonly onStoreStateChanged = (): void => {
		this.syncFromStore();
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
		this.refreshPerfBusListeners();
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.teardownPerfBusListeners();
		this.unsubscribe?.();
	}

	private syncFromStore(): void {
		this.conversation = this.store.getConversation(BOB_AGENT_NAME);
		this.thinking = this.store.isThinking(BOB_AGENT_NAME);
	}

	private handleToggle(): void {
		this.open = !this.open;
		if (this.open) this.syncFromStore();
	}

	private switchTab(tab: "overview" | "chat" | "agent" | "systems" | "debug"): void {
		this.activeTab = tab;
		this.refreshPerfBusListeners();
	}

	private selectAgentFromBob(name: string | null): void {
		if (name) {
			this.store.beginBatch();
			this.store.selectAgent(name);
			this.store.selectTab("info");
			this.store.endBatch();
			this.activeTab = "agent";
			// Match canvas path: delay wake, then run spawn/context after next paint (see `wakeAgent` + `afterNextPaint`).
			window.setTimeout(() => {
				afterNextPaint(() => void this.store.wakeAgent(name));
			}, AGENT_WAKE_DELAY);
		} else {
			this.store.selectAgent(null);
			if (this.activeTab === "agent") this.activeTab = "overview";
		}
		this.requestUpdate();
	}

	private teardownPerfBusListeners(): void {
		for (const u of this.perfBusUnsubs) {
			try { u(); } catch { /* ignore */ }
		}
		this.perfBusUnsubs = [];
	}

	private refreshPerfBusListeners(): void {
		this.teardownPerfBusListeners();
		if (!this.perfMonitorEnabled || this.activeTab !== "systems" || !this.eventBus) return;
		const bus = this.eventBus;
		this.perfBusUnsubs.push(
			bus.on("perf.agentWorld.sample", (ev) => {
				this.lastPerfSample = ev.payload;
				this.requestUpdate();
			}),
			bus.on("perf.agentWorld.slowFrame", () => {
				this.perfLocalSlowFrames += 1;
				this.requestUpdate();
			}),
		);
	}

	private handlePerfMonitorToggle(e: Event): void {
		const on = (e.target as HTMLInputElement).checked;
		this.perfMonitorEnabled = on;
		if (!on) {
			this.teardownPerfBusListeners();
			this.lastPerfSample = null;
			this.perfLocalSlowFrames = 0;
		} else {
			this.refreshPerfBusListeners();
		}
		this.requestUpdate();
	}

	private formatPerfMs(ms: number): string {
		if (ms < 0.05) return "0";
		if (ms < 10) return ms.toFixed(2);
		return String(Math.round(ms));
	}

	/** RSS / working set — same semantics as Monitor tab. */
	private formatResourceMem(bytes: number | null | undefined): string {
		if (bytes == null) return "—";
		if (bytes < 1024) return `${bytes} B`;
		const kb = bytes / 1024;
		if (kb < 1024) return `${kb.toFixed(0)} KB`;
		return `${(kb / 1024).toFixed(1)} MB`;
	}

	private formatResourceCpu(pct: number | null | undefined): string {
		if (pct == null) return "—";
		if (!Number.isFinite(pct)) return "—";
		return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
	}

	private readPerfAggregatorSummary(): AgentWorldPerfSummary | null {
		const dash = this.perfDashboard ?? this.getPerfDashboard?.();
		if (!dash) return null;
		try {
			return dash.getAgentWorldSummary();
		} catch {
			return null;
		}
	}

	private orderedCanvasSliceKeys(sums: Record<string, number>): string[] {
		const keys = new Set(Object.keys(sums));
		const out: string[] = [];
		for (const k of CANVAS_SLICE_ORDER) {
			if (keys.has(k)) {
				out.push(k);
				keys.delete(k);
			}
		}
		out.push(...[...keys].sort());
		return out;
	}

	private computeWindowCanvasRollup(sample: EventPayload<"perf.agentWorld.sample">): {
		sliceSums: Record<string, number>;
		attributedTotal: number;
		topAgents: { name: string; totalAvgMs: number }[];
	} | null {
		const agents = sample.perAgentCanvas?.agents ?? [];
		if (agents.length === 0) return null;
		const sliceSums: Record<string, number> = {};
		for (const a of agents) {
			for (const [k, v] of Object.entries(a.slices)) {
				sliceSums[k] = (sliceSums[k] ?? 0) + v.avgMs;
			}
		}
		const attributedTotal = Object.values(sliceSums).reduce((s, v) => s + v, 0);
		const topAgents = [...agents]
			.map((a) => ({
				name: a.agentName,
				totalAvgMs: Object.values(a.slices).reduce((s, v) => s + v.avgMs, 0),
			}))
			.sort((x, y) => y.totalAvgMs - x.totalAvgMs);
		return { sliceSums, attributedTotal, topAgents };
	}

	private renderWorldPerfAgentWindowBlock(win: {
		sliceSums: Record<string, number>;
		attributedTotal: number;
		topAgents: { name: string; totalAvgMs: number }[];
	}): ReturnType<typeof html> {
		const keys = this.orderedCanvasSliceKeys(win.sliceSums);
		const maxSlice = Math.max(...keys.map((k) => win.sliceSums[k] ?? 0), 0.001);
		return html`
			<div class="world-perf-bus-top-title">This window — roster Σ by slice</div>
			${keys.map((k) => {
				const v = win.sliceSums[k] ?? 0;
				return html`
					<div class="world-perf-phase-row">
						<span class="world-perf-phase-name" title="${k}">${CANVAS_SLICE_LABELS[k] ?? k}</span>
						<div class="world-perf-phase-bar-wrap">
							<div class="world-perf-phase-bar" style="width:${(v / maxSlice) * 100}%"></div>
						</div>
						<span class="world-perf-phase-ms">${this.formatPerfMs(v)} ms</span>
					</div>
				`;
			})}
			<div class="world-perf-bus-top-title">This window — top agents</div>
			${win.topAgents.slice(0, 8).map((a) => html`
				<div class="world-perf-phase-row">
					<span class="world-perf-phase-name" title="${a.name}">${a.name}</span>
					<div class="world-perf-phase-bar-wrap">
						<div
							class="world-perf-phase-bar"
							style="width:${win.attributedTotal > 0 ? (a.totalAvgMs / win.attributedTotal) * 100 : 0}%"
						></div>
					</div>
					<span class="world-perf-phase-ms">
						${this.formatPerfMs(a.totalAvgMs)} ms
						${win.attributedTotal > 0
							? html`<span class="world-perf-agent-pct"> (${Math.round((a.totalAvgMs / win.attributedTotal) * 100)}%)</span>`
							: nothing}
					</span>
				</div>
			`)}
		`;
	}

	private renderWorldPerfAgentBufferedBlock(bu: AgentCanvasAggregateView): ReturnType<typeof html> {
		const keys = this.orderedCanvasSliceKeys({ ...bu.sliceSumAvgAcrossWindows });
		const maxAvg = Math.max(...keys.map((k) => bu.sliceSumAvgAcrossWindows[k] ?? 0), 0.001);
		return html`
			<div class="world-perf-bus-top-title">Buffered — roster Σ by slice (avg / peak window)</div>
			${keys.map((k) => {
				const avg = bu.sliceSumAvgAcrossWindows[k] ?? 0;
				const mx = bu.sliceSumMaxAcrossWindows[k] ?? 0;
				return html`
					<div class="world-perf-phase-row">
						<span class="world-perf-phase-name" title="${k}">${CANVAS_SLICE_LABELS[k] ?? k}</span>
						<div class="world-perf-phase-bar-wrap">
							<div class="world-perf-phase-bar" style="width:${(avg / maxAvg) * 100}%"></div>
						</div>
						<span class="world-perf-phase-ms">${this.formatPerfMs(avg)} / ${this.formatPerfMs(mx)}</span>
					</div>
				`;
			})}
			<div class="world-perf-bus-top-title">Buffered — top agents (mean Σ slices)</div>
			${bu.topAgentsByMeanTotal.slice(0, 8).map((a) => html`
				<div class="world-perf-phase-row">
					<span class="world-perf-phase-name" title="${a.agentName}">${a.agentName}</span>
					<span class="world-perf-phase-ms" style="width:auto;flex:1;text-align:right">
						${this.formatPerfMs(a.meanTotalAvgMs)} ms · ${a.windowsSeen}w
					</span>
				</div>
			`)}
		`;
	}

	private renderWorldPerfAgentCanvas(
		sample: EventPayload<"perf.agentWorld.sample">,
		agg: AgentWorldPerfSummary | null,
	): ReturnType<typeof html> | typeof nothing {
		const win = this.computeWindowCanvasRollup(sample);
		const bu = agg?.agentCanvasAggregate ?? null;
		if (!win && !bu) return nothing;

		return html`
			<div class="world-perf-phases-title">Agent canvas (simulation slices)</div>
			<p class="world-perf-agent-hint">
				Per-agent time per frame in attributed phases (needs, brain, talk, …). Less than full <strong>Sim</strong>
				— pets, behavior tree, director, visuals, etc. are not split by agent.
			</p>
			${win ? this.renderWorldPerfAgentWindowBlock(win) : nothing}
			${bu ? this.renderWorldPerfAgentBufferedBlock(bu) : nothing}
		`;
	}

	private renderWorldPerfMonitor(): ReturnType<typeof html> {
		const hasBus = Boolean(this.eventBus);
		const agg = this.perfMonitorEnabled ? this.readPerfAggregatorSummary() : null;
		const sample = this.lastPerfSample;

		return html`
			<div class="world-perf-toolbar">
				<label class="world-perf-toggle">
					<input
						type="checkbox"
						.checked=${this.perfMonitorEnabled}
						@change=${this.handlePerfMonitorToggle}
					/>
					<span>World perf monitor</span>
				</label>
				<div class="world-perf-hint">
					${!hasBus
						? "Plugin event bus not wired to the canvas — no samples."
						: !this.perfMonitorEnabled
							? "Turn on to record live tick timing and PerfAggregator rollups."
							: "Subscribed to perf.agentWorld.sample / slowFrame."}
				</div>
			</div>
			${this.perfMonitorEnabled && hasBus && !sample ? html`
				<div class="world-perf-wait">Waiting for first sample (~4s of canvas activity)…</div>
			` : nothing}
			${this.perfMonitorEnabled && sample ? html`
				<div class="world-perf-panel">
					<div style="font-size:9px;color:var(--text-muted);margin-bottom:6px;">
						Last window: ${sample.windowFrames} frames / ${this.formatPerfMs(sample.windowDurationMs)} ms wall
						\u{2022} scene <strong style="color:var(--text-primary)">${sample.sceneName}</strong>
						\u{2022} ${sample.agentCount} agents
					</div>
					<div class="world-perf-grid">
						<div class="world-perf-metric">
							<span class="lbl">Sim avg</span>
							<span class="val">${this.formatPerfMs(sample.simulation.avgMs)} ms</span>
						</div>
						<div class="world-perf-metric">
							<span class="lbl">Sim max</span>
							<span class="val">${this.formatPerfMs(sample.simulation.maxMs)} ms</span>
						</div>
						<div class="world-perf-metric">
							<span class="lbl">Post avg</span>
							<span class="val">${this.formatPerfMs(sample.postframe.avgMs)} ms</span>
						</div>
						<div class="world-perf-metric">
							<span class="lbl">Post max</span>
							<span class="val">${this.formatPerfMs(sample.postframe.maxMs)} ms</span>
						</div>
						<div class="world-perf-metric">
							<span class="lbl">\u0394 avg</span>
							<span class="val">${this.formatPerfMs(sample.delta.avgMs)} ms</span>
						</div>
						<div class="world-perf-metric">
							<span class="lbl">\u0394 max</span>
							<span class="val">${this.formatPerfMs(sample.delta.maxMs)} ms</span>
						</div>
					</div>
					${this.renderWorldPerfAgentCanvas(sample, agg)}
					${sample.eventBus ? html`
						<div class="world-perf-phases-title">Plugin event bus (same wall window)</div>
						<p class="world-perf-bus-hint">
							Counts typed <code>eventBus.emit()</code> across the <strong>whole plugin</strong> (files, workspace, settings, agents, …).
							The canvas loop uses <strong>Excalibur</strong> events, not this bus — <strong>0/s is normal</strong> while you only watch the world.
							<code>emitCustom</code> is not measured. Throughput = dispatches ÷ window duration.
						</p>
						<div class="world-perf-grid">
							<div class="world-perf-metric">
								<span class="lbl">Dispatches</span>
								<span class="val">${sample.eventBus.typedDispatchCount}</span>
							</div>
							<div class="world-perf-metric">
								<span class="lbl">Handler runs</span>
								<span class="val">${sample.eventBus.handlerInvocationCount}</span>
							</div>
							<div class="world-perf-metric">
								<span class="lbl">Throughput</span>
								<span class="val">${sample.eventBus.dispatchesPerSec < 10
									? sample.eventBus.dispatchesPerSec.toFixed(2)
									: Math.round(sample.eventBus.dispatchesPerSec)}/s</span>
							</div>
							<div class="world-perf-metric">
								<span class="lbl">Avg latency</span>
								<span class="val">${this.formatPerfMs(sample.eventBus.avgDispatchWallMs)} ms</span>
							</div>
							<div class="world-perf-metric">
								<span class="lbl">Max latency</span>
								<span class="val">${this.formatPerfMs(sample.eventBus.maxDispatchWallMs)} ms</span>
							</div>
						</div>
						${sample.eventBus.topEventTypes.length > 0 ? html`
							<div class="world-perf-bus-top-title">Top event types (count / max ms)</div>
							${sample.eventBus.topEventTypes.map((row) => html`
								<div class="world-perf-phase-row">
									<span class="world-perf-phase-name" title="${row.eventType}">${row.eventType}</span>
									<span class="world-perf-phase-ms">${row.count} / ${this.formatPerfMs(row.maxMs)}</span>
								</div>
							`)}
						` : html`<div class="world-perf-bus-empty">
							No typed plugin dispatches in this window (try editing a note or using the hub — not the canvas).
						</div>`}
					` : nothing}
					${this.perfLocalSlowFrames > 0 ? html`
						<div class="world-perf-warn">
							Slow simulation frames (this panel session): ${this.perfLocalSlowFrames}
						</div>
					` : nothing}
					<div class="world-perf-phases-title">Tick phases (avg / max ms)</div>
					${(() => {
						const entries = Object.entries(sample.phases)
							.sort((a, b) => b[1].avgMs - a[1].avgMs)
							.slice(0, 8);
						const maxBar = Math.max(...entries.map(([, v]) => v.avgMs), 0.001);
						return entries.map(([name, v]) => html`
							<div class="world-perf-phase-row">
								<span class="world-perf-phase-name" title="${name}">${name}</span>
								<div class="world-perf-phase-bar-wrap">
									<div class="world-perf-phase-bar" style="width:${(v.avgMs / maxBar) * 100}%"></div>
								</div>
								<span class="world-perf-phase-ms">${this.formatPerfMs(v.avgMs)} / ${this.formatPerfMs(v.maxMs)}</span>
							</div>
						`);
					})()}
					<div class="world-perf-phases-title">Game systems (avg / max ms per frame)</div>
					<p class="world-perf-agent-hint">
						<strong>Systems</strong> = BrainSystem, TalkEngine, dashboard store sync, etc.
						<strong>Phases</strong> above group the pipeline (clock → visuals); both views reference the same window.
						<code>store.*</code> runs after simulation each frame.
					</p>
					${(() => {
						const gs = sample.gameSystems ?? {};
						const entries = Object.entries(gs).sort((a, b) => b[1].avgMs - a[1].avgMs);
						if (entries.length === 0) {
							return html`<div class="world-perf-bus-empty">No system timings in this sample.</div>`;
						}
						const maxBar = Math.max(...entries.map(([, v]) => v.avgMs), 0.001);
						return entries.map(([name, v]) => html`
							<div class="world-perf-phase-row">
								<span class="world-perf-phase-name" title="${name}">${name}</span>
								<div class="world-perf-phase-bar-wrap">
									<div class="world-perf-phase-bar world-perf-phase-bar--systems" style="width:${(v.avgMs / maxBar) * 100}%"></div>
								</div>
								<span class="world-perf-phase-ms">${this.formatPerfMs(v.avgMs)} / ${this.formatPerfMs(v.maxMs)}</span>
							</div>
						`);
					})()}
					${agg && (agg.samples.length > 0 || agg.slowFrameCount > 0) ? html`
						<div class="world-perf-agg">
							<strong style="color:var(--accent-gold)">PerfAggregator</strong>
							\u{2022} ${agg.samples.length} sample window(s) buffered
							\u{2022} slow frames (plugin): ${agg.slowFrameCount}
							${agg.simulationMaxAcrossSamples.count > 0 ? html`
								<br/>Sim max across windows: p50 ${this.formatPerfMs(agg.simulationMaxAcrossSamples.p50)} ms,
								p95 ${this.formatPerfMs(agg.simulationMaxAcrossSamples.p95)} ms,
								max ${this.formatPerfMs(agg.simulationMaxAcrossSamples.max)} ms
							` : nothing}
						</div>
					` : this.perfMonitorEnabled && !(this.perfDashboard ?? this.getPerfDashboard?.()) ? html`
						<div class="world-perf-agg">
							PerfAggregator becomes available after the plugin finishes layout. Re-open this tab or toggle the monitor off and on if you opened the world very early.
						</div>
					` : nothing}
				</div>
			` : nothing}
		`;
	}

	private handleClose(): void {
		this.open = false;
	}

	private handleOverlayKeydown(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			e.stopPropagation();
			this.handleClose();
		}
	}

	/** Shared roll-up for overview strip + full resources table. */
	private getAgentResourceRollup(): {
		rosterNames: string[];
		runningNames: string[];
		displayNames: string[];
		sumRss: number | null;
		sumCpu: number;
		cpuSamples: number;
	} {
		const rosterNames = this.store.agents.map((a) => a.name);
		const runningNames = rosterNames.filter((n) => this.store.isProcessAlive(n));
		const extraTracked = [...this.store.agentResourceMetrics.keys()].filter((n) => !rosterNames.includes(n));
		const displayNames = [...new Set([...runningNames, ...extraTracked])].sort((a, b) => a.localeCompare(b));

		let sumRss: number | null = null;
		let sumCpu = 0;
		let cpuSamples = 0;
		for (const name of runningNames) {
			const m = this.store.agentResourceMetrics.get(name);
			if (m?.rssBytes != null) sumRss = (sumRss ?? 0) + m.rssBytes;
			if (m?.cpuPercent != null && Number.isFinite(m.cpuPercent)) {
				sumCpu += m.cpuPercent;
				cpuSamples++;
			}
		}
		return { rosterNames, runningNames, displayNames, sumRss, sumCpu, cpuSamples };
	}

	private async scrollToBottom(): Promise<void> {
		await this.updateComplete;
		const thread = this.shadowRoot?.querySelector<HTMLElement>(".thread");
		if (thread) {
			thread.scrollTop = thread.scrollHeight;
		}
	}

	updated(): void {
		if (this.activeTab === "chat") {
			void this.scrollToBottom();
		}
	}

	private handleSend(): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>(".chat-input");
		if (!input) return;
		const text = input.value.trim();
		if (!text) return;

		this.store.pushUserMessage(BOB_AGENT_NAME, text);
		void this.store.sendMessage(BOB_AGENT_NAME, text);
		input.value = "";
		void this.scrollToBottom();
	}

	private handleKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter") this.handleSend();
	}

	private renderThread() {
		if (this.conversation.length === 0 && !this.thinking) {
			return html`
				<div class="empty">
					<strong>Start a thread with Bob.</strong><br />
					Ask about the day phase, who is working, what just happened, or how to use the world.
				</div>
			`;
		}
		return html`
			${this.conversation.map((t) => html`
				<div class="turn" data-role="${t.role}">${t.text}</div>
			`)}
			${this.thinking ? html`<div class="thinking">Bob is thinking...</div>` : nothing}
		`;
	}

	private toggleExpand(idx: number): void {
		if (this.expandedEntries.has(idx)) {
			this.expandedEntries.delete(idx);
		} else {
			this.expandedEntries.add(idx);
		}
		this.requestUpdate();
	}

	private copyToClipboard(text: string): void {
		void navigator.clipboard.writeText(text);
	}

	private resendPrompt(agentName: string, prompt: string): void {
		this.store.pushUserMessage(agentName, prompt);
		void this.store.sendMessage(agentName, prompt);
		this.activeTab = "chat";
	}

	private handleDebugToggle(): void {
		this.store.toggleDebugMode();
	}

	/**
	 * Spawned agent CLI processes: per-agent RAM/CPU plus Σ totals (same data as Monitor tab).
	 */
	private renderWorldResourcesMonitor(): ReturnType<typeof html> {
		const { runningNames, displayNames, sumRss, sumCpu, cpuSamples } = this.getAgentResourceRollup();

		return html`
			<div class="world-resource-block">
				<div class="world-perf-phases-title">Agent CLI resources</div>
				<p class="world-resource-hint">
					Working set (RAM) and CPU% for each spawned agent process (polled ~every 2s with the world).
					<strong>Σ RAM</strong> is total RSS across running CLIs. <strong>Σ CPU</strong> sums per-agent % (can exceed 100% on multi-core).
				</p>
				${!this.store.cliSessionAvailable
					? html`
						<p class="world-resource-warn">
							${this.store.cliSessionBlockedReason || "CLI host unavailable — agent processes cannot be spawned on this machine."}
						</p>
					`
					: nothing}
				${displayNames.length === 0
					? html`
						<div class="world-resource-empty">
							No running agent CLIs. Open <strong>Talk</strong> for an agent or start a task — totals and per-agent rows appear here.
						</div>
					`
					: html`
						<div class="world-perf-grid world-resource-totals">
							<div class="world-perf-metric">
								<span class="lbl">Running CLIs</span>
								<span class="val">${runningNames.length}</span>
							</div>
							<div class="world-perf-metric">
								<span class="lbl">Σ RAM</span>
								<span class="val">${this.formatResourceMem(sumRss)}</span>
							</div>
							<div class="world-perf-metric">
								<span class="lbl">Σ CPU</span>
								<span class="val">${cpuSamples > 0
									? `${sumCpu < 10 ? sumCpu.toFixed(1) : Math.round(sumCpu)}%`
									: "—"}</span>
							</div>
						</div>
						<div class="world-resource-table-head">
							<span>Agent</span>
							<span>PID</span>
							<span>RAM</span>
							<span>CPU</span>
						</div>
						${displayNames.map((name) => {
							const alive = this.store.isProcessAlive(name);
							const m = this.store.agentResourceMetrics.get(name);
							return html`
								<div class="world-resource-row">
									<button
										type="button"
										class="world-resource-name world-resource-name-btn"
										title="Open ${name} in Agent tab"
										@click=${() => this.selectAgentFromBob(name)}
									>
										${name}
									</button>
									<span class="world-resource-pid">${alive ? String(m?.pid ?? "…") : "—"}</span>
									<span class="world-resource-mem" title="Resident set size (working set on Windows)">
										${alive ? this.formatResourceMem(m?.rssBytes ?? null) : "—"}
									</span>
									<span class="world-resource-cpu" title="Approximate CPU% since last sample (~2s)">
										${alive ? this.formatResourceCpu(m?.cpuPercent ?? null) : "—"}
									</span>
								</div>
							`;
						})}
						<p class="world-resource-foot">
							CPU needs two samples to stabilize on Windows/Linux. macOS uses a snapshot from <code>ps</code>.
						</p>
					`}
			</div>
		`;
	}

	private renderWorldDayStrip(): ReturnType<typeof html> {
		const phase = this.store.dayPhase.replace(/-/g, " ");
		const weather = this.store.weatherState;
		const progress = Math.round(this.store.dayProgress * 100);
		const cycle = this.store.cycleCount;

		const PHASE_EMOJI: Record<string, string> = {
			"morning arrival": "\u{1F305}",
			"productive morning": "\u{1F4BB}",
			lunch: "\u{1F35C}",
			afternoon: "\u{2615}",
			"afternoon slump": "\u{1F634}",
			"wind down": "\u{1F307}",
			"evening departure": "\u{1F303}",
		};
		const WEATHER_EMOJI: Record<string, string> = {
			clear: "\u{2600}\u{FE0F}",
			rain: "\u{1F327}\u{FE0F}",
			overcast: "\u{2601}\u{FE0F}",
			sunny: "\u{1F31E}",
		};

		return html`
			<div class="world-monitor-sticky-header">
				<div class="world-monitor-status-bar">
					<div style="display: flex; flex-direction: column; gap: 2px;">
						<span style="color: var(--accent-gold); font-size: 12px; font-weight: bold;">
							${PHASE_EMOJI[phase] ?? "\u{1F551}"} ${phase}
						</span>
						<span style="color: var(--text-secondary); font-size: 10px;">
							Cycle ${cycle} \u{2022} day ${progress}% \u{2022} ${this.store.agents.length} agents
						</span>
					</div>
					<span style="font-size: 16px;" title="${weather}">${WEATHER_EMOJI[weather] ?? "\u{2600}\u{FE0F}"}</span>
				</div>
				<div class="world-monitor-day-bar-track">
					<div class="world-monitor-day-bar-fill" style="width: ${progress}%;"></div>
				</div>
			</div>
		`;
	}

	private renderLiveWorldBanner(): ReturnType<typeof html> | typeof nothing {
		const activeEvent = this.store.activeWorldEvent;
		if (!activeEvent) return nothing;
		return html`
			<div
				style="padding: 6px 10px; background: rgba(217, 170, 78, 0.1); border: 1px solid var(--accent-gold); border-radius: 6px; display: flex; align-items: center; gap: 8px;"
			>
				<span
					style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-gold); animation: bob-pulse 1.5s ease-in-out infinite;"
				></span>
				<span style="color: var(--accent-gold); font-size: 10px; font-weight: 600;">LIVE \u{2014} ${activeEvent}</span>
			</div>
		`;
	}

	private renderWorldEventRows(limit: number): ReturnType<typeof html> {
		const WORLD_EVENT_COLOR: Record<string, string> = {
			standup: "#4e8bd9",
			"deploy-success": "#4ed97a",
			"tea-time": "#d9aa4e",
			"end-of-day": "#9b7ed9",
			eureka: "#d9d44e",
			"build-break": "#d94e4e",
			birthday: "#d94eaa",
			"power-flicker": "#d97a4e",
			"new-pr": "#4ed9d9",
			"phase-change": "#8e8979",
		};
		const log = [...this.store.worldEventLog].reverse().slice(0, limit);
		if (log.length === 0) {
			return html`
				<div class="bob-hint" style="text-align:center;padding:12px 8px;font-style:italic;">
					No world events yet \u{2014} the simulation is warming up.
				</div>
			`;
		}
		return html`
			${log.map((entry) => {
				const time = new Date(entry.timestamp);
				const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
				const color = WORLD_EVENT_COLOR[entry.type] ?? "#8e8979";
				return html`
					<div class="bob-event-compact">
						<span class="bob-event-time">${timeStr}</span>
						<span class="bob-event-dot" style="background:${color}"></span>
						<span class="bob-event-label" title="${entry.label}">${entry.label}</span>
					</div>
				`;
			})}
		`;
	}

	private renderOverviewTab(): ReturnType<typeof html> {
		const selected = this.store.selectedAgent;
		const { runningNames, sumRss, sumCpu, cpuSamples } = this.getAgentResourceRollup();
		const agents = this.store.agents;

		return html`
			<div class="bob-overview-scroll">
				${this.renderWorldDayStrip()}
				${this.renderLiveWorldBanner()}

				<div>
					<div class="bob-roster-label">Roster</div>
					<p class="bob-hint">
						Choose <strong>World</strong> for the big picture, or an agent for the <strong>Agent</strong> tab (brain, CLI, stream).
					</p>
					<div class="bob-roster">
						<button
							type="button"
							class="bob-agent-chip bob-agent-chip--ghost"
							?data-active=${selected == null}
							@click=${() => this.selectAgentFromBob(null)}
						>
							World
						</button>
						${agents.map(
							(a: DashboardAgent) => html`
								<button
									type="button"
									class="bob-agent-chip"
									?data-active=${selected === a.name}
									title="${a.persona ?? a.name}"
									@click=${() => this.selectAgentFromBob(a.name)}
								>
									${a.name}
								</button>
							`,
						)}
					</div>
				</div>

				<div>
					<div class="bob-section-title">Agent CLI footprint</div>
					<div class="bob-metric-strip">
						<div>
							<div class="lbl">Running CLIs</div>
							<div class="val">${runningNames.length}</div>
						</div>
						<div>
							<div class="lbl">\u03A3 RAM</div>
							<div class="val">${this.formatResourceMem(sumRss)}</div>
						</div>
						<div>
							<div class="lbl">\u03A3 CPU</div>
							<div class="val">${cpuSamples > 0
								? `${sumCpu < 10 ? sumCpu.toFixed(1) : Math.round(sumCpu)}%`
								: "—"}</div>
						</div>
					</div>
					<p class="bob-hint">Per-process table &amp; perf traces live under <strong>Systems</strong>.</p>
				</div>

				<div>
					<div class="bob-section-title">Recent simulation events</div>
					${this.renderWorldEventRows(8)}
				</div>
			</div>
		`;
	}

	private renderAgentTab(): ReturnType<typeof html> {
		const name = this.store.selectedAgent;
		if (!name) {
			return html`
				<div class="bob-agent-scroll">
					<div class="empty">
						<strong>No agent selected.</strong><br />
						Pick someone from <strong>Overview</strong> or click an agent in the world. You\u{2019}ll see brain state, LLM status, CLI resources, and a short event stream.
					</div>
				</div>
			`;
		}

		const agent = this.store.agents.find((a) => a.name === name);
		const brainState = this.store.agentStates.get(name) ?? "idle";
		const stateColor = AGENT_STATE_COLORS[brainState] ?? AGENT_STATE_COLORS.idle;
		const processAlive = this.store.isProcessAlive(name);
		const llm = this.store.llmStatus.get(name);
		const llmState = llm?.state ?? "idle";
		const scene = capitalizeWord(this.store.currentScene);
		const taskLocked = this.store.taskLockedAgents.has(name);
		const pos = this.store.agentPositions.get(name);
		const m = this.store.agentResourceMetrics.get(name);
		const log = this.store.agentEventLog.get(name) ?? [];
		const now = Date.now();
		const recent = [...log].reverse().slice(0, 12);

		return html`
			<div class="bob-agent-scroll">
				<div class="bob-agent-hero">
					<span class="bob-agent-hero-name">${name}</span>
					<span class="bob-agent-hero-meta">
						${agent?.persona
							? agent.persona
							: agent?.domain
								? `${capitalizeWord(agent.domain)} \u{2022} ${agent.status}`
								: `${agent?.agentType ?? "agent"} \u{2022} ${agent?.status ?? "—"}`}
					</span>
				</div>

				<button type="button" class="bob-clear-sel" @click=${() => this.selectAgentFromBob(null)}>
					Clear selection
				</button>

				<div class="bob-status-grid">
					<span class="bob-status-label">Brain</span>
					<span class="bob-status-value">
						<span class="bob-state-badge" style="background:${stateColor}">${brainState}</span>
						${taskLocked ? " \u{1F512}" : nothing}
					</span>

					<span class="bob-status-label">Process</span>
					<span class="bob-status-value">
						<span class="${processAlive ? "bob-dot-alive" : "bob-dot-dead"}"></span>
						${processAlive ? "CLI running" : "No CLI"}
					</span>

					<span class="bob-status-label">LLM</span>
					<span class="bob-status-value">${llmState}</span>

					<span class="bob-status-label">Scene</span>
					<span class="bob-status-value">${scene}</span>

					${pos
						? html`
							<span class="bob-status-label">Position</span>
							<span class="bob-status-value">${Math.round(pos.x)}, ${Math.round(pos.y)}</span>
						`
						: nothing}

					<span class="bob-status-label">PID</span>
					<span class="bob-status-value">${processAlive ? String(m?.pid ?? "…") : "—"}</span>

					<span class="bob-status-label">RAM</span>
					<span class="bob-status-value">${processAlive ? this.formatResourceMem(m?.rssBytes ?? null) : "—"}</span>

					<span class="bob-status-label">CPU</span>
					<span class="bob-status-value">${processAlive ? this.formatResourceCpu(m?.cpuPercent ?? null) : "—"}</span>
				</div>

				<div>
					<div class="bob-section-title">Agent stream</div>
					${recent.length === 0
						? html`<div class="bob-hint" style="font-style:italic;">No events for this agent yet.</div>`
						: html`
							<div class="bob-agent-events">
								${recent.map((entry) => {
									const color = AGENT_EVENT_COLORS[entry.type] ?? "#6b7280";
									return html`
										<div class="bob-event-compact">
											<span class="bob-event-time">${relativeTimeShort(now - entry.timestamp)}</span>
											<span class="bob-type-pill" style="background:${color}">${entry.type}</span>
											<span class="bob-event-label" title="${entry.summary}">${entry.summary}</span>
										</div>
									`;
								})}
							</div>
						`}
				</div>

				<p class="bob-hint">
					Need the full monitor UI? Open the agent from the roster bar and use the side <strong>Monitor</strong> tab.
				</p>
			</div>
		`;
	}

	private renderSystemsTab(): ReturnType<typeof html> {
		return html`
			<div class="bob-overview-scroll">
				<p class="bob-hint" style="margin-top:0">
					Deep dive: every CLI row, canvas perf, and the full world log. For day-at-a-glance, use <strong>Overview</strong>.
				</p>
				${this.renderWorldDayStrip()}
				${this.renderWorldResourcesMonitor()}
				<div class="world-perf-stack">${this.renderWorldPerfMonitor()}</div>
				<div class="bob-section-title">Full world event log</div>
				${this.renderWorldEventRows(24)}
			</div>
		`;
	}

	private renderDebugLog() {
		const log = this.store.debugLog;
		const debugOn = this.store.debugMode;
		return html`
			<div class="debug-toolbar">
				<label class="debug-toggle">
					<input type="checkbox" .checked=${debugOn} @change=${this.handleDebugToggle} />
					<span class="debug-toggle-label">Log raw LLM I/O</span>
				</label>
				${debugOn ? html`<span class="debug-mode-badge" data-active>RECORDING</span>` : nothing}
			</div>
			${log.length === 0
				? html`<div class="debug-log"><div class="debug-empty">No prompts sent yet.${debugOn ? " Debug mode active — raw I/O will be captured." : ""}</div></div>`
				: html`
					<div class="debug-log">
						${[...log].reverse().map((entry, idx) => {
							const time = new Date(entry.timestamp).toLocaleTimeString();
							const expanded = this.expandedEntries.has(idx);
							return html`
								<div class="debug-entry">
									<div class="debug-header">
										<span class="debug-agent">${entry.agentName}</span>
										<span>${time}</span>
									</div>
									<div class="debug-prompt ${expanded ? "" : "collapsed"}">${entry.prompt}</div>
									${entry.context ? html`<div class="debug-context ${expanded ? "" : "collapsed"}">${entry.context}</div>` : nothing}
									${entry.rawResponse ? html`
										<div class="debug-response-label">RAW RESPONSE</div>
										<div class="debug-response ${expanded ? "" : "collapsed"}">${entry.rawResponse}</div>
									` : nothing}
									<div class="debug-actions">
										<button class="debug-action" @click=${() => this.toggleExpand(idx)}>${expanded ? "Collapse" : "Expand"}</button>
										<button class="debug-action" @click=${() => this.copyToClipboard(entry.prompt)}>Copy Prompt</button>
										${entry.rawResponse ? html`<button class="debug-action" @click=${() => this.copyToClipboard(entry.rawResponse!)}>Copy Response</button>` : nothing}
										<button class="debug-action" @click=${() => this.resendPrompt(entry.agentName, entry.prompt)}>Resend</button>
									</div>
								</div>
							`;
						})}
					</div>
				`}
		`;
	}

	protected renderContent() {
		const sel = this.store.selectedAgent;
		return html`
			${this.open
				? html`
					<div
						id="bob-panel"
						class="chat-overlay"
						role="dialog"
						aria-modal="true"
						aria-label="Bob — world command center"
						@keydown=${this.handleOverlayKeydown}
					>
						<div class="chat-header">
							<div class="chat-title-block">
								<div class="chat-title">
									<span class="name">Bob</span>
									<span class="role">World narrator</span>
								</div>
								<p class="chat-subtitle">
									${this.activeTab === "overview"
										? "Simulation snapshot, roster, and costs."
										: this.activeTab === "chat"
											? "Ask questions about the world and agents."
											: this.activeTab === "agent"
												? sel
													? `Focused on ${sel}.`
													: "Select an agent for live status and stream."
												: this.activeTab === "systems"
													? "Resources, performance, and full logs."
													: "Raw LLM prompts and responses (developers)."}
								</p>
							</div>
							<button type="button" class="close-btn" @click=${this.handleClose} aria-label="Close panel">
								&times;
							</button>
						</div>
						<div class="tab-row" role="tablist" aria-label="Bob panel sections">
							<button
								type="button"
								class="tab-btn"
								role="tab"
								?data-active=${this.activeTab === "overview"}
								@click=${() => this.switchTab("overview")}
							>
								Overview
							</button>
							<button
								type="button"
								class="tab-btn"
								role="tab"
								?data-active=${this.activeTab === "chat"}
								@click=${() => this.switchTab("chat")}
							>
								Chat
							</button>
							<button
								type="button"
								class="tab-btn"
								role="tab"
								?data-active=${this.activeTab === "agent"}
								?data-badge=${Boolean(sel)}
								@click=${() => this.switchTab("agent")}
							>
								Agent
							</button>
							<button
								type="button"
								class="tab-btn"
								role="tab"
								?data-active=${this.activeTab === "systems"}
								@click=${() => this.switchTab("systems")}
							>
								Systems
							</button>
							<button
								type="button"
								class="tab-btn"
								role="tab"
								?data-active=${this.activeTab === "debug"}
								@click=${() => this.switchTab("debug")}
							>
								Debug
							</button>
						</div>
						${this.activeTab === "chat"
							? html`
								<div class="thread" role="log" aria-live="polite">
									${this.renderThread()}
								</div>
								<div class="input-row">
									<input
										class="chat-input"
										type="text"
										placeholder="e.g. Who is busy? What phase are we in?"
										aria-label="Message to Bob"
										@keydown=${this.handleKeydown}
									/>
									<button type="button" class="send-btn" @click=${this.handleSend}>Send</button>
								</div>
							`
							: this.activeTab === "overview"
								? this.renderOverviewTab()
								: this.activeTab === "agent"
									? this.renderAgentTab()
									: this.activeTab === "systems"
										? this.renderSystemsTab()
										: html`<div class="bob-debug-panel">${this.renderDebugLog()}</div>`}
					</div>
				`
				: nothing}

			<button
				type="button"
				class="bob-btn"
				aria-expanded=${this.open ? "true" : "false"}
				aria-controls="bob-panel"
				@click=${this.handleToggle}
			>
				<span class="bob-dot" aria-hidden="true"></span>
				Bob
			</button>
		`;
	}
}

if (!customElements.get("ft-game-ask-bob")) customElements.define("ft-game-ask-bob", AskBob);
