/**
 * Train Property Editor — inline frontmatter property editor for thought notes.
 *
 * Renders existing frontmatter as key-value pairs. Built-in properties
 * (type, train, direction, order, parent) are read-only with a lock indicator.
 * User can edit values inline and add new properties.
 *
 * @property properties - Record of frontmatter key-value pairs
 *
 * @fires property-changed - detail: { key, value } when a user property is edited
 * @fires property-added - detail: { key, value } when a new property is added
 */

import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

const BUILT_IN_KEYS = new Set([
	'type', 'train', 'direction', 'order', 'parent',
	'prev', 'next', 'up', 'down', 'merge-target', 'merged-from',
]);

export class FlowtiTrainPropertyEditor extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		properties: { type: Object },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.editor {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.editor-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--flowti-space-xs);
			}

			.editor-title {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				font-weight: 600;
				font-size: var(--flowti-font-sm);
			}

			.property-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
			}

			.property-row:hover {
				background: var(--background-modifier-hover);
			}

			.property-lock {
				color: var(--flowti-color-muted);
				font-size: 0.85em;
			}

			.property-key {
				min-width: 80px;
				font-weight: 500;
			}

			.property-value {
				flex: 1;
				color: var(--flowti-color-muted);
			}

			.property-value--editable {
				cursor: pointer;
				color: var(--flowti-text, inherit);
			}

			.property-value--editable:hover {
				text-decoration: underline;
			}

			.empty-msg {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			button {
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: transparent;
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover {
				background: var(--background-modifier-hover);
				color: var(--flowti-text, inherit);
			}

			input {
				padding: 2px var(--flowti-space-xs);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
				width: 100%;
			}

			.new-row {
				display: flex;
				gap: var(--flowti-space-xs);
			}

			.new-row input {
				flex: 1;
			}
		`,
	];

	properties: Record<string, unknown> = {};

	private editingKey: string | null = null;
	private addingNew = false;

	private formatValue(value: unknown): string {
		if (value === null || value === undefined) return '(empty)';
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}

	private parseValue(str: string): unknown {
		if (str === '' || str === '(empty)') return '';
		if (str === 'true') return true;
		if (str === 'false') return false;
		const num = Number(str);
		if (!isNaN(num) && str.trim() !== '') return num;
		return str;
	}

	private onValueEdit(key: string, newValue: string): void {
		this.editingKey = null;
		this.dispatchEvent(
			new CustomEvent('property-changed', {
				detail: { key, value: this.parseValue(newValue) },
				bubbles: true,
				composed: true,
			}),
		);
		this.requestUpdate();
	}

	private onAddProperty(key: string, value: string): void {
		this.addingNew = false;
		if (!key || BUILT_IN_KEYS.has(key)) return;
		this.dispatchEvent(
			new CustomEvent('property-added', {
				detail: { key, value: this.parseValue(value) },
				bubbles: true,
				composed: true,
			}),
		);
		this.requestUpdate();
	}

	private onStartEdit(key: string): void {
		this.editingKey = key;
		this.requestUpdate();
	}

	private onStartAdd(): void {
		this.addingNew = true;
		this.requestUpdate();
	}

	protected renderContent() {
		const entries = Object.entries(this.properties ?? {}).filter(([k]) => k !== 'position');

		return html`
			<div class="editor">
				<div class="editor-header">
					<div class="editor-title">Properties</div>
					<button @click=${this.onStartAdd}>+ Add</button>
				</div>
				${entries.length === 0 && !this.addingNew
					? html`<div class="empty-msg">No properties</div>`
					: nothing}
				${entries.map(([key, value]) => this.renderProperty(key, value))}
				${this.addingNew ? this.renderAddRow() : nothing}
			</div>
		`;
	}

	private renderProperty(key: string, value: unknown) {
		const isBuiltIn = BUILT_IN_KEYS.has(key);
		const isEditing = this.editingKey === key;
		const displayValue = this.formatValue(value);

		if (isEditing && !isBuiltIn) {
			return html`
				<div class="property-row">
					<span class="property-key">${key}</span>
					<input
						type="text"
						.value=${displayValue}
						@blur=${(e: Event) => this.onValueEdit(key, (e.target as HTMLInputElement).value)}
						@keydown=${(e: KeyboardEvent) => {
							if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
							if (e.key === 'Escape') { this.editingKey = null; this.requestUpdate(); }
						}}
					/>
				</div>
			`;
		}

		return html`
			<div class="property-row">
				${isBuiltIn ? html`<span class="property-lock">&#x1F512;</span>` : nothing}
				<span class="property-key">${key}</span>
				<span
					class="property-value ${isBuiltIn ? '' : 'property-value--editable'}"
					@click=${isBuiltIn ? nothing : () => this.onStartEdit(key)}
				>${displayValue}</span>
			</div>
		`;
	}

	private renderAddRow() {
		let keyVal = '';
		let valVal = '';

		const commit = (): void => {
			this.onAddProperty(keyVal, valVal);
		};

		return html`
			<div class="new-row">
				<input
					type="text"
					placeholder="Key"
					@input=${(e: Event) => { keyVal = (e.target as HTMLInputElement).value; }}
					@keydown=${(e: KeyboardEvent) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							const next = (e.target as HTMLElement).nextElementSibling as HTMLInputElement;
							next?.focus();
						}
						if (e.key === 'Escape') { this.addingNew = false; this.requestUpdate(); }
					}}
				/>
				<input
					type="text"
					placeholder="Value"
					@input=${(e: Event) => { valVal = (e.target as HTMLInputElement).value; }}
					@blur=${commit}
					@keydown=${(e: KeyboardEvent) => {
						if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
						if (e.key === 'Escape') { this.addingNew = false; this.requestUpdate(); }
					}}
				/>
			</div>
		`;
	}
}

if (!customElements.get('flowti-train-property-editor')) customElements.define('flowti-train-property-editor', FlowtiTrainPropertyEditor);
