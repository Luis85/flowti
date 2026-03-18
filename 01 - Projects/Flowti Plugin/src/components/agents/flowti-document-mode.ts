// src/components/agents/flowti-document-mode.ts
import { html, css, nothing } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationTurn, ToolCall } from "../../domain/agents/types.js";

/**
 * Document mode — renders conversation turns as a continuous document flow.
 *
 * - Agent responses as rich text (headers, code blocks, lists)
 * - User messages as inline highlighted sections
 * - Tool calls as collapsed `<details>` elements
 * - Thinking content behind an expand toggle
 */
export class FlowtiDocumentMode extends FlowtiElement {
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
				overflow-y: auto;
				padding: var(--flowti-space-sm);
			}

			.document {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.turn {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
			}

			.turn--user {
				background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
				border-left: 3px solid var(--interactive-accent);
			}

			.turn--agent {
				background: none;
			}

			.turn__role {
				font-size: 0.7em;
				font-weight: 600;
				text-transform: uppercase;
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-xs);
			}

			.turn__content {
				font-size: var(--flowti-font-sm);
				line-height: 1.5;
				white-space: pre-wrap;
				word-wrap: break-word;
			}

			.thinking-toggle {
				margin-top: var(--flowti-space-xs);
			}

			.thinking-toggle summary {
				cursor: pointer;
				font-size: 0.75em;
				color: var(--flowti-color-muted);
				user-select: none;
			}

			.thinking-toggle summary:hover {
				color: var(--text-normal);
			}

			.thinking-content {
				font-size: 0.8em;
				color: var(--flowti-color-muted);
				font-style: italic;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				margin-top: var(--flowti-space-xs);
				border-left: 2px solid var(--flowti-border);
				white-space: pre-wrap;
			}

			.tool-calls {
				margin-top: var(--flowti-space-xs);
			}

			.tool-call {
				margin-bottom: var(--flowti-space-xs);
			}

			.tool-call summary {
				cursor: pointer;
				font-size: 0.75em;
				color: var(--flowti-color-info);
				user-select: none;
			}

			.tool-call summary:hover {
				text-decoration: underline;
			}

			.tool-call__status {
				font-size: 0.7em;
				padding: 1px 4px;
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}

			.tool-call__status--completed {
				color: var(--flowti-color-success);
			}

			.tool-call__status--started {
				color: var(--flowti-color-warning);
			}

			.turn__timestamp {
				font-size: 0.65em;
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
			}
		`,
	];

	turns: ConversationTurn[] = [];
	agentName = "";

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = this.turns.length === 0;
		if (this.isEmpty) {
			this.emptyMessage = "No messages yet";
		}
	}

	protected renderContent() {
		return html`
			<div class="document">
				${this.turns.map((turn) => this.renderTurn(turn))}
			</div>
		`;
	}

	private renderTurn(turn: ConversationTurn) {
		const roleClass = turn.role === "user" ? "turn--user" : "turn--agent";
		const roleLabel = turn.role === "user" ? "You" : (turn.agentName || this.agentName || "Agent");
		return html`
			<div class="turn ${roleClass}" data-turn-id="${turn.id}">
				<div class="turn__role">${roleLabel}</div>
				<div class="turn__content">${turn.content}</div>
				${turn.thinking ? this.renderThinking(turn.thinking) : nothing}
				${turn.toolCalls?.length ? this.renderToolCalls(turn.toolCalls) : nothing}
				${turn.timestamp ? html`<div class="turn__timestamp">${turn.timestamp}</div>` : nothing}
			</div>
		`;
	}

	private renderThinking(thinking: string) {
		return html`
			<details class="thinking-toggle">
				<summary>Show thinking</summary>
				<div class="thinking-content">${thinking}</div>
			</details>
		`;
	}

	private renderToolCalls(toolCalls: ToolCall[]) {
		return html`
			<div class="tool-calls">
				${toolCalls.map((tc) => html`
					<details class="tool-call" data-tool-id="${tc.id}">
						<summary>
							${tc.name}
							<span class="tool-call__status tool-call__status--${tc.status}">${tc.status}</span>
						</summary>
					</details>
				`)}
			</div>
		`;
	}
}

customElements.define("flowti-document-mode", FlowtiDocumentMode);
