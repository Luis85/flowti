/**
 * Canvas Action View for Flowti.
 *
 * ItemView-based orchestrator for canvas import workflow.
 * Follows the same page-based pattern as CsvActionView:
 *   landing → config → preview → result
 *
 * Unlike CsvActionView (TextFileView), this uses ItemView because
 * Obsidian owns the .canvas extension. Canvas data is read from the vault.
 */

import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { CanvasService, CanvasConfigInput } from "../domain/canvas/CanvasService";
import { DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP } from "../domain/canvas/types";
import {
	parseCanvasJson,
	extractLegend,
	buildCanvasItems,
	resolveParentage,
} from "../domain/canvas/CanvasParser";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";
import { renderStepBar, revealFolderInExplorer } from "./hub/helpers";
import { CanvasLanding } from "./canvas/CanvasLanding";
import { CanvasConfigPage } from "./canvas/CanvasConfigPage";
import { CanvasPreviewPage } from "./canvas/CanvasPreviewPage";
import { CanvasResultPage } from "./canvas/CanvasResultPage";
import { STEP_LABELS } from "./canvas/types";
import type { CanvasViewState, CanvasComponentDeps, CanvasPage } from "./canvas/types";

export const VIEW_TYPE_CANVAS = "flowti-canvas-import";

export class CanvasActionView extends ItemView {
	private eventBus: IEventBus;
	private canvasService: CanvasService;
	private unsubscribes: (() => void)[] = [];

	// Layout skeleton
	private rootEl: HTMLElement | null = null;
	private topBarEl: HTMLElement | null = null;
	private landingEl: HTMLElement | null = null;
	private workspaceEl: HTMLElement | null = null;

	// Page components
	private canvasDeps: CanvasComponentDeps | null = null;
	private landingPage: CanvasLanding | null = null;
	private configPage: CanvasConfigPage | null = null;
	private previewPage: CanvasPreviewPage | null = null;
	private resultPage: CanvasResultPage | null = null;

	// Unsaved changes elements (toggled by updateUnsavedHint)
	private saveBtnEl: HTMLElement | null = null;
	private unsavedHintEl: HTMLElement | null = null;

	// Consolidated state
	private state: CanvasViewState = {
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

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		canvasService: CanvasService,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.canvasService = canvasService;
	}

	// ── Public API ──────────────────────────────────────────

	/** Set the canvas path and optionally pre-load a saved config. */
	setCanvasPath(canvasPath: string, configId?: string): void {
		this.state.canvasPath = canvasPath;
		if (configId) {
			this.loadConfig(configId);
		}
	}

	/** Auto-start: skip to execute page and run a saved config immediately. */
	setAutoRun(configId: string): void {
		this.state.loadedConfigId = configId;
	}

	// ── ItemView lifecycle ──────────────────────────────────

	getViewType(): string {
		return VIEW_TYPE_CANVAS;
	}

	getDisplayText(): string {
		const filename = this.state.canvasPath.split("/").pop() ?? "Canvas Import";
		return filename.replace(/\.canvas$/, "");
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		// Subscribe to progress events
		this.unsubscribes.push(
			this.eventBus.on("canvas.import.started", (event) => {
				this.state.importProgress.total = event.payload.totalNodes;
				this.state.importProgress.current = 0;
			}),
			this.eventBus.on("canvas.import.progress", (event) => {
				this.state.importProgress.current = event.payload.current;
				this.state.importProgress.total = event.payload.total;
				this.state.importProgress.title = event.payload.title;
				if (this.state.currentPage === "result" && !this.state.importDone) {
					this.resultPage?.renderProgressIndicator();
				}
			}),
		);

		// Auto-run saved config if set
		if (this.state.loadedConfigId) {
			this.state.currentPage = "result";
			this.renderContent();
			void this.runSavedImport(this.state.loadedConfigId);
			return;
		}

		this.renderContent();
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Layout skeleton ─────────────────────────────────────

	private ensureRoot(): void {
		if (this.rootEl) return;

		const el = this.contentEl;
		el.empty();

		this.rootEl = el.createDiv({ cls: "flowti-container" });
		this.rootEl.style.height = "100%";
		this.rootEl.style.display = "flex";
		this.rootEl.style.flexDirection = "column";

		// Top bar (hidden on landing)
		this.topBarEl = this.rootEl.createDiv({ cls: "ft-view-top-bar ft-hidden" });

		// Landing page container
		this.landingEl = this.rootEl.createDiv({ cls: "ft-view-landing" });

		// Workspace container (for wizard pages)
		this.workspaceEl = this.rootEl.createDiv({ cls: "ft-view-workspace ft-hidden" });

		// Create page components
		this.canvasDeps = this.buildDeps();
		this.landingPage = new CanvasLanding(this.landingEl, this.canvasDeps);
		this.configPage = new CanvasConfigPage(this.workspaceEl, this.canvasDeps);
		this.previewPage = new CanvasPreviewPage(this.workspaceEl, this.canvasDeps);
		this.resultPage = new CanvasResultPage(this.workspaceEl, this.canvasDeps);
	}

	// ── Page router ─────────────────────────────────────────

	private renderContent(): void {
		this.ensureRoot();

		const isLanding = this.state.currentPage === "landing";
		this.topBarEl!.classList.toggle("ft-hidden", isLanding);
		this.landingEl!.classList.toggle("ft-hidden", !isLanding);
		this.workspaceEl!.classList.toggle("ft-hidden", isLanding);

		if (!isLanding) {
			this.renderTopBar();
		}

		switch (this.state.currentPage) {
			case "landing":
				this.landingPage!.render();
				break;
			case "config":
				this.configPage!.render();
				break;
			case "preview":
				this.previewPage!.render();
				break;
			case "result":
				this.resultPage!.render();
				break;
		}
	}

	// ── Deps builder ────────────────────────────────────────

	private buildDeps(): CanvasComponentDeps {
		return {
			app: this.app,
			eventBus: this.eventBus,
			canvasService: this.canvasService,
			getState: () => this.state,
			setState: (partial) => { Object.assign(this.state, partial); },
			renderContent: () => this.renderContent(),
			parseAndPreview: () => this.parseAndPreview(),
			runImport: () => this.runImport(),
			saveConfig: () => this.saveConfig(),
			hasUnsavedChanges: () => this.hasUnsavedChanges(),
			updateUnsavedHint: () => this.updateUnsavedHint(),
			setUnsavedHintEl: (el) => { this.unsavedHintEl = el; },
			readCanvasFile: (path) => this.readCanvasFile(path),
			openFolderPicker: () => this.openFolderPicker(),
			detachLeaf: () => this.leaf.detach(),
		};
	}

	// ── Top bar with stepper ────────────────────────────────

	private renderTopBar(): void {
		const bar = this.topBarEl!;
		bar.empty();

		// ── Row 1: File header ──
		const headerRow = bar.createDiv({ cls: "ft-csv-header" });
		headerRow.style.marginBottom = "0";
		const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "layout-dashboard");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const filename = this.state.canvasPath.split("/").pop() ?? "Canvas";
		const nameEl = titleRow.createEl("h2", { text: filename, cls: "ft-heading ft-csv-title" });
		nameEl.addClass("ft-cursor-pointer");
		nameEl.addEventListener("click", () => {
			this.state.currentPage = "landing";
			this.renderContent();
		});
		titleRow.createSpan({
			text: "Import",
			cls: "ft-operation-badge ft-operation-badge-import",
		});

		// Config indicator
		if (this.state.loadedConfigId) {
			const cfg = this.canvasService.getConfig(this.state.loadedConfigId);
			if (cfg) {
				titleRow.createSpan({
					text: `Config: ${cfg.name}`,
					cls: "ft-badge ft-badge-accent",
				});
			}
		}

		const subtitle = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		subtitle.createSpan({ text: this.state.canvasPath, cls: "ft-text-sm ft-text-muted" });

		// ── Row 2: Stepper + save button ──
		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		renderStepBar(stepRow, {
			steps: ["config", "preview", "result"] as CanvasPage[],
			currentPage: this.state.currentPage,
			labels: STEP_LABELS,
			hasResult: this.state.importDone && this.state.importSuccess,
			hasError: this.state.importDone && !this.state.importSuccess,
			onNavigate: (page) => {
				this.state.currentPage = page;
				this.renderContent();
			},
		});

		// Spacer
		stepRow.createDiv({ cls: "ft-flex-1" });

		// Save button (always rendered, toggled by updateUnsavedHint)
		const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
		setIcon(saveBtn.createSpan(), "save");
		saveBtn.appendText(" Save");
		saveBtn.addEventListener("click", () => { void this.saveConfig(); });
		saveBtn.style.display = this.hasUnsavedChanges() ? "" : "none";
		this.saveBtnEl = saveBtn;
	}

	// ── Parse & preview ─────────────────────────────────────

	private async parseAndPreview(): Promise<void> {
		this.state.parseError = null;
		this.state.previewItems = [];
		this.state.legendMap = null;

		try {
			const json = await this.readCanvasFile(this.state.canvasPath);
			if (!json) {
				this.state.parseError = `Canvas file not found or empty: ${this.state.canvasPath}`;
				this.state.currentPage = "preview";
				this.renderContent();
				return;
			}

			const canvasData = parseCanvasJson(json);
			if (!canvasData) {
				this.state.parseError = `Invalid canvas JSON: ${this.state.canvasPath}`;
				this.state.currentPage = "preview";
				this.renderContent();
				return;
			}

			this.state.legendMap = extractLegend(canvasData);
			const items = buildCanvasItems(
				canvasData,
				this.state.legendMap,
				this.state.colorMap,
				this.state.shapeMap,
			);

			// Resolve parentage
			const groups = items.filter((i) => i.originalType === "group");
			for (const item of items) {
				const result = resolveParentage(item, groups);
				if (result) {
					item.parentId = result.parentId;
					item.parent = result.parent;
				}
			}

			this.state.previewItems = items;
		} catch (err) {
			this.state.parseError = `Failed to parse canvas: ${err instanceof Error ? err.message : String(err)}`;
		}

		this.state.currentPage = "preview";
		this.renderContent();
	}

	// ── Import execution ────────────────────────────────────

	private async runImport(): Promise<void> {
		this.state.importing = true;
		this.state.importDone = false;
		this.state.currentPage = "result";
		this.renderContent();

		try {
			const input: CanvasConfigInput = {
				name: this.state.configName.trim() || `Import ${this.state.canvasPath.split("/").pop() ?? "canvas"}`,
				canvasPath: this.state.canvasPath,
				targetFolder: this.state.targetFolder,
				colorMap: this.state.colorMap,
				shapeMap: this.state.shapeMap,
				excludedTypes: this.state.excludedTypes,
				conflictStrategy: this.state.conflictStrategy,
				hierarchyMode: this.state.hierarchyMode,
				subfolderName: this.state.subfolderName,
				createCanvas: this.state.createCanvas,
				createBase: this.state.createBase,
			};

			let configId: string;
			if (this.state.loadedConfigId) {
				// Update existing config
				await this.canvasService.updateConfig(this.state.loadedConfigId, input);
				configId = this.state.loadedConfigId;
			} else {
				// Save new config
				const config = await this.canvasService.saveConfig(input);
				this.state.loadedConfigId = config.id;
				configId = config.id;
			}

			const result = await this.canvasService.runImport(configId);

			this.state.importResult = result;
			this.state.importSuccess = true;
			this.state.artifactPaths = this.resolveArtifactPaths();
			const errorNote = result.errors.length > 0 ? `, ${result.errors.length} errors` : "";
			this.state.importMessage =
				`Imported ${result.imported} of ${result.totalNodes} nodes (${result.skipped} skipped${errorNote}) in ${result.duration}ms`;
			new Notice(this.state.importMessage);
			revealFolderInExplorer(this.app, result.targetFolder);
		} catch (err) {
			this.state.importSuccess = false;
			this.state.importMessage = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
		}

		this.state.importing = false;
		this.state.importDone = true;
		this.renderContent();
	}

	private async runSavedImport(configId: string): Promise<void> {
		this.state.importing = true;
		this.state.importDone = false;

		try {
			const result = await this.canvasService.runImport(configId);

			this.state.importResult = result;
			this.state.importSuccess = true;
			this.state.artifactPaths = this.resolveArtifactPaths();
			const errorNote = result.errors.length > 0 ? `, ${result.errors.length} errors` : "";
			this.state.importMessage =
				`Imported ${result.imported} of ${result.totalNodes} nodes (${result.skipped} skipped${errorNote}) in ${result.duration}ms`;
			new Notice(this.state.importMessage);
			revealFolderInExplorer(this.app, result.targetFolder);
		} catch (err) {
			this.state.importSuccess = false;
			this.state.importMessage = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
		}

		this.state.importing = false;
		this.state.importDone = true;
		this.renderContent();
	}

	// ── Save config ──────────────────────────────────────────

	private async saveConfig(): Promise<void> {
		const input: CanvasConfigInput = {
			name: this.state.configName.trim() || `Import ${this.state.canvasPath.split("/").pop() ?? "canvas"}`,
			canvasPath: this.state.canvasPath,
			targetFolder: this.state.targetFolder,
			colorMap: this.state.colorMap,
			shapeMap: this.state.shapeMap,
			excludedTypes: this.state.excludedTypes,
			conflictStrategy: this.state.conflictStrategy,
			hierarchyMode: this.state.hierarchyMode,
			subfolderName: this.state.subfolderName,
			createCanvas: this.state.createCanvas,
			createBase: this.state.createBase,
		};

		try {
			if (this.state.loadedConfigId) {
				await this.canvasService.updateConfig(this.state.loadedConfigId, input);
			} else {
				const config = await this.canvasService.saveConfig(input);
				this.state.loadedConfigId = config.id;
			}
			new Notice("Canvas config saved");
			this.renderContent();
		} catch (err) {
			new Notice(`Failed to save config: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	// ── Unsaved changes ─────────────────────────────────────

	/** Checks whether the current config state differs from the loaded saved config. */
	private hasUnsavedChanges(): boolean {
		if (!this.state.loadedConfigId) return false;
		const cfg = this.canvasService.getConfig(this.state.loadedConfigId);
		if (!cfg) return false;
		if (cfg.targetFolder !== this.state.targetFolder) return true;
		if ((cfg.subfolderName || "") !== this.state.subfolderName) return true;
		if (cfg.conflictStrategy !== this.state.conflictStrategy) return true;
		if (cfg.hierarchyMode !== this.state.hierarchyMode) return true;
		if (cfg.name !== this.state.configName) return true;
		if ((cfg.createCanvas !== false) !== this.state.createCanvas) return true;
		if ((cfg.createBase !== false) !== this.state.createBase) return true;
		if (JSON.stringify(cfg.colorMap) !== JSON.stringify(this.state.colorMap)) return true;
		if (JSON.stringify(cfg.shapeMap) !== JSON.stringify(this.state.shapeMap)) return true;
		if (JSON.stringify(cfg.excludedTypes ?? []) !== JSON.stringify(this.state.excludedTypes)) return true;
		return false;
	}

	private updateUnsavedHint(): void {
		const changed = this.hasUnsavedChanges();
		if (this.unsavedHintEl) {
			this.unsavedHintEl.style.display = changed ? "flex" : "none";
		}
		if (this.saveBtnEl) {
			this.saveBtnEl.style.display = changed ? "" : "none";
		}
	}

	// ── Helpers ──────────────────────────────────────────────

	private resolveArtifactPaths(): { canvasPath?: string; basePath?: string } {
		const canvasBasename = this.state.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		const subfolder = this.state.subfolderName || canvasBasename;
		const effectiveTarget = this.state.targetFolder
			? `${this.state.targetFolder}/${subfolder}`
			: subfolder;

		const paths: { canvasPath?: string; basePath?: string } = {};
		if (this.state.createCanvas) {
			paths.canvasPath = `${effectiveTarget}/${subfolder}.canvas`;
		}
		if (this.state.createBase) {
			paths.basePath = `${effectiveTarget}/${subfolder}.base`;
		}
		return paths;
	}

	private async readCanvasFile(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(`File not found: ${path}`);
		return this.app.vault.read(file);
	}

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			this.state.targetFolder = folder;
			this.renderContent();
		}).open();
	}

	private loadConfig(id: string): void {
		const cfg = this.canvasService.getConfig(id);
		if (!cfg) return;
		this.state.loadedConfigId = cfg.id;
		this.state.configName = cfg.name;
		this.state.canvasPath = cfg.canvasPath;
		this.state.targetFolder = cfg.targetFolder;
		this.state.conflictStrategy = cfg.conflictStrategy;
		this.state.hierarchyMode = cfg.hierarchyMode;
		this.state.subfolderName = cfg.subfolderName || "";
		this.state.createCanvas = cfg.createCanvas !== false;
		this.state.createBase = cfg.createBase !== false;
		this.state.colorMap = { ...cfg.colorMap };
		this.state.shapeMap = { ...cfg.shapeMap };
		this.state.excludedTypes = [...(cfg.excludedTypes ?? [])];
	}
}
