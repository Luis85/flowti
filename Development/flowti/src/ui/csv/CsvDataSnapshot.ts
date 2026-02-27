/**
 * Data Snapshot component for the CsvLanding page.
 * Renders column chips, filter bar, and sortable/filterable preview table.
 */

import { setIcon } from "obsidian";
import type { CsvComponentDeps } from "./types";
import { splitCsvLine } from "./csvUtils";

export class CsvDataSnapshot {
	private previewBadgeEl: HTMLElement | null = null;
	private previewHiddenBadgeEl: HTMLElement | null = null;
	private previewResetEl: HTMLElement | null = null;
	private previewTableAreaEl: HTMLElement | null = null;
	private cachedAllHeaders: string[] = [];
	private cachedAllRows: string[][] = [];

	constructor(
		private deps: CsvComponentDeps,
		private onDisplaySettingsChanged: () => void,
	) {}

	render(container: HTMLElement): void {
		const data = this.deps.getData();
		const state = this.deps.getState();

		const lines = data.split("\n").filter((l) => l.trim());
		if (lines.length < 2) return;

		this.cachedAllHeaders = splitCsvLine(lines[0], state.detectedDelimiter);
		this.cachedAllRows = lines.slice(1).map((l) => splitCsvLine(l, state.detectedDelimiter));

		// Heading + row count badge + reset button (built once)
		const headingRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headingRow.createEl("h3", { text: "Data snapshot", cls: "ft-heading ft-heading-sm" });
		this.previewBadgeEl = headingRow.createSpan({ cls: "ft-badge ft-badge-muted" });
		this.previewHiddenBadgeEl = headingRow.createSpan({ cls: "ft-badge ft-badge-muted" });
		// Reset columns button (shown/hidden dynamically by updatePreviewTable)
		this.previewResetEl = headingRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(this.previewResetEl.createSpan(), "rotate-ccw");
		this.previewResetEl.appendText(" Reset");
		this.previewResetEl.style.display = "none";
		this.previewResetEl.addEventListener("click", () => {
			this.deps.setState({ hiddenColumns: [] });
			this.onDisplaySettingsChanged();
			this.deps.renderContent();
		});

		// Column chips (clickable to toggle visibility)
		if (this.cachedAllHeaders.length > 0) {
			const chipContainer = container.createDiv({ cls: "ft-flex ft-gap-1 ft-mb-2" });
			chipContainer.style.flexWrap = "wrap";
			for (const h of this.cachedAllHeaders) {
				const isHidden = state.hiddenColumns.includes(h);
				const chip = chipContainer.createSpan({
					text: h,
					cls: `ft-badge ft-badge-muted ft-column-chip${isHidden ? " ft-column-hidden" : ""}`,
				});
				chip.addEventListener("click", () => {
					const curState = this.deps.getState();
					if (curState.hiddenColumns.includes(h)) {
						this.deps.setState({
							hiddenColumns: curState.hiddenColumns.filter((c) => c !== h),
						});
						chip.removeClass("ft-column-hidden");
					} else {
						this.deps.setState({
							hiddenColumns: [...curState.hiddenColumns, h],
						});
						chip.addClass("ft-column-hidden");
					}
					this.onDisplaySettingsChanged();
					this.updatePreviewTable();
				});
			}
		}

		// Single-row filter bar (built once — survives table re-renders)
		const filterBar = container.createDiv({ cls: "ft-preview-filter-bar" });
		const filterLabel = filterBar.createSpan({ text: "Filter:", cls: "ft-text-sm ft-text-muted" });
		filterLabel.addClass("ft-flex-shrink-0");
		const select = filterBar.createEl("select");
		const allOpt = select.createEl("option", { text: "All columns" });
		allOpt.value = "";
		for (const h of this.cachedAllHeaders) {
			const opt = select.createEl("option", { text: h });
			opt.value = h;
			if (state.filterColumn === h) opt.selected = true;
		}
		select.addEventListener("change", () => {
			this.deps.setState({ filterColumn: select.value || null });
			this.onDisplaySettingsChanged();
			this.updatePreviewTable();
		});
		const filterInput = filterBar.createEl("input", { type: "text" });
		filterInput.placeholder = "Type to filter rows...";
		filterInput.value = state.filterText;
		filterInput.addEventListener("input", () => {
			this.deps.setState({ filterText: filterInput.value });
			this.onDisplaySettingsChanged();
			this.updatePreviewTable();
		});

		// Table area (re-rendered on sort/filter/column toggle changes)
		this.previewTableAreaEl = container.createDiv();
		this.updatePreviewTable();
	}

	/** Re-renders only the table + badges, keeping filter bar and heading stable. */
	private updatePreviewTable(): void {
		if (!this.previewTableAreaEl) return;
		this.previewTableAreaEl.empty();

		const state = this.deps.getState();
		const allHeaders = this.cachedAllHeaders;
		const allRows = this.cachedAllRows;

		// Determine visible column indices
		const visibleIndices: number[] = [];
		const visibleHeaders: string[] = [];
		for (let i = 0; i < allHeaders.length; i++) {
			if (!state.hiddenColumns.includes(allHeaders[i])) {
				visibleIndices.push(i);
				visibleHeaders.push(allHeaders[i]);
			}
		}

		// Apply single-column filter
		let filteredRows = allRows;
		const ft = state.filterText.toLowerCase();
		if (ft) {
			if (state.filterColumn !== null) {
				const filterIdx = allHeaders.indexOf(state.filterColumn);
				if (filterIdx >= 0) {
					filteredRows = filteredRows.filter((row) =>
						(row[filterIdx] ?? "").toLowerCase().includes(ft),
					);
				}
			} else {
				filteredRows = filteredRows.filter((row) =>
					row.some((cell) => (cell ?? "").toLowerCase().includes(ft)),
				);
			}
		}

		// Apply sort (numeric-aware via localeCompare with numeric option)
		if (state.previewSortColumn !== null) {
			const sortIdx = allHeaders.indexOf(state.previewSortColumn);
			if (sortIdx >= 0) {
				const dir = state.previewSortDir === "asc" ? 1 : -1;
				filteredRows = [...filteredRows].sort((a, b) =>
					(a[sortIdx] ?? "").localeCompare(b[sortIdx] ?? "", undefined, { numeric: true }) * dir,
				);
			}
		}

		const totalFiltered = filteredRows.length;
		const displayRows = filteredRows.slice(0, state.previewMaxRows);

		// Update badges
		if (this.previewBadgeEl) {
			this.previewBadgeEl.textContent = totalFiltered < allRows.length
				? `${totalFiltered} rows (filtered from ${allRows.length})`
				: `${allRows.length} rows`;
		}
		if (this.previewHiddenBadgeEl) {
			if (state.hiddenColumns.length > 0) {
				this.previewHiddenBadgeEl.textContent = `${state.hiddenColumns.length} hidden`;
				this.previewHiddenBadgeEl.style.display = "";
			} else {
				this.previewHiddenBadgeEl.style.display = "none";
			}
		}
		if (this.previewResetEl) {
			this.previewResetEl.style.display = state.hiddenColumns.length > 0 ? "" : "none";
		}

		const tableWrap = this.previewTableAreaEl.createDiv({ cls: "flowti-csv-preview" });
		const table = tableWrap.createEl("table");

		// Header row with sort controls (visible columns only)
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of visibleHeaders) {
			const th = headerRow.createEl("th", { cls: "ft-preview-sortable-th" });
			th.addClass("ft-cursor-pointer");
			th.style.userSelect = "none";
			const label = th.createSpan({ text: h });
			if (state.previewSortColumn === h) {
				label.appendText(state.previewSortDir === "asc" ? " \u25B2" : " \u25BC");
			}
			th.addEventListener("click", () => {
				const curState = this.deps.getState();
				if (curState.previewSortColumn === h) {
					// 3-click cycle: asc → desc → reset
					if (curState.previewSortDir === "asc") {
						this.deps.setState({ previewSortDir: "desc" });
					} else {
						this.deps.setState({ previewSortColumn: null, previewSortDir: "asc" });
					}
				} else {
					this.deps.setState({ previewSortColumn: h, previewSortDir: "asc" });
				}
				this.onDisplaySettingsChanged();
				this.updatePreviewTable();
			});
		}

		// Data rows (visible columns only)
		const tbody = table.createEl("tbody");
		for (const row of displayRows) {
			const tr = tbody.createEl("tr");
			for (const ci of visibleIndices) {
				tr.createEl("td", { text: row[ci] ?? "" });
			}
		}

		if (totalFiltered > state.previewMaxRows) {
			this.previewTableAreaEl.createEl("p", {
				cls: "flowti-csv-more",
				text: `Showing first ${state.previewMaxRows} of ${totalFiltered} rows`,
			});
		}
	}
}
