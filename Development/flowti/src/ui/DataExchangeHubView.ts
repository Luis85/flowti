/**
 * Data Exchange Hub — central management view for import/export operations.
 *
 * Follows the same layout and patterns as EventCatalogView:
 * - Dashboard is the landing page (full-height, scrollable, padded)
 * - Sub-pages (Imports / Exports / Dictionary) use the master/detail split layout
 * - Top bar appears on sub-pages with clickable title to return to dashboard
 * - Consistent CSS class usage: ft-catalog-*, ft-master-*, ft-detail-*
 */

import { ItemView, Notice, Setting, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type {
	DataDictionaryEntry,
	ExportFormat,
	SavedImportConfig,
	SavedExportConfig,
} from "../domain/dataExchange/types";
import { ConfirmModal } from "./modals";
import { FilePickerModal } from "./FilePickerModal";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";

export const VIEW_TYPE_DATA_EXCHANGE_HUB = "flowti-data-exchange-hub";

type HubPage = "dashboard" | "imports" | "exports" | "reports" | "properties";

export class DataExchangeHubView extends ItemView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private openCsvImport: (
		csvPath: string,
		savedConfig?: SavedImportConfig,
	) => void;
	private openExport: (savedConfig: SavedExportConfig) => void;
	private openNewExport: (
		sourcePath: string,
		sourceType: "folder" | "base",
		format: ExportFormat,
	) => void;

	// State
	private currentPage: HubPage = "dashboard";
	private importConfigs: SavedImportConfig[] = [];
	private exportConfigs: SavedExportConfig[] = [];
	private selectedImportId: string | null = null;
	private selectedExportId: string | null = null;
	private selectedDictProp: string | null = null;
	private selectedReportPath: string | null = null;
	private dictionaryEntries: DataDictionaryEntry[] = [];
	private reportEntries: Array<{ name: string; path: string; frontmatter: Record<string, unknown> }> = [];
	private filterText = "";
	private showHiddenCsvs = false;
	private editingImportId: string | null = null;
	private editingExportId: string | null = null;
	private csvFileEntries: Array<{
		path: string;
		name: string;
		importConfigs: SavedImportConfig[];
		exportConfigs: SavedExportConfig[];
		hasDoc: boolean;
		baseViews: Array<{ path: string; name: string }>;
	}> = [];

	// DOM references
	private topBarEl!: HTMLElement;
	private countBadgeEl!: HTMLElement;
	private dashboardEl!: HTMLElement;
	private splitEl!: HTMLElement;
	private masterTreeEl!: HTMLElement;
	private detailPanelEl!: HTMLElement;
	private searchInput!: HTMLInputElement;

	// Render
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribes: (() => void)[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		openCsvImport: (
			csvPath: string,
			savedConfig?: SavedImportConfig,
		) => void,
		openExport: (savedConfig: SavedExportConfig) => void,
		openNewExport: (
			sourcePath: string,
			sourceType: "folder" | "base",
			format: ExportFormat,
		) => void,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.openCsvImport = openCsvImport;
		this.openExport = openExport;
		this.openNewExport = openNewExport;
	}

	getViewType(): string {
		return VIEW_TYPE_DATA_EXCHANGE_HUB;
	}

	getDisplayText(): string {
		return "Data Exchange";
	}

	getIcon(): string {
		return "arrow-left-right";
	}

	// ── Lifecycle ────────────────────────────────────────────

	async onOpen(): Promise<void> {
		this.refreshConfigs();

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		// Root wrapper — same as EventCatalogView
		const wrapper = container.createDiv({ cls: "flowti-container" });
		wrapper.style.height = "100%";
		wrapper.style.display = "flex";
		wrapper.style.flexDirection = "column";

		// Top bar (hidden on dashboard, shown on sub-pages)
		this.renderTopBar(wrapper);

		// Dashboard panel (shown by default)
		this.dashboardEl = wrapper.createDiv({ cls: "ft-catalog-dashboard" });
		this.dashboardEl.style.flex = "1";
		this.dashboardEl.style.minHeight = "0";
		this.dashboardEl.style.overflowY = "auto";
		this.dashboardEl.style.padding = "1.5rem";

		// Split container (hidden when dashboard is active)
		this.splitEl = wrapper.createDiv({ cls: "ft-catalog-split ft-hidden" });
		this.splitEl.style.flex = "1";
		this.splitEl.style.minHeight = "0";

		// Master panel (left)
		const master = this.splitEl.createDiv({ cls: "ft-catalog-master" });

		// Search
		const searchHeader = master.createDiv({ cls: "ft-catalog-master-header" });
		this.searchInput = searchHeader.createEl("input", { cls: "ft-catalog-master-search" });
		this.searchInput.type = "text";
		this.searchInput.placeholder = "Search configs...";
		this.searchInput.addEventListener("input", () => {
			this.filterText = this.searchInput.value.toLowerCase();
			this.scheduleRender();
		});

		// Master tree
		this.masterTreeEl = master.createDiv({ cls: "ft-catalog-master-tree" });

		// Detail panel (right)
		this.detailPanelEl = this.splitEl.createDiv({ cls: "ft-catalog-detail" });

		// Subscribe to config changes
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.config.changed", () => {
				this.refreshConfigs();
				this.scheduleRender();
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.completed", () => {
				this.scheduleRender();
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.export.completed", () => {
				this.scheduleRender();
			}),
		);

		this.renderDashboard();
	}

	async onClose(): Promise<void> {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── State ────────────────────────────────────────────────

	private refreshConfigs(): void {
		this.importConfigs = this.dataExchangeService.getSavedImportConfigs();
		this.exportConfigs = this.dataExchangeService.getSavedExportConfigs();
		this.dictionaryEntries = this.dataExchangeService.buildDataDictionary();
		this.scanCsvDocs();
		this.scanCsvFiles();
	}

	/** Scans the Reports folder for CsvDoc files and populates reportEntries. */
	private scanCsvDocs(): void {
		this.reportEntries = [];
		const folder = this.dataExchangeService.getReportsFolderPath();
		const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
		if (!abstractFolder) return;

		// Get all markdown files in the Reports folder that start with "CSV - "
		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			if (!file.path.startsWith(folder + "/")) continue;
			if (!file.basename.startsWith("CSV - ")) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm?.type !== "CsvDoc") continue;
			this.reportEntries.push({
				name: fm.name ? String(fm.name) : file.basename.replace("CSV - ", ""),
				path: file.path,
				frontmatter: fm,
			});
		}
		this.reportEntries.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** Scans the vault for all .csv files and enriches with config, doc, and base view data. */
	private scanCsvFiles(): void {
		this.csvFileEntries = [];

		// Build a map of target folders → base files for proximity matching
		const allFiles = this.app.vault.getFiles();
		const baseFiles = allFiles.filter((f) => f.path.endsWith(".base"));

		for (const file of allFiles) {
			if (!file.path.toLowerCase().endsWith(".csv")) continue;

			const importConfigs = this.dataExchangeService.getImportConfigsForFile(file.path);
			const exportConfigs = this.dataExchangeService.getExportConfigsForOutput(file.path);
			const docPath = this.dataExchangeService.getCsvDocPath(file.path);
			const hasDoc = !!this.app.vault.getAbstractFileByPath(docPath);

			// Find associated .base views via import configs
			const bases: Array<{ path: string; name: string }> = [];
			const seenBases = new Set<string>();
			for (const cfg of importConfigs) {
				// Explicit basePath on config
				if (cfg.basePath) {
					let bp = cfg.basePath.trim();
					if (bp && !bp.endsWith(".base")) bp += ".base";
					if (bp && !seenBases.has(bp) && this.app.vault.getAbstractFileByPath(bp)) {
						bases.push({ path: bp, name: bp.split("/").pop()?.replace(/\.base$/, "") ?? bp });
						seenBases.add(bp);
					}
				}
				// Base files in or adjacent to target folder
				if (cfg.targetFolder) {
					for (const bf of baseFiles) {
						if (seenBases.has(bf.path)) continue;
						const baseDir = bf.path.substring(0, bf.path.lastIndexOf("/"));
						if (baseDir === cfg.targetFolder || bf.path.startsWith(cfg.targetFolder + "/")) {
							bases.push({ path: bf.path, name: bf.name.replace(/\.base$/, "") });
							seenBases.add(bf.path);
						}
					}
				}
			}

			this.csvFileEntries.push({
				path: file.path,
				name: file.name,
				importConfigs,
				exportConfigs,
				hasDoc,
				baseViews: bases,
			});
		}
		this.csvFileEntries.sort((a, b) => a.name.localeCompare(b.name));
	}

	private updateCountBadge(): void {
		if (!this.countBadgeEl) return;
		const total = this.importConfigs.length + this.exportConfigs.length;
		this.countBadgeEl.textContent = `${total} config${total !== 1 ? "s" : ""}`;
	}

	private scheduleRender(): void {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.refreshConfigs();
			this.updateCountBadge();
			switch (this.currentPage) {
				case "dashboard":
					this.renderDashboard();
					break;
				case "imports":
					this.renderImportsMaster();
					this.renderImportsDetail();
					break;
				case "exports":
					this.renderExportsMaster();
					this.renderExportsDetail();
					break;
				case "reports":
					this.renderReportsMaster();
					this.renderReportsDetail();
					break;
				case "properties":
					this.renderPropertiesMaster();
					this.renderPropertiesDetail();
					break;
			}
		}, 16);
	}

	// ── Navigation ──────────────────────────────────────────

	private navigateTo(page: HubPage): void {
		this.currentPage = page;
		const isDashboard = page === "dashboard";

		// Toggle dashboard vs split (same pattern as EventCatalogView.onTabChanged)
		this.dashboardEl.classList.toggle("ft-hidden", !isDashboard);
		this.splitEl.classList.toggle("ft-hidden", isDashboard);
		this.topBarEl.classList.toggle("ft-hidden", isDashboard);

		if (!isDashboard) {
			const placeholders: Record<string, string> = {
				imports: "Search import configs...",
				exports: "Search export configs...",
				reports: "Search reports...",
				properties: "Search properties...",
			};
			this.searchInput.placeholder = placeholders[page] ?? "Search...";
			this.filterText = "";
			this.searchInput.value = "";
		}

		this.editingImportId = null;
		this.editingExportId = null;
		this.scheduleRender();
	}

	/** Opens the imports page and selects a specific config (for external callers). */
	showImportConfig(configId: string): void {
		this.selectedImportId = configId;
		this.navigateTo("imports");
	}

	// ── Top bar ─────────────────────────────────────────────

	private renderTopBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2 ft-hidden" });
		bar.style.borderBottom = "1px solid var(--background-modifier-border)";
		bar.style.flexShrink = "0";
		this.topBarEl = bar;

		const title = bar.createSpan({
			text: "Data Exchange",
			cls: "ft-heading ft-heading-sm",
		});
		title.style.cursor = "pointer";
		title.addEventListener("click", () => this.navigateTo("dashboard"));

		this.countBadgeEl = bar.createSpan({
			cls: "ft-badge ft-badge-muted",
		});
		this.updateCountBadge();

		// Spacer
		const spacer = bar.createDiv();
		spacer.style.flex = "1";

		// Import quick action — uses FilePickerModal
		const importBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const importIcon = importBtn.createSpan();
		setIcon(importIcon, "file-input");
		importBtn.appendText(" Import CSV");
		importBtn.addEventListener("click", () => {
			new FilePickerModal(this.app, ["csv"], (csvPath) => {
				this.openCsvImport(csvPath);
			}).open();
		});

		// Export quick action — uses FolderPickerModal
		const exportBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const exportIcon = exportBtn.createSpan();
		setIcon(exportIcon, "file-output");
		exportBtn.appendText(" Export");
		exportBtn.addEventListener("click", () => {
			const folders = getVaultFolders(this.app);
			new FolderPickerModal(this.app, folders, (folderPath) => {
				this.openExport({
					id: "",
					name: "",
					createdAt: 0,
					sourcePath: folderPath,
					sourceType: "folder",
					format: "csv",
					outputPath: `${folderPath}_export.csv`,
					columns: [],
					fileProperties: ["file.name"],
				});
			}).open();
		});
	}

	// ── Dashboard ────────────────────────────────────────────

	private renderDashboard(): void {
		this.dashboardEl.empty();

		// ── Title bar ──
		const titleBar = this.dashboardEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-mb-3" });
		titleBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		titleBar.style.paddingBottom = "0.75rem";
		const titleIcon = titleBar.createSpan();
		setIcon(titleIcon, "arrow-left-right");
		titleIcon.style.opacity = "0.5";
		titleBar.createEl("h2", {
			text: "Data Exchange",
			cls: "ft-heading",
		}).style.margin = "0";
		titleBar.createSpan({
			text: `${this.importConfigs.length + this.exportConfigs.length} configs`,
			cls: "ft-badge ft-badge-muted",
		});

		// Partition CSV files: configured (has import configs), export outputs, unconfigured
		const exportOutputPaths = new Set(this.exportConfigs.map((c) => c.outputPath));
		const configuredCsv = this.csvFileEntries.filter((e) => e.importConfigs.length > 0);
		const unconfiguredCsv = this.csvFileEntries.filter(
			(e) => e.importConfigs.length === 0 && !exportOutputPaths.has(e.path),
		);

		// Section 1: Configured Imports
		this.renderConfiguredImports(this.dashboardEl, configuredCsv);

		// Section 2: Configured Exports
		this.renderConfiguredExports(this.dashboardEl);

		// Section 3: Available Files
		this.renderUnconfiguredCsvFiles(this.dashboardEl, unconfiguredCsv);
	}

	private renderDashboardSectionHeader(
		container: HTMLElement,
		icon: string,
		title: string,
		count: number,
	): HTMLElement {
		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		const iconEl = header.createSpan();
		setIcon(iconEl, icon);
		iconEl.style.opacity = "0.5";
		header.createSpan({ text: title, cls: "ft-heading ft-heading-sm" });
		header.createSpan({ text: String(count), cls: "ft-master-category-count" });
		return header;
	}

	private renderConfiguredImports(
		container: HTMLElement,
		entries: typeof this.csvFileEntries,
	): void {
		const section = container.createDiv();
		section.style.marginBottom = "1.5rem";
		this.renderDashboardSectionHeader(section, "file-input", "Configured Imports", entries.length);

		if (entries.length === 0) {
			// Empty-state CTA — pick a CSV file to start a new import
			const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
			const ctaIcon = cta.createDiv();
			setIcon(ctaIcon, "file-input");
			ctaIcon.style.opacity = "0.3";
			ctaIcon.style.marginBottom = "0.5rem";
			cta.createDiv({
				text: "No import configs yet",
				cls: "ft-heading ft-heading-sm ft-mb-1",
			});
			cta.createDiv({
				text: "Create your first import by selecting a CSV file as the data source.",
				cls: "ft-text-muted ft-text-sm ft-mb-3",
			});
			const ctaBtn = cta.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			const ctaBtnIcon = ctaBtn.createSpan({ cls: "flowti-csv-btn-icon" });
			setIcon(ctaBtnIcon, "file-spreadsheet");
			ctaBtn.appendText(" Select CSV File");
			ctaBtn.addEventListener("click", () => {
				new FilePickerModal(this.app, ["csv"], (csvPath) => {
					this.openCsvImport(csvPath);
				}).open();
			});
			return;
		}

		// "New Import" button
		section.createDiv({
			text: "Data sources ready to import. Run an import to create or update notes from your spreadsheet data.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});
		const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
		const newIcon = newBtn.createSpan();
		setIcon(newIcon, "plus");
		newBtn.appendText(" New Import from CSV");
		newBtn.addEventListener("click", () => {
			new FilePickerModal(this.app, ["csv"], (csvPath) => {
				this.openCsvImport(csvPath);
			}).open();
		});

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "Config" });
		headRow.createEl("th", { text: "View" });
		headRow.createEl("th", { text: "File" });
		headRow.createEl("th", { text: "" });

		const tbody = table.createEl("tbody");

		// Sort: favourites first, then by name within each group
		const sortedEntries = [...entries];
		for (const entry of sortedEntries) {
			entry.importConfigs.sort((a, b) => {
				if ((a.favourite ?? false) !== (b.favourite ?? false)) return a.favourite ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
		}

		for (const entry of sortedEntries) {
			for (const cfg of entry.importConfigs) {
				const tr = tbody.createEl("tr");

				// Config column — star + config name + target folder
				const configTd = tr.createEl("td");
				const configRow = configTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

				const starIcon = configRow.createSpan({ cls: "ft-nav-link" });
				starIcon.style.flexShrink = "0";
				setIcon(starIcon, cfg.favourite ? "star" : "star-off");
				if (cfg.favourite) starIcon.style.color = "var(--text-accent)";
				starIcon.setAttribute("aria-label", cfg.favourite ? "Unfavourite" : "Favourite");
				starIcon.addEventListener("click", () => {
					void this.dataExchangeService.toggleImportFavourite(cfg.id).then(() => {
						this.scheduleRender();
					});
				});

				const cfgLink = configRow.createEl("span", {
					text: cfg.name || "(unnamed)",
					cls: "ft-nav-link",
				});
				cfgLink.addEventListener("click", () => {
					this.selectedImportId = cfg.id;
					this.navigateTo("imports");
				});
				const cfgSub = configTd.createDiv({ cls: "ft-text-muted ft-text-sm" });
				cfgSub.style.whiteSpace = "nowrap";
				cfgSub.style.overflow = "hidden";
				cfgSub.style.textOverflow = "ellipsis";
				cfgSub.textContent = `→ ${cfg.targetFolder || "(no folder)"}`;

				// View column — base file links for this config
				const viewsTd = tr.createEl("td");
				const cfgBaseViews = entry.baseViews.filter(
					(bv) => cfg.basePath === bv.path || (!cfg.basePath && entry.baseViews.length > 0),
				);
				if (cfgBaseViews.length > 0) {
					for (const bv of cfgBaseViews) {
						const bvRow = viewsTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
						bvRow.style.marginBottom = "0.125rem";
						const bvIcon = bvRow.createSpan();
						setIcon(bvIcon, "table");
						bvIcon.style.opacity = "0.4";
						bvIcon.style.flexShrink = "0";
						const bvLink = bvRow.createEl("span", {
							text: bv.name,
							cls: "ft-nav-link ft-text-sm",
						});
						bvLink.addEventListener("click", () => {
							const file = this.app.vault.getAbstractFileByPath(bv.path);
							if (file instanceof TFile) {
								void this.app.workspace.getLeaf(false).openFile(file);
							}
						});
					}
				} else {
					viewsTd.createSpan({ text: "—", cls: "ft-text-muted" });
				}

				// File column — CSV name + doc indicator
				const fileTd = tr.createEl("td");
				const fileWrap = fileTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
				const fileLink = fileWrap.createEl("span", {
					text: entry.name,
					cls: "ft-nav-link ft-text-sm",
				});
				fileLink.addEventListener("click", () => {
					const file = this.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) {
						void this.app.workspace.getLeaf(false).openFile(file);
					}
				});
				if (entry.hasDoc) {
					const docIcon = fileWrap.createSpan();
					setIcon(docIcon, "file-text");
					docIcon.style.opacity = "0.4";
					docIcon.style.cursor = "pointer";
					docIcon.addEventListener("click", () => {
						const docPath = this.dataExchangeService.getCsvDocPath(entry.path);
						void this.app.workspace.openLinkText(docPath, "", false);
					});
				}

				// Actions column — execute + preview
				const actionsTd = tr.createEl("td");
				const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

				// Execute — with inline feedback
				const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				const execIcon = execLink.createSpan();
				setIcon(execIcon, "play");
				execLink.addEventListener("click", () => {
					const csvPath = cfg.sourcePath || entry.path;
					this.runDashboardImport(cfg, csvPath, tr);
				});

				// Preview (open import wizard)
				const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link ft-text-muted" });
				const prevIcon = previewLink.createSpan();
				setIcon(prevIcon, "eye");
				previewLink.addEventListener("click", () => {
					this.openCsvImport(entry.path, cfg);
				});
			}
		}
	}

	/**
	 * Runs an import config from the dashboard table with inline progress feedback.
	 * Shows a progress row beneath the triggering row in the table.
	 */
	private runDashboardImport(cfg: SavedImportConfig, csvPath: string, row: HTMLTableRowElement): void {
		// Remove any existing progress row
		const existing = row.parentElement?.querySelector(".ft-dashboard-progress-row");
		if (existing) existing.remove();

		// Insert a progress row after the triggering row
		const progressRow = document.createElement("tr");
		progressRow.className = "ft-dashboard-progress-row";
		const progressTd = document.createElement("td");
		progressTd.colSpan = 4;
		progressRow.appendChild(progressTd);
		row.after(progressRow);

		const statusRow = progressTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.style.opacity = "0.6";
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ text: `Running "${cfg.name}"...`, cls: "ft-text-sm" });

		const barBg = progressTd.createDiv();
		barBg.style.cssText = "height:3px;background:var(--background-modifier-border);border-radius:2px;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		// Listen for progress
		const offProgress = this.eventBus.on("dataExchange.import.progress", (event) => {
			const { current, total, lastFilename } = event.payload;
			const pct = total > 0 ? Math.round((current / total) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Importing... ${current} / ${total}`;
			if (lastFilename) {
				statusText.textContent += ` — ${lastFilename}`;
			}
		});

		const cleanup = (success: boolean, message: string) => {
			offProgress();
			progressTd.empty();
			const resultRow = progressTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });

			// Auto-dismiss after 5s
			setTimeout(() => {
				progressRow.remove();
				if (success) this.refreshConfigs();
			}, 5000);
		};

		const offComplete = this.eventBus.on("dataExchange.import.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `Done: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "");
			cleanup(true, msg);
			new Notice(msg);
		});
		const offFailed = this.eventBus.on("dataExchange.import.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Failed: ${event.payload.error}`);
			new Notice(`Import failed: ${event.payload.error}`);
		});

		void this.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: cfg.customProperties,
			},
		});
	}

	private renderConfiguredExports(container: HTMLElement): void {
		const section = container.createDiv();
		section.style.marginBottom = "1.5rem";
		this.renderDashboardSectionHeader(section, "file-output", "Configured Exports", this.exportConfigs.length);

		if (this.exportConfigs.length === 0) {
			// Empty-state CTA — pick a .base file to start a new export
			const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
			const ctaIcon = cta.createDiv();
			setIcon(ctaIcon, "file-output");
			ctaIcon.style.opacity = "0.3";
			ctaIcon.style.marginBottom = "0.5rem";
			cta.createDiv({
				text: "No export configs yet",
				cls: "ft-heading ft-heading-sm ft-mb-1",
			});
			cta.createDiv({
				text: "Create your first export by selecting a .base file as the data source.",
				cls: "ft-text-muted ft-text-sm ft-mb-3",
			});
			const ctaBtn = cta.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			const ctaBtnIcon = ctaBtn.createSpan({ cls: "flowti-csv-btn-icon" });
			setIcon(ctaBtnIcon, "table");
			ctaBtn.appendText(" Select Base File");
			ctaBtn.addEventListener("click", () => this.pickBaseForNewExport());
			return;
		}

		// "New Export" button below section header
		const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		section.createDiv({
			text: "Export vault data to CSV or tab-delimited files.",
			cls: "ft-text-muted ft-text-sm",
		}).before(newRow);
		const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
		const newIcon = newBtn.createSpan();
		setIcon(newIcon, "plus");
		newBtn.appendText(" New Export from Base");
		newBtn.addEventListener("click", () => this.pickBaseForNewExport());

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "Name" });
		headRow.createEl("th", { text: "Source" });
		headRow.createEl("th", { text: "Output" });
		headRow.createEl("th", { text: "" });

		const tbody = table.createEl("tbody");

		// Sort: favourites first, then by name
		const sortedExports = [...this.exportConfigs].sort((a, b) => {
			if ((a.favourite ?? false) !== (b.favourite ?? false)) return a.favourite ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		for (const cfg of sortedExports) {
			const tr = tbody.createEl("tr");

			// Name — star + clickable name + format badge
			const nameTd = tr.createEl("td");
			const nameRow = nameTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

			const starIcon = nameRow.createSpan({ cls: "ft-nav-link" });
			starIcon.style.flexShrink = "0";
			setIcon(starIcon, cfg.favourite ? "star" : "star-off");
			if (cfg.favourite) starIcon.style.color = "var(--text-accent)";
			starIcon.setAttribute("aria-label", cfg.favourite ? "Unfavourite" : "Favourite");
			starIcon.addEventListener("click", () => {
				void this.dataExchangeService.toggleExportFavourite(cfg.id).then(() => {
					this.scheduleRender();
				});
			});

			const nameLink = nameRow.createEl("span", {
				text: cfg.name || "(unnamed)",
				cls: "ft-nav-link",
			});
			nameLink.addEventListener("click", () => {
				this.selectedExportId = cfg.id;
				this.navigateTo("exports");
			});
			nameRow.createSpan({
				text: cfg.format.toUpperCase(),
				cls: "ft-master-category-count",
			});

			// Source — base file or folder link
			const srcTd = tr.createEl("td");
			const srcName = cfg.sourcePath.split("/").pop() ?? cfg.sourcePath;
			const srcLink = srcTd.createEl("span", {
				text: srcName,
				cls: "ft-nav-link ft-text-sm",
			});
			srcLink.addEventListener("click", () => {
				if (cfg.sourceType === "base") {
					const file = this.app.vault.getAbstractFileByPath(cfg.sourcePath);
					if (file instanceof TFile) {
						void this.app.workspace.getLeaf(false).openFile(file);
					}
				} else {
					void this.app.workspace.openLinkText(cfg.sourcePath, "", false);
				}
			});
			srcTd.createSpan({
				text: cfg.sourceType,
				cls: "ft-badge ft-badge-muted",
			}).style.marginLeft = "0.25rem";

			// Output
			const outTd = tr.createEl("td");
			const outName = cfg.outputPath.split("/").pop() ?? cfg.outputPath;
			const outLink = outTd.createEl("span", {
				text: outName,
				cls: "ft-nav-link ft-text-sm",
			});
			if (cfg.isExternal) {
				outTd.createSpan({
					text: "external",
					cls: "ft-badge ft-badge-muted",
				}).style.marginLeft = "0.25rem";
			}
			outLink.addEventListener("click", () => {
				if (!cfg.isExternal) {
					void this.app.workspace.openLinkText(cfg.outputPath, "", false);
				}
			});

			// Actions — run + detail
			const actionsTd = tr.createEl("td");
			const runLink = actionsTd.createEl("span", { cls: "ft-nav-link" });
			const runIcon = runLink.createSpan();
			setIcon(runIcon, "play");
			runLink.addEventListener("click", () => {
				this.openExport(cfg);
			});
		}
	}

	/** Opens a file picker for .base files and opens the export wizard with the selected one. */
	private pickBaseForNewExport(): void {
		new FilePickerModal(this.app, ["base"], (basePath) => {
			this.openNewExport(basePath, "base", "csv");
		}).open();
	}

	private renderUnconfiguredCsvFiles(
		container: HTMLElement,
		entries: typeof this.csvFileEntries,
	): void {
		const section = container.createDiv();

		// Partition into visible vs hidden
		const hiddenPaths = this.dataExchangeService.getHiddenCsvPaths();
		const hiddenSet = new Set(hiddenPaths);
		const visibleEntries = entries.filter((e) => !hiddenSet.has(e.path));
		const hiddenEntries = entries.filter((e) => hiddenSet.has(e.path));
		const displayCount = this.showHiddenCsvs ? entries.length : visibleEntries.length;

		this.renderDashboardSectionHeader(section, "file-spreadsheet", "Available Files", displayCount);

		// Toggle chip for hidden files
		if (hiddenEntries.length > 0) {
			const toggleRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
			const toggleChip = toggleRow.createSpan({
				cls: `ft-badge ${this.showHiddenCsvs ? "" : "ft-badge-muted"}`,
			});
			toggleChip.style.cursor = "pointer";
			const eyeIcon = toggleChip.createSpan();
			setIcon(eyeIcon, this.showHiddenCsvs ? "eye" : "eye-off");
			eyeIcon.style.marginRight = "0.25rem";
			toggleChip.appendText(`${this.showHiddenCsvs ? "Hide" : "Show"} hidden (${hiddenEntries.length})`);
			toggleChip.addEventListener("click", () => {
				this.showHiddenCsvs = !this.showHiddenCsvs;
				this.scheduleRender();
			});
		}

		if (visibleEntries.length === 0 && !this.showHiddenCsvs) {
			section.createDiv({
				text: hiddenEntries.length > 0
					? `All ${hiddenEntries.length} CSV file(s) are hidden`
					: "No unconfigured CSV files found",
				cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm",
			});
			return;
		}

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "File" });
		headRow.createEl("th", { text: "Doc" });
		headRow.createEl("th", { text: "" });

		const tbody = table.createEl("tbody");
		for (const entry of visibleEntries) {
			this.renderCsvFileRow(tbody, entry, false);
		}
		if (this.showHiddenCsvs) {
			for (const entry of hiddenEntries) {
				this.renderCsvFileRow(tbody, entry, true);
			}
		}
	}

	private renderCsvFileRow(
		tbody: HTMLElement,
		entry: typeof this.csvFileEntries[0],
		isHidden: boolean,
	): void {
		const tr = tbody.createEl("tr");
		if (isHidden) {
			tr.style.opacity = "0.5";
		}

		// File name
		const nameTd = tr.createEl("td");
		const nameLink = nameTd.createEl("span", {
			text: entry.name,
			cls: "ft-nav-link",
		});
		nameLink.addEventListener("click", () => {
			const file = this.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) {
				void this.app.workspace.getLeaf(false).openFile(file);
			}
		});
		if (entry.path !== entry.name) {
			const sub = nameTd.createDiv({ cls: "ft-text-muted ft-text-sm" });
			sub.style.whiteSpace = "nowrap";
			sub.style.overflow = "hidden";
			sub.style.textOverflow = "ellipsis";
			sub.textContent = entry.path;
		}

		// Doc column
		const docTd = tr.createEl("td");
		if (entry.hasDoc) {
			const docLink = docTd.createEl("span", { cls: "ft-nav-link" });
			const dIcon = docLink.createSpan();
			setIcon(dIcon, "file-text");
			docLink.addEventListener("click", () => {
				const docPath = this.dataExchangeService.getCsvDocPath(entry.path);
				void this.app.workspace.openLinkText(docPath, "", false);
			});
		} else {
			const createLink = docTd.createEl("span", { cls: "ft-nav-link ft-text-muted" });
			const cIcon = createLink.createSpan();
			setIcon(cIcon, "plus");
			createLink.addEventListener("click", () => {
				const file = this.app.vault.getAbstractFileByPath(entry.path);
				if (!(file instanceof TFile)) return;
				void this.app.vault.read(file).then((content) => {
					const lines = content.split("\n").filter((l) => l.trim());
					const headers = lines.length > 0 ? lines[0].split(",").map((h) => h.trim()) : [];
					const rowCount = Math.max(0, lines.length - 1);
					return this.dataExchangeService.createCsvDoc(entry.path, headers, rowCount);
				}).then(() => {
					new Notice(`Report created for ${entry.name}`);
					this.scheduleRender();
				});
			});
		}

		// Actions — hide/unhide + import
		const actionsTd = tr.createEl("td");
		const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

		const hideLink = actionsWrap.createEl("span", { cls: "ft-nav-link ft-text-muted" });
		const hideIcon = hideLink.createSpan();
		setIcon(hideIcon, isHidden ? "eye" : "eye-off");
		hideLink.setAttribute("aria-label", isHidden ? "Unhide" : "Hide");
		hideLink.addEventListener("click", () => {
			if (isHidden) {
				void this.dataExchangeService.unhideCsv(entry.path).then(() => {
					this.scheduleRender();
				});
			} else {
				void this.dataExchangeService.hideCsv(entry.path).then(() => {
					this.scheduleRender();
				});
			}
		});

		const importLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		const impIcon = importLink.createSpan();
		setIcon(impIcon, "file-input");
		importLink.appendText(" Import");
		importLink.addEventListener("click", () => {
			this.openCsvImport(entry.path);
		});
	}

	// ── Imports page ─────────────────────────────────────────

	private renderImportsMaster(): void {
		this.masterTreeEl.empty();

		let configs = this.importConfigs;
		if (this.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(this.filterText) ||
					c.targetFolder.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Import Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = this.filterText
				? "No matching import configs"
				: "No saved import configs yet";
			return;
		}

		for (const cfg of configs) {
			this.renderImportItem(cfg);
		}
	}

	private renderImportItem(cfg: SavedImportConfig): void {
		const isSelected = this.selectedImportId === cfg.id;
		const item = this.masterTreeEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		item.style.alignItems = "flex-start";

		const iconEl = item.createSpan();
		setIcon(iconEl, "file-input");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";
		iconEl.style.marginTop = "0.125rem";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: cfg.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
		sub.style.whiteSpace = "nowrap";
		sub.style.overflow = "hidden";
		sub.style.textOverflow = "ellipsis";
		sub.textContent = cfg.targetFolder || "(no folder)";

		item.createSpan({
			text: cfg.conflictStrategy,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.selectedImportId = cfg.id;
			this.editingImportId = null;
			this.renderImportsMaster();
			this.renderImportsDetail();
		});
	}

	private renderImportsDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedImportId) {
			this.renderEmptyDetail("file-input", "Select an import config to view details");
			return;
		}

		const cfg = this.importConfigs.find((c) => c.id === this.selectedImportId);
		if (!cfg) {
			this.renderEmptyDetail("file-input", "Config not found");
			return;
		}

		// Check if editing
		if (this.editingImportId === cfg.id) {
			this.renderImportEditForm(cfg);
			return;
		}

		// Header with operation badge
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Import", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });
		if (cfg.createBase) {
			badges.createSpan({ text: "Base View", cls: "ft-badge ft-badge-muted" });
		}

		// ── Actions bar (always on top) ─────────────────────
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Execute (run import)
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => {
			if (cfg.sourcePath) {
				this.executeImportConfig(cfg);
			} else {
				new FilePickerModal(this.app, ["csv"], (csvPath) => {
					this.executeImportConfigWithSource(cfg, csvPath);
				}).open();
			}
		});

		// Preview (open import wizard with config loaded)
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const prevIcon = previewLink.createSpan();
		setIcon(prevIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			if (cfg.sourcePath) {
				this.openCsvImport(cfg.sourcePath, cfg);
			} else {
				new FilePickerModal(this.app, ["csv"], (csvPath) => {
					this.openCsvImport(csvPath, cfg);
				}).open();
			}
		});

		// View CSV (open the source CSV file)
		if (cfg.sourcePath) {
			const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
			const viewIcon = viewLink.createSpan();
			setIcon(viewIcon, "file-spreadsheet");
			viewLink.appendText(" View CSV");
			viewLink.addEventListener("click", () => {
				void this.app.workspace.openLinkText(cfg.sourcePath!, "", false);
			});
		}

		// Open Base (open the associated .base file)
		const resolvedBaseFile = this.resolveImportBaseFile(cfg);
		if (resolvedBaseFile) {
			const baseLink = actions.createEl("span", { cls: "ft-nav-link" });
			const baseIcon = baseLink.createSpan();
			setIcon(baseIcon, "table");
			baseLink.appendText(" Open Base");
			baseLink.addEventListener("click", () => {
				void this.app.workspace.getLeaf(false).openFile(resolvedBaseFile);
			});
		}

		// Read Doc (open the config documentation)
		const configDocPath = this.dataExchangeService.getConfigDocPath(cfg.name, "import");
		const configDocFile = this.app.vault.getAbstractFileByPath(configDocPath);
		const configDocExists = configDocFile instanceof TFile;
		const readLink = actions.createEl("span", { cls: "ft-nav-link" });
		const readIcon = readLink.createSpan();
		setIcon(readIcon, configDocExists ? "file-text" : "file-plus");
		readLink.appendText(configDocExists ? " Read Doc" : " Create Doc");
		readLink.addEventListener("click", () => {
			if (configDocExists) {
				void this.app.workspace.openLinkText(configDocPath, "", false);
			} else {
				void this.dataExchangeService
					.ensureConfigDoc(cfg.name, "import")
					.then((path) => {
						void this.app.workspace.openLinkText(path, "", false);
						this.renderImportsDetail();
					});
			}
		});

		// Update (edit config)
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => {
			this.editingImportId = cfg.id;
			this.renderImportsDetail();
		});

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete import config "${cfg.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.dataExchangeService
						.deleteImportConfig(cfg.id)
						.then(() => {
							this.selectedImportId = null;
							this.refreshConfigs();
							this.renderImportsMaster();
							this.renderImportsDetail();
							new Notice("Import config deleted");
						});
				},
			}).open();
		});

		// ── Description from linked CsvDoc ──────────────────
		if (cfg.sourcePath) {
			const csvDocPath = this.dataExchangeService.getCsvDocPath(cfg.sourcePath);
			const csvDocFile = this.app.vault.getAbstractFileByPath(csvDocPath);
			if (csvDocFile instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(csvDocFile);
				const description = cache?.frontmatter?.["description"] as string | undefined;
				if (description) {
					const descSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
					descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
					descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
				}
			}
		}

		// ── Source & target info ─────────────────────────────
		const sourceCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		sourceCard.createDiv({ text: "Source & Target", cls: "ft-detail-section-header" });
		const sourceGrid = sourceCard.createDiv({ cls: "ft-detail-info-grid" });

		if (cfg.sourcePath) {
			const sourceRow = sourceGrid.createDiv({ cls: "ft-detail-info-label" });
			sourceRow.textContent = "Source CSV";
			const sourceVal = sourceGrid.createDiv({ cls: "ft-detail-info-value" });
			const sourceLink = sourceVal.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			sourceLink.textContent = cfg.sourcePath;
			sourceLink.addEventListener("click", () => {
				void this.app.workspace.openLinkText(cfg.sourcePath!, "", false);
			});
		}
		this.addInfoRow(sourceGrid, "Target Folder", cfg.targetFolder || "(not set)");
		this.addInfoRow(sourceGrid, "Name Column", cfg.nameColumn || "(not set)");
		if (cfg.namePrefix) {
			this.addInfoRow(sourceGrid, "Name Prefix", cfg.namePrefix);
		}
		if (cfg.nameSuffix) {
			this.addInfoRow(sourceGrid, "Name Suffix", cfg.nameSuffix);
		}

		// ── Configuration ───────────────────────────────────
		const configCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		configCard.createDiv({ text: "Configuration", cls: "ft-detail-section-header" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });

		this.addInfoRow(configGrid, "Conflict Strategy", cfg.conflictStrategy);
		this.addInfoRow(configGrid, "Mapped Columns", `${cfg.columnMappings.filter((m) => m.included).length} of ${cfg.columnMappings.length}`);
		if (cfg.customProperties && Object.keys(cfg.customProperties).length > 0) {
			this.addInfoRow(configGrid, "Custom Properties", String(Object.keys(cfg.customProperties).length));
		}
		if (cfg.createBase) {
			this.addInfoRow(configGrid, "Base View", cfg.basePath || "(auto-generated)");
		}
		this.addInfoRow(configGrid, "Created", new Date(cfg.createdAt).toLocaleString());

		// Last import run
		if (cfg.sourcePath) {
			const csvSettings = this.dataExchangeService.getCsvDisplaySettings(cfg.sourcePath);
			if (csvSettings?.lastImportedAt) {
				const lastRun = new Date(csvSettings.lastImportedAt);
				const elapsed = Date.now() - csvSettings.lastImportedAt;
				const relativeTime = elapsed < 60_000 ? "just now"
					: elapsed < 3_600_000 ? `${Math.floor(elapsed / 60_000)}m ago`
					: elapsed < 86_400_000 ? `${Math.floor(elapsed / 3_600_000)}h ago`
					: `${Math.floor(elapsed / 86_400_000)}d ago`;
				this.addInfoRow(configGrid, "Last Import", `${lastRun.toLocaleString()} (${relativeTime})`);
			} else {
				this.addInfoRow(configGrid, "Last Import", "Never");
			}
		}

		// ── Column mappings ─────────────────────────────────
		if (cfg.columnMappings.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Column Mappings", cls: "ft-detail-section-header" });
			const table = section.createEl("table", { cls: "ft-preview-table" });
			const thead = table.createEl("tr");
			thead.createEl("th", { text: "CSV Column" });
			thead.createEl("th", { text: "Frontmatter Key" });
			thead.createEl("th", { text: "Included" });
			for (const m of cfg.columnMappings) {
				const tr = table.createEl("tr");
				tr.createEl("td", { text: m.csvColumn });
				tr.createEl("td", { text: m.frontmatterKey });
				const inclTd = tr.createEl("td");
				const inclIcon = inclTd.createSpan();
				setIcon(inclIcon, m.included ? "check" : "minus");
				inclIcon.style.opacity = m.included ? "1" : "0.3";
			}
		}

		// ── Custom properties ───────────────────────────────
		if (cfg.customProperties && Object.keys(cfg.customProperties).length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Custom Properties", cls: "ft-detail-section-header" });
			const propGrid = section.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, val] of Object.entries(cfg.customProperties)) {
				this.addInfoRow(propGrid, key, val);
			}
		}

	}

	private renderImportEditForm(cfg: SavedImportConfig): void {
		const panel = this.detailPanelEl;
		panel.createEl("h3", { text: "Edit Import Config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedImportConfig> = {
			name: cfg.name,
			targetFolder: cfg.targetFolder,
			nameColumn: cfg.nameColumn,
			conflictStrategy: cfg.conflictStrategy,
			createBase: cfg.createBase ?? false,
			basePath: cfg.basePath ?? "",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.addText((t) => t.setValue(cfg.targetFolder).onChange((v) => { edits.targetFolder = v; }));
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.app);
				new FolderPickerModal(this.app, folders, (folder) => {
					edits.targetFolder = folder;
					this.renderImportsDetail();
				}).open();
			}),
		);

		new Setting(panel)
			.setName("Name column")
			.addText((t) => t.setValue(cfg.nameColumn).onChange((v) => { edits.nameColumn = v; }));

		new Setting(panel)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOptions({ skip: "Skip", update: "Update frontmatter", overwrite: "Overwrite" })
					.setValue(cfg.conflictStrategy)
					.onChange((v) => { edits.conflictStrategy = v as SavedImportConfig["conflictStrategy"]; }),
			);

		new Setting(panel)
			.setName("Create .base view")
			.setDesc("Generate a table view for imported notes")
			.addToggle((toggle) =>
				toggle
					.setValue(edits.createBase ?? false)
					.onChange((v) => {
						edits.createBase = v || undefined;
						basePathSetting.settingEl.toggle(v);
					}),
			);

		const basePathSetting = new Setting(panel)
			.setName("Base file path")
			.setDesc("Where to save the .base view file")
			.addText((t) =>
				t
					.setValue(edits.basePath ?? "")
					.setPlaceholder("path/to/view.base")
					.onChange((v) => { edits.basePath = v || undefined; }),
			);
		basePathSetting.settingEl.toggle(edits.createBase ?? false);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.dataExchangeService
				.updateImportConfig(cfg.id, edits)
				.then(() => {
					this.editingImportId = null;
					this.refreshConfigs();
					this.renderImportsMaster();
					this.renderImportsDetail();
					new Notice("Import config updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.editingImportId = null;
			this.renderImportsDetail();
		});
	}

	// ── Exports page ─────────────────────────────────────────

	private renderExportsMaster(): void {
		this.masterTreeEl.empty();

		let configs = this.exportConfigs;
		if (this.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(this.filterText) ||
					c.sourcePath.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Export Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = this.filterText
				? "No matching export configs"
				: "No saved export configs yet";
			return;
		}

		for (const cfg of configs) {
			this.renderExportItem(cfg);
		}
	}

	private renderExportItem(cfg: SavedExportConfig): void {
		const isSelected = this.selectedExportId === cfg.id;
		const item = this.masterTreeEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		item.style.alignItems = "flex-start";

		const iconEl = item.createSpan();
		setIcon(iconEl, "file-output");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";
		iconEl.style.marginTop = "0.125rem";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: cfg.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
		sub.style.whiteSpace = "nowrap";
		sub.style.overflow = "hidden";
		sub.style.textOverflow = "ellipsis";
		sub.textContent = cfg.sourcePath || "(no source)";

		const rightBadges = item.createDiv({ cls: "ft-flex ft-gap-1" });
		rightBadges.style.flexShrink = "0";
		rightBadges.createSpan({ text: cfg.format.toUpperCase(), cls: "ft-master-category-count" });

		item.addEventListener("click", () => {
			this.selectedExportId = cfg.id;
			this.editingExportId = null;
			this.renderExportsMaster();
			this.renderExportsDetail();
		});
	}

	private renderExportsDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedExportId) {
			this.renderEmptyDetail("file-output", "Select an export config to view details");
			return;
		}

		const cfg = this.exportConfigs.find((c) => c.id === this.selectedExportId);
		if (!cfg) {
			this.renderEmptyDetail("file-output", "Config not found");
			return;
		}

		// Check if editing
		if (this.editingExportId === cfg.id) {
			this.renderExportEditForm(cfg);
			return;
		}

		// Header with operation badge
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Export", cls: "ft-operation-badge ft-operation-badge-export" });
		badges.createSpan({ text: cfg.format.toUpperCase(), cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: cfg.sourceType, cls: "ft-badge ft-badge-muted" });
		if (cfg.isExternal) {
			badges.createSpan({ text: "External", cls: "ft-badge ft-badge-muted" });
		}

		// ── Actions bar (always on top) ─────────────────────
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Execute (run export)
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => {
			this.executeExportConfig(cfg);
		});

		// Preview (open export wizard with config loaded)
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const prevIcon = previewLink.createSpan();
		setIcon(prevIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			this.openExport(cfg);
		});

		// View Source (open the source file/folder)
		const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const viewIcon = viewLink.createSpan();
		setIcon(viewIcon, cfg.sourceType === "base" ? "table" : "folder");
		viewLink.appendText(cfg.sourceType === "base" ? " Open Base" : " Open Folder");
		viewLink.addEventListener("click", () => {
			if (cfg.sourceType === "base") {
				const file = this.app.vault.getAbstractFileByPath(cfg.sourcePath);
				if (file instanceof TFile) {
					void this.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				void this.app.workspace.openLinkText(cfg.sourcePath, "", false);
			}
		});

		// View Output (open the output file)
		if (cfg.outputPath && !cfg.isExternal) {
			const outLink = actions.createEl("span", { cls: "ft-nav-link" });
			const outIcon = outLink.createSpan();
			setIcon(outIcon, "file-spreadsheet");
			outLink.appendText(" View Output");
			outLink.addEventListener("click", () => {
				void this.app.workspace.openLinkText(cfg.outputPath, "", false);
			});
		}

		// Read Doc / Create Doc
		const configDocPath = this.dataExchangeService.getConfigDocPath(cfg.name, "export");
		const configDocFile = this.app.vault.getAbstractFileByPath(configDocPath);
		const configDocExists = configDocFile instanceof TFile;
		const readLink = actions.createEl("span", { cls: "ft-nav-link" });
		const readIcon = readLink.createSpan();
		setIcon(readIcon, configDocExists ? "file-text" : "file-plus");
		readLink.appendText(configDocExists ? " Read Doc" : " Create Doc");
		readLink.addEventListener("click", () => {
			if (configDocExists) {
				void this.app.workspace.openLinkText(configDocPath, "", false);
			} else {
				void this.dataExchangeService
					.ensureConfigDoc(cfg.name, "export")
					.then((path) => {
						void this.app.workspace.openLinkText(path, "", false);
						this.renderExportsDetail();
					});
			}
		});

		// Update (edit config)
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => {
			this.editingExportId = cfg.id;
			this.renderExportsDetail();
		});

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete export config "${cfg.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.dataExchangeService
						.deleteExportConfig(cfg.id)
						.then(() => {
							this.selectedExportId = null;
							this.refreshConfigs();
							this.renderExportsMaster();
							this.renderExportsDetail();
							new Notice("Export config deleted");
						});
				},
			}).open();
		});

		// ── Description from linked config doc ───────────────
		if (configDocExists && configDocFile instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(configDocFile);
			const description = cache?.frontmatter?.["description"] as string | undefined;
			if (description) {
				const descSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
				descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
				descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
			}
		}

		// ── Source & Output info ─────────────────────────────
		const sourceCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		sourceCard.createDiv({ text: "Source & Output", cls: "ft-detail-section-header" });
		const sourceGrid = sourceCard.createDiv({ cls: "ft-detail-info-grid" });

		const sourceRow = sourceGrid.createDiv({ cls: "ft-detail-info-label" });
		sourceRow.textContent = cfg.sourceType === "base" ? "Source Base" : "Source Folder";
		const sourceVal = sourceGrid.createDiv({ cls: "ft-detail-info-value" });
		const sourceLink = sourceVal.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		sourceLink.textContent = cfg.sourcePath;
		sourceLink.addEventListener("click", () => {
			if (cfg.sourceType === "base") {
				const file = this.app.vault.getAbstractFileByPath(cfg.sourcePath);
				if (file instanceof TFile) {
					void this.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				void this.app.workspace.openLinkText(cfg.sourcePath, "", false);
			}
		});

		const outputRow = sourceGrid.createDiv({ cls: "ft-detail-info-label" });
		outputRow.textContent = "Output File";
		const outputVal = sourceGrid.createDiv({ cls: "ft-detail-info-value" });
		if (cfg.isExternal) {
			outputVal.createSpan({ text: cfg.outputPath || "(not set)", cls: "ft-text-sm" });
			outputVal.createSpan({ text: "external", cls: "ft-badge ft-badge-muted" }).style.marginLeft = "0.5rem";
		} else if (cfg.outputPath) {
			const outLink = outputVal.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			outLink.textContent = cfg.outputPath;
			outLink.addEventListener("click", () => {
				void this.app.workspace.openLinkText(cfg.outputPath, "", false);
			});
		} else {
			outputVal.textContent = "(not set)";
		}

		// ── Configuration ───────────────────────────────────
		const configCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		configCard.createDiv({ text: "Configuration", cls: "ft-detail-section-header" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });

		this.addInfoRow(configGrid, "Format", cfg.format === "tab" ? "Tab-delimited" : "CSV");
		if (cfg.conflictStrategy) {
			this.addInfoRow(configGrid, "Conflict Strategy", cfg.conflictStrategy);
		}
		if (cfg.baseViewIndex !== undefined) {
			this.addInfoRow(configGrid, "Base View Index", String(cfg.baseViewIndex));
		}
		this.addInfoRow(configGrid, "Created", new Date(cfg.createdAt).toLocaleString());

		// ── Note Properties (columns) ───────────────────────
		if (cfg.columns.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: `Note Properties (${cfg.columns.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const col of cfg.columns) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// ── File Properties ─────────────────────────────────
		if (cfg.fileProperties.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: `File Properties (${cfg.fileProperties.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const fp of cfg.fileProperties) {
				chips.createSpan({ text: fp.replace("file.", ""), cls: "ft-badge ft-badge-muted" });
			}
		}
	}

	private renderExportEditForm(cfg: SavedExportConfig): void {
		const panel = this.detailPanelEl;
		panel.createEl("h3", { text: "Edit Export Config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedExportConfig> = {
			name: cfg.name,
			sourcePath: cfg.sourcePath,
			outputPath: cfg.outputPath,
			conflictStrategy: cfg.conflictStrategy ?? "overwrite",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		const sourceSetting = new Setting(panel)
			.setName("Source path")
			.addText((t) => t.setValue(cfg.sourcePath).onChange((v) => { edits.sourcePath = v; }));
		sourceSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				if (cfg.sourceType === "base") {
					new FilePickerModal(this.app, ["base"], (p) => {
						edits.sourcePath = p;
						this.renderExportsDetail();
					}).open();
				} else {
					const folders = getVaultFolders(this.app);
					new FolderPickerModal(this.app, folders, (p) => {
						edits.sourcePath = p;
						this.renderExportsDetail();
					}).open();
				}
			}),
		);

		const outputSetting = new Setting(panel)
			.setName("Output path")
			.addText((t) => t.setValue(cfg.outputPath).onChange((v) => { edits.outputPath = v; }));
		outputSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.app);
				new FolderPickerModal(this.app, folders, (folder) => {
					const parts = (cfg.outputPath || "export.csv").replace(/\\/g, "/").split("/");
					const filename = parts[parts.length - 1];
					edits.outputPath = folder ? `${folder}/${filename}` : filename;
					this.renderExportsDetail();
				}).open();
			}),
		);

		new Setting(panel)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOptions({ overwrite: "Overwrite", skip: "Skip", append: "Append" })
					.setValue(cfg.conflictStrategy ?? "overwrite")
					.onChange((v) => { edits.conflictStrategy = v as SavedExportConfig["conflictStrategy"]; }),
			);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.dataExchangeService
				.updateExportConfig(cfg.id, edits)
				.then(() => {
					this.editingExportId = null;
					this.refreshConfigs();
					this.renderExportsMaster();
					this.renderExportsDetail();
					new Notice("Export config updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.editingExportId = null;
			this.renderExportsDetail();
		});
	}

	// ── Reports page ────────────────────────────────────────

	private renderReportsMaster(): void {
		this.masterTreeEl.empty();

		let reports = this.reportEntries;
		if (this.filterText) {
			reports = reports.filter((r) => r.name.toLowerCase().includes(this.filterText));
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Reports" });
		header.createSpan({
			text: `${reports.length}`,
			cls: "ft-master-category-count",
		});

		if (reports.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = this.filterText ? "No matching reports" : "No documented CSV files yet";
			return;
		}

		for (const report of reports) {
			const isSelected = this.selectedReportPath === report.path;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "file-spreadsheet");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: report.name, cls: "ft-master-event-name" });

			const cols = report.frontmatter.columns;
			if (cols !== undefined) {
				item.createSpan({
					text: `${cols} cols`,
					cls: "ft-badge ft-badge-muted",
				});
			}

			item.addEventListener("click", () => {
				this.selectedReportPath = report.path;
				this.renderReportsMaster();
				this.renderReportsDetail();
			});
		}
	}

	private renderReportsDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedReportPath) {
			this.renderEmptyDetail("file-spreadsheet", "Select a report to view details");
			return;
		}

		this.renderReportDetailContent();
	}

	// ── Properties page ─────────────────────────────────────

	private renderPropertiesMaster(): void {
		this.masterTreeEl.empty();

		let entries = this.dictionaryEntries;
		if (this.filterText) {
			entries = entries.filter((e) =>
				e.propertyName.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Properties" });
		header.createSpan({
			text: `${entries.length}`,
			cls: "ft-master-category-count",
		});

		if (entries.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = this.filterText ? "No matching properties" : "No properties found in configs";
			return;
		}

		for (const entry of entries) {
			const isSelected = this.selectedDictProp === entry.propertyName;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "tag");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: entry.propertyName, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${entry.usedInConfigs.length} config${entry.usedInConfigs.length !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});

			item.addEventListener("click", () => {
				this.selectedDictProp = entry.propertyName;
				this.renderPropertiesMaster();
				this.renderPropertiesDetail();
			});
		}
	}

	private renderPropertiesDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedDictProp) {
			this.renderEmptyDetail("tag", "Select a property to view details");
			return;
		}

		const entry = this.dictionaryEntries.find(
			(e) => e.propertyName === this.selectedDictProp,
		);
		if (!entry) {
			this.renderEmptyDetail("tag", "Property not found");
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: entry.propertyName, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({
			text: `${entry.usedInConfigs.length} config${entry.usedInConfigs.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});

		// CSV column names
		if (entry.csvColumnNames.length > 0) {
			const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			card.createDiv({ text: "CSV Columns", cls: "ft-detail-section-header" });
			const chips = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const col of entry.csvColumnNames) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// Configs using this property
		if (entry.usedInConfigs.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Used In Configs", cls: "ft-detail-section-header" });

			for (const ref of entry.usedInConfigs) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const iconEl = item.createSpan();
				setIcon(iconEl, ref.configType === "import" ? "file-input" : "file-output");
				iconEl.style.opacity = "0.5";
				iconEl.style.flexShrink = "0";

				item.createSpan({ text: ref.configName, cls: "ft-master-event-name" });
				item.createSpan({
					text: ref.configType === "import" ? "Import" : "Export",
					cls: `ft-operation-badge ft-operation-badge-${ref.configType}`,
				});

				item.addEventListener("click", () => {
					if (ref.configType === "import") {
						this.selectedImportId = ref.configId;
						this.navigateTo("imports");
					} else {
						this.selectedExportId = ref.configId;
						this.navigateTo("exports");
					}
				});
			}
		}

		// Sample values
		if (entry.sampleValues.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Sample Values", cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const val of entry.sampleValues) {
				chips.createSpan({ text: val, cls: "ft-badge ft-badge-muted" });
			}
		}
	}

	// ── Shared report detail content ─────────────────────────

	private renderReportDetailContent(): void {
		const report = this.reportEntries.find((r) => r.path === this.selectedReportPath);
		if (!report) {
			this.renderEmptyDetail("file-spreadsheet", "Report not found");
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: report.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "CSV Report", cls: "ft-operation-badge ft-operation-badge-import" });

		// Frontmatter properties
		const fm = report.frontmatter;
		const skipKeys = new Set(["position", "type"]);
		const entries = Object.entries(fm).filter(([k]) => !skipKeys.has(k));

		if (entries.length > 0) {
			const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			const grid = card.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of entries) {
				const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
				this.addInfoRow(grid, key, displayValue);
			}
		}

		// Headers list (from frontmatter)
		const headers = fm.headers;
		if (Array.isArray(headers) && headers.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: `Columns (${headers.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const h of headers) {
				chips.createSpan({ text: String(h), cls: "ft-badge ft-badge-muted" });
			}
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Documentation");
		openLink.addEventListener("click", () => {
			void this.app.workspace.openLinkText(report.path, "", false);
		});

		// Open the CSV file itself (via csvFile wikilink)
		const csvFile = fm.csvFile;
		if (typeof csvFile === "string") {
			// Extract path from wikilink: "[[path]]" → "path"
			const match = csvFile.match(/\[\[(.+?)\]\]/);
			const csvPath = match ? match[1] : csvFile;
			const openCsvLink = actions.createEl("span", { cls: "ft-nav-link" });
			const csvIcon = openCsvLink.createSpan();
			setIcon(csvIcon, "file-spreadsheet");
			openCsvLink.appendText(" Open CSV");
			openCsvLink.addEventListener("click", () => {
				void this.app.workspace.openLinkText(csvPath, "", false);
			});
		}

		// ── Configs referencing this CSV ──
		const csvFileFm = fm.csvFile;
		if (typeof csvFileFm === "string") {
			const csvMatch = csvFileFm.match(/\[\[(.+?)\]\]/);
			const csvPath = csvMatch ? csvMatch[1] : csvFileFm;
			const importConfigs = this.dataExchangeService.getImportConfigsForFile(csvPath);
			if (importConfigs.length > 0) {
				const cfgSection = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
				cfgSection.createDiv({ text: "Import Configs", cls: "ft-detail-section-header" });
				for (const cfg of importConfigs) {
					const item = cfgSection.createDiv({ cls: "ft-master-event-item" });
					const iconEl = item.createSpan();
					setIcon(iconEl, "file-input");
					iconEl.style.opacity = "0.5";
					iconEl.style.flexShrink = "0";
					item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
					item.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
					item.addEventListener("click", () => {
						this.selectedImportId = cfg.id;
						this.navigateTo("imports");
					});
				}
			}
		}

		// Delete doc
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete Doc");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete documentation "${report.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					const file = this.app.vault.getAbstractFileByPath(report.path);
					if (file) {
						void this.app.vault.delete(file).then(() => {
							this.selectedReportPath = null;
							this.refreshConfigs();
							this.renderReportsMaster();
							this.renderReportsDetail();
							new Notice("Report documentation deleted");
						});
					}
				},
			}).open();
		});
	}

	// ── One-click execute ────────────────────────────────────

	private executeImportConfig(cfg: SavedImportConfig): void {
		if (!cfg.sourcePath) return;
		this.runImportWithFeedback(cfg, cfg.sourcePath);
	}

	private executeImportConfigWithSource(cfg: SavedImportConfig, csvPath: string): void {
		this.runImportWithFeedback(cfg, csvPath);
	}

	private runImportWithFeedback(cfg: SavedImportConfig, csvPath: string): void {
		// Show inline progress in the detail panel (after actions bar)
		const existing = this.detailPanelEl.querySelector(".ft-import-progress") as HTMLElement | null;
		if (existing) existing.remove();
		const section = createDiv({ cls: "ft-import-progress ft-card ft-mt-2" });
		const actionsBar = this.detailPanelEl.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.detailPanelEl.insertBefore(section, actionsBar.nextSibling);
		} else {
			this.detailPanelEl.appendChild(section);
		}

		const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.style.opacity = "0.6";
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ text: `Running import: ${cfg.name}...`, cls: "ft-text-sm" });

		const barBg = section.createDiv();
		barBg.style.cssText = "height:4px;background:var(--background-modifier-border);border-radius:2px;margin:0 0.5rem 0.5rem;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

		// Listen for progress
		const offProgress = this.eventBus.on("dataExchange.import.progress", (event) => {
			const { current, total, lastFilename } = event.payload;
			const pct = total > 0 ? Math.round((current / total) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Importing... ${current} / ${total}`;
			detailText.textContent = lastFilename ? `Last: ${lastFilename}` : "";
		});

		const cleanup = (success: boolean, message: string) => {
			offProgress();
			section.empty();

			const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });

			if (success) {
				this.refreshConfigs();
			}
		};

		const offComplete = this.eventBus.on("dataExchange.import.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "");
			cleanup(true, msg);
			new Notice(msg);
		});
		const offFailed = this.eventBus.on("dataExchange.import.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Import failed: ${event.payload.error}`);
			new Notice(`Import failed: ${event.payload.error}`);
		});

		void this.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: cfg.customProperties,
			},
		});
	}

	private executeExportConfig(cfg: SavedExportConfig): void {
		void this.eventBus.emit("dataExchange.export.execute", {
			config: {
				sourcePath: cfg.sourcePath,
				sourceType: cfg.sourceType,
				format: cfg.format,
				outputPath: cfg.outputPath,
				columns: cfg.columns,
				fileProperties: cfg.fileProperties,
				baseViewIndex: cfg.baseViewIndex,
				isExternal: cfg.isExternal,
				conflictStrategy: cfg.conflictStrategy,
			},
		});
		new Notice(`Running export: ${cfg.name}...`);

		const offComplete = this.eventBus.on("dataExchange.export.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			if (r.skipped) {
				new Notice(`Export skipped: ${r.outputPath} already exists`);
			} else {
				new Notice(`Export complete: ${r.totalRows} rows written to ${r.outputPath}`);
			}
		});
		const offFailed = this.eventBus.on("dataExchange.export.failed", (event) => {
			offComplete();
			offFailed();
			new Notice(`Export failed: ${event.payload.error}`);
		});
	}

	// ── Doc links ────────────────────────────────────────────

	// ── Shared helpers ───────────────────────────────────────

	private resolveImportBaseFile(cfg: SavedImportConfig): TFile | null {
		// Explicit basePath
		if (cfg.createBase && cfg.basePath) {
			const bp = cfg.basePath.endsWith(".base") ? cfg.basePath : `${cfg.basePath}.base`;
			const f = this.app.vault.getAbstractFileByPath(bp);
			if (f instanceof TFile) return f;
		}
		// Proximity: base files in/near targetFolder
		if (cfg.targetFolder) {
			for (const f of this.app.vault.getFiles()) {
				if (!f.path.endsWith(".base")) continue;
				const dir = f.path.substring(0, f.path.lastIndexOf("/"));
				if (dir === cfg.targetFolder || f.path.startsWith(cfg.targetFolder + "/")) {
					return f;
				}
			}
		}
		return null;
	}

	private addInfoRow(grid: HTMLElement, label: string, value: string): void {
		grid.createDiv({ text: label, cls: "ft-detail-info-label" });
		grid.createDiv({ text: value, cls: "ft-detail-info-value" });
	}

	private renderEmptyDetail(icon: string, message: string): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });
		const iconEl = empty.createDiv();
		setIcon(iconEl, icon);
		iconEl.style.opacity = "0.3";
		empty.createEl("p", { text: message });

		let count = 0;
		let label = "";
		switch (this.currentPage) {
			case "imports":
				count = this.importConfigs.length;
				label = "saved imports";
				break;
			case "exports":
				count = this.exportConfigs.length;
				label = "saved exports";
				break;
			case "reports":
				count = this.reportEntries.length;
				label = "reports";
				break;
			case "properties":
				count = this.dictionaryEntries.length;
				label = "properties";
				break;
		}
		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats ft-mt-2" });
		const stat = stats.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: String(count), cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}
}
