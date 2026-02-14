/**
 * Pipelines tab component for the Data Exchange Hub.
 * Renders the master list of multi-import pipelines and the detail/edit/preview/execute panel.
 */

import { Notice, Setting, TFile, setIcon } from "obsidian";
import type { MultiImportResult, SavedMultiImportPipeline } from "../../domain/dataExchange/types";
import { ConfigChooserModal, ConfirmModal, InputModal } from "../modals";
import { FolderPickerModal, getVaultFolders } from "../FolderPickerModal";
import { PipelineSourceModal } from "../PipelineSourceModal";
import { addInfoRow, renderEmptyDetail, resolvePipelineBaseFile, getEmptyDetailStats } from "./helpers";
import type { HubComponentDeps } from "./types";

export class PipelinesTab {
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
		let configs = state.pipelineConfigs;
		if (state.filterText) {
			configs = configs.filter(
				(c) =>
					c.name.toLowerCase().includes(state.filterText) ||
					c.targetFolder.toLowerCase().includes(state.filterText) ||
					c.mergeKey.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Import Pipelines" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});
		const headerSpacer = header.createDiv();
		headerSpacer.style.flex = "1";
		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttr("aria-label", "New Pipeline");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.createNewPipeline();
		});

		if (configs.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center" });
			empty.textContent = state.filterText
				? "No matching pipelines"
				: "No saved pipelines yet";
			return;
		}

		for (const pipe of configs) {
			this.renderPipelineItem(pipe);
		}
	}

	private renderPipelineItem(pipe: SavedMultiImportPipeline): void {
		const state = this.deps.getState();
		const isSelected = state.selectedPipelineId === pipe.id;
		const item = this.masterEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		item.style.alignItems = "flex-start";

		const iconEl = item.createSpan();
		setIcon(iconEl, "layers");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";
		iconEl.style.marginTop = "0.125rem";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: pipe.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
		sub.style.whiteSpace = "nowrap";
		sub.style.overflow = "hidden";
		sub.style.textOverflow = "ellipsis";
		sub.textContent = `${pipe.targetFolder || "(no folder)"} · ${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`;

		item.createSpan({
			text: pipe.mergeKey,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.deps.setState({ selectedPipelineId: pipe.id, editingPipelineId: null });
			this.renderMaster();
			this.renderDetail();
		});
	}

	createNewPipeline(): void {
		new InputModal(this.deps.app, {
			title: "New Import Pipeline",
			placeholder: "e.g. Daily Inventory Merge",
			inputName: "Pipeline name",
			inputDesc: "A descriptive name for this pipeline",
			submitLabel: "Create",
			onSubmit: (name) => {
				void this.deps.dataExchangeService
					.savePipeline({ name, targetFolder: "", mergeKey: "item_id", sources: [] })
					.then((saved) => {
						this.deps.setState({ selectedPipelineId: saved.id });
						this.deps.navigation.navigateTo("pipelines");
						// Set AFTER navigateTo (which clears editing state)
						this.deps.setState({ editingPipelineId: saved.id });
					});
			},
		}).open();
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		const state = this.deps.getState();

		if (!state.selectedPipelineId) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "layers", "Select a pipeline to view details", count, label);
			return;
		}

		const pipe = state.pipelineConfigs.find((c) => c.id === state.selectedPipelineId);
		if (!pipe) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "layers", "Pipeline not found", count, label);
			return;
		}

		if (state.editingPipelineId === pipe.id) {
			this.renderEditForm(pipe);
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: pipe.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Pipeline", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: pipe.mergeKey, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({
			text: `${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});
		if (pipe.noteType) {
			badges.createSpan({ text: pipe.noteType, cls: "ft-badge" });
		}
		if (pipe.exportConfigIds?.length) {
			for (const exportId of pipe.exportConfigIds) {
				const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
				const exportBadge = badges.createSpan({
					text: exportCfg ? `→ ${exportCfg.name}` : "→ (deleted)",
					cls: "ft-badge ft-badge-muted",
				});
				const eIcon = exportBadge.createSpan();
				setIcon(eIcon, "file-output");
				eIcon.style.marginRight = "0.25rem";
				exportBadge.prepend(eIcon);
			}
		}

		// Actions bar
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Execute
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => {
			this.executePipelineWithFeedback(pipe);
		});

		// Preview
		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		const previewIcon = previewLink.createSpan();
		setIcon(previewIcon, "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => {
			void this.runPipelinePreview(pipe);
		});

		// Edit
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => {
			this.deps.setState({ editingPipelineId: pipe.id });
			this.renderDetail();
		});

		// Open Doc
		const docPath = this.deps.dataExchangeService.getPipelineDocPath(pipe.name);
		const docFile = this.deps.app.vault.getAbstractFileByPath(docPath);
		const docExists = docFile instanceof TFile;
		const docLink = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docLink.createSpan();
		setIcon(docIcon, docExists ? "file-text" : "file-plus");
		docLink.appendText(docExists ? " Read Doc" : " Create Doc");
		docLink.addEventListener("click", () => {
			if (docExists) {
				void this.deps.app.workspace.openLinkText(docPath, "", false);
			} else {
				void this.deps.dataExchangeService
					.ensurePipelineDoc(pipe.id)
					.then((path) => {
						if (path) void this.deps.app.workspace.openLinkText(path, "", false);
						this.renderDetail();
					});
			}
		});

		// Open View (.base file)
		const resolvedBase = resolvePipelineBaseFile(this.deps, pipe);
		if (resolvedBase) {
			const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
			const viewIcon = viewLink.createSpan();
			setIcon(viewIcon, "table");
			viewLink.appendText(" Open View");
			viewLink.addEventListener("click", () => {
				void this.deps.app.workspace.getLeaf(false).openFile(resolvedBase);
			});
		}

		// Delete
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete pipeline "${pipe.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deps.dataExchangeService
						.deletePipeline(pipe.id)
						.then(() => {
							this.deps.setState({ selectedPipelineId: null });
							this.deps.scheduleRender();
						});
				},
			}).open();
		});

		// Description from linked config doc
		if (docExists && docFile instanceof TFile) {
			const cache = this.deps.app.metadataCache.getFileCache(docFile);
			const description = cache?.frontmatter?.["description"] as string | undefined;
			if (description) {
				const descSection = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
				descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
				descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
			}
		}

		// Config info card
		const configCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });
		addInfoRow(configGrid, "Target Folder", pipe.targetFolder || "(not set)");
		addInfoRow(configGrid, "Merge Key", pipe.mergeKey);
		addInfoRow(configGrid, "Sources", String(pipe.sources.length));
		if (pipe.noteType) addInfoRow(configGrid, "Note Type", pipe.noteType);
		if (pipe.namePrefix) addInfoRow(configGrid, "Name Prefix", pipe.namePrefix);
		if (pipe.nameSuffix) addInfoRow(configGrid, "Name Suffix", pipe.nameSuffix);
		if (pipe.createBase) addInfoRow(configGrid, "Base View", pipe.basePath || "(auto-generated)");
		addInfoRow(configGrid, "Created", new Date(pipe.createdAt).toLocaleString());
		if (pipe.lastExecutedAt) addInfoRow(configGrid, "Last Run", new Date(pipe.lastExecutedAt).toLocaleString());

		// Sources & Export Steps side by side
		this.renderSourcesAndExports(pipe);

		// Custom property conflict warnings
		this.renderConflictWarnings(pipe);

		// Custom properties summary
		this.renderCustomPropertiesSummary(pipe);
	}

	// ─────────────────────────────────────────────────────────
	// Sources & Exports grid
	// ─────────────────────────────────────────────────────────

	private renderSourcesAndExports(pipe: SavedMultiImportPipeline): void {
		const twoColGrid = this.detailEl.createDiv({ cls: "ft-mt-3" });
		twoColGrid.style.display = "grid";
		twoColGrid.style.gridTemplateColumns = "1fr 1fr";
		twoColGrid.style.gap = "1rem";
		twoColGrid.style.alignItems = "start";

		// Left column: Sources
		const sourcesCol = twoColGrid.createDiv();
		sourcesCol.createDiv({ text: "Sources", cls: "ft-detail-section-header" });

		if (pipe.sources.length === 0) {
			sourcesCol.createDiv({
				text: "No sources configured yet.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		} else {
			for (let i = 0; i < pipe.sources.length; i++) {
				this.renderSourceCard(sourcesCol, pipe, pipe.sources[i], i);
			}
		}

		const addSourceRow = sourcesCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addSourceLink = addSourceRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addSourceIcon = addSourceLink.createSpan();
		setIcon(addSourceIcon, "plus");
		addSourceLink.appendText(" Add Source");
		addSourceLink.addEventListener("click", () => {
			new PipelineSourceModal({
				app: this.deps.app,
				importService: this.deps.dataExchangeService.getImportService(),
				mergeKey: pipe.mergeKey,
				otherSources: pipe.sources,
				savedImportConfigs: this.deps.dataExchangeService.getSavedImportConfigs().filter((c) => c.sourcePath),
				hiddenCsvPaths: this.deps.dataExchangeService.getHiddenCsvPaths(),
				onSave: (newSource) => {
					const updatedSources = [...pipe.sources, newSource];
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});

		// Right column: Export Steps
		const exportsCol = twoColGrid.createDiv();
		exportsCol.createDiv({ text: "Export Steps", cls: "ft-detail-section-header" });

		if (!pipe.exportConfigIds?.length) {
			exportsCol.createDiv({
				text: "No export steps configured.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		} else {
			for (const exportId of pipe.exportConfigIds) {
				this.renderExportCard(exportsCol, pipe, exportId);
			}
		}

		const addExportRow = exportsCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addExportLink = addExportRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addExportIcon = addExportLink.createSpan();
		setIcon(addExportIcon, "plus");
		addExportLink.appendText(" Add Export Step");
		addExportLink.addEventListener("click", () => {
			const allExportConfigs = this.deps.dataExchangeService.getSavedExportConfigs();
			const available = allExportConfigs.filter((c) => !(pipe.exportConfigIds ?? []).includes(c.id));
			if (available.length === 0) {
				new Notice("No export configs available. Create one first.");
				return;
			}
			new ConfigChooserModal(
				this.deps.app,
				available.map((c) => ({ id: c.id, name: c.name })),
				(id: string | null) => {
					if (id === null) return;
					const updatedIds = [...(pipe.exportConfigIds ?? []), id];
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
						.then(() => this.deps.scheduleRender());
				},
			).open();
		});
	}

	private renderSourceCard(
		container: HTMLElement,
		pipe: SavedMultiImportPipeline,
		source: SavedMultiImportPipeline["sources"][0],
		index: number,
	): void {
		const card = container.createDiv({ cls: "ft-card ft-mt-1" });
		card.style.padding = "0.5rem 0.75rem";

		const csvName = source.csvPath.split("/").pop() ?? source.csvPath;

		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const csvIcon = headerRow.createSpan();
		setIcon(csvIcon, "file-spreadsheet");
		csvIcon.style.opacity = "0.5";
		csvIcon.style.flexShrink = "0";

		const nameEl = headerRow.createEl("span", {
			text: csvName,
			cls: "ft-heading ft-heading-sm ft-nav-link",
		});
		nameEl.style.flex = "1";
		nameEl.style.minWidth = "0";
		nameEl.style.overflow = "hidden";
		nameEl.style.textOverflow = "ellipsis";
		nameEl.style.whiteSpace = "nowrap";
		nameEl.addEventListener("click", () => {
			new PipelineSourceModal({
				app: this.deps.app,
				importService: this.deps.dataExchangeService.getImportService(),
				mergeKey: pipe.mergeKey,
				existingSource: source,
				otherSources: pipe.sources.filter((s) => s.id !== source.id),
				savedImportConfigs: this.deps.dataExchangeService.getSavedImportConfigs().filter((c) => c.sourcePath),
				hiddenCsvPaths: this.deps.dataExchangeService.getHiddenCsvPaths(),
				onSave: (updated) => {
					const updatedSources = pipe.sources.map((s) => (s.id === updated.id ? updated : s));
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});

		headerRow.createSpan({
			text: `${source.mergeKeyColumn} → ${pipe.mergeKey}`,
			cls: "ft-badge ft-badge-muted",
		});

		const included = source.columnMappings.filter((m) => m.included).length;
		const total = source.columnMappings.length;
		headerRow.createSpan({
			text: `${included}/${total} cols`,
			cls: "ft-badge ft-badge-muted",
		});

		const infoRow = card.createDiv({ cls: "ft-text-muted ft-text-sm ft-mt-1" });
		infoRow.textContent = source.csvPath;

		if (source.customProperties && Object.keys(source.customProperties).length > 0) {
			const propsRow = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			propsRow.style.flexWrap = "wrap";
			for (const [key, value] of Object.entries(source.customProperties)) {
				const chip = propsRow.createSpan({ cls: "ft-badge ft-badge-muted" });
				chip.textContent = `${key}: ${value}`;
			}
		}

		const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		removeLink.style.color = "var(--text-error)";
		const removeIcon = removeLink.createSpan();
		setIcon(removeIcon, "x");
		removeLink.appendText(" Remove");
		removeLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Remove source "${csvName}" from pipeline?`,
				confirmLabel: "Remove",
				onConfirm: () => {
					const updatedSources = pipe.sources.filter((_, idx) => idx !== index);
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});
	}

	private renderExportCard(
		container: HTMLElement,
		pipe: SavedMultiImportPipeline,
		exportId: string,
	): void {
		const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
		const card = container.createDiv({ cls: "ft-card ft-mt-1" });
		card.style.padding = "0.5rem 0.75rem";

		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = headerRow.createSpan();
		setIcon(icon, "file-output");
		icon.style.opacity = "0.5";
		icon.style.flexShrink = "0";

		if (exportCfg) {
			const nameEl = headerRow.createEl("span", {
				text: exportCfg.name,
				cls: "ft-heading ft-heading-sm ft-nav-link",
			});
			nameEl.style.flex = "1";
			nameEl.style.minWidth = "0";
			nameEl.style.overflow = "hidden";
			nameEl.style.textOverflow = "ellipsis";
			nameEl.style.whiteSpace = "nowrap";
			nameEl.addEventListener("click", () => {
				this.deps.setState({ selectedExportId: exportCfg.id });
				this.deps.navigation.navigateTo("exports");
			});

			headerRow.createSpan({
				text: exportCfg.format === "tab" ? "TAB" : "CSV",
				cls: "ft-badge ft-badge-muted",
			});

			if (exportCfg.sourcePath) {
				const sourceRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
				const sourceLabel = exportCfg.sourceType === "base" ? "Base:" : "Folder:";
				sourceRow.createSpan({ text: sourceLabel, cls: "ft-text-muted ft-text-sm" });
				const sourceFile = this.deps.app.vault.getAbstractFileByPath(exportCfg.sourcePath);
				if (sourceFile instanceof TFile) {
					const sourceLink = sourceRow.createEl("span", {
						text: exportCfg.sourcePath,
						cls: "ft-nav-link ft-text-sm",
					});
					sourceLink.addEventListener("click", () => {
						void this.deps.app.workspace.getLeaf(false).openFile(sourceFile);
					});
				} else {
					sourceRow.createSpan({
						text: exportCfg.sourcePath,
						cls: "ft-text-muted ft-text-sm",
					});
				}

				if (exportCfg.sourceType === "base") {
					const viewRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
					viewRow.createSpan({ text: "View:", cls: "ft-text-muted ft-text-sm" });
					const viewNameEl = viewRow.createSpan({
						text: `#${exportCfg.baseViewIndex ?? 0}`,
						cls: "ft-text-sm",
					});
					const baseFile = this.deps.app.vault.getAbstractFileByPath(exportCfg.sourcePath);
					if (baseFile instanceof TFile) {
						void this.deps.app.vault.read(baseFile).then((content) => {
							const parsed = this.deps.dataExchangeService.getExportService().getBaseEngine().parseBaseFile(content);
							const idx = exportCfg.baseViewIndex ?? 0;
							const view = parsed.views[idx] ?? parsed.views[0];
							if (view) {
								viewNameEl.textContent = view.name || `View ${idx}`;
								if (view.type) {
									viewRow.createSpan({
										text: view.type,
										cls: "ft-badge ft-badge-muted ft-text-sm",
									});
								}
							}
						}).catch(() => { /* parse error */ });
					}
				}
			}

			const targetRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
			targetRow.createSpan({ text: "Target:", cls: "ft-text-muted ft-text-sm" });
			targetRow.createSpan({
				text: exportCfg.outputPath || "(no output path)",
				cls: "ft-text-sm",
			});

			if (exportCfg.isExternal) {
				const extRow = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
				extRow.createSpan({ text: "external", cls: "ft-badge ft-badge-muted" });
			}

			const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
			const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			removeLink.style.color = "var(--text-error)";
			const removeIcon = removeLink.createSpan();
			setIcon(removeIcon, "x");
			removeLink.appendText(" Remove");
			removeLink.addEventListener("click", () => {
				new ConfirmModal(this.deps.app, {
					message: `Remove export step "${exportCfg.name}" from pipeline?`,
					confirmLabel: "Remove",
					onConfirm: () => {
						const updatedIds = (pipe.exportConfigIds ?? []).filter((id) => id !== exportId);
						void this.deps.dataExchangeService
							.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
							.then(() => this.deps.scheduleRender());
					},
				}).open();
			});
		} else {
			headerRow.createSpan({ text: "(deleted)", cls: "ft-heading ft-heading-sm ft-text-muted" });
			card.createDiv({
				text: "Export config has been deleted",
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
			const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
			const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			removeLink.style.color = "var(--text-error)";
			const removeIcon = removeLink.createSpan();
			setIcon(removeIcon, "x");
			removeLink.appendText(" Remove");
			removeLink.addEventListener("click", () => {
				const updatedIds = (pipe.exportConfigIds ?? []).filter((id) => id !== exportId);
				void this.deps.dataExchangeService
					.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
					.then(() => this.deps.scheduleRender());
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Conflict warnings & custom properties summary
	// ─────────────────────────────────────────────────────────

	private renderConflictWarnings(pipe: SavedMultiImportPipeline): void {
		if (pipe.sources.length <= 1) return;

		const propMap = new Map<string, Array<{ sourceLabel: string; value: string }>>();
		for (const src of pipe.sources) {
			if (!src.customProperties) continue;
			const label = src.csvPath.split("/").pop() ?? src.csvPath;
			for (const [key, value] of Object.entries(src.customProperties)) {
				if (!propMap.has(key)) propMap.set(key, []);
				propMap.get(key)!.push({ sourceLabel: label, value });
			}
		}
		const conflicts: Array<{ key: string; entries: Array<{ sourceLabel: string; value: string }> }> = [];
		for (const [key, entries] of propMap) {
			if (entries.length > 1) {
				const values = new Set(entries.map((e) => e.value));
				if (values.size > 1) {
					conflicts.push({ key, entries });
				}
			}
		}

		if (conflicts.length === 0) return;

		const warnSection = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		warnSection.style.borderLeft = "3px solid var(--text-warning, #e5a100)";
		const warnHeader = warnSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const warnIcon = warnHeader.createSpan();
		setIcon(warnIcon, "alert-triangle");
		warnIcon.style.color = "var(--text-warning, #e5a100)";
		warnIcon.style.flexShrink = "0";
		warnHeader.createSpan({
			text: `${conflicts.length} custom property conflict${conflicts.length !== 1 ? "s" : ""}`,
			cls: "ft-heading ft-heading-sm",
		});
		const warnDesc = warnSection.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });
		warnDesc.textContent = "Multiple sources define the same key with different values. The last source processed will win.";

		const grid = warnSection.createDiv({ cls: "ft-detail-info-grid ft-px-2 ft-pb-2" });
		for (const c of conflicts) {
			addInfoRow(grid, c.key, c.entries.map((e) => `"${e.value}" (${e.sourceLabel})`).join(" vs "));
		}
	}

	private renderCustomPropertiesSummary(pipe: SavedMultiImportPipeline): void {
		if (!pipe.sources.some((s) => s.customProperties && Object.keys(s.customProperties).length > 0)) return;

		const propsSection = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
		propsSection.createDiv({ text: "Custom Properties", cls: "ft-detail-section-header" });
		const allProps = new Map<string, string>();
		for (const src of pipe.sources) {
			if (!src.customProperties) continue;
			for (const [key, value] of Object.entries(src.customProperties)) {
				allProps.set(key, value);
			}
		}
		const propGrid = propsSection.createDiv({ cls: "ft-detail-info-grid" });
		for (const [key, value] of allProps) {
			addInfoRow(propGrid, key, value);
		}
	}

	// ─────────────────────────────────────────────────────────
	// Edit form
	// ─────────────────────────────────────────────────────────

	private renderEditForm(pipe: SavedMultiImportPipeline): void {
		const panel = this.detailEl;
		panel.createEl("h3", { text: "Edit Pipeline", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<SavedMultiImportPipeline> = {
			name: pipe.name,
			targetFolder: pipe.targetFolder,
			mergeKey: pipe.mergeKey,
			noteType: pipe.noteType ?? "",
			namePrefix: pipe.namePrefix ?? "",
			nameSuffix: pipe.nameSuffix ?? "",
			createBase: pipe.createBase ?? false,
			basePath: pipe.basePath ?? "",
		};

		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(pipe.name).onChange((v) => { edits.name = v; }));

		let targetTextComponent: { setValue: (v: string) => unknown } | undefined;
		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.addText((t) => {
				t.setValue(pipe.targetFolder).onChange((v) => { edits.targetFolder = v; });
				targetTextComponent = t;
			});
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.deps.app);
				new FolderPickerModal(this.deps.app, folders, (folder) => {
					edits.targetFolder = folder;
					targetTextComponent?.setValue(folder);
				}).open();
			}),
		);

		const grid = panel.createDiv();
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "1fr 1fr";
		grid.style.columnGap = "1rem";
		grid.style.rowGap = "0";

		new Setting(grid)
			.setName("Merge key")
			.addText((t) => t
				.setValue(pipe.mergeKey)
				.setPlaceholder("e.g. item_id")
				.onChange((v) => { edits.mergeKey = v; }),
			);

		new Setting(grid)
			.setName("Note type")
			.addText((t) => t
				.setValue(pipe.noteType ?? "")
				.setPlaceholder("e.g. Event, Asset")
				.onChange((v) => { edits.noteType = v || undefined; }),
			);

		new Setting(grid)
			.setName("Filename prefix")
			.addText((t) => t
				.setValue(pipe.namePrefix ?? "")
				.setPlaceholder("optional")
				.onChange((v) => { edits.namePrefix = v || undefined; }),
			);

		new Setting(grid)
			.setName("Filename suffix")
			.addText((t) => t
				.setValue(pipe.nameSuffix ?? "")
				.setPlaceholder("optional")
				.onChange((v) => { edits.nameSuffix = v || undefined; }),
			);

		new Setting(grid)
			.setName("Create .base view")
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
			void this.deps.dataExchangeService
				.updatePipeline(pipe.id, edits)
				.then(() => {
					this.deps.setState({ editingPipelineId: null });
					this.deps.scheduleRender();
					new Notice("Pipeline updated");
				});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.deps.setState({ editingPipelineId: null });
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Preview
	// ─────────────────────────────────────────────────────────

	async runPipelinePreview(pipe: SavedMultiImportPipeline): Promise<void> {
		if (pipe.sources.length === 0) {
			new Notice("Pipeline has no sources. Add CSV sources first.");
			return;
		}

		const existing = this.detailEl.querySelector(".ft-pipeline-progress") as HTMLElement | null;
		if (existing) existing.remove();

		const section = createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
		const actionsBar = this.detailEl.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.detailEl.insertBefore(section, actionsBar.nextSibling);
		} else {
			this.detailEl.appendChild(section);
		}

		const loadingRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const loadSpinner = loadingRow.createSpan();
		setIcon(loadSpinner, "loader");
		loadSpinner.style.opacity = "0.6";
		loadSpinner.addClass("ft-spin");
		loadingRow.createSpan({ text: "Preparing preview...", cls: "ft-text-sm" });

		try {
			const importService = this.deps.dataExchangeService.getImportService();
			const previewSources: Array<{
				sourceId: string;
				csvName: string;
				rowCount: number;
				columns: string[];
				mergeKeyValues: string[];
				error?: string;
			}> = [];

			for (const source of pipe.sources) {
				try {
					const parsed = await importService.parseFile(source.csvPath);
					const mergeKeyIndex = parsed.headers.indexOf(source.mergeKeyColumn);
					if (mergeKeyIndex < 0) {
						previewSources.push({
							sourceId: source.id,
							csvName: source.csvPath.split("/").pop() ?? source.csvPath,
							rowCount: 0,
							columns: [],
							mergeKeyValues: [],
							error: `Merge key column "${source.mergeKeyColumn}" not found`,
						});
						continue;
					}

					const mergeKeyValues = parsed.rows
						.map((row) => row[mergeKeyIndex])
						.filter((v): v is string => v !== undefined && v !== "");

					const columns = source.columnMappings
						.filter((m) => m.included && m.csvColumn !== source.mergeKeyColumn)
						.map((m) => m.frontmatterKey);

					previewSources.push({
						sourceId: source.id,
						csvName: source.csvPath.split("/").pop() ?? source.csvPath,
						rowCount: parsed.rows.length,
						columns,
						mergeKeyValues,
					});
				} catch (err) {
					previewSources.push({
						sourceId: source.id,
						csvName: source.csvPath.split("/").pop() ?? source.csvPath,
						rowCount: 0,
						columns: [],
						mergeKeyValues: [],
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}

			const allKeys = new Set<string>();
			for (const src of previewSources) {
				for (const v of src.mergeKeyValues) allKeys.add(v);
			}

			const entries: Array<{ key: string; filename: string; exists: boolean }> = [];
			for (const key of allKeys) {
				const sanitized = importService.sanitizeFilename(key);
				if (!sanitized) continue;
				const prefix = pipe.namePrefix ?? "";
				const suffix = pipe.nameSuffix ?? "";
				const filename = `${prefix}${sanitized}${suffix}`;
				const notePath = `${pipe.targetFolder}/${filename}.md`;
				const exists = this.deps.app.vault.getAbstractFileByPath(notePath) instanceof TFile;
				entries.push({ key, filename, exists });
			}

			const toCreate = entries.filter((e) => !e.exists).length;
			const toUpdate = entries.filter((e) => e.exists).length;

			section.empty();
			this.renderPreviewContent(section, pipe, previewSources, entries, toCreate, toUpdate);
		} catch (err) {
			section.empty();
			const errRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const errIcon = errRow.createSpan();
			setIcon(errIcon, "x-circle");
			errIcon.style.color = "var(--text-error)";
			errRow.createSpan({
				text: `Preview failed: ${err instanceof Error ? err.message : String(err)}`,
				cls: "ft-text-sm",
			});
		}
	}

	private renderPreviewContent(
		section: HTMLElement,
		pipe: SavedMultiImportPipeline,
		previewSources: Array<{
			sourceId: string;
			csvName: string;
			rowCount: number;
			columns: string[];
			mergeKeyValues: string[];
			error?: string;
		}>,
		entries: Array<{ key: string; filename: string; exists: boolean }>,
		toCreate: number,
		toUpdate: number,
	): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "eye");
		header.createEl("span", { text: "Pipeline Preview", cls: "ft-text-sm ft-font-medium" });

		const stats = section.createDiv({ cls: "ft-flex ft-gap-3 ft-px-2 ft-pb-2" });
		stats.createSpan({
			text: `${entries.length} items`,
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});
		if (toCreate > 0) {
			const createBadge = stats.createSpan({ cls: "ft-badge ft-text-sm" });
			createBadge.style.color = "var(--text-success)";
			createBadge.textContent = `${toCreate} new`;
		}
		if (toUpdate > 0) {
			const updateBadge = stats.createSpan({ cls: "ft-badge ft-text-sm" });
			updateBadge.style.color = "var(--text-accent)";
			updateBadge.textContent = `${toUpdate} update`;
		}

		const sourcesDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
		for (const src of previewSources) {
			const srcRow = sourcesDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			if (src.error) {
				const errIcon = srcRow.createSpan();
				setIcon(errIcon, "alert-triangle");
				errIcon.style.color = "var(--text-error)";
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({ text: src.error, cls: "ft-text-sm ft-text-muted" });
			} else {
				const srcIcon = srcRow.createSpan();
				setIcon(srcIcon, "file-spreadsheet");
				srcIcon.style.opacity = "0.6";
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({
					text: `${src.rowCount} rows · ${src.columns.length} columns`,
					cls: "ft-text-muted ft-text-sm",
				});
			}
		}

		if (pipe.exportConfigIds && pipe.exportConfigIds.length > 0) {
			const exportsDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
			exportsDiv.createDiv({ text: "Export Steps", cls: "ft-detail-section-header ft-mb-1" });
			for (const exportId of pipe.exportConfigIds) {
				const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
				const expRow = exportsDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
				if (exportCfg) {
					const expIcon = expRow.createSpan();
					setIcon(expIcon, "file-output");
					expIcon.style.opacity = "0.6";
					expRow.createSpan({ text: exportCfg.name, cls: "ft-text-sm" });
					const details: string[] = [];
					details.push(exportCfg.format.toUpperCase());
					details.push(exportCfg.outputPath.split("/").pop() ?? exportCfg.outputPath);
					if (exportCfg.isExternal) details.push("external");
					expRow.createSpan({
						text: details.join(" · "),
						cls: "ft-text-muted ft-text-sm",
					});
				} else {
					const warnIcon = expRow.createSpan();
					setIcon(warnIcon, "alert-triangle");
					warnIcon.style.color = "var(--text-warning)";
					expRow.createSpan({ text: "(deleted config)", cls: "ft-text-sm ft-text-muted" });
				}
			}
		}

		if (entries.length > 0) {
			section.createDiv({
				text: "Items",
				cls: "ft-detail-section-header ft-px-2 ft-mt-1",
			});
			const tableDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
			tableDiv.style.maxHeight = "200px";
			tableDiv.style.overflowY = "auto";

			for (const entry of entries) {
				const row = tableDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
				row.style.borderBottom = "1px solid var(--background-modifier-border)";

				const dot = row.createSpan({ cls: "ft-text-sm" });
				dot.style.color = entry.exists ? "var(--text-accent)" : "var(--text-success)";
				dot.textContent = entry.exists ? "○" : "●";

				const keySpan = row.createSpan({ text: entry.key, cls: "ft-text-sm" });
				keySpan.style.flex = "1";
				keySpan.style.overflow = "hidden";
				keySpan.style.textOverflow = "ellipsis";
				keySpan.style.whiteSpace = "nowrap";

				const badge = row.createSpan({
					text: entry.exists ? "Update" : "New",
					cls: "ft-badge ft-badge-muted ft-text-sm",
				});
				if (!entry.exists) badge.style.color = "var(--text-success)";
			}
		}

		const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-justify-end ft-gap-2 ft-p-2" });
		footer.style.borderTop = "1px solid var(--background-modifier-border)";

		const cancelBtn = footer.createEl("button", { cls: "mod-muted", text: "Cancel" });
		cancelBtn.addEventListener("click", () => section.remove());

		const hasErrors = previewSources.some((s) => s.error);
		const runBtn = footer.createEl("button", { cls: "mod-cta", text: "Run Pipeline" });
		if (hasErrors) {
			runBtn.disabled = true;
			runBtn.title = "Fix source errors before running";
		}
		runBtn.addEventListener("click", () => {
			section.remove();
			this.executePipelineWithFeedback(pipe);
		});
	}

	// ─────────────────────────────────────────────────────────
	// Execution
	// ─────────────────────────────────────────────────────────

	executePipelineWithFeedback(pipe: SavedMultiImportPipeline): void {
		const existing = this.detailEl.querySelector(".ft-pipeline-progress") as HTMLElement | null;
		if (existing) existing.remove();
		const section = createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
		const actionsBar = this.detailEl.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.detailEl.insertBefore(section, actionsBar.nextSibling);
		} else {
			this.detailEl.appendChild(section);
		}

		const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.style.opacity = "0.6";
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({
			text: `Running pipeline: ${pipe.name}...`,
			cls: "ft-text-sm",
		});

		const barBg = section.createDiv();
		barBg.style.cssText = "height:4px;background:var(--background-modifier-border);border-radius:2px;margin:0 0.5rem 0.5rem;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

		const offSourceCompleted = this.deps.eventBus.on("dataExchange.pipeline.sourceCompleted", (event) => {
			const { sourceIndex, totalSources, sourceResult } = event.payload;
			const pct = totalSources > 0 ? Math.round(((sourceIndex + 1) / totalSources) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Processing source ${sourceIndex + 1} of ${totalSources}...`;
			const csvName = sourceResult.csvPath.split("/").pop() ?? sourceResult.csvPath;
			detailText.textContent = `${csvName}: ${sourceResult.result.created} created, ${sourceResult.result.updated} updated`;
		});

		const cleanup = (success: boolean, message: string, result?: MultiImportResult) => {
			offSourceCompleted();
			section.empty();

			const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });

			if (success && result) {
				const statsGrid = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
				statsGrid.style.display = "grid";
				statsGrid.style.gridTemplateColumns = "repeat(4, 1fr)";
				statsGrid.style.gap = "0.5rem";
				const statItems: Array<{ label: string; value: number; color?: string }> = [
					{ label: "Created", value: result.created, color: "var(--text-success)" },
					{ label: "Updated", value: result.updated },
					{ label: "Skipped", value: result.skipped },
					{ label: "Failed", value: result.failed, color: result.failed > 0 ? "var(--text-error)" : undefined },
				];
				for (const stat of statItems) {
					const cell = statsGrid.createDiv({ cls: "ft-text-center" });
					const val = cell.createDiv({ cls: "ft-heading ft-heading-sm" });
					val.textContent = String(stat.value);
					if (stat.color) val.style.color = stat.color;
					cell.createDiv({ text: stat.label, cls: "ft-text-muted ft-text-sm" });
				}

				if (result.sourceResults.length > 1) {
					const breakdown = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
					for (const sr of result.sourceResults) {
						const row = breakdown.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
						row.style.borderTop = "1px solid var(--background-modifier-border)";
						const csvName = sr.csvPath.split("/").pop() ?? sr.csvPath;
						row.createSpan({ text: csvName, cls: "ft-text-sm" }).style.flex = "1";
						const counts = [];
						if (sr.result.created > 0) counts.push(`${sr.result.created} created`);
						if (sr.result.updated > 0) counts.push(`${sr.result.updated} updated`);
						if (sr.result.skipped > 0) counts.push(`${sr.result.skipped} skipped`);
						if (sr.result.failed > 0) counts.push(`${sr.result.failed} failed`);
						row.createSpan({ text: counts.join(", "), cls: "ft-text-muted ft-text-sm" });
					}
				}

				if (pipe.exportConfigIds?.length) {
					for (const exportId of pipe.exportConfigIds) {
						const exportRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-2 ft-py-2" });
						exportRow.style.borderTop = "1px solid var(--background-modifier-border)";
						const eIcon = exportRow.createSpan();
						setIcon(eIcon, "file-output");
						eIcon.style.opacity = "0.6";
						const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
						exportRow.createSpan({
							text: `Export: ${exportCfg?.name ?? "(deleted)"}`,
							cls: "ft-text-sm",
						});
						const checkIcon = exportRow.createSpan();
						setIcon(checkIcon, "check");
						checkIcon.style.color = "var(--text-success)";
					}
				}

				this.deps.scheduleRender();
			}
		};

		const offComplete = this.deps.eventBus.on("dataExchange.pipeline.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "");
			cleanup(true, msg, r);
			new Notice(`Pipeline complete: ${msg}`);
		});
		const offFailed = this.deps.eventBus.on("dataExchange.pipeline.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Pipeline failed: ${event.payload.error}`);
			new Notice(`Pipeline failed: ${event.payload.error}`);
		});

		void this.deps.eventBus.emit("dataExchange.pipeline.execute", {
			pipelineId: pipe.id,
		});
	}
}
