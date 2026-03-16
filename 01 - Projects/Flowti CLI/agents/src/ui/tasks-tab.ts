/**
 * Tasks tab — renders task list with status badges and suggested task assignment.
 * Pure DOM, calls apiClient.assignTask() on assignment.
 */

import type { DashboardAgent } from "../data/types.js";
import type { assignTask } from "../data/api-client.js";

export interface TaskEntry {
	readonly name: string;
	readonly status: "pending" | "in-progress" | "completed";
}

export interface TasksTabOptions {
	readonly assignTask: typeof assignTask;
	readonly baseUrl: string;
	readonly currentPhase?: string;
	readonly isAiAgent?: boolean;
	readonly onTaskAssigned?: (agentName: string, taskName: string) => void;
}

export function renderTasksTab(
	container: HTMLElement,
	agent: DashboardAgent,
	options: TasksTabOptions,
): void {
	container.innerHTML = "";

	const tasks = (agent as DashboardAgent & { tasks?: readonly TaskEntry[] }).tasks;

	if (tasks && tasks.length > 0) {
		for (const task of tasks) {
			const item = document.createElement("div");
			item.className = "agent-panel-task-item";

			const nameEl = document.createElement("span");
			nameEl.textContent = task.name;
			item.appendChild(nameEl);

			const badge = document.createElement("span");
			badge.className = "agent-panel-task-badge";
			badge.setAttribute("data-status", task.status);
			badge.textContent = task.status;
			item.appendChild(badge);

			container.appendChild(item);
		}
	} else {
		const empty = document.createElement("div");
		empty.className = "agent-panel-empty";
		empty.textContent = "No tasks assigned.";
		container.appendChild(empty);
	}

	const suggested = agent.suggestedTasks;
	if (suggested && suggested.length > 0) {
		const filtered = suggested.filter((t) => {
			if (t.phases.length === 0) return true;
			if (!options.currentPhase) return true;
			return t.phases.includes(options.currentPhase);
		});

		if (filtered.length > 0) {
			const section = document.createElement("div");
			section.className = "agent-panel-task-assign";

			const title = document.createElement("div");
			title.className = "agent-panel-task-assign-title";
			title.textContent = "Suggested Tasks";
			section.appendChild(title);

			for (const task of filtered) {
				const btn = document.createElement("button");
				btn.className = "agent-panel-assign-btn";
				btn.textContent = task.name;
				btn.setAttribute("data-task", task.name);

				btn.addEventListener("click", () => {
					if (options.isAiAgent) {
						showConfirmDialog(container, task.name, () => {
							void options.assignTask(options.baseUrl, agent.name, task.name).then(() => {
								options.onTaskAssigned?.(agent.name, task.name);
							});
						});
					} else {
						void options.assignTask(options.baseUrl, agent.name, task.name).then(() => {
							options.onTaskAssigned?.(agent.name, task.name);
						});
					}
				});

				section.appendChild(btn);
			}

			container.appendChild(section);
		}
	}
}

function showConfirmDialog(container: HTMLElement, taskName: string, onConfirm: () => void): void {
	const overlay = document.createElement("div");
	overlay.className = "agent-panel-confirm-overlay";

	const dialog = document.createElement("div");
	dialog.className = "agent-panel-confirm-dialog";

	const message = document.createElement("div");
	message.textContent = `Assign "${taskName}" to this AI agent?`;
	dialog.appendChild(message);

	const buttons = document.createElement("div");
	buttons.className = "agent-panel-confirm-buttons";

	const confirmBtn = document.createElement("button");
	confirmBtn.className = "agent-panel-assign-btn";
	confirmBtn.textContent = "Confirm";
	confirmBtn.addEventListener("click", () => {
		overlay.remove();
		onConfirm();
	});
	buttons.appendChild(confirmBtn);

	const cancelBtn = document.createElement("button");
	cancelBtn.className = "agent-panel-close";
	cancelBtn.textContent = "Cancel";
	cancelBtn.addEventListener("click", () => {
		overlay.remove();
	});
	buttons.appendChild(cancelBtn);

	dialog.appendChild(buttons);
	overlay.appendChild(dialog);

	const panel = container.closest(".agent-panel");
	if (panel) {
		panel.appendChild(overlay);
	} else {
		container.appendChild(overlay);
	}
}
