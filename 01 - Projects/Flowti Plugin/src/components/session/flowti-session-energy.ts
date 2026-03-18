import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

const ENERGY_LABELS: Record<number, string> = {
	1: 'Drained',
	2: 'Low',
	3: 'Moderate',
	4: 'Good',
	5: 'Energized',
};

/**
 * Clickable 1-5 energy level indicator for the session workspace.
 *
 * @property energyLevel - Current energy level (1-5) or 0 if not set
 * @property editable - Whether the dots are clickable
 *
 * @fires energy-change - detail: { level: number }
 */
export class FlowtiSessionEnergy extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		energyLevel: { type: Number, attribute: 'energy-level' },
		editable: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.energy-section {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.energy-heading {
				font-weight: 600;
			}

			.energy-indicator {
				display: flex;
				gap: var(--flowti-space-xs);
			}

			.energy-dot {
				font-size: 1.2em;
				opacity: 0.3;
				cursor: default;
				user-select: none;
			}

			.energy-dot--active {
				opacity: 1;
			}

			.energy-dot--editable {
				cursor: pointer;
			}

			.energy-dot--editable:hover {
				transform: scale(1.2);
			}

			.energy-label {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	energyLevel = 0;
	editable = false;

	private onDotClick(level: number): void {
		if (!this.editable) return;
		this.dispatchEvent(new CustomEvent('energy-change', {
			detail: { level },
			bubbles: true,
			composed: true,
		}));
	}

	protected renderContent() {
		const labelText = this.energyLevel > 0
			? `${ENERGY_LABELS[this.energyLevel]} (${this.energyLevel}/5)`
			: 'Not set';

		return html`
			<div class="energy-section">
				<strong class="energy-heading">Energy</strong>
				<div class="energy-indicator">
					${[1, 2, 3, 4, 5].map((level) => {
						const isActive = level <= this.energyLevel;
						const classes = [
							'energy-dot',
							isActive ? 'energy-dot--active' : '',
							this.editable ? 'energy-dot--editable' : '',
						].filter(Boolean).join(' ');
						return html`
							<span
								class=${classes}
								title="${ENERGY_LABELS[level]} (${level}/5)"
								@click=${() => this.onDotClick(level)}
							>\u26A1</span>
						`;
					})}
				</div>
				<span class="energy-label">${labelText}</span>
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-energy')) customElements.define('flowti-session-energy', FlowtiSessionEnergy);
