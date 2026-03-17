/**
 * CSV Action View — thin TextFileView shell.
 *
 * Extends TextFileView so Obsidian opens .csv files in this view.
 * All orchestration is delegated to createCsvOrchestrator().
 */

import { TextFileView, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import type { SavedImportConfig } from "../../domain/dataExchange/types";
import { createCsvOrchestrator } from "../../infrastructure/handlers/leaf-handlers/csv-action-handler";
import type { CsvOrchestrator } from "../../infrastructure/handlers/leaf-handlers/csv-action-handler";

export const VIEW_TYPE_CSV = "flowti-csv";

export class CsvActionView extends TextFileView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private autoStartImport: boolean;
	private orchestrator: CsvOrchestrator | null = null;
	private openHubImportConfigCb: ((configId: string) => void) | null = null;
	private getQueriesBySourceCb: ((csvPath: string) => import("../../domain/analytics/types").SavedAnalyticsQuery[]) | null = null;
	private openAnalyticsHubCb: ((tabId: string, entityId: string) => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		autoStartImport = false,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.autoStartImport = autoStartImport;
	}

	// ── Public API ──────────────────────────────────────────

	setOpenHubImportConfig(cb: (configId: string) => void): void {
		this.openHubImportConfigCb = cb;
	}

	setSavedConfig(config: SavedImportConfig): void {
		this.orchestrator?.setSavedConfig(config);
	}

	setGetQueriesBySource(cb: (csvPath: string) => import("../../domain/analytics/types").SavedAnalyticsQuery[]): void {
		this.getQueriesBySourceCb = cb;
	}

	setOpenAnalyticsHub(cb: (tabId: string, entityId: string) => void): void {
		this.openAnalyticsHubCb = cb;
	}

	// ── TextFileView lifecycle ──────────────────────────────

	getViewType(): string { return VIEW_TYPE_CSV; }
	getDisplayText(): string { return this.file?.basename ?? "CSV File"; }
	getIcon(): string { return "file-spreadsheet"; }
	getViewData(): string { return this.data; }

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		if (clear) this.clear();
		this.ensureOrchestrator();
		const autoStart = this.autoStartImport;
		this.autoStartImport = false;
		this.orchestrator!.onDataChanged(data, autoStart);
	}

	clear(): void {
		this.orchestrator?.destroy();
		this.orchestrator = null;
		this.contentEl.empty();
	}

	async onClose(): Promise<void> {
		this.orchestrator?.destroy();
		this.orchestrator = null;
	}

	// ── Orchestrator setup ──────────────────────────────────

	private ensureOrchestrator(): void {
		if (this.orchestrator) return;
		this.orchestrator = createCsvOrchestrator(this.contentEl, {
			eventBus: this.eventBus,
			dataExchangeService: this.dataExchangeService,
			app: this.app,
			getFile: () => this.file,
			getData: () => this.data,
			detachLeaf: () => this.leaf.detach(),
			openHubImportConfig: this.openHubImportConfigCb ?? undefined,
			getQueriesBySource: this.getQueriesBySourceCb ?? undefined,
			openAnalyticsHub: this.openAnalyticsHubCb ?? undefined,
		});
	}
}
