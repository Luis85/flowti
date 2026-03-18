import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface ClosureQuestion {
	id: string;
	question: string;
	type: 'text' | 'select' | 'rating';
	required: boolean;
	options?: string[];
}

/**
 * Session closure ritual overlay (FR-14).
 * Presents configurable closure questions, validates required fields.
 *
 * @property sessionTitle - Title of the session being closed
 * @property questions - Array of closure question objects
 *
 * @fires closure-submit - detail: { answers: Record<string, string> }
 * @fires closure-skip
 */
export class FlowtiSessionClosure extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sessionTitle: { type: String, attribute: 'session-title' },
		questions: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.overlay {
				padding: var(--flowti-space-lg);
			}

			.header {
				text-align: center;
				margin-bottom: var(--flowti-space-lg);
			}

			.header h3 {
				margin: var(--flowti-space-sm) 0;
			}

			.header-subtitle {
				color: var(--flowti-color-muted);
			}

			.form {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.question-group {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.question-group--error {
				border-left: 3px solid var(--flowti-color-error);
				padding-left: var(--flowti-space-sm);
			}

			.question-label {
				font-weight: 500;
			}

			select, textarea {
				width: 100%;
				padding: var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
			}

			textarea {
				min-height: 80px;
				resize: vertical;
			}

			.rating-row {
				display: flex;
				gap: var(--flowti-space-sm);
			}

			.rating-btn {
				width: 36px;
				height: 36px;
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--text-normal);
				cursor: pointer;
				font-size: 1em;
			}

			.rating-btn:hover {
				background: var(--background-modifier-hover);
			}

			.rating-btn--selected {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border-color: var(--interactive-accent);
			}

			.actions {
				display: flex;
				gap: var(--flowti-space-sm);
				justify-content: center;
				margin-top: var(--flowti-space-lg);
			}

			.submit-btn {
				padding: var(--flowti-space-sm) var(--flowti-space-lg);
				border: none;
				border-radius: var(--flowti-radius);
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				font-weight: 600;
			}

			.submit-btn:hover {
				opacity: 0.9;
			}

			.skip-btn {
				padding: var(--flowti-space-sm) var(--flowti-space-lg);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--text-normal);
				cursor: pointer;
			}

			.skip-btn:hover {
				background: var(--background-modifier-hover);
			}
		`,
	];

	sessionTitle = '';
	questions: ClosureQuestion[] = [];

	private answers: Record<string, string> = {};
	private errorFields: Set<string> = new Set();

	private onTextInput(questionId: string, e: Event): void {
		this.answers[questionId] = (e.target as HTMLTextAreaElement).value;
		this.errorFields.delete(questionId);
		this.requestUpdate();
	}

	private onSelectChange(questionId: string, e: Event): void {
		this.answers[questionId] = (e.target as HTMLSelectElement).value;
		this.errorFields.delete(questionId);
		this.requestUpdate();
	}

	private onRatingClick(questionId: string, value: number): void {
		this.answers[questionId] = String(value);
		this.errorFields.delete(questionId);
		this.requestUpdate();
	}

	private onSubmit(): void {
		const missing: string[] = [];
		for (const q of this.questions) {
			if (q.required && !this.answers[q.id]?.trim()) {
				missing.push(q.id);
			}
		}
		if (missing.length > 0) {
			this.errorFields = new Set(missing);
			this.requestUpdate();
			return;
		}

		this.dispatchEvent(new CustomEvent('closure-submit', {
			detail: { answers: { ...this.answers } },
			bubbles: true,
			composed: true,
		}));
	}

	private onSkip(): void {
		this.dispatchEvent(new CustomEvent('closure-skip', {
			bubbles: true,
			composed: true,
		}));
	}

	protected renderContent() {
		return html`
			<div class="overlay">
				<div class="header">
					<h3>Closure ritual</h3>
					<p class="header-subtitle">Reflect on "${this.sessionTitle}" before completing.</p>
				</div>
				<div class="form">
					${this.questions.map((q) => this.renderQuestion(q))}
				</div>
				<div class="actions">
					<button class="submit-btn" @click=${this.onSubmit}>Complete session</button>
					<button class="skip-btn" @click=${this.onSkip}>Skip</button>
				</div>
			</div>
		`;
	}

	private renderQuestion(q: ClosureQuestion) {
		const hasError = this.errorFields.has(q.id);
		const groupClass = hasError ? 'question-group question-group--error' : 'question-group';

		return html`
			<div class=${groupClass} data-question-id=${q.id}>
				<label class="question-label">
					${q.question}${q.required ? ' *' : ''}
				</label>
				${q.type === 'select' && q.options
					? html`
						<select @change=${(e: Event) => this.onSelectChange(q.id, e)}>
							<option value="">Select...</option>
							${q.options.map((opt) => html`<option value=${opt}>${opt}</option>`)}
						</select>
					`
					: q.type === 'rating'
						? html`
							<div class="rating-row">
								${[1, 2, 3, 4, 5].map((i) => html`
									<button
										class="rating-btn ${this.answers[q.id] === String(i) ? 'rating-btn--selected' : ''}"
										@click=${() => this.onRatingClick(q.id, i)}
									>${i}</button>
								`)}
							</div>
						`
						: html`
							<textarea
								placeholder="Type your response..."
								@input=${(e: Event) => this.onTextInput(q.id, e)}
							></textarea>
						`
				}
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-closure')) customElements.define('flowti-session-closure', FlowtiSessionClosure);
