import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { ReflectionEntry } from "../../domain/session/types";

const REFLECTION_CATEGORIES: Array<{ type: ReflectionEntry["type"]; icon: string; label: string }> = [
	{ type: "observation", icon: "eye", label: "Observations" },
	{ type: "blocker", icon: "alert-circle", label: "Blockers" },
	{ type: "idea", icon: "lightbulb", label: "Ideas" },
	{ type: "decision", icon: "scale", label: "Decisions" },
];

export class SessionReflectionPanel {
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-reflections ft-section" });

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

		const labelRow = headerRow.createDiv();
		labelRow.style.cssText = "display:flex;align-items:center;gap:8px;";
		labelRow.createEl("strong", { text: "Reflections" });
		this.countEl = labelRow.createEl("span", {
			text: `(${session.reflections.length})`,
			cls: "ft-text-muted ft-text-sm",
		});
		this.countEl.style.cssText = "color:var(--text-muted);font-size:12px;";

		this.listEl = section.createDiv({ cls: "ft-reflections-list" });
		this.renderList();

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
			this.countEl.textContent = `(${session.reflections.length})`;
		}
	}

	private renderList(): void {
		const session = this.deps.getSession();
		if (!this.listEl) return;
		this.listEl.empty();

		for (const cat of REFLECTION_CATEGORIES) {
			const entries = session.reflections.filter((r) => r.type === cat.type);
			if (entries.length === 0) continue;

			const catHeader = this.listEl.createDiv({ cls: `ft-reflection-category ft-reflection-cat-${cat.type}` });
			catHeader.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:8px;margin-bottom:4px;";

			const iconEl = catHeader.createEl("span", { cls: "ft-reflection-icon" });
			setIcon(iconEl, cat.icon);
			iconEl.style.cssText = "display:flex;align-items:center;";

			catHeader.createEl("span", {
				text: `${cat.label} (${entries.length})`,
				cls: "ft-reflection-cat-label",
			}).style.cssText = "font-size:12px;font-weight:600;color:var(--text-muted);";

			for (const entry of entries) {
				this.renderEntryRow(entry);
			}
		}
	}

	private renderEntryRow(entry: ReflectionEntry): void {
		const session = this.deps.getSession();
		const isEditable = session.status !== "completed" && session.status !== "archived";

		const row = this.listEl!.createDiv({ cls: "ft-reflection-row" });
		row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;padding-left:22px;";

		const textEl = row.createEl("span", { text: entry.content, cls: "ft-reflection-content" });
		textEl.style.cssText = "flex:1;font-size:13px;";

		if (isEditable) {
			const removeBtn = row.createEl("button", { cls: "ft-reflection-remove" });
			removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.reflection.remove", { sessionId: session.id, entryId: entry.id });
			});
		}
	}

	private renderAddForm(section: HTMLElement): void {
		const session = this.deps.getSession();
		const form = section.createDiv({ cls: "ft-reflection-add-form" });
		form.style.cssText = "margin-top:8px;display:flex;gap:8px;align-items:center;";

		// Category dropdown
		const select = form.createEl("select", { cls: "ft-reflection-type-select" });
		select.style.cssText = "padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);font-size:13px;";
		for (const cat of REFLECTION_CATEGORIES) {
			const opt = select.createEl("option", { text: cat.label.slice(0, -1) });
			opt.value = cat.type;
		}

		// Content input
		const input = form.createEl("input", { type: "text", cls: "ft-reflection-input" });
		input.placeholder = "Add reflection...";
		input.style.cssText = "flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";

		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				void this.deps.eventBus.emit("session.reflection.add", {
					sessionId: session.id,
					type: select.value as ReflectionEntry["type"],
					content: input.value.trim(),
				});
				input.value = "";
			}
		});
	}
}
