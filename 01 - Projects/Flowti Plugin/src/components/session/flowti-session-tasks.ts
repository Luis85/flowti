import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface TaskItem {
	id: string;
	label: string;
	completed: boolean;
	order: number;
}

/**
 * Execution plan panel with progress bar, task checkboxes, reordering, and add input.
 *
 * @property tasks - Array of execution task objects
 * @property editable - Whether tasks can be modified
 *
 * @fires task-toggle - detail: { taskId: string }
 * @fires task-add - detail: { label: string }
 * @fires task-remove - detail: { taskId: string }
 * @fires task-reorder - detail: { taskIds: string[] }
 */
export class FlowtiSessionTasks extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		tasks: { type: Array },
		editable: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.section {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.header-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.count {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.progress {
				margin-bottom: var(--flowti-space-sm);
			}

			.progress-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.progress-track {
				flex: 1;
				height: 6px;
				background: var(--background-modifier-border);
				border-radius: 3px;
				overflow: hidden;
			}

			.progress-fill {
				height: 100%;
				background: var(--flowti-color-success);
				border-radius: 3px;
				transition: width 0.3s ease;
			}

			.progress-label {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
				white-space: nowrap;
			}

			.task-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
			}

			.task-row input[type="checkbox"] {
				flex-shrink: 0;
			}

			.label-completed {
				text-decoration: line-through;
				opacity: 0.6;
			}

			.label-active {
				flex: 1;
			}

			.action-group {
				display: flex;
				gap: 2px;
				margin-left: auto;
			}

			.move-btn, .remove-btn {
				padding: 2px 4px;
				border: none;
				background: none;
				color: var(--flowti-color-muted);
				cursor: pointer;
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
			}

			.move-btn:hover, .remove-btn:hover {
				background: var(--background-modifier-hover);
				color: var(--text-normal);
			}

			.move-btn:disabled {
				opacity: 0.3;
				cursor: default;
			}

			.remove-btn:hover {
				color: var(--flowti-color-error);
			}

			.add-row {
				margin-top: var(--flowti-space-sm);
			}

			.add-input {
				width: 100%;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
			}
		`,
	];

	tasks: TaskItem[] = [];
	editable = true;

	private get sortedTasks(): TaskItem[] {
		return [...this.tasks].sort((a, b) => a.order - b.order);
	}

	private get progress() {
		const total = this.tasks.length;
		const completed = this.tasks.filter((t) => t.completed).length;
		const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
		return { completed, total, percent };
	}

	private onToggle(taskId: string): void {
		this.dispatchEvent(new CustomEvent('task-toggle', {
			detail: { taskId },
			bubbles: true,
			composed: true,
		}));
	}

	private onRemove(taskId: string): void {
		this.dispatchEvent(new CustomEvent('task-remove', {
			detail: { taskId },
			bubbles: true,
			composed: true,
		}));
	}

	private onMoveUp(index: number): void {
		if (index === 0) return;
		const sorted = this.sortedTasks;
		const ids = sorted.map((t) => t.id);
		[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
		this.dispatchEvent(new CustomEvent('task-reorder', {
			detail: { taskIds: ids },
			bubbles: true,
			composed: true,
		}));
	}

	private onMoveDown(index: number): void {
		const sorted = this.sortedTasks;
		if (index === sorted.length - 1) return;
		const ids = sorted.map((t) => t.id);
		[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
		this.dispatchEvent(new CustomEvent('task-reorder', {
			detail: { taskIds: ids },
			bubbles: true,
			composed: true,
		}));
	}

	private onAddKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		const input = e.target as HTMLInputElement;
		const label = input.value.trim();
		if (!label) return;
		this.dispatchEvent(new CustomEvent('task-add', {
			detail: { label },
			bubbles: true,
			composed: true,
		}));
		input.value = '';
	}

	protected renderContent() {
		const { completed, total, percent } = this.progress;
		const sorted = this.sortedTasks;

		return html`
			<div class="section">
				<div class="header-row">
					<strong>Execution plan</strong>
					<span class="count">(${completed}/${total})</span>
				</div>
				${total > 0 ? html`
					<div class="progress">
						<div class="progress-row">
							<div class="progress-track">
								<div class="progress-fill" style="width: ${percent}%"></div>
							</div>
							<span class="progress-label">${completed}/${total} (${percent}%)</span>
						</div>
					</div>
				` : nothing}
				${sorted.map((task, i) => this.renderTaskRow(task, i, sorted.length))}
				${this.editable ? html`
					<div class="add-row">
						<input
							class="add-input"
							type="text"
							placeholder="Add task..."
							@keydown=${this.onAddKeydown}
						/>
					</div>
				` : nothing}
			</div>
		`;
	}

	private renderTaskRow(task: TaskItem, index: number, total: number) {
		return html`
			<div class="task-row">
				<input
					type="checkbox"
					.checked=${task.completed}
					@change=${() => this.onToggle(task.id)}
				/>
				<span class=${task.completed ? 'label-completed' : 'label-active'}>
					${task.label}
				</span>
				${this.editable
					? html`
						<div class="action-group">
							<button
								class="move-btn"
								?disabled=${index === 0}
								@click=${() => this.onMoveUp(index)}
								title="Move up"
							>\u25B2</button>
							<button
								class="move-btn"
								?disabled=${index === total - 1}
								@click=${() => this.onMoveDown(index)}
								title="Move down"
							>\u25BC</button>
							<button
								class="remove-btn"
								@click=${() => this.onRemove(task.id)}
								title="Remove"
							>\u00D7</button>
						</div>
					`
					: nothing
				}
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-tasks')) customElements.define('flowti-session-tasks', FlowtiSessionTasks);
