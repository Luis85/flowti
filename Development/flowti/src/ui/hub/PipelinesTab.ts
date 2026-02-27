/**
 * Pipelines tab component for the Data Exchange Hub.
 * Thin orchestrator — delegates to sub-components in `./pipelines/`.
 */

import { setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../domain/dataExchange/types";
import { InputModal } from "../modals";
import { renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import type { ActiveOperation, HubComponentDeps } from "./types";
import { PipelineDetail, PipelineEditForm, PipelinePreview } from "./pipelines";
import type { PipelineComponentDeps } from "./pipelines";
import { basename } from "../../utils/pathUtils";

export class PipelinesTab {
	private detail: PipelineDetail | null = null;
	private editForm: PipelineEditForm | null = null;
	private preview: PipelinePreview | null = null;
	private liveUnsubscribes: (() => void)[] = [];

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
			canvasService: this.deps.canvasService,
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
		item.dataset.id = pipe.id;
		item.addClass("ft-master-item-top");

		const iconEl = item.createSpan();
		setIcon(iconEl, "layers");
		iconEl.addClass("ft-icon-muted");
		iconEl.addClass("ft-flex-shrink-0");
		iconEl.addClass("ft-icon-offset-sm");

		const textBlock = item.createDiv({ cls: "ft-master-event-name ft-master-text-block" });
		textBlock.createDiv({ text: pipe.name || "(unnamed)" });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm ft-text-ellipsis" });
		const totalSources = pipe.sources.length + (pipe.canvasConfigIds?.length ?? 0);
		sub.textContent = `${pipe.targetFolder || "(no folder)"} · ${totalSources} source${totalSources !== 1 ? "s" : ""}`;

		item.createSpan({
			text: pipe.mergeKey,
			cls: "ft-master-category-count",
		});

		item.addEventListener("click", () => {
			this.deps.setState({ selectedPipelineId: pipe.id, editingPipelineId: null });
			this.updateMasterSelection(pipe.id);
			this.renderDetail();
		});
	}

	private updateMasterSelection(selectedId: string): void {
		this.masterEl.querySelectorAll(".ft-master-event-item").forEach((el) => {
			el.classList.toggle("ft-master-event-selected", (el as HTMLElement).dataset.id === selectedId);
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
		this.cleanupLiveListeners();
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

		// Show active operation progress from state (survives re-renders)
		const activeOp = state.activeOperations.find(
			(op) => op.operationId === pipe.id && op.type === "pipeline",
		);
		if (activeOp) {
			this.renderPipelineProgress(activeOp, pipe);
		}
	}

	// ─────────────────────────────────────────────────────────
	// Preview & Execution
	// ─────────────────────────────────────────────────────────

	async runPipelinePreview(pipe: SavedMultiImportPipeline): Promise<void> {
		this.ensureComponents();
		await this.preview!.run(pipe);
	}

	executePipelineWithFeedback(pipe: SavedMultiImportPipeline): void {
		// Fire-and-forget — state-backed Active Operations tracks progress
		this.deps.navigation.executePipeline(pipe);
	}

	cleanupLiveListeners(): void {
		for (const unsub of this.liveUnsubscribes) unsub();
		this.liveUnsubscribes = [];
	}

	// ─────────────────────────────────────────────────────────
	// State-backed pipeline progress (survives re-renders)
	// ─────────────────────────────────────────────────────────

	private renderPipelineProgress(op: ActiveOperation, pipe: SavedMultiImportPipeline): void {
		const section = this.detailEl.createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
		const actionsBar = this.detailEl.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.detailEl.insertBefore(section, actionsBar.nextSibling);
		}

		if (op.completed) {
			const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, op.success ? "check-circle" : "x-circle");
			icon.addClass(op.success ? "ft-text-success" : "ft-text-error");
			resultRow.createSpan({ text: op.message ?? "Done", cls: "ft-text-sm" });
			return;
		}

		// In-progress spinner + status
		const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.addClass("ft-opacity-muted");
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ cls: "ft-text-sm" });

		// Progress bar
		const barBg = section.createDiv({ cls: "ft-progress-bar-track-4" });
		const barFill = barBg.createDiv({ cls: "ft-progress-bar-fill-animated" });
		const pct = op.progress && op.progress.total > 0
			? Math.round((op.progress.current / op.progress.total) * 100) : 0;
		barFill.style.width = `${pct}%`;

		if (op.progress) {
			statusText.textContent = `Processing source ${op.progress.current} of ${op.progress.total}...`;
		} else {
			statusText.textContent = `Running pipeline: ${pipe.name}...`;
		}

		const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

		// Live listeners for granular per-row progress
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("dataExchange.import.progress", (event) => {
				if (event.payload.pipelineId !== pipe.id) return;
				const { current, total, lastFilename } = event.payload;
				detailText.textContent = lastFilename
					? `Row ${current}/${total} — ${lastFilename}`
					: `Row ${current}/${total}`;
			}),
		);

		this.liveUnsubscribes.push(
			this.deps.eventBus.on("dataExchange.pipeline.sourceCompleted", (event) => {
				if (event.payload.pipelineId !== pipe.id) return;
				const { sourceIndex, totalSources, sourceResult } = event.payload;
				const livePct = totalSources > 0 ? Math.round(((sourceIndex + 1) / totalSources) * 100) : 0;
				barFill.style.width = `${livePct}%`;
				statusText.textContent = `Processing source ${sourceIndex + 1} of ${totalSources}...`;
				const csvName = basename(sourceResult.csvPath) || sourceResult.csvPath;
				detailText.textContent = `${csvName}: ${sourceResult.result.created} created, ${sourceResult.result.updated} updated`;
			}),
		);

		// Export-phase feedback
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("dataExchange.export.started", (event) => {
				if (event.payload.pipelineId !== pipe.id) return;
				barFill.addClass("ft-w-full");
				const exportName = event.payload.config.outputPath
					? basename(event.payload.config.outputPath)
					: "export";
				statusText.textContent = "Running export...";
				detailText.textContent = exportName;
			}),
		);
	}
}
