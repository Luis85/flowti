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
	SavedMultiImportPipeline,
	TypeDocEntry,
} from "../domain/dataExchange/types";
import { ConfirmModal, InputModal } from "./modals";
import { FilePickerModal } from "./FilePickerModal";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";
import { PipelineSourceModal } from "./PipelineSourceModal";
import { VIEW_TYPE_EVENT_CATALOG, EventCatalogView } from "./EventCatalogView";

export const VIEW_TYPE_DATA_EXCHANGE_HUB = "flowti-data-exchange-hub";

type HubPage = "dashboard" | "imports" | "exports" | "reports" | "properties" | "pipelines" | "types";

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
	/** Set of property names that have documentation files. */
	private documentedProperties = new Set<string>();
	private filterText = "";
	private showHiddenCsvs = false;
	private editingImportId: string | null = null;
	private editingExportId: string | null = null;
	private pipelineConfigs: SavedMultiImportPipeline[] = [];
	private selectedPipelineId: string | null = null;
	private editingPipelineId: string | null = null;
	private typeEntries: TypeDocEntry[] = [];
	private selectedTypeName: string | null = null;
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
	private topBarTitleEl!: HTMLElement;

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
		return "Data Exchange Hub";
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

		// React to file creates/deletes in the Properties folder
		const propsFolder = this.dataExchangeService.getPropertiesFolderPath() + "/";
		this.unsubscribes.push(
			this.eventBus.on("file.created", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					this.scanPropertyDocs();
					this.scheduleRender();
				}
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("file.deleted", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					this.scanPropertyDocs();
					this.scheduleRender();
				}
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
		this.pipelineConfigs = this.dataExchangeService.getSavedPipelines();
		this.dictionaryEntries = this.dataExchangeService.buildDataDictionary();
		this.scanCsvDocs();
		this.scanPropertyDocs();
		this.scanTypeDocs();
		this.scanCsvFiles();
	}

	/** Checks file existence at the deterministic doc path for each dictionary property. */
	private scanPropertyDocs(): void {
		this.documentedProperties.clear();
		for (const entry of this.dictionaryEntries) {
			const docPath = this.dataExchangeService.getPropertyDocPath(entry.propertyName);
			if (this.app.vault.getAbstractFileByPath(docPath)) {
				this.documentedProperties.add(entry.propertyName);
			}
		}
	}

	/** Scans the Types folder for TypeDoc files and populates typeEntries. */
	private scanTypeDocs(): void {
		this.typeEntries = [];
		const folder = this.dataExchangeService.getTypesFolderPath();
		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			if (!file.path.startsWith(folder)) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.type !== "TypeDoc") continue;
			const name = String(cache.frontmatter.name ?? file.basename.replace(/^Type - /, ""));
			const description = String(cache.frontmatter.description ?? "");
			const rawProps = cache.frontmatter.properties;
			const properties: string[] = Array.isArray(rawProps) ? rawProps.map(String) : [];
			const pipelineCount = this.pipelineConfigs.filter((p) => p.noteType === name).length
				+ this.importConfigs.filter((c) => c.noteType === name).length
				+ this.exportConfigs.filter((c) => c.noteType === name).length;
			this.typeEntries.push({ name, description, properties, filePath: file.path, pipelineCount });
		}
		this.typeEntries.sort((a, b) => a.name.localeCompare(b.name));
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

	private scheduleRender(): void {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.refreshConfigs();
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
				case "pipelines":
					this.renderPipelinesMaster();
					this.renderPipelinesDetail();
					break;
				case "types":
					this.renderTypesMaster();
					this.renderTypesDetail();
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
			const labels: Record<string, string> = {
				imports: "Imports",
				exports: "Exports",
				reports: "Reports",
				properties: "Properties",
				pipelines: "Pipelines",
				types: "Types",
			};
			this.topBarTitleEl.textContent = `Data Exchange Hub - ${labels[page] ?? page}`;

			const placeholders: Record<string, string> = {
				imports: "Search import configs...",
				exports: "Search export configs...",
				reports: "Search reports...",
				properties: "Search properties...",
				pipelines: "Search pipelines...",
				types: "Search types...",
			};
			this.searchInput.placeholder = placeholders[page] ?? "Search...";
			this.filterText = "";
			this.searchInput.value = "";
		} else {
			this.topBarTitleEl.textContent = "Data Exchange Hub";
		}

		this.editingImportId = null;
		this.editingExportId = null;
		this.editingPipelineId = null;
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

		this.topBarTitleEl = bar.createSpan({
			text: "Data Exchange Hub",
			cls: "ft-heading ft-heading-sm",
		});
		this.topBarTitleEl.style.cursor = "pointer";
		this.topBarTitleEl.addEventListener("click", () => this.navigateTo("dashboard"));
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
			text: "Data Exchange Hub",
			cls: "ft-heading",
		}).style.margin = "0";

		// Partition CSV files: configured (has import configs), export outputs, unconfigured
		const exportOutputPaths = new Set(this.exportConfigs.map((c) => c.outputPath));
		const configuredCsv = this.csvFileEntries.filter((e) => e.importConfigs.length > 0);
		const unconfiguredCsv = this.csvFileEntries.filter(
			(e) => e.importConfigs.length === 0 && !exportOutputPaths.has(e.path),
		);

		// Section 1: Data Dictionary
		this.renderDictionaryStats(this.dashboardEl);

		// Section 1.5: Import Pipelines
		this.renderDashboardPipelines(this.dashboardEl);

		// Section 2: Configured Imports
		this.renderConfiguredImports(this.dashboardEl, configuredCsv);

		// Section 3: Configured Exports
		this.renderConfiguredExports(this.dashboardEl);

		// Section 4: Available Files
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
		section.style.marginBottom = "2rem";
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

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "Name" });
		headRow.createEl("th", { text: "Target" });
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

				// Name column — star + config name
				const nameTd = tr.createEl("td");
				const nameRow = nameTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

				const starIcon = nameRow.createSpan({ cls: "ft-nav-link" });
				starIcon.style.flexShrink = "0";
				setIcon(starIcon, cfg.favourite ? "star" : "star-off");
				if (cfg.favourite) starIcon.style.color = "var(--text-accent)";
				starIcon.setAttribute("aria-label", cfg.favourite ? "Unfavourite" : "Favourite");
				starIcon.addEventListener("click", () => {
					void this.dataExchangeService.toggleImportFavourite(cfg.id).then(() => {
						this.scheduleRender();
					});
				});

				const cfgLink = nameRow.createEl("span", {
					text: cfg.name || "(unnamed)",
					cls: "ft-nav-link",
				});
				cfgLink.addEventListener("click", () => {
					this.selectedImportId = cfg.id;
					this.navigateTo("imports");
				});

				// Target column — target folder path
				const targetTd = tr.createEl("td");
				const targetText = targetTd.createEl("span", {
					text: cfg.targetFolder || "—",
					cls: cfg.targetFolder ? "ft-text-sm" : "ft-text-muted",
				});
				if (cfg.targetFolder) {
					targetText.style.whiteSpace = "nowrap";
					targetText.style.overflow = "hidden";
					targetText.style.textOverflow = "ellipsis";
					targetText.style.display = "block";
					targetText.style.maxWidth = "12rem";
				}

				// File column — CSV name
				const fileTd = tr.createEl("td");
				const fileLink = fileTd.createEl("span", {
					text: entry.name,
					cls: "ft-nav-link ft-text-sm",
				});
				fileLink.addEventListener("click", () => {
					const file = this.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) {
						void this.app.workspace.getLeaf(false).openFile(file);
					}
				});

				// Actions column — edit + preview + execute
				const actionsTd = tr.createEl("td");
				const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

				// Edit (open detail view)
				const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				setIcon(editLink.createSpan(), "pencil");
				editLink.setAttribute("aria-label", "Edit");
				editLink.addEventListener("click", () => {
					this.selectedImportId = cfg.id;
					this.navigateTo("imports");
				});

				// Preview (open import wizard with config)
				const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				setIcon(previewLink.createSpan(), "eye");
				previewLink.setAttribute("aria-label", "Preview");
				previewLink.addEventListener("click", () => {
					this.openCsvImport(entry.path, cfg);
				});

				// Execute — with inline feedback
				const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				setIcon(execLink.createSpan(), "play");
				execLink.setAttribute("aria-label", "Execute");
				execLink.addEventListener("click", () => {
					const csvPath = cfg.sourcePath || entry.path;
					this.runDashboardImport(cfg, csvPath, tr);
				});
			}
		}

		// "New Import" button below table
		const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
		const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
		const newIcon = newBtn.createSpan();
		setIcon(newIcon, "plus");
		newBtn.appendText(" New Import from CSV");
		newBtn.addEventListener("click", () => {
			new FilePickerModal(this.app, ["csv"], (csvPath) => {
				this.openCsvImport(csvPath);
			}).open();
		});
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

		// Merge noteType into customProperties if set
		const importCustomProps = { ...cfg.customProperties };
		if (cfg.noteType) {
			importCustomProps.type = cfg.noteType;
		}

		void this.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: Object.keys(importCustomProps).length > 0 ? importCustomProps : undefined,
			},
		});
	}

	private renderConfiguredExports(container: HTMLElement): void {
		const section = container.createDiv();
		section.style.marginBottom = "2rem";
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

			// Actions — edit + preview + execute
			const actionsTd = tr.createEl("td");
			const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

			// Edit (open detail view)
			const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(editLink.createSpan(), "pencil");
			editLink.setAttribute("aria-label", "Edit");
			editLink.addEventListener("click", () => {
				this.selectedExportId = cfg.id;
				this.navigateTo("exports");
			});

			// Preview (open export wizard with config)
			const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(previewLink.createSpan(), "eye");
			previewLink.setAttribute("aria-label", "Preview");
			previewLink.addEventListener("click", () => {
				this.openExport(cfg);
			});

			// Execute
			const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(execLink.createSpan(), "play");
			execLink.setAttribute("aria-label", "Execute");
			execLink.addEventListener("click", () => {
				this.executeExportConfig(cfg);
			});
		}

		// "New Export" button below table
		const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
		const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
		const newIcon = newBtn.createSpan();
		setIcon(newIcon, "plus");
		newBtn.appendText(" New Export from Base");
		newBtn.addEventListener("click", () => this.pickBaseForNewExport());
	}

	/** Opens a file picker for .base files and opens the export wizard with the selected one. */
	private pickBaseForNewExport(): void {
		new FilePickerModal(this.app, ["base"], (basePath) => {
			this.openNewExport(basePath, "base", "csv");
		}).open();
	}

	private renderDictionaryStats(container: HTMLElement): void {
		const propCount = this.dictionaryEntries.length;
		const reportCount = this.reportEntries.length;
		const typeCount = this.typeEntries.length;
		if (propCount === 0 && reportCount === 0 && typeCount === 0) return;

		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderDashboardSectionHeader(section, "book-open", "Data Dictionary", propCount + reportCount + typeCount);

		const row = section.createDiv({ cls: "ft-flex ft-gap-3" });

		const cards: Array<{ icon: string; count: number; label: string; page: HubPage }> = [
			{ icon: "shapes", count: typeCount, label: "Types", page: "types" },
			{ icon: "tag", count: propCount, label: "Properties", page: "properties" },
			{ icon: "file-spreadsheet", count: reportCount, label: "Reports", page: "reports" },
		];

		for (const card of cards) {
			const el = row.createDiv({ cls: "ft-card ft-p-3" });
			el.style.flex = "1";
			el.style.cursor = "pointer";
			el.style.textAlign = "center";

			const iconEl = el.createDiv();
			setIcon(iconEl, card.icon);
			iconEl.style.opacity = "0.4";
			iconEl.style.marginBottom = "0.25rem";

			el.createDiv({
				text: String(card.count),
				cls: "ft-heading",
			}).style.margin = "0";

			el.createDiv({
				text: card.label,
				cls: "ft-text-muted ft-text-sm",
			});

			el.addEventListener("click", () => {
				this.navigateTo(card.page);
			});
		}
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
		if (cfg.noteType) {
			badges.createSpan({ text: cfg.noteType, cls: "ft-badge" });
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
					const descSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
					descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
					descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
				}
			}
		}

		// ── Source & target info ─────────────────────────────
		const sourceCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
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
		const configCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
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
		if (cfg.noteType) {
			this.addInfoRow(configGrid, "Note Type", cfg.noteType);
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
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
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
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
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
			noteType: cfg.noteType ?? "",
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

		new Setting(panel)
			.setName("Note type")
			.setDesc("Type value added to every note's frontmatter (optional)")
			.addText((t) =>
				t
					.setValue(cfg.noteType ?? "")
					.setPlaceholder("e.g. Event, Asset, Service")
					.onChange((v) => { edits.noteType = v || undefined; }),
			);

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
		const pipelineCount = this.dataExchangeService.getSavedPipelines()
			.filter((p) => p.exportConfigId === cfg.id).length;
		if (pipelineCount > 0) {
			const pipeBadge = rightBadges.createSpan({ cls: "ft-master-category-count" });
			setIcon(pipeBadge, "git-merge");
			pipeBadge.title = `Used by ${pipelineCount} pipeline${pipelineCount !== 1 ? "s" : ""}`;
		}
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
		if (cfg.noteType) {
			badges.createSpan({ text: cfg.noteType, cls: "ft-badge" });
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
				const descSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
				descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
				descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
			}
		}

		// ── Source & Output info ─────────────────────────────
		const sourceCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
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
		const configCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
		configCard.createDiv({ text: "Configuration", cls: "ft-detail-section-header" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });

		this.addInfoRow(configGrid, "Format", cfg.format === "tab" ? "Tab-delimited" : "CSV");
		if (cfg.conflictStrategy) {
			this.addInfoRow(configGrid, "Conflict Strategy", cfg.conflictStrategy);
		}
		if (cfg.baseViewIndex !== undefined) {
			this.addInfoRow(configGrid, "Base View Index", String(cfg.baseViewIndex));
		}
		if (cfg.noteType) {
			this.addInfoRow(configGrid, "Note Type", cfg.noteType);
		}
		this.addInfoRow(configGrid, "Created", new Date(cfg.createdAt).toLocaleString());

		// ── Note Properties (columns) ───────────────────────
		if (cfg.columns.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `Note Properties (${cfg.columns.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const col of cfg.columns) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// ── File Properties ─────────────────────────────────
		if (cfg.fileProperties.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `File Properties (${cfg.fileProperties.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const fp of cfg.fileProperties) {
				chips.createSpan({ text: fp.replace("file.", ""), cls: "ft-badge ft-badge-muted" });
			}
		}

		// ── Linked Pipelines ───────────────────────────────
		const linkedPipelines = this.dataExchangeService.getSavedPipelines()
			.filter((p) => p.exportConfigId === cfg.id);
		if (linkedPipelines.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({
				text: `Pipelines (${linkedPipelines.length})`,
				cls: "ft-detail-section-header",
			});
			for (const pipe of linkedPipelines) {
				const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
				row.style.borderBottom = "1px solid var(--background-modifier-border)";
				const icon = row.createSpan();
				setIcon(icon, "git-merge");
				icon.style.flexShrink = "0";
				const link = row.createEl("span", {
					text: pipe.name,
					cls: "ft-nav-link ft-text-sm",
				});
				link.style.flex = "1";
				link.addEventListener("click", () => {
					this.selectedPipelineId = pipe.id;
					this.navigateTo("pipelines");
				});
				if (pipe.noteType) {
					row.createSpan({ text: pipe.noteType, cls: "ft-badge ft-badge-muted" });
				}
				row.createSpan({
					text: `${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`,
					cls: "ft-text-muted ft-text-sm",
				});
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
			noteType: cfg.noteType ?? "",
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

		new Setting(panel)
			.setName("Note type")
			.setDesc("Associate this export with a type for TypeDoc creation (optional)")
			.addText((t) =>
				t
					.setValue(cfg.noteType ?? "")
					.setPlaceholder("e.g. Event, Asset, Service")
					.onChange((v) => { edits.noteType = v || undefined; }),
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

			if (this.documentedProperties.has(entry.propertyName)) {
				const docIcon = item.createSpan();
				setIcon(docIcon, "file-text");
				docIcon.style.opacity = "0.4";
				docIcon.style.flexShrink = "0";
				docIcon.setAttribute("aria-label", "Documented");
			}

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
		if (entry.typeNames && entry.typeNames.length > 0) {
			for (const typeName of entry.typeNames) {
				const chip = badges.createSpan({
					text: typeName,
					cls: "ft-badge",
				});
				chip.style.cursor = "pointer";
				chip.addEventListener("click", () => {
					this.selectedTypeName = typeName;
					this.navigateTo("types");
				});
			}
		}

		// Description from PropertyDoc frontmatter
		const hasDoc = this.documentedProperties.has(entry.propertyName);
		if (hasDoc) {
			const docPath = this.dataExchangeService.getPropertyDocPath(entry.propertyName);
			const docFile = this.app.vault.getAbstractFileByPath(docPath);
			if (docFile instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(docFile);
				const description = cache?.frontmatter?.description;
				if (description && String(description).trim()) {
					left.createDiv({
						text: String(description),
						cls: "ft-detail-description ft-mt-1",
					});
				}
			}
		}

		// CSV column names
		if (entry.csvColumnNames.length > 0) {
			const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
			card.createDiv({ text: "CSV Columns", cls: "ft-detail-section-header" });
			const chips = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const col of entry.csvColumnNames) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// Configs using this property
		if (entry.usedInConfigs.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
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
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: "Sample Values", cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const val of entry.sampleValues) {
				chips.createSpan({ text: val, cls: "ft-badge ft-badge-muted" });
			}
		}

		// Actions: Create / Open documentation
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		if (hasDoc) {
			const openLink = actions.createEl("span", { cls: "ft-nav-link" });
			const openIcon = openLink.createSpan();
			setIcon(openIcon, "file-text");
			openLink.appendText(" Open Documentation");
			openLink.addEventListener("click", () => {
				const docPath = this.dataExchangeService.getPropertyDocPath(entry.propertyName);
				void this.app.workspace.openLinkText(docPath, "", false);
			});
		} else {
			const createLink = actions.createEl("span", { cls: "ft-nav-link" });
			const createIcon = createLink.createSpan();
			setIcon(createIcon, "file-plus");
			createLink.appendText(" Create Documentation");
			createLink.addEventListener("click", () => {
				void this.dataExchangeService.createPropertyDoc(entry.propertyName).then((docPath) => {
					// file.created event will trigger scanPropertyDocs + scheduleRender
					new Notice(`Created property doc: ${entry.propertyName}`);
					void this.app.workspace.openLinkText(docPath, "", false);
				});
			});
		}
	}

	// ── Pipelines dashboard section ─────────────────────────

	private renderDashboardPipelines(container: HTMLElement): void {
		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderDashboardSectionHeader(section, "layers", "Import Pipelines", this.pipelineConfigs.length);
		section.createDiv({
			text: "Merge multiple CSV reports into enriched notes by matching on a shared key column.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		if (this.pipelineConfigs.length === 0) {
			const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
			const ctaIcon = cta.createDiv();
			setIcon(ctaIcon, "layers");
			ctaIcon.style.opacity = "0.3";
			ctaIcon.style.marginBottom = "0.5rem";
			cta.createDiv({
				text: "No import pipelines yet",
				cls: "ft-heading ft-heading-sm ft-mb-1",
			});
			cta.createDiv({
				text: "Create a pipeline to merge multiple CSV reports into enriched notes.",
				cls: "ft-text-muted ft-text-sm ft-mb-3",
			});
			const ctaBtn = cta.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			const ctaBtnIcon = ctaBtn.createSpan({ cls: "flowti-csv-btn-icon" });
			setIcon(ctaBtnIcon, "plus");
			ctaBtn.appendText(" New Pipeline");
			ctaBtn.addEventListener("click", () => {
				this.createNewPipeline();
			});
			return;
		}

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "Name" });
		headRow.createEl("th", { text: "Target" });
		headRow.createEl("th", { text: "Sources" });
		headRow.createEl("th", { text: "" });

		const tbody = table.createEl("tbody");

		const sorted = [...this.pipelineConfigs].sort((a, b) => {
			if ((a.favourite ?? false) !== (b.favourite ?? false)) return a.favourite ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		for (const pipe of sorted) {
			const tr = tbody.createEl("tr");

			// Name column — star + name
			const nameTd = tr.createEl("td");
			const nameRow = nameTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

			const starIcon = nameRow.createSpan({ cls: "ft-nav-link" });
			starIcon.style.flexShrink = "0";
			setIcon(starIcon, pipe.favourite ? "star" : "star-off");
			if (pipe.favourite) starIcon.style.color = "var(--text-accent)";
			starIcon.setAttribute("aria-label", pipe.favourite ? "Unfavourite" : "Favourite");
			starIcon.addEventListener("click", () => {
				void this.dataExchangeService.togglePipelineFavourite(pipe.id).then(() => {
					this.scheduleRender();
				});
			});

			const cfgLink = nameRow.createEl("span", {
				text: pipe.name || "(unnamed)",
				cls: "ft-nav-link",
			});
			cfgLink.addEventListener("click", () => {
				this.selectedPipelineId = pipe.id;
				this.navigateTo("pipelines");
			});

			// Target column
			const targetTd = tr.createEl("td");
			const targetText = targetTd.createEl("span", {
				text: pipe.targetFolder || "—",
				cls: pipe.targetFolder ? "ft-text-sm" : "ft-text-muted",
			});
			if (pipe.targetFolder) {
				targetText.style.whiteSpace = "nowrap";
				targetText.style.overflow = "hidden";
				targetText.style.textOverflow = "ellipsis";
				targetText.style.display = "block";
				targetText.style.maxWidth = "12rem";
			}

			// Sources count
			tr.createEl("td").createSpan({
				text: `${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});

			// Actions
			const actionsTd = tr.createEl("td");
			const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

			const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(editLink.createSpan(), "pencil");
			editLink.setAttribute("aria-label", "Edit");
			editLink.addEventListener("click", () => {
				this.selectedPipelineId = pipe.id;
				this.navigateTo("pipelines");
			});

			const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(previewLink.createSpan(), "eye");
			previewLink.setAttribute("aria-label", "Preview");
			previewLink.addEventListener("click", () => {
				this.selectedPipelineId = pipe.id;
				this.navigateTo("pipelines");
				setTimeout(() => { void this.runPipelinePreview(pipe); }, 50);
			});

			const runLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(runLink.createSpan(), "play");
			runLink.setAttribute("aria-label", "Run");
			runLink.addEventListener("click", () => {
				this.selectedPipelineId = pipe.id;
				this.navigateTo("pipelines");
				setTimeout(() => { this.executePipelineWithFeedback(pipe); }, 50);
			});
		}

		// "New Pipeline" link at bottom
		const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addLink = footer.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addLink.createSpan();
		setIcon(addIcon, "plus");
		addLink.appendText(" New Pipeline");
		addLink.addEventListener("click", () => {
			this.createNewPipeline();
		});
	}

	private createNewPipeline(): void {
		new InputModal(this.app, {
			title: "New Import Pipeline",
			placeholder: "e.g. Daily Inventory Merge",
			inputName: "Pipeline name",
			inputDesc: "A descriptive name for this pipeline",
			submitLabel: "Create",
			onSubmit: (name) => {
				void this.dataExchangeService
					.savePipeline({ name, targetFolder: "", mergeKey: "item_id", sources: [] })
					.then((saved) => {
						this.selectedPipelineId = saved.id;
						this.navigateTo("pipelines");
						// Set AFTER navigateTo (which clears editing state)
						this.editingPipelineId = saved.id;
					});
			},
		}).open();
	}

	// ── Pipelines page ──────────────────────────────────────

	private renderPipelinesMaster(): void {
		this.masterTreeEl.empty();

		let configs = this.pipelineConfigs;
		if (this.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(this.filterText) ||
					c.targetFolder.toLowerCase().includes(this.filterText) ||
					c.mergeKey.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Import Pipelines" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});
		const headerSpacer = header.createDiv();
		headerSpacer.style.flex = "1";
		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttr("aria-label", "New Pipeline");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.createNewPipeline();
		});

		if (configs.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = this.filterText
				? "No matching pipelines"
				: "No saved pipelines yet";
			return;
		}

		for (const pipe of configs) {
			this.renderPipelineItem(pipe);
		}
	}

	private renderPipelineItem(pipe: SavedMultiImportPipeline): void {
		const isSelected = this.selectedPipelineId === pipe.id;
		const item = this.masterTreeEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		item.style.alignItems = "flex-start";

		const iconEl = item.createSpan();
		setIcon(iconEl, "layers");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";
		iconEl.style.marginTop = "0.125rem";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: pipe.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
		sub.style.whiteSpace = "nowrap";
		sub.style.overflow = "hidden";
		sub.style.textOverflow = "ellipsis";
		sub.textContent = `${pipe.targetFolder || "(no folder)"} · ${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`;

		item.createSpan({
			text: pipe.mergeKey,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.selectedPipelineId = pipe.id;
			this.editingPipelineId = null;
			this.renderPipelinesMaster();
			this.renderPipelinesDetail();
		});
	}

	private renderPipelinesDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedPipelineId) {
			this.renderEmptyDetail("layers", "Select a pipeline to view details");
			return;
		}

		const pipe = this.pipelineConfigs.find((c) => c.id === this.selectedPipelineId);
		if (!pipe) {
			this.renderEmptyDetail("layers", "Pipeline not found");
			return;
		}

		if (this.editingPipelineId === pipe.id) {
			this.renderPipelineEditForm(pipe);
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: pipe.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Pipeline", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: pipe.mergeKey, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({
			text: `${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});

		// Actions bar
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Execute
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => {
			this.executePipelineWithFeedback(pipe);
		});

		// Preview
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const previewIcon = previewLink.createSpan();
		setIcon(previewIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			void this.runPipelinePreview(pipe);
		});

		// Edit
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => {
			this.editingPipelineId = pipe.id;
			this.renderPipelinesDetail();
		});

		// Open Doc
		const docPath = this.dataExchangeService.getPipelineDocPath(pipe.name);
		const docFile = this.app.vault.getAbstractFileByPath(docPath);
		const docExists = docFile instanceof TFile;
		const docLink = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docLink.createSpan();
		setIcon(docIcon, docExists ? "file-text" : "file-plus");
		docLink.appendText(docExists ? " Read Doc" : " Create Doc");
		docLink.addEventListener("click", () => {
			if (docExists) {
				void this.app.workspace.openLinkText(docPath, "", false);
			} else {
				void this.dataExchangeService
					.ensurePipelineDoc(pipe.id)
					.then((path) => {
						if (path) void this.app.workspace.openLinkText(path, "", false);
						this.renderPipelinesDetail();
					});
			}
		});

		// Open View (.base file)
		const resolvedBase = this.resolvePipelineBaseFile(pipe);
		if (resolvedBase) {
			const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
			const viewIcon = viewLink.createSpan();
			setIcon(viewIcon, "table");
			viewLink.appendText(" Open View");
			viewLink.addEventListener("click", () => {
				void this.app.workspace.getLeaf(false).openFile(resolvedBase);
			});
		}

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete pipeline "${pipe.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.dataExchangeService
						.deletePipeline(pipe.id)
						.then(() => {
							this.selectedPipelineId = null;
							this.refreshConfigs();
							this.renderPipelinesMaster();
							this.renderPipelinesDetail();
						});
				},
			}).open();
		});

		// ── Description from linked config doc ───────────────
		if (docExists && docFile instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(docFile);
			const description = cache?.frontmatter?.["description"] as string | undefined;
			if (description) {
				const descSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
				descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
				descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
			}
		}

		// Config info card
		const configCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });
		this.addInfoRow(configGrid, "Target Folder", pipe.targetFolder || "(not set)");
		this.addInfoRow(configGrid, "Merge Key", pipe.mergeKey);
		this.addInfoRow(configGrid, "Sources", String(pipe.sources.length));
		if (pipe.noteType) {
			this.addInfoRow(configGrid, "Note Type", pipe.noteType);
		}
		if (pipe.namePrefix) {
			this.addInfoRow(configGrid, "Name Prefix", pipe.namePrefix);
		}
		if (pipe.nameSuffix) {
			this.addInfoRow(configGrid, "Name Suffix", pipe.nameSuffix);
		}
		if (pipe.exportConfigId) {
			const exportCfg = this.dataExchangeService.getExportConfig(pipe.exportConfigId);
			this.addInfoRow(configGrid, "Export Step", exportCfg?.name ?? "(deleted)");
		}
		if (pipe.createBase) {
			this.addInfoRow(configGrid, "Base View", pipe.basePath || "(auto-generated)");
		}
		this.addInfoRow(configGrid, "Created", new Date(pipe.createdAt).toLocaleString());
		if (pipe.lastExecutedAt) {
			this.addInfoRow(configGrid, "Last Run", new Date(pipe.lastExecutedAt).toLocaleString());
		}

		// Sources list
		const sourcesSection = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
		sourcesSection.createDiv({ text: "Sources", cls: "ft-detail-section-header" });

		if (pipe.sources.length === 0) {
			sourcesSection.createDiv({
				text: "No sources configured yet. Add a CSV source to get started.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		} else {
			for (let i = 0; i < pipe.sources.length; i++) {
				const source = pipe.sources[i];
				this.renderPipelineSourceCard(sourcesSection, pipe, source, i);
			}
		}

		// Custom property conflict warnings
		if (pipe.sources.length > 1) {
			const propMap = new Map<string, Array<{ sourceLabel: string; value: string }>>();
			for (const src of pipe.sources) {
				if (!src.customProperties) continue;
				const label = src.csvPath.split("/").pop() ?? src.csvPath;
				for (const [key, value] of Object.entries(src.customProperties)) {
					if (!propMap.has(key)) propMap.set(key, []);
					propMap.get(key)!.push({ sourceLabel: label, value });
				}
			}
			const conflicts: Array<{ key: string; entries: Array<{ sourceLabel: string; value: string }> }> = [];
			for (const [key, entries] of propMap) {
				if (entries.length > 1) {
					const values = new Set(entries.map((e) => e.value));
					if (values.size > 1) {
						conflicts.push({ key, entries });
					}
				}
			}

			if (conflicts.length > 0) {
				const warnSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
				warnSection.style.borderLeft = "3px solid var(--text-warning, #e5a100)";
				const warnHeader = warnSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
				const warnIcon = warnHeader.createSpan();
				setIcon(warnIcon, "alert-triangle");
				warnIcon.style.color = "var(--text-warning, #e5a100)";
				warnIcon.style.flexShrink = "0";
				warnHeader.createSpan({
					text: `${conflicts.length} custom property conflict${conflicts.length !== 1 ? "s" : ""}`,
					cls: "ft-heading ft-heading-sm",
				});
				const warnDesc = warnSection.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });
				warnDesc.textContent = "Multiple sources define the same key with different values. The last source processed will win.";

				const grid = warnSection.createDiv({ cls: "ft-detail-info-grid ft-px-2 ft-pb-2" });
				for (const c of conflicts) {
					this.addInfoRow(grid, c.key, c.entries.map((e) => `"${e.value}" (${e.sourceLabel})`).join(" vs "));
				}
			}
		}

		// Custom properties summary (all unique keys across sources)
		if (pipe.sources.some((s) => s.customProperties && Object.keys(s.customProperties).length > 0)) {
			const propsSection = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			propsSection.createDiv({ text: "Custom Properties", cls: "ft-detail-section-header" });
			const allProps = new Map<string, string>();
			for (const src of pipe.sources) {
				if (!src.customProperties) continue;
				for (const [key, value] of Object.entries(src.customProperties)) {
					allProps.set(key, value); // last write wins — same as execution
				}
			}
			const propGrid = propsSection.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of allProps) {
				this.addInfoRow(propGrid, key, value);
			}
		}

		// Add Source button
		const addRow = sourcesSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addLink = addRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addLink.createSpan();
		setIcon(addIcon, "plus");
		addLink.appendText(" Add Source");
		addLink.addEventListener("click", () => {
			new PipelineSourceModal({
				app: this.app,
				importService: this.dataExchangeService.getImportService(),
				mergeKey: pipe.mergeKey,
				otherSources: pipe.sources,
				onSave: (newSource) => {
					const updatedSources = [...pipe.sources, newSource];
					void this.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => {
							this.refreshConfigs();
							this.renderPipelinesMaster();
							this.renderPipelinesDetail();
						});
				},
			}).open();
		});
	}

	private renderPipelineSourceCard(
		container: HTMLElement,
		pipe: SavedMultiImportPipeline,
		source: SavedMultiImportPipeline["sources"][0],
		index: number,
	): void {
		const card = container.createDiv({ cls: "ft-card ft-mt-1" });
		card.style.padding = "0.5rem 0.75rem";

		// Header row: CSV name + badges
		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const csvIcon = headerRow.createSpan();
		setIcon(csvIcon, "file-spreadsheet");
		csvIcon.style.opacity = "0.5";
		csvIcon.style.flexShrink = "0";

		const csvName = source.csvPath.split("/").pop() ?? source.csvPath;
		const nameEl = headerRow.createSpan({ text: csvName, cls: "ft-heading ft-heading-sm" });
		nameEl.style.flex = "1";
		nameEl.style.minWidth = "0";
		nameEl.style.overflow = "hidden";
		nameEl.style.textOverflow = "ellipsis";
		nameEl.style.whiteSpace = "nowrap";

		// Merge key badge
		headerRow.createSpan({
			text: `${source.mergeKeyColumn} → ${pipe.mergeKey}`,
			cls: "ft-badge ft-badge-muted",
		});

		// Column count badge
		const included = source.columnMappings.filter((m) => m.included).length;
		const total = source.columnMappings.length;
		headerRow.createSpan({
			text: `${included}/${total} cols`,
			cls: "ft-badge ft-badge-muted",
		});

		// Info row
		const infoRow = card.createDiv({ cls: "ft-text-muted ft-text-sm ft-mt-1" });
		infoRow.textContent = source.csvPath;

		// Custom properties (show key-value pairs)
		if (source.customProperties && Object.keys(source.customProperties).length > 0) {
			const propsRow = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			propsRow.style.flexWrap = "wrap";
			for (const [key, value] of Object.entries(source.customProperties)) {
				const chip = propsRow.createSpan({ cls: "ft-badge ft-badge-muted" });
				chip.textContent = `${key}: ${value}`;
			}
		}

		// Actions: Edit / Remove
		const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		const editLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Edit");
		editLink.addEventListener("click", () => {
			new PipelineSourceModal({
				app: this.app,
				importService: this.dataExchangeService.getImportService(),
				mergeKey: pipe.mergeKey,
				existingSource: source,
				otherSources: pipe.sources.filter((s) => s.id !== source.id),
				onSave: (updated) => {
					const updatedSources = pipe.sources.map((s) => (s.id === updated.id ? updated : s));
					void this.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => {
							this.refreshConfigs();
							this.renderPipelinesMaster();
							this.renderPipelinesDetail();
						});
				},
			}).open();
		});

		const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		removeLink.style.color = "var(--text-error)";
		const removeIcon = removeLink.createSpan();
		setIcon(removeIcon, "x");
		removeLink.appendText(" Remove");
		removeLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Remove source "${csvName}" from pipeline?`,
				confirmLabel: "Remove",
				onConfirm: () => {
					const updatedSources = pipe.sources.filter((_, idx) => idx !== index);
					void this.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => {
							this.refreshConfigs();
							this.renderPipelinesMaster();
							this.renderPipelinesDetail();
						});
				},
			}).open();
		});
	}

	private renderPipelineEditForm(pipe: SavedMultiImportPipeline): void {
		const panel = this.detailPanelEl;
		panel.createEl("h3", { text: "Edit Pipeline", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedMultiImportPipeline> = {
			name: pipe.name,
			targetFolder: pipe.targetFolder,
			mergeKey: pipe.mergeKey,
			noteType: pipe.noteType ?? "",
			namePrefix: pipe.namePrefix ?? "",
			nameSuffix: pipe.nameSuffix ?? "",
			createBase: pipe.createBase ?? false,
			basePath: pipe.basePath ?? "",
			exportConfigId: pipe.exportConfigId,
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(pipe.name).onChange((v) => { edits.name = v; }));

		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.setDesc("Where merged notes will be created")
			.addText((t) => t.setValue(pipe.targetFolder).onChange((v) => { edits.targetFolder = v; }));
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.app);
				new FolderPickerModal(this.app, folders, (folder) => {
					edits.targetFolder = folder;
					this.renderPipelinesDetail();
				}).open();
			}),
		);

		new Setting(panel)
			.setName("Merge key")
			.setDesc("Canonical frontmatter key used to match notes across sources (e.g. item_id)")
			.addText((t) => t.setValue(pipe.mergeKey).onChange((v) => { edits.mergeKey = v; }));

		new Setting(panel)
			.setName("Note type")
			.setDesc("Type value added to every note's frontmatter (optional)")
			.addText((t) => t
				.setValue(pipe.noteType ?? "")
				.setPlaceholder("e.g. Event, Asset, Service")
				.onChange((v) => { edits.noteType = v || undefined; }),
			);

		new Setting(panel)
			.setName("Filename prefix")
			.setDesc("Prepended to every note filename (optional)")
			.addText((t) => t
				.setValue(pipe.namePrefix ?? "")
				.setPlaceholder("")
				.onChange((v) => { edits.namePrefix = v || undefined; }),
			);

		new Setting(panel)
			.setName("Filename suffix")
			.setDesc("Appended to every note filename before .md (optional)")
			.addText((t) => t
				.setValue(pipe.nameSuffix ?? "")
				.setPlaceholder("")
				.onChange((v) => { edits.nameSuffix = v || undefined; }),
			);

		new Setting(panel)
			.setName("Create .base view")
			.setDesc("Generate a table view for merged notes")
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

		const exportConfigs = this.dataExchangeService.getSavedExportConfigs();
		new Setting(panel)
			.setName("Export step")
			.setDesc("Run a saved export after pipeline completes (optional)")
			.addDropdown((dd) => {
				dd.addOption("", "None");
				for (const cfg of exportConfigs) {
					dd.addOption(cfg.id, cfg.name);
				}
				dd.setValue(pipe.exportConfigId ?? "");
				dd.onChange((v) => { edits.exportConfigId = v || undefined; });
			});

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.dataExchangeService
				.updatePipeline(pipe.id, edits)
				.then(() => {
					this.editingPipelineId = null;
					this.refreshConfigs();
					this.renderPipelinesMaster();
					this.renderPipelinesDetail();
					new Notice("Pipeline updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.editingPipelineId = null;
			this.renderPipelinesDetail();
		});
	}

	private async runPipelinePreview(pipe: SavedMultiImportPipeline): Promise<void> {
		if (pipe.sources.length === 0) {
			new Notice("Pipeline has no sources. Add CSV sources first.");
			return;
		}

		// Remove any existing preview/progress section
		const existing = this.detailPanelEl.querySelector(".ft-pipeline-progress") as HTMLElement | null;
		if (existing) existing.remove();

		const section = createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
		const actionsBar = this.detailPanelEl.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.detailPanelEl.insertBefore(section, actionsBar.nextSibling);
		} else {
			this.detailPanelEl.appendChild(section);
		}

		// Show loading state
		const loadingRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const loadSpinner = loadingRow.createSpan();
		setIcon(loadSpinner, "loader");
		loadSpinner.style.opacity = "0.6";
		loadSpinner.addClass("ft-spin");
		loadingRow.createSpan({ text: "Preparing preview...", cls: "ft-text-sm" });

		try {
			const importService = this.dataExchangeService.getImportService();
			const previewSources: Array<{
				sourceId: string;
				csvName: string;
				rowCount: number;
				columns: string[];
				mergeKeyValues: string[];
				error?: string;
			}> = [];

			// Parse each CSV source
			for (const source of pipe.sources) {
				try {
					const parsed = await importService.parseFile(source.csvPath);
					const mergeKeyIndex = parsed.headers.indexOf(source.mergeKeyColumn);
					if (mergeKeyIndex < 0) {
						previewSources.push({
							sourceId: source.id,
							csvName: source.csvPath.split("/").pop() ?? source.csvPath,
							rowCount: 0,
							columns: [],
							mergeKeyValues: [],
							error: `Merge key column "${source.mergeKeyColumn}" not found`,
						});
						continue;
					}

					const mergeKeyValues = parsed.rows
						.map((row) => row[mergeKeyIndex])
						.filter((v): v is string => v !== undefined && v !== "");

					const columns = source.columnMappings
						.filter((m) => m.included && m.csvColumn !== source.mergeKeyColumn)
						.map((m) => m.frontmatterKey);

					previewSources.push({
						sourceId: source.id,
						csvName: source.csvPath.split("/").pop() ?? source.csvPath,
						rowCount: parsed.rows.length,
						columns,
						mergeKeyValues,
					});
				} catch (err) {
					previewSources.push({
						sourceId: source.id,
						csvName: source.csvPath.split("/").pop() ?? source.csvPath,
						rowCount: 0,
						columns: [],
						mergeKeyValues: [],
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}

			// Collect unique merge key values across all sources
			const allKeys = new Set<string>();
			for (const src of previewSources) {
				for (const v of src.mergeKeyValues) allKeys.add(v);
			}

			// Check existence for each unique key
			const entries: Array<{ key: string; filename: string; exists: boolean }> = [];
			for (const key of allKeys) {
				const sanitized = importService.sanitizeFilename(key);
				if (!sanitized) continue;
				const prefix = pipe.namePrefix ?? "";
				const suffix = pipe.nameSuffix ?? "";
				const filename = `${prefix}${sanitized}${suffix}`;
				const notePath = `${pipe.targetFolder}/${filename}.md`;
				const exists = this.app.vault.getAbstractFileByPath(notePath) instanceof TFile;
				entries.push({ key, filename, exists });
			}

			const toCreate = entries.filter((e) => !e.exists).length;
			const toUpdate = entries.filter((e) => e.exists).length;

			// Render preview
			section.empty();
			this.renderPipelinePreview(section, pipe, previewSources, entries, toCreate, toUpdate);
		} catch (err) {
			section.empty();
			const errRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const errIcon = errRow.createSpan();
			setIcon(errIcon, "x-circle");
			errIcon.style.color = "var(--text-error)";
			errRow.createSpan({
				text: `Preview failed: ${err instanceof Error ? err.message : String(err)}`,
				cls: "ft-text-sm",
			});
		}
	}

	private renderPipelinePreview(
		section: HTMLElement,
		pipe: SavedMultiImportPipeline,
		previewSources: Array<{
			sourceId: string;
			csvName: string;
			rowCount: number;
			columns: string[];
			mergeKeyValues: string[];
			error?: string;
		}>,
		entries: Array<{ key: string; filename: string; exists: boolean }>,
		toCreate: number,
		toUpdate: number,
	): void {
		// Header
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "eye");
		header.createEl("span", { text: "Pipeline Preview", cls: "ft-text-sm ft-font-medium" });

		// Summary stats
		const stats = section.createDiv({ cls: "ft-flex ft-gap-3 ft-px-2 ft-pb-2" });
		stats.createSpan({
			text: `${entries.length} items`,
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});
		if (toCreate > 0) {
			const createBadge = stats.createSpan({ cls: "ft-badge ft-text-sm" });
			createBadge.style.color = "var(--text-success)";
			createBadge.textContent = `${toCreate} new`;
		}
		if (toUpdate > 0) {
			const updateBadge = stats.createSpan({ cls: "ft-badge ft-text-sm" });
			updateBadge.style.color = "var(--text-accent)";
			updateBadge.textContent = `${toUpdate} update`;
		}

		// Sources breakdown
		const sourcesDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
		for (const src of previewSources) {
			const srcRow = sourcesDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			if (src.error) {
				const errIcon = srcRow.createSpan();
				setIcon(errIcon, "alert-triangle");
				errIcon.style.color = "var(--text-error)";
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({ text: src.error, cls: "ft-text-sm ft-text-muted" });
			} else {
				const srcIcon = srcRow.createSpan();
				setIcon(srcIcon, "file-spreadsheet");
				srcIcon.style.opacity = "0.6";
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({
					text: `${src.rowCount} rows · ${src.columns.length} columns`,
					cls: "ft-text-muted ft-text-sm",
				});
			}
		}

		// Entries table (scrollable)
		if (entries.length > 0) {
			section.createDiv({
				text: "Items",
				cls: "ft-detail-section-header ft-px-2 ft-mt-1",
			});
			const tableDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
			tableDiv.style.maxHeight = "200px";
			tableDiv.style.overflowY = "auto";

			for (const entry of entries) {
				const row = tableDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
				row.style.borderBottom = "1px solid var(--background-modifier-border)";

				const dot = row.createSpan({ cls: "ft-text-sm" });
				dot.style.color = entry.exists ? "var(--text-accent)" : "var(--text-success)";
				dot.textContent = entry.exists ? "○" : "●";

				const keySpan = row.createSpan({ text: entry.key, cls: "ft-text-sm" });
				keySpan.style.flex = "1";
				keySpan.style.overflow = "hidden";
				keySpan.style.textOverflow = "ellipsis";
				keySpan.style.whiteSpace = "nowrap";

				const badge = row.createSpan({
					text: entry.exists ? "Update" : "New",
					cls: "ft-badge ft-badge-muted ft-text-sm",
				});
				if (!entry.exists) badge.style.color = "var(--text-success)";
			}
		}

		// Action buttons
		const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-justify-end ft-gap-2 ft-p-2" });
		footer.style.borderTop = "1px solid var(--background-modifier-border)";

		const cancelBtn = footer.createEl("button", { cls: "mod-muted", text: "Cancel" });
		cancelBtn.addEventListener("click", () => section.remove());

		const hasErrors = previewSources.some((s) => s.error);
		const runBtn = footer.createEl("button", { cls: "mod-cta", text: "Run Pipeline" });
		if (hasErrors) {
			runBtn.disabled = true;
			runBtn.title = "Fix source errors before running";
		}
		runBtn.addEventListener("click", () => {
			section.remove();
			this.executePipelineWithFeedback(pipe);
		});
	}

	private executePipelineWithFeedback(pipe: SavedMultiImportPipeline): void {
		// Show inline progress in the detail panel
		const existing = this.detailPanelEl.querySelector(".ft-pipeline-progress") as HTMLElement | null;
		if (existing) existing.remove();
		const section = createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
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
		const statusText = statusRow.createSpan({
			text: `Running pipeline: ${pipe.name}...`,
			cls: "ft-text-sm",
		});

		const barBg = section.createDiv();
		barBg.style.cssText = "height:4px;background:var(--background-modifier-border);border-radius:2px;margin:0 0.5rem 0.5rem;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

		// Listen for source-level progress
		const offSourceCompleted = this.eventBus.on("dataExchange.pipeline.sourceCompleted", (event) => {
			const { sourceIndex, totalSources, sourceResult } = event.payload;
			const pct = totalSources > 0 ? Math.round(((sourceIndex + 1) / totalSources) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Processing source ${sourceIndex + 1} of ${totalSources}...`;
			const csvName = sourceResult.csvPath.split("/").pop() ?? sourceResult.csvPath;
			detailText.textContent = `${csvName}: ${sourceResult.result.created} created, ${sourceResult.result.updated} updated`;
		});

		const cleanup = (success: boolean, message: string) => {
			offSourceCompleted();
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

		const offComplete = this.eventBus.on("dataExchange.pipeline.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `Pipeline complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "") +
				` (${r.completedSources}/${r.totalSources} sources)`;
			cleanup(true, msg);
			new Notice(msg);
		});
		const offFailed = this.eventBus.on("dataExchange.pipeline.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Pipeline failed: ${event.payload.error}`);
			new Notice(`Pipeline failed: ${event.payload.error}`);
		});

		void this.eventBus.emit("dataExchange.pipeline.execute", {
			pipelineId: pipe.id,
		});
	}

	// ── Types page ──────────────────────────────────────────

	private renderTypesMaster(): void {
		this.masterTreeEl.empty();

		let entries = this.typeEntries;
		if (this.filterText) {
			entries = entries.filter((e) =>
				e.name.toLowerCase().includes(this.filterText) ||
				e.description.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Note Types" });
		header.createSpan({
			text: `${entries.length}`,
			cls: "ft-master-category-count",
		});
		const headerSpacer = header.createDiv();
		headerSpacer.style.flex = "1";
		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttr("aria-label", "New Type");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.app, {
				title: "New Note Type",
				placeholder: "e.g. Event, Asset, Service",
				onSubmit: (name) => {
					if (!name.trim()) return;
					void this.dataExchangeService
						.createOrUpdateTypeDoc(name.trim())
						.then(() => {
							setTimeout(() => {
								this.scanTypeDocs();
								this.selectedTypeName = name.trim();
								this.renderTypesMaster();
								this.renderTypesDetail();
							}, 500);
						});
				},
			}).open();
		});

		if (entries.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = this.filterText ? "No matching types" : "No note types found";
			return;
		}

		for (const entry of entries) {
			const isSelected = this.selectedTypeName === entry.name;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});
			item.style.alignItems = "flex-start";

			const iconEl = item.createSpan();
			setIcon(iconEl, "shapes");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";
			iconEl.style.marginTop = "0.125rem";

			const textBlock = item.createDiv({ cls: "ft-master-event-name" });
			textBlock.style.minWidth = "0";
			textBlock.createDiv({ text: entry.name });
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
			sub.style.whiteSpace = "nowrap";
			sub.style.overflow = "hidden";
			sub.style.textOverflow = "ellipsis";
			sub.textContent = `${entry.properties.length} field${entry.properties.length !== 1 ? "s" : ""} · ${entry.pipelineCount} config${entry.pipelineCount !== 1 ? "s" : ""}`;

			const docIcon = item.createSpan();
			setIcon(docIcon, "file-text");
			docIcon.style.opacity = "0.4";
			docIcon.style.flexShrink = "0";
			docIcon.setAttribute("aria-label", "TypeDoc");

			item.addEventListener("click", () => {
				this.selectedTypeName = entry.name;
				this.renderTypesMaster();
				this.renderTypesDetail();
			});
		}
	}

	private renderTypesDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedTypeName) {
			this.renderEmptyDetail("shapes", "Select a type to view details");
			return;
		}

		const entry = this.typeEntries.find((e) => e.name === this.selectedTypeName);
		if (!entry) {
			this.renderEmptyDetail("shapes", "Type not found");
			return;
		}

		const typeName = entry.name;
		const lowerType = typeName.toLowerCase();

		// ── Header ──────────────────────────────────────────
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: typeName, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({
			text: `${entry.properties.length} field${entry.properties.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});

		// ── Actions (always on top) ─────────────────────────
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Doc");
		openLink.addEventListener("click", () => {
			void this.app.workspace.openLinkText(entry.filePath, "", false);
		});

		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete type "${typeName}" and its documentation?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					const file = this.app.vault.getAbstractFileByPath(entry.filePath);
					if (file instanceof TFile) {
						void this.app.vault.delete(file).then(() => {
							this.selectedTypeName = null;
							setTimeout(() => {
								this.scanTypeDocs();
								this.renderTypesMaster();
								this.renderTypesDetail();
							}, 300);
						});
					}
				},
			}).open();
		});

		// ── Description ─────────────────────────────────────
		if (entry.description) {
			const descCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
			descCard.createDiv({ text: entry.description, cls: "ft-text-muted ft-p-2" });
		}

		// ── Created by (imports / pipelines that produce this type) ──
		const producers = [
			...this.pipelineConfigs.filter((p) => p.noteType === typeName),
			...this.importConfigs.filter((c) => c.noteType === typeName),
		];
		if (producers.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Created by", cls: "ft-detail-section-header" });

			for (const cfg of producers) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const isPipeline = "sources" in cfg;
				const cfgIcon = item.createSpan();
				setIcon(cfgIcon, isPipeline ? "layers" : "file-input");
				cfgIcon.style.opacity = "0.5";
				cfgIcon.style.flexShrink = "0";

				item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
				item.createSpan({
					text: isPipeline ? "Pipeline" : "Import",
					cls: "ft-badge ft-badge-muted",
				});

				item.addEventListener("click", () => {
					if (isPipeline) {
						this.selectedPipelineId = cfg.id;
						this.navigateTo("pipelines");
					} else {
						this.selectedImportId = cfg.id;
						this.navigateTo("imports");
					}
				});
			}
		}

		// ── Consumed by (exports that read this type) ───────
		const consumers = this.exportConfigs.filter((c) => c.noteType === typeName);
		if (consumers.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Consumed by", cls: "ft-detail-section-header" });

			for (const cfg of consumers) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const cfgIcon = item.createSpan();
				setIcon(cfgIcon, "file-output");
				cfgIcon.style.opacity = "0.5";
				cfgIcon.style.flexShrink = "0";

				item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
				item.createSpan({
					text: "Export",
					cls: "ft-badge ft-badge-muted",
				});

				item.addEventListener("click", () => {
					this.selectedExportId = cfg.id;
					this.navigateTo("exports");
				});
			}
		}

		// ── Events (CRUD lifecycle) ─────────────────────────
		const crudEvents = [
			{ event: `${lowerType}.created`, label: "Created", icon: "plus-circle", desc: `A new ${typeName} was added` },
			{ event: `${lowerType}.read`, label: "Read", icon: "eye", desc: `A ${typeName} was viewed or queried` },
			{ event: `${lowerType}.updated`, label: "Updated", icon: "edit", desc: `An existing ${typeName} was modified` },
			{ event: `${lowerType}.deleted`, label: "Deleted", icon: "trash", desc: `A ${typeName} was removed` },
		];

		const eventsSection = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
		eventsSection.createDiv({ text: "Lifecycle Events", cls: "ft-detail-section-header" });

		for (const ev of crudEvents) {
			const row = eventsSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const evIcon = row.createSpan();
			setIcon(evIcon, ev.icon);
			evIcon.style.opacity = "0.5";
			evIcon.style.flexShrink = "0";

			const textBlock = row.createDiv();
			textBlock.style.flex = "1";
			textBlock.style.minWidth = "0";
			const nameEl = textBlock.createDiv({ cls: "ft-text-sm" });
			nameEl.createEl("code", { text: ev.event });
			textBlock.createDiv({ text: ev.desc, cls: "ft-text-muted ft-text-sm" });

			// Open EventDoc
			const docBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			docBtn.style.flexShrink = "0";
			const docIcon = docBtn.createSpan();
			setIcon(docIcon, "file-text");
			docBtn.title = "Open event doc";
			docBtn.addEventListener("click", () => {
				const docPath = this.dataExchangeService.getEventDocPath(ev.event);
				void this.app.workspace.openLinkText(docPath, "", false);
			});

			// Show in Event Catalog
			const catalogBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			catalogBtn.style.flexShrink = "0";
			const catIcon = catalogBtn.createSpan();
			setIcon(catIcon, "list");
			catalogBtn.title = "Show in Event Catalog";
			catalogBtn.addEventListener("click", () => {
				this.openEventInCatalog(ev.event);
			});
		}

		// ── Fields (expected properties) ────────────────────
		if (entry.properties.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Fields", cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			chips.style.padding = "0.25rem 0.5rem";
			for (const prop of entry.properties) {
				const chip = chips.createSpan({ text: prop, cls: "ft-badge ft-badge-muted" });
				chip.style.cursor = "pointer";
				chip.addEventListener("click", () => {
					this.selectedDictProp = prop;
					this.navigateTo("properties");
				});
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
			const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-3" });
			const grid = card.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of entries) {
				const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
				this.addInfoRow(grid, key, displayValue);
			}
		}

		// Headers list (from frontmatter)
		const headers = fm.headers;
		if (Array.isArray(headers) && headers.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
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
				const cfgSection = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
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
		const section = createDiv({ cls: "ft-import-progress ft-card ft-mt-3" });
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

		// Merge noteType into customProperties if set
		const importCustomProps = { ...cfg.customProperties };
		if (cfg.noteType) {
			importCustomProps.type = cfg.noteType;
		}

		void this.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: Object.keys(importCustomProps).length > 0 ? importCustomProps : undefined,
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

	private resolvePipelineBaseFile(pipe: SavedMultiImportPipeline): TFile | null {
		// Explicit basePath
		if (pipe.createBase && pipe.basePath) {
			const bp = pipe.basePath.endsWith(".base") ? pipe.basePath : `${pipe.basePath}.base`;
			const f = this.app.vault.getAbstractFileByPath(bp);
			if (f instanceof TFile) return f;
		}
		// Default: {targetFolder}/{pipelineName}.base
		if (pipe.createBase && pipe.name) {
			const safeName = pipe.name.replace(/[\\/:*?"<>|]/g, "_");
			const defaultPath = pipe.targetFolder
				? `${pipe.targetFolder}/${safeName}.base`
				: `${safeName}.base`;
			const f = this.app.vault.getAbstractFileByPath(defaultPath);
			if (f instanceof TFile) return f;
		}
		// Proximity: any base file in targetFolder
		if (pipe.targetFolder) {
			for (const f of this.app.vault.getFiles()) {
				if (!f.path.endsWith(".base")) continue;
				const dir = f.path.substring(0, f.path.lastIndexOf("/"));
				if (dir === pipe.targetFolder || f.path.startsWith(pipe.targetFolder + "/")) {
					return f;
				}
			}
		}
		return null;
	}

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
			case "pipelines":
				count = this.pipelineConfigs.length;
				label = "saved pipelines";
				break;
			case "types":
				count = this.typeEntries.length;
				label = "note types";
				break;
		}
		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats ft-mt-2" });
		const stat = stats.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: String(count), cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}

	/** Opens the Event Catalog view and navigates to a specific event type. */
	private openEventInCatalog(eventType: string): void {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			const view = existing[0].view as EventCatalogView;
			view.navigateToEvent(eventType);
			return;
		}
		const leaf = workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_EVENT_CATALOG, active: true }).then(() => {
			workspace.revealLeaf(leaf);
			setTimeout(() => {
				const view = leaf.view as EventCatalogView;
				view.navigateToEvent(eventType);
			}, 300);
		});
	}
}
