/**
 * Computed columns section sub-component.
 *
 * Renders computed column add/remove/edit rows with inline validation,
 * clickable column chips, and comprehensive function reference.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps, ColumnTypeHint, ColumnType } from "./types";
import { validateExpression } from "../../../domain/analytics/expressionValidator";

export class ComputedColumnsSection {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });

		// ── Header ─────────────────────────────────
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "sigma");
		headerIcon.addClass("ft-icon-14");
		header.createSpan({ text: "Computed Columns", cls: "ft-text-sm ft-font-medium" });
		header.addClass("ft-subsection-header");

		const computedColumns = this.deps.computedColumns();
		if (computedColumns.length > 0) {
			header.createSpan({ text: `${computedColumns.length}`, cls: "ft-badge ft-badge-muted" });
		}

		// Help toggle
		const helpBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
		const helpIcon = helpBtn.createSpan();
		setIcon(helpIcon, "help-circle");
		helpIcon.addClass("ft-icon-14-plain");
		helpBtn.setAttribute("aria-label", "Function reference");

		// Add button
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

		// ── Computed column rows ───────────────────
		for (let i = 0; i < computedColumns.length; i++) {
			const cc = computedColumns[i];
			const rowWrap = section.createDiv({ cls: "ft-cc-row-wrap" });

			const row = rowWrap.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

			const nameInput = row.createEl("input", { type: "text" });
			nameInput.value = cc.name;
			nameInput.placeholder = "Column name";
			nameInput.addClass("ft-select-small", "ft-cc-name-input");
			nameInput.addEventListener("change", () => { cc.name = nameInput.value.trim(); });

			row.createSpan({ text: "=", cls: "ft-text-muted" });

			const exprInput = row.createEl("input", { type: "text" });
			exprInput.value = cc.expression;
			exprInput.placeholder = "{Column} + {Column}";
			exprInput.addClass("ft-select-small", "ft-cc-expr-input");
			exprInput.addEventListener("change", () => { cc.expression = exprInput.value; });

			// Type hint dropdown — allows setting column type for computed output
			const hint = this.getHintForColumn(cc.name);
			const isCurrency = hint?.type === "number" && !!hint.currencySymbol;
			const displayType = isCurrency ? "currency" : (hint?.type ?? "number");

			const typeSelect = row.createEl("select");
			typeSelect.addClass("ft-select-small", "ft-cc-type-select");
			for (const uiType of ["number", "currency", "string"]) {
				const opt = typeSelect.createEl("option");
				opt.value = uiType;
				opt.textContent = uiType;
				if (uiType === displayType) opt.selected = true;
			}

			let symbolInput: HTMLInputElement | null = null;
			if (displayType === "currency") {
				symbolInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-symbol-narrow" });
				symbolInput.placeholder = "$";
				if (hint?.currencySymbol) symbolInput.value = hint.currencySymbol;
				symbolInput.addEventListener("change", () => {
					const val = symbolInput!.value.trim() || undefined;
					if (cc.name.trim()) this.updateHint(cc.name, { currencySymbol: val });
				});
			}

			typeSelect.addEventListener("change", () => {
				const val = typeSelect.value;
				if (!cc.name.trim()) return;
				if (val === "currency") {
					const sym = symbolInput?.value.trim() || hint?.currencySymbol || "$";
					this.updateHint(cc.name, { type: "number", currencySymbol: sym });
				} else if (val === "number") {
					this.updateHint(cc.name, { type: "number", currencySymbol: undefined });
				} else {
					this.updateHint(cc.name, { type: val as ColumnType, currencySymbol: undefined });
				}
				this.deps.renderDetail();
			});

			// Inline validation on blur
			const errorEl = rowWrap.createDiv({ cls: "ft-text-xs ft-cc-error" });
			exprInput.addEventListener("blur", () => {
				const expr = exprInput.value.trim();
				if (!expr) { errorEl.removeClass("ft-cc-error-visible"); exprInput.removeClass("ft-cc-input-error"); return; }
				const available = this.getAvailableColumns(i);
				const result = validateExpression(expr, available);
				if (result.valid) {
					errorEl.removeClass("ft-cc-error-visible");
					exprInput.removeClass("ft-cc-input-error");
				} else {
					errorEl.textContent = result.errors[0];
					errorEl.addClass("ft-cc-error-visible");
					exprInput.addClass("ft-cc-input-error");
				}
			});

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm ft-flex-shrink-0" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeBtn.addEventListener("click", () => {
				const current = this.deps.computedColumns();
				current.splice(i, 1);
				this.deps.setComputedColumns(current);
				this.deps.renderDetail();
			});
		}

		// ── Available columns chips ───────────────────
		if (computedColumns.length > 0) {
			this.renderAvailableChips(section, computedColumns);
		} else {
			const empty = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-cc-empty" });
			empty.textContent = "Create derived metrics from your query results. Reference any column with {Column Name} and combine with arithmetic or functions.";
		}

		// ── Function reference (collapsible) ─────────
		const helpPanel = section.createDiv({ cls: "ft-hidden" });
		this.renderFunctionReference(helpPanel);

		helpBtn.addEventListener("click", () => {
			helpPanel.toggleClass("ft-hidden", !helpPanel.hasClass("ft-hidden"));
		});
	}

	/** Render clickable column chips grouped by category. */
	private renderAvailableChips(section: HTMLElement, computedColumns: { name: string; expression: string }[]): void {
		const chipArea = section.createDiv({ cls: "ft-cc-chip-area" });

		const measures = this.deps.measures();
		const headers = this.deps.getLoadedHeaders();

		// Measure columns
		if (measures.length > 0) {
			const measureLabels = measures.map((m) => m.label ?? `${m.function}(${m.column})`);
			const rawCols = measures.map((m) => m.column);
			this.renderChipGroup(chipArea, "Measures", measureLabels);

			// Show raw column shorthand if different from measure labels
			const shortcuts = rawCols.filter((c) => !measureLabels.includes(c));
			if (shortcuts.length > 0) {
				this.renderChipGroup(chipArea, "Shorthand", shortcuts);
			}
		}

		// Dimension + other source columns
		const dims = this.deps.dimensions().map((d) => d.column);
		if (dims.length > 0) {
			this.renderChipGroup(chipArea, "Dimensions", dims);
		}

		// Raw headers not already covered
		const covered = new Set<string>();
		for (const m of measures) {
			covered.add(m.label ?? `${m.function}(${m.column})`);
			covered.add(m.column);
		}
		for (const d of dims) covered.add(d);
		const remaining = headers.filter((h) => !covered.has(h));
		if (remaining.length > 0 && measures.length === 0) {
			this.renderChipGroup(chipArea, "Columns", remaining);
		}

		// Previously-defined computed columns
		const ccNames = computedColumns.map((c) => c.name).filter((n) => n.trim());
		if (ccNames.length > 0) {
			this.renderChipGroup(chipArea, "Computed", ccNames);
		}
	}

	/** Render a labeled group of clickable column chips. */
	private renderChipGroup(container: HTMLElement, label: string, columns: string[]): void {
		const group = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-flex-wrap ft-mb-1" });

		group.createSpan({ text: `${label}:`, cls: "ft-text-xs ft-text-muted ft-flex-shrink-0" });

		for (const col of columns) {
			const chip = group.createSpan({ text: `{${col}}`, cls: "ft-badge ft-badge-muted ft-cc-chip" });
			chip.setAttribute("aria-label", `Insert {${col}}`);
			chip.addEventListener("click", () => {
				// Insert into the last focused expression input
				const inputs = this.container.querySelectorAll<HTMLInputElement>("input[placeholder='{Column} + {Column}']");
				const last = inputs[inputs.length - 1];
				if (last) {
					const ref = `{${col}}`;
					const start = last.selectionStart ?? last.value.length;
					last.value = last.value.slice(0, start) + ref + last.value.slice(last.selectionEnd ?? start);
					last.focus();
					last.setSelectionRange(start + ref.length, start + ref.length);
					// Trigger change
					last.dispatchEvent(new Event("change"));
				}
			});
		}
	}

	/** Render the collapsible function reference panel. */
	private renderFunctionReference(panel: HTMLElement): void {
		panel.addClass("ft-fn-ref-panel");

		const title = panel.createDiv({ cls: "ft-text-sm ft-font-semibold ft-mb-1" });
		title.textContent = "Expression reference";

		// Operators section
		const opsRow = panel.createDiv({ cls: "ft-text-xs ft-fn-ref-row" });
		const opsCode = opsRow.createEl("code", { cls: "ft-code-accent" });
		opsCode.textContent = "+ - * /";
		opsRow.appendText(" — arithmetic operators");

		// Column references
		const refsRow = panel.createDiv({ cls: "ft-text-xs ft-fn-ref-row" });
		const refsCode = refsRow.createEl("code", { cls: "ft-code-accent" });
		refsCode.textContent = "{Column Name}";
		refsRow.appendText(" — reference a column value. Use the raw name (e.g., {Revenue}) even for aggregated measures.");

		// Divider
		panel.createDiv({ cls: "ft-fn-ref-divider" });

		panel.createDiv({ text: "Scalar functions (per-row)", cls: "ft-text-xs ft-text-muted ft-fn-ref-sublabel" });

		const scalarFns: [string, string][] = [
			["ROUND({col}, n)", "Round to n decimal places — ROUND({Revenue}, 2)"],
			["ABS({col})", "Absolute value — ABS({Change})"],
			['IF({col} op value, then, else)', 'Conditional — IF({Margin} < 10, "Low", "OK")'],
		];
		for (const [sig, desc] of scalarFns) {
			this.renderFnRow(panel, sig, desc);
		}

		// Divider
		panel.createDiv({ cls: "ft-fn-ref-divider" });

		panel.createDiv({ text: "Window functions (across rows)", cls: "ft-text-xs ft-text-muted ft-fn-ref-sublabel" });

		const windowFns: [string, string][] = [
			["CHANGE({col})", "Absolute change from previous row"],
			["PCT_CHANGE({col})", "Percentage change from previous row"],
			["ROLLING_AVG({col}, n)", "Rolling average of last n values"],
		];
		for (const [sig, desc] of windowFns) {
			this.renderFnRow(panel, sig, desc);
		}

		// Divider
		panel.createDiv({ cls: "ft-fn-ref-divider" });

		panel.createDiv({ text: "Tips", cls: "ft-text-xs ft-text-muted ft-fn-ref-sublabel" });

		const tips = [
			"Combine functions: ROUND(PCT_CHANGE({Revenue}), 1)",
			"Computed columns can reference earlier computed columns",
			"IF supports >, <, >=, <=, =, != operators and string/number results",
		];
		for (const tip of tips) {
			const tipRow = panel.createDiv({ cls: "ft-text-xs ft-fn-ref-tip" });
			tipRow.textContent = `• ${tip}`;
		}
	}

	private renderFnRow(panel: HTMLElement, sig: string, desc: string): void {
		const row = panel.createDiv({ cls: "ft-text-xs ft-fn-ref-row" });
		const code = row.createEl("code", { cls: "ft-code-accent" });
		code.textContent = sig;
		row.appendText(` — ${desc}`);
	}

	/** Get the column type hint for a computed column by name. */
	private getHintForColumn(name: string): ColumnTypeHint | undefined {
		if (!name.trim()) return undefined;
		return this.deps.columnTypeHints().find((h) => h.column === name);
	}

	/** Update or create a column type hint for a computed column. */
	private updateHint(column: string, update: Partial<ColumnTypeHint>): void {
		const currentHints = [...this.deps.columnTypeHints()];
		const idx = currentHints.findIndex((h) => h.column === column);
		if (idx >= 0) {
			currentHints[idx] = { ...currentHints[idx], ...update };
		} else {
			currentHints.push({ column, type: update.type ?? "number", ...update });
		}
		this.deps.setColumnTypeHints(currentHints);
	}

	/**
	 * Get available column names for expression validation.
	 * Includes: measure labels, raw measure column names (shorthand),
	 * raw headers, dimension columns, and previously-defined computed column names.
	 */
	private getAvailableColumns(currentIndex?: number): string[] {
		const cols = new Set<string>();
		const measures = this.deps.measures();

		// Measure labels (e.g., "SUM(Revenue)" or custom label)
		for (const m of measures) {
			cols.add(m.label ?? `${m.function}(${m.column})`);
			// Raw column name as shorthand (engine creates aliases)
			cols.add(m.column);
		}

		// Raw CSV headers
		for (const h of this.deps.getLoadedHeaders()) {
			cols.add(h);
		}

		// Previously-defined computed column names (for cross-references)
		const computedColumns = this.deps.computedColumns();
		const limit = currentIndex !== undefined ? currentIndex : computedColumns.length;
		for (let i = 0; i < limit; i++) {
			const name = computedColumns[i].name.trim();
			if (name) cols.add(name);
		}

		return [...cols];
	}
}
