/**
 * Data Exchange Hub — central management view for import/export operations.
 *
 * This is the orchestrator: it owns state, scanning logic, and tab rendering.
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type {
	ExportFormat,
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
	TypeDocEntry,
} from "../domain/dataExchange/types";
import type { FrontmatterIssue, HubPage, HubState, HubComponentDeps, HubNavigationCallbacks, CsvFileEntry, ReportEntry } from "./hub/types";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { HubDashboard } from "./hub/HubDashboard";
import { ImportsTab } from "./hub/ImportsTab";
import { ExportsTab } from "./hub/ExportsTab";
import { ReportsTab } from "./hub/ReportsTab";
import { PropertiesTab } from "./hub/PropertiesTab";
import { PipelinesTab } from "./hub/PipelinesTab";
import { TypesTab } from "./hub/TypesTab";
import { SignalsTab } from "./hub/SignalsTab";
import { openEventInCatalog } from "./hub/helpers";
import type { SignalService } from "../domain/signal/SignalService";
import { basename, stripExtension } from "../utils/pathUtils";
import { VIEW_TYPE_DATA_EXCHANGE_HUB } from "../domain/hub/types";
export { VIEW_TYPE_DATA_EXCHANGE_HUB };

export type DXTab = "imports" | "exports" | "reports" | "properties" | "pipelines" | "types" | "signals";

export class DataExchangeHubView extends BaseHubView<DXTab> {
	private dataExchangeService: DataExchangeService;
	private signalService?: SignalService;
	private openCsvImportCb: (csvPath: string, savedConfig?: SavedImportConfig) => void;
	private openExportCb: (savedConfig: SavedExportConfig) => void;
	private openNewExportCb: (sourcePath: string, sourceType: "folder" | "base", format: ExportFormat) => void;

	// ── State ────────────────────────────────────────────────
	private importConfigs: SavedImportConfig[] = [];
	private exportConfigs: SavedExportConfig[] = [];
	private pipelineConfigs: SavedMultiImportPipeline[] = [];
	private dictionaryEntries: import("../domain/dataExchange/types").DataDictionaryEntry[] = [];
	private reportEntries: ReportEntry[] = [];
	private typeEntries: TypeDocEntry[] = [];
	private csvFileEntries: CsvFileEntry[] = [];
	private documentedProperties = new Set<string>();
	private frontmatterIssues: FrontmatterIssue[] = [];
	private showHiddenCsvs = false;

	private selectedImportId: string | null = null;
	private selectedExportId: string | null = null;
	private selectedDictProp: string | null = null;
	private selectedReportPath: string | null = null;
	private selectedCsvFilePath: string | null = null;
	private selectedPipelineId: string | null = null;
	private selectedTypeName: string | null = null;
	private selectedSignalId: string | null = null;
	private editingImportId: string | null = null;
	private editingExportId: string | null = null;
	private editingPipelineId: string | null = null;
	private activeOperations: import("./hub/types").ActiveOperation[] = [];

	// ── Tab components ───────────────────────────────────────
	private dashboard!: HubDashboard;
	private importsTab!: ImportsTab;
	private exportsTab!: ExportsTab;
	private reportsTab!: ReportsTab;
	private propertiesTab!: PropertiesTab;
	private pipelinesTab!: PipelinesTab;
	private typesTab!: TypesTab;
	private signalsTab!: SignalsTab;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		openCsvImport: (csvPath: string, savedConfig?: SavedImportConfig) => void,
		openExport: (savedConfig: SavedExportConfig) => void,
		openNewExport: (sourcePath: string, sourceType: "folder" | "base", format: ExportFormat) => void,
		signalService?: SignalService,
	) {
		super(leaf, eventBus);
		this.dataExchangeService = dataExchangeService;
		this.signalService = signalService;
		this.openCsvImportCb = openCsvImport;
		this.openExportCb = openExport;
		this.openNewExportCb = openNewExport;
	}

	// ── BaseHubView abstract implementations ─────────────────

	getViewType(): string { return VIEW_TYPE_DATA_EXCHANGE_HUB; }
	getHubId(): string { return "data-exchange"; }
	getHubType(): "system" | "domain" | "user" { return "system"; }
	getHubDisplayName(): string { return "Data Exchange Hub"; }
	getHubIcon(): string { return "arrow-left-right"; }

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "imports", label: "Imports", icon: "file-input", searchPlaceholder: "Search import configs..." },
			{ id: "exports", label: "Exports", icon: "file-output", searchPlaceholder: "Search export configs..." },
			{ id: "reports", label: "Reports", icon: "file-text", searchPlaceholder: "Search reports..." },
			{ id: "properties", label: "Properties", icon: "list", searchPlaceholder: "Search properties..." },
			{ id: "pipelines", label: "Pipelines", icon: "workflow", searchPlaceholder: "Search pipelines..." },
			{ id: "types", label: "Types", icon: "tag", searchPlaceholder: "Search types..." },
			{ id: "signals", label: "Signals", icon: "radio", searchPlaceholder: "Search signals..." },
		];
	}

	renderTopBarActions(_bar: HTMLElement): void {
		// No extra top bar buttons for Data Exchange Hub
	}

	onHubOpen(): void {
		this.refreshConfigs();

		const deps = this.buildDeps();
		this.dashboard = new HubDashboard(this.dashboardEl, deps);
		this.importsTab = new ImportsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.exportsTab = new ExportsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.reportsTab = new ReportsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.propertiesTab = new PropertiesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.pipelinesTab = new PipelinesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.typesTab = new TypesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.signalsTab = new SignalsTab(this.masterTreeEl, this.detailPanelEl, deps);

		this.addUnsubscribe(
			this.eventBus.on("dataExchange.config.changed", () => {
				this.refreshConfigs();
				this.scheduleRender();
			}),
		);
		// Track active operations for state-backed progress (survives re-render)
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.import.started", (event) => {
				const { operationId, config, pipelineId } = event.payload;
				if (pipelineId) return; // Pipeline-triggered imports tracked at pipeline level
				this.activeOperations = [...this.activeOperations, {
					operationId,
					type: "import",
					name: config.sourcePath.split("/").pop() ?? "Import",
					sourcePath: config.sourcePath,
					startedAt: Date.now(),
					progress: null,
				}];
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.import.progress", (event) => {
				const { operationId, current, total, lastFilename, pipelineId } = event.payload;
				if (pipelineId) return;
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === operationId
						? { ...op, progress: { current, total, lastFilename } }
						: op,
				);
				// No scheduleRender — live listeners handle DOM updates
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.import.completed", (event) => {
				const { operationId, result, pipelineId } = event.payload;
				if (pipelineId) return; // Pipeline-level tracking handles this
				const msg = `${result.created} created, ${result.updated} updated, ${result.skipped} skipped` +
					(result.failed > 0 ? `, ${result.failed} failed` : "");
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === operationId
						? { ...op, completed: true, success: true, message: msg }
						: op,
				);
				this.scheduleRender();
				setTimeout(() => {
					this.activeOperations = this.activeOperations.filter((op) => op.operationId !== operationId);
					this.scheduleRender();
				}, 5000);
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.import.failed", (event) => {
				const { operationId, error, pipelineId } = event.payload;
				if (pipelineId) return; // Pipeline-level tracking handles this
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === operationId
						? { ...op, completed: true, success: false, message: `Failed: ${error}` }
						: op,
				);
				this.scheduleRender();
				setTimeout(() => {
					this.activeOperations = this.activeOperations.filter((op) => op.operationId !== operationId);
					this.scheduleRender();
				}, 5000);
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.export.started", (event) => {
				if (event.payload.pipelineId) return; // Pipeline-triggered exports tracked at pipeline level
				this.activeOperations = [...this.activeOperations, {
					operationId: event.payload.operationId,
					type: "export",
					name: event.payload.config.outputPath.split("/").pop() ?? "Export",
					sourcePath: event.payload.config.outputPath,
					startedAt: Date.now(),
					progress: null,
				}];
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.export.completed", (event) => {
				if (event.payload.pipelineId) return;
				const { operationId, result } = event.payload;
				const msg = `${result.totalRows} rows, ${result.totalColumns} columns → ${result.outputPath}`;
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === operationId
						? { ...op, completed: true, success: true, message: msg }
						: op,
				);
				this.scheduleRender();
				setTimeout(() => {
					this.activeOperations = this.activeOperations.filter((op) => op.operationId !== operationId);
					this.scheduleRender();
				}, 5000);
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.export.failed", (event) => {
				if (event.payload.pipelineId) return;
				const { operationId, error } = event.payload;
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === operationId
						? { ...op, completed: true, success: false, message: `Failed: ${error}` }
						: op,
				);
				this.scheduleRender();
				setTimeout(() => {
					this.activeOperations = this.activeOperations.filter((op) => op.operationId !== operationId);
					this.scheduleRender();
				}, 5000);
			}),
		);
		// Track pipeline operations
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.pipeline.started", (event) => {
				const { pipeline, totalSources } = event.payload;
				this.activeOperations = [...this.activeOperations, {
					operationId: pipeline.id,
					type: "pipeline",
					name: pipeline.name,
					startedAt: Date.now(),
					progress: { current: 0, total: totalSources },
				}];
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.pipeline.sourceCompleted", (event) => {
				const { pipelineId, sourceIndex, totalSources } = event.payload;
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === pipelineId
						? { ...op, progress: { current: sourceIndex + 1, total: totalSources } }
						: op,
				);
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.pipeline.completed", (event) => {
				const r = event.payload.result;
				const msg = `${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
					(r.failed > 0 ? `, ${r.failed} failed` : "");
				// Find the pipeline operation (uses pipeline.id as operationId)
				this.activeOperations = this.activeOperations.map((op) =>
					op.type === "pipeline" && !op.completed
						? { ...op, completed: true, success: true, message: msg }
						: op,
				);
				this.scheduleRender();
				setTimeout(() => {
					this.activeOperations = this.activeOperations.filter((op) => !(op.type === "pipeline" && op.completed));
					this.scheduleRender();
				}, 5000);
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("dataExchange.pipeline.failed", (event) => {
				const { pipelineId, error } = event.payload;
				this.activeOperations = this.activeOperations.map((op) =>
					op.operationId === pipelineId
						? { ...op, completed: true, success: false, message: `Failed: ${error}` }
						: op,
				);
				this.scheduleRender();
				setTimeout(() => {
					this.activeOperations = this.activeOperations.filter((op) => op.operationId !== pipelineId);
					this.scheduleRender();
				}, 5000);
			}),
		);

		const propsFolder = this.dataExchangeService.getPropertiesFolderPath() + "/";
		this.addUnsubscribe(
			this.eventBus.on("file.created", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					this.scanPropertyDocs();
					this.scheduleRender();
				}
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("file.deleted", (event) => {
				if (event.payload.path.startsWith(propsFolder)) {
					this.scanPropertyDocs();
					this.scheduleRender();
				}
			}),
		);
		// Re-render signals tab when signal configs change
		this.addUnsubscribe(
			this.eventBus.on("signal.configured", () => this.scheduleRender()),
		);
		this.addUnsubscribe(
			this.eventBus.on("signal.removed", () => this.scheduleRender()),
		);
	}

	onHubClose(): void {
		this.dashboard.cleanupLiveListeners();
		this.importsTab.cleanupLiveListeners();
		this.pipelinesTab.cleanupLiveListeners();
	}

	protected onTabChanged(): void {
		// Reset editing states when navigating between tabs
		this.editingImportId = null;
		this.editingExportId = null;
		this.editingPipelineId = null;
		// Clear filter
		this.filterText = "";
		this.searchInput.value = "";
		// Cleanup live listeners from previous tab/dashboard
		this.dashboard.cleanupLiveListeners();
		this.importsTab.cleanupLiveListeners();
		this.pipelinesTab.cleanupLiveListeners();
	}

	onDashboardRender(): void {
		this.refreshConfigs();
		this.dashboard.render();
	}

	onTabRender(tabId: DXTab): void {
		this.refreshConfigs();
		switch (tabId) {
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
			case "signals":
				this.signalsTab.renderMaster();
				this.signalsTab.renderDetail();
				break;
		}
	}

	// ══════════════════════════════════════════════════════════
	// Public API
	// ══════════════════════════════════════════════════════════

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
			navigateTo: (page) => this.navigateTo(page as DXTab | "dashboard"),
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
				// Fire-and-forget — Active Operations tracks progress on dashboard + detail
				void this.eventBus.emit("dataExchange.pipeline.execute", { pipelineId: pipe.id });
			},
		};

		return {
			app: this.app,
			eventBus: this.eventBus,
			dataExchangeService: this.dataExchangeService,
			signalService: this.signalService,
			getState: () => this.getHubState(),
			setState: (partial) => this.setHubState(partial),
			navigation,
			scheduleRender: () => this.scheduleRender(),
		};
	}

	private getHubState(): HubState {
		return {
			currentPage: this.activePage as HubPage,
			importConfigs: this.importConfigs,
			exportConfigs: this.exportConfigs,
			pipelineConfigs: this.pipelineConfigs,
			dictionaryEntries: this.dictionaryEntries,
			reportEntries: this.reportEntries,
			typeEntries: this.typeEntries,
			csvFileEntries: this.csvFileEntries,
			documentedProperties: this.documentedProperties,
			frontmatterIssues: this.frontmatterIssues,
			filterText: this.filterText,
			showHiddenCsvs: this.showHiddenCsvs,
			selectedImportId: this.selectedImportId,
			selectedExportId: this.selectedExportId,
			selectedDictProp: this.selectedDictProp,
			selectedReportPath: this.selectedReportPath,
			selectedCsvFilePath: this.selectedCsvFilePath,
			selectedPipelineId: this.selectedPipelineId,
			selectedTypeName: this.selectedTypeName,
			selectedSignalId: this.selectedSignalId,
			editingImportId: this.editingImportId,
			editingExportId: this.editingExportId,
			editingPipelineId: this.editingPipelineId,
			activeOperations: this.activeOperations,
		};
	}

	private setHubState(partial: Partial<HubState>): void {
		if (partial.currentPage !== undefined) this.activePage = partial.currentPage as DXTab | "dashboard";
		if (partial.filterText !== undefined) this.filterText = partial.filterText;
		if (partial.showHiddenCsvs !== undefined) this.showHiddenCsvs = partial.showHiddenCsvs;
		if (partial.selectedImportId !== undefined) this.selectedImportId = partial.selectedImportId;
		if (partial.selectedExportId !== undefined) this.selectedExportId = partial.selectedExportId;
		if (partial.selectedDictProp !== undefined) this.selectedDictProp = partial.selectedDictProp;
		if (partial.selectedReportPath !== undefined) this.selectedReportPath = partial.selectedReportPath;
		if (partial.selectedCsvFilePath !== undefined) this.selectedCsvFilePath = partial.selectedCsvFilePath;
		if (partial.selectedPipelineId !== undefined) this.selectedPipelineId = partial.selectedPipelineId;
		if (partial.selectedTypeName !== undefined) this.selectedTypeName = partial.selectedTypeName;
		if (partial.selectedSignalId !== undefined) this.selectedSignalId = partial.selectedSignalId;
		if (partial.editingImportId !== undefined) this.editingImportId = partial.editingImportId;
		if (partial.editingExportId !== undefined) this.editingExportId = partial.editingExportId;
		if (partial.editingPipelineId !== undefined) this.editingPipelineId = partial.editingPipelineId;
		if (partial.activeOperations !== undefined) this.activeOperations = partial.activeOperations;
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
		const typeDocIssues: FrontmatterIssue[] = [];
		const folder = this.dataExchangeService.getTypesFolderPath();
		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			if (!file.path.startsWith(folder)) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm) {
				typeDocIssues.push({
					filePath: file.path,
					fileName: file.basename,
					issues: ["No frontmatter found — file may be empty or malformed"],
				});
				continue;
			}
			if (fm.type !== "TypeDoc") {
				typeDocIssues.push({
					filePath: file.path,
					fileName: file.basename,
					issues: [`Expected type "TypeDoc" but found "${String(fm.type ?? "missing")}"`],
				});
				continue;
			}
			const name = String(fm.name ?? file.basename.replace(/^Type - /, ""));
			const description = String(fm.description ?? "");
			const rawProps = fm.properties;
			const properties: string[] = Array.isArray(rawProps) ? rawProps.map(String) : [];
			const pipelineCount = this.pipelineConfigs.filter((p) => p.noteType === name).length
				+ this.importConfigs.filter((c) => c.noteType === name).length
				+ this.exportConfigs.filter((c) => c.noteType === name).length;
			this.typeEntries.push({ name, description, properties, filePath: file.path, pipelineCount });
		}
		this.typeEntries.sort((a, b) => a.name.localeCompare(b.name));
		// Merge type doc issues into the shared list
		this.frontmatterIssues = [...this.frontmatterIssues, ...typeDocIssues];
	}

	private scanCsvDocs(): void {
		this.reportEntries = [];
		const csvDocIssues: FrontmatterIssue[] = [];
		const folder = this.dataExchangeService.getReportsFolderPath();
		const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
		if (!abstractFolder) return;

		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			if (!file.path.startsWith(folder + "/")) continue;
			if (!file.basename.startsWith("CSV - ")) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm) {
				csvDocIssues.push({
					filePath: file.path,
					fileName: file.basename,
					issues: ["No frontmatter found — file may be empty or malformed"],
				});
				continue;
			}
			if (fm.type !== "CsvDoc") {
				csvDocIssues.push({
					filePath: file.path,
					fileName: file.basename,
					issues: [`Expected type "CsvDoc" but found "${String(fm.type ?? "missing")}"`],
				});
				continue;
			}
			// Validate individual fields
			const issues: string[] = [];
			if (!fm.csvFile && !fm.filePath) {
				issues.push("Missing csvFile and filePath — cannot link to source CSV");
			}
			if (!fm.headers) {
				issues.push("Missing headers — column schema not recorded");
			} else if (!Array.isArray(fm.headers)) {
				issues.push(`headers should be an array but found ${typeof fm.headers}`);
			}
			this.reportEntries.push({
				name: fm.name ? String(fm.name) : file.basename.replace("CSV - ", ""),
				path: file.path,
				frontmatter: fm,
				frontmatterIssues: issues,
			});
		}
		this.reportEntries.sort((a, b) => a.name.localeCompare(b.name));
		this.frontmatterIssues = csvDocIssues;
	}

	private scanCsvFiles(): void {
		this.csvFileEntries = [];
		const allFiles = this.app.vault.getFiles();
		const baseFiles = allFiles.filter((f) => f.path.endsWith(".base"));

		for (const file of allFiles) {
			if (!file.path.toLowerCase().endsWith(".csv")) continue;

			const importConfigs = this.dataExchangeService.getImportConfigsForFile(file.path);
			const exportConfigs = this.dataExchangeService.getExportConfigsForOutput(file.path);
			const docPath = this.dataExchangeService.resolveCsvDocPath(file.path, (p) => !!this.app.vault.getAbstractFileByPath(p));
			const hasDoc = !!this.app.vault.getAbstractFileByPath(docPath);

			const bases: Array<{ path: string; name: string }> = [];
			const seenBases = new Set<string>();
			for (const cfg of importConfigs) {
				if (cfg.basePath) {
					let bp = cfg.basePath.trim();
					if (bp && !bp.endsWith(".base")) bp += ".base";
					if (bp && !seenBases.has(bp) && this.app.vault.getAbstractFileByPath(bp)) {
						bases.push({ path: bp, name: stripExtension(basename(bp), ".base") || bp });
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
				displayName: file.name, // placeholder, disambiguated below
				importConfigs,
				exportConfigs,
				hasDoc,
				baseViews: bases,
			});
		}

		// Disambiguate display names for CSV files with the same name
		const nameCount = new Map<string, number>();
		for (const entry of this.csvFileEntries) {
			nameCount.set(entry.name, (nameCount.get(entry.name) ?? 0) + 1);
		}
		for (const entry of this.csvFileEntries) {
			if ((nameCount.get(entry.name) ?? 0) > 1) {
				const lastSlash = entry.path.lastIndexOf("/");
				const parentFolder = lastSlash > 0
					? entry.path.substring(0, lastSlash).split("/").pop() ?? ""
					: "";
				entry.displayName = parentFolder
					? `${entry.name} (${parentFolder})`
					: entry.name;
			}
		}

		this.csvFileEntries.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}
}
