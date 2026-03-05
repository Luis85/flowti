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
import type { ModalService } from "./ModalService";
import { VIEW_TYPE_COMPONENT_SHOWCASE } from "../../ui/components/ComponentShowcaseView";
import { VIEW_TYPE_EVENT_CATALOG } from "../../ui/catalog/EventCatalogView";
import { VIEW_TYPE_EVENT_LOG } from "../../ui/catalog/EventLogView";
import { VIEW_TYPE_DATA_EXCHANGE_HUB } from "../../ui/hub/DataExchangeHubView";
import { VIEW_TYPE_USER_HUB } from "../../ui/userHub/UserHubView";
import { VIEW_TYPE_TRAIN_HUB, VIEW_TYPE_ANALYTICS_HUB, VIEW_TYPE_TEST_MANAGEMENT_HUB } from "../../domain/hub/types";
import { VIEW_TYPE_JOURNEY_BUILDER } from "../../ui/journeyBuilder/JourneyBuilderSidebar";

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
	private modalService?: ModalService;

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

	setModalService(svc: ModalService): void {
		this.modalService = svc;
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
			this.eventBus.on("ui.openUserHub", () =>
				this.openView(VIEW_TYPE_USER_HUB, "userHub", "main"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openTrainHub", () =>
				this.openView(VIEW_TYPE_TRAIN_HUB, "trainHub", "main"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openAnalyticsHub", () =>
				this.openView(VIEW_TYPE_ANALYTICS_HUB, "analyticsHub", "main"),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openJourneyBuilder", () => {
				this.openView(VIEW_TYPE_JOURNEY_BUILDER, "journeyBuilder", "right");
				void this.eventBus.emit("journey-builder.opened", {});
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.openTestManagementHub", () =>
				this.openView(VIEW_TYPE_TEST_MANAGEMENT_HUB, "testManagementHub", "main"),
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
			void workspace.revealLeaf(existing[0]);
		} else if (position === "right") {
			const leaf = workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({ type: viewType, active: true });
				void workspace.revealLeaf(leaf);
			}
		} else {
			const leaf = workspace.getLeaf(true);
			void leaf.setViewState({ type: viewType, active: true });
			void workspace.revealLeaf(leaf);
		}
		void this.eventBus.emit("ui.opened", {
			target,
			timestamp: new Date().toISOString(),
		});
	}

	private handleOpenSubscriptionManager(): void {
		this.modalService?.openSubscriptionManager();
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
			this.modalService?.openInput({
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
			this.modalService?.openInput({
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
