import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Base modal content component with header, body, and footer slots.
 *
 * Designed to be rendered inside an Obsidian Modal's contentEl.
 * Provides consistent layout and styling for all Flowti modal content.
 * Dispatches a "modal-close" event when the user requests closure.
 *
 * @property modalTitle - Title displayed in the header
 * @property showClose - Whether to show a close button in the header
 *
 * @fires modal-close - When the user clicks the close button or presses Escape
 *
 * @slot default - Main body content
 * @slot footer - Footer content (buttons, etc.)
 */
export class FlowtiModalContent extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		modalTitle: { type: String, attribute: 'modal-title' },
		showClose: { type: Boolean, attribute: 'show-close' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.modal-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.modal-header__title {
				flex: 1;
				font-size: 1.1em;
				font-weight: 600;
				margin: 0;
			}

			.modal-header__close {
				cursor: pointer;
				padding: var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				color: var(--flowti-color-muted);
				font-size: 1.2em;
				background: none;
				border: none;
			}

			.modal-header__close:hover {
				color: var(--text-normal);
				background: var(--background-modifier-hover);
			}

			.modal-body {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.modal-footer {
				display: flex;
				justify-content: flex-end;
				gap: var(--flowti-space-sm);
				padding-top: var(--flowti-space-sm);
				border-top: 1px solid var(--flowti-border);
			}
		`,
	];

	modalTitle = '';
	showClose = true;

	private dispatchClose(): void {
		this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
	}

	connectedCallback(): void {
		super.connectedCallback();
		this.addEventListener('keydown', this.handleKeydown);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.removeEventListener('keydown', this.handleKeydown);
	}

	private handleKeydown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.dispatchClose();
		}
	};

	protected renderContent() {
		return html`
			${this.modalTitle ? html`
				<div class="modal-header">
					<h3 class="modal-header__title">${this.modalTitle}</h3>
					${this.showClose ? html`
						<button
							class="modal-header__close"
							aria-label="Close"
							@click=${() => this.dispatchClose()}
						>&#x2715;</button>
					` : nothing}
				</div>
			` : nothing}
			<div class="modal-body">
				<slot></slot>
			</div>
			<div class="modal-footer">
				<slot name="footer"></slot>
			</div>
		`;
	}
}

if (!customElements.get('flowti-modal-content')) customElements.define('flowti-modal-content', FlowtiModalContent);
