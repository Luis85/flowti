/**
 * Shared helpers for Data Exchange Hub components.
 */

import { TFile, setIcon } from "obsidian";
import type { SavedImportConfig, SavedMultiImportPipeline } from "../../domain/dataExchange/types";
import { VIEW_TYPE_EVENT_CATALOG, EventCatalogView } from "../EventCatalogView";
import type { HubComponentDeps, HubPage } from "./types";

/** Adds a label + value row to an info grid element. */
export function addInfoRow(grid: HTMLElement, label: string, value: string): void {
	grid.createDiv({ text: label, cls: "ft-detail-info-label" });
	grid.createDiv({ text: value, cls: "ft-detail-info-value" });
}

/** Renders an empty-detail placeholder with icon, message, and stats. */
export function renderEmptyDetail(
	container: HTMLElement,
	icon: string,
	message: string,
	count: number,
	label: string,
): void {
	const empty = container.createDiv({ cls: "ft-catalog-detail-empty" });
	const iconEl = empty.createDiv();
	setIcon(iconEl, icon);
	iconEl.style.opacity = "0.3";
	empty.createEl("p", { text: message });

	const stats = empty.createDiv({ cls: "ft-catalog-quick-stats ft-mt-2" });
	const stat = stats.createDiv({ cls: "ft-catalog-stat" });
	stat.createDiv({ text: String(count), cls: "ft-catalog-stat-value" });
	stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
}

/** Resolves the .base file for a pipeline config. */
export function resolvePipelineBaseFile(
	deps: HubComponentDeps,
	pipe: SavedMultiImportPipeline,
): TFile | null {
	// Explicit basePath
	if (pipe.createBase && pipe.basePath) {
		const bp = pipe.basePath.endsWith(".base") ? pipe.basePath : `${pipe.basePath}.base`;
		const f = deps.app.vault.getAbstractFileByPath(bp);
		if (f instanceof TFile) return f;
	}
	// Default: {targetFolder}/{pipelineName}.base
	if (pipe.createBase && pipe.name) {
		const safeName = pipe.name.replace(/[\\/:*?"<>|]/g, "_");
		const defaultPath = pipe.targetFolder
			? `${pipe.targetFolder}/${safeName}.base`
			: `${safeName}.base`;
		const f = deps.app.vault.getAbstractFileByPath(defaultPath);
		if (f instanceof TFile) return f;
	}
	// Proximity: any base file in targetFolder
	if (pipe.targetFolder) {
		for (const f of deps.app.vault.getFiles()) {
			if (!f.path.endsWith(".base")) continue;
			const dir = f.path.substring(0, f.path.lastIndexOf("/"));
			if (dir === pipe.targetFolder || f.path.startsWith(pipe.targetFolder + "/")) {
				return f;
			}
		}
	}
	return null;
}

/** Resolves the .base file for an import config. */
export function resolveImportBaseFile(
	deps: HubComponentDeps,
	cfg: SavedImportConfig,
): TFile | null {
	// Explicit basePath
	if (cfg.createBase && cfg.basePath) {
		const bp = cfg.basePath.endsWith(".base") ? cfg.basePath : `${cfg.basePath}.base`;
		const f = deps.app.vault.getAbstractFileByPath(bp);
		if (f instanceof TFile) return f;
	}
	// Proximity: base files in/near targetFolder
	if (cfg.targetFolder) {
		for (const f of deps.app.vault.getFiles()) {
			if (!f.path.endsWith(".base")) continue;
			const dir = f.path.substring(0, f.path.lastIndexOf("/"));
			if (dir === cfg.targetFolder || f.path.startsWith(cfg.targetFolder + "/")) {
				return f;
			}
		}
	}
	return null;
}

/** Opens the Event Catalog view and navigates to a specific event type. */
export function openEventInCatalog(deps: HubComponentDeps, eventType: string): void {
	const { workspace } = deps.app;
	const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
	if (existing.length > 0) {
		workspace.revealLeaf(existing[0]);
		const view = existing[0].view as EventCatalogView;
		view.navigateToEvent(eventType);
		return;
	}
	const leaf = workspace.getLeaf(true);
	void leaf.setViewState({ type: VIEW_TYPE_EVENT_CATALOG, active: true }).then(() => {
		workspace.revealLeaf(leaf);
		setTimeout(() => {
			const view = leaf.view as EventCatalogView;
			view.navigateToEvent(eventType);
		}, 300);
	});
}

/** Renders a dashboard section header (h3 with optional action). */
export function renderDashboardSectionHeader(
	container: HTMLElement,
	title: string,
	opts?: { action?: { icon: string; label: string; onClick: () => void } },
): HTMLElement {
	const header = container.createDiv({
		cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2 ft-mt-3",
	});
	header.createEl("h3", { text: title, cls: "ft-heading ft-heading-sm" });
	header.style.margin = "0";

	if (opts?.action) {
		const link = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		link.style.marginLeft = "auto";
		const icon = link.createSpan();
		setIcon(icon, opts.action.icon);
		link.appendText(` ${opts.action.label}`);
		link.addEventListener("click", opts.action.onClick);
	}

	return header;
}

/** Returns the stats count and label for an empty detail in a given page. */
export function getEmptyDetailStats(deps: HubComponentDeps): { count: number; label: string } {
	const state = deps.getState();
	const map: Partial<Record<HubPage, { count: number; label: string }>> = {
		imports: { count: state.importConfigs.length, label: "saved imports" },
		exports: { count: state.exportConfigs.length, label: "saved exports" },
		reports: { count: state.reportEntries.length, label: "reports" },
		properties: { count: state.dictionaryEntries.length, label: "properties" },
		pipelines: { count: state.pipelineConfigs.length, label: "saved pipelines" },
		types: { count: state.typeEntries.length, label: "note types" },
	};
	return map[state.currentPage] ?? { count: 0, label: "" };
}
