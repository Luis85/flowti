import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Input dialog content for use inside FlowtiModal.
 *
 * Displays a labeled text input with submit and cancel buttons.
 * Pressing Enter in the input field triggers submit.
 *
 * @property label - Label for the input field
 * @property description - Optional description below the label
 * @property placeholder - Input placeholder text
 * @property value - Current input value
 * @property submitLabel - Label for the submit button (default: "Submit")
 * @property cancelLabel - Label for the cancel button (default: "Cancel")
 *
 * @fires input-submit - detail: { value } when the user submits
 * @fires input-cancel - when the user cancels
 */
export class FlowtiInputDialog extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		label: { type: String },
		description: { type: String },
		placeholder: { type: String },
		value: { type: String },
		submitLabel: { type: String, attribute: 'submit-label' },
		cancelLabel: { type: String, attribute: 'cancel-label' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.dialog {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.form-group {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.form-label {
				font-weight: 500;
			}

			.form-desc {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			input {
				padding: var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
				font-size: inherit;
			}

			input:focus {
				outline: 2px solid var(--flowti-color-info);
				outline-offset: -1px;
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

			.btn-submit {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
			}

			.btn-submit:hover {
				background: color-mix(in srgb, var(--flowti-color-info) 25%, transparent);
			}
		`,
	];

	label = '';
	description = '';
	placeholder = '';
	value = '';
	submitLabel = 'Submit';
	cancelLabel = 'Cancel';

	private handleSubmit(): void {
		const trimmed = this.value.trim();
		if (!trimmed) return;
		this.dispatchEvent(new CustomEvent('input-submit', {
			detail: { value: trimmed },
			bubbles: true,
			composed: true,
		}));
	}

	private handleCancel(): void {
		this.dispatchEvent(new CustomEvent('input-cancel', { bubbles: true, composed: true }));
	}

	private handleInput(e: InputEvent): void {
		this.value = (e.target as HTMLInputElement).value;
	}

	private handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			this.handleSubmit();
		}
	}

	protected firstUpdated(): void {
		const input = this.shadowRoot?.querySelector('input');
		if (input) {
			requestAnimationFrame(() => input.focus());
		}
	}

	protected renderContent() {
		return html`
			<div class="dialog">
				<div class="form-group">
					${this.label ? html`<label class="form-label">${this.label}</label>` : ''}
					${this.description ? html`<span class="form-desc">${this.description}</span>` : ''}
					<input
						type="text"
						placeholder=${this.placeholder}
						.value=${this.value}
						@input=${this.handleInput}
						@keydown=${this.handleKeydown}
					/>
				</div>
				<div class="dialog-actions">
					<button @click=${() => this.handleCancel()}>${this.cancelLabel}</button>
					<button class="btn-submit" @click=${() => this.handleSubmit()}>${this.submitLabel}</button>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-input-dialog')) customElements.define('flowti-input-dialog', FlowtiInputDialog);
