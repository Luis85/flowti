/**
 * Canvas tab component for the Data Exchange Hub.
 * Renders saved canvas import configurations in a master/detail split.
 * Supports inline editing following the ImportsTab pattern.
 */

import { setIcon } from "obsidian";
import { ConfirmModal } from "../modals";
import { addInfoRow, renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import type { ActiveOperation, HubComponentDeps } from "./types";
import { CANVAS_COLOR_LABELS } from "../../domain/canvas/types";
import type { CanvasImportConfig } from "../../domain/canvas/types";
import { renderCanvasEditForm } from "./CanvasTabEditForm";

export class CanvasTab {
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
		let configs = state.canvasConfigs;
		if (state.filterText) {
			configs = configs.filter((c) =>
				c.name.toLowerCase().includes(state.filterText) ||
				c.canvasPath.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Canvas Configs" });
		header.createSpan({
			text: `${configs.length}`,
			cls: "ft-master-category-count",
		});

		if (configs.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText ? "No matching canvas configs" : "No canvas configs saved";
			return;
		}

		for (const cfg of configs) {
			const isSelected = state.selectedCanvasId === cfg.id;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});
			item.addClass("ft-master-item-top");

			const textBlock = item.createDiv({ cls: "ft-master-event-name ft-master-text-block" });
			textBlock.createDiv({ text: cfg.name });
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm ft-text-ellipsis" });
			sub.textContent = cfg.canvasPath;

			item.createSpan({
				text: cfg.hierarchyMode,
				cls: "ft-badge ft-badge-muted",
			});

			item.addEventListener("click", () => {
				this.deps.setState({ selectedCanvasId: cfg.id, editingCanvasId: null });
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.cleanupLiveListeners();
		this.detailEl.empty();
		const state = this.deps.getState();
		const canvasService = this.deps.canvasService;
		if (!canvasService) return;

		if (!state.selectedCanvasId) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "square", "Select a canvas config to view details", count, label);
			return;
		}

		const config = canvasService.getConfig(state.selectedCanvasId);
		if (!config) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "square", "Config not found", count, label);
			return;
		}

		if (state.editingCanvasId === config.id) {
			this.renderEditForm(config, canvasService);
			return;
		}

		this.renderDetailHeader(config);
		this.renderActions(config, canvasService);

		// Active canvas import operations (state-backed — survives tab navigation)
		const activeCanvasOps = state.activeOperations.filter(
			(op) => op.type === "canvas-import" && !op.completed && op.operationId === `canvas:${config.canvasPath}`,
		);
		for (const op of activeCanvasOps) {
			this.renderActiveCanvasProgress(this.detailEl, op);
		}

		this.renderConfigInfo(config);
		this.renderMappingInfo(config);
	}

	// ─────────────────────────────────────────────────────────
	// View mode
	// ─────────────────────────────────────────────────────────

	private renderDetailHeader(config: CanvasImportConfig): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: config.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "Canvas Import", cls: "ft-operation-badge ft-operation-badge-import" });
		badges.createSpan({ text: config.hierarchyMode, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: config.conflictStrategy, cls: "ft-badge ft-badge-muted" });
		if (config.createCanvas !== false) badges.createSpan({ text: "canvas", cls: "ft-badge ft-badge-muted" });
		if (config.createBase !== false) badges.createSpan({ text: ".base", cls: "ft-badge ft-badge-muted" });
	}

	private renderActions(config: CanvasImportConfig, canvasService: NonNullable<HubComponentDeps["canvasService"]>): void {
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Run Import (opens in Canvas Action View with auto-run)
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Execute");
		runLink.addEventListener("click", () => {
			this.deps.navigation.openCanvasImport(config.canvasPath, config.id, true);
		});

		// Open native canvas file
		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "external-link");
		openLink.appendText(" Open Canvas");
		openLink.addEventListener("click", () => {
			void this.deps.app.workspace.openLinkText(config.canvasPath, "", true);
		});

		// Edit
		const editLink = actions.createEl("span", { cls: "ft-nav-link" });
		const editIcon = editLink.createSpan();
		setIcon(editIcon, "pencil");
		editLink.appendText(" Update");
		editLink.addEventListener("click", () => {
			this.deps.setState({ editingCanvasId: config.id });
			this.renderDetail();
		});

		// Remove
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link ft-text-error" });
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Remove");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Remove canvas config "${config.name}"? Imported notes will be preserved.`,
				confirmLabel: "Remove",
				onConfirm: () => {
					void canvasService.removeConfig(config.id).then(() => {
						this.deps.setState({ selectedCanvasId: null });
						this.deps.scheduleRender();
					});
				},
			}).open();
		});
	}

	private renderConfigInfo(config: CanvasImportConfig): void {
		const canvasBasename = config.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		const configCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const configGrid = configCard.createDiv({ cls: "ft-detail-info-grid" });

		addInfoRow(configGrid, "Canvas Path", config.canvasPath);
		addInfoRow(configGrid, "Target Folder", config.targetFolder);
		addInfoRow(configGrid, "Import Folder", config.subfolderName || canvasBasename);
		addInfoRow(configGrid, "Conflict Strategy", config.conflictStrategy);
		addInfoRow(configGrid, "Hierarchy Mode", config.hierarchyMode);
		if (config.createCanvas !== false) addInfoRow(configGrid, "Create Canvas", "Yes");
		if (config.createBase !== false) addInfoRow(configGrid, "Create .base", "Yes");
		if (config.excludedTypes?.length) {
			addInfoRow(configGrid, "Excluded Types", config.excludedTypes.join(", "));
		}
		addInfoRow(configGrid, "Created", new Date(config.createdAt).toLocaleString());
		if (config.lastUsed) addInfoRow(configGrid, "Last Used", new Date(config.lastUsed).toLocaleString());
	}

	private renderMappingInfo(config: CanvasImportConfig): void {
		const colorEntries = Object.entries(config.colorMap);
		const shapeEntries = Object.entries(config.shapeMap);
		if (colorEntries.length === 0 && shapeEntries.length === 0) return;

		if (colorEntries.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Color Mappings", cls: "ft-detail-section-header" });
			const grid = section.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of colorEntries) {
				const label = CANVAS_COLOR_LABELS[key] ? `${key} (${CANVAS_COLOR_LABELS[key]})` : key;
				addInfoRow(grid, label, value);
			}
		}

		if (shapeEntries.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Shape Mappings", cls: "ft-detail-section-header" });
			const grid = section.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of shapeEntries) {
				addInfoRow(grid, key, value);
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// Active operation progress (state-backed)
	// ─────────────────────────────────────────────────────────

	private renderActiveCanvasProgress(container: HTMLElement, op: ActiveOperation): void {
		const section = container.createDiv({ cls: "ft-import-progress ft-card ft-mt-3" });

		const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.addClass("ft-opacity-60");
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ cls: "ft-text-sm" });
		if (op.progress) {
			const pctLabel = op.progress.total > 0
				? ` (${Math.round((op.progress.current / op.progress.total) * 100)}%)`
				: "";
			statusText.textContent = `Canvas Import... ${op.progress.current} / ${op.progress.total}${pctLabel}`;
			if (op.progress.lastFilename) statusText.textContent += ` — ${op.progress.lastFilename}`;
		} else {
			statusText.textContent = `Running canvas import: ${op.name}...`;
		}

		const barBg = section.createDiv({ cls: "ft-progress-bar-track-4" });
		const barFill = barBg.createDiv({ cls: "ft-progress-bar-fill-animated" });
		const pct = op.progress && op.progress.total > 0
			? Math.round((op.progress.current / op.progress.total) * 100)
			: 0;
		barFill.style.width = `${pct}%`;

		// Live progress listener
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("canvas.import.progress", (event) => {
				const opId = `canvas:${event.payload.canvasPath}`;
				if (opId !== op.operationId) return;
				const { current, total, title } = event.payload;
				const livePct = total > 0 ? Math.round((current / total) * 100) : 0;
				barFill.style.width = `${livePct}%`;
				statusText.textContent = `Canvas Import... ${current} / ${total} (${livePct}%)`;
				if (title) statusText.textContent += ` — ${title}`;
			}),
		);

		// Completion listener
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("canvas.import.completed", (event) => {
				const r = event.payload.result;
				const opId = `canvas:${r.canvasPath}`;
				if (opId !== op.operationId) return;
				section.empty();
				const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
				const icon = resultRow.createSpan();
				setIcon(icon, "check-circle");
				icon.addClass("ft-text-success");
				resultRow.createSpan({
					text: `Canvas import complete: ${r.imported} imported, ${r.skipped} skipped` +
						(r.errors.length > 0 ? `, ${r.errors.length} errors` : ""),
					cls: "ft-text-sm",
				});
			}),
		);

		// Failure listener
		this.liveUnsubscribes.push(
			this.deps.eventBus.on("canvas.import.failed", (event) => {
				const opId = `canvas:${event.payload.canvasPath}`;
				if (opId !== op.operationId) return;
				section.empty();
				const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
				const icon = resultRow.createSpan();
				setIcon(icon, "x-circle");
				icon.addClass("ft-text-error");
				resultRow.createSpan({ text: `Canvas import failed: ${event.payload.error}`, cls: "ft-text-sm" });
			}),
		);
	}

	cleanupLiveListeners(): void {
		for (const unsub of this.liveUnsubscribes) unsub();
		this.liveUnsubscribes = [];
	}

	// ─────────────────────────────────────────────────────────
	// Edit mode
	// ─────────────────────────────────────────────────────────

	private renderEditForm(cfg: CanvasImportConfig, canvasService: NonNullable<HubComponentDeps["canvasService"]>): void {
		renderCanvasEditForm(
			this.detailEl, cfg, canvasService, this.deps,
			() => { this.renderMaster(); this.renderDetail(); },
			() => { this.renderDetail(); },
		);
	}
}
