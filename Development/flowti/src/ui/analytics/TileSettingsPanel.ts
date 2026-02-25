/**
 * Tile settings panel — query selector, width/height toggles, sparkline,
 * row limit, auto-height, and conditional formatting rule builder.
 *
 * Extracted from DashboardTileRenderer (Cycle 36, Inc 1).
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, ConditionalRule, NumberDisplayFormat, NumberFormatStyle } from "../../domain/analytics/types";
import type { TileRenderContext } from "./DashboardTileRenderer";

/** Get numeric column names from a result (used by settings + renderer). */
export function getNumericColumns(result: AnalyticsResult | null): string[] {
	if (!result || result.rows.length === 0) return [];
	return result.columns.filter((col) => typeof result.rows[0][col] === "number");
}

export class TileSettingsPanel {
	constructor(
		private container: HTMLElement,
		private ctx: TileRenderContext,
	) {}

	render(): void {
		this.renderSettings();
	}

	private renderSettings(): void {
		const ctx = this.ctx;

		// ── Measurement selector ─────────────────────────
		if (ctx.measurements && ctx.measurements.length > 0 && ctx.onMeasurementChange) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.25rem";
			row.createSpan({ text: "Measurement", cls: "ft-text-sm" }).style.fontWeight = "600";

			const mSelect = row.createEl("select", { cls: "ft-text-xs" });
			mSelect.style.cssText = "flex:1;padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary)";

			// "None" option = direct query
			const noneOpt = mSelect.createEl("option");
			noneOpt.value = "";
			noneOpt.textContent = "None (direct query)";
			if (!ctx.tile.measurementId) noneOpt.selected = true;

			for (const m of ctx.measurements) {
				const opt = mSelect.createEl("option");
				opt.value = m.id;
				opt.textContent = `${m.name} (${m.type})`;
				if (m.id === ctx.tile.measurementId) opt.selected = true;
			}
			mSelect.addEventListener("change", () => {
				ctx.onMeasurementChange!(ctx.tile.id, mSelect.value || "");
			});
		}

		// ── Query selector ───────────────────────────────
		if (ctx.queries && ctx.queries.length > 0 && ctx.onQueryChange) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.25rem";
			row.createSpan({ text: "Query", cls: "ft-text-sm" }).style.fontWeight = "600";

			const querySelect = row.createEl("select", { cls: "ft-text-xs" });
			querySelect.style.cssText = "flex:1;padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary)";
			for (const q of ctx.queries) {
				const opt = querySelect.createEl("option");
				opt.value = q.id;
				opt.textContent = q.name;
				if (q.id === ctx.tile.queryId) opt.selected = true;
			}
			querySelect.addEventListener("change", () => {
				ctx.onQueryChange!(ctx.tile.id, querySelect.value);
			});

			// Show description of selected query
			const selectedQuery = ctx.queries.find((q) => q.id === ctx.tile.queryId);
			if (selectedQuery?.description) {
				const descEl = this.container.createDiv({ cls: "ft-text-muted ft-text-xs" });
				descEl.style.marginBottom = "0.5rem";
				descEl.textContent = selectedQuery.description;
			} else {
				this.container.createDiv().style.marginBottom = "0.25rem";
			}
		}

		// ── Width toggle ─────────────────────────────────
		if (ctx.onWidthChange) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.5rem";
			row.createSpan({ text: "Width", cls: "ft-text-sm" }).style.fontWeight = "600";

			for (const w of [1, 2, 3, 4, 5, 6]) {
				const btn = row.createEl("button", { cls: "ft-text-xs" });
				btn.textContent = `${w} col`;
				btn.style.cssText = "padding:2px 8px;border-radius:4px;border:1px solid var(--background-modifier-border);cursor:pointer";
				if (ctx.tile.width === w) {
					btn.style.background = "var(--interactive-accent)";
					btn.style.color = "var(--text-on-accent)";
				} else {
					btn.style.background = "var(--background-primary)";
				}
				btn.addEventListener("click", () => {
					ctx.onWidthChange!(ctx.tile.id, w);
				});
			}
		}

		// ── Height toggle ────────────────────────────────
		if (ctx.onHeightChange) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.5rem";
			row.createSpan({ text: "Height", cls: "ft-text-sm" }).style.fontWeight = "600";

			for (const h of [1, 2, 3, 4, 5, 6]) {
				const btn = row.createEl("button", { cls: "ft-text-xs" });
				btn.textContent = `${h}`;
				btn.style.cssText = "padding:2px 8px;border-radius:4px;border:1px solid var(--background-modifier-border);cursor:pointer;min-width:28px";
				if (ctx.tile.height === h) {
					btn.style.background = "var(--interactive-accent)";
					btn.style.color = "var(--text-on-accent)";
				} else {
					btn.style.background = "var(--background-primary)";
				}
				btn.addEventListener("click", () => {
					ctx.onHeightChange!(ctx.tile.id, h);
				});
			}
		}

		// ── Auto-height toggle (max-width only) ─────────
		if (ctx.tile.width >= 3 && ctx.onAutoHeightToggle) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.5rem";

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = ctx.tile.autoHeight === true;
			checkbox.addEventListener("change", () => {
				ctx.onAutoHeightToggle!(ctx.tile.id, checkbox.checked);
			});

			row.createSpan({ text: "Auto height (fit content)", cls: "ft-text-sm" });
		}

		// ── Sparkline toggle (stat-card only) ────────────
		if (ctx.tile.displayMode === "stat-card" && ctx.onSparklineToggle) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.5rem";

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = ctx.tile.showSparkline !== false;
			checkbox.addEventListener("change", () => {
				ctx.onSparklineToggle!(ctx.tile.id, checkbox.checked);
			});

			row.createSpan({ text: "Show sparklines", cls: "ft-text-sm" });
		}

		// ── Row limit ────────────────────────────────────
		if (ctx.onRowLimitChange) {
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginBottom = "0.5rem";
			row.createSpan({ text: "Row limit", cls: "ft-text-sm" }).style.fontWeight = "600";

			const limitInput = row.createEl("input", { type: "number", cls: "ft-text-xs" });
			limitInput.style.cssText = "width:60px;padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary)";
			limitInput.placeholder = "All";
			limitInput.min = "1";
			if (ctx.tile.rowLimit) limitInput.value = String(ctx.tile.rowLimit);
			limitInput.addEventListener("change", () => {
				const val = parseInt(limitInput.value, 10);
				ctx.onRowLimitChange!(ctx.tile.id, val > 0 ? val : undefined);
			});
		}

		// ── Number format ───────────────────────────────
		if (ctx.onNumberFormatChange) {
			this.renderNumberFormat();
		}

		// ── Conditional formatting rules ─────────────────
		if (ctx.onRulesChange) {
			this.renderRuleBuilder();
		}
	}

	private renderNumberFormat(): void {
		const ctx = this.ctx;
		const fmt = ctx.tile.numberFormat;

		const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		row.style.marginBottom = "0.5rem";
		row.createSpan({ text: "Number format", cls: "ft-text-sm" }).style.fontWeight = "600";

		const styles: Array<{ value: NumberFormatStyle | "auto"; label: string }> = [
			{ value: "auto", label: "Auto" },
			{ value: "plain", label: "Plain" },
			{ value: "currency", label: "Currency" },
			{ value: "percent", label: "Percent" },
		];
		const currentStyle = fmt?.style ?? "auto";

		const styleSelect = row.createEl("select", { cls: "ft-text-xs" });
		styleSelect.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary)";
		for (const s of styles) {
			const opt = styleSelect.createEl("option");
			opt.value = s.value;
			opt.textContent = s.label;
			if (s.value === currentStyle) opt.selected = true;
		}

		// Symbol input (only relevant for currency)
		const symbolInput = row.createEl("input", { type: "text", cls: "ft-text-xs" });
		symbolInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:36px";
		symbolInput.placeholder = "$";
		if (fmt?.symbol) symbolInput.value = fmt.symbol;
		symbolInput.style.display = currentStyle === "currency" ? "" : "none";

		// Decimals input
		const decimalsInput = row.createEl("input", { type: "number", cls: "ft-text-xs" });
		decimalsInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:44px";
		decimalsInput.placeholder = "auto";
		decimalsInput.min = "0";
		decimalsInput.max = "6";
		if (fmt?.decimals !== undefined) decimalsInput.value = String(fmt.decimals);
		decimalsInput.style.display = currentStyle === "auto" ? "none" : "";

		const emitChange = () => {
			const style = styleSelect.value as NumberFormatStyle | "auto";
			if (style === "auto") {
				ctx.onNumberFormatChange!(ctx.tile.id, undefined);
				return;
			}
			const dec = parseInt(decimalsInput.value, 10);
			const result: NumberDisplayFormat = {
				style,
				symbol: style === "currency" && symbolInput.value.trim() ? symbolInput.value.trim() : undefined,
				decimals: !isNaN(dec) && dec >= 0 ? dec : undefined,
			};
			ctx.onNumberFormatChange!(ctx.tile.id, result);
		};

		styleSelect.addEventListener("change", () => {
			symbolInput.style.display = styleSelect.value === "currency" ? "" : "none";
			decimalsInput.style.display = styleSelect.value === "auto" ? "none" : "";
			emitChange();
		});
		symbolInput.addEventListener("change", emitChange);
		decimalsInput.addEventListener("change", emitChange);
	}

	private renderRuleBuilder(): void {
		const ctx = this.ctx;

		const sectionHeader = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		sectionHeader.createSpan({ text: "Formatting Rules", cls: "ft-text-sm" });
		sectionHeader.style.fontWeight = "600";
		sectionHeader.style.marginBottom = "0.35rem";

		const addRuleBtn = sectionHeader.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addRuleBtn.style.marginLeft = "auto";
		const addIcon = addRuleBtn.createSpan();
		setIcon(addIcon, "plus");
		addRuleBtn.appendText(" Add Rule");
		addRuleBtn.addEventListener("click", () => {
			const rules = [...(ctx.tile.conditionalRules ?? [])];
			const numCols = getNumericColumns(ctx.result);
			rules.push({
				column: numCols[0] ?? "",
				operator: ">",
				threshold: 0,
				color: "positive",
			});
			ctx.onRulesChange!(ctx.tile.id, rules);
		});

		const rules = ctx.tile.conditionalRules ?? [];
		if (rules.length === 0) {
			this.container.createDiv({
				text: "No rules configured. Add a rule to color-code cell values.",
				cls: "ft-text-muted ft-text-xs",
			});
			return;
		}

		const numericCols = getNumericColumns(ctx.result);
		const operators: Array<{ value: string; label: string }> = [
			{ value: ">", label: ">" },
			{ value: "<", label: "<" },
			{ value: ">=", label: ">=" },
			{ value: "<=", label: "<=" },
			{ value: "=", label: "=" },
			{ value: "!=", label: "!=" },
		];
		const presets: Array<{ value: string; label: string; cssColor: string }> = [
			{ value: "positive", label: "Green", cssColor: "var(--text-success)" },
			{ value: "negative", label: "Red", cssColor: "var(--text-error)" },
			{ value: "warning", label: "Amber", cssColor: "var(--text-warning)" },
		];

		for (let i = 0; i < rules.length; i++) {
			const rule = rules[i];
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.25rem 0";
			if (i < rules.length - 1) row.style.borderBottom = "1px solid var(--background-modifier-border)";

			// Column dropdown
			const colSelect = row.createEl("select", { cls: "ft-text-xs" });
			colSelect.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary)";
			for (const col of numericCols) {
				const opt = colSelect.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (col === rule.column) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				const updated = [...rules];
				updated[i] = { ...updated[i], column: colSelect.value };
				ctx.onRulesChange!(ctx.tile.id, updated);
			});

			// Operator dropdown
			const opSelect = row.createEl("select", { cls: "ft-text-xs" });
			opSelect.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:50px";
			for (const op of operators) {
				const opt = opSelect.createEl("option");
				opt.value = op.value;
				opt.textContent = op.label;
				if (op.value === rule.operator) opt.selected = true;
			}
			opSelect.addEventListener("change", () => {
				const updated = [...rules];
				updated[i] = { ...updated[i], operator: opSelect.value as ConditionalRule["operator"] };
				ctx.onRulesChange!(ctx.tile.id, updated);
			});

			// Threshold input
			const thresholdInput = row.createEl("input", { type: "number", cls: "ft-text-xs" });
			thresholdInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:60px";
			thresholdInput.value = String(rule.threshold);
			thresholdInput.addEventListener("change", () => {
				const updated = [...rules];
				updated[i] = { ...updated[i], threshold: parseFloat(thresholdInput.value) || 0 };
				ctx.onRulesChange!(ctx.tile.id, updated);
			});

			// Color preset buttons
			for (const preset of presets) {
				const presetBtn = row.createSpan({ cls: "ft-nav-link" });
				presetBtn.style.cssText = `width:16px;height:16px;border-radius:50%;background:${preset.cssColor};cursor:pointer;flex-shrink:0`;
				if (rule.color === preset.value) {
					presetBtn.style.outline = "2px solid var(--text-normal)";
					presetBtn.style.outlineOffset = "1px";
				}
				presetBtn.setAttribute("aria-label", preset.label);
				presetBtn.addEventListener("click", () => {
					const updated = [...rules];
					updated[i] = { ...updated[i], color: preset.value };
					ctx.onRulesChange!(ctx.tile.id, updated);
				});
			}

			// Custom color input
			const colorInput = row.createEl("input", { type: "text", cls: "ft-text-xs" });
			colorInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:70px";
			colorInput.placeholder = "#hex";
			if (!["positive", "negative", "warning"].includes(rule.color)) {
				colorInput.value = rule.color;
			}
			colorInput.addEventListener("change", () => {
				const val = colorInput.value.trim();
				if (val) {
					const updated = [...rules];
					updated[i] = { ...updated[i], color: val };
					ctx.onRulesChange!(ctx.tile.id, updated);
				}
			});

			// Remove button
			const removeBtn = row.createSpan({ cls: "ft-nav-link ft-text-muted" });
			removeBtn.style.cursor = "pointer";
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeIcon.style.width = "12px";
			removeIcon.style.height = "12px";
			removeBtn.addEventListener("click", () => {
				const updated = [...rules];
				updated.splice(i, 1);
				ctx.onRulesChange!(ctx.tile.id, updated);
			});
		}
	}
}
