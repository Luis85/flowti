import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface DecisionItem {
	id: string;
	title: string;
	description?: string;
	context?: string;
}

/**
 * Decision log panel with add form and remove buttons.
 *
 * @property decisions - Array of decision objects
 * @property editable - Whether decisions can be modified
 *
 * @fires decision-record - detail: { title: string }
 * @fires decision-remove - detail: { decisionId: string }
 */
export class FlowtiSessionDecisions extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		decisions: { type: Array },
		editable: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.section {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.header-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.count {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.decision-row {
				padding: var(--flowti-space-sm) 0;
				border-bottom: 1px solid var(--flowti-border);
			}

			.decision-row:last-of-type {
				border-bottom: none;
			}

			.decision-title-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.decision-title {
				flex: 1;
				font-weight: 600;
			}

			.remove-btn {
				padding: 2px 4px;
				border: none;
				background: none;
				color: var(--flowti-color-muted);
				cursor: pointer;
				border-radius: var(--flowti-radius);
			}

			.remove-btn:hover {
				color: var(--flowti-color-error);
				background: var(--background-modifier-hover);
			}

			.decision-description {
				margin: var(--flowti-space-xs) 0 0;
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
			}

			.decision-context {
				margin: var(--flowti-space-xs) 0 0;
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.add-input {
				width: 100%;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				margin-top: var(--flowti-space-sm);
			}
		`,
	];

	decisions: DecisionItem[] = [];
	editable = true;

	private onRemove(decisionId: string): void {
		this.dispatchEvent(new CustomEvent('decision-remove', {
			detail: { decisionId },
			bubbles: true,
			composed: true,
		}));
	}

	private onAddKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		const input = e.target as HTMLInputElement;
		const title = input.value.trim();
		if (!title) return;
		this.dispatchEvent(new CustomEvent('decision-record', {
			detail: { title },
			bubbles: true,
			composed: true,
		}));
		input.value = '';
	}

	protected renderContent() {
		return html`
			<div class="section">
				<div class="header-row">
					<strong>Decisions</strong>
					<span class="count">(${this.decisions.length})</span>
				</div>
				${this.decisions.map((d) => html`
					<div class="decision-row">
						<div class="decision-title-row">
							<strong class="decision-title">${d.title}</strong>
							${this.editable ? html`
								<button class="remove-btn" @click=${() => this.onRemove(d.id)} title="Remove">\u00D7</button>
							` : nothing}
						</div>
						${d.description ? html`<p class="decision-description">${d.description}</p>` : nothing}
						${d.context ? html`<p class="decision-context">Context: ${d.context}</p>` : nothing}
					</div>
				`)}
				${this.editable ? html`
					<input
						class="add-input"
						type="text"
						placeholder="Record a decision..."
						@keydown=${this.onAddKeydown}
					/>
				` : nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-decisions')) customElements.define('flowti-session-decisions', FlowtiSessionDecisions);
