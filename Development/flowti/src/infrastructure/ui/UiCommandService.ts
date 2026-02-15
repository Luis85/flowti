/**
 * Service that handles UI command events.
 *
 * Listens for `ui.*` events on the EventBus and performs the corresponding
 * view/modal opening via the Obsidian workspace API. This centralizes all
 * view-opening logic into a single observable location.
 *
 * For data exchange views (CSV import, export), the service delegates to
 * injected callbacks to avoid tight coupling with {@link DataExchangeSetup}.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../events/types";
import type { IDisposable } from "../services/types";
import type { ExportFormat, SavedExportConfig, SavedImportConfig } from "../../domain/dataExchange/types";
import { VIEW_TYPE_COMPONENT_SHOWCASE } from "../../ui/ComponentShowcaseView";
import { VIEW_TYPE_EVENT_CATALOG } from "../../ui/EventCatalogView";
import { VIEW_TYPE_EVENT_LOG } from "../../ui/EventLogView";
import { VIEW_TYPE_DATA_EXCHANGE_HUB } from "../../ui/DataExchangeHubView";
import { SubscriptionManagerModal } from "../../ui/SubscriptionManagerModal";

// ─────────────────────────────────────────────────────────────
// Callback types for data exchange delegation
// ─────────────────────────────────────────────────────────────

export type OpenCsvImportCallback = (
	filePath: string,
	savedConfig?: SavedImportConfig,
) => void;

export type OpenExportViewCallback = (
	sourcePath: string,
	sourceType: "folder" | "base",
	format: ExportFormat,
) => void;

export type OpenExportWithSavedConfigCallback = (
	savedConfig: SavedExportConfig,
) => void;

export interface InputModalConfig {
	title: string;
	inputName: string;
	inputDesc: string;
	placeholder: string;
	submitLabel: string;
	onSubmit: (value: string) => void;
}

export type ShowInputModalCallback = (config: InputModalConfig) => void;

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export interface UiCommandServiceOptions {
	app: App;
	eventBus: IEventBus;
}

export class UiCommandService implements IDisposable {
	private app: App;
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];

	// Injected callbacks for data exchange delegation
	private openCsvImportFn?: OpenCsvImportCallback;
	private openExportViewFn?: OpenExportViewCallback;
	private openExportWithSavedConfigFn?: OpenExportWithSavedConfigCallback;
	private showInputModalFn?: ShowInputModalCallback;

	constructor(options: UiCommandServiceOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.registerListeners();
	}

	// ── Callback setters (called during onLayoutReady) ──────

	setOpenCsvImport(fn: OpenCsvImportCallback): void {
		this.openCsvImportFn = fn;
	}

	setOpenExportView(fn: OpenExportViewCallback): void {
		this.openExportViewFn = fn;
	}

	setOpenExportWithSavedConfig(fn: OpenExportWithSavedConfigCallback): void {
		this.openExportWithSavedConfigFn = fn;
	}

	setShowInputModal(fn: ShowInputModalCallback): void {
		this.showInputModalFn = fn;
	}

	// ── IDisposable ─────────────────────────────────────────

	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Private: listener registration ──────────────────────

	private registerListeners(): void {
		this.unsubscribes.push(
			this.eventBus.on("ui.openEventCatalog", () =>
				this.openView(VIEW_TYPE_EVENT_CATALOG, "eventCatalog", "main"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openEventLog", () =>
				this.openView(VIEW_TYPE_EVENT_LOG, "eventLog", "right"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openComponentShowcase", () =>
				this.openView(VIEW_TYPE_COMPONENT_SHOWCASE, "componentShowcase", "right"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openDataExchangeHub", () =>
				this.openView(VIEW_TYPE_DATA_EXCHANGE_HUB, "dataExchangeHub", "main"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openSubscriptionManager", () =>
				this.handleOpenSubscriptionManager(),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openCsvImport", (event) =>
				this.handleOpenCsvImport(event.payload),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openExport", (event) =>
				this.handleOpenExport(event.payload),
			),
		);
	}

	// ── Private: handlers ───────────────────────────────────

	private openView(
		viewType: string,
		target: string,
		position: "main" | "right",
	): void {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(viewType);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
		} else if (position === "right") {
			const leaf = workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({ type: viewType, active: true });
				workspace.revealLeaf(leaf);
			}
		} else {
			const leaf = workspace.getLeaf(true);
			void leaf.setViewState({ type: viewType, active: true });
			workspace.revealLeaf(leaf);
		}
		void this.eventBus.emit("ui.opened", {
			target,
			timestamp: new Date().toISOString(),
		});
	}

	private handleOpenSubscriptionManager(): void {
		new SubscriptionManagerModal(this.app, this.eventBus).open();
		void this.eventBus.emit("ui.opened", {
			target: "subscriptionManager",
			timestamp: new Date().toISOString(),
		});
	}

	private handleOpenCsvImport(payload: {
		filePath?: string;
		savedConfig?: SavedImportConfig;
		autoStart?: boolean;
	}): void {
		if (payload.filePath) {
			this.openCsvImportFn?.(payload.filePath, payload.savedConfig);
			void this.eventBus.emit("ui.opened", {
				target: "csvImport",
				timestamp: new Date().toISOString(),
			});
		} else {
			this.showInputModalFn?.({
				title: "Import CSV",
				inputName: "CSV file path",
				inputDesc: "Enter the vault path to a .csv file",
				placeholder: "path/to/data.csv",
				submitLabel: "Import",
				onSubmit: (csvPath) => {
					this.openCsvImportFn?.(csvPath);
					void this.eventBus.emit("ui.opened", {
						target: "csvImport",
						timestamp: new Date().toISOString(),
					});
				},
			});
		}
	}

	private handleOpenExport(payload: {
		sourcePath?: string;
		sourceType?: "folder" | "base";
		format: ExportFormat;
		savedConfig?: SavedExportConfig;
	}): void {
		if (payload.savedConfig) {
			this.openExportWithSavedConfigFn?.(payload.savedConfig);
			void this.eventBus.emit("ui.opened", {
				target: "export",
				timestamp: new Date().toISOString(),
			});
		} else if (payload.sourcePath && payload.sourceType) {
			this.openExportViewFn?.(payload.sourcePath, payload.sourceType, payload.format);
			void this.eventBus.emit("ui.opened", {
				target: "export",
				timestamp: new Date().toISOString(),
			});
		} else {
			const formatLabel = payload.format === "tab" ? "Tab" : "CSV";
			this.showInputModalFn?.({
				title: `Export as ${formatLabel}`,
				inputName: "Source path",
				inputDesc: "Enter a folder path or .base file path",
				placeholder: "path/to/folder or path/to/file.base",
				submitLabel: "Export",
				onSubmit: (sourcePath) => {
					const sourceType = sourcePath.endsWith(".base") ? "base" as const : "folder" as const;
					this.openExportViewFn?.(sourcePath, sourceType, payload.format);
					void this.eventBus.emit("ui.opened", {
						target: "export",
						timestamp: new Date().toISOString(),
					});
				},
			});
		}
	}
}
