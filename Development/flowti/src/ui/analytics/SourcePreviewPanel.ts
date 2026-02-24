/**
 * SourcePreviewPanel — shows column names, inferred types, row count,
 * and first 5 sample rows for a loaded analytics source.
 */

import type { ParsedSourceData, ColumnTypeHint } from "../../domain/analytics/types";

const MAX_SAMPLE_ROWS = 5;

export interface SourcePreviewOptions {
	container: HTMLElement;
	data: ParsedSourceData;
	typeHints: ColumnTypeHint[];
}

export class SourcePreviewPanel {
	private container: HTMLElement;
	private data: ParsedSourceData;
	private typeHints: ColumnTypeHint[];

	constructor(options: SourcePreviewOptions) {
		this.container = options.container;
		this.data = options.data;
		this.typeHints = options.typeHints;
	}

	render(): void {
		this.container.empty();

		// Header
		const header = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.marginBottom = "0.5rem";
		header.createSpan({ text: "Source Preview", cls: "ft-detail-section-header" });
		header.createSpan({
			text: `${this.data.headers.length} columns, ${this.data.rows.length} rows`,
			cls: "ft-badge ft-badge-muted",
		});

		// Column summary table
		const table = this.container.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const col of this.data.headers) {
			headerRow.createEl("th", { text: col, cls: "ft-text-sm" });
		}

		// Type row
		const typeRow = thead.createEl("tr");
		for (const col of this.data.headers) {
			const hint = this.typeHints.find((h) => h.column === col);
			const td = typeRow.createEl("td", { cls: "ft-text-xs ft-text-muted" });
			td.textContent = hint?.type ?? "string";
			td.style.fontStyle = "italic";
		}

		// Sample rows
		const tbody = table.createEl("tbody");
		const sampleCount = Math.min(this.data.rows.length, MAX_SAMPLE_ROWS);
		for (let i = 0; i < sampleCount; i++) {
			const row = this.data.rows[i];
			const tr = tbody.createEl("tr");
			for (let j = 0; j < this.data.headers.length; j++) {
				const td = tr.createEl("td", { cls: "ft-text-sm" });
				td.textContent = row[j] ?? "";
				td.style.maxWidth = "150px";
				td.style.overflow = "hidden";
				td.style.textOverflow = "ellipsis";
				td.style.whiteSpace = "nowrap";
			}
		}

		if (this.data.rows.length > MAX_SAMPLE_ROWS) {
			const more = this.container.createDiv({ cls: "ft-text-muted ft-text-xs" });
			more.style.textAlign = "right";
			more.style.marginTop = "0.25rem";
			more.textContent = `and ${this.data.rows.length - MAX_SAMPLE_ROWS} more rows...`;
		}
	}
}
