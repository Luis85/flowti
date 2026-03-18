/**
 * Root Lit component for the Agent Sidepanel.
 * Orchestrates layout: roster → mode bar → active mode → input bar.
 * Phase A: inline roster + conversation + input.
 * Phase B: replaces inline sections with child Lit components.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { statusBadge } from "../shared-styles.js";
import type { AgentCard, ConversationTurn, ConversationMode } from "../../domain/agents/types.js";

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
		statusBadge,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}

			.roster {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				overflow-x: auto;
				border-bottom: 1px solid var(--flowti-border);
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
			.agent-mood { font-size: 0.65em; color: var(--flowti-color-muted); }
			@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

			.mode-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}
			.mode-btn {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				background: none; border: none;
				color: var(--flowti-color-muted);
			}
			.mode-btn:hover { background: var(--background-modifier-hover); }
			.mode-btn--active { color: var(--text-normal); background: var(--background-modifier-active-hover); }

			.conversation {
				flex: 1;
				overflow-y: auto;
				padding: var(--flowti-space-sm);
			}
			.turn { margin-bottom: var(--flowti-space-sm); }
			.turn--user { text-align: right; }
			.turn--agent { text-align: left; }
			.turn__bubble {
				display: inline-block;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				max-width: 85%;
				text-align: left;
				font-size: var(--flowti-font-sm);
				word-wrap: break-word;
			}
			.turn--user .turn__bubble { background: var(--interactive-accent); color: var(--text-on-accent); }
			.turn--agent .turn__bubble { background: var(--background-secondary); }
			.turn__name { font-size: 0.7em; color: var(--flowti-color-muted); margin-bottom: 2px; }

			.input-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				border-top: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}
			.input-bar textarea {
				flex: 1;
				resize: none;
				min-height: 36px;
				max-height: 120px;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
				font-size: var(--flowti-font-sm);
			}
			.input-bar button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: none;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				align-self: flex-end;
			}
			.input-bar button:disabled { opacity: 0.5; cursor: default; }
			.agent-label { font-size: 0.7em; color: var(--flowti-color-muted); padding: 0 var(--flowti-space-sm); }
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	activeMode: ConversationMode = "conversational";
	turns: ConversationTurn[] = [];
	teamMode = false;
	processing = false;
	private inputText = "";

	protected renderContent() {
		if (this.agents.length === 0) {
			this.isEmpty = true;
			this.emptyMessage = "No agents available. Start the CLI server with 'flowti serve'.";
			return html`<div class="flowti-empty">${this.emptyMessage}</div>`;
		}
		this.isEmpty = false;

		const activeCard = this.agents.find((a) => a.name === this.activeAgent);
		const label = this.teamMode ? "Talking to team" : `Talking to ${activeCard?.persona ?? this.activeAgent}`;

		return html`
			${this.renderRoster()}
			${this.renderModeBar()}
			<div class="conversation">
				${this.turns.map((t) => this.renderTurn(t))}
			</div>
			<div class="agent-label">${label}</div>
			${this.renderInputBar()}
		`;
	}

	private renderRoster() {
		return html`
			<div class="roster">
				${this.agents.map((a) => html`
					<div
						class="agent-card ${a.name === this.activeAgent ? "agent-card--active" : ""}"
						data-agent="${a.name}"
						@click="${() => this.selectAgent(a.name)}"
					>
						<div class="agent-avatar agent-avatar--${a.activity}">
							${(a.persona ?? a.name).charAt(0).toUpperCase()}
						</div>
						<div class="agent-name">${a.persona ?? a.name}</div>
						${a.mood ? html`<div class="agent-mood">${a.mood}</div>` : nothing}
					</div>
				`)}
			</div>
		`;
	}

	private renderModeBar() {
		const modes: { id: ConversationMode; label: string }[] = [
			{ id: "document", label: "Doc" },
			{ id: "conversational", label: "Chat" },
			{ id: "canvas", label: "Canvas" },
		];
		return html`
			<div class="mode-bar">
				${modes.map((m) => html`
					<button
						class="mode-btn ${m.id === this.activeMode ? "mode-btn--active" : ""}"
						@click="${() => this.switchMode(m.id)}"
					>${m.label}</button>
				`)}
			</div>
		`;
	}

	private renderTurn(turn: ConversationTurn) {
		return html`
			<div class="turn turn--${turn.role}">
				${turn.role === "agent" ? html`<div class="turn__name">${turn.persona ?? turn.agentName ?? "Agent"}</div>` : nothing}
				<div class="turn__bubble">${turn.content}</div>
			</div>
		`;
	}

	private renderInputBar() {
		return html`
			<div class="input-bar">
				<textarea
					placeholder="Type a message..."
					.value="${this.inputText}"
					@input="${(e: Event) => { this.inputText = (e.target as HTMLTextAreaElement).value; }}"
					@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.send(); } }}"
				></textarea>
				<button
					data-action="send"
					?disabled="${!this.inputText.trim() || this.processing}"
					@click="${() => this.send()}"
				>${this.processing ? "Stop" : "Send"}</button>
			</div>
		`;
	}

	private selectAgent(name: string) {
		this.dispatchEvent(new CustomEvent("agent-selected", { detail: { agent: name }, bubbles: true, composed: true }));
	}

	private switchMode(mode: ConversationMode) {
		this.dispatchEvent(new CustomEvent("mode-changed", { detail: { mode }, bubbles: true, composed: true }));
	}

	private send() {
		const message = this.inputText.trim();
		if (!message) return;
		this.dispatchEvent(new CustomEvent("agent-send", { detail: { message }, bubbles: true, composed: true }));
		this.inputText = "";
		this.requestUpdate();
	}
}

customElements.define("flowti-agent-sidepanel", FlowtiAgentSidepanel);
