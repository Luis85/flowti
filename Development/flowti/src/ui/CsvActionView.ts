/**
 * CSV Action View for Flowti.
 *
 * Registered as the handler for `.csv` files. When the user clicks a CSV
 * in the file explorer, the landing page shows file info, column chips, and
 * a CSV preview. "Import as Notes" transitions to a full-width wizard with
 * a horizontal stepper, split config layout, and scrollable preview.
 */

import { Notice, Setting, TextFileView, WorkspaceLeaf, setIcon } from "obsidian";
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
import { InputModal } from "./modals";

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

		// File info
		const fileInfo = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		fileInfo.style.flexShrink = "0";
		const icon = fileInfo.createSpan();
		setIcon(icon, "file-spreadsheet");
		icon.style.opacity = "0.6";
		const name = fileInfo.createSpan({
			text: this.file?.basename ?? "CSV",
			cls: "ft-text-sm",
		});
		name.style.cursor = "pointer";
		name.addEventListener("click", () => {
			this.resetImportState();
			this.currentPage = "landing";
			this.renderContent();
		});

		// Row/column badges
		if (this.parsedCsv) {
			fileInfo.createSpan({
				text: `${this.parsedCsv.rowCount} rows`,
				cls: "ft-badge ft-badge-muted",
			});
			fileInfo.createSpan({
				text: `${this.parsedCsv.headers.length} cols`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		// Stepper
		const stepBar = bar.createDiv({ cls: "ft-step-bar" });
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

			const iconEl = stepEl.createDiv({ cls: "ft-step-icon" });
			iconEl.textContent = String(i + 1);

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
		bar.createDiv().style.flex = "1";

		// Config dropdown
		this.renderConfigDropdownButton(bar);
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

		if (this.savedConfigs.length > 0) {
			menu.createDiv({ cls: "ft-config-dropdown-divider" });

			for (const cfg of this.savedConfigs) {
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
		new InputModal(this.app, {
			title: "Save Import Config",
			inputName: "Config name",
			inputDesc: "A descriptive name for this import configuration",
			placeholder: "My import config",
			submitLabel: "Save",
			onSubmit: (name) => {
				void this.dataExchangeService
					.saveImportConfig({
						name,
						targetFolder: this.targetFolder,
						nameColumn: this.nameColumn,
						namePrefix: this.namePrefix || undefined,
						nameSuffix: this.nameSuffix || undefined,
						columnMappings: [...this.columnMappings],
						conflictStrategy: this.conflictStrategy,
					})
					.then((saved) => {
						this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
						new Notice(`Config saved: ${saved.name}`);
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

		// Hero section
		const hero = el.createDiv({ cls: "flowti-csv-container" });
		hero.style.maxWidth = "none";
		hero.style.textAlign = "center";
		hero.style.marginBottom = "1.5rem";

		const iconEl = hero.createDiv({ cls: "flowti-csv-icon" });
		setIcon(iconEl, "file-spreadsheet");
		hero.createEl("h2", { text: this.file?.basename ?? "CSV File" });
		hero.createEl("p", {
			cls: "flowti-csv-desc",
			text: "Choose an action for this CSV file:",
		});

		// Action buttons
		const actions = hero.createDiv({ cls: "flowti-csv-actions" });

		const importBtn = actions.createEl("button", { cls: "mod-cta" });
		setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-input");
		importBtn.appendText(" Import as Notes");
		importBtn.addEventListener("click", () => {
			void this.startImportWizard();
		});

		const openBtn = actions.createEl("button");
		setIcon(openBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "external-link");
		openBtn.appendText(" Open with Default App");
		openBtn.addEventListener("click", () => {
			if (this.file) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.app as any).openWithDefaultApp(this.file.path);
				this.leaf.detach();
			}
		});

		// File info + data summary
		if (this.data?.trim()) {
			this.renderFileInfoDashboard(el);
			this.renderCsvPreview(el);
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
		if (this.file?.stat) {
			const kb = (this.file.stat.size / 1024).toFixed(1);
			addStat("Size", `${kb} KB`);
		}

		// Column chips
		if (headers.length > 0) {
			const chipContainer = container.createDiv({
				cls: "ft-flex ft-gap-1 ft-mb-3",
			});
			chipContainer.style.flexWrap = "wrap";
			for (const h of headers) {
				chipContainer.createSpan({ text: h, cls: "ft-badge ft-badge-muted" });
			}
		}
	}

	private renderCsvPreview(container: HTMLElement): void {
		const lines = this.data.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return;

		container.createEl("h3", { text: "Preview", cls: "ft-heading ft-heading-sm" });
		const tableWrap = container.createDiv({ cls: "flowti-csv-preview" });
		const table = tableWrap.createEl("table");

		const maxRows = Math.min(lines.length, 12);
		for (let i = 0; i < maxRows; i++) {
			const tr = table.createEl("tr");
			const cells = this.splitCsvLine(lines[i]);
			const tag = i === 0 ? "th" : "td";
			for (const cell of cells.slice(0, 12)) {
				tr.createEl(tag, { text: cell });
			}
			if (cells.length > 12) {
				tr.createEl(tag, { text: "\u2026" });
			}
		}

		if (lines.length > 12) {
			container.createEl("p", {
				cls: "flowti-csv-more",
				text: `\u2026 and ${lines.length - 12} more rows`,
			});
		}
	}

	/** Rough CSV line split that handles double-quoted fields. */
	private splitCsvLine(line: string): string[] {
		const result: string[] = [];
		let current = "";
		let inQuotes = false;
		for (const ch of line) {
			if (ch === '"') {
				inQuotes = !inQuotes;
			} else if (ch === "," && !inQuotes) {
				result.push(current.trim());
				current = "";
			} else {
				current += ch;
			}
		}
		result.push(current.trim());
		return result;
	}

	// ── Import wizard entry ─────────────────────────────────

	private async startImportWizard(): Promise<void> {
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

		// Parse CSV
		try {
			this.parsedCsv = await this.importService.parseFile(this.file!.path);
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
		} else {
			this.currentPage = "config";
		}
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

		panel.createEl("h3", { text: "Configure Import", cls: "ft-heading ft-heading-sm ft-mb-3" });

		// Target folder
		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.setDesc("Vault folder where notes will be created")
			.addText((text) =>
				text
					.setValue(this.targetFolder)
					.setPlaceholder("path/to/folder")
					.onChange((v) => { this.targetFolder = v; }),
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
					.onChange((v) => { this.namePrefix = v; }),
			);

		new Setting(panel)
			.setName("Filename suffix")
			.setDesc("Appended to each filename (before .md)")
			.addText((text) =>
				text
					.setValue(this.nameSuffix)
					.setPlaceholder("e.g. -draft")
					.onChange((v) => { this.nameSuffix = v; }),
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
				dropdown.onChange((v) => { this.conflictStrategy = v as ConflictStrategy; });
			});

		// Save Config CTA
		const ctaBlock = panel.createDiv({ cls: "ft-save-config-cta" });
		const ctaHeader = ctaBlock.createDiv({ cls: "ft-save-cta-header" });
		setIcon(ctaHeader.createSpan(), "save");
		ctaHeader.appendText("Save Configuration");
		ctaBlock.createDiv({
			text: "Save this setup as a reusable config with documentation.",
			cls: "ft-save-cta-desc",
		});
		const saveBtn = ctaBlock.createEl("button", {
			text: "Save Config...",
			cls: "mod-cta",
		});
		saveBtn.addEventListener("click", () => this.promptSaveConfig());

		// Navigation
		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const backBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(backBtn.createSpan(), "arrow-left");
		backBtn.appendText(" Back");
		backBtn.addEventListener("click", () => {
			this.resetImportState();
			this.currentPage = "landing";
			this.renderContent();
		});

		const nextBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(nextBtn.createSpan(), "arrow-right");
		nextBtn.appendText(" Preview");
		nextBtn.addEventListener("click", () => {
			this.currentPage = "preview";
			this.renderContent();
		});

		// ── Right panel: column mapping ──
		const content = split.createDiv({ cls: "ft-config-content" });

		const header = content.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		header.createEl("h3", { text: "Column Mapping", cls: "ft-heading ft-heading-sm" });
		header.style.flex = "1";

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
			cb.addEventListener("change", () => { mapping.included = cb.checked; });

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
			input.addEventListener("input", () => { mapping.frontmatterKey = input.value; });
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

		// Stats bar
		const statsBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-px-3 ft-py-2" });
		statsBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		statsBar.style.flexShrink = "0";

		statsBar.createSpan({
			text: `${this.parsedCsv.rowCount} rows`,
			cls: "ft-badge ft-badge-muted",
		});
		statsBar.createSpan({
			text: `${includedMappings.length + 1} columns`,
			cls: "ft-badge ft-badge-muted",
		});

		// Validation
		const issues: string[] = [];
		if (!this.targetFolder.trim()) issues.push("Target folder is required");
		if (!this.nameColumn) issues.push("Name column is required");

		if (issues.length > 0) {
			const alert = statsBar.createDiv({ cls: "ft-alert-warning ft-p-2 ft-text-sm" });
			alert.style.marginLeft = "auto";
			for (const issue of issues) {
				alert.createSpan({ text: issue });
				alert.createEl("br");
			}
		}

		statsBar.createDiv().style.flex = "1";

		// Navigation in stats bar
		const backBtn = statsBar.createEl("span", { cls: "ft-nav-link" });
		setIcon(backBtn.createSpan(), "arrow-left");
		backBtn.appendText(" Config");
		backBtn.addEventListener("click", () => {
			this.currentPage = "config";
			this.renderContent();
		});

		if (issues.length === 0) {
			const importBtn = statsBar.createEl("span", { cls: "ft-nav-link" });
			setIcon(importBtn.createSpan(), "play");
			importBtn.appendText(" Import");
			importBtn.addEventListener("click", () => {
				this.currentPage = "result";
				this.renderContent();
				void this.runImport();
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
		}

		if (this.parsedCsv.rowCount > 25) {
			scroll.createEl("p", {
				text: `Showing 25 of ${this.parsedCsv.rowCount} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
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
			container.createEl("h3", { text: "Import Failed", cls: "ft-heading ft-heading-sm" });
			const alert = container.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
			alert.createEl("strong", { text: "Error: " });
			alert.createSpan({ text: this.importError });

			const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
			const backBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(backBtn.createSpan(), "arrow-left");
			backBtn.appendText(" Back to CSV");
			backBtn.addEventListener("click", () => {
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

		container.createEl("h3", { text: "Import Complete", cls: "ft-heading ft-heading-sm" });

		// Stats grid
		const statsGrid = container.createDiv({ cls: "ft-detail-info-grid ft-mt-3" });
		const addRow = (label: string, value: string, cls?: string) => {
			statsGrid.createDiv({ text: label, cls: "ft-detail-info-label" });
			const v = statsGrid.createDiv({ text: value, cls: "ft-detail-info-value" });
			if (cls) v.addClass(cls);
		};
		addRow("Total rows", String(r.totalRows));
		addRow("Created", String(r.created));
		addRow("Updated", String(r.updated));
		addRow("Skipped", String(r.skipped));
		if (r.failed > 0) addRow("Failed", String(r.failed), "ft-text-error");

		if (r.errors.length > 0) {
			const errorSection = container.createDiv({ cls: "ft-detail-section" });
			const errorHeader = errorSection.createDiv({ cls: "ft-detail-section-header" });
			errorHeader.createEl("h4", { text: "Errors" });

			const errorList = errorSection.createDiv({ cls: "ft-flex-col ft-gap-1 ft-text-sm" });
			for (const err of r.errors.slice(0, 20)) {
				errorList.createDiv({
					text: `Row ${err.row} (${err.filename}): ${err.error}`,
				});
			}
			if (r.errors.length > 20) {
				errorList.createDiv({
					text: `...and ${r.errors.length - 20} more`,
					cls: "ft-text-muted",
				});
			}
		}

		// ── Create .base view option ───────────────────────
		if (!this.basePath) {
			this.basePath = this.targetFolder
				? `${this.targetFolder}/${this.getBaseFilename()}`
				: this.getBaseFilename();
		}
		let checkPath = this.basePath.trim();
		if (checkPath && !checkPath.endsWith(".base")) checkPath += ".base";
		const baseExists = !!this.app.vault.getAbstractFileByPath(checkPath);

		const baseSection = container.createDiv({ cls: "ft-detail-section" });

		if (baseExists) {
			new Setting(baseSection)
				.setName("Base view")
				.setDesc(`Already exists: ${checkPath}`);
		} else {
			const baseHeader = baseSection.createDiv({ cls: "ft-detail-section-header" });
			baseHeader.createEl("h4", { text: "Create Base View" });

			new Setting(baseSection)
				.setName("Create a .base view file")
				.setDesc("Generate a table view for the imported notes")
				.addToggle((toggle) =>
					toggle
						.setValue(this.createBase)
						.onChange((v) => {
							this.createBase = v;
							this.renderContent();
						}),
				);

			if (this.createBase) {
				const baseSetting = new Setting(baseSection)
					.setName("Base file path")
					.setDesc("Where to save the .base view file")
					.addText((text) =>
						text
							.setValue(this.basePath)
							.setPlaceholder("path/to/view.base")
							.onChange((v) => { this.basePath = v; }),
					);
				baseSetting.addExtraButton((btn) =>
					btn
						.setIcon("folder")
						.setTooltip("Browse vault folders")
						.onClick(() => this.openBaseFolderPicker()),
				);

				const createBtn = baseSection.createEl("button", {
					text: "Create .base",
					cls: "ft-btn ft-btn-sm ft-mt-2",
				});
				createBtn.addEventListener("click", () => void this.createBaseFile());
			}
		}

		// Navigation
		const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
		const backBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(backBtn.createSpan(), "arrow-left");
		backBtn.appendText(" Back to CSV");
		backBtn.addEventListener("click", () => {
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
			});
			const r = this.importResult;
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
		} catch (error) {
			this.importError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderContent();
	}

	// ── Config load ─────────────────────────────────────────

	private applySavedImportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		this.targetFolder = cfg.targetFolder;
		this.nameColumn = cfg.nameColumn;
		this.namePrefix = cfg.namePrefix ?? "";
		this.nameSuffix = cfg.nameSuffix ?? "";
		this.conflictStrategy = cfg.conflictStrategy;
		if (cfg.columnMappings.length > 0 && this.columnMappings.length > 0) {
			for (const mapping of this.columnMappings) {
				const saved = cfg.columnMappings.find(
					(s) => s.csvColumn === mapping.csvColumn,
				);
				if (saved) {
					mapping.frontmatterKey = saved.frontmatterKey;
					mapping.included = saved.included;
				}
			}
		}
		new Notice(`Loaded config: ${cfg.name}`);
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

	private async createBaseFile(): Promise<void> {
		if (!this.basePath.trim()) {
			new Notice("Please enter a path for the .base file");
			return;
		}

		let path = this.basePath.trim();
		if (!path.endsWith(".base")) path += ".base";

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) {
			new Notice(`Base file already exists: ${path}`);
			return;
		}

		try {
			const content = this.generateBaseYaml();
			await this.app.vault.create(path, content);
			new Notice(`Base view created: ${path}`);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to create .base file: ${msg}`);
		}
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
