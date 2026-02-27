/**
 * Preview page for the Canvas Action View import wizard.
 * Shows "What will happen" impact card, type distribution with exclusion status,
 * group structure, legend info, and configuration summary.
 */

import { setIcon } from "obsidian";
import { CANVAS_COLOR_LABELS, TYPE_FOLDER_MAP, TYPE_ORDER } from "../../domain/canvas/types";
import type { CanvasComponentDeps } from "./types";

export class CanvasPreviewPage {
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

		if (state.parseError) {
			const alert = ws.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
			alert.createEl("strong", { text: "Parse error: " });
			alert.createSpan({ text: state.parseError });
			const backBtn = actions.createEl("span", { cls: "ft-nav-link" });
			setIcon(backBtn.createSpan(), "arrow-left");
			backBtn.appendText(" Back");
			backBtn.addEventListener("click", () => {
				this.deps.setState({ currentPage: "config" });
				this.deps.renderContent();
			});
			return;
		}

		const configBtn = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(configBtn.createSpan(), "settings");
		configBtn.appendText(" Edit Config");
		configBtn.addEventListener("click", () => {
			this.deps.setState({ currentPage: "config" });
			this.deps.renderContent();
		});

		actions.createDiv({ cls: "ft-flex-1" });

		// Importable = non-group, non-empty, not excluded
		const allImportable = state.previewItems.filter(
			(i) => i.originalType !== "group" && !i.isEmpty,
		);
		const importable = allImportable.filter(
			(i) => !state.excludedTypes.includes(i.type),
		);

		const importBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "play");
		importBtn.appendText(` Import ${importable.length} Notes`);
		importBtn.addEventListener("click", () => {
			void this.deps.runImport();
		});

		const content = ws.createDiv({ cls: "ft-table-scroll" });

		const canvasBasename = state.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		const subfolder = state.subfolderName || canvasBasename;
		const effectiveTarget = state.targetFolder ? `${state.targetFolder}/${subfolder}` : subfolder;

		// ── Configuration card (first) ──
		const cfgSection = content.createDiv({ cls: "ft-card ft-mt-3 ft-mb-2" });
		cfgSection.createDiv({ text: "Configuration", cls: "ft-detail-section-header ft-mb-2" });
		const cfgGrid = cfgSection.createDiv({ cls: "ft-detail-info-grid" });
		this.addRow(cfgGrid, "Canvas file", state.canvasPath);
		this.addRow(cfgGrid, "Target folder", effectiveTarget);
		this.addRow(cfgGrid, "Import folder name", subfolder);

		const hierarchyLabels: Record<string, string> = {
			flat: "Flat — all notes in one folder",
			product: "Product — grouped by resolved type",
			group: "Group — grouped by canvas group structure",
		};
		this.addRow(cfgGrid, "Hierarchy mode", hierarchyLabels[state.hierarchyMode] ?? state.hierarchyMode);

		const strategyLabels: Record<string, string> = {
			skip: "Skip — existing notes will not be touched",
			update: "Update — merge frontmatter into existing notes",
			overwrite: "Overwrite — replace existing notes entirely",
		};
		this.addRow(cfgGrid, "Conflict strategy", strategyLabels[state.conflictStrategy] ?? state.conflictStrategy);

		const artifacts: string[] = [];
		if (state.createCanvas) artifacts.push("rebuilt .canvas");
		if (state.createBase) artifacts.push(".base index");
		if (artifacts.length > 0) {
			this.addRow(cfgGrid, "Artifacts", artifacts.join(", "));
		}
		this.addRow(cfgGrid, "Color mappings", this.summarizeMappings(state.colorMap));
		this.addRow(cfgGrid, "Shape mappings", this.summarizeMappings(state.shapeMap));

		// ── "What will happen" card ──
		const summary = content.createDiv({ cls: "ft-card ft-mt-2 ft-mb-2" });
		summary.createDiv({ text: "What will happen", cls: "ft-detail-section-header ft-mb-2" });
		const grid = summary.createDiv({ cls: "ft-detail-info-grid" });

		const excludedCount = allImportable.length - importable.length;
		const notesLabel = excludedCount > 0
			? `${importable.length} (${excludedCount} excluded by type)`
			: `${importable.length}`;
		this.addRow(grid, "Notes to create", notesLabel);

		// ── Type distribution table ──
		const typeCounts = new Map<string, number>();
		for (const item of allImportable) {
			typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
		}
		if (typeCounts.size > 0) {
			const typeSection = content.createDiv({ cls: "ft-card ft-mt-2 ft-mb-2" });
			typeSection.createDiv({ text: "Type Distribution", cls: "ft-detail-section-header ft-mb-2" });
			const table = typeSection.createEl("table", { cls: "ft-preview-table" });
			const thead = table.createEl("tr");
			thead.createEl("th", { text: "Type" });
			thead.createEl("th", { text: "Count" });
			thead.createEl("th", { text: "Status" });

			const sorted = [...typeCounts.entries()].sort(
				(a, b) => (TYPE_ORDER[a[0]] ?? 98) - (TYPE_ORDER[b[0]] ?? 98),
			);

			let includedTotal = 0;
			for (const [type, count] of sorted) {
				const excluded = state.excludedTypes.includes(type);
				const tr = table.createEl("tr");
				if (excluded) tr.style.opacity = "0.5";

				const nameTd = tr.createEl("td", { cls: "ft-text-sm" });
				nameTd.textContent = type;
				if (excluded) nameTd.style.textDecoration = "line-through";

				tr.createEl("td", { text: String(count), cls: "ft-text-sm" });

				const statusTd = tr.createEl("td", { cls: "ft-text-sm" });
				if (excluded) {
					statusTd.textContent = "Excluded";
					statusTd.style.color = "var(--text-muted)";
				} else {
					statusTd.textContent = "Included";
					statusTd.style.color = "var(--text-success, var(--interactive-accent))";
					includedTotal += count;
				}
			}

			// Subtotal row
			const totalTr = table.createEl("tr");
			totalTr.style.fontWeight = "600";
			totalTr.createEl("td", { text: "Total to import" });
			totalTr.createEl("td", { text: `${includedTotal} of ${allImportable.length}` });
			totalTr.createEl("td");
		}

		// ── Folder structure (hierarchy-aware) ──
		if (state.hierarchyMode === "product") {
			this.renderProductStructure(content, effectiveTarget, importable);
		} else if (state.hierarchyMode === "group") {
			this.renderGroupStructure(content, state.previewItems);
		}

		// ── Legend section ──
		if (state.legendMap) {
			const legendSection = content.createDiv({ cls: "ft-card ft-mt-2 ft-mb-2" });
			legendSection.createDiv({ text: "Detected Legend", cls: "ft-detail-section-header ft-mb-2" });
			const table = legendSection.createEl("table", { cls: "ft-preview-table" });
			const thead = table.createEl("tr");
			thead.createEl("th", { text: "Color" });
			thead.createEl("th", { text: "Resolved type" });

			for (const [color, type] of Object.entries(state.legendMap)) {
				const tr = table.createEl("tr");
				const label = CANVAS_COLOR_LABELS[color] ? `${color} (${CANVAS_COLOR_LABELS[color]})` : color;
				tr.createEl("td", { text: label, cls: "ft-text-sm ft-text-muted" });
				tr.createEl("td", { text: type, cls: "ft-text-sm ft-font-medium" });
			}
		}

	}

	private addRow(grid: HTMLElement, label: string, value: string): void {
		grid.createDiv({ text: label, cls: "ft-detail-info-label" });
		grid.createDiv({ text: value, cls: "ft-detail-info-value" });
	}

	private summarizeMappings(map: Record<string, string>): string {
		const entries = Object.entries(map);
		if (entries.length === 0) return "(none)";
		const types = [...new Set(entries.map(([, v]) => v))];
		return types.join(", ");
	}

	private renderProductStructure(
		content: HTMLElement,
		effectiveTarget: string,
		importable: { type: string; title: string }[],
	): void {
		// Group items by their product subfolder
		const folderItems = new Map<string, string[]>();
		for (const item of importable) {
			const folder = TYPE_FOLDER_MAP[item.type] || "Other";
			const list = folderItems.get(folder) ?? [];
			list.push(item.title);
			folderItems.set(folder, list);
		}
		if (folderItems.size === 0) return;

		const section = content.createDiv({ cls: "ft-card ft-mt-2 ft-mb-2" });
		section.createDiv({ text: "Folder Structure", cls: "ft-detail-section-header ft-mb-2" });

		// Root folder
		const rootRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		rootRow.style.padding = "0.25rem 0.5rem";
		const rootIcon = rootRow.createSpan();
		setIcon(rootIcon, "folder-open");
		rootIcon.addClass("ft-icon-muted");
		rootRow.createSpan({ text: effectiveTarget, cls: "ft-text-sm ft-font-medium" });

		// Sort folders by TYPE_ORDER of their first item type
		const sortedFolders = [...folderItems.entries()].sort((a, b) => {
			const typeA = Object.entries(TYPE_FOLDER_MAP).find(([, v]) => v === a[0])?.[0] ?? a[0];
			const typeB = Object.entries(TYPE_FOLDER_MAP).find(([, v]) => v === b[0])?.[0] ?? b[0];
			return (TYPE_ORDER[typeA] ?? 98) - (TYPE_ORDER[typeB] ?? 98);
		});

		for (const [folder, items] of sortedFolders) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.25rem 0.5rem 0.25rem 1.5rem";
			const icon = row.createSpan();
			setIcon(icon, "folder");
			icon.addClass("ft-icon-muted");
			row.createSpan({ text: folder, cls: "ft-text-sm ft-font-medium" });
			row.createSpan({ text: `${items.length} note${items.length !== 1 ? "s" : ""}`, cls: "ft-text-sm ft-text-muted" });
		}
	}

	private renderGroupStructure(
		content: HTMLElement,
		previewItems: { id: string; title: string; originalType: string; parentId: string | null }[],
	): void {
		const groups = previewItems.filter((i) => i.originalType === "group");
		if (groups.length === 0) return;

		const section = content.createDiv({ cls: "ft-card ft-mt-2 ft-mb-2" });
		section.createDiv({ text: "Group Structure", cls: "ft-detail-section-header ft-mb-2" });
		for (const group of groups) {
			const childCount = previewItems.filter((i) => i.parentId === group.id).length;
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.25rem 0.5rem";
			if (group.parentId) {
				row.style.paddingLeft = "1.5rem";
			}
			const icon = row.createSpan();
			setIcon(icon, "folder");
			icon.addClass("ft-icon-muted");
			row.createSpan({ text: group.title, cls: "ft-text-sm ft-font-medium" });
			row.createSpan({ text: `${childCount} children`, cls: "ft-text-sm ft-text-muted" });
		}
	}
}
