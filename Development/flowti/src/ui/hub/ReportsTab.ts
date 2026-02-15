/**
 * Reports tab component for the Data Exchange Hub.
 * Unified list of all CSV files with documentation status, config badges,
 * and encouragement to create docs for undocumented files.
 */

import { Notice, TFile, setIcon } from "obsidian";
import { CsvParser } from "../../domain/dataExchange/CsvParser";
import { ConfirmModal } from "../modals";
import { addInfoRow, renderEmptyDetail, getEmptyDetailStats, renderFrontmatterAlert, renderScanIssuesBanner } from "./helpers";
import type { CsvFileEntry, HubComponentDeps, ReportEntry } from "./types";

export class ReportsTab {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		const hiddenPaths = this.deps.dataExchangeService.getHiddenCsvPaths();
		const hiddenSet = new Set(hiddenPaths);

		// All CSV files, filtered by search
		let allCsv = state.csvFileEntries;
		if (state.filterText) {
			allCsv = allCsv.filter((e) =>
				e.name.toLowerCase().includes(state.filterText)
				|| e.displayName.toLowerCase().includes(state.filterText),
			);
		}

		// Partition: documented / undocumented / hidden
		const visible = allCsv.filter((e) => !hiddenSet.has(e.path));
		const hidden = allCsv.filter((e) => hiddenSet.has(e.path));
		const documented = this.sortUsedFirst(visible.filter((e) => e.hasDoc));
		const undocumented = this.sortUsedFirst(visible.filter((e) => !e.hasDoc));

		// ── Scan issues banner (only report-folder issues) ──
		const reportsFolder = this.deps.dataExchangeService.getReportsFolderPath();
		const reportIssues = state.frontmatterIssues.filter((i) => i.filePath.startsWith(reportsFolder));
		renderScanIssuesBanner(this.masterEl, reportIssues);

		// ── Coverage summary ──
		const totalVisible = state.showHiddenCsvs ? allCsv.length : visible.length;
		const docCount = state.showHiddenCsvs
			? allCsv.filter((e) => e.hasDoc).length
			: documented.length;
		this.renderCoverageSummary(totalVisible, docCount);

		// ── Documented section (first) ──
		if (documented.length > 0 || undocumented.length === 0) {
			const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			header.style.marginTop = "0.75rem";
			header.createSpan({ text: "Documented" });
			header.createSpan({
				text: `${documented.length}`,
				cls: "ft-master-category-count",
			});

			if (documented.length === 0) {
				this.masterEl.createDiv({
					text: state.filterText ? "No matching documented reports" : "No documented CSV files yet",
					cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm",
				});
			} else {
				for (const entry of documented) {
					this.renderCsvItem(entry, false);
				}
			}
		}

		// ── Undocumented section ──
		if (undocumented.length > 0) {
			const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			header.style.marginTop = "1rem";
			header.createSpan({ text: "Undocumented" });
			header.createSpan({
				text: `${undocumented.length}`,
				cls: "ft-master-category-count",
			});

			for (const entry of undocumented) {
				this.renderCsvItem(entry, false);
			}
		}

		// ── Hidden section ──
		if (hidden.length > 0) {
			const toggleRow = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-2" });
			toggleRow.style.marginTop = "1rem";
			const toggleChip = toggleRow.createSpan({
				cls: `ft-badge ${state.showHiddenCsvs ? "" : "ft-badge-muted"}`,
			});
			toggleChip.addClass("ft-cursor-pointer");
			const eyeIcon = toggleChip.createSpan();
			setIcon(eyeIcon, state.showHiddenCsvs ? "eye" : "eye-off");
			eyeIcon.style.marginRight = "0.25rem";
			toggleChip.appendText(`${state.showHiddenCsvs ? "Hide" : "Show"} hidden (${hidden.length})`);
			toggleChip.addEventListener("click", () => {
				this.deps.setState({ showHiddenCsvs: !state.showHiddenCsvs });
				this.deps.scheduleRender();
			});

			if (state.showHiddenCsvs) {
				for (const entry of hidden) {
					this.renderCsvItem(entry, true);
				}
			}
		}

		// ── Empty state ──
		if (visible.length === 0 && hidden.length === 0) {
			this.masterEl.createDiv({
				text: state.filterText ? "No matching CSV files" : "No CSV files found in vault",
				cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm",
			});
		}
	}

	private renderCoverageSummary(total: number, documented: number): void {
		const summary = this.masterEl.createDiv({ cls: "ft-card ft-p-3 ft-mb-2" });
		summary.style.margin = "0.5rem";

		const row = summary.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = row.createSpan();
		setIcon(iconEl, "file-spreadsheet");
		iconEl.addClass("ft-icon-muted");
		row.createSpan({
			text: `${documented} / ${total} documented`,
			cls: "ft-text-sm",
		});

		// Progress bar
		const pct = total > 0 ? Math.round((documented / total) * 100) : 100;
		const bar = summary.createDiv({ cls: "ft-progress-bar ft-mt-1" });
		bar.style.height = "4px";
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		fill.style.width = `${pct}%`;
	}

	private renderCsvItem(entry: CsvFileEntry, isHidden: boolean): void {
		const state = this.deps.getState();
		const isSelected = state.selectedCsvFilePath === entry.path
			|| (entry.hasDoc && state.selectedReportPath !== null
				&& state.reportEntries.some((r) => r.path === state.selectedReportPath && this.reportMatchesCsv(r, entry)));
		const item = this.masterEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		if (isHidden) {
			item.addClass("ft-icon-muted");
		}

		// Icon
		const iconEl = item.createSpan();
		setIcon(iconEl, "file-spreadsheet");
		iconEl.addClass(entry.hasDoc ? "ft-icon-muted" : "ft-icon-faint");
		iconEl.addClass("ft-flex-shrink-0");

		// Name (with folder disambiguation when colliding)
		item.createSpan({ text: entry.displayName, cls: "ft-master-event-name" });

		// Status badges
		if (!entry.hasDoc && !isHidden) {
			const docHint = item.createSpan({ cls: "ft-badge ft-badge-muted ft-cursor-pointer" });
			docHint.style.gap = "0.2rem";
			const plusIcon = docHint.createSpan();
			plusIcon.style.display = "inline-flex";
			plusIcon.style.width = "12px";
			plusIcon.style.height = "12px";
			plusIcon.style.flexShrink = "0";
			setIcon(plusIcon, "plus");
			docHint.createSpan({ text: "doc" });
			docHint.addEventListener("click", (e) => {
				e.stopPropagation();
				this.createDocForEntry(entry);
			});
		}

		// NoteType badge for documented reports
		if (entry.hasDoc) {
			const report = this.findReportForCsv(entry);
			const nt = report?.frontmatter?.noteType;
			if (typeof nt === "string" && nt) {
				item.createSpan({ text: nt, cls: "ft-badge" });
			}
			// Warning indicator for frontmatter issues
			if (report && report.frontmatterIssues.length > 0) {
				const warnIcon = item.createSpan();
				setIcon(warnIcon, "alert-triangle");
				warnIcon.style.color = "rgb(250, 204, 21)";
				warnIcon.style.flexShrink = "0";
				warnIcon.title = report.frontmatterIssues.join("\n");
			}
		}

		if (entry.importConfigs.length > 0) {
			item.createSpan({
				text: `${entry.importConfigs.length} imp`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		if (entry.exportConfigs.length > 0) {
			item.createSpan({
				text: `${entry.exportConfigs.length} exp`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		item.addEventListener("click", () => {
			// If documented, select the report; otherwise select the CSV file
			if (entry.hasDoc) {
				const report = this.findReportForCsv(entry);
				if (report) {
					this.deps.setState({ selectedReportPath: report.path, selectedCsvFilePath: null });
				} else {
					this.deps.setState({ selectedCsvFilePath: entry.path, selectedReportPath: null });
				}
			} else {
				this.deps.setState({ selectedCsvFilePath: entry.path, selectedReportPath: null });
			}
			this.renderMaster();
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		const state = this.deps.getState();

		// Report detail (documented CSV)
		if (state.selectedReportPath) {
			const report = state.reportEntries.find((r) => r.path === state.selectedReportPath);
			if (report) {
				this.renderReportDetailContent(report);
				return;
			}
		}

		// CSV file detail — auto-promote to report detail if doc now exists
		if (state.selectedCsvFilePath) {
			const csvFile = state.csvFileEntries.find((e) => e.path === state.selectedCsvFilePath);
			if (csvFile) {
				if (csvFile.hasDoc) {
					const report = this.findReportForCsv(csvFile);
					if (report) {
						this.deps.setState({ selectedReportPath: report.path, selectedCsvFilePath: null });
						this.renderReportDetailContent(report);
						return;
					}
				}
				this.renderCsvFileDetail(csvFile);
				return;
			}
		}

		// Empty state
		const { count, label } = getEmptyDetailStats(this.deps);
		renderEmptyDetail(this.detailEl, "file-spreadsheet", "Select a CSV file to view details", count, label);
	}

	// ─────────────────────────────────────────────────────────
	// Report detail (documented CSV)
	// ─────────────────────────────────────────────────────────

	private renderReportDetailContent(report: ReportEntry): void {
		const fm = report.frontmatter;
		const fmNoteType = typeof fm.noteType === "string" ? fm.noteType : "";

		// Resolve the full CSV vault path from frontmatter
		const resolvedCsvPath = this.resolveCsvPath(fm);

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: report.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Documented", cls: "ft-operation-badge ft-operation-badge-import" });
		if (fmNoteType) {
			badges.createSpan({ text: fmNoteType, cls: "ft-badge" });
		}

		// Frontmatter issues alert
		renderFrontmatterAlert(this.detailEl, report.frontmatterIssues);

		// Actions — directly under the header
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Doc");
		openLink.addEventListener("click", () => {
			void this.deps.app.workspace.openLinkText(report.path, "", false);
		});

		if (resolvedCsvPath) {
			const openCsvLink = actions.createEl("span", { cls: "ft-nav-link" });
			const csvIcon = openCsvLink.createSpan();
			setIcon(csvIcon, "file-spreadsheet");
			openCsvLink.appendText(" Open CSV");
			openCsvLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(resolvedCsvPath, "", false);
			});

			const importLink = actions.createEl("span", { cls: "ft-nav-link" });
			const impIcon = importLink.createSpan();
			setIcon(impIcon, "file-input");
			importLink.appendText(" Import");
			importLink.addEventListener("click", () => {
				this.deps.navigation.openCsvImport(resolvedCsvPath);
			});
		}

		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete Doc");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete documentation "${report.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deps.eventBus.emit("doc.delete", {
						path: report.path,
						source: "ReportsTab",
					}).then(() => {
						this.deps.setState({ selectedReportPath: null });
						this.deps.scheduleRender();
						new Notice("Report documentation deleted");
					});
				},
			}).open();
		});

		// Note Type (editable)
		const typeCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const typeRow = typeCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		typeRow.style.padding = "0.25rem 0";
		typeRow.createSpan({ text: "Note Type", cls: "ft-text-sm ft-text-muted" });
		const typeInput = typeRow.createEl("input", { cls: "ft-text-sm", type: "text" });
		typeInput.value = fmNoteType;
		typeInput.placeholder = "e.g. Event, Asset, Service";
		typeInput.style.flex = "1";
		typeInput.style.background = "transparent";
		typeInput.style.border = "1px solid var(--background-modifier-border)";
		typeInput.style.borderRadius = "4px";
		typeInput.style.padding = "0.25rem 0.5rem";
		typeInput.style.color = "var(--text-normal)";
		typeInput.addEventListener("change", () => {
			const file = this.deps.app.vault.getAbstractFileByPath(report.path);
			if (file instanceof TFile) {
				void this.deps.app.fileManager.processFrontMatter(file, (frontmatter) => {
					frontmatter.noteType = typeInput.value || "";
				});
			}
		});

		// Frontmatter properties
		const skipKeys = new Set(["position", "type", "noteType"]);
		const entries = Object.entries(fm).filter(([k]) => !skipKeys.has(k));

		if (entries.length > 0) {
			const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			const grid = card.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of entries) {
				const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
				addInfoRow(grid, key, displayValue);
			}
		}

		// Headers list
		const headers = fm.headers;
		if (Array.isArray(headers) && headers.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `Columns (${headers.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const h of headers) {
				chips.createSpan({ text: String(h), cls: "ft-badge ft-badge-muted" });
			}
		}

		// Import configs referencing this CSV
		if (resolvedCsvPath) {
			const importConfigs = this.deps.dataExchangeService.getImportConfigsForFile(resolvedCsvPath);
			if (importConfigs.length > 0) {
				const cfgSection = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
				cfgSection.createDiv({ text: "Import Configs", cls: "ft-detail-section-header" });
				for (const cfg of importConfigs) {
					const item = cfgSection.createDiv({ cls: "ft-master-event-item" });
					const iconEl = item.createSpan();
					setIcon(iconEl, "file-input");
					iconEl.addClass("ft-icon-muted");
					iconEl.addClass("ft-flex-shrink-0");
					item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
					item.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
					item.addEventListener("click", () => {
						this.deps.setState({ selectedImportId: cfg.id });
						this.deps.navigation.navigateTo("imports");
					});
				}
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// CSV file detail (undocumented)
	// ─────────────────────────────────────────────────────────

	private renderCsvFileDetail(entry: CsvFileEntry): void {
		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: entry.displayName, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "CSV File", cls: "ft-operation-badge" });
		if (!entry.hasDoc) {
			badges.createSpan({ text: "Undocumented", cls: "ft-badge ft-badge-muted" });
		}

		// Actions — directly under the header
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		if (!entry.hasDoc) {
			const docLink = actions.createEl("span", { cls: "ft-nav-link" });
			const docIcon = docLink.createSpan();
			setIcon(docIcon, "file-plus");
			docLink.appendText(" Create Doc");
			docLink.addEventListener("click", () => {
				this.createDocForEntry(entry);
			});
		}

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-spreadsheet");
		openLink.appendText(" Open CSV");
		openLink.addEventListener("click", () => {
			const file = this.deps.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) {
				void this.deps.app.workspace.getLeaf(false).openFile(file);
			}
		});

		const importLink = actions.createEl("span", { cls: "ft-nav-link" });
		const impIcon = importLink.createSpan();
		setIcon(impIcon, "file-input");
		importLink.appendText(" Import");
		importLink.addEventListener("click", () => {
			this.deps.navigation.openCsvImport(entry.path);
		});

		const hiddenPaths = this.deps.dataExchangeService.getHiddenCsvPaths();
		const isHidden = new Set(hiddenPaths).has(entry.path);
		const hideLink = actions.createEl("span", { cls: "ft-nav-link ft-text-muted" });
		const hideIcon = hideLink.createSpan();
		setIcon(hideIcon, isHidden ? "eye" : "eye-off");
		hideLink.appendText(isHidden ? " Unhide" : " Hide");
		hideLink.addEventListener("click", () => {
			if (isHidden) {
				void this.deps.dataExchangeService.unhideCsv(entry.path).then(() => {
					this.deps.scheduleRender();
				});
			} else {
				void this.deps.dataExchangeService.hideCsv(entry.path).then(() => {
					this.deps.scheduleRender();
				});
			}
		});

		// Prominent "Create Documentation" CTA — only for undocumented files
		if (!entry.hasDoc) {
			const ctaCard = this.detailEl.createDiv({ cls: "ft-card ft-p-3 ft-mt-3" });
			ctaCard.style.borderColor = "var(--interactive-accent)";
			ctaCard.style.borderStyle = "dashed";

			const ctaRow = ctaCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const ctaIcon = ctaRow.createSpan();
			setIcon(ctaIcon, "file-plus");
			ctaIcon.style.color = "var(--interactive-accent)";
			const ctaText = ctaRow.createDiv();
			ctaText.createDiv({ text: "Create Report Documentation", cls: "ft-heading ft-heading-sm" }).style.margin = "0";
			ctaText.createDiv({
				text: "Document this CSV file to track its schema, purpose, and import configurations.",
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });
		addInfoRow(grid, "Path", entry.path);
		if (entry.importConfigs.length > 0) {
			addInfoRow(grid, "Import Configs", entry.importConfigs.map((c) => c.name).join(", "));
		}
		if (entry.exportConfigs.length > 0) {
			addInfoRow(grid, "Export Configs", entry.exportConfigs.map((c) => c.name).join(", "));
		}

		// Column preview (async — reads CSV on demand)
		const columnsPlaceholder = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
		const file = this.deps.app.vault.getAbstractFileByPath(entry.path);
		if (file instanceof TFile) {
			columnsPlaceholder.createDiv({ text: "Loading columns…", cls: "ft-text-muted ft-text-sm ft-p-2" });
			void this.deps.app.vault.read(file).then((content) => {
				columnsPlaceholder.empty();
				const parsed = new CsvParser().parse(content);
				if (parsed.headers.length === 0) return;
				columnsPlaceholder.createDiv({
					text: `Columns (${parsed.headers.length})`,
					cls: "ft-detail-section-header",
				});
				const rowInfo = columnsPlaceholder.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2" });
				rowInfo.textContent = `${parsed.rowCount} row${parsed.rowCount !== 1 ? "s" : ""}`;
				const chips = columnsPlaceholder.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
				chips.style.flexWrap = "wrap";
				chips.style.padding = "0.25rem 0.5rem";
				for (const h of parsed.headers) {
					chips.createSpan({ text: h, cls: "ft-badge ft-badge-muted" });
				}
			});
		}

		// Import configs detail
		if (entry.importConfigs.length > 0) {
			const cfgSection = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			cfgSection.createDiv({ text: "Import Configs", cls: "ft-detail-section-header" });
			for (const cfg of entry.importConfigs) {
				const item = cfgSection.createDiv({ cls: "ft-master-event-item" });
				const iconEl = item.createSpan();
				setIcon(iconEl, "file-input");
				iconEl.addClass("ft-icon-muted");
				iconEl.addClass("ft-flex-shrink-0");
				item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
				item.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
				item.addEventListener("click", () => {
					this.deps.setState({ selectedImportId: cfg.id });
					this.deps.navigation.navigateTo("imports");
				});
			}
		}

		// Base views
		if (entry.baseViews.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `Base Views (${entry.baseViews.length})`, cls: "ft-detail-section-header" });
			for (const bv of entry.baseViews) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const iconEl = item.createSpan();
				setIcon(iconEl, "database");
				iconEl.addClass("ft-icon-muted");
				iconEl.addClass("ft-flex-shrink-0");
				item.createSpan({ text: bv.name, cls: "ft-master-event-name" });
				item.addEventListener("click", () => {
					void this.deps.app.workspace.openLinkText(bv.path, "", false);
				});
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────

	/** Sort entries so those with import or export configs appear first. */
	private sortUsedFirst(entries: CsvFileEntry[]): CsvFileEntry[] {
		return [...entries].sort((a, b) => {
			const aUsed = a.importConfigs.length + a.exportConfigs.length > 0 ? 1 : 0;
			const bUsed = b.importConfigs.length + b.exportConfigs.length > 0 ? 1 : 0;
			if (aUsed !== bUsed) return bUsed - aUsed;
			return a.name.localeCompare(b.name);
		});
	}

	private findReportForCsv(entry: CsvFileEntry): ReportEntry | undefined {
		const state = this.deps.getState();
		return state.reportEntries.find((r) => this.reportMatchesCsv(r, entry));
	}

	private reportMatchesCsv(report: ReportEntry, entry: CsvFileEntry): boolean {
		// Prefer the full vault path stored in filePath — definitive match
		const filePath = report.frontmatter.filePath;
		if (typeof filePath === "string") return filePath === entry.path;

		// Fallback (only when filePath absent): match wikilink basename
		const csvFile = report.frontmatter.csvFile;
		if (typeof csvFile !== "string") return false;
		const match = csvFile.match(/\[\[(.+?)\]\]/);
		const csvName = match ? match[1] : csvFile;
		return entry.path === csvName || entry.path.endsWith(`/${csvName}`);
	}

	/** Resolve the full vault path to the CSV file from CsvDoc frontmatter. */
	private resolveCsvPath(fm: Record<string, unknown>): string | null {
		// Prefer explicit filePath (full vault path)
		if (typeof fm.filePath === "string" && fm.filePath) return fm.filePath;
		// Fallback: extract basename from wikilink
		const csvFile = fm.csvFile;
		if (typeof csvFile === "string") {
			const match = csvFile.match(/\[\[(.+?)\]\]/);
			return match ? match[1] : csvFile;
		}
		return null;
	}

	private createDocForEntry(entry: CsvFileEntry): void {
		const file = this.deps.app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) return;
		void this.deps.app.vault.read(file).then((content) => {
			const parsed = new CsvParser().parse(content);
			return this.deps.dataExchangeService.createCsvDoc(
				entry.path, parsed.headers, parsed.rowCount, parsed.detectedDelimiter,
			);
		}).then(() => {
			new Notice(`Report created for ${entry.name}`);
			// Keep selectedCsvFilePath — auto-promote in renderDetail() switches
			// to report view once scanCsvDocs() finds the entry after metadataCache indexes it
			setTimeout(() => this.deps.scheduleRender(), 500);
		});
	}
}
