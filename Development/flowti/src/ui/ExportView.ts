/**
 * Export View for Flowti.
 *
 * A dedicated ItemView for exporting vault data as CSV or tab-delimited files.
 * Triggered from context menus on folders / `.base` files, or from the command palette.
 *
 * Layout: top bar with horizontal stepper + full-width workspace.
 * Config step uses a split layout (settings left, property grid right).
 */

import { ItemView, Notice, Setting, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type { ExportService } from "../domain/dataExchange/ExportService";
import type {
	ExportConflictStrategy,
	ExportFormat,
	ExportResult,
	FilePropertyDef,
	ParsedBaseFile,
	SavedExportConfig,
	VaultFileInfo,
} from "../domain/dataExchange/types";
import { STANDARD_FILE_PROPERTIES } from "../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";
import { InputModal } from "./modals";

export const VIEW_TYPE_EXPORT = "flowti-export";

export interface ExportViewConfig {
	sourcePath: string;
	sourceType: "folder" | "base";
	format: ExportFormat;
}

type ExportPage = "view-select" | "configure" | "preview" | "result";

const STEP_LABELS: Record<string, string> = {
	"view-select": "View",
	configure: "Configure",
	preview: "Preview",
	result: "Export",
};

export class ExportView extends ItemView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private getConfig: () => ExportViewConfig | null;

	// Config (set in onOpen)
	private exportService!: ExportService;
	private sourcePath = "";
	private sourceType: "folder" | "base" = "folder";
	private format: ExportFormat = "csv";

	// State
	private currentPage: ExportPage = "configure";
	private outputPath = "";
	private isExternal = false;
	private availableColumns: string[] = [];
	private selectedColumns: string[] = [];
	private selectedFileProperties: string[] = ["file.name"];
	private baseViewIndex = 0;
	private baseFile: ParsedBaseFile | null = null;
	private previewFiles: VaultFileInfo[] = [];
	private conflictStrategy: ExportConflictStrategy = "overwrite";
	private displayNames: Record<string, string> = {};
	private exportResult: ExportResult | null = null;
	private exportError: string | null = null;
	private loadError: string | null = null;
	private savedConfigs: SavedExportConfig[] = [];
	private pendingSavedConfig: SavedExportConfig | null = null;
	private propertySearchText = "";
	private configDropdownOpen = false;

	// Persistent DOM references
	private rootEl: HTMLElement | null = null;
	private topBarEl: HTMLElement | null = null;
	private workspaceEl: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		getConfig: () => ExportViewConfig | null,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.getConfig = getConfig;
	}

	getViewType(): string {
		return VIEW_TYPE_EXPORT;
	}

	getDisplayText(): string {
		if (!this.sourcePath) return "Export";
		const fmt = this.format === "tab" ? "Tab" : "CSV";
		const parts = this.sourcePath.replace(/\\/g, "/").split("/");
		const name = parts[parts.length - 1] || this.sourcePath;
		return `Export ${fmt}: ${name}`;
	}

	getIcon(): string {
		return "file-output";
	}

	async onOpen(): Promise<void> {
		const config = this.getConfig();
		if (!config) {
			this.contentEl.createDiv({
				text: "No export configuration provided.",
				cls: "ft-text-muted ft-p-3",
			});
			return;
		}

		this.exportService = this.dataExchangeService.getExportService();
		this.sourcePath = config.sourcePath;
		this.sourceType = config.sourceType;
		this.format = config.format;
		this.savedConfigs = this.dataExchangeService.getSavedExportConfigs()
			.filter((c) => c.format === config.format);
		this.currentPage = config.sourceType === "base" ? "view-select" : "configure";

		// Default output path
		const baseName = config.sourcePath.replace(/\.\w+$/, "");
		const ext = config.format === "tab" ? ".txt" : ".csv";
		this.outputPath = `${baseName}_export${ext}`;

		try {
			if (this.sourceType === "base") {
				this.baseFile =
					await this.exportService.parseBaseViews(this.sourcePath);
			}
			await this.loadColumnsAndPreview();
		} catch (error) {
			this.loadError =
				error instanceof Error ? error.message : String(error);
		}

		// Pre-apply saved config if provided (e.g. from Hub)
		if (this.pendingSavedConfig) {
			this.applySavedExportConfig(this.pendingSavedConfig.id);
			this.pendingSavedConfig = null;
			this.currentPage = "preview";
		}

		this.buildLayout();
		this.renderPage();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	/** Pre-apply a saved export config when the view opens (skips to preview). */
	setSavedConfig(config: SavedExportConfig): void {
		this.pendingSavedConfig = config;
	}

	// ── Layout skeleton ─────────────────────────────────────

	private buildLayout(): void {
		const el = this.contentEl;
		el.empty();

		this.rootEl = el.createDiv({ cls: "flowti-container" });
		this.rootEl.style.height = "100%";
		this.rootEl.style.display = "flex";
		this.rootEl.style.flexDirection = "column";

		// Top bar
		this.topBarEl = this.rootEl.createDiv({ cls: "ft-view-top-bar" });

		// Workspace
		this.workspaceEl = this.rootEl.createDiv({ cls: "ft-view-workspace" });
	}

	// ── Page routing ────────────────────────────────────────

	private renderPage(): void {
		if (!this.rootEl) return;

		this.renderTopBar();

		if (this.loadError && this.currentPage !== "result") {
			this.renderError();
			return;
		}

		switch (this.currentPage) {
			case "view-select":
				this.renderViewSelectPage();
				break;
			case "configure":
				this.renderConfigurePage();
				break;
			case "preview":
				this.renderPreviewPage();
				break;
			case "result":
				this.renderResultPage();
				break;
		}
	}

	private renderError(): void {
		const ws = this.workspaceEl!;
		ws.empty();
		const container = ws.createDiv({ cls: "ft-table-scroll" });
		container.createEl("h3", { text: "Export", cls: "ft-heading ft-heading-sm" });
		const alert = container.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
		alert.createEl("strong", { text: "Error: " });
		alert.createSpan({ text: this.loadError! });

		const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
		const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(closeBtn.createSpan(), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.leaf.detach());
	}

	// ── Top bar with stepper ────────────────────────────────

	private renderTopBar(): void {
		const bar = this.topBarEl!;
		bar.empty();

		// Source info
		const sourceInfo = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		sourceInfo.style.flexShrink = "0";
		const icon = sourceInfo.createSpan();
		setIcon(icon, "file-output");
		icon.style.opacity = "0.6";

		const parts = this.sourcePath.replace(/\\/g, "/").split("/");
		const name = parts[parts.length - 1] || this.sourcePath;
		sourceInfo.createSpan({ text: name, cls: "ft-text-sm" });

		sourceInfo.createSpan({
			text: this.sourceType,
			cls: "ft-badge ft-badge-muted",
		});
		sourceInfo.createSpan({
			text: this.format === "tab" ? "Tab" : "CSV",
			cls: "ft-badge ft-badge-muted",
		});

		// Stepper
		const stepBar = bar.createDiv({ cls: "ft-step-bar" });
		const steps: ExportPage[] = this.sourceType === "base"
			? ["view-select", "configure", "preview", "result"]
			: ["configure", "preview", "result"];

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			const stepEl = stepBar.createDiv({ cls: "ft-step-indicator" });

			const stepIdx = steps.indexOf(this.currentPage);
			const thisIdx = i;
			let stateClass = "ft-step-pending";
			if (thisIdx < stepIdx) stateClass = "ft-step-completed";
			else if (thisIdx === stepIdx) stateClass = "ft-step-running";
			if (step === "result" && this.exportResult) stateClass = "ft-step-completed";
			if (step === "result" && this.exportError) stateClass = "ft-step-failed";

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
					this.renderPage();
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
					this.applySavedExportConfig(cfg.id);
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
			title: "Save Export Config",
			inputName: "Config name",
			inputDesc: "A descriptive name for this export configuration",
			placeholder: "My export config",
			submitLabel: "Save",
			onSubmit: (name) => {
				void this.dataExchangeService
					.saveExportConfig({
						name,
						sourcePath: this.sourcePath,
						sourceType: this.sourceType,
						format: this.format,
						outputPath: this.outputPath,
						columns: [...this.selectedColumns],
						fileProperties: [...this.selectedFileProperties],
						baseViewIndex: this.baseViewIndex,
						conflictStrategy: this.conflictStrategy,
						isExternal: this.isExternal || undefined,
					})
					.then((saved) => {
						this.savedConfigs = this.dataExchangeService.getSavedExportConfigs()
							.filter((c) => c.format === this.format);
						new Notice(`Config saved: ${saved.name}`);
					})
					.catch((err) =>
						console.error("[Flowti] Failed to save export config", err),
					);
			},
		}).open();
	}

	// ── Page 0: View Select (.base only) ────────────────────

	private renderViewSelectPage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		const container = ws.createDiv({ cls: "ft-table-scroll" });

		if (!this.baseFile || this.baseFile.views.length === 0) {
			container.createEl("p", {
				text: "No views found in this base file.",
				cls: "ft-text-muted",
			});
			const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
			const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => this.leaf.detach());
			return;
		}

		container.createEl("h3", {
			text: "Select View to Export",
			cls: "ft-heading ft-heading-sm ft-mb-3",
		});
		container.createEl("p", {
			text: `${this.baseFile.views.length} view(s) found in ${this.sourcePath}`,
			cls: "ft-text-muted ft-text-sm ft-mb-3",
		});

		const viewGrid = container.createDiv({ cls: "ft-property-grid" });
		for (let i = 0; i < this.baseFile.views.length; i++) {
			const view = this.baseFile.views[i];
			const card = viewGrid.createDiv({
				cls: `ft-property-item ${i === this.baseViewIndex ? "ft-card-selected" : ""}`,
			});
			card.style.cursor = "pointer";
			card.style.padding = "0.75rem";
			card.style.flexDirection = "column";
			card.style.alignItems = "flex-start";

			card.createDiv({
				text: view.name,
				cls: "ft-font-bold",
			});
			card.createDiv({
				text: `Type: ${view.type}${view.order ? ` \u00B7 ${view.order.length} columns` : ""}`,
				cls: "ft-text-muted ft-text-sm",
			});

			const viewIndex = i;
			card.addEventListener("click", () => {
				this.baseViewIndex = viewIndex;
				this.renderPage();
			});
		}

		// Navigation
		const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
		const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(closeBtn.createSpan(), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.leaf.detach());

		const nextBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(nextBtn.createSpan(), "arrow-right");
		nextBtn.appendText(" Configure");
		nextBtn.addEventListener("click", async () => {
			await this.loadColumnsAndPreview();
			this.currentPage = "configure";
			this.renderPage();
		});
	}

	// ── Page 1: Configure (split layout) ────────────────────

	private renderConfigurePage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		const split = ws.createDiv({ cls: "ft-config-split" });

		// ── Left panel: settings ──
		const panel = split.createDiv({ cls: "ft-config-panel" });
		const formatLabel = this.format === "tab" ? "Tab-delimited" : "CSV";
		panel.createEl("h3", {
			text: `Configure Export (${formatLabel})`,
			cls: "ft-heading ft-heading-sm ft-mb-3",
		});

		// Output file
		const targetDesc = this.isExternal
			? "Saving to filesystem (absolute path)"
			: "Saving inside vault";
		const outputSetting = new Setting(panel)
			.setName("Output file")
			.setDesc(targetDesc)
			.addText((text) =>
				text
					.setValue(this.outputPath)
					.setPlaceholder(this.isExternal ? "C:\\path\\to\\output.csv" : "path/to/output.csv")
					.onChange((v) => { this.outputPath = v; }),
			);
		outputSetting.addExtraButton((btn) =>
			btn
				.setIcon("folder")
				.setTooltip("Browse vault folders")
				.onClick(() => this.openFolderPicker()),
		);
		outputSetting.addExtraButton((btn) =>
			btn
				.setIcon("hard-drive")
				.setTooltip("Save to filesystem")
				.onClick(() => this.openNativeSaveDialog()),
		);

		// Conflict strategy
		new Setting(panel)
			.setName("If file exists")
			.setDesc("How to handle an existing output file")
			.addDropdown((dd) =>
				dd
					.addOptions({
						overwrite: "Overwrite",
						skip: "Skip (do nothing)",
						append: "Append rows",
					})
					.setValue(this.conflictStrategy)
					.onChange((v) => { this.conflictStrategy = v as ExportConflictStrategy; }),
			);

		// File Properties
		panel.createEl("h4", { text: "File Properties", cls: "ft-mt-4 ft-heading ft-heading-sm" });
		panel.createEl("p", {
			text: "Standard Obsidian file properties to include.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		const filePropsContainer = panel.createDiv({ cls: "ft-flex-col ft-gap-1" });
		for (const fp of STANDARD_FILE_PROPERTIES) {
			const label = filePropsContainer.createEl("label", {
				cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm",
			});
			const cb = label.createEl("input", { type: "checkbox" });
			cb.checked = this.selectedFileProperties.includes(fp.key);
			const key = fp.key;
			cb.addEventListener("change", () => {
				if (cb.checked) {
					if (!this.selectedFileProperties.includes(key)) {
						this.selectedFileProperties.push(key);
					}
				} else {
					this.selectedFileProperties = this.selectedFileProperties.filter(
						(p) => p !== key,
					);
				}
			});
			label.createSpan({ text: fp.label });
		}

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

		if (this.sourceType === "base") {
			const backBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(backBtn.createSpan(), "arrow-left");
			backBtn.appendText(" Views");
			backBtn.addEventListener("click", () => {
				this.currentPage = "view-select";
				this.renderPage();
			});
		} else {
			const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => this.leaf.detach());
		}

		const nextBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(nextBtn.createSpan(), "arrow-right");
		nextBtn.appendText(" Preview");
		nextBtn.addEventListener("click", () => {
			this.currentPage = "preview";
			this.renderPage();
		});

		// ── Right panel: note properties ──
		const content = split.createDiv({ cls: "ft-config-content" });

		const header = content.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		header.createEl("h3", { text: "Note Properties", cls: "ft-heading ft-heading-sm" });
		header.style.flex = "1";

		if (this.availableColumns.length > 0) {
			// Select all / deselect all
			const selectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			selectAllBtn.textContent = "All";
			selectAllBtn.addEventListener("click", () => {
				this.selectedColumns = [...this.availableColumns];
				this.renderConfigurePage();
			});

			const deselectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			deselectAllBtn.textContent = "None";
			deselectAllBtn.addEventListener("click", () => {
				this.selectedColumns = [];
				this.renderConfigurePage();
			});
		}

		if (this.availableColumns.length === 0) {
			content.createEl("p", {
				text: "No frontmatter properties found in the source files.",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			// Search
			const search = content.createEl("input", {
				type: "text",
				cls: "ft-column-search",
			});
			search.placeholder = "Search properties...";
			search.value = this.propertySearchText;
			search.addEventListener("input", () => {
				this.propertySearchText = search.value;
				this.renderPropertyGrid(gridContainer);
			});

			// Property grid
			const gridContainer = content.createDiv();
			this.renderPropertyGrid(gridContainer);
		}
	}

	private renderPropertyGrid(container: HTMLElement): void {
		container.empty();

		const searchLower = this.propertySearchText.toLowerCase();
		const filtered = this.availableColumns.filter((col) =>
			!searchLower || col.toLowerCase().includes(searchLower),
		);

		const grid = container.createDiv({ cls: "ft-property-grid" });

		for (const col of filtered) {
			const item = grid.createDiv({ cls: "ft-property-item" });
			const cb = item.createEl("input", { type: "checkbox" });
			cb.checked = this.selectedColumns.includes(col);
			cb.addEventListener("change", () => {
				if (cb.checked) {
					if (!this.selectedColumns.includes(col)) {
						this.selectedColumns.push(col);
					}
				} else {
					this.selectedColumns = this.selectedColumns.filter((c) => c !== col);
				}
			});
			item.createSpan({ text: col });
		}

		if (filtered.length === 0) {
			container.createEl("p", {
				text: this.propertySearchText ? "No matching properties" : "No properties available",
				cls: "ft-text-muted ft-text-sm ft-p-3",
			});
		}
	}

	// ── Page 2: Preview ─────────────────────────────────────

	private renderPreviewPage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		const dn = this.displayNames;
		const fileHeaders: { key: string; label: string }[] =
			this.selectedFileProperties.map((key) => ({
				key,
				label: dn[key] ?? this.getFilePropertyLabel(key),
			}));
		const columnHeaders: { key: string; label: string }[] =
			this.selectedColumns.map((col) => ({
				key: col,
				label: dn[col] ?? dn[`note.${col}`] ?? col,
			}));
		const allHeaders = [
			...fileHeaders.map((h) => h.label),
			...columnHeaders.map((h) => h.label),
		];

		// Stats bar
		const statsBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-px-3 ft-py-2" });
		statsBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		statsBar.style.flexShrink = "0";

		statsBar.createSpan({
			text: `${this.previewFiles.length} rows`,
			cls: "ft-badge ft-badge-muted",
		});
		statsBar.createSpan({
			text: `${allHeaders.length} columns`,
			cls: "ft-badge ft-badge-muted",
		});

		// Validation
		const issues: string[] = [];
		if (!this.outputPath.trim()) issues.push("Output path is required");
		if (allHeaders.length === 0) issues.push("At least one column is required");

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
			this.currentPage = "configure";
			this.renderPage();
		});

		if (issues.length === 0) {
			const exportBtn = statsBar.createEl("span", { cls: "ft-nav-link" });
			setIcon(exportBtn.createSpan(), "play");
			exportBtn.appendText(" Export");
			exportBtn.addEventListener("click", () => {
				this.currentPage = "result";
				this.renderPage();
				void this.runExport();
			});
		}

		if (allHeaders.length === 0) {
			const scroll = ws.createDiv({ cls: "ft-table-scroll" });
			scroll.createEl("p", {
				text: "No columns selected. Go back and select at least one column.",
				cls: "ft-text-muted ft-p-3",
			});
			return;
		}

		// Table scroll area
		const scroll = ws.createDiv({ cls: "ft-table-scroll" });
		const table = scroll.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of allHeaders) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		const maxPreview = 25;
		const previewSlice = this.previewFiles.slice(0, maxPreview);

		for (const file of previewSlice) {
			const tr = tbody.createEl("tr");
			for (const fh of fileHeaders) {
				tr.createEl("td", { text: this.resolveFileProperty(file, fh.key) });
			}
			for (const ch of columnHeaders) {
				const val = file.frontmatter?.[ch.key];
				tr.createEl("td", {
					text:
						val !== undefined && val !== null
							? String(val)
							: "",
				});
			}
		}

		if (this.previewFiles.length > maxPreview) {
			scroll.createEl("p", {
				text: `Showing ${maxPreview} of ${this.previewFiles.length} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		} else {
			scroll.createEl("p", {
				text: `${this.previewFiles.length} rows total`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		}
	}

	// ── Page 3: Result ──────────────────────────────────────

	private renderResultPage(): void {
		const ws = this.workspaceEl!;
		ws.empty();

		const container = ws.createDiv({ cls: "ft-table-scroll" });

		if (this.exportResult) {
			this.renderExportResult(container);
			return;
		}

		if (this.exportError) {
			container.createEl("h3", { text: "Export Failed", cls: "ft-heading ft-heading-sm" });
			const alert = container.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
			alert.createEl("strong", { text: "Error: " });
			alert.createSpan({ text: this.exportError });

			const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
			const backBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(backBtn.createSpan(), "arrow-left");
			backBtn.appendText(" Config");
			backBtn.addEventListener("click", () => {
				this.exportError = null;
				this.currentPage = "configure";
				this.renderPage();
			});
			const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => this.leaf.detach());
			return;
		}

		container.createEl("h3", { text: "Exporting...", cls: "ft-heading ft-heading-sm" });
		const progressContainer = container.createDiv({ cls: "ft-flex-col ft-gap-2 ft-mt-3" });
		progressContainer.createDiv({
			text: "Writing export file...",
			cls: "ft-text-muted",
		});
		const bar = progressContainer.createDiv({ cls: "ft-progress-bar" });
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		fill.style.width = "100%";
		fill.style.animation = "ft-pulse 1.5s infinite";
	}

	private renderExportResult(container: HTMLElement): void {
		const r = this.exportResult!;

		if (r.skipped) {
			container.createEl("h3", { text: "Export Skipped", cls: "ft-heading ft-heading-sm" });
			const info = container.createDiv({ cls: "ft-card ft-p-3 ft-mt-3" });
			info.createDiv({ text: `File already exists: ${r.outputPath}` });
			info.createDiv({
				text: "The conflict strategy was set to \"skip\", so no changes were made.",
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
			new Notice(`Export skipped: ${r.outputPath} already exists`);

			const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
			const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => this.leaf.detach());
			return;
		}

		container.createEl("h3", { text: "Export Complete", cls: "ft-heading ft-heading-sm" });

		// Stats grid
		const statsGrid = container.createDiv({ cls: "ft-detail-info-grid ft-mt-3" });
		const addRow = (label: string, value: string) => {
			statsGrid.createDiv({ text: label, cls: "ft-detail-info-label" });
			statsGrid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};
		addRow("Rows exported", String(r.totalRows));
		addRow("Columns", String(r.totalColumns));
		addRow("Output file", r.outputPath);

		new Notice(
			`Export complete: ${r.totalRows} rows written to ${r.outputPath}`,
		);

		const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
		const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(closeBtn.createSpan(), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.leaf.detach());
	}

	// ── Execution ───────────────────────────────────────────

	private async runExport(): Promise<void> {
		try {
			this.exportResult = await this.exportService.executeExport({
				sourcePath: this.sourcePath,
				sourceType: this.sourceType,
				format: this.format,
				outputPath: this.outputPath,
				columns: this.selectedColumns,
				fileProperties: [...this.selectedFileProperties],
				baseViewIndex: this.baseViewIndex,
				displayNames: Object.keys(this.displayNames).length > 0
					? this.displayNames
					: undefined,
				isExternal: this.isExternal || undefined,
				conflictStrategy: this.conflictStrategy,
			});
		} catch (error) {
			this.exportError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderPage();
	}

	// ── Helpers ─────────────────────────────────────────────

	private getFilePropertyLabel(key: string): string {
		const def = STANDARD_FILE_PROPERTIES.find((p: FilePropertyDef) => p.key === key);
		return def?.label ?? key.replace(/^file\./, "");
	}

	private resolveFileProperty(file: VaultFileInfo, key: string): string {
		switch (key) {
			case "file.name": return file.basename;
			case "file.basename": return file.basename;
			case "file.fullname": return `${file.basename}.${file.extension}`;
			case "file.path": return file.path;
			case "file.folder": return file.folder;
			case "file.ext": return file.extension;
			case "file.ctime":
				return file.stat?.ctime ? new Date(file.stat.ctime).toISOString() : "";
			case "file.mtime":
				return file.stat?.mtime ? new Date(file.stat.mtime).toISOString() : "";
			case "file.size":
				return file.stat?.size !== undefined ? String(file.stat.size) : "";
			case "file.tags": return file.tags?.join(", ") ?? "";
			default: return "";
		}
	}

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			const filename = this.getFilenameFromPath(this.outputPath);
			this.outputPath = folder ? `${folder}/${filename}` : filename;
			this.isExternal = false;
			this.renderPage();
		}).open();
	}

	private async openNativeSaveDialog(): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { remote } = require("electron");
			const ext = this.format === "tab" ? "txt" : "csv";
			const filters = this.format === "tab"
				? [{ name: "Tab-Separated", extensions: ["txt", "tsv"] }, { name: "All Files", extensions: ["*"] }]
				: [{ name: "CSV Files", extensions: ["csv"] }, { name: "All Files", extensions: ["*"] }];

			const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
				defaultPath: this.getFilenameFromPath(this.outputPath) || `export.${ext}`,
				filters,
			});

			if (!result.canceled && result.filePath) {
				this.outputPath = result.filePath;
				this.isExternal = true;
				this.renderPage();
			}
		} catch {
			new Notice("Could not open save dialog. Try entering the path manually.");
		}
	}

	private getFilenameFromPath(p: string): string {
		const parts = p.replace(/\\/g, "/").split("/");
		return parts[parts.length - 1] || p;
	}

	// ── Config save/load ────────────────────────────────────

	private applySavedExportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		// Never override format — it's determined by how the view was opened
		this.outputPath = cfg.outputPath;
		this.selectedColumns = [...cfg.columns];
		this.selectedFileProperties = [...cfg.fileProperties];
		this.conflictStrategy = cfg.conflictStrategy ?? "overwrite";
		if (cfg.baseViewIndex !== undefined) {
			this.baseViewIndex = cfg.baseViewIndex;
		}
		if (cfg.isExternal !== undefined) {
			this.isExternal = cfg.isExternal;
		}
		new Notice(`Loaded config: ${cfg.name}`);
		this.renderPage();
	}

	private async loadColumnsAndPreview(): Promise<void> {
		this.availableColumns = await this.exportService.scanColumns(
			this.sourcePath,
			this.sourceType,
			this.baseViewIndex,
		);
		this.selectedColumns = [...this.availableColumns];
		this.previewFiles = await this.exportService.resolveExportFiles(
			this.sourcePath,
			this.sourceType,
			this.baseViewIndex,
		);

		if (this.sourceType === "base") {
			const viewFileProps =
				await this.exportService.scanViewFileProperties(
					this.sourcePath,
					this.baseViewIndex,
				);
			// Respect the view's explicit configuration — no forced defaults
			this.selectedFileProperties = viewFileProps;

			this.displayNames =
				await this.exportService.scanDisplayNames(this.sourcePath);
		}
	}
}
