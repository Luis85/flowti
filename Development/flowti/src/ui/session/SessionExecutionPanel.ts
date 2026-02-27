import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { ExecutionTask } from "../../domain/session/types";
import { getTaskProgress } from "../../domain/session/helpers";

export class SessionExecutionPanel {
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private progressBarFill: HTMLElement | null = null;
	private progressLabel: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const tasks = session.executionTasks;
		const section = this.container.createDiv({ cls: "ft-session-workspace-tasks ft-section" });

		// Header row with label + count
		const headerRow = section.createDiv({ cls: "ft-panel-header-row" });

		const labelRow = headerRow.createDiv({ cls: "ft-panel-label-row" });
		labelRow.createEl("strong", { text: "Execution plan" });
		this.countEl = labelRow.createEl("span", {
			text: this.formatCount(tasks),
			cls: "ft-text-muted ft-text-sm ft-panel-count",
		});

		// Progress bar
		if (tasks.length > 0) {
			this.renderProgressBar(section, tasks);
		}

		// Task list
		this.listEl = section.createDiv({ cls: "ft-tasks-list" });
		this.renderTaskList();

		// Add task input (only for editable states)
		if (session.status !== "completed" && session.status !== "archived") {
			this.renderAddInput(section);
		}
	}

	refreshTasks(): void {
		this.renderTaskList();
		this.updateProgress();
	}

	private updateProgress(): void {
		const session = this.deps.getSession();
		const tasks = session.executionTasks;
		const progress = getTaskProgress(tasks);

		if (this.countEl) {
			this.countEl.textContent = this.formatCount(tasks);
		}
		if (this.progressBarFill) {
			this.progressBarFill.style.width = `${progress.percent}%`;
		}
		if (this.progressLabel) {
			this.progressLabel.textContent = `${progress.completed}/${progress.total} (${progress.percent}%)`;
		}
	}

	private renderProgressBar(section: HTMLElement, tasks: ExecutionTask[]): void {
		const progress = getTaskProgress(tasks);

		const barContainer = section.createDiv({ cls: "ft-task-progress" });

		const barRow = barContainer.createDiv({ cls: "ft-task-progress-row" });

		const barTrack = barRow.createDiv({ cls: "ft-task-progress-track" });

		this.progressBarFill = barTrack.createDiv({ cls: "ft-task-progress-fill" });
		this.progressBarFill.style.width = `${progress.percent}%`;

		this.progressLabel = barRow.createEl("span", {
			text: `${progress.completed}/${progress.total} (${progress.percent}%)`,
			cls: "ft-text-muted ft-text-sm ft-task-progress-label",
		});
	}

	private renderTaskList(): void {
		const session = this.deps.getSession();
		if (!this.listEl) return;
		this.listEl.empty();

		const sorted = [...session.executionTasks].sort((a, b) => a.order - b.order);
		for (let i = 0; i < sorted.length; i++) {
			this.renderTaskRow(sorted[i], i, sorted.length);
		}
	}

	private renderTaskRow(task: ExecutionTask, index: number, total: number): void {
		const session = this.deps.getSession();
		const isEditable = session.status !== "completed" && session.status !== "archived";

		const row = this.listEl!.createDiv({ cls: "ft-task-row ft-item-row" });

		// Checkbox
		const checkbox = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
		checkbox.checked = task.completed;
		checkbox.addEventListener("change", () => {
			void this.deps.eventBus.emit("session.task.toggle", { sessionId: session.id, taskId: task.id });
		});

		// Label
		row.createEl("span", {
			text: task.label,
			cls: task.completed ? "ft-item-label-completed" : "ft-item-label-active",
		});

		if (isEditable) {
			// Reorder + remove buttons (single row)
			const actionGroup = row.createDiv({ cls: "ft-task-actions ft-item-action-group" });

			const upBtn = actionGroup.createEl("button", { cls: "ft-task-move-up ft-item-move-btn" });
			setIcon(upBtn, "chevron-up");
			if (index === 0) { upBtn.disabled = true; }
			upBtn.addEventListener("click", () => {
				if (index === 0) return;
				const sorted = [...session.executionTasks].sort((a, b) => a.order - b.order);
				const ids = sorted.map((t) => t.id);
				[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
				void this.deps.eventBus.emit("session.task.reorder", { sessionId: session.id, taskIds: ids });
			});

			const downBtn = actionGroup.createEl("button", { cls: "ft-task-move-down ft-item-move-btn" });
			setIcon(downBtn, "chevron-down");
			if (index === total - 1) { downBtn.disabled = true; }
			downBtn.addEventListener("click", () => {
				if (index === total - 1) return;
				const sorted = [...session.executionTasks].sort((a, b) => a.order - b.order);
				const ids = sorted.map((t) => t.id);
				[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
				void this.deps.eventBus.emit("session.task.reorder", { sessionId: session.id, taskIds: ids });
			});

			const removeBtn = actionGroup.createEl("button", { cls: "ft-task-remove ft-item-remove-btn" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.task.remove", { sessionId: session.id, taskId: task.id });
			});
		}
	}

	private renderAddInput(section: HTMLElement): void {
		const session = this.deps.getSession();
		const addRow = section.createDiv({ cls: "ft-panel-add-row" });

		const input = addRow.createEl("input", { type: "text", cls: "ft-panel-input" });
		input.placeholder = "Add task...";

		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				void this.deps.eventBus.emit("session.task.add", { sessionId: session.id, label: input.value.trim() });
				input.value = "";
			}
		});
	}

	private formatCount(tasks: ExecutionTask[]): string {
		const progress = getTaskProgress(tasks);
		return `(${progress.completed}/${progress.total})`;
	}
}
