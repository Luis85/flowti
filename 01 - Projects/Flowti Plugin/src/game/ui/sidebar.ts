/**
 * sidebar.ts — Collapsible ambient dashboard rail + slide panel orchestrator.
 *
 * Collapsed (56px): council portraits with intent-colored rings and critical-need dots.
 * Expanded (200px): mini agent cards with name, intent badge, and 6-axis needs radar.
 * Auto-collapses when a slide panel opens, restores state when it closes.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { StoreController } from "./store-controller.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import { renderPortrait } from "./portrait.js";
import { renderNeedsRadar } from "./needs-radar.js";
import { getCouncilSlots, STATE_COLORS, NEED_META, NEED_CRITICAL_THRESHOLD } from "./game-ui-constants.js";
import type { DashboardStore, PanelMode } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentIntent } from "../systems/blackboard.js";
import type { IEventBus } from "../../infrastructure/events/types.js";
import type { IAgentWorldPerfDashboard } from "../../infrastructure/services/perfTypes.js";
import { MERCHANT_CATALOG } from "../data/merchant-catalog.js";

// Side-effect imports to register child components
import "./slide-panel.js";
import "./roster-panel.js";
import "./agent-detail-modal.js";
import "./ask-bob.js";
import "./merchant-panel.js";
import "./briefing-panel.js";

export class GameSidebar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		eventBus: { attribute: false },
		getPerfDashboard: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		css`
			/* ── Rail container ─────────────────────────────── */
			:host {
				position: fixed;
				left: 0;
				top: 0;
				bottom: 0;
				width: var(--rail-width-collapsed);
				z-index: 90;
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: 8px 0;
				background: var(--bg-primary);
				border-right: 1px solid var(--border);
				transition: width 200ms ease-out;
			}

			:host([expanded]) {
				width: var(--rail-width-expanded);
				align-items: stretch;
			}

			/* ── Council slots ──────────────────────────────── */
			.council-slots {
				display: flex;
				flex-direction: column;
				gap: 8px;
				align-items: center;
			}

			:host([expanded]) .council-slots {
				padding: 0 8px;
				align-items: stretch;
				gap: 6px;
			}

			/* ── Collapsed portrait slot ────────────────────── */
			.council-slot {
				width: 40px;
				height: 40px;
				border-radius: 50%;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: transform 0.1s;
				position: relative;
			}

			.council-slot:hover {
				transform: scale(1.1);
			}

			.empty-slot {
				border: 2px dashed var(--border);
				opacity: 0.3;
			}

			/* ── Critical need pulsing dot ───────────────────── */
			.critical-dot {
				position: absolute;
				bottom: 0;
				right: 0;
				width: 4px;
				height: 4px;
				border-radius: 50%;
				background: var(--accent-red);
				animation: pulse 1.5s ease-in-out infinite;
			}

			@keyframes pulse {
				0%, 100% { opacity: 1; transform: scale(1); }
				50% { opacity: 0.5; transform: scale(1.3); }
			}

			/* ── Chevron toggle ──────────────────────────────── */
			.chevron {
				width: 24px;
				height: 24px;
				border: none;
				background: none;
				color: var(--text-muted);
				cursor: pointer;
				font-size: 16px;
				display: flex;
				align-items: center;
				justify-content: center;
				opacity: 0.3;
				transition: opacity 0.15s;
				margin: 4px 0;
				padding: 0;
			}

			:host(:hover) .chevron {
				opacity: 0.7;
			}

			.chevron:hover {
				opacity: 1;
				color: var(--text-primary);
				background: none;
				border: none;
				box-shadow: none;
			}

			/* ── Expanded header ─────────────────────────────── */
			.expanded-header {
				display: flex;
				justify-content: flex-end;
				padding: 0 8px;
				margin-bottom: 4px;
			}

			.expanded-header .chevron {
				opacity: 0.5;
			}

			/* ── Agent card (expanded state) ─────────────────── */
			.agent-card {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 4px;
				padding: 8px;
				cursor: pointer;
				transition: border-color 0.15s;
			}

			.agent-card:hover {
				border-color: rgba(217, 170, 78, 0.4);
			}

			.empty-card {
				border-style: dashed;
				opacity: 0.3;
				min-height: 48px;
			}

			.agent-card-top {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.portrait-wrap {
				position: relative;
				flex-shrink: 0;
			}

			.agent-card-info {
				display: flex;
				flex-direction: column;
				min-width: 0;
				gap: 2px;
			}

			.card-name {
				font-size: 12px;
				color: var(--text-primary);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.card-intent {
				font-size: 10px;
				color: var(--text-secondary);
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.intent-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.agent-card-radar {
				display: flex;
				justify-content: center;
				margin-top: 4px;
			}

			/* ── Card fade-in on expand ──────────────────────── */
			:host([expanded]) .agent-card,
			:host([expanded]) .empty-card {
				animation: card-fade 150ms ease-out 100ms both;
			}

			@keyframes card-fade {
				from { opacity: 0; transform: translateX(-4px); }
				to { opacity: 1; transform: translateX(0); }
			}

			/* ── Spacer + action buttons ─────────────────────── */
			.spacer {
				flex: 1;
			}

			.action-btn {
				width: 32px;
				height: 32px;
				border-radius: 6px;
				cursor: pointer;
				margin-bottom: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				color: var(--text-secondary);
				transition: all 0.15s;
				font-family: inherit;
				padding: 0;
			}

			.action-btn:hover {
				background: var(--bg-tertiary);
				color: var(--text-primary);
			}

			.action-btn[data-active] {
				border-left: 3px solid var(--accent-gold);
				color: var(--accent-gold);
				background: var(--bg-tertiary);
			}

			:host([expanded]) .action-btn {
				margin-left: auto;
				margin-right: auto;
			}
		`,
	];

	store!: DashboardStore;
	eventBus?: IEventBus;
	getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined;

	private storeCtrl = new StoreController(this, () => this.store);

	connectedCallback(): void {
		super.connectedCallback();
		this.addEventListener("dblclick", this.handleDblClick);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.removeEventListener("dblclick", this.handleDblClick);
	}

	private handleDblClick = (e: MouseEvent): void => {
		// Only toggle on background double-click (not on buttons/cards)
		const target = e.target as HTMLElement;
		if (target === this || target.classList.contains("spacer") || target.classList.contains("council-slots")) {
			this.toggleExpand();
		}
	};

	/* ── Collapse/expand state (private, not in DashboardStore) ─── */

	private expanded = false;
	private expandedBeforePanel: boolean | null = null;
	private previousActivePanel: string | null = null;

	/* ── Computed helpers ──────────────────────────────────────── */

	private get councilAgents(): (DashboardAgent | null)[] {
		return getCouncilSlots(this.store?.council ?? [], this.store?.agents ?? []);
	}

	private getAgentIntent(name: string): AgentIntent {
		return (this.store?.agentIntents?.get(name) as AgentIntent) ?? "idle";
	}

	private getIntentColor(name: string): string {
		const intent = this.getAgentIntent(name);
		return STATE_COLORS[intent] ?? "#6b7280";
	}

	private hasLowNeed(name: string): boolean {
		const needs = this.store?.getAgentNeeds(name);
		if (!needs) return false;
		return NEED_META.some((m) => (needs[m.key] ?? 100) < NEED_CRITICAL_THRESHOLD);
	}

	/* ── Auto-collapse logic ──────────────────────────────────── */

	private checkAutoCollapse(): void {
		const current = this.store?.activePanel ?? null;
		const prev = this.previousActivePanel;
		if (prev === null && current !== null) {
			this.expandedBeforePanel = this.expanded;
			this.expanded = false;
			this.removeAttribute("expanded");
		} else if (prev !== null && current === null) {
			this.expanded = this.expandedBeforePanel ?? false;
			this.expandedBeforePanel = null;
			if (this.expanded) this.setAttribute("expanded", ""); else this.removeAttribute("expanded");
		}
		this.previousActivePanel = current;
	}

	private toggleExpand(): void {
		this.expanded = !this.expanded;
		if (this.expanded) this.setAttribute("expanded", ""); else this.removeAttribute("expanded");
		this.requestUpdate();
	}

	/* ── Lifecycle — auto-collapse before render ───────────────── */

	protected willUpdate(_changed: Map<string, unknown>): void {
		this.checkAutoCollapse();
	}

	/* ── Council slot handlers ─────────────────────────────────── */

	private handleCouncilClick(agent: DashboardAgent): void {
		this.store.selectAgent(agent.name);
	}

	/* ── Action button handlers ────────────────────────────────── */

	private togglePanel(mode: PanelMode): void {
		this.store.setActivePanel(this.store.activePanel === mode ? null : mode);
	}

	/* ── Panel close ───────────────────────────────────────────── */

	private handlePanelClose(): void {
		if (this.store.activePanel === "agent-detail") {
			this.store.stopFollow();
			this.store.selectAgent(null);
		}
		if (this.store.activePanel === "briefing") {
			this.store.briefingData = null;
		}
		this.store.setActivePanel(null);
	}

	/* ── Panel helpers ─────────────────────────────────────────── */

	private panelTitle(mode: PanelMode): string {
		switch (mode) {
			case "agent-detail": return this.store.selectedAgent ?? "Agent";
			case "bob": return "Ask Bob";
			case "roster": return "Council & Roster";
			case "merchant": return "Merchant";
			case "briefing": return "Welcome Back";
		}
	}

	private panelAccent(mode: PanelMode): string {
		switch (mode) {
			case "agent-detail": return "var(--text-primary)";
			case "bob": return "var(--accent-blue)";
			case "roster": return "var(--accent-green)";
			case "merchant": return "var(--accent-gold)";
			case "briefing": return "var(--accent-purple)";
		}
	}

	private renderPanelContent(mode: PanelMode) {
		switch (mode) {
			case "agent-detail":
				return html`<ft-game-agent-detail-modal
					.store=${this.store}
					embedded
				></ft-game-agent-detail-modal>`;
			case "bob":
				return html`<ft-game-ask-bob
					.store=${this.store}
					.eventBus=${this.eventBus}
					.getPerfDashboard=${this.getPerfDashboard}
					embedded
				></ft-game-ask-bob>`;
			case "roster":
				return html`<ft-game-roster-panel
					.store=${this.store}
				></ft-game-roster-panel>`;
			case "merchant":
				return html`<ft-game-merchant-panel
					.agents=${this.store.agents.map(a => ({
						name: a.name,
						coin: a.coin ?? 0,
						level: a.level ?? 1,
						capabilities: a.capabilities,
					}))}
					.catalog=${[...MERCHANT_CATALOG]}
					.selectedAgent=${this.store.selectedAgent ?? this.store.agents[0]?.name ?? ""}
					embedded
				></ft-game-merchant-panel>`;
			case "briefing":
				return html`<ft-game-briefing
					.store=${this.store}
					.results=${this.store.briefingData?.results ?? null}
					.narrativeText=${this.store.briefingData?.narrativeText ?? ""}
					embedded
				></ft-game-briefing>`;
		}
	}

	private renderPanel() {
		const mode = this.store?.activePanel;
		if (!mode) return nothing;

		const title = this.panelTitle(mode);
		return html`
			<ft-game-slide-panel
				?open=${true}
				title=${title}
				accent=${this.panelAccent(mode)}
				@panel-close=${() => this.handlePanelClose()}
			>
				${this.renderPanelContent(mode)}
			</ft-game-slide-panel>
		`;
	}

	/* ── Action buttons with SVG icons ─────────────────────────── */

	private renderActionButtons(active: string | null) {
		return html`
			<button class="action-btn" ?data-active=${active === "bob"} @click=${() => this.togglePanel("bob")} title="Ask Bob">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<rect x="2" y="4" width="20" height="14" rx="3"/>
					<path d="M8 18 l-2 3 l4 -1"/>
				</svg>
			</button>
			<button class="action-btn" ?data-active=${active === "roster"} @click=${() => this.togglePanel("roster")} title="Council & Roster">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="9" cy="8" r="4"/><path d="M1 20 c0,-5 4,-8 8,-8 c4,0 8,3 8,8"/>
					<circle cx="17" cy="7" r="3"/><path d="M19 20 c3,-1 5,-3 5,-6 c-1,-2 -3,-3 -5,-3"/>
				</svg>
			</button>
			<button class="action-btn" ?data-active=${active === "merchant"} @click=${() => this.togglePanel("merchant")} title="Merchant">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 9 l1,-5 h16 l1,5"/><path d="M3 9 v12 h18 v-12"/><rect x="9" y="14" width="6" height="7"/>
					<path d="M3 9 c0,2 2,3 3,3 c2,0 3,-1 3,-3 c0,2 2,3 3,3 c2,0 3,-1 3,-3 c0,2 2,3 3,3 c2,0 3,-1 3,-3"/>
				</svg>
			</button>
		`;
	}

	/* ── Collapsed state render ─────────────────────────────────── */

	private renderCollapsedSlot(agent: DashboardAgent) {
		const low = this.hasLowNeed(agent.name);
		const intent = this.getAgentIntent(agent.name);
		return html`
			<div
				class="council-slot"
				@click=${() => this.handleCouncilClick(agent)}
				title="${agent.name} — ${intent}"
			>
				${renderPortrait(agent.name, agent.domain ?? "fallback", 40, agent.trustTier, this.store?.spriteBasePath)}
				${low ? html`<span class="critical-dot"></span>` : nothing}
			</div>
		`;
	}

	private renderCollapsed(slots: (DashboardAgent | null)[], active: string | null) {
		return html`
			<div class="council-slots">
				${slots.map((agent) => agent
					? this.renderCollapsedSlot(agent)
					: html`<div class="council-slot empty-slot"></div>`
				)}
			</div>
			<button class="chevron" @click=${() => this.toggleExpand()} title="Expand sidebar">&#x203A;</button>
			<div class="spacer"></div>
			${this.renderActionButtons(active)}
			${this.renderPanel()}
		`;
	}

	/* ── Expanded state render ──────────────────────────────────── */

	private renderAgentCard(agent: DashboardAgent) {
		const intentColor = this.getIntentColor(agent.name);
		const intent = this.getAgentIntent(agent.name);
		const needs = this.store?.getAgentNeeds(agent.name);
		const low = this.hasLowNeed(agent.name);

		return html`
			<div class="agent-card" @click=${() => this.handleCouncilClick(agent)}>
				<div class="agent-card-top">
					<div class="portrait-wrap">
						${renderPortrait(agent.name, agent.domain ?? "fallback", 32, agent.trustTier, this.store?.spriteBasePath)}
						${low ? html`<span class="critical-dot"></span>` : nothing}
					</div>
					<div class="agent-card-info">
						<span class="card-name">${agent.name}</span>
						<span class="card-intent">
							<span class="intent-dot" style="background:${intentColor}"></span>
							${intent}
						</span>
					</div>
				</div>
				<div class="agent-card-radar">
					${renderNeedsRadar(needs, 30)}
				</div>
			</div>
		`;
	}

	private renderExpanded(slots: (DashboardAgent | null)[], active: string | null) {
		return html`
			<div class="expanded-header">
				<button class="chevron" @click=${() => this.toggleExpand()} title="Collapse sidebar">&#x2039;</button>
			</div>
			<div class="council-slots">
				${slots.map((agent) => agent
					? this.renderAgentCard(agent)
					: html`<div class="agent-card empty-card"></div>`
				)}
			</div>
			<div class="spacer"></div>
			${this.renderActionButtons(active)}
			${this.renderPanel()}
		`;
	}

	/* ── Main render ───────────────────────────────────────────── */

	protected renderContent() {
		const slots = this.councilAgents;
		const active = this.store?.activePanel ?? null;

		return this.expanded
			? this.renderExpanded(slots, active)
			: this.renderCollapsed(slots, active);
	}
}

if (!customElements.get("ft-game-sidebar")) {
	customElements.define("ft-game-sidebar", GameSidebar);
}
