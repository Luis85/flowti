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
	/** Source display name shown as block title (e.g. alias or filename). */
	sourceName?: string;
}

export class SourcePreviewPanel {
	private container: HTMLElement;
	private data: ParsedSourceData;
	private typeHints: ColumnTypeHint[];
	private sourceName: string | undefined;

	constructor(options: SourcePreviewOptions) {
		this.container = options.container;
		this.data = options.data;
		this.typeHints = options.typeHints;
		this.sourceName = options.sourceName;
	}

	render(): void {
		this.container.empty();

		// Header — source name as title, no border-bottom
		const header = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-preview-header" });
		header.createSpan({ text: this.sourceName ?? "Preview", cls: "ft-text-sm ft-font-semibold" });
		header.createSpan({
			text: `${this.data.headers.length} cols`,
			cls: "ft-badge ft-badge-muted ft-text-xs",
		});
		header.createSpan({
			text: `${this.data.rows.length} rows`,
			cls: "ft-badge ft-badge-muted ft-text-xs",
		});

		// Column summary table
		const table = this.container.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const col of this.data.headers) {
			headerRow.createEl("th", { text: col, cls: "ft-text-xs" });
		}

		// Type row
		const typeRow = thead.createEl("tr");
		for (const col of this.data.headers) {
			const hint = this.typeHints.find((h) => h.column === col);
			const td = typeRow.createEl("td", { cls: "ft-text-xs ft-text-muted ft-text-italic" });
			td.textContent = hint?.type ?? "string";
		}

		// Sample rows
		const tbody = table.createEl("tbody");
		const sampleCount = Math.min(this.data.rows.length, MAX_SAMPLE_ROWS);
		for (let i = 0; i < sampleCount; i++) {
			const row = this.data.rows[i];
			const tr = tbody.createEl("tr");
			for (let j = 0; j < this.data.headers.length; j++) {
				const td = tr.createEl("td", { cls: "ft-text-xs ft-preview-sample-td" });
				td.textContent = row[j] ?? "";
			}
		}

		if (this.data.rows.length > MAX_SAMPLE_ROWS) {
			const more = this.container.createDiv({ cls: "ft-text-muted ft-text-xs ft-preview-more" });
			more.textContent = `and ${this.data.rows.length - MAX_SAMPLE_ROWS} more rows...`;
		}
	}
}
