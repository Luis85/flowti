import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

const DEBOUNCE_MS = 500;

/**
 * Notes textarea with debounced change events.
 *
 * @property notes - Current notes text
 *
 * @fires notes-change - detail: { notes: string }
 */
export class FlowtiSessionNotes extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		notes: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.section {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.heading {
				display: block;
				margin-bottom: var(--flowti-space-sm);
				font-weight: 600;
			}

			.notes-textarea {
				width: 100%;
				min-height: 100px;
				padding: var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
				resize: vertical;
			}
		`,
	];

	notes = '';

	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	private onInput(e: Event): void {
		const value = (e.target as HTMLTextAreaElement).value;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.dispatchEvent(new CustomEvent('notes-change', {
				detail: { notes: value },
				bubbles: true,
				composed: true,
			}));
		}, DEBOUNCE_MS);
	}

	protected renderContent() {
		return html`
			<div class="section">
				<strong class="heading">Notes</strong>
				<textarea
					class="notes-textarea"
					placeholder="Session notes..."
					.value=${this.notes}
					@input=${this.onInput}
				></textarea>
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-notes')) customElements.define('flowti-session-notes', FlowtiSessionNotes);
