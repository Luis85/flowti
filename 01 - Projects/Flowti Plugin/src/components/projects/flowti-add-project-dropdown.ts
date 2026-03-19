/**
 * Add project dropdown — "+" button with three project creation modes.
 * Dispatches `add-project` event with { mode } detail.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";

const ITEMS: { mode: string; label: string; hint: string }[] = [
	{ mode: "git", label: "Import from Git", hint: "Clone as tracked submodule" },
	{ mode: "template", label: "New from Template", hint: "Clone + detach, untracked copy" },
	{ mode: "empty", label: "Create Empty", hint: "Blank project with config" },
];

export class FlowtiAddProjectDropdown extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		open: { type: Boolean },
		focusIndex: { type: Number },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				position: relative;
				display: inline-block;
			}

			.add-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: none;
				color: var(--text-muted, #999);
				cursor: pointer;
				font-size: 1.1em;
			}

			.add-btn:hover {
				background: var(--background-modifier-hover, #333);
				color: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
			}

			.dropdown {
				position: absolute;
				top: 100%;
				right: 0;
				margin-top: 4px;
				z-index: 1000;
				min-width: 240px;
				background: var(--background-primary, #1e1e1e);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: var(--flowti-radius-sm, 4px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
				padding: var(--flowti-space-xs, 4px) 0;
			}

			.dropdown-item {
				display: flex;
				flex-direction: column;
				gap: 2px;
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				cursor: pointer;
				border: none;
				background: none;
				width: 100%;
				text-align: left;
				color: var(--text-normal, #ddd);
			}

			.dropdown-item:hover,
			.dropdown-item--focused {
				background: var(--background-modifier-hover, #333);
			}

			.dropdown-item__label {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
			}

			.dropdown-item__hint {
				font-size: 0.75em;
				color: var(--text-faint, #666);
			}
		`,
	];

	open = false;
	focusIndex = -1;

	private outsideClickHandler = (e: MouseEvent) => {
		if (!e.composedPath().includes(this)) {
			this.close();
		}
	};

	protected renderContent() {
		return html`
			<button class="add-btn" @click="${this.toggleDropdown}" title="Add project">+</button>
			${this.open ? this.renderDropdown() : ""}
		`;
	}

	private renderDropdown() {
		return html`
			<div class="dropdown" @keydown="${this.onKeydown}">
				${ITEMS.map((item, i) => html`
					<button
						class="dropdown-item ${i === this.focusIndex ? "dropdown-item--focused" : ""}"
						@click="${() => this.select(item.mode)}"
						@mouseenter="${() => { this.focusIndex = i; }}"
					>
						<span class="dropdown-item__label">${item.label}</span>
						<span class="dropdown-item__hint">${item.hint}</span>
					</button>
				`)}
			</div>
		`;
	}

	private toggleDropdown(): void {
		if (this.open) {
			this.close();
		} else {
			this.open = true;
			this.focusIndex = 0;
			document.addEventListener("click", this.outsideClickHandler);
			document.addEventListener("keydown", this.escapeHandler);
		}
	}

	private escapeHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape") this.close();
	};

	private close(): void {
		this.open = false;
		this.focusIndex = -1;
		document.removeEventListener("click", this.outsideClickHandler);
		document.removeEventListener("keydown", this.escapeHandler);
	}

	private select(mode: string): void {
		this.close();
		this.dispatchEvent(new CustomEvent("add-project", {
			detail: { mode },
			bubbles: true,
			composed: true,
		}));
	}

	private onKeydown(e: KeyboardEvent): void {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.focusIndex = Math.min(this.focusIndex + 1, ITEMS.length - 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.focusIndex = Math.max(this.focusIndex - 1, 0);
		} else if (e.key === "Enter" && this.focusIndex >= 0) {
			e.preventDefault();
			this.select(ITEMS[this.focusIndex].mode);
		}
	}
}

if (!customElements.get("flowti-add-project-dropdown")) customElements.define("flowti-add-project-dropdown", FlowtiAddProjectDropdown);
