/**
 * Data Exchange UI wiring — file menus, view factories, commands, callbacks.
 *
 * Extracted from main.ts (Phase 7) to reduce its LOC.
 */

import { Notice, TFile, TFolder } from "obsidian";
import type { App, Command, EventRef, ViewCreator } from "obsidian";
import type { IEventBus } from "./infrastructure/events/types";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import type { ExportFormat, SavedExportConfig, SavedImportConfig, VaultFileInfo } from "./domain/dataExchange/types";
import { CsvActionView, VIEW_TYPE_CSV } from "./ui/CsvActionView";
import { ExportView, VIEW_TYPE_EXPORT, type ExportViewConfig } from "./ui/ExportView";
import { DataExchangeHubView, VIEW_TYPE_DATA_EXCHANGE_HUB } from "./ui/DataExchangeHubView";

export interface DataExchangeSetupDeps {
	app: App;
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	docsRootPath: string;
	registerView: (type: string, factory: ViewCreator) => void;
	registerExtensions: (extensions: string[], viewType: string) => void;
	registerEvent: (ref: EventRef) => void;
	addCommand: (command: Command) => void;
}

export class DataExchangeSetup {
	private pendingExportConfig: ExportViewConfig | null = null;
	private pendingImportAutoStart = false;
	private pendingSavedImportConfig: SavedImportConfig | null = null;
	private pendingSavedExportConfig: SavedExportConfig | null = null;

	constructor(private deps: DataExchangeSetupDeps) {}

	/** Wire vault callbacks (setDocsRootPath, setListFiles, setWriteExternalFile, setReadExternalFile). */
	wireCallbacks(): void {
		const { app, dataExchangeService, docsRootPath } = this.deps;

		dataExchangeService.setDocsRootPath(docsRootPath);

		dataExchangeService.setListFiles((folderPath: string): VaultFileInfo[] => {
			const results: VaultFileInfo[] = [];
			for (const file of app.vault.getFiles()) {
				if (folderPath && !file.path.startsWith(folderPath + "/")) continue;
				const cache = app.metadataCache.getFileCache(file);
				const folder = file.path.substring(0, file.path.lastIndexOf("/")) || "";
				const tags: string[] = [];
				if (cache) {
					const inlineTags = (cache.tags ?? []).map((t) => t.tag.replace(/^#/, ""));
					const fmTags = cache.frontmatter?.tags;
					if (Array.isArray(fmTags)) {
						for (const t of fmTags) tags.push(String(t));
					}
					for (const t of inlineTags) {
						if (!tags.includes(t)) tags.push(t);
					}
				}
				results.push({
					path: file.path,
					basename: file.basename,
					extension: file.extension,
					folder,
					frontmatter: cache?.frontmatter as Record<string, unknown> | undefined,
					stat: file.stat ? { ctime: file.stat.ctime, mtime: file.stat.mtime, size: file.stat.size } : undefined,
					tags: tags.length > 0 ? tags : undefined,
				});
			}
			return results;
		});

		dataExchangeService.setWriteExternalFile(async (absolutePath: string, content: string) => {
			const fs = require("fs") as typeof import("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
			const path = require("path") as typeof import("path"); // eslint-disable-line @typescript-eslint/no-require-imports
			const dir = path.dirname(absolutePath);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(absolutePath, content, "utf-8");
		});

		dataExchangeService.setReadExternalFile(async (absolutePath: string) => {
			const fs = require("fs") as typeof import("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
			try {
				return fs.readFileSync(absolutePath, "utf-8");
			} catch {
				return null;
			}
		});
	}

	/** Register CSV, Export, and Hub view factories. */
	registerViews(): void {
		const { eventBus, dataExchangeService, registerView } = this.deps;

		// CSV view — clicking a .csv opens the import action view
		registerView(VIEW_TYPE_CSV, (leaf) => {
			const auto = this.pendingImportAutoStart;
			this.pendingImportAutoStart = false;
			const savedConfig = this.pendingSavedImportConfig;
			this.pendingSavedImportConfig = null;
			const view = new CsvActionView(leaf, eventBus, dataExchangeService, auto);
			if (savedConfig) view.setSavedConfig(savedConfig);
			view.setOpenHubImportConfig((configId) => {
				this.openHubImportConfig(configId);
			});
			return view;
		});
		try {
			this.deps.registerExtensions(["csv"], VIEW_TYPE_CSV);
		} catch {
			// Extension may already be registered by another plugin
		}

		// Export view — opens from context menus and commands
		registerView(VIEW_TYPE_EXPORT, (leaf) => {
			const savedCfg = this.pendingSavedExportConfig;
			this.pendingSavedExportConfig = null;
			const view = new ExportView(leaf, eventBus, dataExchangeService, () => {
				const cfg = this.pendingExportConfig;
				this.pendingExportConfig = null;
				return cfg;
			});
			if (savedCfg) view.setSavedConfig(savedCfg);
			return view;
		});

		// Data Exchange Hub — central management view
		registerView(VIEW_TYPE_DATA_EXCHANGE_HUB, (leaf) =>
			new DataExchangeHubView(
				leaf,
				eventBus,
				dataExchangeService,
				(csvPath, savedConfig) => this.openCsvImportWithConfig(csvPath, savedConfig),
				(savedConfig) => this.openExportWithSavedConfig(savedConfig),
				(sourcePath, sourceType, format) => this.openExportView(sourcePath, sourceType, format),
			),
		);
	}

	/** Register file-menu context items for CSV, .base, and TFolder. */
	registerFileMenuItems(): void {
		const { app, eventBus, dataExchangeService, registerEvent } = this.deps;

		registerEvent(
			app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension === "csv") {
					menu.addItem((item) => {
						item.setTitle("Import as Notes")
							.setIcon("file-input")
							.onClick(() => {
								void eventBus.emit("ui.openCsvImport", {
									filePath: file.path,
									autoStart: true,
								});
							});
					});

					// Existing import configs for this CSV
					const importConfigs = dataExchangeService.getImportConfigsForFile(file.path);
					if (importConfigs.length > 0) {
						menu.addSeparator();
						for (const cfg of importConfigs.slice(0, 5)) {
							menu.addItem((item) => {
								item.setTitle(`Import with: ${cfg.name}`)
									.setIcon("play")
									.onClick(() => {
										void eventBus.emit("ui.openCsvImport", {
											filePath: file.path,
											savedConfig: cfg,
											autoStart: true,
										});
									});
							});
						}
					}
				}

				if (file instanceof TFile && file.extension === "base") {
					menu.addItem((item) => {
						item.setTitle("Export as CSV")
							.setIcon("file-output")
							.onClick(() => {
								void eventBus.emit("ui.openExport", {
									sourcePath: file.path,
									sourceType: "base",
									format: "csv",
								});
							});
					});
					menu.addItem((item) => {
						item.setTitle("Export as Tab")
							.setIcon("file-output")
							.onClick(() => {
								void eventBus.emit("ui.openExport", {
									sourcePath: file.path,
									sourceType: "base",
									format: "tab",
								});
							});
					});

					// Existing export configs for this .base file
					const exportConfigs = dataExchangeService.getExportConfigsForSource(file.path);
					if (exportConfigs.length > 0) {
						menu.addSeparator();
						for (const cfg of exportConfigs.slice(0, 5)) {
							menu.addItem((item) => {
								item.setTitle(`Export with: ${cfg.name}`)
									.setIcon("play")
									.onClick(() => {
										void eventBus.emit("ui.openExport", {
											savedConfig: cfg,
											format: cfg.format,
										});
									});
							});
						}
					}
				}

				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item.setTitle("Export as CSV")
							.setIcon("file-output")
							.onClick(() => {
								void eventBus.emit("ui.openExport", {
									sourcePath: file.path,
									sourceType: "folder",
									format: "csv",
								});
							});
					});
					menu.addItem((item) => {
						item.setTitle("Export as Tab")
							.setIcon("file-output")
							.onClick(() => {
								void eventBus.emit("ui.openExport", {
									sourcePath: file.path,
									sourceType: "folder",
									format: "tab",
								});
							});
					});

					// Existing export configs for this folder
					const exportConfigs = dataExchangeService.getExportConfigsForSource(file.path);
					if (exportConfigs.length > 0) {
						menu.addSeparator();
						for (const cfg of exportConfigs.slice(0, 5)) {
							menu.addItem((item) => {
								item.setTitle(`Export with: ${cfg.name}`)
									.setIcon("play")
									.onClick(() => {
										void eventBus.emit("ui.openExport", {
											savedConfig: cfg,
											format: cfg.format,
										});
									});
							});
						}
					}
				}
			})
		);
	}

	/** Register import/export commands for the command palette. */
	registerCommands(): void {
		const { addCommand } = this.deps;

		addCommand({
			id: "flowti:import-csv",
			name: "Import CSV as Notes",
			icon: "file-input",
			callback: () => {
				void this.deps.eventBus.emit("ui.openCsvImport", {});
			},
		});

		addCommand({
			id: "flowti:export-csv",
			name: "Export as CSV",
			icon: "file-output",
			callback: () => {
				void this.deps.eventBus.emit("ui.openExport", { format: "csv" });
			},
		});

		addCommand({
			id: "flowti:export-tab",
			name: "Export as Tab-delimited",
			icon: "file-output",
			callback: () => {
				void this.deps.eventBus.emit("ui.openExport", { format: "tab" });
			},
		});

		addCommand({
			id: "flowti:open-data-exchange",
			name: "Open Data Exchange Hub",
			icon: "arrow-left-right",
			callback: () => {
				void this.deps.eventBus.emit("ui.openDataExchangeHub", {});
			},
		});
	}

	// ── Private helpers ──────────────────────────────────────

	openExportView(
		sourcePath: string,
		sourceType: "folder" | "base",
		format: ExportFormat,
	): void {
		this.pendingExportConfig = { sourcePath, sourceType, format };
		const leaf = this.deps.app.workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_EXPORT, active: true });
		this.deps.app.workspace.revealLeaf(leaf);
	}

	openCsvImportWithConfig(csvPath: string, savedConfig?: SavedImportConfig): void {
		const csvFile = this.deps.app.vault.getAbstractFileByPath(csvPath);
		if (!(csvFile instanceof TFile)) {
			new Notice(`File not found: ${csvPath}`);
			return;
		}
		this.pendingSavedImportConfig = savedConfig ?? null;
		this.pendingImportAutoStart = true;
		const leaf = this.deps.app.workspace.getLeaf(true);
		void leaf.openFile(csvFile);
	}

	openExportWithSavedConfig(savedConfig: SavedExportConfig): void {
		this.pendingExportConfig = {
			sourcePath: savedConfig.sourcePath,
			sourceType: savedConfig.sourceType,
			format: savedConfig.format,
		};
		this.pendingSavedExportConfig = savedConfig;
		const leaf = this.deps.app.workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_EXPORT, active: true });
		this.deps.app.workspace.revealLeaf(leaf);
	}

	private openHubImportConfig(configId: string): void {
		const { workspace } = this.deps.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_DATA_EXCHANGE_HUB);
		if (existing.length > 0) {
			const view = existing[0].view as DataExchangeHubView;
			view.showImportConfig(configId);
			workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_DATA_EXCHANGE_HUB, active: true }).then(() => {
			const view = leaf.view as DataExchangeHubView;
			view.showImportConfig(configId);
			workspace.revealLeaf(leaf);
		});
	}
}
