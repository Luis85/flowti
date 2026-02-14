/**
 * Export configs table section for the Hub Dashboard.
 * Extracted from HubDashboard to reduce its LOC.
 */

import { TFile, setIcon } from "obsidian";
import { FilePickerModal } from "../FilePickerModal";
import { basename } from "../../utils/pathUtils";
import type { HubComponentDeps } from "./types";

export function renderConfiguredExports(
	container: HTMLElement,
	deps: HubComponentDeps,
	renderSectionHeader: (c: HTMLElement, icon: string, title: string, count: number) => HTMLElement,
): void {
	const state = deps.getState();
	const section = container.createDiv();
	section.style.marginBottom = "2rem";
	renderSectionHeader(section, "file-output", "Configured Exports", state.exportConfigs.length);

	if (state.exportConfigs.length === 0) {
		renderExportEmptyState(section, deps);
		return;
	}

	const table = section.createEl("table", { cls: "ft-preview-table" });
	table.style.width = "100%";
	const thead = table.createEl("thead");
	const headRow = thead.createEl("tr");
	headRow.createEl("th", { text: "Name" });
	headRow.createEl("th", { text: "Source" });
	headRow.createEl("th", { text: "Output" });
	headRow.createEl("th", { text: "" });

	const tbody = table.createEl("tbody");

	// Sort: favourites first, then by name
	const sortedExports = [...state.exportConfigs].sort((a, b) => {
		if ((a.favourite ?? false) !== (b.favourite ?? false)) return a.favourite ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	for (const cfg of sortedExports) {
		const tr = tbody.createEl("tr");

		// Name — star + clickable name + format badge
		const nameTd = tr.createEl("td");
		const nameRow = nameTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		const starIcon = nameRow.createSpan({ cls: "ft-nav-link" });
		starIcon.addClass("ft-flex-shrink-0");
		setIcon(starIcon, cfg.favourite ? "star" : "star-off");
		if (cfg.favourite) starIcon.style.color = "var(--text-accent)";
		starIcon.setAttribute("aria-label", cfg.favourite ? "Unfavourite" : "Favourite");
		starIcon.addEventListener("click", () => {
			void deps.dataExchangeService.toggleExportFavourite(cfg.id).then(() => {
				deps.scheduleRender();
			});
		});

		const nameLink = nameRow.createEl("span", {
			text: cfg.name || "(unnamed)",
			cls: "ft-nav-link",
		});
		nameLink.addEventListener("click", () => {
			deps.setState({ selectedExportId: cfg.id });
			deps.navigation.navigateTo("exports");
		});
		nameRow.createSpan({
			text: cfg.format.toUpperCase(),
			cls: "ft-master-category-count",
		});

		// Source — base file or folder link
		const srcTd = tr.createEl("td");
		const srcName = basename(cfg.sourcePath) || cfg.sourcePath;
		const srcLink = srcTd.createEl("span", {
			text: srcName,
			cls: "ft-nav-link ft-text-sm",
		});
		srcLink.addEventListener("click", () => {
			if (cfg.sourceType === "base") {
				const file = deps.app.vault.getAbstractFileByPath(cfg.sourcePath);
				if (file instanceof TFile) {
					void deps.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				void deps.app.workspace.openLinkText(cfg.sourcePath, "", false);
			}
		});
		srcTd.createSpan({
			text: cfg.sourceType,
			cls: "ft-badge ft-badge-muted",
		}).style.marginLeft = "0.25rem";

		// Output
		const outTd = tr.createEl("td");
		const outName = basename(cfg.outputPath) || cfg.outputPath;
		const outLink = outTd.createEl("span", {
			text: outName,
			cls: "ft-nav-link ft-text-sm",
		});
		if (cfg.isExternal) {
			outTd.createSpan({
				text: "external",
				cls: "ft-badge ft-badge-muted",
			}).style.marginLeft = "0.25rem";
		}
		outLink.addEventListener("click", () => {
			if (!cfg.isExternal) {
				void deps.app.workspace.openLinkText(cfg.outputPath, "", false);
			}
		});

		// Actions — edit + preview + execute
		const actionsTd = tr.createEl("td");
		const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

		const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		setIcon(editLink.createSpan(), "pencil");
		editLink.setAttribute("aria-label", "Edit");
		editLink.addEventListener("click", () => {
			deps.setState({ selectedExportId: cfg.id });
			deps.navigation.navigateTo("exports");
		});

		const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		setIcon(previewLink.createSpan(), "eye");
		previewLink.setAttribute("aria-label", "Preview");
		previewLink.addEventListener("click", () => {
			deps.navigation.openExport(cfg);
		});

		const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		setIcon(execLink.createSpan(), "play");
		execLink.setAttribute("aria-label", "Execute");
		execLink.addEventListener("click", () => {
			deps.navigation.executeExportConfig(cfg);
		});
	}

	// "New Export" button below table
	const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
	const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
	const newIcon = newBtn.createSpan();
	setIcon(newIcon, "plus");
	newBtn.appendText(" New Export from Base");
	newBtn.addEventListener("click", () => pickBaseForNewExport(deps));
}

function renderExportEmptyState(section: HTMLElement, deps: HubComponentDeps): void {
	const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
	const ctaIcon = cta.createDiv();
	setIcon(ctaIcon, "file-output");
	ctaIcon.addClass("ft-icon-subtle");
	ctaIcon.style.marginBottom = "0.5rem";
	cta.createDiv({
		text: "No export configs yet",
		cls: "ft-heading ft-heading-sm ft-mb-1",
	});
	cta.createDiv({
		text: "Create your first export by selecting a .base file as the data source.",
		cls: "ft-text-muted ft-text-sm ft-mb-3",
	});
	const ctaBtn = cta.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
	const ctaBtnIcon = ctaBtn.createSpan({ cls: "flowti-csv-btn-icon" });
	setIcon(ctaBtnIcon, "table");
	ctaBtn.appendText(" Select Base File");
	ctaBtn.addEventListener("click", () => pickBaseForNewExport(deps));
}

function pickBaseForNewExport(deps: HubComponentDeps): void {
	new FilePickerModal(deps.app, ["base"], (basePath) => {
		deps.navigation.openNewExport(basePath, "base", "csv");
	}).open();
}
