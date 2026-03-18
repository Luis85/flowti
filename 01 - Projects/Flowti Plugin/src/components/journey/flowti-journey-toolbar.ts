import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Journey builder top toolbar with action buttons.
 *
 * Displays: journey title, save, export, run, preview, open canvas,
 * and view-in-hub buttons. Buttons are conditionally shown based on
 * whether a journey name exists and whether steps are present.
 *
 * @property journeyName - Current journey name (empty = not yet configured)
 * @property stepCount - Number of steps (controls run/preview visibility)
 * @property canvasSyncing - Whether canvas sync is in progress
 *
 * @fires toolbar-export - Export journey definition
 * @fires toolbar-run - Run the journey
 * @fires toolbar-preview - Preview run (dry-run validation)
 * @fires toolbar-open-canvas - Open the canvas file
 * @fires toolbar-view-hub - Navigate to test management hub
 * @fires toolbar-back - Return to previous view (setup/welcome)
 */
export class FlowtiJourneyToolbar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		journeyName: { type: String, attribute: 'journey-name' },
		stepCount: { type: Number, attribute: 'step-count' },
		canvasSyncing: { type: Boolean, attribute: 'canvas-syncing' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.toolbar {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm) 0;
				border-bottom: 1px solid var(--flowti-border);
				flex-wrap: wrap;
			}

			.toolbar-title {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				font-weight: 600;
				flex: 1;
				min-width: 0;
			}

			.toolbar-title__text {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.toolbar-actions {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.toolbar-btn {
				cursor: pointer;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
				white-space: nowrap;
			}

			.toolbar-btn:hover {
				background: var(--background-modifier-hover);
			}

			.toolbar-btn--primary {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
			}

			.toolbar-btn--back {
				border: none;
				background: none;
				color: var(--flowti-color-muted);
				padding: var(--flowti-space-xs);
			}

			.toolbar-btn--back:hover {
				color: var(--text-normal);
			}

			.sync-indicator {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--flowti-color-muted);
				flex-shrink: 0;
			}

			.sync-indicator--syncing {
				background: var(--flowti-color-warning);
				animation: pulse 1s infinite;
			}

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.4; }
			}
		`,
	];

	journeyName = '';
	stepCount = 0;
	canvasSyncing = false;

	private dispatch(name: string): void {
		this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
	}

	protected renderContent() {
		return html`
			<div class="toolbar">
				<div class="toolbar-title">
					<button
						class="toolbar-btn toolbar-btn--back"
						aria-label="Back"
						@click=${() => this.dispatch('toolbar-back')}
					>&#x2190;</button>
					<span class="toolbar-title__text">
						${this.journeyName || 'Journey builder'}
					</span>
					${this.canvasSyncing ? html`
						<span class="sync-indicator sync-indicator--syncing" aria-label="Syncing canvas" aria-busy="true"></span>
					` : nothing}
				</div>
				<div class="toolbar-actions">
					${this.journeyName ? html`
						<button
							class="toolbar-btn"
							aria-label="Open canvas"
							@click=${() => this.dispatch('toolbar-open-canvas')}
						>Canvas</button>
					` : nothing}
					${this.stepCount > 0 ? html`
						<button
							class="toolbar-btn"
							aria-label="Preview run"
							@click=${() => this.dispatch('toolbar-preview')}
						>Preview</button>
					` : nothing}
					<button
						class="toolbar-btn"
						aria-label="Export"
						@click=${() => this.dispatch('toolbar-export')}
					>Export</button>
					${this.stepCount > 0 ? html`
						<button
							class="toolbar-btn toolbar-btn--primary"
							aria-label="Run journey"
							@click=${() => this.dispatch('toolbar-run')}
						>Run</button>
					` : nothing}
					<button
						class="toolbar-btn"
						aria-label="View in test hub"
						@click=${() => this.dispatch('toolbar-view-hub')}
					>Hub</button>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-journey-toolbar')) customElements.define('flowti-journey-toolbar', FlowtiJourneyToolbar);
