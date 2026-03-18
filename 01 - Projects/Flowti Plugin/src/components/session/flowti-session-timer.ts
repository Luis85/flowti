import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Timer display for a session workspace.
 *
 * Shows countdown timer, and for "prepared" sessions an editable duration input.
 * The handler calls `updateDisplay()` on every tick.
 *
 * @property remainingMs - Remaining milliseconds to display
 * @property durationMinutes - Current duration in minutes (for edit mode)
 * @property sessionStatus - Current session status
 *
 * @fires duration-change - detail: { durationMinutes: number }
 */
export class FlowtiSessionTimer extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		remainingMs: { type: Number, attribute: 'remaining-ms' },
		durationMinutes: { type: Number, attribute: 'duration-minutes' },
		sessionStatus: { type: String, attribute: 'session-status' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.timer-section {
				padding: var(--flowti-space-md);
			}

			.timer-display {
				font-size: 2em;
				font-weight: 700;
				font-variant-numeric: tabular-nums;
				text-align: center;
			}

			.timer-remaining-label {
				text-align: center;
				margin-top: var(--flowti-space-xs);
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.duration-edit {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				justify-content: center;
				margin-top: var(--flowti-space-sm);
			}

			.duration-input {
				width: 80px;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				text-align: center;
			}

			.duration-label {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	remainingMs = 0;
	durationMinutes = 0;
	sessionStatus = '';

	private onDurationChange(e: Event): void {
		const value = parseInt((e.target as HTMLInputElement).value, 10);
		if (value >= 1) {
			this.dispatchEvent(new CustomEvent('duration-change', {
				detail: { durationMinutes: value },
				bubbles: true,
				composed: true,
			}));
		}
	}

	protected renderContent() {
		return html`
			<div class="timer-section">
				<div class="timer-display">${this.formatDuration(this.remainingMs)}</div>
				${this.sessionStatus === 'prepared'
					? html`
						<div class="duration-edit">
							<input
								class="duration-input"
								type="number"
								min="1"
								.value=${String(this.durationMinutes)}
								@change=${this.onDurationChange}
							/>
							<span class="duration-label">Minutes</span>
						</div>
					`
					: html`<div class="timer-remaining-label">Time Remaining</div>`
				}
			</div>
		`;
	}

	private formatDuration(ms: number): string {
		const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		const pad = (n: number) => String(n).padStart(2, '0');
		return hours > 0
			? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
			: `${pad(minutes)}:${pad(seconds)}`;
	}
}

if (!customElements.get('flowti-session-timer')) customElements.define('flowti-session-timer', FlowtiSessionTimer);
