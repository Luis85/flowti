/**
 * Source configuration panel sub-component.
 *
 * Renders source rows (alias, locale, row count),
 * source preview delegation, and Quick Insight cards.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps, LocaleId } from "./types";
import { LOCALE_OPTIONS, SELECT_CSS, INPUT_CSS } from "./types";
import { SourcePreviewPanel } from "../SourcePreviewPanel";
import { generateQuickInsights, type QuickInsightSuggestion } from "../../../domain/analytics/quickInsights";

export class SourcePanel {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const sources = this.deps.sources();
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Sources", cls: "ft-detail-section-header" });

		// Source table with overflow containment
		const tableWrap = section.createDiv();
		tableWrap.style.overflow = "auto";

		for (let i = 0; i < sources.length; i++) {
			const src = sources[i];
			const row = tableWrap.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			if (i < sources.length - 1) {
				row.style.borderBottom = "1px solid var(--background-modifier-border)";
			}
			row.style.minWidth = "0";

			const aliasInput = row.createEl("input", { type: "text" });
			aliasInput.value = src.alias;
			aliasInput.style.cssText = INPUT_CSS + ";max-width:100px;flex-shrink:0";
			aliasInput.addEventListener("change", () => {
				src.alias = aliasInput.value.trim() || src.alias;
			});

			const pathSpan = row.createSpan({ text: src.csvPath.split("/").pop() ?? src.csvPath, cls: "ft-text-sm" });
			pathSpan.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

			const localeSelect = row.createEl("select");
			localeSelect.style.cssText = SELECT_CSS + ";flex-shrink:0";
			for (const opt of LOCALE_OPTIONS) {
				const option = localeSelect.createEl("option");
				option.value = opt.id;
				option.textContent = opt.label;
				if (src.locale === opt.id) option.selected = true;
			}
			localeSelect.addEventListener("change", () => {
				src.locale = localeSelect.value as LocaleId;
			});

			if (src.loading) {
				const badge = row.createSpan({ text: "Loading...", cls: "ft-text-muted ft-text-sm" });
				badge.style.flexShrink = "0";
			} else if (src.data) {
				const badge = row.createSpan({ text: `${src.data.rows.length} rows`, cls: "ft-text-muted ft-text-sm" });
				badge.style.flexShrink = "0";
			}
		}

		// Source previews — only shown when preview toggle is active
		const loadedSources = sources.filter((s) => s.data);
		if (this.deps.showPreview()) {
			for (const src of loadedSources) {
				const previewHost = section.createDiv({ cls: "ft-mt-2" });
				previewHost.style.borderTop = "1px solid var(--background-modifier-border)";
				previewHost.style.paddingTop = "0.5rem";
				previewHost.style.overflow = "auto";
				previewHost.createDiv({ text: src.alias, cls: "ft-text-sm ft-text-muted" }).style.marginBottom = "0.25rem";
				new SourcePreviewPanel({
					container: previewHost,
					data: src.data!,
					typeHints: this.deps.columnTypeHints(),
				}).render();
			}
		}

		if (loadedSources.length > 0) {
			this.renderQuickInsights(section);
		}
	}

	private renderQuickInsights(container: HTMLElement): void {
		const insights = generateQuickInsights(this.deps.columnTypeHints(), this.deps.getLoadedHeaders());
		if (insights.length === 0) return;

		const section = container.createDiv({ cls: "ft-mt-2" });
		section.style.borderTop = "1px solid var(--background-modifier-border)";
		section.style.paddingTop = "0.5rem";

		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = header.createSpan();
		setIcon(iconEl, "lightbulb");
		iconEl.style.width = "14px";
		iconEl.style.height = "14px";
		iconEl.style.opacity = "0.6";
		header.createSpan({ text: "Quick Insights", cls: "ft-text-sm ft-text-muted" });

		const grid = section.createDiv();
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
		grid.style.gap = "0.5rem";
		grid.style.marginTop = "0.5rem";

		for (const insight of insights) {
			this.renderInsightCard(grid, insight);
		}
	}

	private renderInsightCard(container: HTMLElement, insight: QuickInsightSuggestion): void {
		const card = container.createDiv({ cls: "ft-stat-card" });
		card.style.cursor = "pointer";
		card.style.padding = "0.5rem 0.75rem";

		const title = card.createDiv({ cls: "ft-text-sm" });
		title.style.fontWeight = "500";
		title.textContent = insight.title;

		card.createDiv({ text: insight.description, cls: "ft-text-xs ft-text-muted" });

		card.addEventListener("click", () => {
			this.deps.applyQuickInsight(
				[...insight.dimensions],
				[...insight.measures],
				insight.timeBucket ? { ...insight.timeBucket } : null,
			);
		});
	}
}
