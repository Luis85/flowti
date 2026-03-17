/**
 * Usage section for the CsvLanding page.
 * Shows import config usage, inline import execution with progress/result display.
 */

import { setIcon } from "obsidian";
import type { ImportResult, SavedImportConfig } from "../../domain/dataExchange/types";
import type { CsvComponentDeps } from "./types";

export class CsvUsageSection {
	private usageProgressEl: HTMLElement | null = null;

	constructor(
		private deps: CsvComponentDeps,
		private options: {
			persistDisplaySettings: () => void;
			refreshAssociatedBases: () => void;
		},
	) {}

	render(container: HTMLElement): void {
		const file = this.deps.getFile();
		if (!file) return;

		const importConfigs = this.deps.dataExchangeService.getImportConfigsForFile(file.path);

		const section = container.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Usage", cls: "ft-heading ft-heading-sm ft-mb-2" });

		if (importConfigs.length > 0) {
			const importCard = section.createDiv({ cls: "ft-card ft-mb-2" });
			const importHeader = importCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const importIcon = importHeader.createSpan();
			setIcon(importIcon, "file-input");
			importIcon.addClass("ft-icon-muted");
			importHeader.createSpan({ text: "Used by import", cls: "ft-text-sm ft-font-medium" });
			for (const cfg of importConfigs) {
				this.renderImportConfigRow(importCard, cfg);
			}
		} else {
			const emptyCard = section.createDiv({ cls: "ft-card ft-mb-2" });
			emptyCard.createDiv({
				text: "No saved import configurations reference this file yet.",
				cls: "ft-text-sm ft-text-muted ft-mb-2",
			});
			const actionsRow = emptyCard.createDiv({ cls: "ft-flex ft-gap-2" });
			const importBtn = actionsRow.createEl("span", { cls: "ft-nav-link" });
			setIcon(importBtn.createSpan(), "file-input");
			importBtn.appendText(" Create Import Config");
			importBtn.addEventListener("click", () => {
				void this.deps.startImportWizard();
			});
		}

		// Progress area for inline import execution
		this.usageProgressEl = section.createDiv();
	}

	private renderImportConfigRow(container: HTMLElement, cfg: SavedImportConfig): void {
		const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		const nameLink = row.createEl("span", {
			text: cfg.name,
			cls: "ft-nav-link ft-text-sm",
		});
		nameLink.addClass("ft-font-medium");
		nameLink.addEventListener("click", () => this.deps.openHubImportConfig(cfg.id));
		row.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
		row.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });

		// Preview button
		const previewBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(previewBtn.createSpan(), "eye");
		previewBtn.appendText(" Preview");
		previewBtn.addEventListener("click", () => {
			this.deps.setState({ pendingSavedConfig: cfg });
			void this.deps.startImportWizard(true);
		});

		// Execute button
		const runBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(runBtn.createSpan(), "play");
		runBtn.appendText(" Run");
		runBtn.addEventListener("click", () => {
			this.executeImportFromUsage(cfg);
		});
	}

	private executeImportFromUsage(cfg: SavedImportConfig): void {
		if (!cfg.sourcePath) return;

		// Show initial progress UI
		this.renderUsageProgress(cfg.name, 0, 0);

		void this.deps.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: cfg.sourcePath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: cfg.customProperties,
			},
		});

		const offProgress = this.deps.eventBus.on("dataExchange.import.progress", (event) => {
			this.renderUsageProgress(cfg.name, event.payload.current, event.payload.total);
		});

		const offComplete = this.deps.eventBus.on("dataExchange.import.completed", (event) => {
			offProgress(); offComplete(); offFailed();
			const r = event.payload.result;
			this.renderUsageResult(r);
			// Record last import timestamp
			this.deps.setState({ lastImportedAt: Date.now() });
			this.options.persistDisplaySettings();
			// Refresh bases section so newly created .base files appear
			setTimeout(() => this.options.refreshAssociatedBases(), 500);
			void this.deps.eventBus.emit("notice.success", {
				message: `Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			});
		});
		const offFailed = this.deps.eventBus.on("dataExchange.import.failed", (event) => {
			offProgress(); offComplete(); offFailed();
			this.renderUsageError(event.payload.error);
			void this.deps.eventBus.emit("notice.error", { message: `Import failed: ${event.payload.error}` });
		});
	}

	private renderUsageProgress(name: string, current: number, total: number): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-card ft-mb-2" });
		const wrapper = card.createDiv({ cls: "ft-flex-col ft-gap-2" });
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const spinIcon = header.createSpan();
		setIcon(spinIcon, "loader");
		spinIcon.addClass("ft-icon-muted");
		header.createSpan({ text: `Running import: ${name}`, cls: "ft-text-sm ft-font-medium" });

		wrapper.createDiv({
			text: total > 0 ? `Processing row ${current} of ${total}...` : "Starting import...",
			cls: "ft-text-sm ft-text-muted",
		});

		const bar = wrapper.createDiv({ cls: "ft-progress-bar" });
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		const pct = total > 0 ? (current / total) * 100 : 0;
		fill.style.width = `${pct}%`;
	}

	private renderUsageResult(result: ImportResult): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-card ft-mb-2" });
		const wrapper = card.createDiv({ cls: "ft-flex-col ft-gap-2" });
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const checkIcon = header.createSpan();
		setIcon(checkIcon, "check-circle");
		checkIcon.addClass("ft-icon-muted");
		header.createSpan({ text: "Import Complete", cls: "ft-text-sm ft-font-medium" });
		header.createDiv({ cls: "ft-flex-1" });
		const dismissBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(dismissBtn, "x");
		dismissBtn.addEventListener("click", () => { this.usageProgressEl?.empty(); });

		const stats = wrapper.createDiv({ cls: "ft-flex ft-gap-2" });
		stats.createSpan({ text: `${result.created} created`, cls: "ft-badge ft-badge-muted" });
		stats.createSpan({ text: `${result.updated} updated`, cls: "ft-badge ft-badge-muted" });
		stats.createSpan({ text: `${result.skipped} skipped`, cls: "ft-badge ft-badge-muted" });
		if (result.failed > 0) {
			stats.createSpan({ text: `${result.failed} failed`, cls: "ft-badge ft-badge-accent" });
		}
	}

	private renderUsageError(error: string): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-alert-error ft-p-3 ft-mb-2" });
		const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		cardHeader.createEl("strong", { text: "Import failed: " });
		cardHeader.createSpan({ text: error });
		cardHeader.createDiv({ cls: "ft-flex-1" });
		const dismissBtn = cardHeader.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(dismissBtn, "x");
		dismissBtn.addEventListener("click", () => { this.usageProgressEl?.empty(); });
	}
}
