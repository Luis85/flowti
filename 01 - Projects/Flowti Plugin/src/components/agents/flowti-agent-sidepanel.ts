/**
 * Root Lit component for the Agent Sidepanel.
 * Composes child components: roster → mode bar → active mode → input bar.
 * Phase B: delegates all rendering to child Lit components.
 */

import { html, css } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
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
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	activeMode: ConversationMode = "conversational";
	turns: ConversationTurn[] = [];
	teamMode = false;
	processing = false;

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = this.agents.length === 0;
		if (this.isEmpty) {
			this.emptyMessage = "No agents available. Start the CLI server with 'flowti serve'.";
		}
	}

	protected renderContent() {
		const activeCard = this.agents.find((a) => a.name === this.activeAgent);
		const label = this.teamMode
			? "Talking to team"
			: `Talking to ${activeCard?.persona ?? this.activeAgent}`;

		return html`
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

customElements.define("flowti-agent-sidepanel", FlowtiAgentSidepanel);
