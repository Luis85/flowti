/**
 * Handler registration for the Export leaf view.
 *
 * Bridges DataExchangeService → existing ExportView page components.
 * The handler acts as orchestrator, managing state and delegating rendering
 * to ViewSelectPage, ConfigurePage, PreviewPage, and ResultPage.
 */

import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import type { IEventBus } from "../../events/types";
import type { DataExchangeService } from "../../../domain/dataExchange/DataExchangeService";
import type { ExportService } from "../../../domain/dataExchange/ExportService";
import type {
	ExportResult,
	ParsedBaseFile,
	ResolvedColumn,
	SavedExportConfig,
	VaultFileInfo,
} from "../../../domain/dataExchange/types";
import type { ExportPage, ExportViewState, ExportComponentDeps } from "../../../ui/export/types";
import {
	ViewSelectPage,
	ConfigurePage,
	PreviewPage,
	ResultPage,
	STEP_LABELS,
	getFilenameFromPath,
	getOutputFilename,
	buildOutputPath,
} from "../../../ui/export/index";
import { renderStepBar, renderConfigDropdown } from "../../../ui/hub/helpers";
import { setIcon } from "obsidian";

export interface ExportHandlerDeps {
	dataExchangeService: DataExchangeService;
	eventBus: IEventBus;
	app: unknown; // Obsidian App
	getConfig: () => ExportViewConfig | null;
}

export interface ExportViewConfig {
	sourcePath: string;
	sourceType: "folder" | "base";
	format: "csv" | "tab";
}

export function registerExportHandler(
	registry: PluginHandlerRegistry,
	deps: ExportHandlerDeps,
): void {
	registry.registerTabHandler("leaf:export", (container: HTMLElement, _ctx: TabContext) => {
		container.innerHTML = "";

		const config = deps.getConfig();
		if (!config) {
			const msg = document.createElement("div");
			msg.className = "ft-text-muted ft-p-3";
			msg.textContent = "No export configuration provided.";
			container.appendChild(msg);
			return;
		}

		const exportService = deps.dataExchangeService.getExportService();
		const savedConfigs = deps.dataExchangeService.getSavedExportConfigs();

		// ── Mutable state ──────────────────────────────────
		const state: ExportViewState = {
			sourcePath: config.sourcePath,
			sourceType: config.sourceType,
			format: config.format,
			currentPage: config.sourceType === "base" ? "view-select" : "configure",
			outputPath: buildDefaultOutputPath(config.sourcePath, config.format),
			isExternal: false,
			availableColumns: [],
			selectedColumns: [],
			selectedFileProperties: ["file.name"],
			baseViewIndex: 0,
			baseFile: null,
			previewFiles: [],
			conflictStrategy: "overwrite",
			displayNames: {},
			resolvedColumns: null,
			noteType: "",
			exportResult: null,
			exportError: null,
			loadError: null,
			savedConfigs,
			loadedConfigId: null,
			propertySearchText: "",
		};

		// ── DOM skeleton ───────────────────────────────────
		const rootEl = document.createElement("div");
		rootEl.className = "flowti-container ft-view-root-flex";

		const topBarEl = document.createElement("div");
		topBarEl.className = "ft-view-top-bar";
		rootEl.appendChild(topBarEl);

		const workspaceEl = document.createElement("div");
		workspaceEl.className = "ft-view-workspace";
		rootEl.appendChild(workspaceEl);

		container.appendChild(rootEl);

		// ── Unsaved hint reference ─────────────────────────
		let unsavedHintEl: HTMLElement | null = null;

		// ── Deps for page components ──────────────────────
		const componentDeps: ExportComponentDeps = {
			app: deps.app as ExportComponentDeps["app"],
			eventBus: deps.eventBus,
			exportService,
			getState: () => ({ ...state }),
			setState: (partial: Partial<ExportViewState>) => {
				applyPartialState(state, partial);
			},
			renderPage,
			openFolderPicker: () => {
				// Folder picker requires Obsidian App — not wired in handler context
			},
			openNativeSaveDialog: async () => {
				// Native dialog requires Electron — not wired in handler context
			},
			detachLeaf: () => {
				// In handler context, clear the container
				container.innerHTML = "";
			},
			runExport: () => void runExport(),
			updateUnsavedHint,
			hasUnsavedChanges,
			getUnsavedHintEl: () => unsavedHintEl,
			setUnsavedHintEl: (el: HTMLElement) => { unsavedHintEl = el; },
		};

		// ── Page components ───────────────────────────────
		const viewSelectPage = new ViewSelectPage(workspaceEl, componentDeps);
		const configurePage = new ConfigurePage(workspaceEl, componentDeps);
		const previewPage = new PreviewPage(workspaceEl, componentDeps);
		const resultPage = new ResultPage(workspaceEl, componentDeps);

		// ── Rendering ─────────────────────────────────────

		function renderPage(): void {
			renderTopBar();

			if (state.loadError && state.currentPage !== "result") {
				renderError();
				return;
			}

			switch (state.currentPage) {
				case "view-select":
					viewSelectPage.render();
					break;
				case "configure":
					configurePage.render();
					break;
				case "preview":
					previewPage.render();
					break;
				case "result":
					resultPage.render();
					break;
			}
		}

		function renderTopBar(): void {
			topBarEl.innerHTML = "";

			// Row 1: File header
			const headerRow = topBarEl.createDiv({ cls: "ft-csv-header ft-header-mb-0" });
			const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
			setIcon(iconEl, "file-output");
			const titleCol = headerRow.createDiv();
			const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

			const parts = state.sourcePath.replace(/\\/g, "/").split("/");
			const name = parts[parts.length - 1] || state.sourcePath;
			titleRow.createEl("h2", {
				text: name,
				cls: "ft-heading ft-csv-title",
			});

			titleRow.createSpan({
				text: "Export",
				cls: "ft-operation-badge ft-operation-badge-export",
			});

			if (state.loadedConfigId) {
				const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
				if (cfg) {
					titleRow.createSpan({
						text: `Config: ${cfg.name}`,
						cls: "ft-badge ft-badge-accent",
					});
				}
			} else {
				titleRow.createSpan({
					text: "No config loaded",
					cls: "ft-badge ft-badge-muted",
				});
			}

			const subtitle = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			subtitle.createSpan({ text: state.sourcePath, cls: "ft-text-sm ft-text-muted" });
			subtitle.createSpan({
				text: `${state.previewFiles.length} files`,
				cls: "ft-badge ft-badge-muted",
			});
			subtitle.createSpan({
				text: `${state.availableColumns.length} cols`,
				cls: "ft-badge ft-badge-muted",
			});

			// Row 2: Stepper + config dropdown
			const stepRow = topBarEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

			const steps: ExportPage[] = state.sourceType === "base"
				? ["view-select", "configure", "preview", "result"]
				: ["configure", "preview", "result"];

			renderStepBar(stepRow, {
				steps,
				currentPage: state.currentPage,
				labels: STEP_LABELS,
				hasResult: !!state.exportResult,
				hasError: !!state.exportError,
				onNavigate: (page) => {
					state.currentPage = page;
					renderPage();
				},
			});

			stepRow.createDiv({ cls: "ft-flex-1" });

			const fileConfigs = state.savedConfigs.filter(
				(c) => c.sourcePath === state.sourcePath,
			);
			renderConfigDropdown(stepRow, {
				onSave: () => {
					// Save config requires Obsidian modals — not wired in handler context
				},
				configs: fileConfigs,
				onLoad: (id) => {
					applySavedExportConfig(id);
				},
			});
		}

		function renderError(): void {
			workspaceEl.innerHTML = "";
			const errorContainer = workspaceEl.createDiv({ cls: "ft-table-scroll" });
			errorContainer.createEl("h3", { text: "Export", cls: "ft-heading ft-heading-sm" });
			const alert = errorContainer.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
			alert.createEl("strong", { text: "Error: " });
			alert.createSpan({ text: state.loadError! });

			const nav = errorContainer.createDiv({ cls: "ft-detail-actions ft-mt-4" });
			const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => {
				container.innerHTML = "";
			});
		}

		// ── Export execution ──────────────────────────────

		async function runExport(): Promise<void> {
			try {
				state.exportResult = await exportService.executeExport({
					sourcePath: state.sourcePath,
					sourceType: state.sourceType,
					format: state.format,
					outputPath: state.outputPath,
					columns: state.selectedColumns,
					fileProperties: [...state.selectedFileProperties],
					baseViewIndex: state.baseViewIndex,
					displayNames: Object.keys(state.displayNames).length > 0
						? state.displayNames
						: undefined,
					isExternal: state.isExternal || undefined,
					conflictStrategy: state.conflictStrategy,
					resolvedColumns: state.resolvedColumns ?? undefined,
				});
			} catch (error) {
				state.exportError =
					error instanceof Error ? error.message : String(error);
			}
			renderPage();
		}

		// ── Config load ──────────────────────────────────

		function applySavedExportConfig(id: string): void {
			const cfg = state.savedConfigs.find((c) => c.id === id);
			if (!cfg) return;
			state.format = cfg.format;
			state.outputPath = cfg.outputPath;
			state.selectedColumns = [...cfg.columns];
			state.selectedFileProperties = [...cfg.fileProperties];
			state.conflictStrategy = cfg.conflictStrategy ?? "overwrite";
			if (cfg.baseViewIndex !== undefined) {
				state.baseViewIndex = cfg.baseViewIndex;
			}
			if (cfg.isExternal !== undefined) {
				state.isExternal = cfg.isExternal;
			}
			state.noteType = cfg.noteType ?? "";
			state.loadedConfigId = id;
			void deps.eventBus.emit("notice.show" as never, { message: `Loaded config: ${cfg.name}` } as never);
			renderPage();
		}

		// ── Unsaved changes tracking ─────────────────────

		function hasUnsavedChanges(): boolean {
			if (!state.loadedConfigId) return false;
			const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
			if (!cfg) return false;
			if (state.format !== cfg.format) return true;
			if (state.outputPath !== cfg.outputPath) return true;
			if (JSON.stringify(state.selectedColumns) !== JSON.stringify(cfg.columns)) return true;
			if (JSON.stringify(state.selectedFileProperties) !== JSON.stringify(cfg.fileProperties)) return true;
			if (state.conflictStrategy !== (cfg.conflictStrategy ?? "overwrite")) return true;
			if (cfg.baseViewIndex !== undefined && state.baseViewIndex !== cfg.baseViewIndex) return true;
			if (cfg.isExternal !== undefined && state.isExternal !== cfg.isExternal) return true;
			if ((state.noteType || "") !== (cfg.noteType ?? "")) return true;
			return false;
		}

		function updateUnsavedHint(): void {
			if (!unsavedHintEl) return;
			unsavedHintEl.classList.toggle("ft-hidden", !hasUnsavedChanges());
		}

		// ── Initial render (top bar immediately) ─────────

		renderPage();

		// ── Async data load → re-render ──────────────────

		void loadInitialData(exportService, state, config).then(() => {
			renderPage();
		});
	});
}

// ── Helpers ──────────────────────────────────────────────

function buildDefaultOutputPath(sourcePath: string, format: "csv" | "tab"): string {
	const baseName = sourcePath.replace(/\.\w+$/, "");
	const ext = format === "tab" ? ".txt" : ".csv";
	return `${baseName}_export${ext}`;
}

function applyPartialState(state: ExportViewState, partial: Partial<ExportViewState>): void {
	for (const key of Object.keys(partial) as (keyof ExportViewState)[]) {
		if (partial[key] !== undefined) {
			// Use indexed assignment to avoid verbose per-field branching
			(state as unknown as Record<string, unknown>)[key] = partial[key];
		}
	}
}

async function loadInitialData(
	exportService: ExportService,
	state: ExportViewState,
	config: ExportViewConfig,
): Promise<void> {
	try {
		if (config.sourceType === "base") {
			state.baseFile = await exportService.parseBaseViews(config.sourcePath);
		}
		await loadColumnsAndPreview(exportService, state);
	} catch (error) {
		state.loadError = error instanceof Error ? error.message : String(error);
	}
}

async function loadColumnsAndPreview(
	exportService: ExportService,
	state: ExportViewState,
): Promise<void> {
	state.previewFiles = await exportService.resolveExportFiles(
		state.sourcePath,
		state.sourceType,
		state.baseViewIndex,
	);

	if (state.sourceType === "base") {
		state.resolvedColumns = await exportService.scanResolvedColumns(
			state.sourcePath,
			state.baseViewIndex,
		);

		if (state.resolvedColumns) {
			state.availableColumns = state.resolvedColumns
				.filter((rc) => rc.source !== "file")
				.map((rc) => rc.resolveKey);
			state.selectedColumns = [...state.availableColumns];
			state.selectedFileProperties = state.resolvedColumns
				.filter((rc) => rc.source === "file" || (rc.source === "formula" && rc.resolveSource === "file"))
				.map((rc) => rc.resolveKey);
			state.displayNames = {};
			for (const rc of state.resolvedColumns) {
				if (rc.header !== rc.resolveKey) {
					state.displayNames[rc.key] = rc.header;
				}
			}
			return;
		}

		state.availableColumns = await exportService.scanColumns(
			state.sourcePath,
			state.sourceType,
			state.baseViewIndex,
		);
		state.selectedColumns = [...state.availableColumns];
		state.selectedFileProperties = await exportService.scanViewFileProperties(
			state.sourcePath,
			state.baseViewIndex,
		);
		state.displayNames = await exportService.scanDisplayNames(state.sourcePath);
		return;
	}

	// Folder source
	state.resolvedColumns = null;
	state.availableColumns = await exportService.scanColumns(
		state.sourcePath,
		state.sourceType,
	);
	state.selectedColumns = [...state.availableColumns];
}
