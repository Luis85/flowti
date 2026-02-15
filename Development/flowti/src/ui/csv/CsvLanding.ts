/**
 * Landing page for the CsvActionView.
 * Shows file info dashboard, data snapshot, config usage, associated bases.
 *
 * Large sections are extracted into:
 * - {@link CsvDataSnapshot}
 * - {@link CsvUsageSection}
 * - {@link CsvAssociatedBases}
 */

import { Notice, TFile, setIcon } from "obsidian";
import type { CsvComponentDeps } from "./types";
import { splitCsvLine, formatRelativeTime } from "./csvUtils";
import { ConfigChooserModal } from "../modals";
import { CsvDataSnapshot } from "./CsvDataSnapshot";
import { CsvUsageSection } from "./CsvUsageSection";
import { CsvAssociatedBases } from "./CsvAssociatedBases";

export class CsvLanding {
	private dataSnapshot: CsvDataSnapshot;
	private usageSection: CsvUsageSection;
	private associatedBases: CsvAssociatedBases;

	constructor(
		private container: HTMLElement,
		private deps: CsvComponentDeps,
	) {
		this.associatedBases = new CsvAssociatedBases(deps);
		this.dataSnapshot = new CsvDataSnapshot(deps, () => this.persistDisplaySettings());
		this.usageSection = new CsvUsageSection(deps, {
			persistDisplaySettings: () => this.persistDisplaySettings(),
			refreshAssociatedBases: () => this.associatedBases.refresh(),
		});
	}

	render(): void {
		const el = this.container;
		el.empty();

		const file = this.deps.getFile();
		const data = this.deps.getData();

		// Header section
		const header = el.createDiv({ cls: "ft-csv-header" });
		const iconEl = header.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-spreadsheet");
		const titleCol = header.createDiv();
		titleCol.createEl("h2", { text: file?.basename ?? "CSV File", cls: "ft-heading ft-csv-title" });
		titleCol.createDiv({ text: file?.path ?? "", cls: "ft-text-sm ft-text-muted" });

		// Show description from CsvDoc if it exists
		if (file) {
			const docPath = this.deps.dataExchangeService.resolveCsvDocPath(file.path, (p) => !!this.deps.app.vault.getAbstractFileByPath(p));
			const docFile = this.deps.app.vault.getAbstractFileByPath(docPath);
			if (docFile instanceof TFile) {
				const fm = this.deps.app.metadataCache.getFileCache(docFile)?.frontmatter;
				const desc = fm?.description;
				if (typeof desc === "string" && desc.trim()) {
					titleCol.createDiv({ text: desc, cls: "ft-text-sm ft-text-muted ft-mt-1" });
				}
			}
		}

		// Action buttons
		this.renderActionButtons(el, file);

		// Landing sections: Facts → Docs/CTA → Usage → Bases → Data Snapshot
		if (data?.trim()) {
			this.renderFileInfoDashboard(el);
			this.renderCsvDocSection(el);
			this.usageSection.render(el);
			this.associatedBases.render(el);
			this.dataSnapshot.render(el);
		}
	}

	// ─────────────────────────────────────────────────────────
	// Action buttons
	// ─────────────────────────────────────────────────────────

	private renderActionButtons(el: HTMLElement, file: TFile | null): void {
		const actions = el.createDiv({ cls: "ft-flex ft-gap-2 ft-mb-3" });

		const importBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-input");
		importBtn.appendText(" Import as Notes");
		importBtn.addEventListener("click", () => {
			const matchingConfigs = this.deps.dataExchangeService.getImportConfigsForFile(file!.path);
			if (matchingConfigs.length > 0) {
				new ConfigChooserModal(
					this.deps.app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) {
							const cfg = matchingConfigs.find((c) => c.id === id);
							if (cfg) this.deps.setState({ pendingSavedConfig: cfg });
						}
						void this.deps.startImportWizard(true);
					},
				).open();
			} else {
				void this.deps.startImportWizard();
			}
		});

		// Documentation button
		if (file) {
			const docPath = this.deps.dataExchangeService.resolveCsvDocPath(file.path, (p) => !!this.deps.app.vault.getAbstractFileByPath(p));
			const abstractFile = this.deps.app.vault.getAbstractFileByPath(docPath);
			const docExists = abstractFile instanceof TFile;
			if (docExists) {
				const docBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(docBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-text");
				docBtn.appendText(" Open Documentation");
				docBtn.addEventListener("click", () => {
					void this.deps.app.workspace.openLinkText(docPath, "", false);
				});
			} else {
				const docBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(docBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-plus");
				docBtn.appendText(" Create Documentation");
				docBtn.addEventListener("click", () => this.createCsvDocAndOpen());
			}
		}

		const openBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(openBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "external-link");
		openBtn.appendText(" Open with Default App");
		openBtn.addEventListener("click", () => {
			if (file) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.deps.app as any).openWithDefaultApp(file.path);
				this.deps.detachLeaf();
			}
		});
	}

	// ─────────────────────────────────────────────────────────
	// File info dashboard
	// ─────────────────────────────────────────────────────────

	private renderFileInfoDashboard(container: HTMLElement): void {
		const data = this.deps.getData();
		const state = this.deps.getState();
		const file = this.deps.getFile();

		const lines = data.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return;

		const headers = splitCsvLine(lines[0], state.detectedDelimiter);
		const rowCount = lines.length - 1;

		// Stats row
		const statsRow = container.createDiv({ cls: "ft-flex ft-gap-3 ft-mb-2" });
		const addStat = (label: string, value: string) => {
			const stat = statsRow.createDiv({ cls: "ft-catalog-stat" });
			stat.createDiv({ text: value, cls: "ft-catalog-stat-value" });
			stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
		};
		addStat("Rows", String(rowCount));
		addStat("Columns", String(headers.length));
		const delimLabel = state.detectedDelimiter === "," ? "Comma"
			: state.detectedDelimiter === ";" ? "Semicolon"
			: state.detectedDelimiter === "\t" ? "Tab"
			: state.detectedDelimiter === "|" ? "Pipe"
			: `"${state.detectedDelimiter}"`;
		addStat("Delimiter", delimLabel);
		if (file?.stat) {
			const kb = (file.stat.size / 1024).toFixed(1);
			addStat("Size", `${kb} KB`);
		}
		addStat("Last Import", state.lastImportedAt
			? formatRelativeTime(state.lastImportedAt)
			: "Never");
	}

	// ─────────────────────────────────────────────────────────
	// CSV Doc CTA
	// ─────────────────────────────────────────────────────────

	/** Shows a CTA to create a CSV doc when none exists. Skips if doc already exists. */
	private renderCsvDocSection(container: HTMLElement): void {
		const file = this.deps.getFile();
		if (!file) return;
		const docPath = this.deps.dataExchangeService.resolveCsvDocPath(file.path, (p) => !!this.deps.app.vault.getAbstractFileByPath(p));
		if (this.deps.app.vault.getAbstractFileByPath(docPath)) return;

		const cta = container.createDiv({ cls: "ft-doc-cta ft-mb-3" });
		const icon = cta.createDiv({ cls: "ft-doc-cta-icon" });
		setIcon(icon, "file-plus");
		const text = cta.createDiv();
		text.createDiv({ text: "No documentation yet", cls: "ft-text-sm" }).style.fontWeight = "500";
		text.createDiv({
			text: "Create a doc file to track notes, data sources, and context for this CSV.",
			cls: "ft-text-sm ft-text-muted",
		});
		const ctaBtn = cta.createEl("button", { text: "Create Doc", cls: "ft-btn ft-btn-sm" });
		ctaBtn.addEventListener("click", () => this.createCsvDocAndOpen());
	}

	// ─────────────────────────────────────────────────────────
	// Shared helpers
	// ─────────────────────────────────────────────────────────

	private persistDisplaySettings(): void {
		const file = this.deps.getFile();
		if (!file) return;
		const state = this.deps.getState();
		this.deps.dataExchangeService.saveCsvDisplaySettings(file.path, {
			sortColumn: state.previewSortColumn,
			sortDirection: state.previewSortDir,
			hiddenColumns: [...state.hiddenColumns],
			filterColumn: state.filterColumn,
			filterText: state.filterText,
			maxPreviewRows: state.previewMaxRows,
			lastImportedAt: state.lastImportedAt ?? undefined,
		}).catch((err) => console.error("[Flowti] Failed to persist CSV display settings", err));
	}

	private createCsvDocAndOpen(): void {
		const file = this.deps.getFile();
		const data = this.deps.getData();
		const state = this.deps.getState();
		if (!file) return;
		const csvLines = data.split("\n").filter((l) => l.trim());
		const csvHeaders = csvLines.length > 0 ? splitCsvLine(csvLines[0], state.detectedDelimiter) : [];
		const csvRowCount = Math.max(0, csvLines.length - 1);
		void this.deps.dataExchangeService
			.createCsvDoc(file.path, csvHeaders, csvRowCount, state.detectedDelimiter)
			.then((path) => {
				new Notice("CSV documentation created");
				void this.deps.app.workspace.openLinkText(path, "", false);
			})
			.catch((err) => console.error("[Flowti] Failed to create CSV doc", err));
	}
}
