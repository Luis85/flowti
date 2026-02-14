/**
 * Exports tab component for the Data Exchange Hub.
 * Renders the master list of saved export configs and the detail/edit panel.
 */

import { Notice, Setting, TFile, setIcon } from "obsidian";
import type { SavedExportConfig } from "../../domain/dataExchange/types";
import { basename } from "../../utils/pathUtils";
import { ConfirmModal } from "../modals";
import { FilePickerModal } from "../FilePickerModal";
import { FolderPickerModal, getVaultFolders } from "../FolderPickerModal";
import { showNativeSaveDialog } from "../electronDialog";
import { addInfoRow, renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import type { HubComponentDeps } from "./types";

export class ExportsTab {
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
		let configs = state.exportConfigs;
		if (state.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(state.filterText) ||
					c.sourcePath.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Export Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = state.filterText
				? "No matching export configs"
				: "No saved export configs yet";
			return;
		}

		for (const cfg of configs) {
			this.renderExportItem(cfg);
		}
	}

	private renderExportItem(cfg: SavedExportConfig): void {
		const state = this.deps.getState();
		const isSelected = state.selectedExportId === cfg.id;
		const item = this.masterEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		item.style.alignItems = "flex-start";

		const iconEl = item.createSpan();
		setIcon(iconEl, "file-output");
		iconEl.addClass("ft-icon-muted");
		iconEl.addClass("ft-flex-shrink-0");
		iconEl.style.marginTop = "0.125rem";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: cfg.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
		sub.style.whiteSpace = "nowrap";
		sub.style.overflow = "hidden";
		sub.style.textOverflow = "ellipsis";
		sub.textContent = cfg.sourcePath || "(no source)";

		const rightBadges = item.createDiv({ cls: "ft-flex ft-gap-1" });
		rightBadges.addClass("ft-flex-shrink-0");
		const pipelineCount = this.deps.dataExchangeService.getSavedPipelines()
			.filter((p) => p.exportConfigIds?.includes(cfg.id)).length;
		if (pipelineCount > 0) {
			const pipeBadge = rightBadges.createSpan({ cls: "ft-master-category-count" });
			setIcon(pipeBadge, "git-merge");
			pipeBadge.title = `Used by ${pipelineCount} pipeline${pipelineCount !== 1 ? "s" : ""}`;
		}
		rightBadges.createSpan({ text: cfg.format.toUpperCase(), cls: "ft-master-category-count" });

		item.addEventListener("click", () => {
			this.deps.setState({ selectedExportId: cfg.id, editingExportId: null });
			this.renderMaster();
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		const state = this.deps.getState();

		if (!state.selectedExportId) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "file-output", "Select an export config to view details", count, label);
			return;
		}

		const cfg = state.exportConfigs.find((c) => c.id === state.selectedExportId);
		if (!cfg) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "file-output", "Config not found", count, label);
			return;
		}

		if (state.editingExportId === cfg.id) {
			this.renderEditForm(cfg);
			return;
		}

		// Header with operation badge
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: cfg.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Export", cls: "ft-operation-badge ft-operation-badge-export" });
		badges.createSpan({ text: cfg.format.toUpperCase(), cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: cfg.sourceType, cls: "ft-badge ft-badge-muted" });
		if (cfg.isExternal) {
			badges.createSpan({ text: "External", cls: "ft-badge ft-badge-muted" });
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
			this.executeExportConfig(cfg);
		});

		// Preview
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const prevIcon = previewLink.createSpan();
		setIcon(prevIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			this.deps.navigation.openExport(cfg);
		});

		// View Source
		const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const viewIcon = viewLink.createSpan();
		setIcon(viewIcon, cfg.sourceType === "base" ? "table" : "folder");
		viewLink.appendText(cfg.sourceType === "base" ? " Open Base" : " Open Folder");
		viewLink.addEventListener("click", () => {
			if (cfg.sourceType === "base") {
				const file = this.deps.app.vault.getAbstractFileByPath(cfg.sourcePath);
				if (file instanceof TFile) {
					void this.deps.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				void this.deps.app.workspace.openLinkText(cfg.sourcePath, "", false);
			}
		});

		// View Output
		if (cfg.outputPath && !cfg.isExternal) {
			const outLink = actions.createEl("span", { cls: "ft-nav-link" });
			const outIcon = outLink.createSpan();
			setIcon(outIcon, "file-spreadsheet");
			outLink.appendText(" View Output");
			outLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(cfg.outputPath, "", false);
			});
		}

		// Read Doc / Create Doc
		const configDocPath = this.deps.dataExchangeService.getConfigDocPath(cfg.name, "export");
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
					.ensureConfigDoc(cfg.name, "export")
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
			this.deps.setState({ editingExportId: cfg.id });
			this.renderDetail();
		});

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete export config "${cfg.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deps.dataExchangeService
						.deleteExportConfig(cfg.id)
						.then(() => {
							this.deps.setState({ selectedExportId: null });
							this.deps.scheduleRender();
							new Notice("Export config deleted");
						});
				},
			}).open();
		});

		// Linked Pipelines
		const linkedPipelines = this.deps.dataExchangeService.getSavedPipelines()
			.filter((p) => p.exportConfigIds?.includes(cfg.id));
		if (linkedPipelines.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({
				text: `Pipeline${linkedPipelines.length > 1 ? "s" : ""} (${linkedPipelines.length})`,
				cls: "ft-detail-section-header",
			});
			for (let i = 0; i < linkedPipelines.length; i++) {
				const pipe = linkedPipelines[i];
				const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1 ft-px-2" });
				if (linkedPipelines.length > 1 && i < linkedPipelines.length - 1) {
					row.style.borderBottom = "1px solid var(--background-modifier-border)";
				}
				const icon = row.createSpan();
				setIcon(icon, "git-merge");
				icon.addClass("ft-flex-shrink-0");
				icon.style.opacity = "0.6";
				const link = row.createEl("span", {
					text: pipe.name,
					cls: "ft-nav-link ft-text-sm",
				});
				link.addClass("ft-flex-1");
				link.addEventListener("click", () => {
					this.deps.setState({ selectedPipelineId: pipe.id });
					this.deps.navigation.navigateTo("pipelines");
				});
				const infoParts: string[] = [];
				if (pipe.noteType) infoParts.push(pipe.noteType);
				infoParts.push(`${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`);
				infoParts.push(`→ ${pipe.targetFolder}`);
				if (pipe.basePath) infoParts.push(basename(pipe.basePath) || pipe.basePath);
				row.createSpan({
					text: infoParts.join(" · "),
					cls: "ft-text-muted ft-text-sm",
				});
			}
		}

		// Description from linked config doc
		if (configDocExists && configDocFile instanceof TFile) {
			const cache = this.deps.app.metadataCache.getFileCache(configDocFile);
			const description = cache?.frontmatter?.["description"] as string | undefined;
			if (description) {
				const descSection = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
				descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
				descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
			}
		}

		// Source & Output info
		const sourceCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		sourceCard.createDiv({ text: "Source & Output", cls: "ft-detail-section-header" });
		const sourceGrid = sourceCard.createDiv({ cls: "ft-detail-info-grid" });

		const sourceRow = sourceGrid.createDiv({ cls: "ft-detail-info-label" });
		sourceRow.textContent = cfg.sourceType === "base" ? "Source Base" : "Source Folder";
		const sourceVal = sourceGrid.createDiv({ cls: "ft-detail-info-value" });
		const sourceLink = sourceVal.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		sourceLink.textContent = cfg.sourcePath;
		sourceLink.addEventListener("click", () => {
			if (cfg.sourceType === "base") {
				const file = this.deps.app.vault.getAbstractFileByPath(cfg.sourcePath);
				if (file instanceof TFile) {
					void this.deps.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				void this.deps.app.workspace.openLinkText(cfg.sourcePath, "", false);
			}
		});

		const outputRow = sourceGrid.createDiv({ cls: "ft-detail-info-label" });
		outputRow.textContent = "Output File";
		const outputVal = sourceGrid.createDiv({ cls: "ft-detail-info-value" });
		if (cfg.isExternal) {
			outputVal.createSpan({ text: cfg.outputPath || "(not set)", cls: "ft-text-sm" });
			outputVal.createSpan({ text: "external", cls: "ft-badge ft-badge-muted" }).style.marginLeft = "0.5rem";
		} else if (cfg.outputPath) {
			const outLink = outputVal.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			outLink.textContent = cfg.outputPath;
			outLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(cfg.outputPath, "", false);
			});
		} else {
			outputVal.textContent = "(not set)";
		}

		// Configuration
		const configCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		configCard.createDiv({ text: "Configuration", cls: "ft-detail-section-header" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });

		addInfoRow(configGrid, "Format", cfg.format === "tab" ? "Tab-delimited" : "CSV");
		if (cfg.conflictStrategy) addInfoRow(configGrid, "Conflict Strategy", cfg.conflictStrategy);
		if (cfg.baseViewIndex !== undefined) addInfoRow(configGrid, "Base View Index", String(cfg.baseViewIndex));
		if (cfg.noteType) addInfoRow(configGrid, "Note Type", cfg.noteType);
		addInfoRow(configGrid, "Created", new Date(cfg.createdAt).toLocaleString());

		// Note Properties (columns)
		if (cfg.columns.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `Note Properties (${cfg.columns.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const col of cfg.columns) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// File Properties
		if (cfg.fileProperties.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `File Properties (${cfg.fileProperties.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1" });
			chips.style.flexWrap = "wrap";
			for (const fp of cfg.fileProperties) {
				chips.createSpan({ text: fp.replace("file.", ""), cls: "ft-badge ft-badge-muted" });
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// Edit form
	// ─────────────────────────────────────────────────────────

	private renderEditForm(cfg: SavedExportConfig): void {
		const panel = this.detailEl;
		panel.createEl("h3", { text: "Edit Export Config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedExportConfig> = {
			name: cfg.name,
			sourcePath: cfg.sourcePath,
			outputPath: cfg.outputPath,
			isExternal: cfg.isExternal ?? false,
			conflictStrategy: cfg.conflictStrategy ?? "overwrite",
			noteType: cfg.noteType ?? "",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		let sourceTextComponent: { setValue: (v: string) => unknown } | undefined;
		const sourceSetting = new Setting(panel)
			.setName("Source path")
			.addText((t) => {
				t.setValue(cfg.sourcePath).onChange((v) => { edits.sourcePath = v; });
				sourceTextComponent = t;
			});
		sourceSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				if (cfg.sourceType === "base") {
					new FilePickerModal(this.deps.app, ["base"], (p) => {
						edits.sourcePath = p;
						sourceTextComponent?.setValue(p);
					}).open();
				} else {
					const folders = getVaultFolders(this.deps.app);
					new FolderPickerModal(this.deps.app, folders, (p) => {
						edits.sourcePath = p;
						sourceTextComponent?.setValue(p);
					}).open();
				}
			}),
		);

		let outputTextComponent: { setValue: (v: string) => unknown } | undefined;
		const externalBadgeFrag = document.createDocumentFragment();
		const externalBadgeEl = externalBadgeFrag.appendChild(document.createElement("span"));
		const updateExternalBadge = (): void => {
			externalBadgeEl.textContent = "";
			if (edits.isExternal) {
				const badge = document.createElement("span");
				badge.className = "ft-badge ft-badge-muted ft-text-sm";
				badge.textContent = "external";
				externalBadgeEl.replaceChildren(badge);
			}
		};
		const outputSetting = new Setting(panel)
			.setName("Output path")
			.setDesc(externalBadgeFrag)
			.addText((t) => {
				t.setValue(cfg.outputPath).onChange((v) => { edits.outputPath = v; });
				outputTextComponent = t;
			});
		outputSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse vault folder").onClick(() => {
				const folders = getVaultFolders(this.deps.app);
				new FolderPickerModal(this.deps.app, folders, (folder) => {
					const filename = basename(edits.outputPath || cfg.outputPath || "export.csv") || "export.csv";
					edits.outputPath = folder ? `${folder}/${filename}` : filename;
					edits.isExternal = false;
					outputTextComponent?.setValue(edits.outputPath);
					updateExternalBadge();
				}).open();
			}),
		);
		outputSetting.addExtraButton((btn) =>
			btn.setIcon("hard-drive").setTooltip("Save to filesystem").onClick(() => {
				const format = cfg.format ?? "csv";
				const ext = format === "tab" ? "txt" : "csv";
				const currentFilename = basename(edits.outputPath || cfg.outputPath || `export.${ext}`) || `export.${ext}`;
				void showNativeSaveDialog({ format, defaultFilename: currentFilename }).then((result) => {
					if (result === null) {
						new Notice("Could not open save dialog. Try entering the path manually.");
						return;
					}
					if (!result.canceled && result.filePath) {
						edits.outputPath = result.filePath;
						edits.isExternal = true;
						outputTextComponent?.setValue(result.filePath);
						updateExternalBadge();
					}
				});
			}),
		);
		updateExternalBadge();

		new Setting(panel)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOptions({ overwrite: "Overwrite", skip: "Skip", append: "Append" })
					.setValue(cfg.conflictStrategy ?? "overwrite")
					.onChange((v) => { edits.conflictStrategy = v as SavedExportConfig["conflictStrategy"]; }),
			);

		new Setting(panel)
			.setName("Note type")
			.setDesc("Associate this export with a type for TypeDoc creation (optional)")
			.addText((t) =>
				t
					.setValue(cfg.noteType ?? "")
					.setPlaceholder("e.g. Event, Asset, Service")
					.onChange((v) => { edits.noteType = v || undefined; }),
			);

		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void this.deps.dataExchangeService
				.updateExportConfig(cfg.id, edits)
				.then(() => {
					this.deps.setState({ editingExportId: null });
					this.deps.scheduleRender();
					new Notice("Export config updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.deps.setState({ editingExportId: null });
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Execution
	// ─────────────────────────────────────────────────────────

	executeExportConfig(cfg: SavedExportConfig): void {
		void this.deps.eventBus.emit("dataExchange.export.execute", {
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

		const offComplete = this.deps.eventBus.on("dataExchange.export.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			if (r.skipped) {
				new Notice(`Export skipped: ${r.outputPath} already exists`);
			} else {
				new Notice(`Export complete: ${r.totalRows} rows written to ${r.outputPath}`);
			}
		});
		const offFailed = this.deps.eventBus.on("dataExchange.export.failed", (event) => {
			offComplete();
			offFailed();
			new Notice(`Export failed: ${event.payload.error}`);
		});
	}
}
