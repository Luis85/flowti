import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface ContextBinding {
	id: string;
	type: string;
	label: string;
	path: string;
}

/**
 * Context bindings panel showing files/folders bound to this session.
 *
 * @property bindings - Array of context binding objects
 * @property maxBindings - Maximum allowed bindings
 *
 * @fires context-open - detail: { path: string, type: string }
 * @fires context-cycle-type - detail: { bindingId: string }
 * @fires context-remove - detail: { bindingId: string }
 * @fires context-add - (no detail; handler opens modal externally)
 */
export class FlowtiSessionContext extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		bindings: { type: Array },
		maxBindings: { type: Number, attribute: 'max-bindings' },
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

			.context-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
			}

			.type-badge {
				padding: 2px 6px;
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
				user-select: none;
			}

			.type-badge:hover {
				background: var(--background-modifier-hover);
			}

			.context-link {
				color: var(--text-accent);
				cursor: pointer;
				text-decoration: none;
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.context-link:hover {
				text-decoration: underline;
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

			.add-btn {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--text-normal);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				margin-top: var(--flowti-space-sm);
			}

			.add-btn:hover {
				background: var(--background-modifier-hover);
			}

			.empty-text {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	bindings: ContextBinding[] = [];
	maxBindings = 10;

	private onCycleType(bindingId: string): void {
		this.dispatchEvent(new CustomEvent('context-cycle-type', {
			detail: { bindingId },
			bubbles: true,
			composed: true,
		}));
	}

	private onOpen(path: string, type: string): void {
		this.dispatchEvent(new CustomEvent('context-open', {
			detail: { path, type },
			bubbles: true,
			composed: true,
		}));
	}

	private onRemove(bindingId: string): void {
		this.dispatchEvent(new CustomEvent('context-remove', {
			detail: { bindingId },
			bubbles: true,
			composed: true,
		}));
	}

	private onAdd(): void {
		this.dispatchEvent(new CustomEvent('context-add', {
			bubbles: true,
			composed: true,
		}));
	}

	protected renderContent() {
		return html`
			<div class="section">
				<div class="header-row">
					<strong>Context</strong>
					<span class="count">(${this.bindings.length}/${this.maxBindings})</span>
				</div>
				${this.bindings.length === 0
					? html`<div class="empty-text">No context bindings</div>`
					: this.bindings.map((b) => html`
						<div class="context-row">
							<span
								class="type-badge"
								title="Click to change type"
								@click=${() => this.onCycleType(b.id)}
							>${b.type}</span>
							<a
								class="context-link"
								title=${b.path}
								@click=${() => this.onOpen(b.path, b.type)}
							>${b.label}</a>
							<button class="remove-btn" @click=${() => this.onRemove(b.id)} title="Remove">\u00D7</button>
						</div>
					`)
				}
				${this.bindings.length < this.maxBindings ? html`
					<button class="add-btn" @click=${this.onAdd}>+ Add context</button>
				` : nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-context')) customElements.define('flowti-session-context', FlowtiSessionContext);
