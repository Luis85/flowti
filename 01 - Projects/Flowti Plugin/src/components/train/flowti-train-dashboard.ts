import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statCardGrid, statusBadge, emptyState } from '../shared-styles.js';

interface TrainSummary {
	id: string;
	title: string;
	status: string;
	thoughts: unknown[];
}

/**
 * Train Hub Dashboard — top-level overview of all trains.
 *
 * Displays stat cards (total, active, completed, total thoughts),
 * a "Currently Running" callout, a "Paused" callout, or a
 * "Start a Ride" prompt when idle.
 *
 * @property trains - Array of all train objects
 * @property activeTrain - The currently running train (or null)
 * @property pausedTrain - A paused train (or null)
 *
 * @fires start-train - When "Start a ride" button is clicked
 * @fires open-train - detail: { trainId } when active/paused train callout is clicked
 * @fires navigate-to-tab - detail: { tabId } when a stat card is clicked
 */
export class FlowtiTrainDashboard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		trains: { type: Array },
		activeTrain: { type: Object },
		pausedTrain: { type: Object },
	};

	static styles = [
		...FlowtiElement.styles,
		statCardGrid,
		statusBadge,
		emptyState,
		css`
			.dashboard {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-lg);
			}

			.callout {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
			}

			.callout-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
				font-weight: 600;
			}

			.callout-body {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
			}

			.callout-title {
				font-weight: 500;
			}

			.callout-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.callout-actions {
				margin-left: auto;
			}

			.running-label {
				color: var(--flowti-color-success);
			}

			.paused-label {
				color: var(--flowti-color-warning);
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}

			.btn-primary {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
			}

			.stat-card--clickable {
				cursor: pointer;
			}

			.stat-card--clickable:hover {
				background: var(--background-modifier-hover);
			}

			.callout-clickable {
				cursor: pointer;
			}

			.callout-clickable:hover {
				background: var(--background-modifier-hover);
			}
		`,
	];

	trains: TrainSummary[] = [];
	activeTrain: TrainSummary | null = null;
	pausedTrain: TrainSummary | null = null;

	private get activeCount(): number {
		return this.trains.filter((t) => t.status === 'running' || t.status === 'paused').length;
	}

	private get completedCount(): number {
		return this.trains.filter((t) => t.status === 'completed').length;
	}

	private get totalThoughts(): number {
		return this.trains.reduce((sum, t) => sum + t.thoughts.length, 0);
	}

	private dispatchStartTrain(): void {
		this.dispatchEvent(
			new CustomEvent('start-train', {
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchOpenTrain(trainId: string): void {
		this.dispatchEvent(
			new CustomEvent('open-train', {
				detail: { trainId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchNavigateToTab(tabId: string): void {
		this.dispatchEvent(
			new CustomEvent('navigate-to-tab', {
				detail: { tabId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="dashboard">
				${this.renderStatGrid()}
				${this.renderRunningCallout()}
				${this.renderPausedCallout()}
				${this.renderStartCallout()}
			</div>
		`;
	}

	private renderStatGrid() {
		return html`
			<div class="stat-grid">
				<div class="stat-card stat-card--clickable" @click=${() => this.dispatchNavigateToTab('active')}>
					<div class="stat-card__value">${this.trains.length}</div>
					<div class="stat-card__label">Total Trains</div>
				</div>
				<div class="stat-card stat-card--clickable" @click=${() => this.dispatchNavigateToTab('active')}>
					<div class="stat-card__value">${this.activeCount}</div>
					<div class="stat-card__label">Active</div>
				</div>
				<div class="stat-card stat-card--clickable" @click=${() => this.dispatchNavigateToTab('history')}>
					<div class="stat-card__value">${this.completedCount}</div>
					<div class="stat-card__label">Completed</div>
				</div>
				<div class="stat-card stat-card--clickable" @click=${() => this.dispatchNavigateToTab('active')}>
					<div class="stat-card__value">${this.totalThoughts}</div>
					<div class="stat-card__label">Total Thoughts</div>
				</div>
			</div>
		`;
	}

	private renderRunningCallout() {
		if (!this.activeTrain) return nothing;

		return html`
			<div class="callout running-callout callout-clickable" @click=${() => this.dispatchOpenTrain(this.activeTrain!.id)}>
				<div class="callout-header">
					<span class="running-label">Currently Running</span>
				</div>
				<div class="callout-body">
					<span class="callout-title">${this.activeTrain.title}</span>
					<span class="callout-meta">${this.activeTrain.thoughts.length} thoughts</span>
				</div>
			</div>
		`;
	}

	private renderPausedCallout() {
		if (this.activeTrain || !this.pausedTrain) return nothing;

		return html`
			<div class="callout paused-callout callout-clickable" @click=${() => this.dispatchOpenTrain(this.pausedTrain!.id)}>
				<div class="callout-header">
					<span class="paused-label">Paused</span>
				</div>
				<div class="callout-body">
					<span class="callout-title">${this.pausedTrain.title}</span>
					<span class="callout-meta">${this.pausedTrain.thoughts.length} thoughts</span>
					<span class="callout-actions">
						<button class="btn-primary" @click=${(e: Event) => { e.stopPropagation(); this.dispatchStartTrain(); }}>Resume</button>
					</span>
				</div>
			</div>
		`;
	}

	private renderStartCallout() {
		if (this.activeTrain || this.pausedTrain) return nothing;

		return html`
			<div class="callout start-callout">
				<div class="callout-header">
					<span>Ready for a new ride?</span>
				</div>
				<div class="callout-body">
					<span class="callout-meta">Capture a stream of connected thoughts.</span>
					<span class="callout-actions">
						<button class="btn-primary" @click=${this.dispatchStartTrain}>Start a ride</button>
					</span>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-train-dashboard')) customElements.define('flowti-train-dashboard', FlowtiTrainDashboard);
