/**
 * Root Lit component for the Agent Sidepanel.
 * Composes child components: roster → mode bar → active mode → input bar.
 * Phase B: delegates all rendering to child Lit components.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { AgentCard, ConversationTurn, ConversationMode } from "../../domain/agents/types.js";

// Side-effect imports to register child custom elements
import "./flowti-agent-roster.js";
import "./flowti-mode-bar.js";
import "./flowti-conversational-mode.js";
import "./flowti-document-mode.js";
import "./flowti-canvas-mode.js";
import "./flowti-input-bar.js";

export class FlowtiAgentSidepanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agents: { type: Array },
		activeAgent: { type: String },
		activeMode: { type: String },
		turns: { type: Array },
		teamMode: { type: Boolean },
		processing: { type: Boolean },
		error: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}

			.error-banner {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
				color: var(--color-red, #e53935);
				font-size: var(--flowti-font-sm, 0.85em);
				border-bottom: 1px solid var(--background-modifier-border);
			}

			.offline-cta {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				flex: 1;
				gap: var(--flowti-space-md, 16px);
				padding: var(--flowti-space-xl, 32px);
				text-align: center;
				color: var(--text-muted);
			}

			.offline-cta .icon {
				font-size: 2.5em;
				opacity: 0.4;
			}

			.offline-cta p {
				margin: 0;
				font-size: var(--flowti-font-sm, 0.85em);
				line-height: 1.5;
			}

		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	activeMode: ConversationMode = "conversational";
	turns: ConversationTurn[] = [];
	teamMode = false;
	processing = false;
	error = "";

	protected renderContent() {
		const offline = this.agents.length === 0;
		const activeCard = this.agents.find((a) => a.name === this.activeAgent);
		const label = this.teamMode
			? "Talking to team"
			: offline
				? "Offline"
				: `Talking to ${activeCard?.persona ?? this.activeAgent}`;

		if (offline) {
			return html`
				<div class="offline-cta">
					<span class="icon">&#x1F30D;</span>
					<p>No agents found.<br/>Define agents in your project to get started.</p>
				</div>
			`;
		}

		return html`
			${this.error ? html`<div class="error-banner">${this.error}</div>` : ""}
			<flowti-agent-roster
				.agents="${this.agents}"
				.activeAgent="${this.activeAgent}"
				.teamMode="${this.teamMode}"
			></flowti-agent-roster>
			<flowti-mode-bar
				.activeMode="${this.activeMode}"
			></flowti-mode-bar>
			${this.renderActiveMode()}
			<flowti-input-bar
				.agentLabel="${label}"
				.processing="${this.processing}"
			></flowti-input-bar>
		`;
	}

	private renderActiveMode() {
		switch (this.activeMode) {
			case "document":
				return html`<flowti-document-mode .turns="${this.turns}" .agentName="${this.activeAgent}"></flowti-document-mode>`;
			case "canvas":
				return html`<flowti-canvas-mode .turns="${this.turns}" .agentName="${this.activeAgent}"></flowti-canvas-mode>`;
			case "conversational":
			default:
				return html`<flowti-conversational-mode .turns="${this.turns}" .agentName="${this.activeAgent}"></flowti-conversational-mode>`;
		}
	}
}

if (!customElements.get("flowti-agent-sidepanel")) customElements.define("flowti-agent-sidepanel", FlowtiAgentSidepanel);
