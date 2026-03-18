import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Cognitive overload warning banner (FR-16).
 * Dismissible per render cycle.
 *
 * @property overloaded - Whether the overload state is active
 * @property reasons - Array of reason strings
 */
export class FlowtiSessionOverload extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		overloaded: { type: Boolean },
		reasons: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.alert {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: color-mix(in srgb, var(--flowti-color-warning) 15%, transparent);
				border: 1px solid var(--flowti-color-warning);
				margin: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.alert-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--flowti-space-sm);
			}

			.alert-title {
				font-weight: 600;
			}

			.dismiss-btn {
				border: none;
				background: none;
				color: var(--text-normal);
				cursor: pointer;
				font-size: 1.2em;
				padding: 2px 6px;
				border-radius: var(--flowti-radius);
			}

			.dismiss-btn:hover {
				background: var(--background-modifier-hover);
			}

			.reasons {
				margin: 0;
				padding-left: var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
			}

			.reasons li {
				margin-bottom: var(--flowti-space-xs);
			}

			.suggestion {
				margin-top: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}
		`,
	];

	overloaded = false;
	reasons: string[] = [];

	private dismissed = false;

	private onDismiss(): void {
		this.dismissed = true;
		this.requestUpdate();
	}

	/** Reset dismissed state when session changes significantly. */
	resetDismissed(): void {
		this.dismissed = false;
		this.requestUpdate();
	}

	protected renderContent() {
		if (!this.overloaded || this.dismissed) return html``;

		return html`
			<div class="alert">
				<div class="alert-header">
					<strong class="alert-title">\u26A0\uFE0F Cognitive overload</strong>
					<button class="dismiss-btn" title="Dismiss warning" @click=${this.onDismiss}>\u00D7</button>
				</div>
				<ul class="reasons">
					${this.reasons.map((r) => html`<li>${r}</li>`)}
				</ul>
				<div class="suggestion">Consider reducing scope, taking a break, or completing existing tasks.</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-overload')) customElements.define('flowti-session-overload', FlowtiSessionOverload);
