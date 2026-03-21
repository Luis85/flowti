/**
 * Tasks tab — Lit component rendering task list with status badges and
 * suggested task assignment. Shows confirmation dialog for AI agents.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles, buttonStyles } from "./game-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";

export interface TaskEntry {
	readonly name: string;
	readonly status: "pending" | "in-progress" | "completed" | "failed";
}

type AgentWithTasks = DashboardAgent & { tasks?: readonly TaskEntry[] };

export class PanelTasks extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agent: { attribute: false },
		currentPhase: { type: String },
		pendingTaskDef: { state: true },
		inputValue: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
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

			.confirm-btn:disabled {
				opacity: 0.5;
				cursor: default;
			}

			.task-input {
				width: 100%;
				padding: 6px 10px;
				margin-bottom: 10px;
				background: var(--bg-primary);
				border: 1px solid var(--border);
				border-radius: 4px;
				color: var(--text-primary);
				font-family: inherit;
				font-size: 12px;
				outline: none;
				box-sizing: border-box;
			}

			.task-input:focus {
				border-color: var(--accent-blue);
			}

			.task-badge[data-status="failed"] {
				background: #7f1d1d;
				color: #f87171;
			}
		`,
	];

	store!: DashboardStore;
	agent!: DashboardAgent;
	currentPhase = "";

	private pendingTaskDef: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } } | null = null;
	private inputValue = "";
	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	private get isAiAgent(): boolean {
		return this.agent?.agentType === "ai";
	}

	private handleAssignClick(task: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }): void {
		if (this.isAiAgent && !this.store.cliSessionAvailable) return;
		if (task.input) {
			this.pendingTaskDef = task;
			this.inputValue = "";
		} else if (this.isAiAgent) {
			this.pendingTaskDef = task;
			this.inputValue = "";
		} else {
			this.executeOrAssign(task);
		}
	}

	private executeOrAssign(task: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }, userInput?: string): void {
		const store = this.store as DashboardStore & { executeTask?: (agentName: string, task: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }, userInput?: string) => void };
		if (typeof store.executeTask === "function") {
			void store.executeTask(this.agent.name, task, userInput);
		} else {
			void this.store.assignTask(this.agent.name, task.name);
		}
	}

	private handleConfirm(): void {
		if (this.pendingTaskDef) {
			this.executeOrAssign(
				this.pendingTaskDef,
				this.pendingTaskDef.input ? this.inputValue : undefined,
			);
		}
		this.pendingTaskDef = null;
		this.inputValue = "";
	}

	private handleCancel(): void {
		this.pendingTaskDef = null;
		this.inputValue = "";
	}

	private renderTaskList() {
		// Combine static tasks from agent data with locally tracked assignments
		const staticTasks = (this.agent as AgentWithTasks).tasks ?? [];
		const localTasks = this.store.assignedTasks.get(this.agent?.name ?? "") ?? [];
		const allTasks = [
			...staticTasks.map((t) => ({ name: t.name, status: t.status })),
			...localTasks.map((t) => ({ name: t.name, status: t.status })),
		];

		if (allTasks.length === 0) {
			return html`<div class="empty">No tasks assigned.</div>`;
		}

		return html`
			${allTasks.map((task) => html`
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

		const aiNeedsCli = this.isAiAgent && !this.store.cliSessionAvailable;
		const blockTitle = this.store.cliSessionBlockedReason || "CLI host is not ready.";

		const filtered = suggested.filter((t) => {
			if (t.phases.length === 0) return true;
			if (!this.currentPhase) return true;
			return t.phases.includes(this.currentPhase);
		});

		if (filtered.length === 0) return nothing;

		return html`
			<div class="suggest-section">
				<div class="suggest-title">Suggested Tasks</div>
				${aiNeedsCli
					? html`<div class="empty" style="margin-bottom:8px">AI tasks need a CLI host (Node + Flowti bundle). ${blockTitle}</div>`
					: nothing}
				${filtered.map((task) => html`
					<button
						class="assign-btn"
						data-task="${task.name}"
						?disabled="${aiNeedsCli}"
						title="${aiNeedsCli ? blockTitle : task.name}"
						@click="${() => { this.handleAssignClick(task); }}"
					>${task.name}</button>
				`)}
			</div>
		`;
	}

	private renderConfirmDialog() {
		if (!this.pendingTaskDef) return nothing;

		const task = this.pendingTaskDef;
		const agentName = this.agent?.name ?? "";
		const hasInput = !!task.input;

		return html`
			<div class="confirm-overlay">
				<div class="confirm-dialog">
					<div class="confirm-message">
						${hasInput
							? task.input!.prompt
							: html`Assign "${task.name}" to ${agentName}?`}
					</div>
					${hasInput ? html`
						<input
							class="task-input"
							type="text"
							.value="${this.inputValue}"
							@input="${(e: Event) => { this.inputValue = (e.target as HTMLInputElement).value; }}"
							@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter" && this.inputValue.trim()) this.handleConfirm(); }}"
							placeholder="Type your answer..."
						/>
					` : nothing}
					<div class="confirm-buttons">
						<button class="confirm-btn" @click="${this.handleConfirm}" ?disabled="${hasInput && !this.inputValue.trim()}">
							${hasInput ? "Send" : "Confirm"}
						</button>
						<button class="cancel-btn" @click="${this.handleCancel}">Cancel</button>
					</div>
				</div>
			</div>
		`;
	}

	protected renderContent() {
		if (!this.agent) return html``;

		return html`
			${this.renderTaskList()}
			${this.renderSuggestedTasks()}
			${this.renderConfirmDialog()}
		`;
	}
}

if (!customElements.get("ft-game-panel-tasks")) customElements.define("ft-game-panel-tasks", PanelTasks);
