/**
 * Computed columns section sub-component.
 *
 * Renders computed column add/remove/edit rows
 * with helper text showing available column references.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps } from "./types";
import { INPUT_CSS } from "./types";

export class ComputedColumnsSection {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const measures = this.deps.measures();

		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createDiv({ text: "Computed Columns", cls: "ft-detail-section-header" });
		header.style.margin = "0";

		// Function reference help toggle
		const helpBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		helpBtn.style.marginLeft = "auto";
		const helpIcon = helpBtn.createSpan();
		setIcon(helpIcon, "help-circle");
		helpIcon.style.width = "14px";
		helpIcon.style.height = "14px";
		helpBtn.setAttribute("aria-label", "Available functions");

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => {
			const cols = this.deps.computedColumns();
			cols.push({ name: "", expression: "" });
			this.deps.setComputedColumns(cols);
			this.deps.renderDetail();
		});

		const computedColumns = this.deps.computedColumns();
		for (let i = 0; i < computedColumns.length; i++) {
			const cc = computedColumns[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const nameInput = row.createEl("input", { type: "text" });
			nameInput.value = cc.name;
			nameInput.placeholder = "Column name";
			nameInput.style.cssText = INPUT_CSS + ";width:120px";
			nameInput.addEventListener("change", () => { cc.name = nameInput.value.trim(); });

			row.createSpan({ text: "=", cls: "ft-text-muted" });

			const exprInput = row.createEl("input", { type: "text" });
			exprInput.value = cc.expression;
			exprInput.placeholder = "{Column} + {Column}";
			exprInput.style.cssText = INPUT_CSS + ";width:200px;flex:1";
			exprInput.addEventListener("change", () => { cc.expression = exprInput.value; });

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeBtn.addEventListener("click", () => {
				const current = this.deps.computedColumns();
				current.splice(i, 1);
				this.deps.setComputedColumns(current);
				this.deps.renderDetail();
			});
		}

		// Helper text showing available column labels
		if (computedColumns.length > 0) {
			const labels: string[] = [];
			if (measures.length > 0) {
				for (const m of measures) labels.push(m.label ?? `${m.function}(${m.column})`);
			} else {
				for (const h of this.deps.getLoadedHeaders()) labels.push(h);
			}
			const helpText = section.createDiv({ cls: "ft-text-muted ft-text-xs ft-p-2" });
			helpText.textContent = `Available: ${labels.map((l) => `{${l}}`).join(", ")}`;
		} else {
			section.createDiv({
				text: "Add computed columns for derived metrics (e.g., Profit = {Revenue} - {Cost})",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		}

		// Function reference help (collapsible)
		const helpPanel = section.createDiv({ cls: "ft-function-help" });
		helpPanel.style.display = "none";
		helpPanel.style.padding = "0.5rem 0.75rem";
		helpPanel.style.borderTop = "1px solid var(--background-modifier-border)";
		helpPanel.style.background = "var(--background-secondary)";
		helpPanel.style.fontSize = "var(--font-ui-smaller)";

		const helpTitle = helpPanel.createDiv({ cls: "ft-text-sm" });
		helpTitle.style.fontWeight = "600";
		helpTitle.style.marginBottom = "0.35rem";
		helpTitle.textContent = "Available Functions";

		const functions = [
			["CHANGE({col})", "Absolute change from previous row"],
			["PCT_CHANGE({col})", "Percentage change from previous row"],
			["ROLLING_AVG({col}, n)", "Rolling average of last n values"],
			["ROUND({col}, n)", "Round to n decimal places"],
			["ABS({col})", "Absolute value"],
			['IF({col} op n, then, else)', "Conditional: IF({Margin} < 10, \"Low\", \"OK\")"],
		];
		for (const [sig, desc] of functions) {
			const row = helpPanel.createDiv({ cls: "ft-text-xs" });
			row.style.padding = "0.15rem 0";
			const code = row.createEl("code");
			code.textContent = sig;
			code.style.color = "var(--text-accent)";
			row.appendText(` — ${desc}`);
		}

		helpBtn.addEventListener("click", () => {
			const visible = helpPanel.style.display !== "none";
			helpPanel.style.display = visible ? "none" : "block";
		});
	}
}
