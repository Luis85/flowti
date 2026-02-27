import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { SessionDecision } from "../../domain/session/types";

export class SessionDecisionPanel {
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-decisions ft-section" });

		const headerRow = section.createDiv({ cls: "ft-panel-header-row" });

		const labelRow = headerRow.createDiv({ cls: "ft-panel-label-row" });
		labelRow.createEl("strong", { text: "Decisions" });
		this.countEl = labelRow.createEl("span", {
			text: `(${session.decisions.length})`,
			cls: "ft-text-muted ft-text-sm ft-panel-count",
		});

		this.listEl = section.createDiv({ cls: "ft-decisions-list" });
		this.renderList();

		// Add decision form (visible for non-completed/archived sessions)
		if (session.status !== "completed" && session.status !== "archived") {
			this.renderAddForm(section);
		}
	}

	refreshList(): void {
		this.renderList();
		this.updateCount();
	}

	private updateCount(): void {
		const session = this.deps.getSession();
		if (this.countEl) {
			this.countEl.textContent = `(${session.decisions.length})`;
		}
	}

	private renderList(): void {
		const session = this.deps.getSession();
		if (!this.listEl) return;
		this.listEl.empty();

		for (const decision of session.decisions) {
			this.renderDecisionRow(decision);
		}
	}

	private renderDecisionRow(decision: SessionDecision): void {
		const session = this.deps.getSession();
		const row = this.listEl!.createDiv({ cls: "ft-decision-row" });

		const titleRow = row.createDiv({ cls: "ft-decision-title-row" });

		titleRow.createEl("strong", { text: decision.title, cls: "ft-decision-title" });

		if (session.status !== "completed" && session.status !== "archived") {
			const removeBtn = titleRow.createEl("button", { cls: "ft-decision-remove ft-item-remove-btn" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.decision.remove", { sessionId: session.id, decisionId: decision.id });
			});
		}

		if (decision.description) {
			row.createEl("p", { text: decision.description, cls: "ft-decision-description" });
		}
		if (decision.context) {
			row.createEl("p", { text: `Context: ${decision.context}`, cls: "ft-decision-context" });
		}
	}

	private renderAddForm(section: HTMLElement): void {
		const session = this.deps.getSession();
		const form = section.createDiv({ cls: "ft-decision-add-form" });

		const titleInput = form.createEl("input", { type: "text", cls: "ft-decision-title-input ft-panel-input" });
		titleInput.placeholder = "Record a decision...";

		titleInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && titleInput.value.trim()) {
				void this.deps.eventBus.emit("session.decision.record", {
					sessionId: session.id,
					title: titleInput.value.trim(),
				});
				titleInput.value = "";
			}
		});
	}
}
