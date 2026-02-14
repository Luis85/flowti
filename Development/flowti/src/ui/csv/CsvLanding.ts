/**
 * Landing page for the CsvActionView.
 * Shows file info dashboard, data snapshot, config usage, associated bases.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type { ImportResult, SavedImportConfig } from "../../domain/dataExchange/types";
import type { CsvComponentDeps } from "./types";
import { splitCsvLine, formatRelativeTime } from "./csvUtils";
import { ConfigChooserModal } from "../modals";

export class CsvLanding {
	// Persistent DOM refs (survive table re-renders)
	private previewBadgeEl: HTMLElement | null = null;
	private previewHiddenBadgeEl: HTMLElement | null = null;
	private previewResetEl: HTMLElement | null = null;
	private previewTableAreaEl: HTMLElement | null = null;
	private cachedAllHeaders: string[] = [];
	private cachedAllRows: string[][] = [];
	private usageProgressEl: HTMLElement | null = null;
	private basesContainerEl: HTMLElement | null = null;

	constructor(
		private container: HTMLElement,
		private deps: CsvComponentDeps,
	) {}

	render(): void {
		const el = this.container;
		el.empty();

		const file = this.deps.getFile();
		const data = this.deps.getData();

		// Header section
		const header = el.createDiv({ cls: "ft-csv-header" });
		const iconEl = header.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-spreadsheet");
		const titleCol = header.createDiv();
		titleCol.createEl("h2", { text: file?.basename ?? "CSV File", cls: "ft-heading ft-csv-title" });
		titleCol.createDiv({ text: file?.path ?? "", cls: "ft-text-sm ft-text-muted" });

		// Show description from CsvDoc if it exists
		if (file) {
			const docPath = this.deps.dataExchangeService.getCsvDocPath(file.path);
			const docFile = this.deps.app.vault.getAbstractFileByPath(docPath);
			if (docFile instanceof TFile) {
				const fm = this.deps.app.metadataCache.getFileCache(docFile)?.frontmatter;
				const desc = fm?.description;
				if (typeof desc === "string" && desc.trim()) {
					titleCol.createDiv({ text: desc, cls: "ft-text-sm ft-text-muted ft-mt-1" });
				}
			}
		}

		// Action buttons
		const actions = el.createDiv({ cls: "ft-flex ft-gap-2 ft-mb-3" });

		const importBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-input");
		importBtn.appendText(" Import as Notes");
		importBtn.addEventListener("click", () => {
			const matchingConfigs = this.deps.dataExchangeService.getImportConfigsForFile(file!.path);
			if (matchingConfigs.length > 0) {
				new ConfigChooserModal(
					this.deps.app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) {
							const cfg = matchingConfigs.find((c) => c.id === id);
							if (cfg) this.deps.setState({ pendingSavedConfig: cfg });
						}
						void this.deps.startImportWizard(true);
					},
				).open();
			} else {
				void this.deps.startImportWizard();
			}
		});

		// Documentation button
		if (file) {
			const docPath = this.deps.dataExchangeService.getCsvDocPath(file.path);
			const abstractFile = this.deps.app.vault.getAbstractFileByPath(docPath);
			const docExists = abstractFile instanceof TFile;
			if (docExists) {
				const docBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(docBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-text");
				docBtn.appendText(" Open Documentation");
				docBtn.addEventListener("click", () => {
					void this.deps.app.workspace.openLinkText(docPath, "", false);
				});
			} else {
				const docBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(docBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-plus");
				docBtn.appendText(" Create Documentation");
				docBtn.addEventListener("click", () => this.createCsvDocAndOpen());
			}
		}

		const openBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(openBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "external-link");
		openBtn.appendText(" Open with Default App");
		openBtn.addEventListener("click", () => {
			if (file) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.deps.app as any).openWithDefaultApp(file.path);
				this.deps.detachLeaf();
			}
		});

		// Landing sections: Facts → Docs/CTA → Usage → Bases → Data Snapshot
		if (data?.trim()) {
			this.renderFileInfoDashboard(el);
			this.renderCsvDocSection(el);
			this.renderConfigUsage(el);
			this.renderAssociatedBases(el);
			this.renderDataSnapshot(el);
		}
	}

	private renderFileInfoDashboard(container: HTMLElement): void {
		const data = this.deps.getData();
		const state = this.deps.getState();
		const file = this.deps.getFile();

		const lines = data.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return;

		const headers = splitCsvLine(lines[0], state.detectedDelimiter);
		const rowCount = lines.length - 1;

		// Stats row
		const statsRow = container.createDiv({ cls: "ft-flex ft-gap-3 ft-mb-2" });
		const addStat = (label: string, value: string) => {
			const stat = statsRow.createDiv({ cls: "ft-catalog-stat" });
			stat.createDiv({ text: value, cls: "ft-catalog-stat-value" });
			stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
		};
		addStat("Rows", String(rowCount));
		addStat("Columns", String(headers.length));
		const delimLabel = state.detectedDelimiter === "," ? "Comma"
			: state.detectedDelimiter === ";" ? "Semicolon"
			: state.detectedDelimiter === "\t" ? "Tab"
			: state.detectedDelimiter === "|" ? "Pipe"
			: `"${state.detectedDelimiter}"`;
		addStat("Delimiter", delimLabel);
		if (file?.stat) {
			const kb = (file.stat.size / 1024).toFixed(1);
			addStat("Size", `${kb} KB`);
		}
		addStat("Last Import", state.lastImportedAt
			? formatRelativeTime(state.lastImportedAt)
			: "Never");
	}

	private renderDataSnapshot(container: HTMLElement): void {
		const data = this.deps.getData();
		const state = this.deps.getState();

		const lines = data.split("\n").filter((l) => l.trim());
		if (lines.length < 2) return;

		this.cachedAllHeaders = splitCsvLine(lines[0], state.detectedDelimiter);
		this.cachedAllRows = lines.slice(1).map((l) => splitCsvLine(l, state.detectedDelimiter));

		// Heading + row count badge + reset button (built once)
		const headingRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headingRow.createEl("h3", { text: "Data Snapshot", cls: "ft-heading ft-heading-sm" });
		this.previewBadgeEl = headingRow.createSpan({ cls: "ft-badge ft-badge-muted" });
		this.previewHiddenBadgeEl = headingRow.createSpan({ cls: "ft-badge ft-badge-muted" });
		// Reset columns button (shown/hidden dynamically by updatePreviewTable)
		this.previewResetEl = headingRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(this.previewResetEl.createSpan(), "rotate-ccw");
		this.previewResetEl.appendText(" Reset");
		this.previewResetEl.style.display = "none";
		this.previewResetEl.addEventListener("click", () => {
			this.deps.setState({ hiddenColumns: [] });
			this.persistDisplaySettings();
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
					this.persistDisplaySettings();
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
			this.persistDisplaySettings();
			this.updatePreviewTable();
		});
		const filterInput = filterBar.createEl("input", { type: "text" });
		filterInput.placeholder = "Type to filter rows...";
		filterInput.value = state.filterText;
		filterInput.addEventListener("input", () => {
			this.deps.setState({ filterText: filterInput.value });
			this.persistDisplaySettings();
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
				this.persistDisplaySettings();
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

	private persistDisplaySettings(): void {
		const file = this.deps.getFile();
		if (!file) return;
		const state = this.deps.getState();
		this.deps.dataExchangeService.saveCsvDisplaySettings(file.path, {
			sortColumn: state.previewSortColumn,
			sortDirection: state.previewSortDir,
			hiddenColumns: [...state.hiddenColumns],
			filterColumn: state.filterColumn,
			filterText: state.filterText,
			maxPreviewRows: state.previewMaxRows,
			lastImportedAt: state.lastImportedAt ?? undefined,
		}).catch((err) => console.error("[Flowti] Failed to persist CSV display settings", err));
	}

	/** Shows a CTA to create a CSV doc when none exists. Skips if doc already exists. */
	private renderCsvDocSection(container: HTMLElement): void {
		const file = this.deps.getFile();
		if (!file) return;
		const docPath = this.deps.dataExchangeService.getCsvDocPath(file.path);
		if (this.deps.app.vault.getAbstractFileByPath(docPath)) return;

		const cta = container.createDiv({ cls: "ft-doc-cta ft-mb-3" });
		const icon = cta.createDiv({ cls: "ft-doc-cta-icon" });
		setIcon(icon, "file-plus");
		const text = cta.createDiv();
		text.createDiv({ text: "No documentation yet", cls: "ft-text-sm" }).style.fontWeight = "500";
		text.createDiv({
			text: "Create a doc file to track notes, data sources, and context for this CSV.",
			cls: "ft-text-sm ft-text-muted",
		});
		const ctaBtn = cta.createEl("button", { text: "Create Doc", cls: "ft-btn ft-btn-sm" });
		ctaBtn.addEventListener("click", () => this.createCsvDocAndOpen());
	}

	/** Shows how this CSV is used across saved import configs. */
	private renderConfigUsage(container: HTMLElement): void {
		const file = this.deps.getFile();
		if (!file) return;

		const importConfigs = this.deps.dataExchangeService.getImportConfigsForFile(file.path);

		const section = container.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Usage", cls: "ft-heading ft-heading-sm ft-mb-2" });

		if (importConfigs.length > 0) {
			const importCard = section.createDiv({ cls: "ft-card ft-mb-2" });
			const importHeader = importCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const importIcon = importHeader.createSpan();
			setIcon(importIcon, "file-input");
			importIcon.addClass("ft-icon-muted");
			importHeader.createSpan({ text: "Used by import", cls: "ft-text-sm" }).style.fontWeight = "500";
			for (const cfg of importConfigs) {
				this.renderImportConfigRow(importCard, cfg);
			}
		} else {
			const emptyCard = section.createDiv({ cls: "ft-card ft-mb-2" });
			emptyCard.createDiv({
				text: "No saved import configurations reference this file yet.",
				cls: "ft-text-sm ft-text-muted ft-mb-2",
			});
			const actionsRow = emptyCard.createDiv({ cls: "ft-flex ft-gap-2" });
			const importBtn = actionsRow.createEl("span", { cls: "ft-nav-link" });
			setIcon(importBtn.createSpan(), "file-input");
			importBtn.appendText(" Create Import Config");
			importBtn.addEventListener("click", () => {
				void this.deps.startImportWizard();
			});
		}

		// Progress area for inline import execution
		this.usageProgressEl = section.createDiv();
	}

	/** Finds .base files whose inFolder filter matches any import config target folder. */
	private findAssociatedBases(): { path: string; name: string }[] {
		const file = this.deps.getFile();
		if (!file) return [];
		const configs = this.deps.dataExchangeService.getImportConfigsForFile(file.path);
		const targetFolders = new Set(configs.map((c) => c.targetFolder).filter(Boolean));

		// Collect explicit basePath entries from configs
		const explicitPaths = new Set<string>();
		for (const cfg of configs) {
			if (cfg.basePath) {
				let bp = cfg.basePath.trim();
				if (bp && !bp.endsWith(".base")) bp += ".base";
				if (bp) explicitPaths.add(bp);
			}
		}

		if (targetFolders.size === 0 && explicitPaths.size === 0) return [];

		const results: { path: string; name: string }[] = [];
		const seen = new Set<string>();
		const allFiles = this.deps.app.vault.getFiles();
		for (const f of allFiles) {
			if (!f.path.endsWith(".base")) continue;
			if (seen.has(f.path)) continue;

			// Direct match from config basePath
			if (explicitPaths.has(f.path)) {
				results.push({ path: f.path, name: f.basename });
				seen.add(f.path);
				continue;
			}

			// Check if the base file lives in or next to a target folder
			for (const folder of targetFolders) {
				const baseDir = f.path.substring(0, f.path.lastIndexOf("/"));
				if (baseDir === folder || f.path.startsWith(folder + "/")) {
					results.push({ path: f.path, name: f.basename });
					seen.add(f.path);
					break;
				}
			}
		}
		return results;
	}

	/** Shows associated .base view files on the landing page. */
	private renderAssociatedBases(container: HTMLElement): void {
		// Persistent wrapper so we can refresh after import
		if (!this.basesContainerEl || !this.basesContainerEl.isConnected) {
			this.basesContainerEl = container.createDiv();
		}
		this.basesContainerEl.empty();

		const bases = this.findAssociatedBases();
		if (bases.length === 0) return;

		const section = this.basesContainerEl.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Associated Views", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const card = section.createDiv({ cls: "ft-card ft-mb-2" });
		const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		const iconEl = cardHeader.createSpan();
		setIcon(iconEl, "table");
		iconEl.addClass("ft-icon-muted");
		cardHeader.createSpan({ text: "Base views", cls: "ft-text-sm" }).style.fontWeight = "500";

		for (const base of bases) {
			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const link = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const linkIcon = link.createSpan();
			setIcon(linkIcon, "file-code");
			link.appendText(` ${base.name}`);
			link.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(base.path, "", false);
			});
			row.createSpan({ text: base.path, cls: "ft-text-sm ft-text-muted" });
		}
	}

	/** Refreshes the associated bases section without re-rendering the full landing page. */
	private refreshAssociatedBases(): void {
		if (this.basesContainerEl?.isConnected) {
			this.basesContainerEl.empty();
			const bases = this.findAssociatedBases();
			if (bases.length === 0) return;

			const section = this.basesContainerEl.createDiv({ cls: "ft-mb-3" });
			section.createEl("h3", { text: "Associated Views", cls: "ft-heading ft-heading-sm ft-mb-2" });

			const card = section.createDiv({ cls: "ft-card ft-mb-2" });
			const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const iconEl = cardHeader.createSpan();
			setIcon(iconEl, "table");
			iconEl.style.opacity = "0.5";
			cardHeader.createSpan({ text: "Base views", cls: "ft-text-sm" }).style.fontWeight = "500";

			for (const base of bases) {
				const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
				const link = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const linkIcon = link.createSpan();
				setIcon(linkIcon, "file-code");
				link.appendText(` ${base.name}`);
				link.addEventListener("click", () => {
					void this.deps.app.workspace.openLinkText(base.path, "", false);
				});
				row.createSpan({ text: base.path, cls: "ft-text-sm ft-text-muted" });
			}
		}
	}

	/** Renders a single import config row with details and execute button. */
	private renderImportConfigRow(container: HTMLElement, cfg: SavedImportConfig): void {
		const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		const nameLink = row.createEl("span", {
			text: cfg.name,
			cls: "ft-nav-link ft-text-sm",
		});
		nameLink.style.fontWeight = "500";
		nameLink.addEventListener("click", () => this.deps.openHubImportConfig(cfg.id));
		row.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
		row.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });

		// Preview button
		const previewBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(previewBtn.createSpan(), "eye");
		previewBtn.appendText(" Preview");
		previewBtn.addEventListener("click", () => {
			this.deps.setState({ pendingSavedConfig: cfg });
			void this.deps.startImportWizard(true);
		});

		// Execute button
		const runBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(runBtn.createSpan(), "play");
		runBtn.appendText(" Run");
		runBtn.addEventListener("click", () => {
			this.executeImportFromUsage(cfg);
		});
	}

	/** Executes a saved import config from the usage section with inline progress. */
	private executeImportFromUsage(cfg: SavedImportConfig): void {
		if (!cfg.sourcePath) return;

		// Show initial progress UI
		this.renderUsageProgress(cfg.name, 0, 0);

		void this.deps.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: cfg.sourcePath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: cfg.customProperties,
			},
		});

		const offProgress = this.deps.eventBus.on("dataExchange.import.progress", (event) => {
			this.renderUsageProgress(cfg.name, event.payload.current, event.payload.total);
		});

		const offComplete = this.deps.eventBus.on("dataExchange.import.completed", (event) => {
			offProgress(); offComplete(); offFailed();
			const r = event.payload.result;
			this.renderUsageResult(r);
			// Record last import timestamp
			this.deps.setState({ lastImportedAt: Date.now() });
			this.persistDisplaySettings();
			// Refresh bases section so newly created .base files appear
			setTimeout(() => this.refreshAssociatedBases(), 500);
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
		});
		const offFailed = this.deps.eventBus.on("dataExchange.import.failed", (event) => {
			offProgress(); offComplete(); offFailed();
			this.renderUsageError(event.payload.error);
			new Notice(`Import failed: ${event.payload.error}`);
		});
	}

	/** Renders the inline progress bar for a running import in the usage section. */
	private renderUsageProgress(name: string, current: number, total: number): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-card ft-mb-2" });
		const wrapper = card.createDiv({ cls: "ft-flex-col ft-gap-2" });
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const spinIcon = header.createSpan();
		setIcon(spinIcon, "loader");
		spinIcon.addClass("ft-icon-muted");
		header.createSpan({ text: `Running import: ${name}`, cls: "ft-text-sm" }).style.fontWeight = "500";

		wrapper.createDiv({
			text: total > 0 ? `Processing row ${current} of ${total}...` : "Starting import...",
			cls: "ft-text-sm ft-text-muted",
		});

		const bar = wrapper.createDiv({ cls: "ft-progress-bar" });
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		const pct = total > 0 ? (current / total) * 100 : 0;
		fill.style.width = `${pct}%`;
	}

	/** Shows the import result summary inline in the usage section. */
	private renderUsageResult(result: ImportResult): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-card ft-mb-2" });
		const wrapper = card.createDiv({ cls: "ft-flex-col ft-gap-2" });
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const checkIcon = header.createSpan();
		setIcon(checkIcon, "check-circle");
		checkIcon.addClass("ft-icon-muted");
		header.createSpan({ text: "Import Complete", cls: "ft-text-sm" }).style.fontWeight = "500";
		header.createDiv({ cls: "ft-flex-1" });
		const dismissBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(dismissBtn, "x");
		dismissBtn.addEventListener("click", () => { this.usageProgressEl?.empty(); });

		const stats = wrapper.createDiv({ cls: "ft-flex ft-gap-2" });
		stats.createSpan({ text: `${result.created} created`, cls: "ft-badge ft-badge-muted" });
		stats.createSpan({ text: `${result.updated} updated`, cls: "ft-badge ft-badge-muted" });
		stats.createSpan({ text: `${result.skipped} skipped`, cls: "ft-badge ft-badge-muted" });
		if (result.failed > 0) {
			stats.createSpan({ text: `${result.failed} failed`, cls: "ft-badge ft-badge-accent" });
		}
	}

	/** Shows an import error inline in the usage section. */
	private renderUsageError(error: string): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-alert-error ft-p-3 ft-mb-2" });
		const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		cardHeader.createEl("strong", { text: "Import failed: " });
		cardHeader.createSpan({ text: error });
		cardHeader.createDiv({ cls: "ft-flex-1" });
		const dismissBtn = cardHeader.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(dismissBtn, "x");
		dismissBtn.addEventListener("click", () => { this.usageProgressEl?.empty(); });
	}

	/** Creates a CSV doc file and opens it. */
	private createCsvDocAndOpen(): void {
		const file = this.deps.getFile();
		const data = this.deps.getData();
		const state = this.deps.getState();
		if (!file) return;
		const csvLines = data.split("\n").filter((l) => l.trim());
		const csvHeaders = csvLines.length > 0 ? splitCsvLine(csvLines[0], state.detectedDelimiter) : [];
		const csvRowCount = Math.max(0, csvLines.length - 1);
		void this.deps.dataExchangeService
			.createCsvDoc(file.path, csvHeaders, csvRowCount, state.detectedDelimiter)
			.then((path) => {
				new Notice("CSV documentation created");
				void this.deps.app.workspace.openLinkText(path, "", false);
			})
			.catch((err) => console.error("[Flowti] Failed to create CSV doc", err));
	}
}
