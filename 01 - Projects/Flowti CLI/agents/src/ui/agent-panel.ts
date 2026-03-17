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
				top: 8px;
				right: 8px;
				bottom: 52px;
				width: 340px;
				background: var(--bg-panel);
				border: 1px solid var(--border);
				border-left: 1px solid var(--border-glow);
				box-shadow: var(--panel-shadow);
				display: flex;
				flex-direction: column;
				overflow: hidden;
				z-index: 100;
				border-radius: 3px;
			}

			/* Header */
			.panel-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 10px 12px;
				border-bottom: 1px solid var(--border);
				background: var(--bg-primary);
				flex-shrink: 0;
			}

			.header-left {
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
			}

			.name-block {
				display: flex;
				flex-direction: column;
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

			.agent-persona {
				font-size: 11px;
				color: var(--text-secondary);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.agent-type-badge {
				font-size: 9px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.06em;
				padding: 2px 6px;
				border-radius: 2px;
				background: rgba(78, 139, 217, 0.1);
				color: var(--accent-blue);
				border: 1px solid rgba(78, 139, 217, 0.2);
				flex-shrink: 0;
			}

			.llm-badge {
				font-size: 9px;
				font-weight: 600;
				padding: 2px 6px;
				border-radius: 3px;
				flex-shrink: 0;
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.llm-badge .dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
			}

			.llm-idle .dot { background: #22c55e; }
			.llm-idle { background: rgba(34, 197, 94, 0.12); color: #4ade80; }

			.llm-thinking .dot { background: #f59e0b; animation: pulse 1s infinite; }
			.llm-thinking { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }

			.llm-queued .dot { background: #f59e0b; animation: pulse 2s infinite; }
			.llm-queued { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }

			.llm-error .dot { background: #ef4444; }
			.llm-error { background: rgba(239, 68, 68, 0.12); color: #f87171; }

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.3; }
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
				background: var(--bg-primary);
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
				color: var(--text-muted);
				font-size: 10px;
				font-family: inherit;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				padding: 7px 10px;
				cursor: pointer;
				white-space: nowrap;
				transition: color 0.2s, border-color 0.2s, text-shadow 0.2s;
				flex-shrink: 0;
				border-radius: 0;
			}

			.tab-btn:hover {
				color: var(--text-primary);
			}

			.tab-btn[data-active="true"] {
				color: var(--accent-gold);
				border-bottom-color: var(--accent-gold);
				text-shadow: 0 0 8px rgba(217, 170, 78, 0.3);
			}

			/* Content area */
			.panel-content {
				flex: 1;
				overflow-y: auto;
				padding: 10px 12px;
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

	private renderLlmBadge(agentName: string) {
		const status = this.store.llmStatus.get(agentName);
		const state = status?.state ?? "idle";
		const labels: Record<string, string> = {
			idle: "LLM idle",
			queued: "Queued...",
			thinking: "Thinking...",
			error: "LLM error",
		};
		return html`
			<span class="llm-badge llm-${state}">
				<span class="dot"></span>
				${labels[state] ?? state}
			</span>
		`;
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
						<div class="name-block">
							<span class="agent-name" data-testid="panel-agent-name">${agent.persona ?? agent.name}</span>
							${agent.persona ? html`<span class="agent-persona">${agent.name}</span>` : nothing}
						</div>
						<span class="agent-type-badge">${agent.agentType}</span>
						${this.renderLlmBadge(agent.name)}
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
