import { html, css, nothing } from 'lit';
import { FlowtiElement } from './flowti-element.js';

/**
 * A status badge with a colored dot indicator.
 *
 * @property label - Text label (required)
 * @property variant - Color variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
 * @property value - Optional value displayed after the label
 *
 * @example
 * <flowti-status-badge label="Health" variant="success" value="92%"></flowti-status-badge>
 */
export class FlowtiStatusBadge extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		label: { type: String },
		variant: { type: String, reflect: true },
		value: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary);
				font-size: var(--flowti-font-xs);
				line-height: 1;
			}

			.dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			:host([variant="success"]) .dot { background: var(--flowti-success); }
			:host([variant="warning"]) .dot { background: var(--flowti-warning); }
			:host([variant="error"]) .dot { background: var(--flowti-error); }
			:host([variant="info"]) .dot { background: var(--flowti-info); }
			:host([variant="neutral"]) .dot { background: var(--flowti-text-muted); }

			.label {
				color: var(--flowti-text);
			}

			.value {
				color: var(--flowti-text-muted);
				margin-left: var(--flowti-space-xs);
			}
		`,
	];

	label = '';
	variant = 'info';
	value = '';

	protected renderContent() {
		return html`
			<span class="dot"></span>
			<span class="label">${this.label}</span>
			${this.value ? html`<span class="value">${this.value}</span>` : nothing}
		`;
	}
}

if (!customElements.get('flowti-status-badge')) customElements.define('flowti-status-badge', FlowtiStatusBadge);
