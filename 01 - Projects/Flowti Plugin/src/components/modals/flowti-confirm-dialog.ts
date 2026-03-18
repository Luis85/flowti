import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Confirmation dialog content for use inside FlowtiModal.
 *
 * Displays a message with confirm and cancel buttons.
 * The confirm button can be styled as a warning/destructive action.
 *
 * @property message - The confirmation message to display
 * @property confirmLabel - Label for the confirm button (default: "Confirm")
 * @property cancelLabel - Label for the cancel button (default: "Cancel")
 * @property destructive - Whether confirm is a destructive action (red styling)
 *
 * @fires confirm - When the user clicks the confirm button
 * @fires cancel - When the user clicks the cancel button
 */
export class FlowtiConfirmDialog extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		message: { type: String },
		confirmLabel: { type: String, attribute: 'confirm-label' },
		cancelLabel: { type: String, attribute: 'cancel-label' },
		destructive: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.dialog {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.dialog-message {
				line-height: 1.5;
			}

			.dialog-actions {
				display: flex;
				justify-content: flex-end;
				gap: var(--flowti-space-sm);
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--text-normal);
				cursor: pointer;
				font-size: inherit;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}

			.btn-confirm {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
			}

			.btn-confirm:hover {
				background: color-mix(in srgb, var(--flowti-color-info) 25%, transparent);
			}

			.btn-destructive {
				background: color-mix(in srgb, var(--flowti-color-error) 15%, transparent);
				border-color: var(--flowti-color-error);
				color: var(--flowti-color-error);
			}

			.btn-destructive:hover {
				background: color-mix(in srgb, var(--flowti-color-error) 25%, transparent);
			}
		`,
	];

	message = '';
	confirmLabel = 'Confirm';
	cancelLabel = 'Cancel';
	destructive = false;

	private dispatchConfirm(): void {
		this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
	}

	private dispatchCancel(): void {
		this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
	}

	protected renderContent() {
		const confirmClass = this.destructive ? 'btn-destructive' : 'btn-confirm';

		return html`
			<div class="dialog">
				<div class="dialog-message">${this.message}</div>
				<div class="dialog-actions">
					<button @click=${() => this.dispatchCancel()}>${this.cancelLabel}</button>
					<button class=${confirmClass} @click=${() => this.dispatchConfirm()}>${this.confirmLabel}</button>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-confirm-dialog')) customElements.define('flowti-confirm-dialog', FlowtiConfirmDialog);
