/**
 * Tasks tab — Lit component rendering task list with status badges and
 * suggested task assignment. Shows confirmation dialog for AI agents.
 */

import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles, buttonStyles } from "./shared-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";

export interface TaskEntry {
	readonly name: string;
	readonly status: "pending" | "in-progress" | "completed";
}

type AgentWithTasks = DashboardAgent & { tasks?: readonly TaskEntry[] };

export class PanelTasks extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		buttonStyles,
		css`
			:host {
				display: block;
			}

			.task-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 6px 0;
				border-bottom: 1px solid var(--bg-secondary);
			}

			.task-name {
				font-size: 12px;
				color: var(--text-primary);
			}

			.task-badge {
				font-size: 10px;
				padding: 2px 6px;
				border-radius: 3px;
				text-transform: uppercase;
				font-weight: 600;
			}

			.task-badge[data-status="pending"] {
				background: #854d0e;
				color: #fbbf24;
			}

			.task-badge[data-status="in-progress"] {
				background: #1e3a5f;
				color: #38bdf8;
			}

			.task-badge[data-status="completed"] {
				background: #14532d;
				color: #4ade80;
			}

			.suggest-section {
				margin-top: 12px;
				padding-top: 10px;
				border-top: 1px solid var(--border);
			}

			.suggest-title {
				font-size: 11px;
				color: var(--text-secondary);
				margin-bottom: 6px;
				text-transform: uppercase;
			}

			.assign-btn {
				padding: 4px 10px;
				background: var(--btn-primary);
				color: var(--text-primary);
				border: none;
				border-radius: 4px;
				font-size: 11px;
				cursor: pointer;
				margin: 2px 4px 2px 0;
				font-family: inherit;
				transition: background 0.15s;
			}

			.assign-btn:hover {
				background: var(--btn-primary-hover);
			}

			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}

			/* Confirmation overlay — renders inside shadow DOM */
			.confirm-overlay {
				position: absolute;
				inset: 0;
				background: rgba(0, 0, 0, 0.7);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 10;
				border-radius: 8px;
			}

			.confirm-dialog {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 8px;
				padding: 20px;
				text-align: center;
				max-width: 280px;
			}

			.confirm-message {
				font-size: 13px;
				color: var(--text-primary);
				margin-bottom: 12px;
			}

			.confirm-buttons {
				display: flex;
				gap: 8px;
				justify-content: center;
			}

			.confirm-btn {
				padding: 6px 14px;
				background: var(--btn-primary);
				color: var(--text-primary);
				border: none;
				border-radius: 4px;
				font-size: 12px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.15s;
			}

			.confirm-btn:hover {
				background: var(--btn-primary-hover);
			}

			.cancel-btn {
				padding: 6px 14px;
				background: var(--bg-tertiary);
				color: var(--text-secondary);
				border: none;
				border-radius: 4px;
				font-size: 12px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.15s;
			}

			.cancel-btn:hover {
				background: var(--border);
				color: var(--text-primary);
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;
	@property({ attribute: false }) agent!: DashboardAgent;
	@property() currentPhase = "";

	@state() private pendingTask: string | null = null;

	private get isAiAgent(): boolean {
		return this.agent?.agentType === "ai";
	}

	private handleAssignClick(taskName: string): void {
		if (this.isAiAgent) {
			this.pendingTask = taskName;
		} else {
			void this.store.assignTask(this.agent.name, taskName);
		}
	}

	private handleConfirm(): void {
		if (this.pendingTask) {
			void this.store.assignTask(this.agent.name, this.pendingTask);
		}
		this.pendingTask = null;
	}

	private handleCancel(): void {
		this.pendingTask = null;
	}

	private renderTaskList() {
		const tasks = (this.agent as AgentWithTasks).tasks;

		if (!tasks || tasks.length === 0) {
			return html`<div class="empty">No tasks assigned.</div>`;
		}

		return html`
			${tasks.map((task) => html`
				<div class="task-item">
					<span class="task-name">${task.name}</span>
					<span class="task-badge" data-status="${task.status}">${task.status}</span>
				</div>
			`)}
		`;
	}

	private renderSuggestedTasks() {
		const suggested = this.agent?.suggestedTasks;
		if (!suggested || suggested.length === 0) return nothing;

		const filtered = suggested.filter((t) => {
			if (t.phases.length === 0) return true;
			if (!this.currentPhase) return true;
			return t.phases.includes(this.currentPhase);
		});

		if (filtered.length === 0) return nothing;

		return html`
			<div class="suggest-section">
				<div class="suggest-title">Suggested Tasks</div>
				${filtered.map((task) => html`
					<button
						class="assign-btn"
						data-task="${task.name}"
						@click="${() => { this.handleAssignClick(task.name); }}"
					>${task.name}</button>
				`)}
			</div>
		`;
	}

	private renderConfirmDialog() {
		if (!this.pendingTask) return nothing;

		const taskName = this.pendingTask;
		const agentName = this.agent?.name ?? "";

		return html`
			<div class="confirm-overlay">
				<div class="confirm-dialog">
					<div class="confirm-message">
						Assign "${taskName}" to ${agentName}?
					</div>
					<div class="confirm-buttons">
						<button class="confirm-btn" @click="${this.handleConfirm}">Confirm</button>
						<button class="cancel-btn" @click="${this.handleCancel}">Cancel</button>
					</div>
				</div>
			</div>
		`;
	}

	render() {
		if (!this.agent) return nothing;

		return html`
			${this.renderTaskList()}
			${this.renderSuggestedTasks()}
			${this.renderConfirmDialog()}
		`;
	}
}

if (!customElements.get("panel-tasks")) customElements.define("panel-tasks", PanelTasks);
