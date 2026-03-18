/**
 * Train Type Picker — card grid for selecting a train type before starting.
 *
 * Displays built-in train types as bordered cards in a 2-column grid.
 * Each card shows icon, label, and default duration.
 *
 * Can be used inside an Obsidian Modal wrapper or standalone.
 *
 * @property types - Array of train type config objects
 *
 * @fires type-selected - detail: { typeConfig } when a type card is clicked
 */

import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface TypeConfig {
	id: string;
	label: string;
	icon: string;
	defaultDuration: number;
}

export class FlowtiTrainTypePicker extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		types: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.picker {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.picker-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.picker-header h3 {
				margin: 0;
			}

			.picker-desc {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.type-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: var(--flowti-space-md);
			}

			.type-card {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-lg) var(--flowti-space-md);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				cursor: pointer;
				text-align: center;
				transition: background 0.1s;
			}

			.type-card:hover {
				background: var(--background-modifier-hover);
				border-color: var(--flowti-color-info);
			}

			.type-card:focus-visible {
				outline: 2px solid var(--flowti-color-info);
				outline-offset: 2px;
			}

			.type-card-icon {
				font-size: 1.5em;
				color: var(--flowti-color-muted);
			}

			.type-card-label {
				font-weight: 600;
			}

			.type-card-duration {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}
		`,
	];

	types: TypeConfig[] = [];

	private onSelect(config: TypeConfig): void {
		this.dispatchEvent(
			new CustomEvent('type-selected', {
				detail: { typeConfig: config },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="picker">
				<div class="picker-header">
					<h3>Start a new ride</h3>
				</div>
				<div class="picker-desc">
					Pick a mode \u2014 each comes with a suggested timer.
				</div>
				<div class="type-grid">
					${this.types.map((config) => html`
						<div
							class="type-card"
							tabindex="0"
							role="button"
							data-type-id=${config.id}
							@click=${() => this.onSelect(config)}
							@keydown=${(e: KeyboardEvent) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									this.onSelect(config);
								}
							}}
						>
							<div class="type-card-icon">${this.getIconChar(config.icon)}</div>
							<div class="type-card-label">${config.label}</div>
							<div class="type-card-duration">
								${config.defaultDuration > 0 ? `${config.defaultDuration} min` : 'No timer'}
							</div>
						</div>
					`)}
				</div>
			</div>
		`;
	}

	/**
	 * Map Obsidian icon names to unicode characters for Lit context.
	 * In the full Obsidian environment, the handler can replace these
	 * with setIcon calls after render.
	 */
	private getIconChar(icon: string): string {
		const iconMap: Record<string, string> = {
			'lightbulb': '\u{1F4A1}',
			'search': '\u{1F50D}',
			'scale': '\u2696',
			'pen-line': '\u{270F}',
		};
		return iconMap[icon] ?? '\u{1F3C1}';
	}
}

if (!customElements.get('flowti-train-type-picker')) customElements.define('flowti-train-type-picker', FlowtiTrainTypePicker);
