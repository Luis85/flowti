import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Quick capture form for modal content.
 *
 * Provides fields for type, title, body, and tags to quickly
 * capture an idea, note, or other item. Designed to be used
 * inside FlowtiModal.
 *
 * @property captureType - Pre-selected capture type (idea, note, etc.)
 * @property captureTypes - Available capture type options
 * @property title - Pre-filled title
 * @property body - Pre-filled body text
 * @property tags - Pre-filled tags array
 *
 * @fires capture-submit - detail: { type, title, body, tags }
 * @fires capture-cancel - when the user cancels
 */

interface CaptureTypeOption {
	value: string;
	label: string;
}

export class FlowtiCaptureForm extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		captureType: { type: String, attribute: 'capture-type' },
		captureTypes: { type: Array },
		title: { type: String },
		body: { type: String },
		tags: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.capture-form {
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
				font-size: var(--flowti-font-sm);
				font-weight: 500;
			}

			input, textarea, select {
				padding: var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
				font-size: inherit;
			}

			textarea {
				resize: vertical;
				min-height: 80px;
			}

			input:focus, textarea:focus, select:focus {
				outline: 2px solid var(--flowti-color-info);
				outline-offset: -1px;
			}

			.tag-section {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.tag-container {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
			}

			.tag {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				font-size: var(--flowti-font-sm);
			}

			.tag-remove {
				cursor: pointer;
				font-weight: 700;
				color: var(--flowti-color-muted);
			}

			.tag-remove:hover {
				color: var(--flowti-color-error);
			}

			.tag-input {
				font-size: var(--flowti-font-sm);
			}

			.form-actions {
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

	captureType = 'idea';
	captureTypes: CaptureTypeOption[] = [
		{ value: 'idea', label: 'Idea' },
		{ value: 'note', label: 'Note' },
		{ value: 'task', label: 'Task' },
		{ value: 'question', label: 'Question' },
		{ value: 'bug', label: 'Bug' },
	];
	title = '';
	body = '';
	tags: string[] = [];

	private handleSubmit(): void {
		const trimmedTitle = this.title.trim();
		if (!trimmedTitle) return;
		this.dispatchEvent(new CustomEvent('capture-submit', {
			detail: {
				type: this.captureType,
				title: trimmedTitle,
				body: this.body.trim(),
				tags: [...this.tags],
			},
			bubbles: true,
			composed: true,
		}));
	}

	private handleCancel(): void {
		this.dispatchEvent(new CustomEvent('capture-cancel', { bubbles: true, composed: true }));
	}

	private handleTagAdd(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const input = e.target as HTMLInputElement;
		const value = input.value.trim();
		if (!value || this.tags.includes(value)) return;
		this.tags = [...this.tags, value];
		input.value = '';
		this.requestUpdate();
	}

	private handleTagRemove(index: number): void {
		this.tags = this.tags.filter((_, i) => i !== index);
		this.requestUpdate();
	}

	protected firstUpdated(): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="text"]');
		if (input) {
			requestAnimationFrame(() => input.focus());
		}
	}

	protected renderContent() {
		return html`
			<div class="capture-form">
				${this.captureTypes.length > 1 ? html`
					<div class="form-group">
						<label class="form-label">Type</label>
						<select
							.value=${this.captureType}
							@change=${(e: Event) => { this.captureType = (e.target as HTMLSelectElement).value; }}
						>
							${this.captureTypes.map((t) => html`
								<option value=${t.value} ?selected=${this.captureType === t.value}>${t.label}</option>
							`)}
						</select>
					</div>
				` : ''}

				<div class="form-group">
					<label class="form-label">Title</label>
					<input
						type="text"
						placeholder="What's on your mind?"
						.value=${this.title}
						@input=${(e: InputEvent) => { this.title = (e.target as HTMLInputElement).value; }}
						@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && e.ctrlKey) this.handleSubmit(); }}
					/>
				</div>

				<div class="form-group">
					<label class="form-label">Body</label>
					<textarea
						placeholder="Add details..."
						rows="4"
						.value=${this.body}
						@input=${(e: InputEvent) => { this.body = (e.target as HTMLTextAreaElement).value; }}
					></textarea>
				</div>

				<div class="tag-section">
					<label class="form-label">Tags</label>
					<div class="tag-container">
						${this.tags.map((tag, i) => html`
							<span class="tag">
								${tag}
								<span
									class="tag-remove"
									role="button"
									tabindex="0"
									@click=${() => this.handleTagRemove(i)}
									@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.handleTagRemove(i); } }}
								>&#x00d7;</span>
							</span>
						`)}
					</div>
					<input
						class="tag-input"
						type="text"
						placeholder="Add tag and press Enter..."
						@keydown=${this.handleTagAdd}
					/>
				</div>

				<div class="form-actions">
					<button @click=${() => this.handleCancel()}>Cancel</button>
					<button class="btn-submit" @click=${() => this.handleSubmit()}>Capture</button>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-capture-form')) customElements.define('flowti-capture-form', FlowtiCaptureForm);
