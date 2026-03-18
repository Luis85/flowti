/**
 * ask-bob.ts — Floating "Ask Bob" button + chat overlay.
 *
 * Bob is the world narrator — a single LLM agent that knows the full world state
 * and can answer questions about what agents are doing, impersonate agents in
 * conversations, and provide ambient commentary.
 */

import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles } from "./shared-styles.js";
import type { DashboardStore, ConversationTurn } from "../store/dashboard-store.js";

const BOB_AGENT_NAME = "Bob";

export class AskBob extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				position: absolute;
				bottom: 52px;
				left: 12px;
				z-index: 200;
				pointer-events: auto;
			}

			/* ── Floating button ─────────────────── */
			.bob-btn {
				display: flex;
				align-items: center;
				gap: 6px;
				background: var(--bg-panel);
				border: 1px solid var(--accent-gold);
				border-radius: 3px;
				color: var(--accent-gold);
				font-family: inherit;
				font-size: 11px;
				font-weight: 600;
				letter-spacing: 0.06em;
				text-transform: uppercase;
				padding: 8px 14px;
				cursor: pointer;
				transition: background 0.2s, box-shadow 0.2s;
				box-shadow: 0 0 12px rgba(217, 170, 78, 0.1);
			}
			.bob-btn:hover {
				background: var(--btn-primary);
				box-shadow: 0 0 20px rgba(217, 170, 78, 0.2);
			}
			.bob-btn .bob-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--accent-gold);
				animation: bob-pulse 2s infinite;
			}
			@keyframes bob-pulse {
				0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(217, 170, 78, 0.4); }
				50% { opacity: 0.5; box-shadow: 0 0 8px rgba(217, 170, 78, 0.6); }
			}

			/* ── Chat overlay ────────────────────── */
			.chat-overlay {
				position: absolute;
				bottom: 44px;
				left: 0;
				width: 360px;
				max-height: 420px;
				background: var(--bg-panel);
				border: 1px solid var(--border);
				border-left: 1px solid var(--border-glow);
				border-radius: 3px;
				box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--border-glow);
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}

			/* ── Header ──────────────────────────── */
			.chat-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 8px 12px;
				border-bottom: 1px solid var(--border);
				background: var(--bg-primary);
			}
			.chat-title {
				display: flex;
				align-items: center;
				gap: 6px;
			}
			.chat-title .name {
				font-size: 13px;
				font-weight: 600;
				color: var(--accent-gold);
				text-shadow: 0 0 6px rgba(217, 170, 78, 0.2);
			}
			.chat-title .role {
				font-size: 9px;
				color: var(--text-muted);
				text-transform: uppercase;
				letter-spacing: 0.06em;
			}
			.close-btn {
				background: transparent;
				border: none;
				color: var(--text-muted);
				font-size: 16px;
				cursor: pointer;
				padding: 2px 4px;
				border-radius: 2px;
				transition: color 0.15s;
			}
			.close-btn:hover {
				color: var(--accent-gold);
			}

			/* ── Thread ──────────────────────────── */
			.thread {
				flex: 1;
				overflow-y: auto;
				padding: 10px 12px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
				display: flex;
				flex-direction: column;
				gap: 8px;
				min-height: 180px;
				max-height: 300px;
			}
			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 30px 0;
				font-size: 11px;
			}
			.turn {
				max-width: 85%;
				padding: 6px 10px;
				border-radius: 3px;
				font-size: 12px;
				line-height: 1.5;
				word-wrap: break-word;
			}
			.turn[data-role="user"] {
				align-self: flex-end;
				background: var(--btn-primary);
				color: var(--text-primary);
				border: 1px solid rgba(78, 139, 217, 0.2);
			}
			.turn[data-role="agent"] {
				align-self: flex-start;
				background: var(--bg-secondary);
				color: var(--text-primary);
				border: 1px solid var(--border);
			}
			.thinking {
				align-self: flex-start;
				color: var(--accent-gold);
				font-size: 11px;
				font-style: italic;
				animation: bob-pulse 1.5s infinite;
			}

			/* ── Input ───────────────────────────── */
			.input-row {
				display: flex;
				border-top: 1px solid var(--border);
				background: var(--bg-primary);
			}
			.chat-input {
				flex: 1;
				background: transparent;
				border: none;
				color: var(--text-primary);
				font-family: inherit;
				font-size: 12px;
				padding: 10px 12px;
				outline: none;
			}
			.chat-input::placeholder {
				color: var(--text-dim);
			}
			.send-btn {
				background: transparent;
				border: none;
				border-left: 1px solid var(--border);
				color: var(--accent-gold);
				font-family: inherit;
				font-size: 10px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.06em;
				padding: 0 14px;
				cursor: pointer;
				transition: background 0.15s;
			}
			.send-btn:hover {
				background: var(--bg-tertiary);
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;
	@state() private open = false;
	@state() private conversation: readonly ConversationTurn[] = [];
	@state() private thinking = false;

	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.syncFromStore();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	private syncFromStore(): void {
		this.conversation = this.store.getConversation(BOB_AGENT_NAME);
		this.thinking = this.store.isThinking(BOB_AGENT_NAME);
	}

	private handleToggle(): void {
		this.open = !this.open;
		if (this.open) this.syncFromStore();
	}

	private handleClose(): void {
		this.open = false;
	}

	private handleSend(): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>(".chat-input");
		if (!input) return;
		const text = input.value.trim();
		if (!text) return;

		this.store.pushUserMessage(BOB_AGENT_NAME, text);
		void this.store.sendMessage(BOB_AGENT_NAME, text);
		input.value = "";
	}

	private handleKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter") this.handleSend();
	}

	private renderThread() {
		if (this.conversation.length === 0 && !this.thinking) {
			return html`<div class="empty">Ask Bob anything about the world...</div>`;
		}
		return html`
			${this.conversation.map((t) => html`
				<div class="turn" data-role="${t.role}">${t.text}</div>
			`)}
			${this.thinking ? html`<div class="thinking">Bob is thinking...</div>` : nothing}
		`;
	}

	render() {
		return html`
			${this.open ? html`
				<div class="chat-overlay">
					<div class="chat-header">
						<div class="chat-title">
							<span class="name">Bob</span>
							<span class="role">World Narrator</span>
						</div>
						<button class="close-btn" @click=${this.handleClose}>&times;</button>
					</div>
					<div class="thread">
						${this.renderThread()}
					</div>
					<div class="input-row">
						<input
							class="chat-input"
							type="text"
							placeholder="Ask Bob about the world..."
							@keydown=${this.handleKeydown}
						/>
						<button class="send-btn" @click=${this.handleSend}>Send</button>
					</div>
				</div>
			` : nothing}

			<button class="bob-btn" @click=${this.handleToggle}>
				<span class="bob-dot"></span>
				Ask Bob
			</button>
		`;
	}
}

if (!customElements.get("ask-bob")) customElements.define("ask-bob", AskBob);
