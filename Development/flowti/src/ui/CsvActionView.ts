/**
 * CSV Action View for Flowti.
 *
 * Registered as the handler for `.csv` files. When the user clicks a CSV
 * in the file explorer, the landing page shows file info, column chips, and
 * a data snapshot. "Import as Notes" transitions to a full-width wizard with
 * a horizontal stepper, split config layout, and scrollable preview.
 */

import { Notice, Setting, TextFileView, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type { ImportService } from "../domain/dataExchange/ImportService";
import type {
	ColumnMapping,
	ConflictStrategy,
	ImportResult,
	ParsedCsv,
	SavedImportConfig,
} from "../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";
import { ConfirmModal, ConfigChooserModal, InputModal } from "./modals";

export const VIEW_TYPE_CSV = "flowti-csv";

type CsvPage = "landing" | "config" | "preview" | "result";

const STEP_LABELS: Record<string, string> = {
	config: "Configure",
	preview: "Preview",
	result: "Import",
};

export class CsvActionView extends TextFileView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private autoStartImport: boolean;
	private openHubImportConfigCb: ((configId: string) => void) | null = null;

	// Import wizard state
	private currentPage: CsvPage = "landing";
	private importService: ImportService | null = null;
	private parsedCsv: ParsedCsv | null = null;
	private parseError: string | null = null;
	private targetFolder = "";
	private nameColumn = "";
	private namePrefix = "";
	private nameSuffix = "";
	private columnMappings: ColumnMapping[] = [];
	private conflictStrategy: ConflictStrategy = "skip";
	private importResult: ImportResult | null = null;
	private importError: string | null = null;
	private importProgress = { current: 0, total: 0 };
	private createBase = false;
	private basePath = "";
	private savedConfigs: SavedImportConfig[] = [];
	private pendingSavedConfig: SavedImportConfig | null = null;
	private unsubscribes: (() => void)[] = [];
	private columnSearchText = "";
	private configDropdownOpen = false;
	private customProperties: Record<string, string> = {};
	private usageProgressEl: HTMLElement | null = null;
	private basesContainerEl: HTMLElement | null = null;
	private unsavedHintEl: HTMLElement | null = null;
	private loadedConfigId: string | null = null;

	// Detected CSV delimiter (auto-detected from content)
	private detectedDelimiter = ",";

	// Landing page data snapshot state
	private previewSortColumn: string | null = null;
	private previewSortDir: "asc" | "desc" = "asc";
	private hiddenColumns: string[] = [];
	private filterColumn: string | null = null;
	private filterText = "";
	private previewMaxRows = 100;
	private lastImportedAt: number | null = null;

	// Persistent DOM references (created once in setViewData)
	private rootEl: HTMLElement | null = null;
	private topBarEl: HTMLElement | null = null;
	private landingEl: HTMLElement | null = null;
	private workspaceEl: HTMLElement | null = null;

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

	/** Sets the callback for navigating to the Data Exchange Hub import config page. */
	setOpenHubImportConfig(cb: (configId: string) => void): void {
		this.openHubImportConfigCb = cb;
	}

	getViewType(): string {
		return VIEW_TYPE_CSV;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "CSV File";
	}

	getIcon(): string {
		return "file-spreadsheet";
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		if (clear) this.clear();

		// BUG FIX: When the user switches to another CSV file via the file navigator,
		// setViewData is called with the new file's data. If we were mid-wizard,
		// reset everything so the user sees the fresh landing page for the new file.
		if (this.currentPage !== "landing") {
			this.resetImportState();
			this.currentPage = "landing";
		}

		// Auto-detect delimiter for landing page data snapshot
		if (data) this.detectedDelimiter = this.detectDelimiter(data);

		// Load persisted display settings for this CSV file
		this.loadDisplaySettings();

		if (this.autoStartImport) {
			this.autoStartImport = false;
			void this.startImportWizard();
		} else {
			this.renderContent();
		}
	}

	clear(): void {
		this.contentEl.empty();
		this.rootEl = null;
		this.topBarEl = null;
		this.landingEl = null;
		this.workspaceEl = null;
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	/** Pre-apply a saved import config when the wizard starts (skips to preview). */
	setSavedConfig(config: SavedImportConfig): void {
		this.pendingSavedConfig = config;
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
		this.renderTopBar();

		// Landing page container
		this.landingEl = this.rootEl.createDiv({ cls: "ft-view-landing" });

		// Workspace container (for wizard pages)
		this.workspaceEl = this.rootEl.createDiv({ cls: "ft-view-workspace ft-hidden" });
	}

	// ── Page router ─────────────────────────────────────────

	private renderContent(): void {
		this.ensureRoot();

		const isLanding = this.currentPage === "landing";
		this.topBarEl!.classList.toggle("ft-hidden", isLanding);
		this.landingEl!.classList.toggle("ft-hidden", !isLanding);
		this.workspaceEl!.classList.toggle("ft-hidden", isLanding);

		if (!isLanding) {
			this.updateStepperState();
		}

		switch (this.currentPage) {
			case "landing":
				this.renderLanding();
				break;
			case "config":
				this.renderConfigPage();
				break;
			case "preview":
				this.renderPreviewPage();
				break;
			case "result":
				this.renderResultPage();
				break;
		}
	}

	// ── Top bar with stepper ────────────────────────────────

	private renderTopBar(): void {
		const bar = this.topBarEl!;
		bar.empty();

		// ── Row 1: File header (same design as landing page) ──
		const headerRow = bar.createDiv({ cls: "ft-csv-header" });
		headerRow.style.marginBottom = "0";
		const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-spreadsheet");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const nameEl = titleRow.createEl("h2", {
			text: this.file?.basename ?? "CSV File",
			cls: "ft-heading ft-csv-title",
		});
		nameEl.style.cursor = "pointer";
		nameEl.addEventListener("click", () => {
			this.resetImportState();
			this.currentPage = "landing";
			this.renderContent();
		});
		titleRow.createSpan({
			text: "Import",
			cls: "ft-operation-badge ft-operation-badge-import",
		});

		// Loaded config indicator
		if (this.loadedConfigId) {
			const cfg = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
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
		subtitle.createSpan({ text: this.file?.path ?? "", cls: "ft-text-sm ft-text-muted" });
		if (this.parsedCsv) {
			subtitle.createSpan({
				text: `${this.parsedCsv.rowCount} rows`,
				cls: "ft-badge ft-badge-muted",
			});
			subtitle.createSpan({
				text: `${this.parsedCsv.headers.length} cols`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		// ── Row 2: Stepper + config dropdown ──
		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		const stepBar = stepRow.createDiv({ cls: "ft-step-bar" });
		const steps: CsvPage[] = ["config", "preview", "result"];
		const pageOrder: CsvPage[] = ["config", "preview", "result"];

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			const stepEl = stepBar.createDiv({ cls: "ft-step-indicator" });

			const stepIdx = pageOrder.indexOf(this.currentPage);
			const thisIdx = i;
			let stateClass = "ft-step-pending";
			if (thisIdx < stepIdx) stateClass = "ft-step-completed";
			else if (thisIdx === stepIdx) stateClass = "ft-step-running";
			if (step === "result" && this.importResult) stateClass = "ft-step-completed";
			if (step === "result" && this.importError) stateClass = "ft-step-failed";

			stepEl.addClass(stateClass);

			const stepIconEl = stepEl.createDiv({ cls: "ft-step-icon" });
			stepIconEl.textContent = String(i + 1);

			stepEl.createSpan({
				text: STEP_LABELS[step],
				cls: "ft-step-label",
			});

			// Allow clicking completed steps for backward navigation
			if (thisIdx < stepIdx) {
				stepEl.style.cursor = "pointer";
				const targetPage = step;
				stepEl.addEventListener("click", () => {
					this.currentPage = targetPage;
					this.renderContent();
				});
			}

			// Arrow separator
			if (i < steps.length - 1) {
				stepBar.createSpan({
					text: "\u203A",
					cls: "ft-text-muted",
				}).style.margin = "0 0.25rem";
			}
		}

		// Spacer
		stepRow.createDiv().style.flex = "1";

		// Save button (only when unsaved changes exist)
		if (this.hasUnsavedChanges()) {
			const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
			setIcon(saveBtn.createSpan(), "save");
			saveBtn.appendText(" Save");
			saveBtn.addEventListener("click", () => this.promptSaveConfig());
		}

		// Config dropdown
		this.renderConfigDropdownButton(stepRow);
	}

	private updateStepperState(): void {
		// Re-render top bar to update stepper states
		this.renderTopBar();
	}

	// ── Config dropdown ─────────────────────────────────────

	private renderConfigDropdownButton(bar: HTMLElement): void {
		const wrapper = bar.createDiv({ cls: "ft-config-dropdown" });
		const btn = wrapper.createEl("span", { cls: "ft-nav-link" });
		const btnIcon = btn.createSpan();
		setIcon(btnIcon, "settings-2");
		btn.appendText(" Configs");

		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.configDropdownOpen = !this.configDropdownOpen;
			const existingMenu = wrapper.querySelector(".ft-config-dropdown-menu");
			if (existingMenu) {
				existingMenu.remove();
				this.configDropdownOpen = false;
				return;
			}
			this.renderConfigDropdownMenu(wrapper);
		});
	}

	private renderConfigDropdownMenu(wrapper: HTMLElement): void {
		const menu = wrapper.createDiv({ cls: "ft-config-dropdown-menu" });

		// Save current config
		const saveItem = menu.createDiv({ cls: "ft-config-dropdown-item" });
		const saveIcon = saveItem.createSpan();
		setIcon(saveIcon, "save");
		saveItem.appendText(" Save Config...");
		saveItem.addEventListener("click", () => {
			menu.remove();
			this.configDropdownOpen = false;
			this.promptSaveConfig();
		});

		// Only show configs that reference this CSV file
		const fileConfigs = this.savedConfigs.filter(
			(c) => c.sourcePath === this.file?.path,
		);

		if (fileConfigs.length > 0) {
			menu.createDiv({ cls: "ft-config-dropdown-divider" });

			for (const cfg of fileConfigs) {
				const item = menu.createDiv({ cls: "ft-config-dropdown-item" });
				item.createSpan({ text: cfg.name }).style.flex = "1";
				item.addEventListener("click", () => {
					menu.remove();
					this.configDropdownOpen = false;
					this.applySavedImportConfig(cfg.id);
					this.renderContent();
				});
			}
		}

		// Close on outside click
		const closeHandler = (e: MouseEvent) => {
			if (!wrapper.contains(e.target as Node)) {
				menu.remove();
				this.configDropdownOpen = false;
				document.removeEventListener("click", closeHandler);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler), 0);
	}

	private promptSaveConfig(): void {
		// Prefill with loaded config name, then file basename, then generic
		let defaultName = "My import config";
		if (this.loadedConfigId) {
			const loaded = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
			if (loaded) defaultName = loaded.name;
		} else if (this.file?.basename) {
			defaultName = this.file.basename;
		}

		new InputModal(this.app, {
			title: "Save Import Config",
			inputName: "Config name",
			inputDesc: "A descriptive name for this import configuration",
			placeholder: "My import config",
			defaultValue: defaultName,
			submitLabel: "Save",
			onSubmit: (name) => {
				const configData = {
					name,
					sourcePath: this.file?.path,
					targetFolder: this.targetFolder,
					nameColumn: this.nameColumn,
					namePrefix: this.namePrefix || undefined,
					nameSuffix: this.nameSuffix || undefined,
					columnMappings: [...this.columnMappings],
					conflictStrategy: this.conflictStrategy,
					customProperties: Object.keys(this.customProperties).length > 0
						? { ...this.customProperties }
						: undefined,
					createBase: this.createBase || undefined,
					basePath: this.basePath || undefined,
				};

				const existing = this.dataExchangeService
					.getSavedImportConfigs()
					.find((c) => c.name === name);

				if (existing) {
					new ConfirmModal(this.app, {
						message: `A config named "${name}" already exists. Update it?`,
						confirmLabel: "Update",
						onConfirm: () => {
							void this.dataExchangeService
								.updateImportConfig(existing.id, configData)
								.then((updated) => {
									this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
									this.loadedConfigId = existing.id;
									new Notice(`Config updated: ${updated?.name ?? name}`);
									this.renderConfigPage();
								})
								.catch((err) =>
									console.error("[Flowti] Failed to update import config", err),
								);
						},
					}).open();
					return;
				}

				void this.dataExchangeService
					.saveImportConfig(configData)
					.then((saved) => {
						this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
						this.loadedConfigId = saved.id;
						new Notice(`Config saved: ${saved.name}`);
						this.renderConfigPage();
					})
					.catch((err) =>
						console.error("[Flowti] Failed to save import config", err),
					);
			},
		}).open();
	}

	// ── Landing page ────────────────────────────────────────

	private renderLanding(): void {
		const el = this.landingEl!;
		el.empty();

		// Header section — left-aligned
		const header = el.createDiv({ cls: "ft-csv-header" });
		const iconEl = header.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-spreadsheet");
		const titleCol = header.createDiv();
		titleCol.createEl("h2", { text: this.file?.basename ?? "CSV File", cls: "ft-heading ft-csv-title" });
		titleCol.createDiv({ text: this.file?.path ?? "", cls: "ft-text-sm ft-text-muted" });

		// Show description from CsvDoc if it exists
		if (this.file) {
			const docPath = this.dataExchangeService.getCsvDocPath(this.file.path);
			const docFile = this.app.vault.getAbstractFileByPath(docPath);
			if (docFile instanceof TFile) {
				const fm = this.app.metadataCache.getFileCache(docFile)?.frontmatter;
				const desc = fm?.description;
				if (typeof desc === "string" && desc.trim()) {
					titleCol.createDiv({ text: desc, cls: "ft-text-sm ft-text-muted ft-mt-1" });
				}
			}
		}

		// Action buttons
		const actions = el.createDiv({ cls: "ft-flex ft-gap-2 ft-mb-3" });

		const importBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-input");
		importBtn.appendText(" Import as Notes");
		importBtn.addEventListener("click", () => {
			const matchingConfigs = this.dataExchangeService.getImportConfigsForFile(this.file!.path);
			if (matchingConfigs.length > 0) {
				new ConfigChooserModal(
					this.app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) {
							const cfg = matchingConfigs.find((c) => c.id === id);
							if (cfg) this.pendingSavedConfig = cfg;
						}
						void this.startImportWizard(true);
					},
				).open();
			} else {
				void this.startImportWizard();
			}
		});

		// Documentation button
		if (this.file) {
			const docPath = this.dataExchangeService.getCsvDocPath(this.file.path);
			const abstractFile = this.app.vault.getAbstractFileByPath(docPath);
			const docExists = abstractFile instanceof TFile;
			if (docExists) {
				const docBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(docBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-text");
				docBtn.appendText(" Open Documentation");
				docBtn.addEventListener("click", () => {
					void this.app.workspace.openLinkText(docPath, "", false);
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
			if (this.file) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.app as any).openWithDefaultApp(this.file.path);
				this.leaf.detach();
			}
		});

		// Landing sections: Facts → Docs/CTA → Usage → Bases → Data Snapshot
		if (this.data?.trim()) {
			this.renderFileInfoDashboard(el);
			this.renderCsvDocSection(el);
			this.renderConfigUsage(el);
			this.renderAssociatedBases(el);
			this.renderDataSnapshot(el);
		}
	}

	private renderFileInfoDashboard(container: HTMLElement): void {
		const lines = this.data.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return;

		const headers = this.splitCsvLine(lines[0]);
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
		const delimLabel = this.detectedDelimiter === "," ? "Comma"
			: this.detectedDelimiter === ";" ? "Semicolon"
			: this.detectedDelimiter === "\t" ? "Tab"
			: this.detectedDelimiter === "|" ? "Pipe"
			: `"${this.detectedDelimiter}"`;
		addStat("Delimiter", delimLabel);
		if (this.file?.stat) {
			const kb = (this.file.stat.size / 1024).toFixed(1);
			addStat("Size", `${kb} KB`);
		}
		addStat("Last Import", this.lastImportedAt
			? this.formatRelativeTime(this.lastImportedAt)
			: "Never");

	}

	// Stable DOM refs for data snapshot (survive table re-renders)
	private previewBadgeEl: HTMLElement | null = null;
	private previewHiddenBadgeEl: HTMLElement | null = null;
	private previewResetEl: HTMLElement | null = null;
	private previewTableAreaEl: HTMLElement | null = null;
	private cachedAllHeaders: string[] = [];
	private cachedAllRows: string[][] = [];

	private renderDataSnapshot(container: HTMLElement): void {
		const lines = this.data.split("\n").filter((l) => l.trim());
		if (lines.length < 2) return;

		this.cachedAllHeaders = this.splitCsvLine(lines[0]);
		this.cachedAllRows = lines.slice(1).map((l) => this.splitCsvLine(l));

		// Heading + row count badge + reset button (built once)
		const headingRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headingRow.createEl("h3", { text: "Data Snapshot", cls: "ft-heading ft-heading-sm" });
		this.previewBadgeEl = headingRow.createSpan({ cls: "ft-badge ft-badge-muted" });
		this.previewHiddenBadgeEl = headingRow.createSpan({ cls: "ft-badge ft-badge-muted" });
		// Reset columns button (shown/hidden dynamically by updatePreviewTable)
		this.previewResetEl = headingRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(this.previewResetEl.createSpan(), "rotate-ccw");
		this.previewResetEl.appendText(" Reset");
		this.previewResetEl.style.display = "none";
		this.previewResetEl.addEventListener("click", () => {
			this.hiddenColumns = [];
			this.persistDisplaySettings();
			this.renderContent();
		});

		// Column chips (clickable to toggle visibility)
		if (this.cachedAllHeaders.length > 0) {
			const chipContainer = container.createDiv({ cls: "ft-flex ft-gap-1 ft-mb-2" });
			chipContainer.style.flexWrap = "wrap";
			for (const h of this.cachedAllHeaders) {
				const isHidden = this.hiddenColumns.includes(h);
				const chip = chipContainer.createSpan({
					text: h,
					cls: `ft-badge ft-badge-muted ft-column-chip${isHidden ? " ft-column-hidden" : ""}`,
				});
				chip.addEventListener("click", () => {
					if (this.hiddenColumns.includes(h)) {
						this.hiddenColumns = this.hiddenColumns.filter((c) => c !== h);
						chip.removeClass("ft-column-hidden");
					} else {
						this.hiddenColumns.push(h);
						chip.addClass("ft-column-hidden");
					}
					this.persistDisplaySettings();
					this.updatePreviewTable();
				});
			}
		}

		// Single-row filter bar (built once — survives table re-renders)
		const filterBar = container.createDiv({ cls: "ft-preview-filter-bar" });
		const filterLabel = filterBar.createSpan({ text: "Filter:", cls: "ft-text-sm ft-text-muted" });
		filterLabel.style.flexShrink = "0";
		const select = filterBar.createEl("select");
		const allOpt = select.createEl("option", { text: "All columns" });
		allOpt.value = "";
		for (const h of this.cachedAllHeaders) {
			const opt = select.createEl("option", { text: h });
			opt.value = h;
			if (this.filterColumn === h) opt.selected = true;
		}
		select.addEventListener("change", () => {
			this.filterColumn = select.value || null;
			this.persistDisplaySettings();
			this.updatePreviewTable();
		});
		const filterInput = filterBar.createEl("input", { type: "text" });
		filterInput.placeholder = "Type to filter rows...";
		filterInput.value = this.filterText;
		filterInput.addEventListener("input", () => {
			this.filterText = filterInput.value;
			this.persistDisplaySettings();
			this.updatePreviewTable();
		});

		// Table area (re-rendered on sort/filter/column toggle changes)
		this.previewTableAreaEl = container.createDiv();
		this.updatePreviewTable();
	}

	/** Re-renders only the table + badges, keeping filter bar and heading stable. */
	private updatePreviewTable(): void {
		if (!this.previewTableAreaEl) return;
		this.previewTableAreaEl.empty();

		const allHeaders = this.cachedAllHeaders;
		const allRows = this.cachedAllRows;

		// Determine visible column indices
		const visibleIndices: number[] = [];
		const visibleHeaders: string[] = [];
		for (let i = 0; i < allHeaders.length; i++) {
			if (!this.hiddenColumns.includes(allHeaders[i])) {
				visibleIndices.push(i);
				visibleHeaders.push(allHeaders[i]);
			}
		}

		// Apply single-column filter
		let filteredRows = allRows;
		const ft = this.filterText.toLowerCase();
		if (ft) {
			if (this.filterColumn !== null) {
				const filterIdx = allHeaders.indexOf(this.filterColumn);
				if (filterIdx >= 0) {
					filteredRows = filteredRows.filter((row) =>
						(row[filterIdx] ?? "").toLowerCase().includes(ft),
					);
				}
			} else {
				filteredRows = filteredRows.filter((row) =>
					row.some((cell) => (cell ?? "").toLowerCase().includes(ft)),
				);
			}
		}

		// Apply sort (numeric-aware via localeCompare with numeric option)
		if (this.previewSortColumn !== null) {
			const sortIdx = allHeaders.indexOf(this.previewSortColumn);
			if (sortIdx >= 0) {
				const dir = this.previewSortDir === "asc" ? 1 : -1;
				filteredRows = [...filteredRows].sort((a, b) =>
					(a[sortIdx] ?? "").localeCompare(b[sortIdx] ?? "", undefined, { numeric: true }) * dir,
				);
			}
		}

		const totalFiltered = filteredRows.length;
		const displayRows = filteredRows.slice(0, this.previewMaxRows);

		// Update badges
		if (this.previewBadgeEl) {
			this.previewBadgeEl.textContent = totalFiltered < allRows.length
				? `${totalFiltered} rows (filtered from ${allRows.length})`
				: `${allRows.length} rows`;
		}
		if (this.previewHiddenBadgeEl) {
			if (this.hiddenColumns.length > 0) {
				this.previewHiddenBadgeEl.textContent = `${this.hiddenColumns.length} hidden`;
				this.previewHiddenBadgeEl.style.display = "";
			} else {
				this.previewHiddenBadgeEl.style.display = "none";
			}
		}
		if (this.previewResetEl) {
			this.previewResetEl.style.display = this.hiddenColumns.length > 0 ? "" : "none";
		}

		const tableWrap = this.previewTableAreaEl.createDiv({ cls: "flowti-csv-preview" });
		const table = tableWrap.createEl("table");

		// Header row with sort controls (visible columns only)
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of visibleHeaders) {
			const th = headerRow.createEl("th", { cls: "ft-preview-sortable-th" });
			th.style.cursor = "pointer";
			th.style.userSelect = "none";
			const label = th.createSpan({ text: h });
			if (this.previewSortColumn === h) {
				label.appendText(this.previewSortDir === "asc" ? " \u25B2" : " \u25BC");
			}
			th.addEventListener("click", () => {
				if (this.previewSortColumn === h) {
					// 3-click cycle: asc → desc → reset
					if (this.previewSortDir === "asc") {
						this.previewSortDir = "desc";
					} else {
						this.previewSortColumn = null;
						this.previewSortDir = "asc";
					}
				} else {
					this.previewSortColumn = h;
					this.previewSortDir = "asc";
				}
				this.persistDisplaySettings();
				this.updatePreviewTable();
			});
		}

		// Data rows (visible columns only)
		const tbody = table.createEl("tbody");
		for (const row of displayRows) {
			const tr = tbody.createEl("tr");
			for (const ci of visibleIndices) {
				tr.createEl("td", { text: row[ci] ?? "" });
			}
		}

		if (totalFiltered > this.previewMaxRows) {
			this.previewTableAreaEl.createEl("p", {
				cls: "flowti-csv-more",
				text: `Showing first ${this.previewMaxRows} of ${totalFiltered} rows`,
			});
		}
	}

	private persistDisplaySettings(): void {
		if (!this.file) return;
		this.dataExchangeService.saveCsvDisplaySettings(this.file.path, {
			sortColumn: this.previewSortColumn,
			sortDirection: this.previewSortDir,
			hiddenColumns: [...this.hiddenColumns],
			filterColumn: this.filterColumn,
			filterText: this.filterText,
			maxPreviewRows: this.previewMaxRows,
			lastImportedAt: this.lastImportedAt ?? undefined,
		}).catch((err) => console.error("[Flowti] Failed to persist CSV display settings", err));
	}

	private loadDisplaySettings(): void {
		if (!this.file) return;
		const settings = this.dataExchangeService.getCsvDisplaySettings(this.file.path);
		if (settings) {
			this.previewSortColumn = settings.sortColumn;
			this.previewSortDir = settings.sortDirection;
			this.hiddenColumns = settings.hiddenColumns ?? [];
			this.filterColumn = settings.filterColumn ?? null;
			this.filterText = settings.filterText ?? "";
			this.previewMaxRows = settings.maxPreviewRows;
			this.lastImportedAt = settings.lastImportedAt ?? null;
		}
	}

	/** Shows a CTA to create a CSV doc when none exists. Skips if doc already exists. */
	private renderCsvDocSection(container: HTMLElement): void {
		if (!this.file) return;
		const docPath = this.dataExchangeService.getCsvDocPath(this.file.path);
		if (this.app.vault.getAbstractFileByPath(docPath)) return;

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

	/** Shows how this CSV is used across saved import configs. */
	private renderConfigUsage(container: HTMLElement): void {
		if (!this.file) return;

		const importConfigs = this.dataExchangeService.getImportConfigsForFile(this.file.path);

		const section = container.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Usage", cls: "ft-heading ft-heading-sm ft-mb-2" });

		if (importConfigs.length > 0) {
			const importCard = section.createDiv({ cls: "ft-card ft-mb-2" });
			const importHeader = importCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const importIcon = importHeader.createSpan();
			setIcon(importIcon, "file-input");
			importIcon.style.opacity = "0.5";
			importHeader.createSpan({ text: "Used by import", cls: "ft-text-sm" }).style.fontWeight = "500";
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
				void this.startImportWizard();
			});
		}

		// Progress area for inline import execution
		this.usageProgressEl = section.createDiv();
	}

	/** Finds .base files whose inFolder filter matches any import config target folder. */
	private findAssociatedBases(): { path: string; name: string }[] {
		if (!this.file) return [];
		const configs = this.dataExchangeService.getImportConfigsForFile(this.file.path);
		const targetFolders = new Set(configs.map((c) => c.targetFolder).filter(Boolean));

		// Collect explicit basePath entries from configs
		const explicitPaths = new Set<string>();
		for (const cfg of configs) {
			if (cfg.basePath) {
				let bp = cfg.basePath.trim();
				if (bp && !bp.endsWith(".base")) bp += ".base";
				if (bp) explicitPaths.add(bp);
			}
		}

		if (targetFolders.size === 0 && explicitPaths.size === 0) return [];

		const results: { path: string; name: string }[] = [];
		const seen = new Set<string>();
		const allFiles = this.app.vault.getFiles();
		for (const f of allFiles) {
			if (!f.path.endsWith(".base")) continue;
			if (seen.has(f.path)) continue;

			// Direct match from config basePath
			if (explicitPaths.has(f.path)) {
				results.push({ path: f.path, name: f.basename });
				seen.add(f.path);
				continue;
			}

			// Check if the base file lives in or next to a target folder
			for (const folder of targetFolders) {
				const baseDir = f.path.substring(0, f.path.lastIndexOf("/"));
				if (baseDir === folder || f.path.startsWith(folder + "/")) {
					results.push({ path: f.path, name: f.basename });
					seen.add(f.path);
					break;
				}
			}
		}
		return results;
	}

	/** Shows associated .base view files on the landing page. */
	private renderAssociatedBases(container: HTMLElement): void {
		// Persistent wrapper so we can refresh after import
		if (!this.basesContainerEl || !this.basesContainerEl.isConnected) {
			this.basesContainerEl = container.createDiv();
		}
		this.basesContainerEl.empty();

		const bases = this.findAssociatedBases();
		if (bases.length === 0) return;

		const section = this.basesContainerEl.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Associated Views", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const card = section.createDiv({ cls: "ft-card ft-mb-2" });
		const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		const iconEl = cardHeader.createSpan();
		setIcon(iconEl, "table");
		iconEl.style.opacity = "0.5";
		cardHeader.createSpan({ text: "Base views", cls: "ft-text-sm" }).style.fontWeight = "500";

		for (const base of bases) {
			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const link = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const linkIcon = link.createSpan();
			setIcon(linkIcon, "file-code");
			link.appendText(` ${base.name}`);
			link.addEventListener("click", () => {
				void this.app.workspace.openLinkText(base.path, "", false);
			});
			row.createSpan({ text: base.path, cls: "ft-text-sm ft-text-muted" });
		}
	}

	/** Refreshes the associated bases section without re-rendering the full landing page. */
	private refreshAssociatedBases(): void {
		if (this.basesContainerEl?.isConnected) {
			this.basesContainerEl.empty();
			const bases = this.findAssociatedBases();
			if (bases.length === 0) return;

			const section = this.basesContainerEl.createDiv({ cls: "ft-mb-3" });
			section.createEl("h3", { text: "Associated Views", cls: "ft-heading ft-heading-sm ft-mb-2" });

			const card = section.createDiv({ cls: "ft-card ft-mb-2" });
			const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const iconEl = cardHeader.createSpan();
			setIcon(iconEl, "table");
			iconEl.style.opacity = "0.5";
			cardHeader.createSpan({ text: "Base views", cls: "ft-text-sm" }).style.fontWeight = "500";

			for (const base of bases) {
				const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
				const link = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const linkIcon = link.createSpan();
				setIcon(linkIcon, "file-code");
				link.appendText(` ${base.name}`);
				link.addEventListener("click", () => {
					void this.app.workspace.openLinkText(base.path, "", false);
				});
				row.createSpan({ text: base.path, cls: "ft-text-sm ft-text-muted" });
			}
		}
	}

	/** Renders a single import config row with details and execute button. */
	private renderImportConfigRow(container: HTMLElement, cfg: SavedImportConfig): void {
		const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		const nameLink = row.createEl("span", {
			text: cfg.name,
			cls: "ft-nav-link ft-text-sm",
		});
		nameLink.style.fontWeight = "500";
		nameLink.addEventListener("click", () => this.openHubImportConfig(cfg.id));
		row.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
		row.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });

		// Preview button
		const previewBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(previewBtn.createSpan(), "eye");
		previewBtn.appendText(" Preview");
		previewBtn.addEventListener("click", () => {
			this.pendingSavedConfig = cfg;
			void this.startImportWizard(true);
		});

		// Execute button
		const runBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(runBtn.createSpan(), "play");
		runBtn.appendText(" Run");
		runBtn.addEventListener("click", () => {
			this.executeImportFromUsage(cfg);
		});
	}

	/** Opens the Data Exchange Hub and selects a specific import config. */
	private openHubImportConfig(configId: string): void {
		if (this.openHubImportConfigCb) {
			this.openHubImportConfigCb(configId);
		}
	}

	/** Executes a saved import config from the usage section with inline progress. */
	private executeImportFromUsage(cfg: SavedImportConfig): void {
		if (!cfg.sourcePath) return;

		// Show initial progress UI
		this.renderUsageProgress(cfg.name, 0, 0);

		void this.eventBus.emit("dataExchange.import.execute", {
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

		const offProgress = this.eventBus.on("dataExchange.import.progress", (event) => {
			this.renderUsageProgress(cfg.name, event.payload.current, event.payload.total);
		});

		const offComplete = this.eventBus.on("dataExchange.import.completed", (event) => {
			offProgress(); offComplete(); offFailed();
			const r = event.payload.result;
			this.renderUsageResult(r);
			// Record last import timestamp
			this.lastImportedAt = Date.now();
			this.persistDisplaySettings();
			// Refresh bases section so newly created .base files appear
			setTimeout(() => this.refreshAssociatedBases(), 500);
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
		});
		const offFailed = this.eventBus.on("dataExchange.import.failed", (event) => {
			offProgress(); offComplete(); offFailed();
			this.renderUsageError(event.payload.error);
			new Notice(`Import failed: ${event.payload.error}`);
		});
	}

	/** Renders the inline progress bar for a running import in the usage section. */
	private renderUsageProgress(name: string, current: number, total: number): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-card ft-mb-2" });
		const wrapper = card.createDiv({ cls: "ft-flex-col ft-gap-2" });
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const spinIcon = header.createSpan();
		setIcon(spinIcon, "loader");
		spinIcon.style.opacity = "0.5";
		header.createSpan({ text: `Running import: ${name}`, cls: "ft-text-sm" }).style.fontWeight = "500";

		wrapper.createDiv({
			text: total > 0 ? `Processing row ${current} of ${total}...` : "Starting import...",
			cls: "ft-text-sm ft-text-muted",
		});

		const bar = wrapper.createDiv({ cls: "ft-progress-bar" });
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		const pct = total > 0 ? (current / total) * 100 : 0;
		fill.style.width = `${pct}%`;
	}

	/** Shows the import result summary inline in the usage section. */
	private renderUsageResult(result: ImportResult): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-card ft-mb-2" });
		const wrapper = card.createDiv({ cls: "ft-flex-col ft-gap-2" });
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const checkIcon = header.createSpan();
		setIcon(checkIcon, "check-circle");
		checkIcon.style.opacity = "0.5";
		header.createSpan({ text: "Import Complete", cls: "ft-text-sm" }).style.fontWeight = "500";
		header.createDiv().style.flex = "1";
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

	/** Shows an import error inline in the usage section. */
	private renderUsageError(error: string): void {
		if (!this.usageProgressEl) return;
		this.usageProgressEl.empty();

		const card = this.usageProgressEl.createDiv({ cls: "ft-alert-error ft-p-3 ft-mb-2" });
		const cardHeader = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		cardHeader.createEl("strong", { text: "Import failed: " });
		cardHeader.createSpan({ text: error });
		cardHeader.createDiv().style.flex = "1";
		const dismissBtn = cardHeader.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(dismissBtn, "x");
		dismissBtn.addEventListener("click", () => { this.usageProgressEl?.empty(); });
	}

	/** Creates a CSV doc file and opens it. */
	private createCsvDocAndOpen(): void {
		if (!this.file) return;
		const csvLines = this.data.split("\n").filter((l) => l.trim());
		const csvHeaders = csvLines.length > 0 ? this.splitCsvLine(csvLines[0]) : [];
		const csvRowCount = Math.max(0, csvLines.length - 1);
		void this.dataExchangeService
			.createCsvDoc(this.file.path, csvHeaders, csvRowCount, this.detectedDelimiter)
			.then((path) => {
				new Notice("CSV documentation created");
				void this.app.workspace.openLinkText(path, "", false);
			})
			.catch((err) => console.error("[Flowti] Failed to create CSV doc", err));
	}

	/** Split a CSV line using the detected delimiter, handling quoted fields. */
	private splitCsvLine(line: string): string[] {
		const delim = this.detectedDelimiter;
		const result: string[] = [];
		let current = "";
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				inQuotes = !inQuotes;
			} else if (!inQuotes && line.startsWith(delim, i)) {
				result.push(current.trim());
				current = "";
				i += delim.length - 1; // skip remaining delimiter chars
			} else {
				current += ch;
			}
		}
		result.push(current.trim());
		return result;
	}

	/** Auto-detect the delimiter from raw CSV content. */
	private detectDelimiter(content: string): string {
		const firstLine = content.split("\n")[0] ?? "";
		// Count occurrences of common delimiters outside quoted fields
		const candidates = [",", ";", "\t", "|"];
		let bestDelim = ",";
		let bestCount = 0;
		for (const delim of candidates) {
			let count = 0;
			let inQuotes = false;
			for (const ch of firstLine) {
				if (ch === '"') inQuotes = !inQuotes;
				else if (ch === delim && !inQuotes) count++;
			}
			if (count > bestCount) {
				bestCount = count;
				bestDelim = delim;
			}
		}
		return bestDelim;
	}

	private formatRelativeTime(ts: number): string {
		const diff = Date.now() - ts;
		const secs = Math.floor(diff / 1000);
		if (secs < 60) return "just now";
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(ts).toLocaleDateString();
	}

	// ── Import wizard entry ─────────────────────────────────

	private async startImportWizard(skipAutoDetect = false): Promise<void> {
		this.importService = this.dataExchangeService.getImportService();
		this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();

		// Subscribe to progress events
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.progress", (event) => {
				this.importProgress = {
					current: event.payload.current,
					total: event.payload.total,
				};
				if (this.currentPage === "result" && !this.importResult) {
					this.renderProgressIndicator();
				}
			}),
		);

		// Parse CSV (papaparse auto-detects the delimiter)
		try {
			this.parsedCsv = await this.importService.parseFile(this.file!.path);
			this.detectedDelimiter = this.parsedCsv.detectedDelimiter;
			this.initializeFromCsv();
		} catch (error) {
			this.parseError =
				error instanceof Error ? error.message : String(error);
		}

		// Pre-apply saved config if provided (e.g. from Hub)
		if (this.pendingSavedConfig) {
			this.applySavedImportConfig(this.pendingSavedConfig.id);
			this.pendingSavedConfig = null;
			this.currentPage = "preview";
			this.renderContent();
			return;
		}

		// Auto-detect existing configs for this CSV file (skipped when user already chose)
		if (!skipAutoDetect) {
			const matchingConfigs = this.dataExchangeService.getImportConfigsForFile(this.file!.path);
			if (matchingConfigs.length === 1) {
				this.applySavedImportConfig(matchingConfigs[0].id);
				this.currentPage = "preview";
				this.renderContent();
				return;
			}
			if (matchingConfigs.length > 1) {
				new ConfigChooserModal(
					this.app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) {
							this.applySavedImportConfig(id);
							this.currentPage = "preview";
						} else {
							this.currentPage = "config";
						}
						this.renderContent();
					},
				).open();
				return;
			}
		}

		this.currentPage = "config";
		this.renderContent();
	}

	private resetImportState(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.importService = null;
		this.parsedCsv = null;
		this.parseError = null;
		this.targetFolder = "";
		this.nameColumn = "";
		this.namePrefix = "";
		this.nameSuffix = "";
		this.columnMappings = [];
		this.conflictStrategy = "skip";
		this.importResult = null;
		this.importError = null;
		this.importProgress = { current: 0, total: 0 };
		this.createBase = false;
		this.basePath = "";
		this.savedConfigs = [];
		this.columnSearchText = "";
		this.configDropdownOpen = false;
		this.customProperties = {};
		this.loadedConfigId = null;
	}

	// ── Config page (split layout) ──────────────────────────

	private renderConfigPage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		if (this.parseError) {
			const alert = ws.createDiv({ cls: "ft-alert-error ft-p-3 ft-m-3" });
			alert.createEl("strong", { text: "Parse Error: " });
			alert.createSpan({ text: this.parseError });
			const actions = ws.createDiv({ cls: "ft-detail-actions ft-p-3" });
			const cancelBtn = actions.createEl("span", { cls: "ft-nav-link" });
			setIcon(cancelBtn.createSpan(), "arrow-left");
			cancelBtn.appendText(" Back to CSV");
			cancelBtn.addEventListener("click", () => {
				this.resetImportState();
				this.currentPage = "landing";
				this.renderContent();
			});
			return;
		}

		if (!this.parsedCsv) return;

		const split = ws.createDiv({ cls: "ft-config-split" });

		// ── Left panel: config form ──
		const panel = split.createDiv({ cls: "ft-config-panel" });

		panel.createEl("h3", { text: "Configure Import", cls: "ft-heading ft-heading-sm ft-mb-2" });

		// Action bar — matches preview stats bar layout
		const actions = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2 ft-mb-3" });
		actions.style.borderBottom = "1px solid var(--background-modifier-border)";

		const csvDetailBtn = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(csvDetailBtn.createSpan(), "file-spreadsheet");
		csvDetailBtn.appendText(" CSV Detail");
		csvDetailBtn.addEventListener("click", () => {
			this.resetImportState();
			this.currentPage = "landing";
			this.renderContent();
		});

		actions.createDiv().style.flex = "1";

		const nextBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(nextBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "eye");
		nextBtn.appendText(" Preview");
		nextBtn.addEventListener("click", () => {
			this.currentPage = "preview";
			this.renderContent();
		});

		// Unsaved changes reminder (always present, visibility toggled)
		const reminder = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		reminder.style.padding = "0.35rem 0.5rem";
		reminder.style.borderRadius = "var(--radius-s, 4px)";
		reminder.style.background = "var(--background-modifier-message)";
		reminder.style.display = this.hasUnsavedChanges() ? "flex" : "none";
		const warnIcon = reminder.createSpan();
		setIcon(warnIcon, "alert-triangle");
		warnIcon.style.opacity = "0.6";
		warnIcon.style.flexShrink = "0";
		reminder.createSpan({
			text: "Config has unsaved changes",
			cls: "ft-text-sm ft-text-muted",
		});
		this.unsavedHintEl = reminder;

		// Target folder
		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.setDesc("Vault folder where notes will be created")
			.addText((text) =>
				text
					.setValue(this.targetFolder)
					.setPlaceholder("path/to/folder")
					.onChange((v) => { this.targetFolder = v; this.updateUnsavedHint(); }),
			);
		targetSetting.addExtraButton((btn) =>
			btn
				.setIcon("folder")
				.setTooltip("Browse vault folders")
				.onClick(() => this.openFolderPicker()),
		);

		// Name column
		new Setting(panel)
			.setName("Name column")
			.setDesc("CSV column used as the note filename")
			.addDropdown((dropdown) => {
				for (const h of this.parsedCsv!.headers) {
					dropdown.addOption(h, h);
				}
				dropdown.setValue(this.nameColumn);
				dropdown.onChange((v) => { this.nameColumn = v; this.renderConfigPage(); });
			});

		// Name prefix / suffix
		new Setting(panel)
			.setName("Filename prefix")
			.setDesc("Prepended to each filename")
			.addText((text) =>
				text
					.setValue(this.namePrefix)
					.setPlaceholder("e.g. PROJ-")
					.onChange((v) => { this.namePrefix = v; this.updateUnsavedHint(); }),
			);

		new Setting(panel)
			.setName("Filename suffix")
			.setDesc("Appended to each filename (before .md)")
			.addText((text) =>
				text
					.setValue(this.nameSuffix)
					.setPlaceholder("e.g. -draft")
					.onChange((v) => { this.nameSuffix = v; this.updateUnsavedHint(); }),
			);

		// Conflict strategy
		new Setting(panel)
			.setName("Existing notes")
			.setDesc("What to do when a note already exists")
			.addDropdown((dropdown) => {
				dropdown.addOption("skip", "Skip");
				dropdown.addOption("update", "Update frontmatter");
				dropdown.addOption("overwrite", "Overwrite entire note");
				dropdown.setValue(this.conflictStrategy);
				dropdown.onChange((v) => { this.conflictStrategy = v as ConflictStrategy; this.updateUnsavedHint(); });
			});

		// ── Create .base view option ───────────────────────
		if (!this.basePath) {
			this.basePath = this.targetFolder
				? `${this.targetFolder}/${this.getBaseFilename()}`
				: this.getBaseFilename();
		}
		let baseCheckPath = this.basePath.trim();
		if (baseCheckPath && !baseCheckPath.endsWith(".base")) baseCheckPath += ".base";
		const baseExists = !!this.app.vault.getAbstractFileByPath(baseCheckPath);

		new Setting(panel)
			.setName("Create .base view")
			.setDesc(baseExists ? "A .base view already exists (will not be overwritten)" : "Generate a table view for imported notes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.createBase || baseExists)
					.onChange((v) => {
						this.createBase = v;
						this.renderConfigPage();
					}),
			);

		if (this.createBase || baseExists) {
			const baseSetting = new Setting(panel)
				.setName("Base file path")
				.setDesc("Where to save the .base view file")
				.addText((text) =>
					text
						.setValue(this.basePath)
						.setPlaceholder("path/to/view.base")
						.onChange((v) => { this.basePath = v; this.updateUnsavedHint(); }),
				);
			baseSetting.addExtraButton((btn) =>
				btn
					.setIcon("folder")
					.setTooltip("Browse vault folders")
					.onClick(() => this.openBaseFolderPicker()),
			);

			if (baseExists) {
				const baseRow = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-1" });
				const baseLink = baseRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const baseIcon = baseLink.createSpan();
				setIcon(baseIcon, "file-code");
				baseLink.appendText(` Open ${baseCheckPath}`);
				baseLink.addEventListener("click", () => {
					void this.app.workspace.openLinkText(baseCheckPath, "", false);
				});
			}
		}

		// ── Right panel: column mapping + custom properties ──
		const content = split.createDiv({ cls: "ft-config-content" });

		const header = content.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const headerTitle = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		headerTitle.style.flex = "1";
		headerTitle.createEl("h3", { text: "Column Mapping", cls: "ft-heading ft-heading-sm" });
		const customPropCount = Object.keys(this.customProperties).length;
		if (customPropCount > 0) {
			headerTitle.createSpan({
				text: `${customPropCount} custom prop${customPropCount !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		// Select all / deselect all
		const selectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		selectAllBtn.textContent = "All";
		selectAllBtn.addEventListener("click", () => {
			for (const m of this.columnMappings) m.included = true;
			this.renderConfigPage();
		});

		const deselectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		deselectAllBtn.textContent = "None";
		deselectAllBtn.addEventListener("click", () => {
			for (const m of this.columnMappings) m.included = false;
			this.renderConfigPage();
		});

		// Search
		const search = content.createEl("input", {
			type: "text",
			cls: "ft-column-search",
		});
		search.placeholder = "Search columns...";
		search.value = this.columnSearchText;
		search.addEventListener("input", () => {
			this.columnSearchText = search.value;
			this.renderMappingTable(tableContainer);
		});

		// Mapping table
		const tableContainer = content.createDiv();
		this.renderMappingTable(tableContainer);

		// Custom Properties (below mappings)
		content.createEl("h4", {
			text: "Custom Properties",
			cls: "ft-heading ft-heading-sm ft-mt-3 ft-mb-1",
		});
		content.createEl("p", {
			text: "Extra frontmatter key-value pairs added to every imported note.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		const propsContainer = content.createDiv({ cls: "ft-custom-props" });
		this.renderCustomProperties(propsContainer, headerTitle);
	}

	private renderCustomProperties(container: HTMLElement, badgeHost?: HTMLElement): void {
		container.empty();
		const entries = Object.entries(this.customProperties);

		const updateBadge = (): void => {
			if (!badgeHost) return;
			const existing = badgeHost.querySelector(".ft-custom-prop-badge");
			if (existing) existing.remove();
			const count = Object.keys(this.customProperties).length;
			if (count > 0) {
				const badge = badgeHost.createSpan({
					text: `${count} custom prop${count !== 1 ? "s" : ""}`,
					cls: "ft-badge ft-badge-muted ft-custom-prop-badge",
				});
				badgeHost.appendChild(badge);
			}
		};

		for (const [key, value] of entries) {
			const row = container.createDiv({ cls: "ft-custom-prop-row" });
			const keyInput = row.createEl("input", { type: "text", cls: "ft-custom-prop-key" });
			keyInput.placeholder = "key";
			keyInput.value = key;
			const valInput = row.createEl("input", { type: "text", cls: "ft-custom-prop-value" });
			valInput.placeholder = "value";
			valInput.value = value;
			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			setIcon(removeBtn, "x");
			removeBtn.style.cursor = "pointer";

			const origKey = key;
			keyInput.addEventListener("change", () => {
				const newKey = keyInput.value.trim();
				if (newKey && newKey !== origKey) {
					delete this.customProperties[origKey];
					this.customProperties[newKey] = valInput.value;
				}
				this.updateUnsavedHint();
			});
			valInput.addEventListener("change", () => {
				const k = keyInput.value.trim() || origKey;
				this.customProperties[k] = valInput.value;
				this.updateUnsavedHint();
			});
			removeBtn.addEventListener("click", () => {
				delete this.customProperties[origKey];
				this.renderCustomProperties(container, badgeHost);
				updateBadge();
				this.updateUnsavedHint();
			});
		}

		const addLink = container.createEl("span", { cls: "ft-nav-link ft-text-sm ft-mt-1" });
		setIcon(addLink.createSpan(), "plus");
		addLink.appendText(" Add Property");
		addLink.style.cursor = "pointer";
		addLink.addEventListener("click", () => {
			const newKey = `property${entries.length + 1}`;
			this.customProperties[newKey] = "";
			this.renderCustomProperties(container, badgeHost);
			updateBadge();
			this.updateUnsavedHint();
			// Scroll the right panel to show the new property
			const scrollParent = container.closest(".ft-config-content");
			if (scrollParent) scrollParent.scrollTop = scrollParent.scrollHeight;
		});
	}

	private renderMappingTable(container: HTMLElement): void {
		container.empty();

		if (!this.parsedCsv) return;

		const searchLower = this.columnSearchText.toLowerCase();
		const filteredMappings = this.columnMappings.filter((m) => {
			if (searchLower && !m.csvColumn.toLowerCase().includes(searchLower) &&
				!m.frontmatterKey.toLowerCase().includes(searchLower)) return false;
			return true;
		});

		const table = container.createEl("table", { cls: "ft-mapping-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Include" }).style.width = "60px";
		headerRow.createEl("th", { text: "CSV Column" });
		headerRow.createEl("th").style.width = "30px"; // arrow
		headerRow.createEl("th", { text: "Frontmatter Key" });

		const tbody = table.createEl("tbody");

		for (const mapping of filteredMappings) {
			const isNameCol = mapping.csvColumn === this.nameColumn;
			const tr = tbody.createEl("tr");

			// Include checkbox
			const tdCheck = tr.createEl("td");
			tdCheck.style.textAlign = "center";
			const cb = tdCheck.createEl("input", { type: "checkbox" });
			cb.checked = mapping.included;
			cb.addEventListener("change", () => { mapping.included = cb.checked; this.updateUnsavedHint(); });

			// CSV column + filename badge
			const tdCol = tr.createEl("td", { cls: "ft-text-sm" });
			tdCol.appendText(mapping.csvColumn);
			if (isNameCol) {
				tdCol.createSpan({
					text: "filename",
					cls: "ft-badge ft-badge-accent",
				}).style.marginLeft = "0.5rem";
			}

			// Arrow
			tr.createEl("td", { text: "\u2192", cls: "ft-text-muted" }).style.textAlign = "center";

			// Frontmatter key
			const tdKey = tr.createEl("td");
			const input = tdKey.createEl("input", { type: "text" });
			input.value = mapping.frontmatterKey;
			input.addEventListener("input", () => { mapping.frontmatterKey = input.value; this.updateUnsavedHint(); });
		}

		if (filteredMappings.length === 0) {
			const emptyRow = tbody.createEl("tr");
			const td = emptyRow.createEl("td");
			td.colSpan = 4;
			td.textContent = this.columnSearchText ? "No matching columns" : "No columns available";
			td.className = "ft-text-muted ft-text-center ft-p-3";
		}
	}

	// ── Preview page ────────────────────────────────────────

	private renderPreviewPage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		if (!this.parsedCsv) return;

		const includedMappings = this.columnMappings.filter((m) => m.included);
		const customPropCount = Object.keys(this.customProperties).length;

		// Action bar
		const statsBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2" });
		statsBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		statsBar.style.flexShrink = "0";

		// Validation
		const issues: string[] = [];
		if (!this.targetFolder.trim()) issues.push("Target folder is required");
		if (!this.nameColumn) issues.push("Name column is required");

		if (issues.length > 0) {
			const alert = statsBar.createDiv({ cls: "ft-alert-warning ft-p-2 ft-text-sm" });
			for (const issue of issues) {
				alert.createSpan({ text: issue });
				alert.createEl("br");
			}
		}

		const configBtn = statsBar.createEl("span", { cls: "ft-nav-link" });
		setIcon(configBtn.createSpan(), "settings");
		configBtn.appendText(" Edit Config");
		configBtn.addEventListener("click", () => {
			this.currentPage = "config";
			this.renderContent();
		});

		statsBar.createDiv().style.flex = "1";

		if (issues.length === 0) {
			const importBtn = statsBar.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "play");
			importBtn.appendText(" Run Import");
			importBtn.addEventListener("click", () => {
				this.currentPage = "result";
				this.renderContent();
				void this.runImport();
			});
		}

		// ── Impact summary ──────────────────────────────────
		const summary = ws.createDiv({ cls: "ft-card ft-mt-3 ft-mb-2" });
		summary.createDiv({ text: "What will happen", cls: "ft-detail-section-header ft-mb-2" });
		const grid = summary.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Target folder", this.targetFolder || "(not set)");
		addRow("Notes to create", `${this.parsedCsv.rowCount} (from ${this.parsedCsv.rowCount} CSV rows)`);
		addRow("Filename pattern", `${this.namePrefix || ""}[${this.nameColumn}]${this.nameSuffix || ""}.md`);
		addRow("Frontmatter keys", `${includedMappings.length} mapped column${includedMappings.length !== 1 ? "s" : ""}`);
		if (customPropCount > 0) {
			addRow("Custom properties", `${customPropCount} extra key${customPropCount !== 1 ? "s" : ""} on every note`);
		}
		const strategyLabels: Record<string, string> = {
			skip: "Skip — existing notes will not be touched",
			update: "Update — merge frontmatter into existing notes",
			overwrite: "Overwrite — replace existing notes entirely",
		};
		addRow("Conflict strategy", strategyLabels[this.conflictStrategy] ?? this.conflictStrategy);

		// Base file info
		let basePath = this.basePath.trim();
		if (basePath && !basePath.endsWith(".base")) basePath += ".base";
		if (basePath && this.app.vault.getAbstractFileByPath(basePath)) {
			addRow("Base view", `Exists: ${basePath} (will not be overwritten)`);
		} else if (this.createBase && basePath) {
			addRow("Base view", `Create ${basePath}`);
		}

		// Count summary (outside scroll container)
		const customProps = Object.entries(this.customProperties);
		const totalCols = 1 + includedMappings.length + customProps.length;
		const countBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		countBar.style.flexShrink = "0";
		countBar.createSpan({
			text: `${this.parsedCsv.rowCount} rows`,
			cls: "ft-badge ft-badge-muted",
		});
		countBar.createSpan({
			text: `${totalCols} columns`,
			cls: "ft-badge ft-badge-muted",
		});
		if (customProps.length > 0) {
			countBar.createSpan({
				text: `${customProps.length} custom prop${customProps.length !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-accent",
			});
		}
		if (this.parsedCsv.rowCount > 25) {
			countBar.createSpan({
				text: "Showing first 25 rows",
				cls: "ft-text-sm ft-text-muted",
			});
		}

		// Table scroll area
		const scroll = ws.createDiv({ cls: "ft-table-scroll" });
		const table = scroll.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Filename" });
		for (const m of includedMappings) {
			headerRow.createEl("th", { text: m.frontmatterKey });
		}
		for (const [key] of customProps) {
			const th = headerRow.createEl("th", { text: key });
			th.style.color = "var(--interactive-accent)";
		}

		const tbody = table.createEl("tbody");
		const nameIndex = this.parsedCsv.headers.indexOf(this.nameColumn);
		const previewRows = this.parsedCsv.rows.slice(0, 25);

		for (const row of previewRows) {
			const tr = tbody.createEl("tr");
			const baseName = this.importService!.sanitizeFilename(
				row[nameIndex] ?? "",
			);
			const filename = `${this.namePrefix}${baseName}${this.nameSuffix}`;
			tr.createEl("td", { text: filename || "(empty)" });

			for (const m of includedMappings) {
				const colIdx = this.parsedCsv!.headers.indexOf(m.csvColumn);
				tr.createEl("td", { text: row[colIdx] ?? "" });
			}
			for (const [, value] of customProps) {
				const td = tr.createEl("td", { text: value });
				td.style.color = "var(--interactive-accent)";
				td.style.fontStyle = "italic";
			}
		}
	}

	// ── Result page ─────────────────────────────────────────

	private renderResultPage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		const container = ws.createDiv({ cls: "ft-table-scroll" });

		if (this.importResult) {
			this.renderImportResult(container);
			return;
		}

		if (this.importError) {
			const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
			const hIcon = headerRow.createSpan();
			setIcon(hIcon, "x-circle");
			hIcon.style.color = "var(--text-error)";
			headerRow.createEl("h3", { text: "Import Failed", cls: "ft-heading ft-heading-sm" });

			const errorCard = container.createDiv({ cls: "ft-card ft-mt-2" });
			errorCard.style.borderLeft = "3px solid var(--text-error)";
			errorCard.createDiv({ text: "Error", cls: "ft-detail-section-header ft-mb-2" });
			errorCard.createDiv({ text: this.importError, cls: "ft-text-sm" });

			const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
			actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
			const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2" });
			actions.style.flexWrap = "wrap";

			const retryBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			setIcon(retryBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
			retryBtn.appendText(" Retry");
			retryBtn.addEventListener("click", () => {
				this.importResult = null;
				this.importError = null;
				this.currentPage = "result";
				this.renderContent();
				void this.runImport();
			});

			const editBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(editBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "settings");
			editBtn.appendText(" Edit Config");
			editBtn.addEventListener("click", () => {
				this.importError = null;
				this.currentPage = "config";
				this.renderContent();
			});

			const csvBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(csvBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-spreadsheet");
			csvBtn.appendText(" CSV Detail");
			csvBtn.addEventListener("click", () => {
				this.resetImportState();
				this.currentPage = "landing";
				this.renderContent();
			});
			return;
		}

		// Progress indicator
		container.createEl("h3", { text: "Importing...", cls: "ft-heading ft-heading-sm" });
		container.createDiv({ cls: "ft-import-progress ft-mt-3" });
		this.renderProgressIndicator();
	}

	private renderProgressIndicator(): void {
		const container = this.contentEl.querySelector(".ft-import-progress");
		if (!container) return;
		container.innerHTML = "";

		const wrapper = document.createElement("div");
		wrapper.className = "ft-flex-col ft-gap-2";

		const label = document.createElement("p");
		label.textContent = `Processing row ${this.importProgress.current} of ${this.importProgress.total}...`;
		wrapper.appendChild(label);

		const bar = document.createElement("div");
		bar.className = "ft-progress-bar";
		const fill = document.createElement("div");
		fill.className = "ft-progress-bar-fill";
		const pct =
			this.importProgress.total > 0
				? (this.importProgress.current / this.importProgress.total) * 100
				: 0;
		fill.style.width = `${pct}%`;
		bar.appendChild(fill);
		wrapper.appendChild(bar);

		container.appendChild(wrapper);
	}

	private renderImportResult(container: HTMLElement): void {
		const r = this.importResult!;
		const hasErrors = r.failed > 0;
		const allSkipped = r.skipped === r.totalRows;

		// ── Status header ──
		const statusIcon = hasErrors ? "alert-triangle" : allSkipped ? "minus-circle" : "check-circle";
		const statusText = hasErrors
			? `Import completed with ${r.failed} error${r.failed !== 1 ? "s" : ""}`
			: allSkipped
				? "All rows skipped — notes already exist"
				: `Successfully imported ${r.created + r.updated} note${(r.created + r.updated) !== 1 ? "s" : ""}`;

		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, statusIcon);
		if (hasErrors) hIcon.style.color = "var(--text-error)";
		else if (!allSkipped) hIcon.style.color = "var(--text-success, var(--interactive-accent))";
		else hIcon.style.color = "var(--text-muted)";
		headerRow.createEl("h3", { text: statusText, cls: "ft-heading ft-heading-sm" });

		// ── Outcome summary card ──
		const card = container.createDiv({ cls: "ft-card ft-mt-2" });
		card.createDiv({ text: "What happened", cls: "ft-detail-section-header ft-mb-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string, cls?: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			const v = grid.createDiv({ text: value, cls: "ft-detail-info-value" });
			if (cls) v.addClass(cls);
		};

		addRow("CSV rows processed", String(r.totalRows));
		if (r.created > 0) addRow("Notes created", String(r.created));
		if (r.updated > 0) addRow("Notes updated", String(r.updated));
		if (r.skipped > 0) addRow("Notes skipped", `${r.skipped} (already exist)`);
		if (r.failed > 0) addRow("Failed", String(r.failed), "ft-text-error");
		addRow("Target folder", this.targetFolder);
		addRow("Conflict strategy", this.conflictStrategy);

		// .base file info
		let checkPath = this.basePath.trim();
		if (checkPath && !checkPath.endsWith(".base")) checkPath += ".base";
		if (checkPath && this.app.vault.getAbstractFileByPath(checkPath)) {
			addRow("Base view", checkPath);
		}

		// Loaded config
		if (this.loadedConfigId) {
			const cfg = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
			if (cfg) addRow("Config used", cfg.name);
		}

		// ── Error details ──
		if (r.errors.length > 0) {
			const errorSection = container.createDiv({ cls: "ft-card ft-mt-2" });
			errorSection.style.borderLeft = "3px solid var(--text-error)";
			errorSection.createDiv({ text: `Errors (${r.errors.length})`, cls: "ft-detail-section-header ft-mb-2" });

			const errorList = errorSection.createDiv({ cls: "ft-flex-col ft-gap-1 ft-text-sm" });
			for (const err of r.errors.slice(0, 20)) {
				const row = errorList.createDiv({ cls: "ft-flex ft-gap-2" });
				row.createSpan({ text: `Row ${err.row}`, cls: "ft-text-muted" });
				row.createSpan({ text: err.filename });
				row.createSpan({ text: err.error, cls: "ft-text-error" });
			}
			if (r.errors.length > 20) {
				errorList.createDiv({
					text: `...and ${r.errors.length - 20} more errors`,
					cls: "ft-text-muted ft-mt-1",
				});
			}
		}

		// ── Call to actions ──
		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2" });
		actions.style.flexWrap = "wrap";

		// Open target folder
		const openFolderBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(openFolderBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "folder-open");
		openFolderBtn.appendText(" Open Target Folder");
		openFolderBtn.addEventListener("click", () => {
			void this.app.workspace.openLinkText(this.targetFolder, "", false);
		});

		// Open .base view if exists
		if (checkPath && this.app.vault.getAbstractFileByPath(checkPath)) {
			const basePath = checkPath;
			const openBaseBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(openBaseBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "table");
			openBaseBtn.appendText(" Open Base View");
			openBaseBtn.addEventListener("click", () => {
				void this.app.workspace.openLinkText(basePath, "", false);
			});
		}

		// Run again (same config)
		const rerunBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(rerunBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
		rerunBtn.appendText(" Run Again");
		rerunBtn.addEventListener("click", () => {
			this.importResult = null;
			this.importError = null;
			this.currentPage = "result";
			this.renderContent();
			void this.runImport();
		});

		// Edit config
		const editBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(editBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "settings");
		editBtn.appendText(" Edit Config");
		editBtn.addEventListener("click", () => {
			this.importResult = null;
			this.importError = null;
			this.currentPage = "config";
			this.renderContent();
		});

		// Back to CSV detail
		const csvBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(csvBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-spreadsheet");
		csvBtn.appendText(" CSV Detail");
		csvBtn.addEventListener("click", () => {
			this.resetImportState();
			this.currentPage = "landing";
			this.renderContent();
		});
	}

	// ── Execution ───────────────────────────────────────────

	private async runImport(): Promise<void> {
		try {
			this.importResult = await this.importService!.executeImport({
				sourcePath: this.file!.path,
				targetFolder: this.targetFolder,
				nameColumn: this.nameColumn,
				namePrefix: this.namePrefix || undefined,
				nameSuffix: this.nameSuffix || undefined,
				columnMappings: this.columnMappings,
				conflictStrategy: this.conflictStrategy,
				customProperties: Object.keys(this.customProperties).length > 0
					? { ...this.customProperties }
					: undefined,
			});
			const r = this.importResult;
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
			// Record last import timestamp
			this.lastImportedAt = Date.now();
			this.persistDisplaySettings();
			// Auto-save config on first import if none exists for this file
			await this.autoSaveConfigIfNeeded();
			// Create or update corresponding .base file
			await this.syncBaseFile();
		} catch (error) {
			this.importError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderContent();
	}

	private async autoSaveConfigIfNeeded(): Promise<void> {
		if (!this.file) return;
		const existing = this.dataExchangeService.getImportConfigsForFile(this.file.path);
		if (existing.length > 0) return;
		try {
			const saved = await this.dataExchangeService.saveImportConfig({
				name: this.file.basename,
				sourcePath: this.file.path,
				targetFolder: this.targetFolder,
				nameColumn: this.nameColumn,
				namePrefix: this.namePrefix || undefined,
				nameSuffix: this.nameSuffix || undefined,
				columnMappings: [...this.columnMappings],
				conflictStrategy: this.conflictStrategy,
				customProperties: Object.keys(this.customProperties).length > 0
					? { ...this.customProperties }
					: undefined,
				createBase: this.createBase || undefined,
				basePath: this.basePath || undefined,
			});
			this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
			new Notice(`Config auto-saved: ${saved.name}`);
		} catch (err) {
			console.error("[Flowti] Failed to auto-save import config", err);
		}
	}

	/** Creates a new .base file if one doesn't exist yet. Existing files are never overwritten
	 *  because they may contain custom formulas, views, and properties. */
	private async syncBaseFile(): Promise<void> {
		if (!this.createBase) return;
		if (!this.basePath) {
			this.basePath = this.targetFolder
				? `${this.targetFolder}/${this.getBaseFilename()}`
				: this.getBaseFilename();
		}
		let path = this.basePath.trim();
		if (!path) return;
		if (!path.endsWith(".base")) path += ".base";

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) return; // Never overwrite — existing base may have formulas, views, etc.

		try {
			const content = this.generateBaseYaml();
			await this.app.vault.create(path, content);
			new Notice(`Base view created: ${path}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to create .base file: ${msg}`);
		}
	}

	// ── Config load ─────────────────────────────────────────

	private applySavedImportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		this.loadedConfigId = cfg.id;
		this.targetFolder = cfg.targetFolder;
		this.nameColumn = cfg.nameColumn;
		this.namePrefix = cfg.namePrefix ?? "";
		this.nameSuffix = cfg.nameSuffix ?? "";
		this.conflictStrategy = cfg.conflictStrategy;
		this.customProperties = cfg.customProperties ? { ...cfg.customProperties } : {};
		this.createBase = cfg.createBase ?? false;
		this.basePath = cfg.basePath ?? "";
		// Reset all mappings to defaults, then overlay saved config values
		for (const mapping of this.columnMappings) {
			mapping.frontmatterKey = mapping.csvColumn
				.toLowerCase()
				.replace(/\s+/g, "_")
				.replace(/[^a-z0-9_]/g, "");
			mapping.included = true;
		}
		for (const saved of cfg.columnMappings) {
			const mapping = this.columnMappings.find(
				(m) => m.csvColumn === saved.csvColumn,
			);
			if (mapping) {
				mapping.frontmatterKey = saved.frontmatterKey;
				mapping.included = saved.included;
			}
		}
		new Notice(`Loaded config: ${cfg.name}`);
	}

	/** Checks whether the current config state differs from the loaded saved config. */
	private updateUnsavedHint(): void {
		if (this.unsavedHintEl) {
			this.unsavedHintEl.style.display = this.hasUnsavedChanges() ? "flex" : "none";
		}
	}

	private hasUnsavedChanges(): boolean {
		if (!this.loadedConfigId) return false;
		const cfg = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
		if (!cfg) return false;
		if (cfg.targetFolder !== this.targetFolder) return true;
		if (cfg.nameColumn !== this.nameColumn) return true;
		if ((cfg.namePrefix ?? "") !== this.namePrefix) return true;
		if ((cfg.nameSuffix ?? "") !== this.nameSuffix) return true;
		if (cfg.conflictStrategy !== this.conflictStrategy) return true;
		const savedProps = cfg.customProperties ?? {};
		if (JSON.stringify(savedProps) !== JSON.stringify(this.customProperties)) return true;
		if ((cfg.createBase ?? false) !== this.createBase) return true;
		if ((cfg.basePath ?? "") !== this.basePath) return true;
		for (const mapping of this.columnMappings) {
			const saved = cfg.columnMappings.find((s) => s.csvColumn === mapping.csvColumn);
			if (saved && (saved.included !== mapping.included || saved.frontmatterKey !== mapping.frontmatterKey)) return true;
		}
		return false;
	}

	// ── Folder pickers ──────────────────────────────────────

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			this.targetFolder = folder;
			this.renderContent();
		}).open();
	}

	private openBaseFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			const filename = this.getBaseFilename();
			this.basePath = folder ? `${folder}/${filename}` : filename;
			this.renderContent();
		}).open();
	}

	// ── .base file creation ─────────────────────────────────

	private generateBaseYaml(): string {
		const folder = this.targetFolder;
		const includedMappings = this.columnMappings.filter((m) => m.included);

		const lines: string[] = [];
		lines.push("filters:");
		lines.push("  and:");
		lines.push(`    - 'file.inFolder("${folder}")'`);
		lines.push(`    - 'file.ext == "md"'`);
		lines.push("");
		lines.push("views:");
		lines.push("  - name: \"Imported Data\"");
		lines.push("    type: \"table\"");
		if (includedMappings.length > 0) {
			lines.push("    order:");
			lines.push("      - \"file.name\"");
			for (const m of includedMappings) {
				lines.push(`      - "${m.frontmatterKey}"`);
			}
		}
		return lines.join("\n") + "\n";
	}


	private getBaseFilename(): string {
		const parts = (this.file?.path ?? "imported.csv").replace(/\\/g, "/").split("/");
		const csvFile = parts[parts.length - 1] || "imported.csv";
		return csvFile.replace(/\.csv$/i, ".base");
	}

	// ── Initialization ──────────────────────────────────────

	private initializeFromCsv(): void {
		if (!this.parsedCsv) return;

		const csvPath = this.file!.path;
		const lastSlash = csvPath.lastIndexOf("/");
		const csvFolder =
			lastSlash >= 0 ? csvPath.substring(0, lastSlash) : "";
		this.targetFolder = csvFolder
			? `${csvFolder}/imported`
			: "imported";

		this.nameColumn = this.parsedCsv.headers[0] ?? "";

		this.columnMappings = this.parsedCsv.headers.map((h) => ({
			csvColumn: h,
			frontmatterKey: h
				.toLowerCase()
				.replace(/\s+/g, "_")
				.replace(/[^a-z0-9_]/g, ""),
			included: true,
		}));
	}
}
