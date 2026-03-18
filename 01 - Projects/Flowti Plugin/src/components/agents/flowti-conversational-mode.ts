// src/components/agents/flowti-conversational-mode.ts
import { html, css, nothing } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationTurn, ToolCall } from "../../domain/agents/types.js";

/**
 * Conversational mode — renders turns as chat bubbles with auto-scroll.
 *
 * - User messages right-aligned with accent background
 * - Agent messages left-aligned with secondary background
 * - Thinking content as italic thought bubbles
 * - Tool calls as compact inline badges
 * - Auto-scrolls to bottom when new turns arrive
 *
 * Custom events: none (display-only component).
 */
export class FlowtiConversationalMode extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		turns: { type: Array },
		agentName: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: block;
				flex: 1;
				overflow-y: auto;
			}

			.conversation {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				min-height: 100%;
			}

			.turn {
				display: flex;
				flex-direction: column;
				max-width: 85%;
			}

			.turn--user {
				align-self: flex-end;
				align-items: flex-end;
			}

			.turn--agent {
				align-self: flex-start;
				align-items: flex-start;
			}

			.turn__name {
				font-size: 0.7em;
				color: var(--flowti-color-muted);
				margin-bottom: 2px;
			}

			.turn__bubble {
				display: inline-block;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				line-height: 1.4;
				word-wrap: break-word;
				white-space: pre-wrap;
			}

			.turn--user .turn__bubble {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
			}

			.turn--agent .turn__bubble {
				background: var(--background-secondary);
			}

			.turn__thinking {
				display: inline-block;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: 0.8em;
				font-style: italic;
				color: var(--flowti-color-muted);
				background: color-mix(in srgb, var(--background-secondary) 50%, transparent);
				border-left: 2px solid var(--flowti-border);
				margin-top: 2px;
				white-space: pre-wrap;
			}

			.turn__tools {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				margin-top: 2px;
			}

			.tool-badge {
				font-size: 0.7em;
				padding: 1px 6px;
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
			}

			.tool-badge--started {
				color: var(--flowti-color-warning);
			}

			.tool-badge--completed {
				color: var(--flowti-color-success);
			}

			.turn__timestamp {
				font-size: 0.6em;
				color: var(--flowti-color-muted);
				margin-top: 2px;
			}
		`,
	];

	turns: ConversationTurn[] = [];
	agentName = "";
	private previousTurnCount = 0;

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = this.turns.length === 0;
		if (this.isEmpty) {
			this.emptyMessage = "No messages yet. Start a conversation!";
		}
	}

	protected updated(changed: PropertyValues): void {
		super.updated(changed);
		if (changed.has("turns" as never) && this.turns.length > this.previousTurnCount) {
			this.scrollToBottom();
		}
		this.previousTurnCount = this.turns.length;
	}

	protected renderContent() {
		return html`
			<div class="conversation" role="log" aria-label="Conversation">
				${this.turns.map((turn) => this.renderTurn(turn))}
			</div>
		`;
	}

	private renderTurn(turn: ConversationTurn) {
		const roleClass = turn.role === "user" ? "turn--user" : "turn--agent";
		const displayName = turn.role === "agent"
			? (turn.persona ?? turn.agentName ?? this.agentName ?? "Agent")
			: null;

		return html`
			<div class="turn ${roleClass}" data-turn-id="${turn.id}">
				${displayName ? html`<div class="turn__name">${displayName}</div>` : nothing}
				<div class="turn__bubble">${turn.content}</div>
				${turn.thinking ? this.renderThinking(turn.thinking) : nothing}
				${turn.toolCalls?.length ? this.renderToolCalls(turn.toolCalls) : nothing}
				${turn.timestamp ? html`<div class="turn__timestamp">${turn.timestamp}</div>` : nothing}
			</div>
		`;
	}

	private renderThinking(thinking: string) {
		return html`<div class="turn__thinking">${thinking}</div>`;
	}

	private renderToolCalls(toolCalls: ToolCall[]) {
		return html`
			<div class="turn__tools">
				${toolCalls.map((tc) => html`
					<span class="tool-badge tool-badge--${tc.status}" data-tool-id="${tc.id}">
						${tc.name}
					</span>
				`)}
			</div>
		`;
	}

	private scrollToBottom() {
		requestAnimationFrame(() => {
			const container = this.shadowRoot?.querySelector(".conversation");
			if (container) {
				container.scrollTop = container.scrollHeight;
			}
		});
	}
}

if (!customElements.get("flowti-conversational-mode")) customElements.define("flowti-conversational-mode", FlowtiConversationalMode);
