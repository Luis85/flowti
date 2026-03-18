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
		connectStatus: { type: String },
		connectError: { type: String },
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

			.offline-banner {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 12%, transparent);
				color: var(--text-muted);
				font-size: var(--flowti-font-sm, 0.85em);
				border-bottom: 1px solid var(--background-modifier-border);
			}

			.offline-banner .dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--color-yellow, #e5a00d);
				flex-shrink: 0;
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

			.offline-cta button {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--interactive-accent);
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
				font-weight: 500;
			}

			.offline-cta button:hover {
				opacity: 0.9;
			}

			.offline-cta button:disabled {
				opacity: 0.6;
				cursor: wait;
			}

			.status-msg {
				font-size: var(--flowti-font-sm, 0.85em);
				padding: var(--flowti-space-xs, 4px) 0;
			}

			.status-msg--connecting {
				color: var(--text-muted);
			}

			.status-msg--failed {
				color: var(--color-red, #e53935);
			}
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	activeMode: ConversationMode = "conversational";
	turns: ConversationTurn[] = [];
	teamMode = false;
	processing = false;
	/** "idle" | "connecting" | "failed" */
	connectStatus = "idle";
	connectError = "";
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
			const connecting = this.connectStatus === "connecting";
			const failed = this.connectStatus === "failed";
			return html`
				<div class="offline-banner">
					<span class="dot"></span>
					CLI server not connected
				</div>
				<div class="offline-cta">
					<span class="icon">&#x1F30D;</span>
					<p>The agent world is offline.<br/>Would you like to restart it?</p>
					<button @click="${this.dispatchRestart}" ?disabled="${connecting}">
						${connecting ? "Connecting\u2026" : "Restart the world"}
					</button>
					${failed ? html`<span class="status-msg status-msg--failed">${this.connectError || "Server unreachable. Is flowti serve running?"}</span>` : ""}
					${connecting ? html`<span class="status-msg status-msg--connecting">Reaching out to localhost:3000\u2026</span>` : ""}
				</div>
			`;
		}

		return html`
			${this.error ? html`<div class="offline-banner"><span class="dot" style="background:var(--color-red,#e53935)"></span>${this.error}</div>` : ""}
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

	private dispatchRestart(): void {
		this.dispatchEvent(new CustomEvent("restart-world", { bubbles: true, composed: true }));
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
