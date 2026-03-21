/**
 * ask-bob.ts — Floating "Ask Bob" button + chat overlay.
 *
 * Bob is the world narrator — a single LLM agent that knows the full world state
 * and can answer questions about what agents are doing, impersonate agents in
 * conversations, and provide ambient commentary.
 */

import { html, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import { askBobStyles } from "./ask-bob-styles.js";
import type { DashboardStore, ConversationTurn } from "../store/dashboard-store.js";
import type { IEventBus, EventPayload } from "../../infrastructure/events/types.js";
import type { IAgentWorldPerfDashboard, AgentWorldPerfSummary } from "../../infrastructure/services/perfTypes.js";

const BOB_AGENT_NAME = "Bob";

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
	private activeTab: "chat" | "debug" | "world" = "chat";
	private expandedEntries = new Set<number>();

	private perfMonitorEnabled = false;
	private lastPerfSample: EventPayload<"perf.agentWorld.sample"> | null = null;
	private perfLocalSlowFrames = 0;

	private unsubscribe: (() => void) | null = null;
	private perfBusUnsubs: Array<() => void> = [];

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.syncFromStore();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
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

	private switchTab(tab: "chat" | "debug" | "world"): void {
		this.activeTab = tab;
		this.refreshPerfBusListeners();
	}

	private teardownPerfBusListeners(): void {
		for (const u of this.perfBusUnsubs) {
			try { u(); } catch { /* ignore */ }
		}
		this.perfBusUnsubs = [];
	}

	private refreshPerfBusListeners(): void {
		this.teardownPerfBusListeners();
		if (!this.perfMonitorEnabled || this.activeTab !== "world" || !this.eventBus) return;
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

	private readPerfAggregatorSummary(): AgentWorldPerfSummary | null {
		const dash = this.perfDashboard ?? this.getPerfDashboard?.();
		if (!dash) return null;
		try {
			return dash.getAgentWorldSummary();
		} catch {
			return null;
		}
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
				<div class="world-perf-wait">Waiting for first sample (~2s of canvas activity)…</div>
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
			return html`<div class="empty">Ask Bob anything about the world...</div>`;
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

	private renderWorldMonitor() {
		const phase = this.store.dayPhase.replace(/-/g, " ");
		const weather = this.store.weatherState;
		const progress = Math.round(this.store.dayProgress * 100);
		const cycle = this.store.cycleCount;
		const activeEvent = this.store.activeWorldEvent;
		const log = [...this.store.worldEventLog].reverse().slice(0, 20);

		const PHASE_EMOJI: Record<string, string> = {
			"morning arrival": "\u{1F305}",
			"productive morning": "\u{1F4BB}",
			"lunch": "\u{1F35C}",
			"afternoon": "\u{2615}",
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
		const EVENT_COLOR: Record<string, string> = {
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

		return html`
			<div class="thread" style="padding: 8px; gap: 6px; display: flex; flex-direction: column;">
				${this.renderWorldPerfMonitor()}
				<!-- Status bar -->
				<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: var(--bg-secondary); border-radius: 3px; border: 1px solid var(--border);">
					<div style="display: flex; flex-direction: column; gap: 2px;">
						<span style="color: var(--accent-gold); font-size: 11px; font-weight: bold;">
							${PHASE_EMOJI[phase] ?? "\u{1F551}"} ${phase}
						</span>
						<span style="color: var(--text-secondary); font-size: 10px;">
							Cycle ${cycle} \u{2022} ${progress}% complete
						</span>
					</div>
					<span style="font-size: 14px;" title="${weather}">
						${WEATHER_EMOJI[weather] ?? "\u{2600}\u{FE0F}"}
					</span>
				</div>

				<!-- Day progress bar -->
				<div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
					<div style="height: 100%; width: ${progress}%; background: var(--accent-gold); border-radius: 2px; transition: width 1s;"></div>
				</div>

				<!-- Active event -->
				${activeEvent ? html`
					<div style="padding: 4px 8px; background: rgba(217, 170, 78, 0.1); border: 1px solid var(--accent-gold); border-radius: 3px; display: flex; align-items: center; gap: 6px;">
						<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent-gold); animation: bob-pulse 1.5s ease-in-out infinite;"></span>
						<span style="color: var(--accent-gold); font-size: 10px;">LIVE: ${activeEvent}</span>
					</div>
				` : nothing}

				<!-- Event log -->
				<div style="font-size: 10px; color: var(--text-secondary); padding-top: 4px; border-top: 1px solid var(--border);">
					Event Log
				</div>
				${log.length === 0 ? html`
					<div style="color: var(--text-muted); font-size: 10px; text-align: center; padding: 12px;">
						No events yet — waiting for the day to begin...
					</div>
				` : log.map((entry) => {
					const time = new Date(entry.timestamp);
					const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
					const color = EVENT_COLOR[entry.type] ?? "#8e8979";
					return html`
						<div style="display: flex; align-items: center; gap: 6px; padding: 3px 0;">
							<span style="color: var(--text-muted); font-size: 9px; flex-shrink: 0; width: 48px;">${timeStr}</span>
							<span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
							<span style="color: var(--text-primary); font-size: 10px;">${entry.label}</span>
						</div>
					`;
				})}
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
		return html`
			${this.open ? html`
				<div class="chat-overlay">
					<div class="chat-header">
						<div class="chat-title">
							<span class="name">Bob</span>
							<span class="role">World Narrator</span>
						</div>
						<button class="close-btn" @click=${this.handleClose}>&times;</button>
					</div>
					<div class="tab-row">
						<button class="tab-btn" ?data-active=${this.activeTab === "chat"} @click=${() => this.switchTab("chat")}>Chat</button>
						<button class="tab-btn" ?data-active=${this.activeTab === "world"} @click=${() => this.switchTab("world")}>World</button>
						<button class="tab-btn" ?data-active=${this.activeTab === "debug"} @click=${() => this.switchTab("debug")}>Debug</button>
					</div>
					${this.activeTab === "chat" ? html`
						<div class="thread">
							${this.renderThread()}
						</div>
						<div class="input-row">
							<input
								class="chat-input"
								type="text"
								placeholder="Ask Bob about the world..."
								@keydown=${this.handleKeydown}
							/>
							<button class="send-btn" @click=${this.handleSend}>Send</button>
						</div>
					` : this.activeTab === "world" ? this.renderWorldMonitor() : this.renderDebugLog()}
				</div>
			` : nothing}

			<button class="bob-btn" @click=${this.handleToggle}>
				<span class="bob-dot"></span>
				Ask Bob
			</button>
		`;
	}
}

if (!customElements.get("ft-game-ask-bob")) customElements.define("ft-game-ask-bob", AskBob);
