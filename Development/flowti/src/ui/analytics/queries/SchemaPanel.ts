/**
 * Schema panel sub-component for the query builder.
 *
 * Displays a collapsible overview of all available columns with their
 * detected types and source alias badges for multi-source queries.
 * Renders between SourcePanel and QueryBuilderPanel.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps } from "./types";
import { groupColumnsByType } from "./columnPicker";

const TYPE_ICONS: Record<string, string> = {
	number: "hash",
	date: "calendar",
	string: "type",
};

const TYPE_BADGE_CLS: Record<string, string> = {
	number: "ft-badge ft-badge-muted",
	date: "ft-badge ft-badge-muted",
	string: "ft-badge ft-badge-muted",
};

export class SchemaPanel {
	private collapsed = false;

	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const headers = this.deps.getLoadedHeaders();
		if (headers.length === 0) return;

		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });

		// Header with collapse toggle
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.cursor = "pointer";
		header.style.margin = "0";

		const toggleIcon = header.createSpan();
		setIcon(toggleIcon, this.collapsed ? "chevron-right" : "chevron-down");
		toggleIcon.style.width = "14px";
		toggleIcon.style.height = "14px";
		toggleIcon.style.flexShrink = "0";

		header.createDiv({ text: "Schema", cls: "ft-detail-section-header" });

		const countBadge = header.createSpan({
			text: `${headers.length} columns`,
			cls: "ft-badge ft-badge-muted",
		});
		countBadge.style.marginLeft = "auto";

		header.addEventListener("click", () => {
			this.collapsed = !this.collapsed;
			const parent = section.parentElement;
			if (parent) {
				section.remove();
				this.render();
			}
		});

		if (this.collapsed) return;

		// Build source map for multi-source alias badges
		const sources = this.deps.sources();
		const sourceMap = new Map<string, string[]>();
		if (sources.length > 1) {
			for (const src of sources) {
				if (!src.data) continue;
				for (const h of src.data.headers) {
					if (!sourceMap.has(h)) sourceMap.set(h, []);
					sourceMap.get(h)!.push(src.alias);
				}
			}
		}

		// Render column groups
		const groups = groupColumnsByType(headers, this.deps.columnTypeHints());

		for (const group of groups) {
			const groupDiv = section.createDiv();
			groupDiv.style.padding = "0.25rem 0.5rem";

			const groupHeader = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			const icon = groupHeader.createSpan();
			setIcon(icon, TYPE_ICONS[group.type] ?? "type");
			icon.style.width = "14px";
			icon.style.height = "14px";
			icon.style.opacity = "0.6";
			groupHeader.createSpan({ text: group.label, cls: "ft-text-sm" }).style.fontWeight = "500";
			groupHeader.createSpan({
				text: `${group.columns.length}`,
				cls: "ft-badge ft-badge-muted",
			});

			for (const col of group.columns) {
				const row = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
				row.style.padding = "0.15rem 0 0.15rem 1.25rem";
				row.style.cursor = "pointer";

				const colName = row.createSpan({ text: col, cls: "ft-text-sm" });
				colName.title = group.type === "number"
					? `Click to add SUM(${col}) as measure`
					: `Click to add ${col} as dimension`;

				row.addEventListener("click", () => {
					if (group.type === "number") {
						const measures = this.deps.measures();
						if (!measures.some((m) => m.column === col)) {
							this.deps.setMeasures([...measures, { column: col, function: "SUM" }]);
							this.deps.renderDetail();
						}
					} else {
						const dims = this.deps.dimensions();
						if (!dims.some((d) => d.column === col)) {
							this.deps.setDimensions([...dims, { column: col }]);
							this.deps.renderDetail();
						}
					}
				});

				// Source alias badges for multi-source
				const aliases = sourceMap.get(col);
				if (aliases) {
					for (const alias of aliases) {
						const badge = row.createSpan({
							text: alias,
							cls: TYPE_BADGE_CLS[group.type] ?? "ft-badge ft-badge-muted",
						});
						badge.style.fontSize = "0.65rem";
						badge.style.padding = "0 0.25rem";
					}
				}
			}
		}
	}
}
