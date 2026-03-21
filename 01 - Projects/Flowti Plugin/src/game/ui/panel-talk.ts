/**
 * Talk tab — Lit component showing conversation thread, input, thinking indicator,
 * and LLM status badge. Subscribes to DashboardStore for reactive updates.
 */

import { html, css, nothing } from "lit";
import type { PropertyValues } from "lit";
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

			/* Degraded-mode banners — must be visible (contrast) in shadow DOM */
			.talk-banner {
				font-size: 11px;
				line-height: 1.45;
				padding: 8px 10px;
				border-radius: 4px;
				border: 1px solid var(--border);
				margin: 0 8px 6px;
				flex-shrink: 0;
			}
			.talk-banner strong {
				display: block;
				margin-bottom: 4px;
				color: var(--text-primary);
				font-size: 11px;
			}
			.talk-banner--warn {
				background: rgba(217, 170, 78, 0.12);
				border-color: rgba(217, 170, 78, 0.35);
				color: var(--text-secondary);
			}
			.talk-banner--note {
				background: rgba(78, 139, 217, 0.1);
				border-color: rgba(78, 139, 217, 0.3);
				color: var(--text-secondary);
			}
			.talk-banner--info {
				background: rgba(100, 116, 139, 0.15);
				border-color: var(--border);
				color: var(--text-secondary);
			}

			.vault-link {
				color: var(--accent-blue, #3b82f6);
				cursor: pointer;
				text-decoration: underline;
				text-decoration-style: dotted;
			}
			.vault-link:hover {
				text-decoration-style: solid;
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

	override willUpdate(changedProperties: PropertyValues<this>): void {
		super.willUpdate(changedProperties);
		// Conversation is cached locally; resync when switching agents or store reference.
		if ((changedProperties.has("agentName") || changedProperties.has("store")) && this.store && this.agentName) {
			this.syncFromStore();
		}
	}

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
		if (!this.store.cliSessionAvailable) return;
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

	private renderTurnText(text: string) {
		// Detect vault paths (e.g., "03 - Resources/Agents/output/foo/bar.md") and make them clickable
		const pathMatch = text.match(/(\d{2} - [^\s]+\.md)/);
		if (pathMatch) {
			const path = pathMatch[1];
			const before = text.slice(0, pathMatch.index);
			const after = text.slice(pathMatch.index! + path.length);
			return html`${before}<span class="vault-link" @click="${() => this.openPath(path)}">${path}</span>${after}`;
		}
		return text;
	}

	private openPath(path: string): void {
		this.dispatchEvent(new CustomEvent("open-vault-path", { detail: { path }, bubbles: true, composed: true }));
	}

	private renderThread(isAiBacked: boolean, cliOk: boolean) {
		const visible = this.conversation.slice(-50);
		if (visible.length === 0 && !this.thinking) {
			if (!isAiBacked) {
				return html`<div class="empty">This agent is not LLM-backed (e.g. human). The canvas still drives movement and ambient lines — no subprocess required.</div>`;
			}
			if (!cliOk) {
				return html`<div class="empty">No LLM thread yet. The Agent World keeps running: sprites, moods, and template chatter work without Claude or any CLI reply.</div>`;
			}
			return html`<div class="empty">No messages yet. Start a conversation!</div>`;
		}

		return html`
			${visible.map((turn) => html`
				<div class="turn" data-role="${turn.role}">
					${this.renderTurnText(turn.text)}
				</div>
			`)}
		`;
	}

	protected renderContent() {
		const agentMeta = this.store.agents.find((a) => a.name === this.agentName);
		const isAiBacked = (agentMeta?.agentType ?? "ai") === "ai";
		const cliOk = this.store.cliSessionAvailable;
		const canSend = cliOk && isAiBacked;
		const blockReason = this.store.cliSessionBlockedReason;
		const llmNote = this.store.llmBackendReminder;

		return html`
			${!isAiBacked
				? html`
					<div class="talk-banner talk-banner--info">
						<strong>Simulation-only agent</strong>
						Not wired to the Flowti LLM CLI. Watch them on the canvas — wandering, needs, and scripted chatter do not depend on Claude or any subprocess.
					</div>
				`
				: nothing}
			${isAiBacked && !cliOk && blockReason
				? html`
					<div class="talk-banner talk-banner--warn">
						<strong>LLM / CLI host unavailable</strong>
						${blockReason}
						The world simulation still runs; only this chat pane and CLI-backed tasks need Node + bundle + your configured LLM.
					</div>
				`
				: nothing}
			${isAiBacked && cliOk && llmNote
				? html`<div class="talk-banner talk-banner--note"><strong>LLM backend</strong>${llmNote}</div>`
				: nothing}
			<div class="thread">
				${this.renderThread(isAiBacked, cliOk)}
			</div>
			<div class="input-row">
				<input
					class="talk-input"
					type="text"
					?disabled="${!canSend}"
					placeholder="${!isAiBacked
						? "Not an LLM-backed agent"
						: cliOk
							? `Message ${this.agentName}...`
							: "Connect CLI + LLM to send messages"}"
					@keydown="${this.handleKeydown}"
				/>
				<button class="primary" ?disabled="${!canSend}" @click="${this.handleSend}">Send</button>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-talk")) customElements.define("ft-game-panel-talk", PanelTalk);
