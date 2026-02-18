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

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

		const labelRow = headerRow.createDiv();
		labelRow.style.cssText = "display:flex;align-items:center;gap:8px;";
		labelRow.createEl("strong", { text: "Goals" });
		this.goalCountEl = labelRow.createEl("span", {
			text: this.formatGoalCount(session.goals),
			cls: "ft-text-muted ft-text-sm",
		});
		this.goalCountEl.style.cssText = "color:var(--text-muted);font-size:12px;";

		this.goalsEl = section.createDiv({ cls: "ft-goals-list" });
		this.renderGoalsList();

		// Add goal input
		const addRow = section.createDiv();
		addRow.style.cssText = "display:flex;gap:8px;margin-top:8px;";
		const input = addRow.createEl("input", { type: "text" });
		input.placeholder = "Add goal...";
		input.style.cssText = "flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";
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

		for (const goal of session.goals) {
			const row = this.goalsEl.createDiv({ cls: "ft-goal-row" });
			row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0;";

			const checkbox = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
			checkbox.checked = goal.completed;
			checkbox.addEventListener("change", () => {
				void this.deps.eventBus.emit("session.goal.toggle", { sessionId: session.id, goalId: goal.id });
			});

			const textEl = row.createEl("span", { text: goal.text });
			textEl.style.cssText = "flex:1;" + (goal.completed ? "text-decoration:line-through;opacity:0.6;" : "");

			const removeBtn = row.createEl("button", { cls: "ft-goal-remove" });
			removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
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
