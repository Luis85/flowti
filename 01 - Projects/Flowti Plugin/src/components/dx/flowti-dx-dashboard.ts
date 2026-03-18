import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statCardGrid, statusBadge, emptyState } from '../shared-styles.js';

interface ActiveOperation {
	operationId: string;
	type: string;
	name: string;
	status?: string;
	progress?: { current: number; total: number } | null;
	completed?: boolean;
	success?: boolean;
	message?: string;
}

/**
 * Data Exchange Dashboard — overview of active operations.
 *
 * Displays stat cards (total ops, running, completed, failed)
 * and a list of currently active operations with progress.
 *
 * @property activeOps - Array of active operation objects
 *
 * @fires open-pipelines - When "View all pipelines" is clicked
 */
export class FlowtiDxDashboard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		activeOps: { type: Array },
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

			.op-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.op-card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
			}

			.op-name {
				font-weight: 500;
				flex: 1;
			}

			.op-type {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.op-message {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.progress-bar {
				height: 4px;
				background: var(--background-modifier-border);
				border-radius: 2px;
				overflow: hidden;
				width: 120px;
			}

			.progress-bar__fill {
				height: 100%;
				background: var(--flowti-color-info);
				transition: width 0.3s ease;
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

			.empty-state__hint {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
				margin-bottom: var(--flowti-space-sm);
			}
		`,
	];

	activeOps: ActiveOperation[] = [];

	private get runningCount(): number {
		return this.activeOps.filter((op) => !op.completed).length;
	}

	private get completedCount(): number {
		return this.activeOps.filter((op) => op.completed && op.success).length;
	}

	private get failedCount(): number {
		return this.activeOps.filter((op) => op.completed && !op.success).length;
	}

	private dispatchOpenPipelines(): void {
		this.dispatchEvent(
			new CustomEvent('open-pipelines', {
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="dashboard">
				${this.renderStatGrid()}
				${this.renderActiveOps()}
			</div>
		`;
	}

	private renderStatGrid() {
		return html`
			<div class="stat-grid">
				<div class="stat-card">
					<div class="stat-card__value">${this.activeOps.length}</div>
					<div class="stat-card__label">Total Operations</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.runningCount}</div>
					<div class="stat-card__label">Running</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.completedCount}</div>
					<div class="stat-card__label">Completed</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.failedCount}</div>
					<div class="stat-card__label">Failed</div>
				</div>
			</div>
		`;
	}

	private renderActiveOps() {
		if (this.activeOps.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No operations running</div>
					<div class="empty-state__hint">
						Operations appear here when imports, exports, or pipelines are executing.
					</div>
					<button @click=${this.dispatchOpenPipelines}>View all pipelines</button>
				</div>
			`;
		}

		return html`
			<div class="op-list">
				${this.activeOps.map((op) => this.renderOpCard(op))}
			</div>
		`;
	}

	private renderOpCard(op: ActiveOperation) {
		const variant = op.completed
			? op.success ? 'success' : 'error'
			: 'info';
		const progressPct = op.progress && op.progress.total > 0
			? Math.round((op.progress.current / op.progress.total) * 100)
			: 0;

		return html`
			<div class="op-card">
				<span class="status-badge status-badge--${variant}">${op.type}</span>
				<span class="op-name">${op.name}</span>
				${!op.completed && op.progress ? html`
					<div class="progress-bar">
						<div class="progress-bar__fill" style="width: ${progressPct}%"></div>
					</div>
				` : nothing}
				${op.message ? html`<span class="op-message">${op.message}</span>` : nothing}
			</div>
		`;
	}
}

customElements.define('flowti-dx-dashboard', FlowtiDxDashboard);
