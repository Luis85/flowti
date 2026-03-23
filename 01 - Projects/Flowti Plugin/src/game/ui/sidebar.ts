/**
 * sidebar.ts — Unified game sidebar: rail + slide panel orchestrator.
 *
 * Replaces the old council-sidebar with a single component that provides:
 * - A fixed left-edge rail (80px) showing council agent portraits and action buttons
 * - A slide panel (ft-game-slide-panel) that renders panel content based on
 *   `store.activePanel` (agent-detail, bob, roster, merchant, briefing)
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { StoreController } from "./store-controller.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import { renderPortrait } from "./portrait.js";
import { getCouncilSlots } from "./game-ui-constants.js";
import type { DashboardStore, PanelMode } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";
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
			:host {
				position: fixed;
				left: 0;
				top: 0;
				bottom: 0;
				width: 80px;
				z-index: 90;
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: 12px 0;
				background: var(--bg-primary);
				border-right: 1px solid var(--border);
			}

			.council-slots {
				display: flex;
				flex-direction: column;
				gap: 8px;
				align-items: center;
			}

			.council-slot {
				width: 48px;
				height: 48px;
				border-radius: 50%;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: transform 0.1s;
			}

			.council-slot:hover {
				transform: scale(1.1);
			}

			.empty-slot {
				border: 2px dashed var(--border);
				opacity: 0.5;
			}

			.spacer {
				flex: 1;
			}

			.action-btn {
				width: 48px;
				height: 48px;
				border-radius: 8px;
				cursor: pointer;
				margin-bottom: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				color: var(--text-secondary);
				font-size: 18px;
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
		`,
	];

	store!: DashboardStore;
	eventBus?: IEventBus;
	getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined;

	private storeCtrl = new StoreController(this, () => this.store);

	/* ── Computed helpers ──────────────────────────────────────── */

	private get councilAgents(): (DashboardAgent | null)[] {
		return getCouncilSlots(this.store?.council ?? [], this.store?.agents ?? []);
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

	/* ── Panel content helpers ─────────────────────────────────── */

	private panelTitle(mode: PanelMode): string {
		switch (mode) {
			case "agent-detail": return this.store.selectedAgent ?? "Agent";
			case "bob": return "Ask Bob";
			case "roster": return "Council & Roster";
			case "merchant": return "Merchant";
			case "briefing": return "Welcome Back";
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
				@panel-close=${() => this.handlePanelClose()}
			>
				${this.renderPanelContent(mode)}
			</ft-game-slide-panel>
		`;
	}

	/* ── Render ─────────────────────────────────────────────────── */

	private renderFilledSlot(agent: DashboardAgent) {
		return html`
			<div
				class="council-slot"
				@click=${() => this.handleCouncilClick(agent)}
			>
				${renderPortrait(agent.name, agent.domain ?? "fallback", 40, agent.trustTier)}
			</div>
		`;
	}

	private renderEmptySlot() {
		return html`<div class="council-slot empty-slot"></div>`;
	}

	protected renderContent() {
		const slots = this.councilAgents;
		const active = this.store?.activePanel;

		return html`
			<div class="council-slots">
				${slots.map(agent =>
					agent ? this.renderFilledSlot(agent) : this.renderEmptySlot(),
				)}
			</div>

			<div class="spacer"></div>

			<button
				class="action-btn"
				?data-active=${active === "bob"}
				@click=${() => this.togglePanel("bob")}
				title="Ask Bob"
			>B</button>
			<button
				class="action-btn"
				?data-active=${active === "roster"}
				@click=${() => this.togglePanel("roster")}
				title="Council & Roster"
			>R</button>
			<button
				class="action-btn"
				?data-active=${active === "merchant"}
				@click=${() => this.togglePanel("merchant")}
				title="Merchant"
			>M</button>

			${this.renderPanel()}
		`;
	}
}

if (!customElements.get("ft-game-sidebar")) {
	customElements.define("ft-game-sidebar", GameSidebar);
}
