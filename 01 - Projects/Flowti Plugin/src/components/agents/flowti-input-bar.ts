// src/components/agents/flowti-input-bar.ts
import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";

export class FlowtiInputBar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agentLabel: { type: String },
		processing: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: block; flex-shrink: 0; }
			.agent-label {
				font-size: 0.7em;
				color: var(--flowti-color-muted);
				padding: 0 var(--flowti-space-sm);
			}
			.input-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				border-top: 1px solid var(--flowti-border);
			}
			textarea {
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
				overflow-y: auto;
			}
			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: none;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				align-self: flex-end;
			}
			button:disabled { opacity: 0.5; cursor: default; }
		`,
	];

	agentLabel = "";
	processing = false;
	private inputText = "";

	protected renderContent() {
		return html`
			${this.agentLabel ? html`<div class="agent-label">${this.agentLabel}</div>` : ""}
			<div class="input-bar">
				<textarea
					placeholder="Type a message..."
					.value="${this.inputText}"
					@input="${this.onInput}"
					@keydown="${this.onKeydown}"
				></textarea>
				<button
					data-action="send"
					?disabled="${!this.inputText.trim() && !this.processing}"
					@click="${this.onButtonClick}"
				>${this.processing ? "Stop" : "Send"}</button>
			</div>
		`;
	}

	private onInput(e: Event) {
		this.inputText = (e.target as HTMLTextAreaElement).value;
		const textarea = e.target as HTMLTextAreaElement;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
		this.requestUpdate();
	}

	private onKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			this.send();
		}
	}

	private onButtonClick() {
		if (this.processing) {
			this.dispatchEvent(new CustomEvent("agent-stop", { bubbles: true, composed: true }));
		} else {
			this.send();
		}
	}

	private send() {
		const message = this.inputText.trim();
		if (!message) return;
		this.dispatchEvent(new CustomEvent("agent-send", { detail: { message }, bubbles: true, composed: true }));
		this.inputText = "";
		this.requestUpdate();
	}
}

if (!customElements.get("flowti-input-bar")) customElements.define("flowti-input-bar", FlowtiInputBar);
