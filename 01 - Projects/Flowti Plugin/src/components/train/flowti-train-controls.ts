/**
 * Train Controls — status-aware action buttons.
 *
 * Renders Pause/Resume/Complete/Add Thought buttons based on train status.
 * All actions are dispatched as CustomEvents — the handler wires them
 * to TrainService and EventBus.
 *
 * @property status - Current train status ("running" | "paused" | "completed")
 *
 * @fires pause-train - When Pause is clicked
 * @fires resume-train - When Resume is clicked
 * @fires complete-train - When Complete is clicked
 * @fires add-thought - When Add Thought is clicked
 */

import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

export class FlowtiTrainControls extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		status: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: inline-flex;
			}

			.controls {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
			}

			button {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
				white-space: nowrap;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}

			.btn-primary {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
			}

			.btn-primary:hover {
				background: color-mix(in srgb, var(--flowti-color-info) 25%, transparent);
			}
		`,
	];

	status = '';

	private dispatch(eventName: string): void {
		this.dispatchEvent(
			new CustomEvent(eventName, { bubbles: true, composed: true }),
		);
	}

	protected renderContent() {
		if (this.status === 'running') {
			return html`
				<div class="controls">
					<button @click=${() => this.dispatch('pause-train')}>Pause</button>
					<button @click=${() => this.dispatch('complete-train')}>Complete</button>
				</div>
			`;
		}

		if (this.status === 'paused') {
			return html`
				<div class="controls">
					<button class="btn-primary" @click=${() => this.dispatch('resume-train')}>Resume</button>
					<button @click=${() => this.dispatch('complete-train')}>Complete</button>
				</div>
			`;
		}

		return html``;
	}
}

if (!customElements.get('flowti-train-controls')) customElements.define('flowti-train-controls', FlowtiTrainControls);
