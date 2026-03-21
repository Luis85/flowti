import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";

const styles = css`
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 900;
	}
	.modal {
		background: var(--background-primary, #1e1e1e);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: 8px;
		padding: var(--flowti-space-md, 16px);
		max-width: 420px;
		width: calc(100% - 24px);
	}
	.modal-title { font-weight: 600; margin-bottom: var(--flowti-space-sm, 8px); }
	.modal-body { color: var(--text-muted, #999); font-size: var(--flowti-font-sm, 0.85em); margin-bottom: var(--flowti-space-md, 16px); }
	.actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
	.btn {
		padding: 6px 14px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
	}
	.btn--primary {
		background: var(--interactive-accent, #7c3aed);
		border-color: var(--interactive-accent, #7c3aed);
		color: #fff;
	}
`;

export class FlowtiScaffoldModal extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		hasSitemap: { type: Boolean },
		hasMarkdownSource: { type: Boolean },
		hasCanvas: { type: Boolean },
		canvasChanged: { type: Boolean },
	};

	static styles = [tokens, styles];

	hasSitemap = false;
	hasMarkdownSource = false;
	hasCanvas = false;
	canvasChanged = false;

	protected renderContent() {
		return html`
			<div class="overlay" @click="${() => this.dispatchEvent(new CustomEvent("scaffold-dismiss", { bubbles: true, composed: true }))}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Storybook scaffold</div>
					<div class="modal-body">
						Choose how to set up your component library. You can import from canvas or markdown first, then scaffold.
					</div>
					<div class="actions">
						<button type="button" class="btn" @click="${() => this.emitDismiss()}">Cancel</button>
						${this.hasCanvas && this.canvasChanged
							? html`<button type="button" class="btn btn--primary" @click="${() => this.confirm({ canvasImport: true })}">Import canvas → scaffold</button>`
							: ""}
						${this.hasMarkdownSource
							? html`<button type="button" class="btn btn--primary" @click="${() => this.confirm({ importFirst: true })}">Import markdown → scaffold</button>`
							: ""}
						<button type="button" class="btn btn--primary" @click="${() => this.confirm({})}">Scaffold now</button>
					</div>
				</div>
			</div>
		`;
	}

	private emitDismiss(): void {
		this.dispatchEvent(new CustomEvent("scaffold-dismiss", { bubbles: true, composed: true }));
	}

	private confirm(detail: Record<string, boolean>): void {
		this.dispatchEvent(new CustomEvent("scaffold-confirm", { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-scaffold-modal")) customElements.define("flowti-scaffold-modal", FlowtiScaffoldModal);
