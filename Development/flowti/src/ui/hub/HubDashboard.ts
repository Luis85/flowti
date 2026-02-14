/**
 * Dashboard component for the Data Exchange Hub.
 * Renders the main overview with dictionary stats, configured imports/exports,
 * pipeline summary, and available CSV files.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type { SavedImportConfig } from "../../domain/dataExchange/types";
import { FilePickerModal } from "../FilePickerModal";
import type { CsvFileEntry, HubComponentDeps, HubPage } from "./types";

export class HubDashboard {
	constructor(
		private dashboardEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

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
		this.renderDashboardPipelines(this.dashboardEl);

		// Section 2: Configured Imports
		this.renderConfiguredImports(this.dashboardEl, configuredCsv);

		// Section 3: Configured Exports
		this.renderConfiguredExports(this.dashboardEl);

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
	// Import Pipelines
	// ─────────────────────────────────────────────────────────

	private renderDashboardPipelines(container: HTMLElement): void {
		const state = this.deps.getState();
		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderSectionHeader(section, "layers", "Import Pipelines", state.pipelineConfigs.length);
		section.createDiv({
			text: "Merge multiple CSV reports into enriched notes by matching on a shared key column.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		if (state.pipelineConfigs.length === 0) {
			const cta = section.createDiv({ cls: "ft-card ft-p-3 ft-text-center" });
			const ctaIcon = cta.createDiv();
			setIcon(ctaIcon, "layers");
			ctaIcon.addClass("ft-icon-subtle");
			ctaIcon.style.marginBottom = "0.5rem";
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
				this.deps.navigation.createNewPipeline();
			});
			return;
		}

		const table = section.createEl("table", { cls: "ft-preview-table" });
		table.style.width = "100%";
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
			if (pipe.favourite) starIcon.style.color = "var(--text-accent)";
			starIcon.setAttribute("aria-label", pipe.favourite ? "Unfavourite" : "Favourite");
			starIcon.addEventListener("click", () => {
				void this.deps.dataExchangeService.togglePipelineFavourite(pipe.id).then(() => {
					this.deps.scheduleRender();
				});
			});

			const cfgLink = nameRow.createEl("span", {
				text: pipe.name || "(unnamed)",
				cls: "ft-nav-link",
			});
			cfgLink.addEventListener("click", () => {
				this.deps.setState({ selectedPipelineId: pipe.id });
				this.deps.navigation.navigateTo("pipelines");
			});

			// Target column
			const targetTd = tr.createEl("td");
			const targetText = targetTd.createEl("span", {
				text: pipe.targetFolder || "—",
				cls: pipe.targetFolder ? "ft-text-sm" : "ft-text-muted",
			});
			if (pipe.targetFolder) {
				targetText.style.whiteSpace = "nowrap";
				targetText.style.overflow = "hidden";
				targetText.style.textOverflow = "ellipsis";
				targetText.style.display = "block";
				targetText.style.maxWidth = "12rem";
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
					const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
					const expBadge = sourcesWrap.createSpan({
						cls: "ft-badge ft-badge-muted",
					});
					const expIcon = expBadge.createSpan();
					setIcon(expIcon, "file-output");
					expIcon.style.marginRight = "0.25rem";
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
				this.deps.setState({ selectedPipelineId: pipe.id });
				this.deps.navigation.navigateTo("pipelines");
			});

			const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(previewLink.createSpan(), "eye");
			previewLink.setAttribute("aria-label", "Preview");
			previewLink.addEventListener("click", () => {
				this.deps.navigation.runPipelinePreview(pipe);
			});

			const runLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(runLink.createSpan(), "play");
			runLink.setAttribute("aria-label", "Run");
			runLink.addEventListener("click", () => {
				this.deps.navigation.executePipeline(pipe);
			});
		}

		// "New Pipeline" link at bottom
		const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addLink = footer.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addLink.createSpan();
		setIcon(addIcon, "plus");
		addLink.appendText(" New Pipeline");
		addLink.addEventListener("click", () => {
			this.deps.navigation.createNewPipeline();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Configured Imports
	// ─────────────────────────────────────────────────────────

	private renderConfiguredImports(
		container: HTMLElement,
		entries: CsvFileEntry[],
	): void {
		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderSectionHeader(section, "file-input", "Configured Imports", entries.length);

		if (entries.length === 0) {
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
				new FilePickerModal(this.deps.app, ["csv"], (csvPath) => {
					this.deps.navigation.openCsvImport(csvPath);
				}, this.deps.dataExchangeService.getHiddenCsvPaths()).open();
			});
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
					void this.deps.dataExchangeService.toggleImportFavourite(cfg.id).then(() => {
						this.deps.scheduleRender();
					});
				});

				const cfgLink = nameRow.createEl("span", {
					text: cfg.name || "(unnamed)",
					cls: "ft-nav-link",
				});
				cfgLink.addEventListener("click", () => {
					this.deps.setState({ selectedImportId: cfg.id });
					this.deps.navigation.navigateTo("imports");
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
					text: entry.name,
					cls: "ft-nav-link ft-text-sm",
				});
				fileLink.addEventListener("click", () => {
					const file = this.deps.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) {
						void this.deps.app.workspace.getLeaf(false).openFile(file);
					}
				});

				// Actions column — edit + preview + execute
				const actionsTd = tr.createEl("td");
				const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

				// Edit (open detail view)
				const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				setIcon(editLink.createSpan(), "pencil");
				editLink.setAttribute("aria-label", "Edit");
				editLink.addEventListener("click", () => {
					this.deps.setState({ selectedImportId: cfg.id });
					this.deps.navigation.navigateTo("imports");
				});

				// Preview (open import wizard with config)
				const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				setIcon(previewLink.createSpan(), "eye");
				previewLink.setAttribute("aria-label", "Preview");
				previewLink.addEventListener("click", () => {
					this.deps.navigation.openCsvImport(entry.path, cfg);
				});

				// Execute — with inline feedback
				const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
				setIcon(execLink.createSpan(), "play");
				execLink.setAttribute("aria-label", "Execute");
				execLink.addEventListener("click", () => {
					const csvPath = cfg.sourcePath || entry.path;
					this.runDashboardImport(cfg, csvPath, tr);
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
			new FilePickerModal(this.deps.app, ["csv"], (csvPath) => {
				this.deps.navigation.openCsvImport(csvPath);
			}, this.deps.dataExchangeService.getHiddenCsvPaths()).open();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Dashboard import execution (inline feedback)
	// ─────────────────────────────────────────────────────────

	private runDashboardImport(cfg: SavedImportConfig, csvPath: string, row: HTMLTableRowElement): void {
		// Remove any existing progress row
		const existing = row.parentElement?.querySelector(".ft-dashboard-progress-row");
		if (existing) existing.remove();

		// Insert a progress row after the triggering row
		const progressRow = document.createElement("tr");
		progressRow.className = "ft-dashboard-progress-row";
		const progressTd = document.createElement("td");
		progressTd.colSpan = 4;
		progressRow.appendChild(progressTd);
		row.after(progressRow);

		const statusRow = progressTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.style.opacity = "0.6";
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ text: `Running "${cfg.name}"...`, cls: "ft-text-sm" });

		const barBg = progressTd.createDiv();
		barBg.style.cssText = "height:3px;background:var(--background-modifier-border);border-radius:2px;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		// Listen for progress
		const offProgress = this.deps.eventBus.on("dataExchange.import.progress", (event) => {
			const { current, total, lastFilename } = event.payload;
			const pct = total > 0 ? Math.round((current / total) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Importing... ${current} / ${total}`;
			if (lastFilename) {
				statusText.textContent += ` — ${lastFilename}`;
			}
		});

		const cleanup = (success: boolean, message: string) => {
			offProgress();
			progressTd.empty();
			const resultRow = progressTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });

			// Auto-dismiss after 5s
			setTimeout(() => {
				progressRow.remove();
				if (success) this.deps.scheduleRender();
			}, 5000);
		};

		const offComplete = this.deps.eventBus.on("dataExchange.import.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `Done: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "");
			cleanup(true, msg);
			new Notice(msg);
		});
		const offFailed = this.deps.eventBus.on("dataExchange.import.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Failed: ${event.payload.error}`);
			new Notice(`Import failed: ${event.payload.error}`);
		});

		// Merge noteType into customProperties if set
		const importCustomProps = { ...cfg.customProperties };
		if (cfg.noteType) {
			importCustomProps.type = cfg.noteType;
		}

		void this.deps.eventBus.emit("dataExchange.import.execute", {
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
	}

	// ─────────────────────────────────────────────────────────
	// Configured Exports
	// ─────────────────────────────────────────────────────────

	private renderConfiguredExports(container: HTMLElement): void {
		const state = this.deps.getState();
		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderSectionHeader(section, "file-output", "Configured Exports", state.exportConfigs.length);

		if (state.exportConfigs.length === 0) {
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
			ctaBtn.addEventListener("click", () => this.pickBaseForNewExport());
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
				void this.deps.dataExchangeService.toggleExportFavourite(cfg.id).then(() => {
					this.deps.scheduleRender();
				});
			});

			const nameLink = nameRow.createEl("span", {
				text: cfg.name || "(unnamed)",
				cls: "ft-nav-link",
			});
			nameLink.addEventListener("click", () => {
				this.deps.setState({ selectedExportId: cfg.id });
				this.deps.navigation.navigateTo("exports");
			});
			nameRow.createSpan({
				text: cfg.format.toUpperCase(),
				cls: "ft-master-category-count",
			});

			// Source — base file or folder link
			const srcTd = tr.createEl("td");
			const srcName = cfg.sourcePath.split("/").pop() ?? cfg.sourcePath;
			const srcLink = srcTd.createEl("span", {
				text: srcName,
				cls: "ft-nav-link ft-text-sm",
			});
			srcLink.addEventListener("click", () => {
				if (cfg.sourceType === "base") {
					const file = this.deps.app.vault.getAbstractFileByPath(cfg.sourcePath);
					if (file instanceof TFile) {
						void this.deps.app.workspace.getLeaf(false).openFile(file);
					}
				} else {
					void this.deps.app.workspace.openLinkText(cfg.sourcePath, "", false);
				}
			});
			srcTd.createSpan({
				text: cfg.sourceType,
				cls: "ft-badge ft-badge-muted",
			}).style.marginLeft = "0.25rem";

			// Output
			const outTd = tr.createEl("td");
			const outName = cfg.outputPath.split("/").pop() ?? cfg.outputPath;
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
					void this.deps.app.workspace.openLinkText(cfg.outputPath, "", false);
				}
			});

			// Actions — edit + preview + execute
			const actionsTd = tr.createEl("td");
			const actionsWrap = actionsTd.createDiv({ cls: "ft-flex ft-gap-2" });

			// Edit (open detail view)
			const editLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(editLink.createSpan(), "pencil");
			editLink.setAttribute("aria-label", "Edit");
			editLink.addEventListener("click", () => {
				this.deps.setState({ selectedExportId: cfg.id });
				this.deps.navigation.navigateTo("exports");
			});

			// Preview (open export wizard with config)
			const previewLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(previewLink.createSpan(), "eye");
			previewLink.setAttribute("aria-label", "Preview");
			previewLink.addEventListener("click", () => {
				this.deps.navigation.openExport(cfg);
			});

			// Execute
			const execLink = actionsWrap.createEl("span", { cls: "ft-nav-link" });
			setIcon(execLink.createSpan(), "play");
			execLink.setAttribute("aria-label", "Execute");
			execLink.addEventListener("click", () => {
				this.deps.navigation.executeExportConfig(cfg);
			});
		}

		// "New Export" button below table
		const newRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
		const newBtn = newRow.createEl("span", { cls: "ft-nav-link" });
		const newIcon = newBtn.createSpan();
		setIcon(newIcon, "plus");
		newBtn.appendText(" New Export from Base");
		newBtn.addEventListener("click", () => this.pickBaseForNewExport());
	}

	private pickBaseForNewExport(): void {
		new FilePickerModal(this.deps.app, ["base"], (basePath) => {
			this.deps.navigation.openNewExport(basePath, "base", "csv");
		}).open();
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
