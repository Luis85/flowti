import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

type ReflectionType = 'observation' | 'blocker' | 'idea' | 'decision';

interface ReflectionItem {
	id: string;
	type: ReflectionType;
	content: string;
}

const CATEGORIES: Array<{ type: ReflectionType; icon: string; label: string }> = [
	{ type: 'observation', icon: '\uD83D\uDC41\uFE0F', label: 'Observations' },
	{ type: 'blocker', icon: '\u26A0\uFE0F', label: 'Blockers' },
	{ type: 'idea', icon: '\uD83D\uDCA1', label: 'Ideas' },
	{ type: 'decision', icon: '\u2696\uFE0F', label: 'Decisions' },
];

/**
 * Reflection entries panel organized by category with add form.
 *
 * @property reflections - Array of reflection entry objects
 * @property editable - Whether reflections can be modified
 *
 * @fires reflection-add - detail: { type: ReflectionType, content: string }
 * @fires reflection-remove - detail: { entryId: string }
 */
export class FlowtiSessionReflections extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		reflections: { type: Array },
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

			.category-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				margin-top: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
				font-weight: 600;
			}

			.reflection-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
			}

			.reflection-content {
				flex: 1;
				font-size: var(--flowti-font-sm);
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

			.add-form {
				display: flex;
				gap: var(--flowti-space-sm);
				margin-top: var(--flowti-space-sm);
			}

			.type-select {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
			}

			.add-input {
				flex: 1;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
			}
		`,
	];

	reflections: ReflectionItem[] = [];
	editable = true;

	private selectedType: ReflectionType = 'observation';

	private onRemove(entryId: string): void {
		this.dispatchEvent(new CustomEvent('reflection-remove', {
			detail: { entryId },
			bubbles: true,
			composed: true,
		}));
	}

	private onTypeChange(e: Event): void {
		this.selectedType = (e.target as HTMLSelectElement).value as ReflectionType;
	}

	private onAddKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		const input = e.target as HTMLInputElement;
		const content = input.value.trim();
		if (!content) return;
		this.dispatchEvent(new CustomEvent('reflection-add', {
			detail: { type: this.selectedType, content },
			bubbles: true,
			composed: true,
		}));
		input.value = '';
	}

	protected renderContent() {
		return html`
			<div class="section">
				<div class="header-row">
					<strong>Reflections</strong>
					<span class="count">(${this.reflections.length})</span>
				</div>
				${CATEGORIES.map((cat) => this.renderCategory(cat))}
				${this.editable ? html`
					<div class="add-form">
						<select class="type-select" @change=${this.onTypeChange}>
							${CATEGORIES.map((cat) => html`
								<option value=${cat.type}>${cat.label.slice(0, -1)}</option>
							`)}
						</select>
						<input
							class="add-input"
							type="text"
							placeholder="Add reflection..."
							@keydown=${this.onAddKeydown}
						/>
					</div>
				` : nothing}
			</div>
		`;
	}

	private renderCategory(cat: typeof CATEGORIES[number]) {
		const entries = this.reflections.filter((r) => r.type === cat.type);
		if (entries.length === 0) return nothing;

		return html`
			<div class="category-header">
				<span>${cat.icon}</span>
				<span>${cat.label} (${entries.length})</span>
			</div>
			${entries.map((entry) => html`
				<div class="reflection-row">
					<span class="reflection-content">${entry.content}</span>
					${this.editable ? html`
						<button class="remove-btn" @click=${() => this.onRemove(entry.id)} title="Remove">\u00D7</button>
					` : nothing}
				</div>
			`)}
		`;
	}
}

if (!customElements.get('flowti-session-reflections')) customElements.define('flowti-session-reflections', FlowtiSessionReflections);
