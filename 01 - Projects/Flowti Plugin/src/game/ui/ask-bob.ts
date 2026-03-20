/**
 * ask-bob.ts — Floating "Ask Bob" button + chat overlay.
 *
 * Bob is the world narrator — a single LLM agent that knows the full world state
 * and can answer questions about what agents are doing, impersonate agents in
 * conversations, and provide ambient commentary.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import type { DashboardStore, ConversationTurn } from "../store/dashboard-store.js";

const BOB_AGENT_NAME = "Bob";

export class AskBob extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		open: { state: true },
		conversation: { state: true },
		thinking: { state: true },
		activeTab: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
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

			/* -- Floating button ----------------- */
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

			/* -- Chat overlay -------------------- */
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

			/* -- Header -------------------------- */
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

			/* -- Thread -------------------------- */
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

			/* -- Input --------------------------- */
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

			/* -- Tabs ----------------------------- */
			.tab-row {
				display: flex;
				border-bottom: 1px solid var(--border);
				background: var(--bg-primary);
			}
			.tab-btn {
				flex: 1;
				background: transparent;
				border: none;
				border-bottom: 2px solid transparent;
				color: var(--text-muted);
				font-family: inherit;
				font-size: 10px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.06em;
				padding: 6px 8px;
				cursor: pointer;
				transition: color 0.15s, border-color 0.15s;
			}
			.tab-btn:hover { color: var(--text-primary); }
			.tab-btn[data-active] {
				color: var(--accent-gold);
				border-bottom-color: var(--accent-gold);
			}

			/* -- Debug log ------------------------- */
			.debug-log {
				flex: 1;
				overflow-y: auto;
				padding: 8px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
				display: flex;
				flex-direction: column;
				gap: 8px;
				min-height: 180px;
				max-height: 300px;
				font-size: 11px;
				font-family: monospace;
			}
			.debug-entry {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 3px;
				padding: 6px 8px;
			}
			.debug-header {
				display: flex;
				justify-content: space-between;
				margin-bottom: 4px;
				font-size: 9px;
				color: var(--text-muted);
			}
			.debug-agent { color: var(--accent-gold); font-weight: 600; }
			.debug-prompt {
				color: var(--text-primary);
				white-space: pre-wrap;
				word-break: break-word;
				overflow-y: auto;
			}
			.debug-prompt.collapsed {
				max-height: 80px;
			}
			.debug-context {
				margin-top: 4px;
				padding-top: 4px;
				border-top: 1px solid var(--border);
				color: var(--text-dim);
				white-space: pre-wrap;
				word-break: break-word;
				overflow-y: auto;
				font-size: 10px;
			}
			.debug-context.collapsed {
				max-height: 60px;
			}
			.debug-actions {
				display: flex;
				gap: 4px;
				margin-top: 6px;
			}
			.debug-action {
				background: var(--bg-primary);
				border: 1px solid var(--border);
				border-radius: 2px;
				color: var(--text-muted);
				font-family: inherit;
				font-size: 9px;
				padding: 2px 8px;
				cursor: pointer;
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}
			.debug-action:hover {
				color: var(--accent-gold);
				border-color: var(--accent-gold);
			}
			.debug-empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 30px 0;
			}
			.debug-toolbar {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 6px 8px;
				border-bottom: 1px solid var(--border);
				font-size: 10px;
				color: var(--text-secondary);
			}
			.debug-toggle {
				display: flex;
				align-items: center;
				gap: 6px;
				cursor: pointer;
			}
			.debug-toggle input[type="checkbox"] {
				accent-color: var(--accent-gold);
				cursor: pointer;
			}
			.debug-toggle-label {
				user-select: none;
			}
			.debug-mode-badge {
				padding: 1px 6px;
				border-radius: 3px;
				font-size: 9px;
				font-weight: 600;
				text-transform: uppercase;
			}
			.debug-mode-badge[data-active] {
				background: #422006;
				color: var(--accent-gold);
			}
			.debug-response {
				margin-top: 4px;
				padding-top: 4px;
				border-top: 1px dashed var(--border);
				color: #4ade80;
				white-space: pre-wrap;
				word-break: break-word;
				overflow-y: auto;
				font-size: 10px;
			}
			.debug-response.collapsed {
				max-height: 60px;
			}
			.debug-response-label {
				font-size: 9px;
				color: var(--text-muted);
				margin-bottom: 2px;
			}
		`,
	];

	store!: DashboardStore;
	private open = false;
	private conversation: readonly ConversationTurn[] = [];
	private thinking = false;
	private activeTab: "chat" | "debug" = "chat";
	private expandedEntries = new Set<number>();

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

	private switchTab(tab: "chat" | "debug"): void {
		this.activeTab = tab;
	}

	private handleClose(): void {
		this.open = false;
	}

	private async scrollToBottom(): Promise<void> {
		await this.updateComplete;
		const thread = this.shadowRoot?.querySelector<HTMLElement>(".thread");
		if (thread) {
			thread.scrollTop = thread.scrollHeight;
		}
	}

	updated(): void {
		if (this.activeTab === "chat") {
			void this.scrollToBottom();
		}
	}

	private handleSend(): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>(".chat-input");
		if (!input) return;
		const text = input.value.trim();
		if (!text) return;

		this.store.pushUserMessage(BOB_AGENT_NAME, text);
		void this.store.sendMessage(BOB_AGENT_NAME, text);
		input.value = "";
		void this.scrollToBottom();
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

	private toggleExpand(idx: number): void {
		if (this.expandedEntries.has(idx)) {
			this.expandedEntries.delete(idx);
		} else {
			this.expandedEntries.add(idx);
		}
		this.requestUpdate();
	}

	private copyToClipboard(text: string): void {
		void navigator.clipboard.writeText(text);
	}

	private resendPrompt(agentName: string, prompt: string): void {
		this.store.pushUserMessage(agentName, prompt);
		void this.store.sendMessage(agentName, prompt);
		this.activeTab = "chat";
	}

	private handleDebugToggle(): void {
		this.store.toggleDebugMode();
	}

	private renderDebugLog() {
		const log = this.store.debugLog;
		const debugOn = this.store.debugMode;
		return html`
			<div class="debug-toolbar">
				<label class="debug-toggle">
					<input type="checkbox" .checked=${debugOn} @change=${this.handleDebugToggle} />
					<span class="debug-toggle-label">Log raw LLM I/O</span>
				</label>
				${debugOn ? html`<span class="debug-mode-badge" data-active>RECORDING</span>` : nothing}
			</div>
			${log.length === 0
				? html`<div class="debug-log"><div class="debug-empty">No prompts sent yet.${debugOn ? " Debug mode active — raw I/O will be captured." : ""}</div></div>`
				: html`
					<div class="debug-log">
						${[...log].reverse().map((entry, idx) => {
							const time = new Date(entry.timestamp).toLocaleTimeString();
							const expanded = this.expandedEntries.has(idx);
							return html`
								<div class="debug-entry">
									<div class="debug-header">
										<span class="debug-agent">${entry.agentName}</span>
										<span>${time}</span>
									</div>
									<div class="debug-prompt ${expanded ? "" : "collapsed"}">${entry.prompt}</div>
									${entry.context ? html`<div class="debug-context ${expanded ? "" : "collapsed"}">${entry.context}</div>` : nothing}
									${entry.rawResponse ? html`
										<div class="debug-response-label">RAW RESPONSE</div>
										<div class="debug-response ${expanded ? "" : "collapsed"}">${entry.rawResponse}</div>
									` : nothing}
									<div class="debug-actions">
										<button class="debug-action" @click=${() => this.toggleExpand(idx)}>${expanded ? "Collapse" : "Expand"}</button>
										<button class="debug-action" @click=${() => this.copyToClipboard(entry.prompt)}>Copy Prompt</button>
										${entry.rawResponse ? html`<button class="debug-action" @click=${() => this.copyToClipboard(entry.rawResponse!)}>Copy Response</button>` : nothing}
										<button class="debug-action" @click=${() => this.resendPrompt(entry.agentName, entry.prompt)}>Resend</button>
									</div>
								</div>
							`;
						})}
					</div>
				`}
		`;
	}

	protected renderContent() {
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
					<div class="tab-row">
						<button class="tab-btn" ?data-active=${this.activeTab === "chat"} @click=${() => this.switchTab("chat")}>Chat</button>
						<button class="tab-btn" ?data-active=${this.activeTab === "debug"} @click=${() => this.switchTab("debug")}>Debug</button>
					</div>
					${this.activeTab === "chat" ? html`
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
					` : this.renderDebugLog()}
				</div>
			` : nothing}

			<button class="bob-btn" @click=${this.handleToggle}>
				<span class="bob-dot"></span>
				Ask Bob
			</button>
		`;
	}
}

if (!customElements.get("ft-game-ask-bob")) customElements.define("ft-game-ask-bob", AskBob);
