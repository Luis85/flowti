/**
 * Canvas tab component for the Data Exchange Hub.
 * Renders saved canvas import configurations in a master/detail split.
 * Supports inline editing following the ImportsTab pattern.
 */

import { Setting, setIcon } from "obsidian";
import { ConfirmModal } from "../modals";
import { addInfoRow, renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import { FolderPickerModal, getVaultFolders } from "../shared/FolderPickerModal";
import type { ActiveOperation, HubComponentDeps } from "./types";
import { CANVAS_COLOR_LABELS, DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP, TYPE_ORDER } from "../../domain/canvas/types";
import type { CanvasImportConfig, FlowtiCanvasType } from "../../domain/canvas/types";
import type { CanvasConfigInput } from "../../domain/canvas/CanvasService";

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
		const panel = this.detailEl;
		panel.createEl("h3", { text: "Edit canvas config", cls: "ft-heading ft-heading-sm ft-mb-3" });

		const edits: Partial<CanvasConfigInput> = {
			name: cfg.name,
			canvasPath: cfg.canvasPath,
			targetFolder: cfg.targetFolder,
			subfolderName: cfg.subfolderName || "",
			conflictStrategy: cfg.conflictStrategy,
			hierarchyMode: cfg.hierarchyMode,
			createCanvas: cfg.createCanvas !== false,
			createBase: cfg.createBase !== false,
			colorMap: { ...cfg.colorMap },
			shapeMap: { ...cfg.shapeMap },
			excludedTypes: [...(cfg.excludedTypes ?? [])],
		};

		// Name
		new Setting(panel)
			.setName("Name")
			.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

		// Canvas path (read-only display)
		new Setting(panel)
			.setName("Canvas file")
			.setDesc(cfg.canvasPath);

		// Target folder
		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.addText((t) => t.setValue(cfg.targetFolder).onChange((v) => { edits.targetFolder = v; }));
		targetSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				const folders = getVaultFolders(this.deps.app);
				new FolderPickerModal(this.deps.app, folders, (folder) => {
					edits.targetFolder = folder;
					this.deps.setState({ editingCanvasId: cfg.id });
					this.renderDetail();
				}).open();
			}),
		);

		// Import folder name
		const editCanvasBasename = cfg.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		new Setting(panel)
			.setName("Import folder name")
			.setDesc(`Subfolder under target. Default: "${editCanvasBasename}"`)
			.addText((t) =>
				t.setValue(edits.subfolderName ?? "")
					.setPlaceholder(editCanvasBasename)
					.onChange((v) => { edits.subfolderName = v; }),
			);

		// Conflict strategy
		new Setting(panel)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOption("skip", "Skip")
					.addOption("update", "Update frontmatter")
					.addOption("overwrite", "Overwrite")
					.setValue(cfg.conflictStrategy)
					.onChange((v) => { edits.conflictStrategy = v as CanvasImportConfig["conflictStrategy"]; }),
			);

		// Hierarchy mode
		new Setting(panel)
			.setName("Hierarchy mode")
			.addDropdown((dd) =>
				dd
					.addOption("flat", "Flat")
					.addOption("product", "Product (by type)")
					.addOption("group", "Group (by canvas groups)")
					.setValue(cfg.hierarchyMode)
					.onChange((v) => { edits.hierarchyMode = v as CanvasImportConfig["hierarchyMode"]; }),
			);

		// Post-import artifacts
		new Setting(panel)
			.setName("Create rebuilt canvas")
			.setDesc("Write a .canvas file with file-node references after import")
			.addToggle((toggle) =>
				toggle
					.setValue(edits.createCanvas ?? true)
					.onChange((v) => { edits.createCanvas = v; }),
			);

		new Setting(panel)
			.setName("Create .base index")
			.setDesc("Write a .base index file after import")
			.addToggle((toggle) =>
				toggle
					.setValue(edits.createBase ?? true)
					.onChange((v) => { edits.createBase = v; }),
			);

		// Color mappings (with reset)
		this.renderMappingEditorWithReset(panel, "Color Mappings", edits.colorMap as Record<string, FlowtiCanvasType>, DEFAULT_COLOR_MAP, CANVAS_COLOR_LABELS, (map) => { edits.colorMap = map; });

		// Shape mappings (with reset)
		this.renderMappingEditorWithReset(panel, "Shape Mappings", edits.shapeMap as Record<string, FlowtiCanvasType>, DEFAULT_SHAPE_MAP, undefined, (map) => { edits.shapeMap = map; });

		// Type exclusion
		this.renderTypeExclusionEditor(panel, edits);

		// Save / Cancel
		const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

		const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
		const saveIcon = saveLink.createSpan();
		setIcon(saveIcon, "check");
		saveLink.appendText(" Save");
		saveLink.addEventListener("click", () => {
			void canvasService.updateConfig(cfg.id, edits).then(() => {
				this.deps.setState({ editingCanvasId: null });
				this.renderMaster();
				this.renderDetail();
				void this.deps.eventBus.emit("notice.success", { message: "Canvas config updated" });
			});
		});

		const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
		const cancelIcon = cancelLink.createSpan();
		setIcon(cancelIcon, "x");
		cancelLink.appendText(" Cancel");
		cancelLink.addEventListener("click", () => {
			this.deps.setState({ editingCanvasId: null });
			this.renderDetail();
		});
	}

	private renderMappingEditorWithReset(
		container: HTMLElement,
		heading: string,
		map: Record<string, FlowtiCanvasType>,
		defaults: Record<string, FlowtiCanvasType>,
		labels: Record<string, string> | undefined,
		onReset: (map: Record<string, FlowtiCanvasType>) => void,
	): void {
		const section = container.createDiv({ cls: "ft-mt-4" });
		const headerRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headerRow.createEl("h4", { text: heading, cls: "ft-heading ft-heading-sm" });

		const resetBtn = headerRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(resetBtn.createSpan(), "rotate-ccw");
		resetBtn.appendText(" Reset");
		resetBtn.addEventListener("click", () => {
			const fresh = { ...defaults };
			Object.keys(map).forEach((k) => delete map[k]);
			Object.assign(map, fresh);
			onReset(fresh);
			this.renderDetail();
		});

		const table = section.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("tr");
		thead.createEl("th", { text: "Key" });
		thead.createEl("th", { text: "Type" });

		for (const [key, value] of Object.entries(map)) {
			const tr = table.createEl("tr");
			const keyLabel = labels?.[key] ? `${key} (${labels[key]})` : key;
			tr.createEl("td", { text: keyLabel, cls: "ft-text-sm ft-text-muted" });
			const valueTd = tr.createEl("td");
			const input = valueTd.createEl("input", { type: "text" });
			input.value = value;
			input.addClass("ft-mapping-input");
			input.addEventListener("input", () => { map[key] = input.value as FlowtiCanvasType; });
		}
	}

	private renderTypeExclusionEditor(container: HTMLElement, edits: Partial<CanvasConfigInput>): void {
		const colorMap = edits.colorMap ?? {};
		const shapeMap = edits.shapeMap ?? {};
		const allTypes = new Set<string>();
		for (const v of Object.values(colorMap)) if (v) allTypes.add(v);
		for (const v of Object.values(shapeMap)) if (v) allTypes.add(v);
		allTypes.add("Group");
		allTypes.add("Node");

		const sorted = [...allTypes].sort(
			(a, b) => (TYPE_ORDER[a] ?? 98) - (TYPE_ORDER[b] ?? 98) || a.localeCompare(b),
		);

		const section = container.createDiv({ cls: "ft-mt-4" });
		const headerRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headerRow.createEl("h4", { text: "Included types", cls: "ft-heading ft-heading-sm" });

		const checkboxes: HTMLInputElement[] = [];

		const allBtn = headerRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		allBtn.textContent = "All";
		allBtn.addEventListener("click", () => {
			edits.excludedTypes = [];
			for (const cb of checkboxes) cb.checked = true;
		});

		const noneBtn = headerRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		noneBtn.textContent = "None";
		noneBtn.addEventListener("click", () => {
			edits.excludedTypes = [...sorted];
			for (const cb of checkboxes) cb.checked = false;
		});

		const excluded = edits.excludedTypes ?? [];
		const grid = section.createDiv({ cls: "ft-property-grid" });
		for (const type of sorted) {
			const included = !excluded.includes(type);
			const item = grid.createDiv({ cls: "ft-property-item" });
			const cb = item.createEl("input", { type: "checkbox" });
			cb.checked = included;
			checkboxes.push(cb);
			cb.addEventListener("change", () => {
				const list = [...(edits.excludedTypes ?? [])];
				if (cb.checked) {
					const idx = list.indexOf(type);
					if (idx >= 0) list.splice(idx, 1);
				} else {
					if (!list.includes(type)) list.push(type);
				}
				edits.excludedTypes = list;
			});
			item.createSpan({ text: type, cls: "ft-text-sm" });
		}
	}
}
