/**
 * Data Exchange Hub — central management view for import/export operations.
 *
 * This is the orchestrator: it owns the Obsidian ItemView lifecycle, state,
 * scanning logic, and navigation. All page rendering is delegated to
 * components under `./hub/`.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type {
	ExportFormat,
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
	TypeDocEntry,
} from "../domain/dataExchange/types";
import type { HubPage, HubState, HubComponentDeps, HubNavigationCallbacks, CsvFileEntry, ReportEntry } from "./hub/types";
import { HubDashboard } from "./hub/HubDashboard";
import { ImportsTab } from "./hub/ImportsTab";
import { ExportsTab } from "./hub/ExportsTab";
import { ReportsTab } from "./hub/ReportsTab";
import { PropertiesTab } from "./hub/PropertiesTab";
import { PipelinesTab } from "./hub/PipelinesTab";
import { TypesTab } from "./hub/TypesTab";
import { openEventInCatalog } from "./hub/helpers";
import { buildSplitLayout } from "./catalog/helpers";

export const VIEW_TYPE_DATA_EXCHANGE_HUB = "flowti-data-exchange-hub";

export class DataExchangeHubView extends ItemView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private openCsvImportCb: (csvPath: string, savedConfig?: SavedImportConfig) => void;
	private openExportCb: (savedConfig: SavedExportConfig) => void;
	private openNewExportCb: (sourcePath: string, sourceType: "folder" | "base", format: ExportFormat) => void;

	// ── State ────────────────────────────────────────────────
	private currentPage: HubPage = "dashboard";
	private importConfigs: SavedImportConfig[] = [];
	private exportConfigs: SavedExportConfig[] = [];
	private pipelineConfigs: SavedMultiImportPipeline[] = [];
	private dictionaryEntries: import("../domain/dataExchange/types").DataDictionaryEntry[] = [];
	private reportEntries: ReportEntry[] = [];
	private typeEntries: TypeDocEntry[] = [];
	private csvFileEntries: CsvFileEntry[] = [];
	private documentedProperties = new Set<string>();
	private filterText = "";
	private showHiddenCsvs = false;

	private selectedImportId: string | null = null;
	private selectedExportId: string | null = null;
	private selectedDictProp: string | null = null;
	private selectedReportPath: string | null = null;
	private selectedPipelineId: string | null = null;
	private selectedTypeName: string | null = null;
	private editingImportId: string | null = null;
	private editingExportId: string | null = null;
	private editingPipelineId: string | null = null;

	// ── DOM references ───────────────────────────────────────
	private topBarEl!: HTMLElement;
	private topBarTitleEl!: HTMLElement;
	private dashboardEl!: HTMLElement;
	private splitEl!: HTMLElement;
	private masterTreeEl!: HTMLElement;
	private detailPanelEl!: HTMLElement;
	private searchInput!: HTMLInputElement;

	// ── Render ────────────────────────────────────────────────
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribes: (() => void)[] = [];

	// ── Tab components ───────────────────────────────────────
	private dashboard!: HubDashboard;
	private importsTab!: ImportsTab;
	private exportsTab!: ExportsTab;
	private reportsTab!: ReportsTab;
	private propertiesTab!: PropertiesTab;
	private pipelinesTab!: PipelinesTab;
	private typesTab!: TypesTab;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		openCsvImport: (csvPath: string, savedConfig?: SavedImportConfig) => void,
		openExport: (savedConfig: SavedExportConfig) => void,
		openNewExport: (sourcePath: string, sourceType: "folder" | "base", format: ExportFormat) => void,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.openCsvImportCb = openCsvImport;
		this.openExportCb = openExport;
		this.openNewExportCb = openNewExport;
	}

	getViewType(): string { return VIEW_TYPE_DATA_EXCHANGE_HUB; }
	getDisplayText(): string { return "Data Exchange Hub"; }
	getIcon(): string { return "arrow-left-right"; }

	// ══════════════════════════════════════════════════════════
	// Lifecycle
	// ══════════════════════════════════════════════════════════

	async onOpen(): Promise<void> {
		this.refreshConfigs();

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const wrapper = container.createDiv({ cls: "flowti-container ft-view-root" });

		// Top bar (hidden on dashboard)
		this.renderTopBar(wrapper);

		// Shared split layout (dashboard + master/detail)
		const layout = buildSplitLayout(wrapper, {
			searchPlaceholder: "Search configs...",
			onSearch: (text) => { this.filterText = text; this.scheduleRender(); },
		});
		this.dashboardEl = layout.dashboardEl;
		this.splitEl = layout.splitEl;
		this.searchInput = layout.searchInput;
		this.masterTreeEl = layout.masterTreeEl;
		this.detailPanelEl = layout.detailEl;

		// Create component deps and tab instances
		const deps = this.buildDeps();
		this.dashboard = new HubDashboard(this.dashboardEl, deps);
		this.importsTab = new ImportsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.exportsTab = new ExportsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.reportsTab = new ReportsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.propertiesTab = new PropertiesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.pipelinesTab = new PipelinesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.typesTab = new TypesTab(this.masterTreeEl, this.detailPanelEl, deps);

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

		this.dashboard.render();
	}

	async onClose(): Promise<void> {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	/** Opens the imports page and selects a specific config (for external callers). */
	showImportConfig(configId: string): void {
		this.selectedImportId = configId;
		this.navigateTo("imports");
	}

	// ══════════════════════════════════════════════════════════
	// Deps & state
	// ══════════════════════════════════════════════════════════

	private buildDeps(): HubComponentDeps {
		const navigation: HubNavigationCallbacks = {
			navigateTo: (page) => this.navigateTo(page),
			showImportConfig: (id) => this.showImportConfig(id),
			openCsvImport: (csvPath, cfg?) => this.openCsvImportCb(csvPath, cfg),
			openExport: (cfg) => this.openExportCb(cfg),
			openNewExport: (p, t, f) => this.openNewExportCb(p, t, f),
			openEventInCatalog: (et) => openEventInCatalog(this.app, et),
			createNewPipeline: () => this.pipelinesTab.createNewPipeline(),
			executeExportConfig: (cfg) => this.exportsTab.executeExportConfig(cfg),
			runPipelinePreview: (pipe) => {
				this.selectedPipelineId = pipe.id;
				this.navigateTo("pipelines");
				setTimeout(() => { void this.pipelinesTab.runPipelinePreview(pipe); }, 50);
			},
			executePipeline: (pipe) => {
				this.selectedPipelineId = pipe.id;
				this.navigateTo("pipelines");
				setTimeout(() => { this.pipelinesTab.executePipelineWithFeedback(pipe); }, 50);
			},
		};

		return {
			app: this.app,
			eventBus: this.eventBus,
			dataExchangeService: this.dataExchangeService,
			getState: () => this.getHubState(),
			setState: (partial) => this.setHubState(partial),
			navigation,
			scheduleRender: () => this.scheduleRender(),
		};
	}

	private getHubState(): HubState {
		return {
			currentPage: this.currentPage,
			importConfigs: this.importConfigs,
			exportConfigs: this.exportConfigs,
			pipelineConfigs: this.pipelineConfigs,
			dictionaryEntries: this.dictionaryEntries,
			reportEntries: this.reportEntries,
			typeEntries: this.typeEntries,
			csvFileEntries: this.csvFileEntries,
			documentedProperties: this.documentedProperties,
			filterText: this.filterText,
			showHiddenCsvs: this.showHiddenCsvs,
			selectedImportId: this.selectedImportId,
			selectedExportId: this.selectedExportId,
			selectedDictProp: this.selectedDictProp,
			selectedReportPath: this.selectedReportPath,
			selectedPipelineId: this.selectedPipelineId,
			selectedTypeName: this.selectedTypeName,
			editingImportId: this.editingImportId,
			editingExportId: this.editingExportId,
			editingPipelineId: this.editingPipelineId,
		};
	}

	private setHubState(partial: Partial<HubState>): void {
		if (partial.currentPage !== undefined) this.currentPage = partial.currentPage;
		if (partial.filterText !== undefined) this.filterText = partial.filterText;
		if (partial.showHiddenCsvs !== undefined) this.showHiddenCsvs = partial.showHiddenCsvs;
		if (partial.selectedImportId !== undefined) this.selectedImportId = partial.selectedImportId;
		if (partial.selectedExportId !== undefined) this.selectedExportId = partial.selectedExportId;
		if (partial.selectedDictProp !== undefined) this.selectedDictProp = partial.selectedDictProp;
		if (partial.selectedReportPath !== undefined) this.selectedReportPath = partial.selectedReportPath;
		if (partial.selectedPipelineId !== undefined) this.selectedPipelineId = partial.selectedPipelineId;
		if (partial.selectedTypeName !== undefined) this.selectedTypeName = partial.selectedTypeName;
		if (partial.editingImportId !== undefined) this.editingImportId = partial.editingImportId;
		if (partial.editingExportId !== undefined) this.editingExportId = partial.editingExportId;
		if (partial.editingPipelineId !== undefined) this.editingPipelineId = partial.editingPipelineId;
	}

	// ══════════════════════════════════════════════════════════
	// Data refresh & scanning
	// ══════════════════════════════════════════════════════════

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

	private scanPropertyDocs(): void {
		this.documentedProperties.clear();
		for (const entry of this.dictionaryEntries) {
			const docPath = this.dataExchangeService.getPropertyDocPath(entry.propertyName);
			if (this.app.vault.getAbstractFileByPath(docPath)) {
				this.documentedProperties.add(entry.propertyName);
			}
		}
	}

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

	private scanCsvDocs(): void {
		this.reportEntries = [];
		const folder = this.dataExchangeService.getReportsFolderPath();
		const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
		if (!abstractFolder) return;

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

	private scanCsvFiles(): void {
		this.csvFileEntries = [];
		const allFiles = this.app.vault.getFiles();
		const baseFiles = allFiles.filter((f) => f.path.endsWith(".base"));

		for (const file of allFiles) {
			if (!file.path.toLowerCase().endsWith(".csv")) continue;

			const importConfigs = this.dataExchangeService.getImportConfigsForFile(file.path);
			const exportConfigs = this.dataExchangeService.getExportConfigsForOutput(file.path);
			const docPath = this.dataExchangeService.getCsvDocPath(file.path);
			const hasDoc = !!this.app.vault.getAbstractFileByPath(docPath);

			const bases: Array<{ path: string; name: string }> = [];
			const seenBases = new Set<string>();
			for (const cfg of importConfigs) {
				if (cfg.basePath) {
					let bp = cfg.basePath.trim();
					if (bp && !bp.endsWith(".base")) bp += ".base";
					if (bp && !seenBases.has(bp) && this.app.vault.getAbstractFileByPath(bp)) {
						bases.push({ path: bp, name: bp.split("/").pop()?.replace(/\.base$/, "") ?? bp });
						seenBases.add(bp);
					}
				}
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

	// ══════════════════════════════════════════════════════════
	// Render scheduling
	// ══════════════════════════════════════════════════════════

	private scheduleRender(): void {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.refreshConfigs();
			switch (this.currentPage) {
				case "dashboard":
					this.dashboard.render();
					break;
				case "imports":
					this.importsTab.renderMaster();
					this.importsTab.renderDetail();
					break;
				case "exports":
					this.exportsTab.renderMaster();
					this.exportsTab.renderDetail();
					break;
				case "reports":
					this.reportsTab.renderMaster();
					this.reportsTab.renderDetail();
					break;
				case "properties":
					this.propertiesTab.renderMaster();
					this.propertiesTab.renderDetail();
					break;
				case "pipelines":
					this.pipelinesTab.renderMaster();
					this.pipelinesTab.renderDetail();
					break;
				case "types":
					this.typesTab.renderMaster();
					this.typesTab.renderDetail();
					break;
			}
		}, 16);
	}

	// ══════════════════════════════════════════════════════════
	// Navigation
	// ══════════════════════════════════════════════════════════

	private navigateTo(page: HubPage): void {
		this.currentPage = page;
		const isDashboard = page === "dashboard";

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

	// ── Top bar ─────────────────────────────────────────────

	private renderTopBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2 ft-hidden" });
		bar.style.borderBottom = "1px solid var(--background-modifier-border)";
		bar.addClass("ft-flex-shrink-0");
		this.topBarEl = bar;

		this.topBarTitleEl = bar.createSpan({
			text: "Data Exchange Hub",
			cls: "ft-heading ft-heading-sm",
		});
		this.topBarTitleEl.addClass("ft-cursor-pointer");
		this.topBarTitleEl.addEventListener("click", () => this.navigateTo("dashboard"));
	}

}
