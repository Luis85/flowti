/**
 * Data Exchange Hub — central management view for import/export operations.
 *
 * Follows the same layout and patterns as EventCatalogView:
 * - Dashboard is the landing page (full-height, scrollable, padded)
 * - Sub-pages (Imports / Exports / Dictionary) use the master/detail split layout
 * - Top bar appears on sub-pages with clickable title to return to dashboard
 * - Consistent CSS class usage: ft-catalog-*, ft-master-*, ft-detail-*
 */

import { ItemView, Notice, Setting, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type {
	DataDictionaryEntry,
	SavedImportConfig,
	SavedExportConfig,
} from "../domain/dataExchange/types";
import { ConfirmModal } from "./modals";
import { FilePickerModal } from "./FilePickerModal";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";

export const VIEW_TYPE_DATA_EXCHANGE_HUB = "flowti-data-exchange-hub";

type HubPage = "dashboard" | "imports" | "exports" | "reports" | "properties";

export class DataExchangeHubView extends ItemView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private openCsvImport: (
		csvPath: string,
		savedConfig?: SavedImportConfig,
	) => void;
	private openExport: (savedConfig: SavedExportConfig) => void;

	// State
	private currentPage: HubPage = "dashboard";
	private importConfigs: SavedImportConfig[] = [];
	private exportConfigs: SavedExportConfig[] = [];
	private selectedImportId: string | null = null;
	private selectedExportId: string | null = null;
	private selectedDictProp: string | null = null;
	private selectedReportPath: string | null = null;
	private dictionaryEntries: DataDictionaryEntry[] = [];
	private reportEntries: Array<{ name: string; path: string; frontmatter: Record<string, unknown> }> = [];
	private filterText = "";
	private editingImportId: string | null = null;
	private editingExportId: string | null = null;

	// DOM references
	private topBarEl!: HTMLElement;
	private countBadgeEl!: HTMLElement;
	private dashboardEl!: HTMLElement;
	private splitEl!: HTMLElement;
	private masterTreeEl!: HTMLElement;
	private detailPanelEl!: HTMLElement;
	private searchInput!: HTMLInputElement;

	// Render
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribes: (() => void)[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		openCsvImport: (
			csvPath: string,
			savedConfig?: SavedImportConfig,
		) => void,
		openExport: (savedConfig: SavedExportConfig) => void,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.openCsvImport = openCsvImport;
		this.openExport = openExport;
	}

	getViewType(): string {
		return VIEW_TYPE_DATA_EXCHANGE_HUB;
	}

	getDisplayText(): string {
		return "Data Exchange";
	}

	getIcon(): string {
		return "arrow-left-right";
	}

	// ── Lifecycle ────────────────────────────────────────────

	async onOpen(): Promise<void> {
		this.refreshConfigs();

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		// Root wrapper — same as EventCatalogView
		const wrapper = container.createDiv({ cls: "flowti-container" });
		wrapper.style.height = "100%";
		wrapper.style.display = "flex";
		wrapper.style.flexDirection = "column";

		// Top bar (hidden on dashboard, shown on sub-pages)
		this.renderTopBar(wrapper);

		// Dashboard panel (shown by default)
		this.dashboardEl = wrapper.createDiv({ cls: "ft-catalog-dashboard" });
		this.dashboardEl.style.flex = "1";
		this.dashboardEl.style.minHeight = "0";
		this.dashboardEl.style.overflowY = "auto";
		this.dashboardEl.style.padding = "1.5rem";

		// Split container (hidden when dashboard is active)
		this.splitEl = wrapper.createDiv({ cls: "ft-catalog-split ft-hidden" });
		this.splitEl.style.flex = "1";
		this.splitEl.style.minHeight = "0";

		// Master panel (left)
		const master = this.splitEl.createDiv({ cls: "ft-catalog-master" });

		// Search
		const searchHeader = master.createDiv({ cls: "ft-catalog-master-header" });
		this.searchInput = searchHeader.createEl("input", { cls: "ft-catalog-master-search" });
		this.searchInput.type = "text";
		this.searchInput.placeholder = "Search configs...";
		this.searchInput.addEventListener("input", () => {
			this.filterText = this.searchInput.value.toLowerCase();
			this.scheduleRender();
		});

		// Master tree
		this.masterTreeEl = master.createDiv({ cls: "ft-catalog-master-tree" });

		// Detail panel (right)
		this.detailPanelEl = this.splitEl.createDiv({ cls: "ft-catalog-detail" });

		// Subscribe to config changes
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.config.changed", () => {
				this.refreshConfigs();
				this.scheduleRender();
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.completed", () => {
				this.scheduleRender();
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.export.completed", () => {
				this.scheduleRender();
			}),
		);

		this.renderDashboard();
	}

	async onClose(): Promise<void> {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── State ────────────────────────────────────────────────

	private refreshConfigs(): void {
		this.importConfigs = this.dataExchangeService.getSavedImportConfigs();
		this.exportConfigs = this.dataExchangeService.getSavedExportConfigs();
		this.dictionaryEntries = this.dataExchangeService.buildDataDictionary();
		this.scanCsvDocs();
	}

	/** Scans the Reports folder for CsvDoc files and populates reportEntries. */
	private scanCsvDocs(): void {
		this.reportEntries = [];
		const folder = this.dataExchangeService.getReportsFolderPath();
		const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
		if (!abstractFolder) return;

		// Get all markdown files in the Reports folder that start with "CSV - "
		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			if (!file.path.startsWith(folder + "/")) continue;
			if (!file.basename.startsWith("CSV - ")) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm?.type !== "CsvDoc") continue;
			this.reportEntries.push({
				name: fm.name ? String(fm.name) : file.basename.replace("CSV - ", ""),
				path: file.path,
				frontmatter: fm,
			});
		}
		this.reportEntries.sort((a, b) => a.name.localeCompare(b.name));
	}

	private updateCountBadge(): void {
		if (!this.countBadgeEl) return;
		const total = this.importConfigs.length + this.exportConfigs.length;
		this.countBadgeEl.textContent = `${total} config${total !== 1 ? "s" : ""}`;
	}

	private scheduleRender(): void {
		if (this.renderTimer) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.refreshConfigs();
			this.updateCountBadge();
			switch (this.currentPage) {
				case "dashboard":
					this.renderDashboard();
					break;
				case "imports":
					this.renderImportsMaster();
					this.renderImportsDetail();
					break;
				case "exports":
					this.renderExportsMaster();
					this.renderExportsDetail();
					break;
				case "reports":
					this.renderReportsMaster();
					this.renderReportsDetail();
					break;
				case "properties":
					this.renderPropertiesMaster();
					this.renderPropertiesDetail();
					break;
			}
		}, 16);
	}

	// ── Navigation ──────────────────────────────────────────

	private navigateTo(page: HubPage): void {
		this.currentPage = page;
		const isDashboard = page === "dashboard";

		// Toggle dashboard vs split (same pattern as EventCatalogView.onTabChanged)
		this.dashboardEl.classList.toggle("ft-hidden", !isDashboard);
		this.splitEl.classList.toggle("ft-hidden", isDashboard);
		this.topBarEl.classList.toggle("ft-hidden", isDashboard);

		if (!isDashboard) {
			const placeholders: Record<string, string> = {
				imports: "Search import configs...",
				exports: "Search export configs...",
				reports: "Search reports...",
				properties: "Search properties...",
			};
			this.searchInput.placeholder = placeholders[page] ?? "Search...";
			this.filterText = "";
			this.searchInput.value = "";
		}

		this.editingImportId = null;
		this.editingExportId = null;
		this.scheduleRender();
	}

	/** Opens the imports page and selects a specific config (for external callers). */
	showImportConfig(configId: string): void {
		this.selectedImportId = configId;
		this.navigateTo("imports");
	}

	// ── Top bar ─────────────────────────────────────────────

	private renderTopBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2 ft-hidden" });
		bar.style.borderBottom = "1px solid var(--background-modifier-border)";
		bar.style.flexShrink = "0";
		this.topBarEl = bar;

		const title = bar.createSpan({
			text: "Data Exchange",
			cls: "ft-heading ft-heading-sm",
		});
		title.style.cursor = "pointer";
		title.addEventListener("click", () => this.navigateTo("dashboard"));

		this.countBadgeEl = bar.createSpan({
			cls: "ft-badge ft-badge-muted",
		});
		this.updateCountBadge();

		// Spacer
		const spacer = bar.createDiv();
		spacer.style.flex = "1";

		// Import quick action — uses FilePickerModal
		const importBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const importIcon = importBtn.createSpan();
		setIcon(importIcon, "file-input");
		importBtn.appendText(" Import CSV");
		importBtn.addEventListener("click", () => {
			new FilePickerModal(this.app, ["csv"], (csvPath) => {
				this.openCsvImport(csvPath);
			}).open();
		});

		// Export quick action — uses FolderPickerModal
		const exportBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const exportIcon = exportBtn.createSpan();
		setIcon(exportIcon, "file-output");
		exportBtn.appendText(" Export");
		exportBtn.addEventListener("click", () => {
			const folders = getVaultFolders(this.app);
			new FolderPickerModal(this.app, folders, (folderPath) => {
				this.openExport({
					id: "",
					name: "",
					createdAt: 0,
					sourcePath: folderPath,
					sourceType: "folder",
					format: "csv",
					outputPath: `${folderPath}_export.csv`,
					columns: [],
					fileProperties: ["file.name"],
				});
			}).open();
		});
	}

	// ── Dashboard ────────────────────────────────────────────

	private renderDashboard(): void {
		this.dashboardEl.empty();

		// Stats grid — 4 columns
		const grid = this.dashboardEl.createDiv({ cls: "ft-dashboard-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(4, 1fr)";
		grid.style.gap = "0.75rem";
		grid.style.marginBottom = "1.5rem";

		this.renderDashboardCard(grid, "file-input", this.importConfigs.length, "Saved Imports", () => {
			this.navigateTo("imports");
		});
		this.renderDashboardCard(grid, "file-output", this.exportConfigs.length, "Saved Exports", () => {
			this.navigateTo("exports");
		});
		this.renderDashboardCard(grid, "file-spreadsheet", this.reportEntries.length, "Reports", () => {
			this.navigateTo("reports");
		});
		this.renderDashboardCard(grid, "tag", this.dictionaryEntries.length, "Properties", () => {
			this.navigateTo("properties");
		});

		// Quick actions
		const actionsSection = this.dashboardEl.createDiv();
		actionsSection.createEl("h3", { text: "Quick Actions", cls: "ft-heading ft-heading-sm" });
		actionsSection.style.marginBottom = "0.75rem";

		const actionsGrid = actionsSection.createDiv({ cls: "ft-flex ft-gap-2" });
		actionsGrid.style.flexWrap = "wrap";

		const actions: Array<{ icon: string; label: string; action: () => void }> = [
			{
				icon: "file-input",
				label: "Import CSV",
				action: () => {
					new FilePickerModal(this.app, ["csv"], (csvPath) => {
						this.openCsvImport(csvPath);
					}).open();
				},
			},
			{
				icon: "file-output",
				label: "Export Folder",
				action: () => {
					const folders = getVaultFolders(this.app);
					new FolderPickerModal(this.app, folders, (folderPath) => {
						this.openExport({
							id: "",
							name: "",
							createdAt: 0,
							sourcePath: folderPath,
							sourceType: "folder",
							format: "csv",
							outputPath: `${folderPath}_export.csv`,
							columns: [],
							fileProperties: ["file.name"],
						});
					}).open();
				},
			},
			{
				icon: "database",
				label: "Export .base",
				action: () => {
					new FilePickerModal(this.app, ["base"], (basePath) => {
						this.openExport({
							id: "",
							name: "",
							createdAt: 0,
							sourcePath: basePath,
							sourceType: "base",
							format: "csv",
							outputPath: basePath.replace(/\.base$/, "_export.csv"),
							columns: [],
							fileProperties: ["file.name"],
						});
					}).open();
				},
			},
			{
				icon: "book-open",
				label: "Properties",
				action: () => this.navigateTo("properties"),
			},
		];

		for (const act of actions) {
			const btn = actionsGrid.createEl("span", { cls: "ft-nav-link" });
			const icon = btn.createSpan();
			setIcon(icon, act.icon);
			btn.appendText(` ${act.label}`);
			btn.addEventListener("click", act.action);
		}

		// Recent configs
		const allConfigs = [
			...this.importConfigs.map((c) => ({ ...c, configType: "import" as const })),
			...this.exportConfigs.map((c) => ({ ...c, configType: "export" as const })),
		]
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, 5);

		if (allConfigs.length > 0) {
			const recentSection = this.dashboardEl.createDiv();
			recentSection.style.marginTop = "1.5rem";
			recentSection.createEl("h3", { text: "Recent Configs", cls: "ft-heading ft-heading-sm" });
			recentSection.style.marginBottom = "0.75rem";

			for (const cfg of allConfigs) {
				const item = recentSection.createDiv({
					cls: "ft-master-event-item",
				});

				const iconEl = item.createSpan();
				iconEl.style.flexShrink = "0";
				iconEl.style.opacity = "0.5";
				setIcon(iconEl, cfg.configType === "import" ? "file-input" : "file-output");

				item.createSpan({ text: cfg.name || "(unnamed)", cls: "ft-master-event-name" });

				item.createSpan({
					text: cfg.configType === "import" ? "Import" : "Export",
					cls: `ft-operation-badge ft-operation-badge-${cfg.configType}`,
				});

				item.createSpan({
					text: new Date(cfg.createdAt).toLocaleDateString(),
					cls: "ft-master-category-count",
				});

				item.addEventListener("click", () => {
					if (cfg.configType === "import") {
						this.selectedImportId = cfg.id;
						this.navigateTo("imports");
					} else {
						this.selectedExportId = cfg.id;
						this.navigateTo("exports");
					}
				});
			}
		}
	}

	private renderDashboardCard(
		container: HTMLElement,
		icon: string,
		count: number,
		label: string,
		onClick: () => void,
	): void {
		const el = container.createDiv({ cls: "ft-dashboard-card" });
		el.style.border = "1px solid var(--background-modifier-border)";
		el.style.borderRadius = "8px";
		el.style.padding = "1rem";
		el.style.cursor = "pointer";
		el.style.display = "flex";
		el.style.alignItems = "center";
		el.style.gap = "0.75rem";
		el.style.transition = "border-color 0.15s";
		el.addEventListener("mouseenter", () => {
			el.style.borderColor = "var(--interactive-accent)";
		});
		el.addEventListener("mouseleave", () => {
			el.style.borderColor = "var(--background-modifier-border)";
		});
		el.addEventListener("click", onClick);

		const iconEl = el.createDiv();
		iconEl.style.opacity = "0.6";
		setIcon(iconEl, icon);

		const text = el.createDiv();
		text.createDiv({ text: String(count), cls: "ft-catalog-stat-value" });
		text.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}

	// ── Imports page ─────────────────────────────────────────

	private renderImportsMaster(): void {
		this.masterTreeEl.empty();

		let configs = this.importConfigs;
		if (this.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(this.filterText) ||
					c.targetFolder.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Import Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = this.filterText
				? "No matching import configs"
				: "No saved import configs yet";
			return;
		}

		for (const cfg of configs) {
			this.renderImportItem(cfg);
		}
	}

	private renderImportItem(cfg: SavedImportConfig): void {
		const isSelected = this.selectedImportId === cfg.id;
		const item = this.masterTreeEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "file-input");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";

		item.createSpan({ text: cfg.name || "(unnamed)", cls: "ft-master-event-name" });

		item.createSpan({
			text: cfg.targetFolder || "(no folder)",
			cls: "ft-badge ft-badge-muted",
		});

		item.createSpan({
			text: cfg.conflictStrategy,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.selectedImportId = cfg.id;
			this.editingImportId = null;
			this.renderImportsMaster();
			this.renderImportsDetail();
		});
	}

	private renderImportsDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedImportId) {
			this.renderEmptyDetail("file-input", "Select an import config to view details");
			return;
		}

		const cfg = this.importConfigs.find((c) => c.id === this.selectedImportId);
		if (!cfg) {
			this.renderEmptyDetail("file-input", "Config not found");
			return;
		}

		// Check if editing
		if (this.editingImportId === cfg.id) {
			this.renderImportEditForm(cfg);
			return;
		}

		// Header with operation badge
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Import", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });

		// Info grid
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		if (cfg.sourcePath) {
			this.addInfoRow(grid, "Source CSV", cfg.sourcePath);
		}
		this.addInfoRow(grid, "Target Folder", cfg.targetFolder || "(not set)");
		this.addInfoRow(grid, "Name Column", cfg.nameColumn || "(not set)");
		this.addInfoRow(grid, "Conflict Strategy", cfg.conflictStrategy);
		this.addInfoRow(grid, "Columns", String(cfg.columnMappings.length));
		if (cfg.customProperties && Object.keys(cfg.customProperties).length > 0) {
			this.addInfoRow(grid, "Custom Properties", String(Object.keys(cfg.customProperties).length));
		}
		if (cfg.createBase) {
			this.addInfoRow(grid, "Base View", cfg.basePath || "(auto)");
		}
		this.addInfoRow(grid, "Created", new Date(cfg.createdAt).toLocaleString());

		// Column mappings section
		if (cfg.columnMappings.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Column Mappings", cls: "ft-detail-section-header" });
			const table = section.createEl("table", { cls: "ft-preview-table" });
			const thead = table.createEl("tr");
			thead.createEl("th", { text: "CSV Column" });
			thead.createEl("th", { text: "Frontmatter Key" });
			thead.createEl("th", { text: "Included" });
			for (const m of cfg.columnMappings) {
				const tr = table.createEl("tr");
				tr.createEl("td", { text: m.csvColumn });
				tr.createEl("td", { text: m.frontmatterKey });
				tr.createEl("td", { text: m.included ? "Yes" : "No" });
			}
		}

		// Custom properties section
		if (cfg.customProperties && Object.keys(cfg.customProperties).length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Custom Properties", cls: "ft-detail-section-header" });
			const propGrid = section.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, val] of Object.entries(cfg.customProperties)) {
				this.addInfoRow(propGrid, key, val);
			}
		}

		// Doc link
		this.renderDocLink(this.detailPanelEl, cfg.name, "import");

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		// Run Now (one-click execute)
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Run Now");
		runLink.addEventListener("click", () => {
			if (cfg.sourcePath) {
				this.executeImportConfig(cfg);
			} else {
				new FilePickerModal(this.app, ["csv"], (csvPath) => {
					this.executeImportConfigWithSource(cfg, csvPath);
				}).open();
			}
		});

		// Preview
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const prevIcon = previewLink.createSpan();
		setIcon(prevIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			if (cfg.sourcePath) {
				this.openCsvImport(cfg.sourcePath, cfg);
			} else {
				new FilePickerModal(this.app, ["csv"], (csvPath) => {
					this.openCsvImport(csvPath, cfg);
				}).open();
			}
		});

		// Edit
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Edit");
		editLink.addEventListener("click", () => {
			this.editingImportId = cfg.id;
			this.renderImportsDetail();
		});

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete import config "${cfg.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.dataExchangeService
						.deleteImportConfig(cfg.id)
						.then(() => {
							this.selectedImportId = null;
							this.refreshConfigs();
							this.renderImportsMaster();
							this.renderImportsDetail();
							new Notice("Import config deleted");
						});
				},
			}).open();
		});
	}

	private renderImportEditForm(cfg: SavedImportConfig): void {
		const panel = this.detailPanelEl;
		panel.createEl("h3", { text: "Edit Import Config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedImportConfig> = {
			name: cfg.name,
			targetFolder: cfg.targetFolder,
			nameColumn: cfg.nameColumn,
			conflictStrategy: cfg.conflictStrategy,
			createBase: cfg.createBase ?? false,
			basePath: cfg.basePath ?? "",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.addText((t) => t.setValue(cfg.targetFolder).onChange((v) => { edits.targetFolder = v; }));
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.app);
				new FolderPickerModal(this.app, folders, (folder) => {
					edits.targetFolder = folder;
					this.renderImportsDetail();
				}).open();
			}),
		);

		new Setting(panel)
			.setName("Name column")
			.addText((t) => t.setValue(cfg.nameColumn).onChange((v) => { edits.nameColumn = v; }));

		new Setting(panel)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOptions({ skip: "Skip", update: "Update frontmatter", overwrite: "Overwrite" })
					.setValue(cfg.conflictStrategy)
					.onChange((v) => { edits.conflictStrategy = v as SavedImportConfig["conflictStrategy"]; }),
			);

		new Setting(panel)
			.setName("Create .base view")
			.setDesc("Generate a table view for imported notes")
			.addToggle((toggle) =>
				toggle
					.setValue(edits.createBase ?? false)
					.onChange((v) => {
						edits.createBase = v || undefined;
						basePathSetting.settingEl.toggle(v);
					}),
			);

		const basePathSetting = new Setting(panel)
			.setName("Base file path")
			.setDesc("Where to save the .base view file")
			.addText((t) =>
				t
					.setValue(edits.basePath ?? "")
					.setPlaceholder("path/to/view.base")
					.onChange((v) => { edits.basePath = v || undefined; }),
			);
		basePathSetting.settingEl.toggle(edits.createBase ?? false);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.dataExchangeService
				.updateImportConfig(cfg.id, edits)
				.then(() => {
					this.editingImportId = null;
					this.refreshConfigs();
					this.renderImportsMaster();
					this.renderImportsDetail();
					new Notice("Import config updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.editingImportId = null;
			this.renderImportsDetail();
		});
	}

	// ── Exports page ─────────────────────────────────────────

	private renderExportsMaster(): void {
		this.masterTreeEl.empty();

		let configs = this.exportConfigs;
		if (this.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(this.filterText) ||
					c.sourcePath.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Export Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = this.filterText
				? "No matching export configs"
				: "No saved export configs yet";
			return;
		}

		for (const cfg of configs) {
			this.renderExportItem(cfg);
		}
	}

	private renderExportItem(cfg: SavedExportConfig): void {
		const isSelected = this.selectedExportId === cfg.id;
		const item = this.masterTreeEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "file-output");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";

		item.createSpan({ text: cfg.name || "(unnamed)", cls: "ft-master-event-name" });

		item.createSpan({
			text: cfg.format.toUpperCase(),
			cls: "ft-badge ft-badge-muted",
		});

		item.createSpan({
			text: cfg.sourceType,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.selectedExportId = cfg.id;
			this.editingExportId = null;
			this.renderExportsMaster();
			this.renderExportsDetail();
		});
	}

	private renderExportsDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedExportId) {
			this.renderEmptyDetail("file-output", "Select an export config to view details");
			return;
		}

		const cfg = this.exportConfigs.find((c) => c.id === this.selectedExportId);
		if (!cfg) {
			this.renderEmptyDetail("file-output", "Config not found");
			return;
		}

		// Check if editing
		if (this.editingExportId === cfg.id) {
			this.renderExportEditForm(cfg);
			return;
		}

		// Header with operation badge
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Export", cls: "ft-operation-badge ft-operation-badge-export" });
		badges.createSpan({ text: cfg.format.toUpperCase(), cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: cfg.sourceType, cls: "ft-badge ft-badge-muted" });

		// Info grid
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		this.addInfoRow(grid, "Source", cfg.sourcePath);
		this.addInfoRow(grid, "Source Type", cfg.sourceType);
		this.addInfoRow(grid, "Format", cfg.format === "tab" ? "Tab-delimited" : "CSV");
		this.addInfoRow(grid, "Output", cfg.outputPath || "(not set)");
		if (cfg.conflictStrategy) {
			this.addInfoRow(grid, "Conflict Strategy", cfg.conflictStrategy);
		}
		if (cfg.baseViewIndex !== undefined) {
			this.addInfoRow(grid, "Base View Index", String(cfg.baseViewIndex));
		}
		this.addInfoRow(grid, "Created", new Date(cfg.createdAt).toLocaleString());

		// Columns section
		if (cfg.columns.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: `Note Properties (${cfg.columns.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const col of cfg.columns) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// File properties section
		if (cfg.fileProperties.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: `File Properties (${cfg.fileProperties.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const fp of cfg.fileProperties) {
				chips.createSpan({ text: fp.replace("file.", ""), cls: "ft-badge ft-badge-muted" });
			}
		}

		// Doc link
		this.renderDocLink(this.detailPanelEl, cfg.name, "export");

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		// Run Now (one-click execute)
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Run Now");
		runLink.addEventListener("click", () => {
			this.executeExportConfig(cfg);
		});

		// Preview
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const prevIcon = previewLink.createSpan();
		setIcon(prevIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			this.openExport(cfg);
		});

		// Edit
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Edit");
		editLink.addEventListener("click", () => {
			this.editingExportId = cfg.id;
			this.renderExportsDetail();
		});

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete export config "${cfg.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.dataExchangeService
						.deleteExportConfig(cfg.id)
						.then(() => {
							this.selectedExportId = null;
							this.refreshConfigs();
							this.renderExportsMaster();
							this.renderExportsDetail();
							new Notice("Export config deleted");
						});
				},
			}).open();
		});
	}

	private renderExportEditForm(cfg: SavedExportConfig): void {
		const panel = this.detailPanelEl;
		panel.createEl("h3", { text: "Edit Export Config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedExportConfig> = {
			name: cfg.name,
			sourcePath: cfg.sourcePath,
			outputPath: cfg.outputPath,
			conflictStrategy: cfg.conflictStrategy ?? "overwrite",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		const sourceSetting = new Setting(panel)
			.setName("Source path")
			.addText((t) => t.setValue(cfg.sourcePath).onChange((v) => { edits.sourcePath = v; }));
		sourceSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				if (cfg.sourceType === "base") {
					new FilePickerModal(this.app, ["base"], (p) => {
						edits.sourcePath = p;
						this.renderExportsDetail();
					}).open();
				} else {
					const folders = getVaultFolders(this.app);
					new FolderPickerModal(this.app, folders, (p) => {
						edits.sourcePath = p;
						this.renderExportsDetail();
					}).open();
				}
			}),
		);

		const outputSetting = new Setting(panel)
			.setName("Output path")
			.addText((t) => t.setValue(cfg.outputPath).onChange((v) => { edits.outputPath = v; }));
		outputSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.app);
				new FolderPickerModal(this.app, folders, (folder) => {
					const parts = (cfg.outputPath || "export.csv").replace(/\\/g, "/").split("/");
					const filename = parts[parts.length - 1];
					edits.outputPath = folder ? `${folder}/${filename}` : filename;
					this.renderExportsDetail();
				}).open();
			}),
		);

		new Setting(panel)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOptions({ overwrite: "Overwrite", skip: "Skip", append: "Append" })
					.setValue(cfg.conflictStrategy ?? "overwrite")
					.onChange((v) => { edits.conflictStrategy = v as SavedExportConfig["conflictStrategy"]; }),
			);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.dataExchangeService
				.updateExportConfig(cfg.id, edits)
				.then(() => {
					this.editingExportId = null;
					this.refreshConfigs();
					this.renderExportsMaster();
					this.renderExportsDetail();
					new Notice("Export config updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.editingExportId = null;
			this.renderExportsDetail();
		});
	}

	// ── Reports page ────────────────────────────────────────

	private renderReportsMaster(): void {
		this.masterTreeEl.empty();

		let reports = this.reportEntries;
		if (this.filterText) {
			reports = reports.filter((r) => r.name.toLowerCase().includes(this.filterText));
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Reports" });
		header.createSpan({
			text: `${reports.length}`,
			cls: "ft-master-category-count",
		});

		if (reports.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = this.filterText ? "No matching reports" : "No documented CSV files yet";
			return;
		}

		for (const report of reports) {
			const isSelected = this.selectedReportPath === report.path;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "file-spreadsheet");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: report.name, cls: "ft-master-event-name" });

			const cols = report.frontmatter.columns;
			if (cols !== undefined) {
				item.createSpan({
					text: `${cols} cols`,
					cls: "ft-badge ft-badge-muted",
				});
			}

			item.addEventListener("click", () => {
				this.selectedReportPath = report.path;
				this.renderReportsMaster();
				this.renderReportsDetail();
			});
		}
	}

	private renderReportsDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedReportPath) {
			this.renderEmptyDetail("file-spreadsheet", "Select a report to view details");
			return;
		}

		this.renderReportDetailContent();
	}

	// ── Properties page ─────────────────────────────────────

	private renderPropertiesMaster(): void {
		this.masterTreeEl.empty();

		let entries = this.dictionaryEntries;
		if (this.filterText) {
			entries = entries.filter((e) =>
				e.propertyName.toLowerCase().includes(this.filterText),
			);
		}

		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Properties" });
		header.createSpan({
			text: `${entries.length}`,
			cls: "ft-master-category-count",
		});

		if (entries.length === 0) {
			const empty = this.masterTreeEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = this.filterText ? "No matching properties" : "No properties found in configs";
			return;
		}

		for (const entry of entries) {
			const isSelected = this.selectedDictProp === entry.propertyName;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "tag");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: entry.propertyName, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${entry.usedInConfigs.length} config${entry.usedInConfigs.length !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});

			item.addEventListener("click", () => {
				this.selectedDictProp = entry.propertyName;
				this.renderPropertiesMaster();
				this.renderPropertiesDetail();
			});
		}
	}

	private renderPropertiesDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedDictProp) {
			this.renderEmptyDetail("tag", "Select a property to view details");
			return;
		}

		const entry = this.dictionaryEntries.find(
			(e) => e.propertyName === this.selectedDictProp,
		);
		if (!entry) {
			this.renderEmptyDetail("tag", "Property not found");
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: entry.propertyName, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({
			text: `${entry.usedInConfigs.length} config${entry.usedInConfigs.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});

		// CSV column names
		if (entry.csvColumnNames.length > 0) {
			const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			card.createDiv({ text: "CSV Columns", cls: "ft-detail-section-header" });
			const chips = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const col of entry.csvColumnNames) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// Configs using this property
		if (entry.usedInConfigs.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Used In Configs", cls: "ft-detail-section-header" });

			for (const ref of entry.usedInConfigs) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const iconEl = item.createSpan();
				setIcon(iconEl, ref.configType === "import" ? "file-input" : "file-output");
				iconEl.style.opacity = "0.5";
				iconEl.style.flexShrink = "0";

				item.createSpan({ text: ref.configName, cls: "ft-master-event-name" });
				item.createSpan({
					text: ref.configType === "import" ? "Import" : "Export",
					cls: `ft-operation-badge ft-operation-badge-${ref.configType}`,
				});

				item.addEventListener("click", () => {
					if (ref.configType === "import") {
						this.selectedImportId = ref.configId;
						this.navigateTo("imports");
					} else {
						this.selectedExportId = ref.configId;
						this.navigateTo("exports");
					}
				});
			}
		}

		// Sample values
		if (entry.sampleValues.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: "Sample Values", cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const val of entry.sampleValues) {
				chips.createSpan({ text: val, cls: "ft-badge ft-badge-muted" });
			}
		}
	}

	// ── Shared report detail content ─────────────────────────

	private renderReportDetailContent(): void {
		const report = this.reportEntries.find((r) => r.path === this.selectedReportPath);
		if (!report) {
			this.renderEmptyDetail("file-spreadsheet", "Report not found");
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: report.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "CSV Report", cls: "ft-operation-badge ft-operation-badge-import" });

		// Frontmatter properties
		const fm = report.frontmatter;
		const skipKeys = new Set(["position", "type"]);
		const entries = Object.entries(fm).filter(([k]) => !skipKeys.has(k));

		if (entries.length > 0) {
			const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			const grid = card.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of entries) {
				const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
				this.addInfoRow(grid, key, displayValue);
			}
		}

		// Headers list (from frontmatter)
		const headers = fm.headers;
		if (Array.isArray(headers) && headers.length > 0) {
			const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
			section.createDiv({ text: `Columns (${headers.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const h of headers) {
				chips.createSpan({ text: String(h), cls: "ft-badge ft-badge-muted" });
			}
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Documentation");
		openLink.addEventListener("click", () => {
			void this.app.workspace.openLinkText(report.path, "", false);
		});

		// Open the CSV file itself (via csvFile wikilink)
		const csvFile = fm.csvFile;
		if (typeof csvFile === "string") {
			// Extract path from wikilink: "[[path]]" → "path"
			const match = csvFile.match(/\[\[(.+?)\]\]/);
			const csvPath = match ? match[1] : csvFile;
			const openCsvLink = actions.createEl("span", { cls: "ft-nav-link" });
			const csvIcon = openCsvLink.createSpan();
			setIcon(csvIcon, "file-spreadsheet");
			openCsvLink.appendText(" Open CSV");
			openCsvLink.addEventListener("click", () => {
				void this.app.workspace.openLinkText(csvPath, "", false);
			});
		}

		// ── Configs referencing this CSV ──
		const csvFileFm = fm.csvFile;
		if (typeof csvFileFm === "string") {
			const csvMatch = csvFileFm.match(/\[\[(.+?)\]\]/);
			const csvPath = csvMatch ? csvMatch[1] : csvFileFm;
			const importConfigs = this.dataExchangeService.getImportConfigsForFile(csvPath);
			if (importConfigs.length > 0) {
				const cfgSection = this.detailPanelEl.createDiv({ cls: "ft-detail-section ft-mt-2" });
				cfgSection.createDiv({ text: "Import Configs", cls: "ft-detail-section-header" });
				for (const cfg of importConfigs) {
					const item = cfgSection.createDiv({ cls: "ft-master-event-item" });
					const iconEl = item.createSpan();
					setIcon(iconEl, "file-input");
					iconEl.style.opacity = "0.5";
					iconEl.style.flexShrink = "0";
					item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
					item.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
					item.addEventListener("click", () => {
						this.selectedImportId = cfg.id;
						this.navigateTo("imports");
					});
				}
			}
		}

		// Delete doc
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete Doc");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete documentation "${report.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					const file = this.app.vault.getAbstractFileByPath(report.path);
					if (file) {
						void this.app.vault.delete(file).then(() => {
							this.selectedReportPath = null;
							this.refreshConfigs();
							this.renderReportsMaster();
							this.renderReportsDetail();
							new Notice("Report documentation deleted");
						});
					}
				},
			}).open();
		});
	}

	// ── One-click execute ────────────────────────────────────

	private executeImportConfig(cfg: SavedImportConfig): void {
		if (!cfg.sourcePath) return;
		void this.eventBus
			.emit("dataExchange.import.execute", {
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
			})
			.then(() => {
				// Listen for completion/failure
				const offComplete = this.eventBus.on("dataExchange.import.completed", (event) => {
					offComplete();
					offFailed();
					const r = event.payload.result;
					new Notice(
						`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
					);
				});
				const offFailed = this.eventBus.on("dataExchange.import.failed", (event) => {
					offComplete();
					offFailed();
					new Notice(`Import failed: ${event.payload.error}`);
				});
			});
		new Notice(`Running import: ${cfg.name}...`);
	}

	private executeImportConfigWithSource(cfg: SavedImportConfig, csvPath: string): void {
		void this.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: cfg.customProperties,
			},
		});
		new Notice(`Running import: ${cfg.name}...`);

		const offComplete = this.eventBus.on("dataExchange.import.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
		});
		const offFailed = this.eventBus.on("dataExchange.import.failed", (event) => {
			offComplete();
			offFailed();
			new Notice(`Import failed: ${event.payload.error}`);
		});
	}

	private executeExportConfig(cfg: SavedExportConfig): void {
		void this.eventBus.emit("dataExchange.export.execute", {
			config: {
				sourcePath: cfg.sourcePath,
				sourceType: cfg.sourceType,
				format: cfg.format,
				outputPath: cfg.outputPath,
				columns: cfg.columns,
				fileProperties: cfg.fileProperties,
				baseViewIndex: cfg.baseViewIndex,
				isExternal: cfg.isExternal,
				conflictStrategy: cfg.conflictStrategy,
			},
		});
		new Notice(`Running export: ${cfg.name}...`);

		const offComplete = this.eventBus.on("dataExchange.export.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			if (r.skipped) {
				new Notice(`Export skipped: ${r.outputPath} already exists`);
			} else {
				new Notice(`Export complete: ${r.totalRows} rows written to ${r.outputPath}`);
			}
		});
		const offFailed = this.eventBus.on("dataExchange.export.failed", (event) => {
			offComplete();
			offFailed();
			new Notice(`Export failed: ${event.payload.error}`);
		});
	}

	// ── Doc links ────────────────────────────────────────────

	private renderDocLink(
		container: HTMLElement,
		configName: string,
		configType: "import" | "export",
	): void {
		const docPath = this.dataExchangeService.getConfigDocPath(configName, configType);
		const abstractFile = this.app.vault.getAbstractFileByPath(docPath);
		const exists = abstractFile instanceof TFile;

		const section = container.createDiv({ cls: "ft-detail-section ft-mt-2" });
		const link = section.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const icon = link.createSpan();
		setIcon(icon, exists ? "file-text" : "file-plus");
		link.appendText(exists ? " View Documentation" : " Create Documentation");

		link.addEventListener("click", () => {
			if (exists) {
				void this.app.workspace.openLinkText(docPath, "", false);
			} else {
				new Notice(`Documentation will be created when the config is saved.`);
			}
		});

		// Show frontmatter properties from existing doc
		if (exists) {
			const cache = this.app.metadataCache.getFileCache(abstractFile);
			const fm = cache?.frontmatter;
			if (fm) {
				const skipKeys = new Set(["position", "type"]);
				const entries = Object.entries(fm).filter(([k]) => !skipKeys.has(k));
				if (entries.length > 0) {
					const grid = section.createDiv({ cls: "ft-doc-properties" });
					for (const [key, value] of entries) {
						grid.createDiv({ text: key, cls: "ft-doc-prop-key" });
						const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
						grid.createDiv({ text: displayValue, cls: "ft-doc-prop-value" });
					}
				}
			}
		}
	}

	// ── Shared helpers ───────────────────────────────────────

	private addInfoRow(grid: HTMLElement, label: string, value: string): void {
		grid.createDiv({ text: label, cls: "ft-detail-info-label" });
		grid.createDiv({ text: value, cls: "ft-detail-info-value" });
	}

	private renderEmptyDetail(icon: string, message: string): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });
		const iconEl = empty.createDiv();
		setIcon(iconEl, icon);
		iconEl.style.opacity = "0.3";
		empty.createEl("p", { text: message });

		let count = 0;
		let label = "";
		switch (this.currentPage) {
			case "imports":
				count = this.importConfigs.length;
				label = "saved imports";
				break;
			case "exports":
				count = this.exportConfigs.length;
				label = "saved exports";
				break;
			case "reports":
				count = this.reportEntries.length;
				label = "reports";
				break;
			case "properties":
				count = this.dictionaryEntries.length;
				label = "properties";
				break;
		}
		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats ft-mt-2" });
		const stat = stats.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: String(count), cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}
}
