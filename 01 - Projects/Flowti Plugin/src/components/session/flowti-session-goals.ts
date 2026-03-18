import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface GoalItem {
	id: string;
	text: string;
	completed: boolean;
}

/**
 * Goal tracking panel with checkboxes, reordering, and add input.
 *
 * @property goals - Array of goal objects
 * @property editable - Whether goals can be modified
 *
 * @fires goal-toggle - detail: { goalId: string }
 * @fires goal-add - detail: { text: string }
 * @fires goal-remove - detail: { goalId: string }
 * @fires goal-reorder - detail: { goalIds: string[] }
 */
export class FlowtiSessionGoals extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		goals: { type: Array },
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

			.goal-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
			}

			.goal-row input[type="checkbox"] {
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

	goals: GoalItem[] = [];
	editable = true;

	private onToggle(goalId: string): void {
		this.dispatchEvent(new CustomEvent('goal-toggle', {
			detail: { goalId },
			bubbles: true,
			composed: true,
		}));
	}

	private onRemove(goalId: string): void {
		this.dispatchEvent(new CustomEvent('goal-remove', {
			detail: { goalId },
			bubbles: true,
			composed: true,
		}));
	}

	private onMoveUp(index: number): void {
		if (index === 0) return;
		const ids = this.goals.map((g) => g.id);
		[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
		this.dispatchEvent(new CustomEvent('goal-reorder', {
			detail: { goalIds: ids },
			bubbles: true,
			composed: true,
		}));
	}

	private onMoveDown(index: number): void {
		if (index === this.goals.length - 1) return;
		const ids = this.goals.map((g) => g.id);
		[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
		this.dispatchEvent(new CustomEvent('goal-reorder', {
			detail: { goalIds: ids },
			bubbles: true,
			composed: true,
		}));
	}

	private onAddKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		const input = e.target as HTMLInputElement;
		const text = input.value.trim();
		if (!text) return;
		this.dispatchEvent(new CustomEvent('goal-add', {
			detail: { text },
			bubbles: true,
			composed: true,
		}));
		input.value = '';
	}

	protected renderContent() {
		const done = this.goals.filter((g) => g.completed).length;

		return html`
			<div class="section">
				<div class="header-row">
					<strong>Goals</strong>
					<span class="count">(${done}/${this.goals.length})</span>
				</div>
				${this.goals.map((goal, i) => this.renderGoalRow(goal, i))}
				<div class="add-row">
					<input
						class="add-input"
						type="text"
						placeholder="Add goal..."
						@keydown=${this.onAddKeydown}
					/>
				</div>
			</div>
		`;
	}

	private renderGoalRow(goal: GoalItem, index: number) {
		const total = this.goals.length;
		return html`
			<div class="goal-row">
				<input
					type="checkbox"
					.checked=${goal.completed}
					@change=${() => this.onToggle(goal.id)}
				/>
				<span class=${goal.completed ? 'label-completed' : 'label-active'}>
					${goal.text}
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
								@click=${() => this.onRemove(goal.id)}
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

if (!customElements.get('flowti-session-goals')) customElements.define('flowti-session-goals', FlowtiSessionGoals);
