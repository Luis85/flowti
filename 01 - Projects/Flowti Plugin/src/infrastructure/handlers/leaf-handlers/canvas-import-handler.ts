/**
 * Sitemap-driven handler for the Canvas Import wizard.
 *
 * Orchestrates the same 4-step flow (landing → config → preview → result)
 * as the legacy CanvasActionView, but as a plain handler function
 * that can be registered in the PluginHandlerRegistry.
 *
 * Reuses the existing page components:
 *   CanvasLanding, CanvasConfigPage, CanvasPreviewPage, CanvasResultPage
 */

import type { App, TFile } from "obsidian";
import { setIcon } from "obsidian";
import type { IEventBus } from "../../events/types";
import type { CanvasService, CanvasConfigInput } from "../../../domain/canvas/CanvasService";
import { DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP } from "../../../domain/canvas/types";
import {
	parseCanvasJson,
	extractLegend,
	buildCanvasItems,
	resolveParentage,
} from "../../../domain/canvas/CanvasParser";
import { FolderPickerModal, getVaultFolders } from "../../../ui/shared/FolderPickerModal";
import { renderStepBar, revealFolderInExplorer } from "../../../ui/hub/helpers";
import { CanvasLanding } from "../../../ui/canvas/CanvasLanding";
import { CanvasConfigPage } from "../../../ui/canvas/CanvasConfigPage";
import { CanvasPreviewPage } from "../../../ui/canvas/CanvasPreviewPage";
import { CanvasResultPage } from "../../../ui/canvas/CanvasResultPage";
import { STEP_LABELS } from "../../../ui/canvas/types";
import type { CanvasViewState, CanvasComponentDeps, CanvasPage } from "../../../ui/canvas/types";
import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";

// ── Deps ──────────────────────────────────────────────────────

export interface CanvasImportHandlerDeps {
	canvasService: CanvasService;
	eventBus: IEventBus;
	app: App;
}

// ── Registration ──────────────────────────────────────────────

export function registerCanvasImportHandler(
	registry: PluginHandlerRegistry,
	deps: CanvasImportHandlerDeps,
): void {
	registry.registerTabHandler("leaf:canvas-import", (container: HTMLElement, ctx: TabContext) => {
		createCanvasImportWizard(container, ctx, deps);
	});
}

// ── Wizard orchestrator ───────────────────────────────────────

interface WizardRefs {
	rootEl: HTMLElement | null;
	topBarEl: HTMLElement | null;
	landingEl: HTMLElement | null;
	workspaceEl: HTMLElement | null;
	saveBtnEl: HTMLElement | null;
	unsavedHintEl: HTMLElement | null;
	landingPage: CanvasLanding | null;
	configPage: CanvasConfigPage | null;
	previewPage: CanvasPreviewPage | null;
	resultPage: CanvasResultPage | null;
	canvasDeps: CanvasComponentDeps | null;
	unsubscribes: (() => void)[];
}

function createDefaultState(): CanvasViewState {
	return {
		currentPage: "landing",
		canvasPath: "",
		targetFolder: "",
		configName: "",
		conflictStrategy: "skip",
		hierarchyMode: "flat",
		subfolderName: "",
		createCanvas: true,
		createBase: true,
		colorMap: { ...DEFAULT_COLOR_MAP },
		shapeMap: { ...DEFAULT_SHAPE_MAP },
		excludedTypes: [],
		previewItems: [],
		legendMap: null,
		parseError: null,
		importing: false,
		importDone: false,
		importSuccess: false,
		importMessage: "",
		importProgress: { current: 0, total: 0, title: "" },
		importResult: null,
		artifactPaths: {},
		loadedConfigId: null,
	};
}

export function createCanvasImportWizard(
	container: HTMLElement,
	_ctx: TabContext,
	deps: CanvasImportHandlerDeps,
): () => void {
	const state: CanvasViewState = createDefaultState();

	const refs: WizardRefs = {
		rootEl: null,
		topBarEl: null,
		landingEl: null,
		workspaceEl: null,
		saveBtnEl: null,
		unsavedHintEl: null,
		landingPage: null,
		configPage: null,
		previewPage: null,
		resultPage: null,
		canvasDeps: null,
		unsubscribes: [],
	};

	// ── State accessors ─────────────────────────────────────

	function getState(): CanvasViewState {
		return state;
	}

	function setState(partial: Partial<CanvasViewState>): void {
		Object.assign(state, partial);
	}

	// ── Read canvas file ────────────────────────────────────

	async function readCanvasFile(path: string): Promise<string> {
		const file = (deps.app as unknown as { vault: { getAbstractFileByPath: (p: string) => unknown; read: (f: unknown) => Promise<string> } }).vault.getAbstractFileByPath(path);
		if (!file) throw new Error(`File not found: ${path}`);
		return (deps.app as unknown as { vault: { read: (f: unknown) => Promise<string> } }).vault.read(file);
	}

	// ── Folder picker ───────────────────────────────────────

	function openFolderPicker(): void {
		const folders = getVaultFolders(deps.app);
		new FolderPickerModal(deps.app, folders, (folder) => {
			state.targetFolder = folder;
			renderContent();
		}).open();
	}

	// ── Unsaved changes ─────────────────────────────────────

	function hasUnsavedChanges(): boolean {
		if (!state.loadedConfigId) return false;
		const cfg = deps.canvasService.getConfig(state.loadedConfigId);
		if (!cfg) return false;
		if (cfg.targetFolder !== state.targetFolder) return true;
		if ((cfg.subfolderName || "") !== state.subfolderName) return true;
		if (cfg.conflictStrategy !== state.conflictStrategy) return true;
		if (cfg.hierarchyMode !== state.hierarchyMode) return true;
		if (cfg.name !== state.configName) return true;
		if ((cfg.createCanvas !== false) !== state.createCanvas) return true;
		if ((cfg.createBase !== false) !== state.createBase) return true;
		if (JSON.stringify(cfg.colorMap) !== JSON.stringify(state.colorMap)) return true;
		if (JSON.stringify(cfg.shapeMap) !== JSON.stringify(state.shapeMap)) return true;
		if (JSON.stringify(cfg.excludedTypes ?? []) !== JSON.stringify(state.excludedTypes)) return true;
		return false;
	}

	function updateUnsavedHint(): void {
		const changed = hasUnsavedChanges();
		if (refs.unsavedHintEl) {
			refs.unsavedHintEl.classList.toggle("ft-hidden", !changed);
		}
		if (refs.saveBtnEl) {
			refs.saveBtnEl.classList.toggle("ft-hidden", !changed);
		}
	}

	// ── Parse & preview ─────────────────────────────────────

	async function parseAndPreview(): Promise<void> {
		state.parseError = null;
		state.previewItems = [];
		state.legendMap = null;

		try {
			const json = await readCanvasFile(state.canvasPath);
			if (!json) {
				state.parseError = `Canvas file not found or empty: ${state.canvasPath}`;
				state.currentPage = "preview";
				renderContent();
				return;
			}

			const canvasData = parseCanvasJson(json);
			if (!canvasData) {
				state.parseError = `Invalid canvas JSON: ${state.canvasPath}`;
				state.currentPage = "preview";
				renderContent();
				return;
			}

			state.legendMap = extractLegend(canvasData);
			const items = buildCanvasItems(
				canvasData,
				state.legendMap,
				state.colorMap,
				state.shapeMap,
			);

			const groups = items.filter((i) => i.originalType === "group");
			for (const item of items) {
				const result = resolveParentage(item, groups);
				if (result) {
					item.parentId = result.parentId;
					item.parent = result.parent;
				}
			}

			state.previewItems = items;
		} catch (err) {
			state.parseError = `Failed to parse canvas: ${err instanceof Error ? err.message : String(err)}`;
		}

		state.currentPage = "preview";
		renderContent();
	}

	// ── Import execution ────────────────────────────────────

	function resolveArtifactPaths(): { canvasPath?: string; basePath?: string } {
		const canvasBasename = state.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		const subfolder = state.subfolderName || canvasBasename;
		const effectiveTarget = state.targetFolder
			? `${state.targetFolder}/${subfolder}`
			: subfolder;

		const paths: { canvasPath?: string; basePath?: string } = {};
		if (state.createCanvas) {
			paths.canvasPath = `${effectiveTarget}/${subfolder}.canvas`;
		}
		if (state.createBase) {
			paths.basePath = `${effectiveTarget}/${subfolder}.base`;
		}
		return paths;
	}

	async function runImport(): Promise<void> {
		state.importing = true;
		state.importDone = false;
		state.currentPage = "result";
		renderContent();

		try {
			const input: CanvasConfigInput = {
				name: state.configName.trim() || `Import ${state.canvasPath.split("/").pop() ?? "canvas"}`,
				canvasPath: state.canvasPath,
				targetFolder: state.targetFolder,
				colorMap: state.colorMap,
				shapeMap: state.shapeMap,
				excludedTypes: state.excludedTypes,
				conflictStrategy: state.conflictStrategy,
				hierarchyMode: state.hierarchyMode,
				subfolderName: state.subfolderName,
				createCanvas: state.createCanvas,
				createBase: state.createBase,
			};

			let configId: string;
			if (state.loadedConfigId) {
				await deps.canvasService.updateConfig(state.loadedConfigId, input);
				configId = state.loadedConfigId;
			} else {
				const config = await deps.canvasService.saveConfig(input);
				state.loadedConfigId = config.id;
				configId = config.id;
			}

			const result = await deps.canvasService.runImport(configId);

			state.importResult = result;
			state.importSuccess = true;
			state.artifactPaths = resolveArtifactPaths();
			const errorNote = result.errors.length > 0 ? `, ${result.errors.length} errors` : "";
			state.importMessage =
				`Imported ${result.imported} of ${result.totalNodes} nodes (${result.skipped} skipped${errorNote}) in ${result.duration}ms`;
			void deps.eventBus.emit("notice.success", { message: state.importMessage });
			revealFolderInExplorer(deps.app, result.targetFolder);
		} catch (err) {
			state.importSuccess = false;
			state.importMessage = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
		}

		state.importing = false;
		state.importDone = true;
		renderContent();
	}

	// ── Save config ─────────────────────────────────────────

	async function saveConfig(): Promise<void> {
		const input: CanvasConfigInput = {
			name: state.configName.trim() || `Import ${state.canvasPath.split("/").pop() ?? "canvas"}`,
			canvasPath: state.canvasPath,
			targetFolder: state.targetFolder,
			colorMap: state.colorMap,
			shapeMap: state.shapeMap,
			excludedTypes: state.excludedTypes,
			conflictStrategy: state.conflictStrategy,
			hierarchyMode: state.hierarchyMode,
			subfolderName: state.subfolderName,
			createCanvas: state.createCanvas,
			createBase: state.createBase,
		};

		try {
			if (state.loadedConfigId) {
				await deps.canvasService.updateConfig(state.loadedConfigId, input);
			} else {
				const config = await deps.canvasService.saveConfig(input);
				state.loadedConfigId = config.id;
			}
			void deps.eventBus.emit("notice.success", { message: "Canvas config saved" });
			renderContent();
		} catch (err) {
			void deps.eventBus.emit("notice.error", { message: `Failed to save config: ${err instanceof Error ? err.message : String(err)}` });
		}
	}

	// ── Layout skeleton ─────────────────────────────────────

	function ensureRoot(): void {
		if (refs.rootEl) return;

		container.innerHTML = "";

		refs.rootEl = container.createDiv({ cls: "flowti-container ft-view-root-flex" });

		// Top bar (hidden on landing)
		refs.topBarEl = refs.rootEl.createDiv({ cls: "ft-view-top-bar ft-hidden" });

		// Landing page container
		refs.landingEl = refs.rootEl.createDiv({ cls: "ft-view-landing" });

		// Workspace container (for wizard pages)
		refs.workspaceEl = refs.rootEl.createDiv({ cls: "ft-view-workspace ft-hidden" });

		// Build deps and create page components
		refs.canvasDeps = buildDeps();
		refs.landingPage = new CanvasLanding(refs.landingEl, refs.canvasDeps);
		refs.configPage = new CanvasConfigPage(refs.workspaceEl, refs.canvasDeps);
		refs.previewPage = new CanvasPreviewPage(refs.workspaceEl, refs.canvasDeps);
		refs.resultPage = new CanvasResultPage(refs.workspaceEl, refs.canvasDeps);
	}

	// ── Deps builder ────────────────────────────────────────

	function buildDeps(): CanvasComponentDeps {
		return {
			app: deps.app,
			eventBus: deps.eventBus,
			canvasService: deps.canvasService,
			getState,
			setState,
			renderContent,
			parseAndPreview,
			runImport,
			saveConfig,
			hasUnsavedChanges,
			updateUnsavedHint,
			setUnsavedHintEl: (el) => { refs.unsavedHintEl = el; },
			readCanvasFile,
			openFolderPicker,
			detachLeaf: () => {
				// In handler context, we clear the container instead of detaching a leaf
				container.innerHTML = "";
			},
		};
	}

	// ── Top bar with stepper ────────────────────────────────

	function renderTopBar(): void {
		const bar = refs.topBarEl!;
		bar.empty();

		// Row 1: File header
		const headerRow = bar.createDiv({ cls: "ft-csv-header ft-header-mb-0" });
		const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "layout-dashboard");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const filename = state.canvasPath.split("/").pop() ?? "Canvas";
		const nameEl = titleRow.createEl("h2", { text: filename, cls: "ft-heading ft-csv-title" });
		nameEl.addClass("ft-cursor-pointer");
		nameEl.addEventListener("click", () => {
			state.currentPage = "landing";
			renderContent();
		});
		titleRow.createSpan({
			text: "Import",
			cls: "ft-operation-badge ft-operation-badge-import",
		});

		// Config indicator
		if (state.loadedConfigId) {
			const cfg = deps.canvasService.getConfig(state.loadedConfigId);
			if (cfg) {
				titleRow.createSpan({
					text: `Config: ${cfg.name}`,
					cls: "ft-badge ft-badge-accent",
				});
			}
		}

		const subtitle = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		subtitle.createSpan({ text: state.canvasPath, cls: "ft-text-sm ft-text-muted" });

		// Row 2: Stepper + save button
		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		renderStepBar(stepRow, {
			steps: ["config", "preview", "result"] as CanvasPage[],
			currentPage: state.currentPage,
			labels: STEP_LABELS,
			hasResult: state.importDone && state.importSuccess,
			hasError: state.importDone && !state.importSuccess,
			onNavigate: (page) => {
				state.currentPage = page;
				renderContent();
			},
		});

		// Spacer
		stepRow.createDiv({ cls: "ft-flex-1" });

		// Save button
		const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
		setIcon(saveBtn.createSpan(), "save");
		saveBtn.appendText(" Save");
		saveBtn.addEventListener("click", () => { void saveConfig(); });
		saveBtn.classList.toggle("ft-hidden", !hasUnsavedChanges());
		refs.saveBtnEl = saveBtn;
	}

	// ── Page router ─────────────────────────────────────────

	function renderContent(): void {
		ensureRoot();

		const isLanding = state.currentPage === "landing";
		refs.topBarEl!.classList.toggle("ft-hidden", isLanding);
		refs.landingEl!.classList.toggle("ft-hidden", !isLanding);
		refs.workspaceEl!.classList.toggle("ft-hidden", isLanding);

		if (!isLanding) {
			renderTopBar();
		}

		switch (state.currentPage) {
			case "landing":
				refs.landingPage!.render();
				break;
			case "config":
				refs.configPage!.render();
				break;
			case "preview":
				refs.previewPage!.render();
				break;
			case "result":
				refs.resultPage!.render();
				break;
		}
	}

	// ── EventBus subscriptions ──────────────────────────────

	refs.unsubscribes.push(
		deps.eventBus.on("canvas.import.started", (event) => {
			state.importProgress.total = event.payload.totalNodes;
			state.importProgress.current = 0;
		}),
		deps.eventBus.on("canvas.import.progress", (event) => {
			state.importProgress.current = event.payload.current;
			state.importProgress.total = event.payload.total;
			state.importProgress.title = event.payload.title;
			if (state.currentPage === "result" && !state.importDone) {
				refs.resultPage?.renderProgressIndicator();
			}
		}),
	);

	// ── Initial render ──────────────────────────────────────

	renderContent();

	// ── Cleanup function ────────────────────────────────────

	return () => {
		for (const unsub of refs.unsubscribes) unsub();
		refs.unsubscribes = [];
		container.innerHTML = "";
	};
}
