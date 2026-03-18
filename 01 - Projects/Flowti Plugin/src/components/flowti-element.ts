import { LitElement, html, css } from 'lit';
import { tokens, utilities } from './tokens.js';

/**
 * Base class for all Flowti Lit components.
 *
 * Provides:
 * - Shared design tokens (via `tokens` CSS)
 * - Loading state (`loading` property → spinner overlay)
 * - Error state (`error` property → error message)
 * - Empty state (`isEmpty` + `emptyMessage` properties → placeholder)
 *
 * Subclasses override `renderContent()` for their main content.
 */
export class FlowtiElement extends LitElement {
	static properties = {
		loading: { type: Boolean, reflect: true },
		error: { type: String },
		isEmpty: { type: Boolean },
		emptyMessage: { type: String, attribute: 'empty-message' },
	};

	static styles = [
		tokens,
		utilities,
		css`
			:host {
				display: block;
			}

			.flowti-loading {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-lg);
				color: var(--flowti-text-muted);
			}

			.flowti-error {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				background: color-mix(in srgb, var(--flowti-error) 15%, transparent);
				color: var(--flowti-error);
				font-size: var(--flowti-font-sm);
			}

			.flowti-empty {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl);
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	loading = false;
	error = '';
	isEmpty = false;
	emptyMessage = 'No data available';

	render() {
		if (this.error) {
			return html`<div class="flowti-error">${this.error}</div>`;
		}
		if (this.loading) {
			return html`<div class="flowti-loading">Loading…</div>`;
		}
		if (this.isEmpty) {
			return html`<div class="flowti-empty">${this.emptyMessage}</div>`;
		}
		return this.renderContent();
	}

	/**
	 * Override in subclasses to provide main content.
	 * Only called when not loading, no error, and not empty.
	 */
	protected renderContent() {
		return html`<slot></slot>`;
	}
}

if (!customElements.get('flowti-element')) customElements.define('flowti-element', FlowtiElement);
