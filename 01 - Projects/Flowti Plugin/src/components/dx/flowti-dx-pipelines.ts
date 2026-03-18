import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState } from '../shared-styles.js';

interface PipelineOperation {
	id: string;
	name: string;
	status: string;
	progress: number;
	message: string;
	sourcePaths?: string[];
	noteType?: string;
}

/**
 * Data Exchange Pipelines — operation progress display.
 *
 * Shows a list of pipeline configurations with their current
 * run status, progress bars, and result messages.
 *
 * @property operations - Array of pipeline operation objects
 * @property searchText - External text filter
 *
 * @fires run-pipeline - detail: { pipelineId } when run button clicked
 * @fires select-pipeline - detail: { pipelineId } when pipeline selected
 */
export class FlowtiDxPipelines extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		operations: { type: Array },
		searchText: { type: String },
		selectedId: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		emptyState,
		css`
			.pipeline-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.pipeline-card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				cursor: pointer;
			}

			.pipeline-card:hover {
				background: var(--background-modifier-hover);
			}

			.pipeline-card--selected {
				background: var(--background-modifier-active-hover);
			}

			.pipeline-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-xs);
			}

			.pipeline-name {
				font-weight: 500;
				flex: 1;
			}

			.pipeline-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.progress-bar {
				height: 4px;
				background: var(--background-modifier-border);
				border-radius: 2px;
				overflow: hidden;
				margin-top: var(--flowti-space-xs);
			}

			.progress-bar__fill {
				height: 100%;
				background: var(--flowti-color-info);
				transition: width 0.3s ease;
			}

			.progress-bar__fill--success {
				background: var(--flowti-color-success);
			}

			.progress-bar__fill--error {
				background: var(--flowti-color-error);
			}

			.pipeline-message {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
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
		`,
	];

	operations: PipelineOperation[] = [];
	searchText = '';
	selectedId: string | null = null;

	private get filteredOperations(): PipelineOperation[] {
		if (!this.searchText) return this.operations;
		const lower = this.searchText.toLowerCase();
		return this.operations.filter((op) => op.name.toLowerCase().includes(lower));
	}

	private getStatusVariant(status: string): string {
		switch (status) {
			case 'running': return 'info';
			case 'completed': return 'success';
			case 'failed': return 'error';
			case 'idle': return 'muted';
			default: return 'muted';
		}
	}

	private dispatchRunPipeline(pipelineId: string, e: Event): void {
		e.stopPropagation();
		this.dispatchEvent(
			new CustomEvent('run-pipeline', {
				detail: { pipelineId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onSelectPipeline(pipelineId: string): void {
		this.selectedId = pipelineId;
		this.dispatchEvent(
			new CustomEvent('select-pipeline', {
				detail: { pipelineId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredOperations;

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">
						${this.operations.length === 0 ? 'No pipelines configured' : 'No pipelines match the search'}
					</div>
				</div>
			`;
		}

		return html`
			<div class="pipeline-list">
				${filtered.map((op) => this.renderPipelineCard(op))}
			</div>
		`;
	}

	private renderPipelineCard(op: PipelineOperation) {
		const variant = this.getStatusVariant(op.status);
		const isSelected = op.id === this.selectedId;
		const progressFillClass = op.status === 'completed' ? 'progress-bar__fill--success'
			: op.status === 'failed' ? 'progress-bar__fill--error'
			: '';

		return html`
			<div
				class="pipeline-card ${isSelected ? 'pipeline-card--selected' : ''}"
				@click=${() => this.onSelectPipeline(op.id)}
			>
				<div class="pipeline-header">
					<span class="status-badge status-badge--${variant}">${op.status}</span>
					<span class="pipeline-name">${op.name}</span>
					${op.status === 'idle' ? html`
						<button @click=${(e: Event) => this.dispatchRunPipeline(op.id, e)}>Run</button>
					` : nothing}
				</div>
				${op.status !== 'idle' ? html`
					<div class="progress-bar">
						<div class="progress-bar__fill ${progressFillClass}" style="width: ${op.progress}%"></div>
					</div>
				` : nothing}
				${op.message ? html`<div class="pipeline-message">${op.message}</div>` : nothing}
				${op.noteType ? html`<div class="pipeline-meta">Type: ${op.noteType}</div>` : nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-dx-pipelines')) customElements.define('flowti-dx-pipelines', FlowtiDxPipelines);
