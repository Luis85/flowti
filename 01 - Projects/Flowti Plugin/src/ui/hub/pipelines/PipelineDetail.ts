/**
 * Pipeline detail view — header, actions bar, config card, description,
 * then delegates to SourcesExportsGrid for the grid sections.
 */

import { TFile, setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import { ConfirmModal } from "../../modals";
import { addInfoRow, resolvePipelineBaseFile } from "../helpers";
import { SourcesExportsGrid } from "./SourcesExportsGrid";
import type { PipelineComponentDeps } from "./types";

export class PipelineDetail {
	private grid: SourcesExportsGrid;

	constructor(
		private container: HTMLElement,
		private deps: PipelineComponentDeps,
	) {
		this.grid = new SourcesExportsGrid(container, deps);
	}

	render(pipe: SavedMultiImportPipeline): void {
		this.renderHeader(pipe);
		this.renderActions(pipe);
		this.renderDescription(pipe);
		this.renderConfigInfo(pipe);
		this.grid.render(pipe);
	}

	private renderHeader(pipe: SavedMultiImportPipeline): void {
		const header = this.container.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: pipe.name || "(unnamed)", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Pipeline", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: pipe.mergeKey, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`, cls: "ft-badge ft-badge-muted" });
		if (pipe.noteType) badges.createSpan({ text: pipe.noteType, cls: "ft-badge" });
		if (pipe.canvasConfigIds?.length) badges.createSpan({ text: `${pipe.canvasConfigIds.length} canvas`, cls: "ft-badge ft-badge-muted" });
		if (pipe.exportConfigIds?.length) {
			for (const exportId of pipe.exportConfigIds) {
				const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
				const exportBadge = badges.createSpan({ text: exportCfg ? `→ ${exportCfg.name}` : "→ (deleted)", cls: "ft-badge ft-badge-muted" });
				const eIcon = exportBadge.createSpan();
				setIcon(eIcon, "file-output");
				eIcon.addClass("ft-mr-025");
				exportBadge.prepend(eIcon);
			}
		}
	}

	private renderActions(pipe: SavedMultiImportPipeline): void {
		const actions = this.container.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(runLink.createSpan(), "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => { this.deps.executePipeline(pipe); });

		const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(previewLink.createSpan(), "eye");
		previewLink.appendText(" Preview");
		previewLink.addEventListener("click", () => { this.deps.runPreview(pipe); });

		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(editLink.createSpan(), "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => { this.deps.setState({ editingPipelineId: pipe.id }); this.deps.renderDetail(); });

		const docPath = this.deps.dataExchangeService.getPipelineDocPath(pipe.name);
		const docFile = this.deps.app.vault.getAbstractFileByPath(docPath);
		const docExists = docFile instanceof TFile;
		const docLink = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(docLink.createSpan(), docExists ? "file-text" : "file-plus");
		docLink.appendText(docExists ? " Read Doc" : " Create Doc");
		docLink.addEventListener("click", () => {
			if (docExists) { void this.deps.app.workspace.openLinkText(docPath, "", false); }
			else { void this.deps.dataExchangeService.ensurePipelineDoc(pipe.id).then((path) => { if (path) void this.deps.app.workspace.openLinkText(path, "", false); this.deps.renderDetail(); }); }
		});

		const resolvedBase = resolvePipelineBaseFile(this.deps, pipe);
		if (resolvedBase) {
			const viewLink = actions.createEl("span", { cls: "ft-nav-link" });
			setIcon(viewLink.createSpan(), "table");
			viewLink.appendText(" Open View");
			viewLink.addEventListener("click", () => { void this.deps.app.workspace.getLeaf(false).openFile(resolvedBase); });
		}

		const deleteLink = actions.createEl("span", { cls: "ft-nav-link ft-text-error" });
		setIcon(deleteLink.createSpan(), "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete pipeline "${pipe.name}"?`, confirmLabel: "Delete",
				onConfirm: () => { void this.deps.dataExchangeService.deletePipeline(pipe.id).then(() => { this.deps.setState({ selectedPipelineId: null }); this.deps.scheduleRender(); }); },
			}).open();
		});
	}

	private renderDescription(pipe: SavedMultiImportPipeline): void {
		const docPath = this.deps.dataExchangeService.getPipelineDocPath(pipe.name);
		const docFile = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (!(docFile instanceof TFile)) return;
		const cache = this.deps.app.metadataCache.getFileCache(docFile);
		const description = cache?.frontmatter?.["description"] as string | undefined;
		if (description) {
			const descSection = this.container.createDiv({ cls: "ft-card ft-mt-3" });
			descSection.createDiv({ text: "Description", cls: "ft-detail-section-header" });
			descSection.createDiv({ text: description, cls: "ft-text-muted ft-p-2" });
		}
	}

	private renderConfigInfo(pipe: SavedMultiImportPipeline): void {
		const configCard = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });
		addInfoRow(configGrid, "Target Folder", pipe.targetFolder || "(not set)");
		addInfoRow(configGrid, "Merge Key", pipe.mergeKey);
		addInfoRow(configGrid, "CSV Sources", String(pipe.sources.length));
		if (pipe.canvasConfigIds?.length) addInfoRow(configGrid, "Canvas Steps", String(pipe.canvasConfigIds.length));
		if (pipe.noteType) addInfoRow(configGrid, "Note Type", pipe.noteType);
		if (pipe.namePrefix) addInfoRow(configGrid, "Name Prefix", pipe.namePrefix);
		if (pipe.nameSuffix) addInfoRow(configGrid, "Name Suffix", pipe.nameSuffix);
		if (pipe.createBase) addInfoRow(configGrid, "Base View", pipe.basePath || "(auto-generated)");
		addInfoRow(configGrid, "Created", new Date(pipe.createdAt).toLocaleString());
		if (pipe.lastExecutedAt) addInfoRow(configGrid, "Last Run", new Date(pipe.lastExecutedAt).toLocaleString());
	}
}
