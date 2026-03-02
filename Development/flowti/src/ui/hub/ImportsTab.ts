/**
 * Imports tab component for the Data Exchange Hub.
 * Renders the master list of saved import configs and the detail/edit panel.
 */

import { Setting, TFile, setIcon } from "obsidian";
import type { SavedImportConfig } from "../../domain/dataExchange/types";
import { ConfirmModal } from "../modals";
import { FilePickerModal } from "../shared/FilePickerModal";
import { FolderPickerModal, getVaultFolders } from "../shared/FolderPickerModal";
import { addInfoRow, renderEmptyDetail, resolveImportBaseFile, getEmptyDetailStats } from "./helpers";
import type { ActiveOperation, HubComponentDeps } from "./types";

export class ImportsTab {
	private liveUnsubscribes: (() => void)[] = [];

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		let configs = state.importConfigs;
		if (state.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(state.filterText) ||
					c.targetFolder.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Import Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = state.filterText
				? "No matching import configs"
				: "No saved import configs yet";
			return;
		}

		for (const cfg of configs) {
			this.renderImportItem(cfg);
		}
	}

	private renderImportItem(cfg: SavedImportConfig): void {
		const state = this.deps.getState();
		const isSelected = state.selectedImportId === cfg.id;
		const item = this.masterEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		item.dataset.id = cfg.id;
		item.addClass("ft-master-item-top");

		const iconEl = item.createSpan();
		setIcon(iconEl, "file-input");
		iconEl.addClass("ft-icon-muted");
		iconEl.addClass("ft-flex-shrink-0");
		iconEl.addClass("ft-icon-offset-sm");

		const textBlock = item.createDiv({ cls: "ft-master-event-name ft-master-text-block" });
		textBlock.createDiv({ text: cfg.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm ft-text-ellipsis" });
		sub.textContent = cfg.targetFolder || "(no folder)";

		item.createSpan({
			text: cfg.conflictStrategy,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.deps.setState({ selectedImportId: cfg.id, editingImportId: null });
			this.updateMasterSelection(cfg.id);
			this.renderDetail();
		});
	}

	private updateMasterSelection(selectedId: string): void {
		this.masterEl.querySelectorAll(".ft-master-event-item").forEach((el) => {
			el.classList.toggle("ft-master-event-selected", (el as HTMLElement).dataset.id === selectedId);
		});
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.cleanupLiveListeners();
		this.detailEl.empty();
		const state = this.deps.getState();

		if (!state.selectedImportId) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "file-input", "Select an import config to view details", count, label);
			return;
		}

		const cfg = state.importConfigs.find((c) => c.id === state.selectedImportId);
		if (!cfg) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "file-input", "Config not found", count, label);
			return;
		}

		if (state.editingImportId === cfg.id) {
			this.renderEditForm(cfg);
			return;
		}

		// Header with operation badge
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Import", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: cfg.conflictStrategy, cls: "ft-badge ft-badge-muted" });
		if (cfg.createBase) {
			badges.createSpan({ text: "Base View", cls: "ft-badge ft-badge-muted" });
		}
		if (cfg.noteType) {
			badges.createSpan({ text: cfg.noteType, cls: "ft-badge" });
		}

		// Actions bar
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Execute
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => {
			if (cfg.sourcePath) {
				this.executeImportConfig(cfg);
			} else {
				new FilePickerModal(this.deps.app, ["csv"], (csvPath) => {
					this.executeImportConfigWithSource(cfg, csvPath);
				}, this.deps.dataExchangeService.getHiddenCsvPaths()).open();
			}
		});

		// Preview
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const prevIcon = previewLink.createSpan();
		setIcon(prevIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			if (cfg.sourcePath) {
				this.deps.navigation.openCsvImport(cfg.sourcePath, cfg);
			} else {
				new FilePickerModal(this.deps.app, ["csv"], (csvPath) => {
					this.deps.navigation.openCsvImport(csvPath, cfg);
				}, this.deps.dataExchangeService.getHiddenCsvPaths()).open();
			}
		});

		// View CSV
		if (cfg.sourcePath) {
			const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
			const viewIcon = viewLink.createSpan();
			setIcon(viewIcon, "file-spreadsheet");
			viewLink.appendText(" View CSV");
			viewLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(cfg.sourcePath!, "", false);
			});
		}

		// Open Base
		const resolvedBaseFile = resolveImportBaseFile(this.deps, cfg);
		if (resolvedBaseFile) {
			const baseLink = actions.createEl("span", { cls: "ft-nav-link" });
			const baseIcon = baseLink.createSpan();
			setIcon(baseIcon, "table");
			baseLink.appendText(" Open Base");
			baseLink.addEventListener("click", () => {
				void this.deps.app.workspace.getLeaf(false).openFile(resolvedBaseFile);
			});
		}

		// Read Doc / Create Doc
		const configDocPath = this.deps.dataExchangeService.getConfigDocPath(cfg.name, "import");
		const configDocFile = this.deps.app.vault.getAbstractFileByPath(configDocPath);
		const configDocExists = configDocFile instanceof TFile;
		const readLink = actions.createEl("span", { cls: "ft-nav-link" });
		const readIcon = readLink.createSpan();
		setIcon(readIcon, configDocExists ? "file-text" : "file-plus");
		readLink.appendText(configDocExists ? " Read Doc" : " Create Doc");
		readLink.addEventListener("click", () => {
			if (configDocExists) {
				void this.deps.app.workspace.openLinkText(configDocPath, "", false);
			} else {
				void this.deps.dataExchangeService
					.ensureConfigDoc(cfg.name, "import")
					.then((path) => {
						void this.deps.app.workspace.openLinkText(path, "", false);
						this.renderDetail();
					});
			}
		});

		// Update
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => {
			this.deps.setState({ editingImportId: cfg.id });
			this.renderDetail();
		});

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link ft-text-error" });
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete import config "${cfg.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deps.dataExchangeService
						.deleteImportConfig(cfg.id)
						.then(() => {
							this.deps.setState({ selectedImportId: null });
							this.deps.scheduleRender();
							void this.deps.eventBus.emit("notice.success", { message: "Import config deleted" });
						});
				},
			}).open();
		});

		// Active import operations (state-backed — survives tab navigation)
		const activeImports = cfg.sourcePath
			? state.activeOperations.filter(
				(op) => op.type === "import" && !op.completed && op.sourcePath === cfg.sourcePath,
			)
			: [];
		for (const op of activeImports) {
			this.renderActiveImportProgress(this.detailEl, op);
		}

		// Description from linked CsvDoc
		if (cfg.sourcePath) {
			const csvDocPath = this.deps.dataExchangeService.resolveCsvDocPath(cfg.sourcePath, (p) => !!this.deps.app.vault.getAbstractFileByPath(p));
			const csvDocFile = this.deps.app.vault.getAbstractFileByPath(csvDocPath);
			if (csvDocFile instanceof TFile) {
				const cache = this.deps.app.metadataCache.getFileCache(csvDocFile);
				const description = cache?.frontmatter?.["description"] as string | undefined;
				if (description) {
					const descSection = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
					descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
					descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
				}
			}
		}

		// Source & target info
		const sourceCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		sourceCard.createDiv({ text: "Source & Target", cls: "ft-detail-section-header" });
		const sourceGrid = sourceCard.createDiv({ cls: "ft-detail-info-grid" });

		if (cfg.sourcePath) {
			const sourceRow = sourceGrid.createDiv({ cls: "ft-detail-info-label" });
			sourceRow.textContent = "Source CSV";
			const sourceVal = sourceGrid.createDiv({ cls: "ft-detail-info-value" });
			const sourceLink = sourceVal.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			sourceLink.textContent = cfg.sourcePath;
			sourceLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(cfg.sourcePath!, "", false);
			});
		}
		addInfoRow(sourceGrid, "Target Folder", cfg.targetFolder || "(not set)");
		addInfoRow(sourceGrid, "Name Column", cfg.nameColumn || "(not set)");
		if (cfg.namePrefix) addInfoRow(sourceGrid, "Name Prefix", cfg.namePrefix);
		if (cfg.nameSuffix) addInfoRow(sourceGrid, "Name Suffix", cfg.nameSuffix);

		// Configuration
		const configCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		configCard.createDiv({ text: "Configuration", cls: "ft-detail-section-header" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });

		addInfoRow(configGrid, "Conflict Strategy", cfg.conflictStrategy);
		addInfoRow(configGrid, "Mapped Columns", `${cfg.columnMappings.filter((m) => m.included).length} of ${cfg.columnMappings.length}`);
		if (cfg.customProperties && Object.keys(cfg.customProperties).length > 0) {
			addInfoRow(configGrid, "Custom Properties", String(Object.keys(cfg.customProperties).length));
		}
		if (cfg.createBase) addInfoRow(configGrid, "Base View", cfg.basePath || "(auto-generated)");
		if (cfg.noteType) addInfoRow(configGrid, "Note Type", cfg.noteType);
		addInfoRow(configGrid, "Created", new Date(cfg.createdAt).toLocaleString());

		// Last import run
		if (cfg.sourcePath) {
			const csvSettings = this.deps.dataExchangeService.getCsvDisplaySettings(cfg.sourcePath);
			if (csvSettings?.lastImportedAt) {
				const lastRun = new Date(csvSettings.lastImportedAt);
				const elapsed = Date.now() - csvSettings.lastImportedAt;
				const relativeTime = elapsed < 60_000 ? "just now"
					: elapsed < 3_600_000 ? `${Math.floor(elapsed / 60_000)}m ago`
						: elapsed < 86_400_000 ? `${Math.floor(elapsed / 3_600_000)}h ago`
							: `${Math.floor(elapsed / 86_400_000)}d ago`;
				addInfoRow(configGrid, "Last Import", `${lastRun.toLocaleString()} (${relativeTime})`);
			} else {
				addInfoRow(configGrid, "Last Import", "Never");
			}
		}

		// Column mappings
		if (cfg.columnMappings.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: "Column Mappings", cls: "ft-detail-section-header" });
			const table = section.createEl("table", { cls: "ft-preview-table" });
			const thead = table.createEl("tr");
			thead.createEl("th", { text: "CSV column" });
			thead.createEl("th", { text: "Frontmatter key" });
			thead.createEl("th", { text: "Included" });
			for (const m of cfg.columnMappings) {
				const tr = table.createEl("tr");
				tr.createEl("td", { text: m.csvColumn });
				tr.createEl("td", { text: m.frontmatterKey });
				const inclTd = tr.createEl("td");
				const inclIcon = inclTd.createSpan();
				setIcon(inclIcon, m.included ? "check" : "minus");
				if (!m.included) inclIcon.addClass("ft-opacity-60");
			}
		}

		// Custom properties
		if (cfg.customProperties && Object.keys(cfg.customProperties).length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: "Custom Properties", cls: "ft-detail-section-header" });
			const propGrid = section.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, val] of Object.entries(cfg.customProperties)) {
				addInfoRow(propGrid, key, val);
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// Edit form
	// ─────────────────────────────────────────────────────────

	private renderEditForm(cfg: SavedImportConfig): void {
		const panel = this.detailEl;
		panel.createEl("h3", { text: "Edit import config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedImportConfig> = {
			name: cfg.name,
			targetFolder: cfg.targetFolder,
			nameColumn: cfg.nameColumn,
			conflictStrategy: cfg.conflictStrategy,
			createBase: cfg.createBase ?? false,
			basePath: cfg.basePath ?? "",
			noteType: cfg.noteType ?? "",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.addText((t) => t.setValue(cfg.targetFolder).onChange((v) => { edits.targetFolder = v; }));
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.deps.app);
				new FolderPickerModal(this.deps.app, folders, (folder) => {
					edits.targetFolder = folder;
					this.renderDetail();
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

		new Setting(panel)
			.setName("Note type")
			.setDesc("Type value added to every note's frontmatter (optional)")
			.addText((t) =>
				t
					.setValue(cfg.noteType ?? "")
					// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder("e.g. event, asset, service")
					.onChange((v) => { edits.noteType = v || undefined; }),
			);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.deps.dataExchangeService
				.updateImportConfig(cfg.id, edits)
				.then(() => {
					this.deps.setState({ editingImportId: null });
					this.renderMaster();
					this.renderDetail();
					void this.deps.eventBus.emit("notice.success", { message: "Import config updated" });
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.deps.setState({ editingImportId: null });
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Active operation progress (state-backed)
	// ─────────────────────────────────────────────────────────

	private renderActiveImportProgress(container: HTMLElement, op: ActiveOperation): void {
		this.cleanupLiveListeners();
		const section = container.createDiv({ cls: "ft-import-progress ft-card ft-mt-3" });

		const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.addClass("ft-opacity-60");
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ cls: "ft-text-sm" });
		if (op.progress) {
			statusText.textContent = `Importing... ${op.progress.current} / ${op.progress.total}`;
			if (op.progress.lastFilename) statusText.textContent += ` — ${op.progress.lastFilename}`;
		} else {
			statusText.textContent = `Running import: ${op.name}...`;
		}

		const barBg = section.createDiv({ cls: "ft-progress-bar-track-4" });
		const barFill = barBg.createDiv({ cls: "ft-progress-bar-fill-animated" });
		const pct = op.progress && op.progress.total > 0
			? Math.round((op.progress.current / op.progress.total) * 100)
			: 0;
		barFill.style.width = `${pct}%`;

		const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

		// Live progress listener
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("dataExchange.import.progress", (event) => {
				if (event.payload.operationId !== op.operationId) return;
				const { current, total, lastFilename } = event.payload;
				const livePct = total > 0 ? Math.round((current / total) * 100) : 0;
				barFill.style.width = `${livePct}%`;
				statusText.textContent = `Importing... ${current} / ${total}`;
				if (lastFilename) statusText.textContent += ` — ${lastFilename}`;
				detailText.textContent = lastFilename ? `Last: ${lastFilename}` : "";
			}),
		);

		// Completion/failure listener — update to result state
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("dataExchange.import.completed", (event) => {
				if (event.payload.operationId !== op.operationId) return;
				section.empty();
				const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
				const icon = resultRow.createSpan();
				setIcon(icon, "check-circle");
				icon.addClass("ft-text-success");
				const r = event.payload.result;
				resultRow.createSpan({
					text: `Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
						(r.failed > 0 ? `, ${r.failed} failed` : ""),
					cls: "ft-text-sm",
				});
			}),
		);
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("dataExchange.import.failed", (event) => {
				if (event.payload.operationId !== op.operationId) return;
				section.empty();
				const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
				const icon = resultRow.createSpan();
				setIcon(icon, "x-circle");
				icon.addClass("ft-text-error");
				resultRow.createSpan({ text: `Import failed: ${event.payload.error}`, cls: "ft-text-sm" });
			}),
		);
	}

	cleanupLiveListeners(): void {
		for (const unsub of this.liveUnsubscribes) unsub();
		this.liveUnsubscribes = [];
	}

	// ─────────────────────────────────────────────────────────
	// Execution
	// ─────────────────────────────────────────────────────────

	executeImportConfig(cfg: SavedImportConfig): void {
		if (!cfg.sourcePath) return;
		this.runImportWithFeedback(cfg, cfg.sourcePath);
	}

	executeImportConfigWithSource(cfg: SavedImportConfig, csvPath: string): void {
		this.runImportWithFeedback(cfg, csvPath);
	}

	private runImportWithFeedback(cfg: SavedImportConfig, csvPath: string): void {
		const importCustomProps = { ...cfg.customProperties };
		if (cfg.noteType) {
			importCustomProps.type = cfg.noteType;
		}

		// Fire-and-forget — Active Operations (state-backed) tracks progress
		void this.deps.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: Object.keys(importCustomProps).length > 0 ? importCustomProps : undefined,
			},
		});
	}
}
