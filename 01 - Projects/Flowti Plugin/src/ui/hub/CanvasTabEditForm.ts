/**
 * Canvas tab edit form — extracted from CanvasTab.ts for max-lines compliance.
 */

import { Setting, setIcon } from "obsidian";
import { FolderPickerModal, getVaultFolders } from "../shared/FolderPickerModal";
import type { HubComponentDeps } from "./types";
import { CANVAS_COLOR_LABELS, DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP, TYPE_ORDER } from "../../domain/canvas/types";
import type { CanvasImportConfig, FlowtiCanvasType } from "../../domain/canvas/types";
import type { CanvasConfigInput } from "../../domain/canvas/CanvasService";

export function renderCanvasEditForm(
	panel: HTMLElement,
	cfg: CanvasImportConfig,
	canvasService: NonNullable<HubComponentDeps["canvasService"]>,
	deps: HubComponentDeps,
	onSaved: () => void,
	onCancelled: () => void,
): void {
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

	new Setting(panel)
		.setName("Name")
		.addText((t) => t.setValue(cfg.name).onChange((v) => { edits.name = v; }));

	new Setting(panel)
		.setName("Canvas file")
		.setDesc(cfg.canvasPath);

	const targetSetting = new Setting(panel)
		.setName("Target folder")
		.addText((t) => t.setValue(cfg.targetFolder).onChange((v) => { edits.targetFolder = v; }));
	targetSetting.addExtraButton((btn) =>
		btn.setIcon("folder").setTooltip("Browse").onClick(() => {
			const folders = getVaultFolders(deps.app);
			new FolderPickerModal(deps.app, folders, (folder) => {
				edits.targetFolder = folder;
				deps.setState({ editingCanvasId: cfg.id });
				onCancelled(); // triggers re-render of detail which will re-render edit form
			}).open();
		}),
	);

	const editCanvasBasename = cfg.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
	new Setting(panel)
		.setName("Import folder name")
		.setDesc(`Subfolder under target. Default: "${editCanvasBasename}"`)
		.addText((t) =>
			t.setValue(edits.subfolderName ?? "")
				.setPlaceholder(editCanvasBasename)
				.onChange((v) => { edits.subfolderName = v; }),
		);

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

	new Setting(panel)
		.setName("Create rebuilt canvas")
		.setDesc("Write a .canvas file with file-node references after import")
		.addToggle((toggle) =>
			toggle.setValue(edits.createCanvas ?? true).onChange((v) => { edits.createCanvas = v; }),
		);

	new Setting(panel)
		.setName("Create .base index")
		.setDesc("Write a .base index file after import")
		.addToggle((toggle) =>
			toggle.setValue(edits.createBase ?? true).onChange((v) => { edits.createBase = v; }),
		);

	renderMappingEditorWithReset(panel, "Color Mappings", edits.colorMap as Record<string, FlowtiCanvasType>, DEFAULT_COLOR_MAP, CANVAS_COLOR_LABELS, (map) => { edits.colorMap = map; }, onCancelled);
	renderMappingEditorWithReset(panel, "Shape Mappings", edits.shapeMap as Record<string, FlowtiCanvasType>, DEFAULT_SHAPE_MAP, undefined, (map) => { edits.shapeMap = map; }, onCancelled);
	renderTypeExclusionEditor(panel, edits);

	const nav = panel.createDiv({ cls: "ft-detail-actions ft-mt-4" });

	const saveLink = nav.createEl("span", { cls: "ft-nav-link" });
	const saveIcon = saveLink.createSpan();
	setIcon(saveIcon, "check");
	saveLink.appendText(" Save");
	saveLink.addEventListener("click", () => {
		void canvasService.updateConfig(cfg.id, edits).then(() => {
			deps.setState({ editingCanvasId: null });
			onSaved();
			void deps.eventBus.emit("notice.success", { message: "Canvas config updated" });
		});
	});

	const cancelLink = nav.createEl("span", { cls: "ft-nav-link" });
	const cancelIcon = cancelLink.createSpan();
	setIcon(cancelIcon, "x");
	cancelLink.appendText(" Cancel");
	cancelLink.addEventListener("click", () => {
		deps.setState({ editingCanvasId: null });
		onCancelled();
	});
}

function renderMappingEditorWithReset(
	container: HTMLElement,
	heading: string,
	map: Record<string, FlowtiCanvasType>,
	defaults: Record<string, FlowtiCanvasType>,
	labels: Record<string, string> | undefined,
	onReset: (map: Record<string, FlowtiCanvasType>) => void,
	onDetailRefresh: () => void,
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
		onDetailRefresh();
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

function renderTypeExclusionEditor(container: HTMLElement, edits: Partial<CanvasConfigInput>): void {
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
