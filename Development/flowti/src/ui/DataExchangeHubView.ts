/**
 * Data Exchange Hub — central management view for import/export operations.
 *
 * Follows the same layout and patterns as EventCatalogView:
 * - Dashboard is the landing page (full-height, scrollable, padded)
 * - Sub-pages (Imports / Exports) use the master/detail split layout
 * - Top bar appears on sub-pages with clickable title to return to dashboard
 * - Consistent CSS class usage: ft-catalog-*, ft-master-*, ft-detail-*
 */

import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type {
	SavedImportConfig,
	SavedExportConfig,
} from "../domain/dataExchange/types";
import { ConfirmModal, InputModal } from "./modals";

export const VIEW_TYPE_DATA_EXCHANGE_HUB = "flowti-data-exchange-hub";

type HubPage = "dashboard" | "imports" | "exports";

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
	private filterText = "";

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
			this.searchInput.placeholder =
				page === "imports"
					? "Search import configs..."
					: "Search export configs...";
			this.filterText = "";
			this.searchInput.value = "";
		}

		this.scheduleRender();
	}

	// ── Top bar ─────────────────────────────────────────────
	// Matches EventCatalogView.renderTopBar: hidden on dashboard,
	// clickable title returns to dashboard.

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

		// Import quick action
		const importBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const importIcon = importBtn.createSpan();
		setIcon(importIcon, "file-input");
		importBtn.appendText(" Import CSV");
		importBtn.addEventListener("click", () => {
			new InputModal(this.app, {
				title: "Import CSV",
				inputName: "CSV file path",
				inputDesc: "Enter the vault path to a .csv file",
				placeholder: "path/to/data.csv",
				submitLabel: "Import",
				onSubmit: (csvPath) => this.openCsvImport(csvPath),
			}).open();
		});

		// Export quick action
		const exportBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const exportIcon = exportBtn.createSpan();
		setIcon(exportIcon, "file-output");
		exportBtn.appendText(" Export");
		exportBtn.addEventListener("click", () => {
			new InputModal(this.app, {
				title: "Export Folder as CSV",
				inputName: "Folder path",
				inputDesc: "Enter the vault path to a folder",
				placeholder: "path/to/folder",
				submitLabel: "Export",
				onSubmit: (folderPath) => {
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
				},
			}).open();
		});
	}

	// ── Dashboard ────────────────────────────────────────────
	// Matches CatalogDashboard: stats grid, quick actions, links.

	private renderDashboard(): void {
		this.dashboardEl.empty();

		// Stats grid — same as CatalogDashboard
		const grid = this.dashboardEl.createDiv({ cls: "ft-dashboard-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(2, 1fr)";
		grid.style.gap = "0.75rem";
		grid.style.marginBottom = "1.5rem";

		this.renderDashboardCard(grid, "file-input", this.importConfigs.length, "Saved Imports", () => {
			this.navigateTo("imports");
		});
		this.renderDashboardCard(grid, "file-output", this.exportConfigs.length, "Saved Exports", () => {
			this.navigateTo("exports");
		});

		// Quick actions — same as CatalogDashboard.renderQuickActions
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
					new InputModal(this.app, {
						title: "Import CSV",
						inputName: "CSV file path",
						inputDesc: "Enter the vault path to a .csv file",
						placeholder: "path/to/data.csv",
						submitLabel: "Import",
						onSubmit: (csvPath) => this.openCsvImport(csvPath),
					}).open();
				},
			},
			{
				icon: "file-output",
				label: "Export Folder",
				action: () => {
					new InputModal(this.app, {
						title: "Export Folder as CSV",
						inputName: "Folder path",
						inputDesc: "Enter the vault path to a folder",
						placeholder: "path/to/folder",
						submitLabel: "Export",
						onSubmit: (folderPath) => {
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
						},
					}).open();
				},
			},
			{
				icon: "database",
				label: "Export .base",
				action: () => {
					new InputModal(this.app, {
						title: "Export .base as CSV",
						inputName: ".base file path",
						inputDesc: "Enter the vault path to a .base file",
						placeholder: "path/to/file.base",
						submitLabel: "Export",
						onSubmit: (basePath) => {
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
						},
					}).open();
				},
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
					cls: "ft-badge ft-badge-muted",
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

	/** Renders a clickable stat card — same pattern as CatalogDashboard. */
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
	// Master/detail — same as DomainsTab.

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

		// Category header — same as DomainsTab
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

		// Header — same as DomainsTab.renderDetail
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Import", cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });

		// Info grid
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		this.addInfoRow(grid, "Target Folder", cfg.targetFolder || "(not set)");
		this.addInfoRow(grid, "Name Column", cfg.nameColumn || "(not set)");
		this.addInfoRow(grid, "Conflict Strategy", cfg.conflictStrategy);
		this.addInfoRow(grid, "Columns", String(cfg.columnMappings.length));
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

		// Actions — ft-nav-link pattern like catalog detail actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		const executeLink = actions.createEl("span", { cls: "ft-nav-link" });
		const execIcon = executeLink.createSpan();
		setIcon(execIcon, "play");
		executeLink.appendText(" Execute");
		executeLink.addEventListener("click", () => {
			new InputModal(this.app, {
				title: "Select CSV File",
				inputName: "CSV file path",
				inputDesc: "Enter the vault path to a .csv file",
				placeholder: "path/to/data.csv",
				submitLabel: "Import",
				onSubmit: (csvPath) => this.openCsvImport(csvPath, cfg),
			}).open();
		});

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

		// Category header
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

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Export", cls: "ft-badge ft-badge-muted" });
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

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		const executeLink = actions.createEl("span", { cls: "ft-nav-link" });
		const execIcon = executeLink.createSpan();
		setIcon(execIcon, "play");
		executeLink.appendText(" Execute");
		executeLink.addEventListener("click", () => {
			this.openExport(cfg);
		});

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

		const count =
			this.currentPage === "imports"
				? this.importConfigs.length
				: this.exportConfigs.length;
		const label =
			this.currentPage === "imports" ? "saved imports" : "saved exports";
		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats ft-mt-2" });
		const stat = stats.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: String(count), cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}
}
