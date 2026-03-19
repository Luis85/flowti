/**
 * Scaffold modal — prompts user to generate components from sitemap after install.
 *
 * Three states:
 * 1. hasSitemap → "Generate from project sitemap" + Generate/Cancel
 * 2. hasMarkdownSource → "Import markdown then generate" + Import & Generate/Cancel
 * 3. Neither → "No sitemap found" + Dismiss
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";

export class FlowtiScaffoldModal extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		hasSitemap: { type: Boolean },
		hasMarkdownSource: { type: Boolean },
	};

	static styles = [
		tokens,
		css`
			:host {
				display: block;
			}

			.overlay {
				position: fixed;
				inset: 0;
				background: rgba(0, 0, 0, 0.6);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1000;
			}

			.modal {
				background: var(--background-primary, #1e1e1e);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 8px;
				padding: var(--flowti-space-lg, 24px);
				max-width: 420px;
				width: 90%;
			}

			.modal-title {
				font-weight: 600;
				font-size: 1.1em;
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.modal-body {
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
				margin-bottom: var(--flowti-space-md, 16px);
				line-height: 1.5;
			}

			.modal-actions {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				justify-content: flex-end;
			}

			.btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 4px;
				background: var(--background-secondary, #262626);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.btn:hover {
				background: var(--background-modifier-hover, #333);
			}

			.btn--primary {
				background: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
				color: #fff;
			}

			.btn--primary:hover {
				filter: brightness(1.1);
			}
		`,
	];

	hasSitemap = false;
	hasMarkdownSource = false;

	protected renderContent() {
		if (this.hasSitemap) {
			return this.renderSitemapPrompt();
		}
		if (this.hasMarkdownSource) {
			return this.renderImportPrompt();
		}
		return this.renderNoSitemap();
	}

	private renderSitemapPrompt() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Generate components</div>
					<div class="modal-body">
						Generate story files from your project sitemap? This will create component stubs
						and stories in the components directory.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Cancel</button>
						<button class="btn btn--primary" @click="${this.dispatchConfirm}">Generate</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderImportPrompt() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Generate components</div>
					<div class="modal-body">
						No project sitemap found, but a markdown source is configured. Import markdown
						files to build a sitemap, then generate component stubs and stories.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Cancel</button>
						<button class="btn btn--primary" @click="${this.dispatchConfirmWithImport}">Import &amp; Generate</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderNoSitemap() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">No sitemap found</div>
					<div class="modal-body">
						Add a <code>configs/sitemap.json</code> or configure a markdown source
						in the Config tab to generate components.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Dismiss</button>
					</div>
				</div>
			</div>
		`;
	}

	private dispatchConfirm(): void {
		this.dispatchEvent(new CustomEvent("scaffold-confirm", { bubbles: true, composed: true }));
	}

	private dispatchConfirmWithImport(): void {
		this.dispatchEvent(new CustomEvent("scaffold-confirm", {
			detail: { importFirst: true },
			bubbles: true, composed: true,
		}));
	}

	private dispatchDismiss(): void {
		this.dispatchEvent(new CustomEvent("scaffold-dismiss", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-scaffold-modal")) customElements.define("flowti-scaffold-modal", FlowtiScaffoldModal);
