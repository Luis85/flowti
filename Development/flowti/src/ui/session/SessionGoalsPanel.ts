import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { SessionGoal } from "../../domain/session/types";

export class SessionGoalsPanel {
	private goalsEl: HTMLElement | null = null;
	private goalCountEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-goals ft-section" });

		const headerRow = section.createDiv({ cls: "ft-panel-header-row" });

		const labelRow = headerRow.createDiv({ cls: "ft-panel-label-row" });
		labelRow.createEl("strong", { text: "Goals" });
		this.goalCountEl = labelRow.createEl("span", {
			text: this.formatGoalCount(session.goals),
			cls: "ft-text-muted ft-text-sm ft-panel-count",
		});

		this.goalsEl = section.createDiv({ cls: "ft-goals-list" });
		this.renderGoalsList();

		// Add goal input
		const addRow = section.createDiv({ cls: "ft-panel-add-row" });
		const input = addRow.createEl("input", { type: "text", cls: "ft-panel-input" });
		input.placeholder = "Add goal...";
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				void this.deps.eventBus.emit("session.goal.add", { sessionId: session.id, text: input.value.trim() });
				input.value = "";
			}
		});
	}

	refreshGoals(): void {
		this.renderGoalsList();
		this.updateGoalCount();
	}

	updateGoalCount(): void {
		const session = this.deps.getSession();
		if (this.goalCountEl) {
			this.goalCountEl.textContent = this.formatGoalCount(session.goals);
		}
	}

	private renderGoalsList(): void {
		const session = this.deps.getSession();
		if (!this.goalsEl) return;
		this.goalsEl.empty();

		const goals = session.goals;
		for (let i = 0; i < goals.length; i++) {
			this.renderGoalRow(goals[i], i, goals.length);
		}
	}

	private renderGoalRow(goal: SessionGoal, index: number, total: number): void {
		const session = this.deps.getSession();
		const isEditable = session.status !== "completed" && session.status !== "archived";

		const row = this.goalsEl!.createDiv({ cls: "ft-goal-row ft-item-row" });

		const checkbox = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
		checkbox.checked = goal.completed;
		checkbox.addEventListener("change", () => {
			void this.deps.eventBus.emit("session.goal.toggle", { sessionId: session.id, goalId: goal.id });
		});

		row.createEl("span", {
			text: goal.text,
			cls: goal.completed ? "ft-item-label-completed" : "ft-item-label-active",
		});

		if (isEditable) {
			const actionGroup = row.createDiv({ cls: "ft-goal-actions ft-item-action-group" });

			const upBtn = actionGroup.createEl("button", { cls: "ft-goal-move-up ft-item-move-btn" });
			setIcon(upBtn, "chevron-up");
			if (index === 0) { upBtn.disabled = true; }
			upBtn.addEventListener("click", () => {
				if (index === 0) return;
				const ids = session.goals.map((g) => g.id);
				[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
				void this.deps.eventBus.emit("session.goal.reorder", { sessionId: session.id, goalIds: ids });
			});

			const downBtn = actionGroup.createEl("button", { cls: "ft-goal-move-down ft-item-move-btn" });
			setIcon(downBtn, "chevron-down");
			if (index === total - 1) { downBtn.disabled = true; }
			downBtn.addEventListener("click", () => {
				if (index === total - 1) return;
				const ids = session.goals.map((g) => g.id);
				[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
				void this.deps.eventBus.emit("session.goal.reorder", { sessionId: session.id, goalIds: ids });
			});

			const removeBtn = actionGroup.createEl("button", { cls: "ft-goal-remove ft-item-remove-btn" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.goal.remove", { sessionId: session.id, goalId: goal.id });
			});
		}
	}

	private formatGoalCount(goals: SessionGoal[]): string {
		const done = goals.filter((g) => g.completed).length;
		return `(${done}/${goals.length})`;
	}
}
