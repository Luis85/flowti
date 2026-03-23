/**
 * slide-panel.ts — Generic slide-in panel overlay.
 *
 * A full-viewport overlay with a right-anchored panel that slides in from the right.
 * Dispatches "panel-close" on close button click, backdrop click, or Escape key.
 * Content is projected via a default `<slot>`.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";

export class SlidePanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		open: { type: Boolean, reflect: true },
		title: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		css`
			:host {
				display: none;
				position: fixed;
				inset: 0;
				z-index: 140;
			}

			:host([open]) {
				display: block;
			}

			.panel-backdrop {
				position: absolute;
				inset: 0;
				background: rgba(0, 0, 0, 0.4);
				z-index: 140;
			}

			.panel {
				position: absolute;
				top: 0;
				right: 0;
				bottom: 0;
				width: 60%;
				z-index: 150;
				background: var(--bg-panel);
				display: flex;
				flex-direction: column;
				animation: slide-in 200ms ease-out;
			}

			@keyframes slide-in {
				from { transform: translateX(100%); }
				to { transform: translateX(0); }
			}

			.panel-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--border);
			}

			.panel-title {
				font-size: 14px;
				font-weight: 600;
				color: var(--text-primary);
			}

			.close-btn {
				background: none;
				border: none;
				color: var(--text-secondary);
				cursor: pointer;
				font-size: 16px;
				padding: 4px 8px;
				line-height: 1;
			}

			.close-btn:hover {
				color: var(--text-primary);
				background: none;
				border: none;
				box-shadow: none;
			}

			.panel-body {
				flex: 1;
				overflow-y: auto;
				padding: 16px;
			}
		`,
	];

	open = false;
	title = "";

	private boundEscHandler = this.handleEscKey.bind(this);

	connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("keydown", this.boundEscHandler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("keydown", this.boundEscHandler);
	}

	private handleEscKey(e: KeyboardEvent): void {
		if (e.key === "Escape" && this.open) {
			this.emitClose();
		}
	}

	private handleBackdropClick(): void {
		this.emitClose();
	}

	private handleCloseClick(): void {
		this.emitClose();
	}

	private emitClose(): void {
		this.dispatchEvent(new CustomEvent("panel-close", { bubbles: true, composed: true }));
	}

	protected renderContent() {
		return html`
			<div class="panel-backdrop" @click=${() => this.handleBackdropClick()}></div>
			<div class="panel">
				<div class="panel-header">
					<span class="panel-title">${this.title}</span>
					<button class="close-btn" @click=${() => this.handleCloseClick()}>&times;</button>
				</div>
				<div class="panel-body">
					<slot></slot>
				</div>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-slide-panel")) customElements.define("ft-game-slide-panel", SlidePanel);
