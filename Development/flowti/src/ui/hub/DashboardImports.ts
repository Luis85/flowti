/**
 * Import configs table section for the Hub Dashboard.
 * Extracted from HubDashboard to reduce its LOC.
 */

import { TFile, setIcon } from "obsidian";
import { FilePickerModal } from "../FilePickerModal";
import type { CsvFileEntry, HubComponentDeps } from "./types";

export function renderConfiguredImports(
	container: HTMLElement,
	entries: CsvFileEntry[],
	deps: HubComponentDeps,
	renderSectionHeader: (c: HTMLElement, icon: string, title: string, count: number) => HTMLElement,
): void {
	const section = container.createDiv();
	section.style.marginBottom = "2rem";
	renderSectionHeader(section, "file-input", "Configured Imports", entries.length);

	if (entries.length === 0) {
		renderImportEmptyState(section, deps);
		return;
	}

	const table = section.createEl("table", { cls: "ft-preview-table" });
	table.style.width = "100%";
	const thead = table.createEl("thead");
	const headRow = thead.createEl("tr");
	headRow.createEl("th", { text: "Name" });
	headRow.createEl("th", { text: "Target" });
	headRow.createEl("th", { text: "File" });
	headRow.createEl("th", { text: "" });

	const tbody = table.createEl("tbody");

	// Sort: favourites first, then by name within each group
	const sortedEntries = [...entries];
	for (const entry of sortedEntries) {
		entry.importConfigs.sort((a, b) => {
			if ((a.favourite ?? false) !== (b.favourite ?? false)) return a.favourite ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
	}

	for (const entry of sortedEntries) {
		for (const cfg of entry.importConfigs) {
			const tr = tbody.createEl("tr");

			// Name column — star + config name
			const nameTd = tr.createEl("td");
			const nameRow = nameTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

			const starIcon = nameRow.createSpan({ cls: "ft-nav-link" });
			starIcon.addClass("ft-flex-shrink-0");
			setIcon(starIcon, cfg.favourite ? "star" : "star-off");
			if (cfg.favourite) starIcon.style.color = "var(--text-accent)";
			starIcon.setAttribute("aria-label", cfg.favourite ? "Unfavourite" : "Favourite");
			starIcon.addEventListener("click", () => {
				void deps.dataExchangeService.toggleImportFavourite(cfg.id).then(() => {
					deps.scheduleRender();
				});
			});

			const cfgLink = nameRow.createEl("span", {
				text: cfg.name || "(unnamed)",
				cls: "ft-nav-link",
			});
			cfgLink.addEventListener("click", () => {
				deps.setState({ selectedImportId: cfg.id });
				deps.navigation.navigateTo("imports");
			});

			// Target column — target folder path
			const targetTd = tr.createEl("td");
			const targetText = targetTd.createEl("span", {
				text: cfg.targetFolder || "—",
				cls: cfg.targetFolder ? "ft-text-sm" : "ft-text-muted",
			});
			if (cfg.targetFolder) {
				targetText.style.whiteSpace = "nowrap";
				targetText.style.overflow = "hidden";
				targetText.style.textOverflow = "ellipsis";
				targetText.style.display = "block";
				targetText.style.maxWidth = "12rem";
			}

			// File column — CSV name
			const fileTd = tr.createEl("td");
			const fileLink = fileTd.createEl("span", {
				text: entry.displayName,
				cls: "ft-nav-link ft-text-sm",
			});
			fileLink.addEventListener("click", () => {
				const file = deps.app.vault.getAbstractFileByPath(entry.path);
				if (file instanceof TFile) {
					void deps.app.workspace.getLeaf(false).openFile(file);
				}
			});

			// Actions column — edit + preview + execute
			const actionsTd = tr.createEl("td");
			const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

			const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(editLink.createSpan(), "pencil");
			editLink.setAttribute("aria-label", "Edit");
			editLink.addEventListener("click", () => {
				deps.setState({ selectedImportId: cfg.id });
				deps.navigation.navigateTo("imports");
			});

			const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(previewLink.createSpan(), "eye");
			previewLink.setAttribute("aria-label", "Preview");
			previewLink.addEventListener("click", () => {
				deps.navigation.openCsvImport(entry.path, cfg);
			});

			const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(execLink.createSpan(), "play");
			execLink.setAttribute("aria-label", "Execute");
			execLink.addEventListener("click", () => {
				const csvPath = cfg.sourcePath || entry.path;
				const importCustomProps = { ...cfg.customProperties };
				if (cfg.noteType) importCustomProps.type = cfg.noteType;
				void deps.eventBus.emit("dataExchange.import.execute", {
					config: {
						sourcePath: csvPath,
						targetFolder: cfg.targetFolder,
						nameColumn: cfg.nameColumn,
						namePrefix: cfg.namePrefix,
						nameSuffix: cfg.nameSuffix,
						columnMappings: cfg.columnMappings,
						conflictStrategy: cfg.conflictStrategy,
						customProperties: Object.keys(importCustomProps).length > 0 ? importCustomProps : undefined,
					},
				});
			});
		}
	}

	// "New Import" button below table
	const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
	const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
	const newIcon = newBtn.createSpan();
	setIcon(newIcon, "plus");
	newBtn.appendText(" New Import from CSV");
	newBtn.addEventListener("click", () => {
		new FilePickerModal(deps.app, ["csv"], (csvPath) => {
			deps.navigation.openCsvImport(csvPath);
		}, deps.dataExchangeService.getHiddenCsvPaths()).open();
	});
}

function renderImportEmptyState(section: HTMLElement, deps: HubComponentDeps): void {
	const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
	const ctaIcon = cta.createDiv();
	setIcon(ctaIcon, "file-input");
	ctaIcon.addClass("ft-icon-subtle");
	ctaIcon.style.marginBottom = "0.5rem";
	cta.createDiv({
		text: "No import configs yet",
		cls: "ft-heading ft-heading-sm ft-mb-1",
	});
	cta.createDiv({
		text: "Create your first import by selecting a CSV file as the data source.",
		cls: "ft-text-muted ft-text-sm ft-mb-3",
	});
	const ctaBtn = cta.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
	const ctaBtnIcon = ctaBtn.createSpan({ cls: "flowti-csv-btn-icon" });
	setIcon(ctaBtnIcon, "file-spreadsheet");
	ctaBtn.appendText(" Select CSV File");
	ctaBtn.addEventListener("click", () => {
		new FilePickerModal(deps.app, ["csv"], (csvPath) => {
			deps.navigation.openCsvImport(csvPath);
		}, deps.dataExchangeService.getHiddenCsvPaths()).open();
	});
}
