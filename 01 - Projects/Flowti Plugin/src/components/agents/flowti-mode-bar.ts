// src/components/agents/flowti-mode-bar.ts
import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationMode } from "../../domain/agents/types.js";

/**
 * Three-button tab strip for switching conversation modes.
 * Fires `mode-changed` custom event with `{ mode: ConversationMode }`.
 */
export class FlowtiModeBar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		activeMode: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: block; flex-shrink: 0; }
			.mode-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}
			.mode-btn {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				background: none;
				border: none;
				color: var(--flowti-color-muted);
			}
			.mode-btn:hover { background: var(--background-modifier-hover); }
			.mode-btn--active {
				color: var(--text-normal);
				background: var(--background-modifier-active-hover);
			}
		`,
	];

	activeMode: ConversationMode = "conversational";

	private static readonly MODES: { id: ConversationMode; label: string }[] = [
		{ id: "document", label: "Doc" },
		{ id: "conversational", label: "Chat" },
		{ id: "canvas", label: "Canvas" },
	];

	protected renderContent() {
		return html`
			<div class="mode-bar" role="tablist">
				${FlowtiModeBar.MODES.map((m) => html`
					<button
						class="mode-btn ${m.id === this.activeMode ? "mode-btn--active" : ""}"
						role="tab"
						aria-selected="${m.id === this.activeMode}"
						data-mode="${m.id}"
						@click="${() => this.switchMode(m.id)}"
					>${m.label}</button>
				`)}
			</div>
		`;
	}

	private switchMode(mode: ConversationMode) {
		this.dispatchEvent(new CustomEvent("mode-changed", {
			detail: { mode },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define("flowti-mode-bar", FlowtiModeBar);
