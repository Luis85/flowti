/**
 * Pipeline table section for the Hub Dashboard.
 * Extracted from HubDashboard to reduce its LOC.
 */

import { setIcon } from "obsidian";
import type { HubComponentDeps } from "./types";

export function renderDashboardPipelines(
	container: HTMLElement,
	deps: HubComponentDeps,
	renderSectionHeader: (c: HTMLElement, icon: string, title: string, count: number) => HTMLElement,
): void {
	const state = deps.getState();
	const section = container.createDiv({ cls: "ft-section-mb" });
	renderSectionHeader(section, "layers", "Import Pipelines", state.pipelineConfigs.length);
	section.createDiv({
		text: "Merge multiple CSV reports into enriched notes by matching on a shared key column.",
		cls: "ft-text-muted ft-text-sm ft-mb-2",
	});

	if (state.pipelineConfigs.length === 0) {
		renderPipelineEmptyState(section, deps);
		return;
	}

	const table = section.createEl("table", { cls: "ft-preview-table" });
	table.addClass("ft-w-full");
	const thead = table.createEl("thead");
	const headRow = thead.createEl("tr");
	headRow.createEl("th", { text: "Name" });
	headRow.createEl("th", { text: "Target" });
	headRow.createEl("th", { text: "Sources" });
	headRow.createEl("th", { text: "" });

	const tbody = table.createEl("tbody");

	const sorted = [...state.pipelineConfigs].sort((a, b) => {
		if ((a.favourite ?? false) !== (b.favourite ?? false)) return a.favourite ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	for (const pipe of sorted) {
		const tr = tbody.createEl("tr");

		// Name column — star + name
		const nameTd = tr.createEl("td");
		const nameRow = nameTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		const starIcon = nameRow.createSpan({ cls: "ft-nav-link" });
		starIcon.addClass("ft-flex-shrink-0");
		setIcon(starIcon, pipe.favourite ? "star" : "star-off");
		if (pipe.favourite) starIcon.addClass("ft-text-accent");
		starIcon.setAttribute("aria-label", pipe.favourite ? "Unfavourite" : "Favourite");
		starIcon.addEventListener("click", () => {
			void deps.dataExchangeService.togglePipelineFavourite(pipe.id).then(() => {
				deps.scheduleRender();
			});
		});

		const cfgLink = nameRow.createEl("span", {
			text: pipe.name || "(unnamed)",
			cls: "ft-nav-link",
		});
		cfgLink.addEventListener("click", () => {
			deps.setState({ selectedPipelineId: pipe.id });
			deps.navigation.navigateTo("pipelines");
		});

		// Target column
		const targetTd = tr.createEl("td");
		const targetText = targetTd.createEl("span", {
			text: pipe.targetFolder || "—",
			cls: pipe.targetFolder ? "ft-text-sm" : "ft-text-muted",
		});
		if (pipe.targetFolder) {
			targetText.addClass("ft-table-cell-truncate");
		}

		// Sources + export step
		const sourcesTd = tr.createEl("td");
		const sourcesWrap = sourcesTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		sourcesWrap.createSpan({
			text: `${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});
		if (pipe.exportConfigIds?.length) {
			for (const exportId of pipe.exportConfigIds) {
				const exportCfg = deps.dataExchangeService.getExportConfig(exportId);
				const expBadge = sourcesWrap.createSpan({
					cls: "ft-badge ft-badge-muted",
				});
				const expIcon = expBadge.createSpan();
				setIcon(expIcon, "file-output");
				expIcon.addClass("ft-mr-025");
				expBadge.appendText(exportCfg ? exportCfg.name : "(deleted)");
				expBadge.title = "Export step";
			}
		}

		// Actions
		const actionsTd = tr.createEl("td");
		const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

		const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		setIcon(editLink.createSpan(), "pencil");
		editLink.setAttribute("aria-label", "Edit");
		editLink.addEventListener("click", () => {
			deps.setState({ selectedPipelineId: pipe.id });
			deps.navigation.navigateTo("pipelines");
		});

		const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		setIcon(previewLink.createSpan(), "eye");
		previewLink.setAttribute("aria-label", "Preview");
		previewLink.addEventListener("click", () => {
			deps.navigation.runPipelinePreview(pipe);
		});

		const runLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
		setIcon(runLink.createSpan(), "play");
		runLink.setAttribute("aria-label", "Run");
		runLink.addEventListener("click", () => {
			deps.navigation.executePipeline(pipe);
		});
	}

	// "New Pipeline" link at bottom
	const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
	const addLink = footer.createEl("span", { cls: "ft-nav-link ft-text-sm" });
	const addIcon = addLink.createSpan();
	setIcon(addIcon, "plus");
	addLink.appendText(" New Pipeline");
	addLink.addEventListener("click", () => {
		deps.navigation.createNewPipeline();
	});
}

function renderPipelineEmptyState(section: HTMLElement, deps: HubComponentDeps): void {
	const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
	const ctaIcon = cta.createDiv();
	setIcon(ctaIcon, "layers");
	ctaIcon.addClass("ft-icon-subtle");
	ctaIcon.addClass("ft-cta-icon-mb");
	cta.createDiv({
		text: "No import pipelines yet",
		cls: "ft-heading ft-heading-sm ft-mb-1",
	});
	cta.createDiv({
		text: "Create a pipeline to merge multiple CSV reports into enriched notes.",
		cls: "ft-text-muted ft-text-sm ft-mb-3",
	});
	const ctaBtn = cta.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
	const ctaBtnIcon = ctaBtn.createSpan({ cls: "flowti-csv-btn-icon" });
	setIcon(ctaBtnIcon, "plus");
	ctaBtn.appendText(" New Pipeline");
	ctaBtn.addEventListener("click", () => {
		deps.navigation.createNewPipeline();
	});
}
