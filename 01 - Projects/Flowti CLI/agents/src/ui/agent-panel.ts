/**
 * Agent panel shell — Lit component that hosts the 5 tab sub-components.
 * Opens when store.selectedAgent is non-null; closes via the × button.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./shared-styles.js";
import type { DashboardStore, TabName } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";

// Side-effect imports to register sub-components
import "./panel-info.js";
import "./panel-talk.js";
import "./panel-tasks.js";
import "./panel-permissions.js";
import "./panel-history.js";

const TAB_LABELS: ReadonlyArray<{ name: TabName; label: string }> = [
	{ name: "info", label: "Info" },
	{ name: "talk", label: "Talk" },
	{ name: "tasks", label: "Tasks" },
	{ name: "permissions", label: "Permissions" },
	{ name: "history", label: "History" },
];

@customElement("agent-panel")
export class AgentPanel extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		css`
			:host {
				display: block;
			}

			.panel {
				position: absolute;
				top: 0;
				right: 0;
				width: 340px;
				height: 100%;
				background: #1e293b;
				border-left: 1px solid #334155;
				box-shadow: -4px 0 16px rgba(0, 0, 0, 0.5);
				display: flex;
				flex-direction: column;
				overflow: hidden;
				z-index: 100;
			}

			/* Header */
			.panel-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 14px;
				border-bottom: 1px solid var(--border);
				background: #0f172a;
				flex-shrink: 0;
			}

			.header-left {
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
			}

			.agent-name {
				font-size: 15px;
				font-weight: 600;
				color: var(--text-primary);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.agent-type-badge {
				font-size: 10px;
				font-weight: 600;
				text-transform: uppercase;
				padding: 2px 6px;
				border-radius: 3px;
				background: #1e3a5f;
				color: var(--accent-blue);
				flex-shrink: 0;
			}

			.close-btn {
				background: transparent;
				border: none;
				color: var(--text-secondary);
				font-size: 18px;
				line-height: 1;
				cursor: pointer;
				padding: 2px 6px;
				border-radius: 4px;
				transition: color 0.15s, background 0.15s;
				flex-shrink: 0;
			}

			.close-btn:hover {
				color: var(--text-primary);
				background: var(--bg-tertiary);
			}

			/* Tab bar */
			.tab-bar {
				display: flex;
				border-bottom: 1px solid var(--border);
				background: #0f172a;
				flex-shrink: 0;
				overflow-x: auto;
				scrollbar-width: none;
			}

			.tab-bar::-webkit-scrollbar {
				display: none;
			}

			.tab-btn {
				background: transparent;
				border: none;
				border-bottom: 2px solid transparent;
				color: var(--text-secondary);
				font-size: 12px;
				font-family: inherit;
				padding: 8px 12px;
				cursor: pointer;
				white-space: nowrap;
				transition: color 0.15s, border-color 0.15s;
				flex-shrink: 0;
				border-radius: 0;
			}

			.tab-btn:hover {
				color: var(--text-primary);
			}

			.tab-btn[data-active="true"] {
				color: var(--accent-blue);
				border-bottom-color: var(--accent-blue);
			}

			/* Content area */
			.panel-content {
				flex: 1;
				overflow-y: auto;
				padding: 12px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.panel-content panel-info,
			.panel-content panel-talk,
			.panel-content panel-tasks,
			.panel-content panel-permissions,
			.panel-content panel-history {
				display: block;
				height: 100%;
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;

	private storeHandler = () => { this.requestUpdate(); };

	connectedCallback(): void {
		super.connectedCallback();
		if (this.store) {
			this.store.addEventListener("state-changed", this.storeHandler);
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.store) {
			this.store.removeEventListener("state-changed", this.storeHandler);
		}
	}

	private getAgent(): DashboardAgent | undefined {
		const name = this.store?.selectedAgent;
		if (!name) return undefined;
		return this.store.agents.find((a) => a.name === name);
	}

	private handleClose(): void {
		this.store.selectAgent(null);
	}

	private handleTabClick(tab: TabName): void {
		this.store.selectTab(tab);
	}

	private renderTabContent(agent: DashboardAgent) {
		const tab = this.store.selectedTab;

		switch (tab) {
			case "info":
				return html`<panel-info .agent="${agent}"></panel-info>`;
			case "talk":
				return html`<panel-talk .store="${this.store}" agentName="${agent.name}"></panel-talk>`;
			case "tasks":
				return html`<panel-tasks .store="${this.store}" .agent="${agent}"></panel-tasks>`;
			case "permissions":
				return html`<panel-permissions .store="${this.store}" agentName="${agent.name}"></panel-permissions>`;
			case "history":
				return html`<panel-history .store="${this.store}" agentName="${agent.name}"></panel-history>`;
			default:
				return nothing;
		}
	}

	render() {
		if (!this.store || !this.store.selectedAgent) return nothing;

		const agent = this.getAgent();
		if (!agent) return nothing;

		const selectedTab = this.store.selectedTab;

		return html`
			<div class="panel" data-testid="agent-panel">
				<div class="panel-header">
					<div class="header-left">
						<span class="agent-name" data-testid="panel-agent-name">${agent.name}</span>
						<span class="agent-type-badge">${agent.agentType}</span>
					</div>
					<button
						class="close-btn"
						data-testid="panel-close"
						@click="${this.handleClose}"
					>&#xD7;</button>
				</div>

				<div class="tab-bar" role="tablist">
					${TAB_LABELS.map(({ name, label }) => html`
						<button
							class="tab-btn"
							role="tab"
							data-tab="${name}"
							data-active="${selectedTab === name}"
							@click="${() => { this.handleTabClick(name); }}"
						>${label}</button>
					`)}
				</div>

				<div class="panel-content">
					${this.renderTabContent(agent)}
				</div>
			</div>
		`;
	}
}
