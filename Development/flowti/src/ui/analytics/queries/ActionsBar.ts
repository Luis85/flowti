/**
 * Actions bar sub-component for the query builder.
 *
 * Renders Run, Preview, Reset, Save, Update, Export CSV,
 * and Add-to-Dashboard actions.
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, TileDisplayMode } from "../../../domain/analytics/types";
import { DashboardNameModal } from "../DashboardNameModal";

export interface ActionsBarDeps {
	container: HTMLElement;
	running: boolean;
	hasMeasures: boolean;
	hasLoadedSources: boolean;
	previewVisible: boolean;
	lastResult: AnalyticsResult | null;
	isEditing: boolean;
	selectedQueryId: string | null;
	queryName: string;
	hasTimeBucket: boolean;
	dashboards: Array<{ id: string; name: string; tiles: Array<unknown> }>;
	app: unknown;

	onRunQuery: () => void;
	onTogglePreview: () => void;
	onReset: () => void;
	onSave: () => void;
	onUpdate: () => void;
	onExportCsv: (result: AnalyticsResult) => void;
	onAddToDashboard: (dashboardId: string, dashboardName: string, mode: TileDisplayMode) => void;
	onCreateDashboardAndAdd: (name: string, mode: TileDisplayMode) => void;
	onRenderDetail: () => void;
}

/** Auto-suggest display mode based on result shape. */
export function suggestDisplayMode(result: AnalyticsResult, hasTimeBucket: boolean): TileDisplayMode {
	if (hasTimeBucket) return "line-chart";
	if (result.rows.length <= 5 && result.columns.length <= 3) return "stat-card";
	const numericCols = result.columns.filter((c) => typeof result.rows[0]?.[c] === "number");
	if (result.rows.length > 5 && numericCols.length > 0 && result.groupCount > 1 && result.groupCount <= 12) return "bar-chart";
	return "table";
}

export class ActionsBar {
	private addToDashboardOpen = false;

	constructor(private deps: ActionsBarDeps) {}

	render(): void {
		const { container, running, hasMeasures } = this.deps;
		const actions = container.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Run
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Run Query");
		if (running || !hasMeasures) {
			runLink.style.pointerEvents = "none";
			runLink.style.opacity = "0.5";
		}
		runLink.addEventListener("click", () => {
			if (!running && hasMeasures) this.deps.onRunQuery();
		});

		// Preview toggle
		if (this.deps.hasLoadedSources) {
			const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
			const previewIcon = previewLink.createSpan();
			setIcon(previewIcon, "eye");
			previewLink.appendText(this.deps.previewVisible ? " Hide Preview" : " Preview Data");
			if (this.deps.previewVisible) previewLink.style.color = "var(--text-accent)";
			previewLink.addEventListener("click", () => this.deps.onTogglePreview());
		}

		// Reset
		const clearLink = actions.createEl("span", { cls: "ft-nav-link" });
		const clearIcon = clearLink.createSpan();
		setIcon(clearIcon, "rotate-ccw");
		clearLink.appendText(" Reset");
		clearLink.addEventListener("click", () => this.deps.onReset());

		// Save / Update
		if (hasMeasures) {
			if (this.deps.isEditing) {
				const updateLink = actions.createEl("span", { cls: "ft-nav-link" });
				const updateIcon = updateLink.createSpan();
				setIcon(updateIcon, "save");
				updateLink.appendText(" Update Query");
				updateLink.addEventListener("click", () => this.deps.onUpdate());
			}

			const saveLink = actions.createEl("span", { cls: "ft-nav-link" });
			const saveIcon = saveLink.createSpan();
			setIcon(saveIcon, "plus");
			saveLink.appendText(this.deps.isEditing ? " Save As New" : " Save Query");
			saveLink.addEventListener("click", () => this.deps.onSave());

			// Export CSV + Add to Dashboard
			if (this.deps.lastResult && this.deps.lastResult.rows.length > 0) {
				const csvLink = actions.createEl("span", { cls: "ft-nav-link" });
				const csvIcon = csvLink.createSpan();
				setIcon(csvIcon, "download");
				csvLink.appendText(" Save to CSV");
				csvLink.addEventListener("click", () => {
					if (this.deps.lastResult) this.deps.onExportCsv(this.deps.lastResult);
				});

				if (this.deps.isEditing) {
					this.renderAddToDashboard(actions);
				}
			}
		}
	}

	private renderAddToDashboard(container: HTMLElement): void {
		const wrapper = container.createSpan();
		wrapper.style.position = "relative";

		const link = wrapper.createEl("span", { cls: "ft-nav-link" });
		const icon = link.createSpan();
		setIcon(icon, "layout-grid");
		link.appendText(" Add to Dashboard");
		if (this.addToDashboardOpen) link.style.color = "var(--text-accent)";
		link.addEventListener("click", (e) => {
			e.stopPropagation();
			this.addToDashboardOpen = !this.addToDashboardOpen;
			this.deps.onRenderDetail();
		});

		if (!this.addToDashboardOpen) return;

		const dropdown = wrapper.createDiv();
		dropdown.style.cssText = "position:absolute;top:100%;left:0;z-index:100;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;padding:0.25rem 0;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.15)";

		for (const d of this.deps.dashboards) {
			const item = dropdown.createDiv({ cls: "ft-master-item ft-text-sm" });
			item.style.cssText = "padding:0.35rem 0.75rem;cursor:pointer;display:flex;align-items:center;gap:0.5rem";
			const dIcon = item.createSpan();
			setIcon(dIcon, "layout-grid");
			dIcon.style.cssText = "width:14px;height:14px;flex-shrink:0";
			const nameEl = item.createSpan({ text: d.name });
			nameEl.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
			item.createSpan({ text: `${d.tiles.length}`, cls: "ft-badge ft-text-xs" });
			item.addEventListener("click", () => {
				this.addToDashboardOpen = false;
				const mode = suggestDisplayMode(this.deps.lastResult!, this.deps.hasTimeBucket);
				this.deps.onAddToDashboard(d.id, d.name, mode);
			});
		}

		if (this.deps.dashboards.length > 0) {
			const sep = dropdown.createDiv();
			sep.style.cssText = "height:1px;background:var(--background-modifier-border);margin:0.25rem 0";
		}

		const newItem = dropdown.createDiv({ cls: "ft-master-item ft-text-sm" });
		newItem.style.cssText = "padding:0.35rem 0.75rem;cursor:pointer;display:flex;align-items:center;gap:0.5rem";
		const newIcon = newItem.createSpan();
		setIcon(newIcon, "plus");
		newIcon.style.cssText = "width:14px;height:14px;flex-shrink:0";
		newItem.createSpan({ text: "New Dashboard" });
		newItem.addEventListener("click", () => {
			this.addToDashboardOpen = false;
			new DashboardNameModal(this.deps.app as never, {
				onConfirm: (name: string) => {
					const mode = suggestDisplayMode(this.deps.lastResult!, this.deps.hasTimeBucket);
					this.deps.onCreateDashboardAndAdd(name, mode);
				},
			}).open();
		});
	}
}
