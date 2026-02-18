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

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

		const labelRow = headerRow.createDiv();
		labelRow.style.cssText = "display:flex;align-items:center;gap:8px;";
		labelRow.createEl("strong", { text: "Decisions" });
		this.countEl = labelRow.createEl("span", {
			text: `(${session.decisions.length})`,
			cls: "ft-text-muted ft-text-sm",
		});
		this.countEl.style.cssText = "color:var(--text-muted);font-size:12px;";

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
		row.style.cssText = "padding:6px 0;border-bottom:1px solid var(--background-modifier-border);";

		const titleRow = row.createDiv();
		titleRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;";

		titleRow.createEl("strong", { text: decision.title, cls: "ft-decision-title" }).style.cssText = "font-size:13px;";

		if (session.status !== "completed" && session.status !== "archived") {
			const removeBtn = titleRow.createEl("button", { cls: "ft-decision-remove" });
			removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.decision.remove", { sessionId: session.id, decisionId: decision.id });
			});
		}

		if (decision.description) {
			row.createEl("p", { text: decision.description, cls: "ft-decision-description" }).style.cssText = "margin:4px 0 0 0;font-size:12px;color:var(--text-muted);";
		}
		if (decision.context) {
			row.createEl("p", { text: `Context: ${decision.context}`, cls: "ft-decision-context" }).style.cssText = "margin:2px 0 0 0;font-size:11px;color:var(--text-faint);font-style:italic;";
		}
	}

	private renderAddForm(section: HTMLElement): void {
		const session = this.deps.getSession();
		const form = section.createDiv({ cls: "ft-decision-add-form" });
		form.style.cssText = "margin-top:8px;display:flex;flex-direction:column;gap:4px;";

		const titleInput = form.createEl("input", { type: "text", cls: "ft-decision-title-input" });
		titleInput.placeholder = "Decision title...";
		titleInput.style.cssText = "padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";

		const descInput = form.createEl("input", { type: "text", cls: "ft-decision-desc-input" });
		descInput.placeholder = "Description (optional)...";
		descInput.style.cssText = "padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";

		const submit = () => {
			const title = titleInput.value.trim();
			if (!title) return;
			void this.deps.eventBus.emit("session.decision.record", {
				sessionId: session.id,
				title,
				description: descInput.value.trim(),
			});
			titleInput.value = "";
			descInput.value = "";
		};

		titleInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") submit();
		});
		descInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") submit();
		});
	}
}
