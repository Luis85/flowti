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
		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

		const labelRow = headerRow.createDiv();
		labelRow.style.cssText = "display:flex;align-items:center;gap:8px;";
		labelRow.createEl("strong", { text: "Execution Plan" });
		this.countEl = labelRow.createEl("span", {
			text: this.formatCount(tasks),
			cls: "ft-text-muted ft-text-sm",
		});
		this.countEl.style.cssText = "color:var(--text-muted);font-size:12px;";

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
		barContainer.style.cssText = "margin-bottom:8px;";

		const barRow = barContainer.createDiv();
		barRow.style.cssText = "display:flex;align-items:center;gap:8px;";

		const barTrack = barRow.createDiv({ cls: "ft-task-progress-track" });
		barTrack.style.cssText = "flex:1;height:6px;background:var(--background-modifier-border);border-radius:3px;overflow:hidden;";

		this.progressBarFill = barTrack.createDiv({ cls: "ft-task-progress-fill" });
		this.progressBarFill.style.cssText = `height:100%;background:var(--interactive-accent);border-radius:3px;transition:width 0.2s ease;width:${progress.percent}%;`;

		this.progressLabel = barRow.createEl("span", {
			text: `${progress.completed}/${progress.total} (${progress.percent}%)`,
			cls: "ft-text-muted ft-text-sm",
		});
		this.progressLabel.style.cssText = "color:var(--text-muted);font-size:11px;white-space:nowrap;";
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

		const row = this.listEl!.createDiv({ cls: "ft-task-row" });
		row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0;";

		// Checkbox
		const checkbox = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
		checkbox.checked = task.completed;
		checkbox.addEventListener("change", () => {
			void this.deps.eventBus.emit("session.task.toggle", { sessionId: session.id, taskId: task.id });
		});

		// Label
		const textEl = row.createEl("span", { text: task.label });
		textEl.style.cssText = "flex:1;" + (task.completed ? "text-decoration:line-through;opacity:0.6;" : "");

		if (isEditable) {
			// Reorder + remove buttons (single row)
			const actionGroup = row.createDiv({ cls: "ft-task-actions" });
			actionGroup.style.cssText = "display:flex;align-items:center;gap:2px;";

			const upBtn = actionGroup.createEl("button", { cls: "ft-task-move-up" });
			upBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:0 2px;opacity:0.4;color:var(--text-muted);font-size:10px;line-height:1;";
			setIcon(upBtn, "chevron-up");
			if (index === 0) { upBtn.disabled = true; upBtn.style.opacity = "0.15"; }
			upBtn.addEventListener("click", () => {
				if (index === 0) return;
				const sorted = [...session.executionTasks].sort((a, b) => a.order - b.order);
				const ids = sorted.map((t) => t.id);
				[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
				void this.deps.eventBus.emit("session.task.reorder", { sessionId: session.id, taskIds: ids });
			});

			const downBtn = actionGroup.createEl("button", { cls: "ft-task-move-down" });
			downBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:0 2px;opacity:0.4;color:var(--text-muted);font-size:10px;line-height:1;";
			setIcon(downBtn, "chevron-down");
			if (index === total - 1) { downBtn.disabled = true; downBtn.style.opacity = "0.15"; }
			downBtn.addEventListener("click", () => {
				if (index === total - 1) return;
				const sorted = [...session.executionTasks].sort((a, b) => a.order - b.order);
				const ids = sorted.map((t) => t.id);
				[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
				void this.deps.eventBus.emit("session.task.reorder", { sessionId: session.id, taskIds: ids });
			});

			const removeBtn = actionGroup.createEl("button", { cls: "ft-task-remove" });
			removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.task.remove", { sessionId: session.id, taskId: task.id });
			});
		}
	}

	private renderAddInput(section: HTMLElement): void {
		const session = this.deps.getSession();
		const addRow = section.createDiv();
		addRow.style.cssText = "display:flex;gap:8px;margin-top:8px;";

		const input = addRow.createEl("input", { type: "text" });
		input.placeholder = "Add task...";
		input.style.cssText = "flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";

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
