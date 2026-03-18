/**
 * Agent Roster component — horizontal scrollable strip of character cards.
 * Displays agent avatars with status rings, persona names, mood, stats,
 * and a team toggle switch.
 *
 * Custom events:
 * - `agent-selected` — { agent: string } — user clicks a card
 * - `team-toggled` — { enabled: boolean } — user toggles team switch
 */

import { html, css, nothing } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { statusBadge } from "../shared-styles.js";
import type { AgentCard } from "../../domain/agents/types.js";

export class FlowtiAgentRoster extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agents: { type: Array },
		activeAgent: { type: String },
		teamMode: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		css`
			:host {
				display: flex;
				flex-direction: column;
			}

			.roster {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				overflow-x: auto;
				flex-shrink: 0;
			}
			.agent-card {
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				min-width: 64px;
				text-align: center;
				transition: background 0.15s;
			}
			.agent-card:hover { background: var(--background-modifier-hover); }
			.agent-card--active { background: var(--background-modifier-active-hover); }
			.agent-avatar {
				width: 32px; height: 32px;
				border-radius: 50%;
				display: flex; align-items: center; justify-content: center;
				font-weight: 700;
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				border: 2px solid var(--flowti-border);
			}
			.agent-avatar--thinking { border-color: var(--flowti-color-warning); animation: pulse 1.5s infinite; }
			.agent-avatar--speaking { border-color: var(--flowti-color-success); }
			.agent-avatar--using-tool { border-color: var(--flowti-color-info); }
			.agent-name { font-size: 0.75em; margin-top: 2px; }
			.agent-slug { font-size: 0.65em; color: var(--flowti-color-muted); }
			.agent-mood { font-size: 0.65em; color: var(--flowti-color-muted); }
			.agent-stats {
				display: flex;
				gap: 4px;
				margin-top: 2px;
			}
			.agent-stat {
				font-size: 0.6em;
				padding: 1px 4px;
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}
			.team-badge {
				font-size: 0.55em;
				padding: 1px 4px;
				border-radius: var(--flowti-radius);
				background: var(--flowti-color-info);
				color: var(--text-on-accent);
				margin-top: 2px;
			}
			@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

			.team-toggle {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				font-size: 0.75em;
				color: var(--flowti-color-muted);
				border-top: 1px solid var(--flowti-border);
			}
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	teamMode = false;

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = this.agents.length === 0;
		if (this.isEmpty) {
			this.emptyMessage = "No agents available";
		}
	}

	protected renderContent() {
		return html`
			<div class="roster">
				${this.agents.map((a) => this.renderCard(a))}
			</div>
			<div class="team-toggle">
				<label>
					<input
						type="checkbox"
						.checked="${this.teamMode}"
						@change="${this.toggleTeam}"
					/>
					Team mode
				</label>
			</div>
		`;
	}

	private renderCard(agent: AgentCard) {
		const isActive = agent.name === this.activeAgent;
		const displayName = agent.persona ?? agent.name;
		return html`
			<div
				class="agent-card ${isActive ? "agent-card--active" : ""}"
				data-agent="${agent.name}"
				@click="${() => this.selectAgent(agent.name)}"
			>
				<div class="agent-avatar agent-avatar--${agent.activity}">
					${displayName.charAt(0).toUpperCase()}
				</div>
				<div class="agent-name">${displayName}</div>
				${agent.persona ? html`<div class="agent-slug">${agent.name}</div>` : nothing}
				${agent.mood ? html`<div class="agent-mood">${agent.mood}</div>` : nothing}
				${this.renderStats(agent)}
				${this.teamMode ? html`<span class="team-badge">TEAM</span>` : nothing}
			</div>
		`;
	}

	private renderStats(agent: AgentCard) {
		if (agent.intStat == null && agent.chaStat == null) return nothing;
		return html`
			<div class="agent-stats">
				${agent.intStat != null ? html`<span class="agent-stat">INT ${agent.intStat}</span>` : nothing}
				${agent.chaStat != null ? html`<span class="agent-stat">CHA ${agent.chaStat}</span>` : nothing}
			</div>
		`;
	}

	private selectAgent(name: string) {
		this.dispatchEvent(new CustomEvent("agent-selected", {
			detail: { agent: name },
			bubbles: true,
			composed: true,
		}));
	}

	private toggleTeam(e: Event) {
		const enabled = (e.target as HTMLInputElement).checked;
		this.dispatchEvent(new CustomEvent("team-toggled", {
			detail: { enabled },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define("flowti-agent-roster", FlowtiAgentRoster);
