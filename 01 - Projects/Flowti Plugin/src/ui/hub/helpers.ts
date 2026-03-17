/**
 * Shared helpers for Data Exchange Hub components.
 */

import { App, TFile, setIcon } from "obsidian";
import type { SavedImportConfig, SavedMultiImportPipeline } from "../../domain/dataExchange/types";
import { VIEW_TYPE_EVENT_CATALOG } from "../../domain/hub/types";
import type { FrontmatterIssue, HubComponentDeps, HubPage } from "./types";

/** Reveals a folder in the file explorer sidebar without creating any files. */
export function revealFolderInExplorer(app: App, folderPath: string): void {
	const folder = app.vault.getAbstractFileByPath(folderPath.replace(/\/$/, ""));
	if (!folder) return;
	const explorers = app.workspace.getLeavesOfType("file-explorer");
	if (explorers.length > 0) {
		const view = explorers[0].view as unknown as { revealInFolder?: (f: unknown) => void };
		view.revealInFolder?.(folder);
		void app.workspace.revealLeaf(explorers[0]);
	}
}

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
	iconEl.addClass("ft-icon-subtle");
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
export function openEventInCatalog(app: App, _eventType: string): void {
	const { workspace } = app;
	const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
	if (existing.length > 0) {
		void workspace.revealLeaf(existing[0]);
		return;
	}
	const leaf = workspace.getLeaf(true);
	void leaf.setViewState({ type: VIEW_TYPE_EVENT_CATALOG, active: true }).then(() => {
		void workspace.revealLeaf(leaf);
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
	header.addClass("ft-heading-no-margin");

	if (opts?.action) {
		const link = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
		const icon = link.createSpan();
		setIcon(icon, opts.action.icon);
		link.appendText(` ${opts.action.label}`);
		link.addEventListener("click", opts.action.onClick);
	}

	return header;
}

/** Renders a wizard step indicator bar into the given container. */
export function renderStepBar<P extends string>(container: HTMLElement, opts: {
	steps: P[];
	currentPage: P;
	labels: Record<string, string>;
	hasResult: boolean;
	hasError: boolean;
	onNavigate: (page: P) => void;
}): void {
	const stepBar = container.createDiv({ cls: "ft-step-bar" });
	const { steps, currentPage, labels, hasResult, hasError, onNavigate } = opts;
	const stepIdx = steps.indexOf(currentPage);

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const stepEl = stepBar.createDiv({ cls: "ft-step-indicator" });

		let stateClass = "ft-step-pending";
		if (i < stepIdx) stateClass = "ft-step-completed";
		else if (i === stepIdx) stateClass = "ft-step-running";
		if (step === "result" && hasResult) stateClass = "ft-step-completed";
		if (step === "result" && hasError) stateClass = "ft-step-failed";

		stepEl.addClass(stateClass);

		const stepIconEl = stepEl.createDiv({ cls: "ft-step-icon" });
		stepIconEl.textContent = String(i + 1);

		stepEl.createSpan({
			text: labels[step] ?? step,
			cls: "ft-step-label",
		});

		// Allow clicking completed steps for backward navigation
		if (i < stepIdx) {
			stepEl.addClass("ft-cursor-pointer");
			const targetPage = step;
			stepEl.addEventListener("click", () => onNavigate(targetPage));
		}

		// Arrow separator
		if (i < steps.length - 1) {
			stepBar.createSpan({ text: "\u203A", cls: "ft-text-muted ft-step-sep" });
		}
	}
}

/** Renders a config dropdown button+menu. */
export function renderConfigDropdown(bar: HTMLElement, opts: {
	onSave: () => void;
	configs: { id: string; name: string }[];
	onLoad: (id: string) => void;
}): void {
	const wrapper = bar.createDiv({ cls: "ft-config-dropdown" });
	const btn = wrapper.createEl("span", { cls: "ft-nav-link" });
	const btnIcon = btn.createSpan();
	setIcon(btnIcon, "settings-2");
	btn.appendText(" Configs");

	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const existingMenu = wrapper.querySelector(".ft-config-dropdown-menu");
		if (existingMenu) {
			existingMenu.remove();
			return;
		}

		const menu = wrapper.createDiv({ cls: "ft-config-dropdown-menu" });

		// Save current config
		const saveItem = menu.createDiv({ cls: "ft-config-dropdown-item" });
		const saveIcon = saveItem.createSpan();
		setIcon(saveIcon, "save");
		saveItem.appendText(" Save Config...");
		saveItem.addEventListener("click", () => {
			menu.remove();
			opts.onSave();
		});

		if (opts.configs.length > 0) {
			menu.createDiv({ cls: "ft-config-dropdown-divider" });

			for (const cfg of opts.configs) {
				const item = menu.createDiv({ cls: "ft-config-dropdown-item" });
				item.createSpan({ text: cfg.name, cls: "ft-flex-1" });
				item.addEventListener("click", () => {
					menu.remove();
					opts.onLoad(cfg.id);
				});
			}
		}

		// Close on outside click
		const closeHandler = (e2: MouseEvent) => {
			if (!wrapper.contains(e2.target as Node)) {
				menu.remove();
				document.removeEventListener("click", closeHandler);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler), 0);
	});
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
		signals: { count: deps.signalService?.getSignals().length ?? 0, label: "signals" },
	};
	return map[state.currentPage] ?? { count: 0, label: "" };
}

// ─────────────────────────────────────────────────────────
// Frontmatter validation
// ─────────────────────────────────────────────────────────

/** Validates CsvDoc frontmatter and returns a list of issues found. */
export function validateCsvDocFrontmatter(fm: Record<string, unknown>): string[] {
	const issues: string[] = [];
	if (fm.type !== "CsvDoc") {
		issues.push(`Expected type "CsvDoc" but found "${String(fm.type ?? "missing")}"`);
	}
	if (!fm.csvFile && !fm.filePath) {
		issues.push("Missing csvFile and filePath — cannot link to source CSV");
	}
	if (!fm.headers) {
		issues.push("Missing headers array — column schema not recorded");
	} else if (!Array.isArray(fm.headers)) {
		issues.push(`headers should be an array but found ${typeof fm.headers}`);
	} else if (fm.headers.length === 0) {
		issues.push("headers array is empty — no columns recorded");
	}
	if (fm.columns !== undefined && typeof fm.columns !== "number") {
		issues.push(`columns should be a number but found ${typeof fm.columns}`);
	}
	if (fm.rows !== undefined && typeof fm.rows !== "number") {
		issues.push(`rows should be a number but found ${typeof fm.rows}`);
	}
	return issues;
}

/** Validates TypeDoc frontmatter and returns a list of issues found. */
export function validateTypeDocFrontmatter(fm: Record<string, unknown>): string[] {
	const issues: string[] = [];
	if (fm.type !== "TypeDoc") {
		issues.push(`Expected type "TypeDoc" but found "${String(fm.type ?? "missing")}"`);
	}
	if (!fm.name || typeof fm.name !== "string") {
		issues.push("Missing or invalid name field");
	}
	if (fm.properties !== undefined && !Array.isArray(fm.properties)) {
		issues.push(`properties should be an array but found ${typeof fm.properties}`);
	}
	return issues;
}

/** Validates frontmatter for a doc file in a given folder and returns issues. */
export function validateDocFrontmatter(
	fm: Record<string, unknown> | undefined,
	expectedType: string,
	filePath: string,
): FrontmatterIssue | null {
	const fileName = filePath.split("/").pop() ?? filePath;
	if (!fm) {
		return { filePath, fileName, issues: ["No frontmatter found — file may be empty or malformed"] };
	}
	if (fm.type !== expectedType) {
		return {
			filePath, fileName,
			issues: [`Expected type "${expectedType}" but found "${String(fm.type ?? "missing")}"`],
		};
	}
	return null;
}

/** Renders a frontmatter warning alert in the detail panel. */
export function renderFrontmatterAlert(container: HTMLElement, issues: string[]): void {
	if (issues.length === 0) return;
	const alert = container.createDiv({ cls: "ft-alert ft-alert-warning ft-mt-2" });
	const header = alert.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	const icon = header.createSpan();
	setIcon(icon, "alert-triangle");
	header.createEl("strong", { text: "Frontmatter issues" });
	const list = alert.createEl("ul");
	list.addClass("ft-alert-list");
	for (const issue of issues) {
		list.createEl("li", { text: issue, cls: "ft-text-sm" });
	}
}

/** Renders a summary alert for files that could not be loaded during scan. */
export function renderScanIssuesBanner(container: HTMLElement, issues: FrontmatterIssue[]): void {
	if (issues.length === 0) return;
	const alert = container.createDiv({ cls: "ft-alert ft-alert-warning ft-text-sm ft-alert-margin" });
	const row = alert.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	const icon = row.createSpan();
	setIcon(icon, "alert-triangle");
	row.createSpan({
		text: `${issues.length} file${issues.length !== 1 ? "s" : ""} skipped due to frontmatter issues`,
	});

	const details = alert.createEl("details");
	details.addClass("ft-details-mt");
	details.createEl("summary", { text: "Show details", cls: "ft-cursor-pointer" });
	const list = details.createEl("ul");
	list.addClass("ft-list-compact");
	for (const fi of issues) {
		const li = list.createEl("li");
		li.createEl("strong", { text: fi.fileName });
		li.appendText(`: ${fi.issues.join("; ")}`);
	}
}
