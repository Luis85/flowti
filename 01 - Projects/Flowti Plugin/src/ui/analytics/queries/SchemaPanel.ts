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
		this.renderHeader(section, headers.length);

		if (this.collapsed) return;

		const sourceMap = this.buildSourceMap();
		const groups = groupColumnsByType(headers, this.deps.columnTypeHints());
		for (const group of groups) {
			this.renderGroup(section, group, sourceMap);
		}
	}

	private renderHeader(section: HTMLElement, columnCount: number): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-cursor-pointer" });
		const toggleIcon = header.createSpan({ cls: "ft-icon-sm ft-flex-shrink-0" });
		setIcon(toggleIcon, this.collapsed ? "chevron-right" : "chevron-down");
		header.createDiv({ text: "Schema", cls: "ft-detail-section-header" });
		header.createSpan({ text: `${columnCount} columns`, cls: "ft-badge ft-badge-muted ft-ml-auto" });
		header.addEventListener("click", () => {
			this.collapsed = !this.collapsed;
			if (section.parentElement) { section.remove(); this.render(); }
		});
	}

	private buildSourceMap(): Map<string, string[]> {
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
		return sourceMap;
	}

	private renderGroup(
		section: HTMLElement,
		group: { type: string; label: string; columns: string[] },
		sourceMap: Map<string, string[]>,
	): void {
		const groupDiv = section.createDiv({ cls: "ft-schema-group" });
		const groupHeader = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		const icon = groupHeader.createSpan({ cls: "ft-icon-sm ft-opacity-60" });
		setIcon(icon, TYPE_ICONS[group.type] ?? "type");
		groupHeader.createSpan({ text: group.label, cls: "ft-text-sm ft-font-medium" });
		groupHeader.createSpan({ text: `${group.columns.length}`, cls: "ft-badge ft-badge-muted" });

		for (const col of group.columns) {
			this.renderColumnRow(groupDiv, col, group.type, sourceMap);
		}
	}

	private renderColumnRow(parent: HTMLElement, col: string, type: string, sourceMap: Map<string, string[]>): void {
		const row = parent.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-schema-col-row" });
		const colName = row.createSpan({ text: col, cls: "ft-text-sm" });
		colName.title = type === "number" ? `Click to add SUM(${col}) as measure` : `Click to add ${col} as dimension`;
		row.addEventListener("click", () => {
			if (type === "number") {
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
		const aliases = sourceMap.get(col);
		if (aliases) {
			for (const alias of aliases) {
				row.createSpan({ text: alias, cls: `${TYPE_BADGE_CLS[type] ?? "ft-badge ft-badge-muted"} ft-schema-alias-badge` });
			}
		}
	}
}
