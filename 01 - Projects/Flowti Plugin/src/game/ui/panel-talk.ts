/**
 * Talk tab — Lit component showing conversation thread, input, thinking indicator,
 * and LLM status badge. Subscribes to DashboardStore for reactive updates.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles, buttonStyles } from "./game-styles.js";
import type { DashboardStore, ConversationTurn } from "../store/dashboard-store.js";

// -- Filler phrases shown while LLM is thinking -----------

const THINKING_PHRASES = [
	"Thinking...",
	"Let me consider that...",
	"Processing your message...",
	"Connecting to LLM...",
	"Generating response...",
	"Almost there...",
];

export class PanelTalk extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agentName: { type: String },
		conversation: { state: true },
		thinking: { state: true },
		thinkingPhrase: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		buttonStyles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-height: 0;
				overflow: hidden;
			}

			/* Thread */
			.thread {
				flex: 1;
				overflow-y: auto;
				padding: 8px;
				display: flex;
				flex-direction: column;
				gap: 6px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.turn {
				max-width: 85%;
				padding: 6px 10px;
				border-radius: 8px;
				font-size: 12px;
				line-height: 1.4;
				word-wrap: break-word;
			}

			.turn[data-role="user"] {
				align-self: flex-end;
				background: #1e3a5f;
				color: var(--text-primary);
			}

			.turn[data-role="agent"] {
				align-self: flex-start;
				background: var(--bg-tertiary);
				color: var(--text-primary);
			}

			/* Thinking indicator */
			.thinking {
				align-self: flex-start;
				color: var(--text-muted);
				font-style: italic;
				font-size: 11px;
				padding: 4px 10px;
			}

			/* Empty state */
			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}

			/* Input row */
			.input-row {
				display: flex;
				gap: 6px;
				padding: 8px;
				border-top: 1px solid var(--border);
				background: var(--bg-primary);
			}

			.input-row input {
				flex: 1;
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 4px;
				padding: 6px 10px;
				color: var(--text-primary);
				font-family: inherit;
				font-size: 12px;
				outline: none;
			}

			.input-row input:focus {
				border-color: var(--accent-blue);
			}

			.input-row input::placeholder {
				color: var(--text-muted);
			}
		`,
	];

	store!: DashboardStore;
	agentName = "";

	private conversation: readonly ConversationTurn[] = [];
	private thinking = false;
	private thinkingPhrase = THINKING_PHRASES[0];

	private storeHandler = () => { this.syncFromStore(); };
	private thinkingTimer: ReturnType<typeof setInterval> | null = null;
	private thinkingIndex = 0;

	connectedCallback(): void {
		super.connectedCallback();
		if (this.store) {
			this.store.addEventListener("state-changed", this.storeHandler);
			this.syncFromStore();
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.store) {
			this.store.removeEventListener("state-changed", this.storeHandler);
		}
		this.stopThinkingTimer();
	}

	private syncFromStore(): void {
		this.conversation = this.store.getConversation(this.agentName);
		const wasThinking = this.thinking;
		this.thinking = this.store.isThinking(this.agentName);

		if (this.thinking && !wasThinking) {
			this.startThinkingTimer();
		} else if (!this.thinking && wasThinking) {
			this.stopThinkingTimer();
		}
	}

	private startThinkingTimer(): void {
		this.stopThinkingTimer();
		this.thinkingIndex = 0;
		this.thinkingPhrase = THINKING_PHRASES[0];
		this.thinkingTimer = setInterval(() => {
			this.thinkingIndex = (this.thinkingIndex + 1) % THINKING_PHRASES.length;
			this.thinkingPhrase = THINKING_PHRASES[this.thinkingIndex];
		}, 3000);
	}

	private stopThinkingTimer(): void {
		if (this.thinkingTimer) {
			clearInterval(this.thinkingTimer);
			this.thinkingTimer = null;
		}
	}

	private async scrollToBottom(): Promise<void> {
		await this.updateComplete;
		const thread = this.shadowRoot?.querySelector<HTMLElement>(".thread");
		if (thread) {
			thread.scrollTop = thread.scrollHeight;
		}
	}

	private handleSend(): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>(".talk-input");
		if (!input) return;
		const text = input.value.trim();
		if (!text) return;

		this.store.pushUserMessage(this.agentName, text);
		void this.store.sendMessage(this.agentName, text);
		input.value = "";
		void this.scrollToBottom();
	}

	private handleKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter") this.handleSend();
	}

	updated(): void {
		void this.scrollToBottom();
	}

	private renderThread() {
		const visible = this.conversation.slice(-50);
		if (visible.length === 0 && !this.thinking) {
			return html`<div class="empty">No messages yet. Start a conversation!</div>`;
		}

		return html`
			${visible.map((turn) => html`
				<div class="turn" data-role="${turn.role}">
					${turn.text}
				</div>
			`)}
			${this.thinking
				? html`<div class="thinking">${this.thinkingPhrase}</div>`
				: nothing}
		`;
	}

	protected renderContent() {
		return html`
			<div class="thread">
				${this.renderThread()}
			</div>
			<div class="input-row">
				<input
					class="talk-input"
					type="text"
					placeholder="Message ${this.agentName}..."
					@keydown="${this.handleKeydown}"
				/>
				<button class="primary" @click="${this.handleSend}">Send</button>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-talk")) customElements.define("ft-game-panel-talk", PanelTalk);
