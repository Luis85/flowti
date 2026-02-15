/**
 * Dashboard component for the Data Exchange Hub.
 * Renders the main overview with dictionary stats, configured imports/exports,
 * and pipeline summary.
 *
 * Large table sections are extracted into:
 * - {@link DashboardPipelines}
 * - {@link DashboardImports}
 * - {@link DashboardExports}
 */

import { setIcon } from "obsidian";
import { DashboardImportExecutor } from "./DashboardImportExecutor";
import type { HubComponentDeps } from "./types";
import { renderDashboardPipelines } from "./DashboardPipelines";
import { renderConfiguredImports } from "./DashboardImports";
import { renderConfiguredExports } from "./DashboardExports";
import { renderStatGrid } from "../shared/StatCard";
import type { StatCardItem } from "../shared/StatCard";

export class HubDashboard {
	private importExecutor: DashboardImportExecutor;

	constructor(
		private dashboardEl: HTMLElement,
		private deps: HubComponentDeps,
	) {
		this.importExecutor = new DashboardImportExecutor(deps);
	}

	// ─────────────────────────────────────────────────────────
	// Main render
	// ─────────────────────────────────────────────────────────

	render(): void {
		this.dashboardEl.empty();

		const state = this.deps.getState();

		// ── Title bar ──
		const titleBar = this.dashboardEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-mb-3" });
		titleBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		titleBar.style.paddingBottom = "0.75rem";
		const titleIcon = titleBar.createSpan();
		setIcon(titleIcon, "arrow-left-right");
		titleIcon.addClass("ft-icon-muted");
		titleBar.createEl("h2", {
			text: "Data Exchange Hub",
			cls: "ft-heading",
		}).style.margin = "0";

		const configuredCsv = state.csvFileEntries.filter((e) => e.importConfigs.length > 0);

		// Section 1: Data Dictionary
		this.renderDictionaryStats(this.dashboardEl);

		// Section 2: Import Pipelines
		renderDashboardPipelines(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));

		// Section 3: Configured Imports
		renderConfiguredImports(this.dashboardEl, configuredCsv, this.deps, this.importExecutor, this.renderSectionHeader.bind(this));

		// Section 4: Configured Exports
		renderConfiguredExports(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));
	}

	// ─────────────────────────────────────────────────────────
	// Section header
	// ─────────────────────────────────────────────────────────

	private renderSectionHeader(
		container: HTMLElement,
		icon: string,
		title: string,
		count: number,
	): HTMLElement {
		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		const iconEl = header.createSpan();
		setIcon(iconEl, icon);
		iconEl.addClass("ft-icon-muted");
		header.createSpan({ text: title, cls: "ft-heading ft-heading-sm" });
		header.createSpan({ text: String(count), cls: "ft-master-category-count" });
		return header;
	}

	// ─────────────────────────────────────────────────────────
	// Data Dictionary stats
	// ─────────────────────────────────────────────────────────

	private renderDictionaryStats(container: HTMLElement): void {
		const state = this.deps.getState();
		const propCount = state.dictionaryEntries.length;
		const docCount = state.csvFileEntries.filter((e) => e.hasDoc).length;
		const csvCount = state.csvFileEntries.length;
		const typeCount = state.typeEntries.length;
		if (propCount === 0 && docCount === 0 && typeCount === 0 && csvCount === 0) return;

		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderSectionHeader(section, "book-open", "Data Dictionary", propCount + docCount + typeCount);

		const cards: StatCardItem[] = [
			{ icon: "shapes", value: String(typeCount), label: "Types", onClick: () => this.deps.navigation.navigateTo("types") },
			{ icon: "tag", value: String(propCount), label: "Properties", onClick: () => this.deps.navigation.navigateTo("properties") },
			{ icon: "file-spreadsheet", value: `${docCount} / ${csvCount}`, label: "Reports", onClick: () => this.deps.navigation.navigateTo("reports") },
		];

		renderStatGrid(section, cards, 3);
	}
}
