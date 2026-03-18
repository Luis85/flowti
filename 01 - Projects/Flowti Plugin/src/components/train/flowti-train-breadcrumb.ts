/**
 * Train Breadcrumb — path from root to the active thought.
 *
 * Each segment is clickable (except the active one) and fires
 * a `thought-activated` event with the target thought ID.
 *
 * @property thoughts - Array of ThoughtNode objects from root to active
 * @property activeThoughtId - ID of the currently active thought
 * @property trainId - ID of the current train
 *
 * @fires thought-activated - detail: { trainId, thoughtId }
 */

import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface BreadcrumbThought {
	id: string;
	title: string;
}

export class FlowtiTrainBreadcrumb extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		thoughts: { type: Array },
		activeThoughtId: { type: String, attribute: 'active-thought-id' },
		trainId: { type: String, attribute: 'train-id' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.breadcrumb-heading {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-xs);
				font-weight: 600;
			}

			.breadcrumb {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.breadcrumb-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
			}

			.breadcrumb-row--active {
				background: var(--background-modifier-active-hover);
			}

			.breadcrumb-marker {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				min-width: 32px;
				text-align: center;
			}

			.breadcrumb-segment {
				font-size: var(--flowti-font-sm);
			}

			.breadcrumb-segment--clickable {
				cursor: pointer;
				color: var(--flowti-color-info);
			}

			.breadcrumb-segment--clickable:hover {
				text-decoration: underline;
			}
		`,
	];

	thoughts: BreadcrumbThought[] = [];
	activeThoughtId: string | null = null;
	trainId: string | null = null;

	private onThoughtClick(thoughtId: string): void {
		this.dispatchEvent(
			new CustomEvent('thought-activated', {
				detail: { trainId: this.trainId, thoughtId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		if (this.thoughts.length === 0) return html``;

		return html`
			<div class="breadcrumb-heading">Path</div>
			<div class="breadcrumb">
				${this.thoughts.map((thought, i) => {
					const isFirst = i === 0;
					const isActive = thought.id === this.activeThoughtId;

					return html`
						<div class="breadcrumb-row ${isActive ? 'breadcrumb-row--active' : ''}">
							<span class="breadcrumb-marker">${isFirst ? 'Start' : i + 1}</span>
							<span
								class="breadcrumb-segment ${isActive ? '' : 'breadcrumb-segment--clickable'}"
								@click=${isActive ? nothing : () => this.onThoughtClick(thought.id)}
							>${thought.title}</span>
						</div>
					`;
				})}
			</div>
		`;
	}
}

if (!customElements.get('flowti-train-breadcrumb')) customElements.define('flowti-train-breadcrumb', FlowtiTrainBreadcrumb);
