/**
 * Config page for the Canvas Action View import wizard.
 *
 * Uses a split layout matching the hub pattern:
 *   Left panel  — general settings (folder, conflict, hierarchy, toggles)
 *   Right panel — color and shape mappings
 *
 * Follows the CsvConfigPage pattern: unsaved changes banner + updateUnsavedHint.
 */

import { Setting, setIcon } from "obsidian";
import { CANVAS_COLOR_LABELS, DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP, TYPE_ORDER } from "../../domain/canvas/types";
import type { FlowtiCanvasType } from "../../domain/canvas/types";
import type { CanvasComponentDeps } from "./types";

export class CanvasConfigPage {
	constructor(
		private container: HTMLElement,
		private deps: CanvasComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();

		// Action bar
		const actions = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2" });
		actions.style.borderBottom = "1px solid var(--background-modifier-border)";
		actions.addClass("ft-flex-shrink-0");

		const backBtn = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(backBtn.createSpan(), "layout-dashboard");
		backBtn.appendText(" Canvas Detail");
		backBtn.addEventListener("click", () => {
			this.deps.setState({ currentPage: "landing" });
			this.deps.renderContent();
		});

		actions.createDiv({ cls: "ft-flex-1" });

		const nextBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(nextBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "eye");
		nextBtn.appendText(" Preview");
		nextBtn.addEventListener("click", () => {
			if (!state.canvasPath) return;
			void this.deps.parseAndPreview();
		});

		// ── Split layout (matches export wizard dimensions) ──
		const split = ws.createDiv({ cls: "ft-config-split" });

		// Left: general config
		const left = split.createDiv({ cls: "ft-config-panel" });
		this.renderGeneralConfig(left, state);

		// Right: mappings
		const right = split.createDiv({ cls: "ft-config-content" });
		this.renderMappings(right, state);
	}

	// ── Left panel: general config ──────────────────────────

	private renderGeneralConfig(panel: HTMLElement, state: ReturnType<CanvasComponentDeps["getState"]>): void {
		panel.createEl("h3", { text: "Configure import", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const scroll = panel;

		// Unsaved changes reminder (always present, visibility toggled)
		const reminder = scroll.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		reminder.style.padding = "0.35rem 0.5rem";
		reminder.style.borderRadius = "var(--radius-s, 4px)";
		reminder.style.background = "var(--background-modifier-message)";
		reminder.style.display = this.deps.hasUnsavedChanges() ? "flex" : "none";
		const warnIcon = reminder.createSpan();
		setIcon(warnIcon, "alert-triangle");
		warnIcon.style.opacity = "0.6";
		warnIcon.addClass("ft-flex-shrink-0");
		reminder.createSpan({
			text: "Config has unsaved changes",
			cls: "ft-text-sm ft-text-muted",
		});
		this.deps.setUnsavedHintEl(reminder);

		// Canvas file (read-only)
		new Setting(scroll)
			.setName("Canvas file")
			.setDesc(state.canvasPath);

		// Config name
		new Setting(scroll)
			.setName("Config name")
			.setDesc("Name to save this import for reuse")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder("e.g. architecture import")
					.setValue(state.configName)
					.onChange((v) => {
						this.deps.setState({ configName: v });
						this.deps.updateUnsavedHint();
					}),
			);

		// Target folder
		const folderSetting = new Setting(scroll)
			.setName("Target folder")
			.addText((t) =>
				t.setValue(state.targetFolder)
					.setPlaceholder("e.g. resources/canvas")
					.onChange((v) => {
						this.deps.setState({ targetFolder: v });
						this.deps.updateUnsavedHint();
					}),
			);
		folderSetting.addExtraButton((btn) =>
			btn.setIcon("folder").setTooltip("Browse").onClick(() => {
				this.deps.openFolderPicker();
			}),
		);

		// Subfolder name
		const canvasBasename = state.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		new Setting(scroll)
			.setName("Import folder name")
			.setDesc(`Default: "${canvasBasename}"`)
			.addText((t) =>
				t.setValue(state.subfolderName)
					.setPlaceholder(canvasBasename)
					.onChange((v) => {
						this.deps.setState({ subfolderName: v });
						this.deps.updateUnsavedHint();
					}),
			);

		// Conflict strategy
		new Setting(scroll)
			.setName("Conflict strategy")
			.addDropdown((dd) =>
				dd
					.addOption("skip", "Skip")
					.addOption("update", "Update frontmatter")
					.addOption("overwrite", "Overwrite")
					.setValue(state.conflictStrategy)
					.onChange((v) => {
						this.deps.setState({
							conflictStrategy: v as "skip" | "update" | "overwrite",
						});
						this.deps.updateUnsavedHint();
					}),
			);

		// Hierarchy mode
		new Setting(scroll)
			.setName("Hierarchy mode")
			.addDropdown((dd) =>
				dd
					.addOption("flat", "Flat")
					.addOption("product", "Product (by type)")
					.addOption("group", "Group (by canvas groups)")
					.setValue(state.hierarchyMode)
					.onChange((v) => {
						this.deps.setState({
							hierarchyMode: v as "flat" | "product" | "group",
						});
						this.deps.updateUnsavedHint();
					}),
			);

		// Post-import artifact toggles
		new Setting(scroll)
			.setName("Create rebuilt canvas")
			.addToggle((toggle) =>
				toggle
					.setValue(state.createCanvas)
					.onChange((v) => {
						this.deps.setState({ createCanvas: v });
						this.deps.updateUnsavedHint();
					}),
			);

		new Setting(scroll)
			.setName("Create .base index")
			.addToggle((toggle) =>
				toggle
					.setValue(state.createBase)
					.onChange((v) => {
						this.deps.setState({ createBase: v });
						this.deps.updateUnsavedHint();
					}),
			);
	}

	// ── Right panel: mappings ───────────────────────────────

	private renderMappings(panel: HTMLElement, state: ReturnType<CanvasComponentDeps["getState"]>): void {
		panel.createEl("h3", { text: "Mappings", cls: "ft-heading ft-heading-sm ft-mb-3" });

		this.renderMappingSection(panel, "Color Mappings", state.colorMap, CANVAS_COLOR_LABELS, "colorMap");
		this.renderMappingSection(panel, "Shape Mappings", state.shapeMap, null, "shapeMap");

		// Type exclusion grid
		this.renderTypeExclusion(panel, state);
	}

	private renderMappingSection(
		container: HTMLElement,
		heading: string,
		map: Record<string, string>,
		labels: Record<string, string> | null,
		stateKey: "colorMap" | "shapeMap",
	): void {
		const section = container.createDiv({ cls: "ft-mb-4" });
		const headerRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headerRow.createEl("h4", { text: heading, cls: "ft-heading ft-heading-sm" });

		const resetBtn = headerRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		setIcon(resetBtn.createSpan(), "rotate-ccw");
		resetBtn.appendText(" Reset");
		resetBtn.addEventListener("click", () => {
			const defaults = stateKey === "colorMap" ? { ...DEFAULT_COLOR_MAP } : { ...DEFAULT_SHAPE_MAP };
			this.deps.setState({ [stateKey]: defaults });
			this.deps.renderContent();
		});

		const table = section.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("tr");
		thead.createEl("th", { text: "Key" });
		thead.createEl("th", { text: "Type" });

		for (const [key, value] of Object.entries(map)) {
			const tr = table.createEl("tr");
			const keyLabel = labels ? `${key} (${labels[key] ?? key})` : key;
			tr.createEl("td", { text: keyLabel, cls: "ft-text-sm ft-text-muted" });
			const valueTd = tr.createEl("td");
			const input = valueTd.createEl("input", { type: "text", cls: "ft-mapping-input" });
			input.value = value;
			input.style.cssText = "width:100%;padding:2px 6px;font-size:var(--font-ui-small);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:var(--radius-s,4px);color:var(--text-normal)";
			input.addEventListener("input", () => {
				const updated = { ...map, [key]: input.value as FlowtiCanvasType };
				this.deps.setState({ [stateKey]: updated });
				this.deps.updateUnsavedHint();
			});
		}
	}

	// ── Type exclusion grid ────────────────────────────────

	private renderTypeExclusion(container: HTMLElement, state: ReturnType<CanvasComponentDeps["getState"]>): void {
		// Collect all discovered types from color + shape maps
		const allTypes = new Set<string>();
		for (const v of Object.values(state.colorMap)) if (v) allTypes.add(v);
		for (const v of Object.values(state.shapeMap)) if (v) allTypes.add(v);
		allTypes.add("Group");
		allTypes.add("Node");

		const sorted = [...allTypes].sort(
			(a, b) => (TYPE_ORDER[a] ?? 98) - (TYPE_ORDER[b] ?? 98) || a.localeCompare(b),
		);

		const section = container.createDiv({ cls: "ft-mb-4" });
		const headerRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		headerRow.createEl("h4", { text: "Included types", cls: "ft-heading ft-heading-sm" });

		const checkboxes: HTMLInputElement[] = [];

		const allBtn = headerRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		allBtn.textContent = "All";
		allBtn.addEventListener("click", () => {
			this.deps.setState({ excludedTypes: [] });
			this.deps.updateUnsavedHint();
			for (const cb of checkboxes) cb.checked = true;
		});

		const noneBtn = headerRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		noneBtn.textContent = "None";
		noneBtn.addEventListener("click", () => {
			this.deps.setState({ excludedTypes: [...sorted] });
			this.deps.updateUnsavedHint();
			for (const cb of checkboxes) cb.checked = false;
		});

		const grid = section.createDiv({ cls: "ft-property-grid" });
		for (const type of sorted) {
			const included = !state.excludedTypes.includes(type);
			const item = grid.createDiv({ cls: "ft-property-item" });
			const cb = item.createEl("input", { type: "checkbox" });
			cb.checked = included;
			checkboxes.push(cb);
			cb.addEventListener("change", () => {
				const excluded = [...this.deps.getState().excludedTypes];
				if (cb.checked) {
					const idx = excluded.indexOf(type);
					if (idx >= 0) excluded.splice(idx, 1);
				} else {
					if (!excluded.includes(type)) excluded.push(type);
				}
				this.deps.setState({ excludedTypes: excluded });
				this.deps.updateUnsavedHint();
			});
			item.createSpan({ text: type, cls: "ft-text-sm" });
		}
	}
}
