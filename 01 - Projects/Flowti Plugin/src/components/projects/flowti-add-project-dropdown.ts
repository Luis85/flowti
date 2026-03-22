import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";

const styles = css`
	.wrap { position: relative; display: inline-block; }
	.trigger {
		padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
		border-radius: var(--hub-radius, 6px);
		border: 1px solid var(--background-modifier-border, #444);
		background: var(--interactive-accent, #7c3aed);
		color: #fff;
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
		transition: background var(--hub-transition, 150ms ease), transform var(--hub-transition, 150ms ease);
	}
	.trigger:hover { filter: brightness(1.1); transform: translateY(-0.5px); }
	.menu {
		display: none;
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: 4px;
		min-width: 200px;
		background: var(--background-primary, #1e1e1e);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
		padding: 4px;
		z-index: 50;
		box-shadow: 0 4px 12px rgba(0,0,0,0.4);
	}
	.menu.open { display: block; }
	.menu button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border: none;
		background: none;
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
		border-radius: var(--hub-radius, 6px);
		transition: background var(--hub-transition, 150ms ease);
	}
	.menu button:hover { background: var(--background-modifier-hover, #333); }
	.trigger:focus-visible,
	.menu button:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
`;

export class FlowtiAddProjectDropdown extends FlowtiElement {
	static properties = { ...FlowtiElement.properties, open: { type: Boolean } };
	static styles = [tokens, styles];

	open = false;

	protected renderContent() {
		return html`
			<div class="wrap" @click="${(e: Event) => e.stopPropagation()}">
				<button
					type="button"
					class="trigger"
					@click="${(e: Event) => {
						e.stopPropagation();
						this.open = !this.open;
					}}"
				>+ Add project</button>
				<div class="menu ${this.open ? "open" : ""}" @click="${(e: Event) => e.stopPropagation()}">
					<button type="button" @click="${() => this.pick("empty")}">Empty project</button>
					<button type="button" @click="${() => this.pick("submodule")}">Import from Git (submodule)</button>
					<button type="button" @click="${() => this.pick("template")}">New from template</button>
				</div>
			</div>
		`;
	}

	connectedCallback(): void {
		super.connectedCallback();
		this._onDoc = () => { this.open = false; };
		document.addEventListener("click", this._onDoc);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("click", this._onDoc!);
	}

	private _onDoc?: () => void;

	private pick(mode: string): void {
		this.open = false;
		this.dispatchEvent(new CustomEvent("add-project", { detail: { mode }, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-add-project-dropdown")) customElements.define("flowti-add-project-dropdown", FlowtiAddProjectDropdown);
