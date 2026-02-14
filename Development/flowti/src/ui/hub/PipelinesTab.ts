/**
 * Pipelines tab component for the Data Exchange Hub.
 * Thin orchestrator — delegates to sub-components in `./pipelines/`.
 */

import { setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../domain/dataExchange/types";
import { InputModal } from "../modals";
import { renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import type { HubComponentDeps } from "./types";
import { PipelineDetail, PipelineEditForm, PipelinePreview, PipelineExecution } from "./pipelines";
import type { PipelineComponentDeps } from "./pipelines";

export class PipelinesTab {
	private detail: PipelineDetail | null = null;
	private editForm: PipelineEditForm | null = null;
	private preview: PipelinePreview | null = null;
	private execution: PipelineExecution | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	private buildDeps(): PipelineComponentDeps {
		return {
			app: this.deps.app,
			eventBus: this.deps.eventBus,
			dataExchangeService: this.deps.dataExchangeService,
			getState: () => this.deps.getState(),
			setState: (partial) => this.deps.setState(partial),
			navigation: this.deps.navigation,
			scheduleRender: () => this.deps.scheduleRender(),
			renderDetail: () => this.renderDetail(),
			executePipeline: (pipe) => this.executePipelineWithFeedback(pipe),
			runPreview: (pipe) => void this.runPipelinePreview(pipe),
		};
	}

	private ensureComponents(): void {
		if (this.detail) return;
		const deps = this.buildDeps();
		this.detail = new PipelineDetail(this.detailEl, deps);
		this.editForm = new PipelineEditForm(this.detailEl, deps);
		this.preview = new PipelinePreview(this.detailEl, deps);
		this.execution = new PipelineExecution(this.detailEl, deps);
	}

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
		headerSpacer.addClass("ft-flex-1");
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
		iconEl.addClass("ft-icon-muted");
		iconEl.addClass("ft-flex-shrink-0");
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
						this.deps.setState({ editingPipelineId: saved.id });
					});
			},
		}).open();
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel (dispatch)
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		this.ensureComponents();

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
			this.editForm!.render(pipe);
			return;
		}

		this.detail!.render(pipe);
	}

	// ─────────────────────────────────────────────────────────
	// Preview & Execution (delegated)
	// ─────────────────────────────────────────────────────────

	async runPipelinePreview(pipe: SavedMultiImportPipeline): Promise<void> {
		this.ensureComponents();
		await this.preview!.run(pipe);
	}

	executePipelineWithFeedback(pipe: SavedMultiImportPipeline): void {
		this.ensureComponents();
		this.execution!.execute(pipe);
	}
}
