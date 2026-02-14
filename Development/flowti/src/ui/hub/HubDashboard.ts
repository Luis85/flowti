/**
 * Dashboard component for the Data Exchange Hub.
 * Renders the main overview with dictionary stats, configured imports/exports,
 * pipeline summary, and available CSV files.
 *
 * Large table sections are extracted into:
 * - {@link DashboardPipelines}
 * - {@link DashboardImports}
 * - {@link DashboardExports}
 */

import { Notice, TFile, setIcon } from "obsidian";
import { DashboardImportExecutor } from "./DashboardImportExecutor";
import type { CsvFileEntry, HubComponentDeps, HubPage } from "./types";
import { renderDashboardPipelines } from "./DashboardPipelines";
import { renderConfiguredImports } from "./DashboardImports";
import { renderConfiguredExports } from "./DashboardExports";

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

		// Partition CSV files: configured (has import configs), export outputs, unconfigured
		const exportOutputPaths = new Set(state.exportConfigs.map((c) => c.outputPath));
		const configuredCsv = state.csvFileEntries.filter((e) => e.importConfigs.length > 0);
		const unconfiguredCsv = state.csvFileEntries.filter(
			(e) => e.importConfigs.length === 0 && !exportOutputPaths.has(e.path),
		);

		// Section 1: Data Dictionary
		this.renderDictionaryStats(this.dashboardEl);

		// Section 1.5: Import Pipelines
		renderDashboardPipelines(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));

		// Section 2: Configured Imports
		renderConfiguredImports(this.dashboardEl, configuredCsv, this.deps, this.importExecutor, this.renderSectionHeader.bind(this));

		// Section 3: Configured Exports
		renderConfiguredExports(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));

		// Section 4: Available Files
		this.renderUnconfiguredCsvFiles(this.dashboardEl, unconfiguredCsv);
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
		const reportCount = state.reportEntries.length;
		const typeCount = state.typeEntries.length;
		if (propCount === 0 && reportCount === 0 && typeCount === 0) return;

		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderSectionHeader(section, "book-open", "Data Dictionary", propCount + reportCount + typeCount);

		const row = section.createDiv({ cls: "ft-flex ft-gap-3" });

		const cards: Array<{ icon: string; count: number; label: string; page: HubPage }> = [
			{ icon: "shapes", count: typeCount, label: "Types", page: "types" },
			{ icon: "tag", count: propCount, label: "Properties", page: "properties" },
			{ icon: "file-spreadsheet", count: reportCount, label: "Reports", page: "reports" },
		];

		for (const card of cards) {
			const el = row.createDiv({ cls: "ft-card ft-p-3" });
			el.addClass("ft-flex-1");
			el.addClass("ft-cursor-pointer");
			el.style.textAlign = "center";

			const iconEl = el.createDiv();
			setIcon(iconEl, card.icon);
			iconEl.addClass("ft-icon-faint");
			iconEl.style.marginBottom = "0.25rem";

			el.createDiv({
				text: String(card.count),
				cls: "ft-heading",
			}).style.margin = "0";

			el.createDiv({
				text: card.label,
				cls: "ft-text-muted ft-text-sm",
			});

			el.addEventListener("click", () => {
				this.deps.navigation.navigateTo(card.page);
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Available (unconfigured) CSV files
	// ─────────────────────────────────────────────────────────

	private renderUnconfiguredCsvFiles(
		container: HTMLElement,
		entries: CsvFileEntry[],
	): void {
		const state = this.deps.getState();
		const section = container.createDiv();

		// Partition into visible vs hidden
		const hiddenPaths = this.deps.dataExchangeService.getHiddenCsvPaths();
		const hiddenSet = new Set(hiddenPaths);
		const visibleEntries = entries.filter((e) => !hiddenSet.has(e.path));
		const hiddenEntries = entries.filter((e) => hiddenSet.has(e.path));
		const displayCount = state.showHiddenCsvs ? entries.length : visibleEntries.length;

		this.renderSectionHeader(section, "file-spreadsheet", "Available Files", displayCount);

		// Toggle chip for hidden files
		if (hiddenEntries.length > 0) {
			const toggleRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
			const toggleChip = toggleRow.createSpan({
				cls: `ft-badge ${state.showHiddenCsvs ? "" : "ft-badge-muted"}`,
			});
			toggleChip.addClass("ft-cursor-pointer");
			const eyeIcon = toggleChip.createSpan();
			setIcon(eyeIcon, state.showHiddenCsvs ? "eye" : "eye-off");
			eyeIcon.style.marginRight = "0.25rem";
			toggleChip.appendText(`${state.showHiddenCsvs ? "Hide" : "Show"} hidden (${hiddenEntries.length})`);
			toggleChip.addEventListener("click", () => {
				this.deps.setState({ showHiddenCsvs: !state.showHiddenCsvs });
				this.deps.scheduleRender();
			});
		}

		if (visibleEntries.length === 0 && !state.showHiddenCsvs) {
			section.createDiv({
				text: hiddenEntries.length > 0
					? `All ${hiddenEntries.length} CSV file(s) are hidden`
					: "No unconfigured CSV files found",
				cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm",
			});
			return;
		}

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "File" });
		headRow.createEl("th", { text: "Doc" });
		headRow.createEl("th", { text: "" });

		const tbody = table.createEl("tbody");
		for (const entry of visibleEntries) {
			this.renderCsvFileRow(tbody, entry, false);
		}
		if (state.showHiddenCsvs) {
			for (const entry of hiddenEntries) {
				this.renderCsvFileRow(tbody, entry, true);
			}
		}
	}

	private renderCsvFileRow(
		tbody: HTMLElement,
		entry: CsvFileEntry,
		isHidden: boolean,
	): void {
		const tr = tbody.createEl("tr");
		if (isHidden) {
			tr.addClass("ft-icon-muted");
		}

		// File name
		const nameTd = tr.createEl("td");
		const nameLink = nameTd.createEl("span", {
			text: entry.name,
			cls: "ft-nav-link",
		});
		nameLink.addEventListener("click", () => {
			const file = this.deps.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) {
				void this.deps.app.workspace.getLeaf(false).openFile(file);
			}
		});
		if (entry.path !== entry.name) {
			const sub = nameTd.createDiv({ cls: "ft-text-muted ft-text-sm" });
			sub.style.whiteSpace = "nowrap";
			sub.style.overflow = "hidden";
			sub.style.textOverflow = "ellipsis";
			sub.textContent = entry.path;
		}

		// Doc column
		const docTd = tr.createEl("td");
		if (entry.hasDoc) {
			const docLink = docTd.createEl("span", { cls: "ft-nav-link" });
			const dIcon = docLink.createSpan();
			setIcon(dIcon, "file-text");
			docLink.addEventListener("click", () => {
				const docPath = this.deps.dataExchangeService.getCsvDocPath(entry.path);
				void this.deps.app.workspace.openLinkText(docPath, "", false);
			});
		} else {
			const createLink = docTd.createEl("span", { cls: "ft-nav-link ft-text-muted" });
			const cIcon = createLink.createSpan();
			setIcon(cIcon, "plus");
			createLink.addEventListener("click", () => {
				const file = this.deps.app.vault.getAbstractFileByPath(entry.path);
				if (!(file instanceof TFile)) return;
				void this.deps.app.vault.read(file).then((content) => {
					const lines = content.split("\n").filter((l) => l.trim());
					const headers = lines.length > 0 ? lines[0].split(",").map((h) => h.trim()) : [];
					const rowCount = Math.max(0, lines.length - 1);
					return this.deps.dataExchangeService.createCsvDoc(entry.path, headers, rowCount);
				}).then(() => {
					new Notice(`Report created for ${entry.name}`);
					this.deps.scheduleRender();
				});
			});
		}

		// Actions — hide/unhide + import
		const actionsTd = tr.createEl("td");
		const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

		const hideLink = actionsWrap.createEl("span", { cls: "ft-nav-link ft-text-muted" });
		const hideIcon = hideLink.createSpan();
		setIcon(hideIcon, isHidden ? "eye" : "eye-off");
		hideLink.setAttribute("aria-label", isHidden ? "Unhide" : "Hide");
		hideLink.addEventListener("click", () => {
			if (isHidden) {
				void this.deps.dataExchangeService.unhideCsv(entry.path).then(() => {
					this.deps.scheduleRender();
				});
			} else {
				void this.deps.dataExchangeService.hideCsv(entry.path).then(() => {
					this.deps.scheduleRender();
				});
			}
		});

		const importLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		const impIcon = importLink.createSpan();
		setIcon(impIcon, "file-input");
		importLink.appendText(" Import");
		importLink.addEventListener("click", () => {
			this.deps.navigation.openCsvImport(entry.path);
		});
	}
}
