/**
 * Detail panel component for the Reports tab.
 * Handles rendering of documented report details and undocumented CSV file details.
 */

import { Notice, TFile, setIcon } from "obsidian";
import { CsvParser } from "../../domain/dataExchange/CsvParser";
import { ConfirmModal } from "../modals";
import { addInfoRow, renderEmptyDetail, getEmptyDetailStats, renderFrontmatterAlert } from "./helpers";
import type { CsvFileEntry, HubComponentDeps, ReportEntry } from "./types";

// ─────────────────────────────────────────────────────────────
// Standalone helpers (used by both master list and detail panel)
// ─────────────────────────────────────────────────────────────

export function reportMatchesCsv(report: ReportEntry, entry: CsvFileEntry): boolean {
	const filePath = report.frontmatter.filePath;
	if (typeof filePath === "string") return filePath === entry.path;

	const csvFile = report.frontmatter.csvFile;
	if (typeof csvFile !== "string") return false;
	const match = csvFile.match(/\[\[(.+?)\]\]/);
	const csvName = match ? match[1] : csvFile;
	return entry.path === csvName || entry.path.endsWith(`/${csvName}`);
}

export function resolveCsvPath(fm: Record<string, unknown>): string | null {
	if (typeof fm.filePath === "string" && fm.filePath) return fm.filePath;
	const csvFile = fm.csvFile;
	if (typeof csvFile === "string") {
		const match = csvFile.match(/\[\[(.+?)\]\]/);
		return match ? match[1] : csvFile;
	}
	return null;
}

export function findReportForCsv(reportEntries: ReportEntry[], entry: CsvFileEntry): ReportEntry | undefined {
	return reportEntries.find((r) => reportMatchesCsv(r, entry));
}

export function sortCsvUsedFirst(entries: CsvFileEntry[]): CsvFileEntry[] {
	return [...entries].sort((a, b) => {
		const aUsed = a.importConfigs.length + a.exportConfigs.length > 0 ? 1 : 0;
		const bUsed = b.importConfigs.length + b.exportConfigs.length > 0 ? 1 : 0;
		if (aUsed !== bUsed) return bUsed - aUsed;
		return a.name.localeCompare(b.name);
	});
}

export function createDocForCsvEntry(deps: HubComponentDeps, entry: CsvFileEntry): void {
	const file = deps.app.vault.getAbstractFileByPath(entry.path);
	if (!(file instanceof TFile)) return;
	void deps.app.vault.read(file).then((content) => {
		const parsed = new CsvParser().parse(content);
		return deps.dataExchangeService.createCsvDoc(
			entry.path, parsed.headers, parsed.rowCount, parsed.detectedDelimiter,
		);
	}).then(() => {
		new Notice(`Report created for ${entry.name}`);
		setTimeout(() => deps.scheduleRender(), 500);
	});
}

// ─────────────────────────────────────────────────────────────
// Detail panel component
// ─────────────────────────────────────────────────────────────

export class ReportDetailPanel {
	constructor(
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	render(): void {
		this.detailEl.empty();
		const state = this.deps.getState();

		if (state.selectedReportPath) {
			const report = state.reportEntries.find((r) => r.path === state.selectedReportPath);
			if (report) {
				this.renderReportDetail(report);
				return;
			}
		}

		if (state.selectedCsvFilePath) {
			const csvFile = state.csvFileEntries.find((e) => e.path === state.selectedCsvFilePath);
			if (csvFile) {
				if (csvFile.hasDoc) {
					const report = findReportForCsv(state.reportEntries, csvFile);
					if (report) {
						this.deps.setState({ selectedReportPath: report.path, selectedCsvFilePath: null });
						this.renderReportDetail(report);
						return;
					}
				}
				this.renderCsvFileDetail(csvFile);
				return;
			}
		}

		const { count, label } = getEmptyDetailStats(this.deps);
		renderEmptyDetail(this.detailEl, "file-spreadsheet", "Select a CSV file to view details", count, label);
	}

	// ─────────────────────────────────────────────────────────
	// Documented report detail
	// ─────────────────────────────────────────────────────────

	private renderReportDetail(report: ReportEntry): void {
		const fm = report.frontmatter;
		const fmNoteType = typeof fm.noteType === "string" ? fm.noteType : "";
		const resolvedCsv = resolveCsvPath(fm);

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: report.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Documented", cls: "ft-operation-badge ft-operation-badge-import" });
		if (fmNoteType) {
			badges.createSpan({ text: fmNoteType, cls: "ft-badge" });
		}

		renderFrontmatterAlert(this.detailEl, report.frontmatterIssues);

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Doc");
		openLink.addEventListener("click", () => {
			void this.deps.app.workspace.openLinkText(report.path, "", false);
		});

		if (resolvedCsv) {
			const openCsvLink = actions.createEl("span", { cls: "ft-nav-link" });
			const csvIcon = openCsvLink.createSpan();
			setIcon(csvIcon, "file-spreadsheet");
			openCsvLink.appendText(" Open CSV");
			openCsvLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(resolvedCsv, "", false);
			});

			const importLink = actions.createEl("span", { cls: "ft-nav-link" });
			const impIcon = importLink.createSpan();
			setIcon(impIcon, "file-input");
			importLink.appendText(" Import");
			importLink.addEventListener("click", () => {
				this.deps.navigation.openCsvImport(resolvedCsv);
			});

			const analyzeLink = actions.createEl("span", { cls: "ft-nav-link" });
			const analyzeIcon = analyzeLink.createSpan();
			setIcon(analyzeIcon, "bar-chart-2");
			analyzeLink.appendText(" Analyze");
			analyzeLink.addEventListener("click", () => {
				void this.deps.eventBus.emit("ui.openAnalyticsHub", {});
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
		typeRow.createSpan({ text: "Note type", cls: "ft-text-sm ft-text-muted" });
		const typeInput = typeRow.createEl("input", { cls: "ft-text-sm", type: "text" });
		typeInput.value = fmNoteType;
		// eslint-disable-next-line obsidianmd/ui/sentence-case
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
				// Update local state so the value persists across re-renders
				report.frontmatter.noteType = typeInput.value || "";
				setTimeout(() => this.deps.scheduleRender(), 500);
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
		if (resolvedCsv) {
			const importConfigs = this.deps.dataExchangeService.getImportConfigsForFile(resolvedCsv);
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
	// Undocumented CSV file detail
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

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		if (!entry.hasDoc) {
			const docLink = actions.createEl("span", { cls: "ft-nav-link" });
			const docIcon = docLink.createSpan();
			setIcon(docIcon, "file-plus");
			docLink.appendText(" Create Doc");
			docLink.addEventListener("click", () => {
				createDocForCsvEntry(this.deps, entry);
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

		const analyzeLink = actions.createEl("span", { cls: "ft-nav-link" });
		const analyzeIcon = analyzeLink.createSpan();
		setIcon(analyzeIcon, "bar-chart-2");
		analyzeLink.appendText(" Analyze");
		analyzeLink.addEventListener("click", () => {
			void this.deps.eventBus.emit("ui.openAnalyticsHub", {});
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

		// Prominent "Create Documentation" CTA
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

		// Column preview (async)
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
}
