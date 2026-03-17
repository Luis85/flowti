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
import type { ActiveOperation, HubComponentDeps } from "./types";
import { renderDashboardPipelines } from "./DashboardPipelines";
import { renderConfiguredImports } from "./DashboardImports";
import { renderConfiguredExports } from "./DashboardExports";
import { renderStatGrid } from "../shared/StatCard";
import type { StatCardItem } from "../shared/StatCard";

export class HubDashboard {
	private liveUnsubscribes: (() => void)[] = [];

	constructor(
		private dashboardEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Main render
	// ─────────────────────────────────────────────────────────

	render(): void {
		this.cleanupLiveListeners();
		this.dashboardEl.empty();

		const state = this.deps.getState();

		// Check if all sections are empty
		const hasContent = state.dictionaryEntries.length > 0
			|| state.csvFileEntries.length > 0
			|| state.typeEntries.length > 0
			|| state.canvasConfigs.length > 0
			|| state.importConfigs.length > 0
			|| state.exportConfigs.length > 0
			|| state.pipelineConfigs.length > 0
			|| state.activeOperations.length > 0;

		if (!hasContent) {
			this.renderEmptyState();
			return;
		}

		// ── Title bar ──
		const titleBar = this.dashboardEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-mb-3 ft-dashboard-titlebar" });
		const titleIcon = titleBar.createSpan();
		setIcon(titleIcon, "arrow-left-right");
		titleIcon.addClass("ft-icon-muted");
		titleBar.createEl("h2", {
			text: "Data exchange hub",
			cls: "ft-heading ft-heading-no-margin",
		});

		const configuredCsv = state.csvFileEntries.filter((e) => e.importConfigs.length > 0);

		// Section 1: Active Operations (top — most visible, rebuilt from state, live listeners)
		if (state.activeOperations.length > 0) {
			this.renderActiveOperations(this.dashboardEl, state.activeOperations);
		}

		// Section 2: Data Dictionary
		this.renderDictionaryStats(this.dashboardEl);

		// Section 2b: Canvas Import Configs
		this.renderCanvasStats(this.dashboardEl);

		// Section 3: Import Pipelines
		renderDashboardPipelines(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));

		// Section 4: Configured Imports
		renderConfiguredImports(this.dashboardEl, configuredCsv, this.deps, this.renderSectionHeader.bind(this));

		// Section 5: Configured Exports
		renderConfiguredExports(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));
	}

	// ─────────────────────────────────────────────────────────
	// Empty state
	// ─────────────────────────────────────────────────────────

	private renderEmptyState(): void {
		const wrapper = this.dashboardEl.createDiv({ cls: "ft-empty-state ft-empty-state-centered" });

		// Hero icon
		const iconEl = wrapper.createDiv();
		setIcon(iconEl, "file-input");
		iconEl.addClass("ft-empty-state-icon");

		// Heading
		wrapper.createDiv({ text: "Welcome to the Data Exchange Hub", cls: "ft-empty-state-heading" });

		// Subtitle
		wrapper.createDiv({
			text: "Import CSVs, export vault data, and build automated pipelines \u2014 all from one place.",
			cls: "ft-text-sm ft-text-muted ft-empty-state-subtitle-mb",
		});

		// Action cards grid
		const grid = wrapper.createDiv({ cls: "ft-action-cards-grid" });

		// Card 1: Import a CSV
		this.renderActionCard(grid, {
			icon: "file-input",
			title: "Import a CSV",
			description: "Drop a CSV into your vault and configure an import to create structured notes",
			onClick: () => this.deps.navigation.navigateTo("imports"),
		});

		// Card 2: Create a Pipeline
		this.renderActionCard(grid, {
			icon: "workflow",
			title: "Create a Pipeline",
			description: "Chain multiple CSV sources into an automated import-export workflow",
			onClick: () => this.deps.navigation.navigateTo("pipelines"),
		});
	}

	private renderActionCard(
		container: HTMLElement,
		opts: { icon: string; title: string; description: string; onClick: () => void },
	): void {
		const card = container.createDiv({ cls: "ft-stat-card ft-action-card" });

		const titleRow = card.createDiv({ cls: "ft-action-card-title" });
		const iconEl = titleRow.createSpan();
		setIcon(iconEl, opts.icon);
		iconEl.addClass("ft-action-card-icon");
		titleRow.createSpan({ text: opts.title });

		card.createDiv({ text: opts.description, cls: "ft-text-xs ft-text-muted" });

		card.addEventListener("click", opts.onClick);
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

		const section = container.createDiv({ cls: "ft-section-mb" });
		this.renderSectionHeader(section, "book-open", "Data Dictionary", propCount + docCount + typeCount);

		const cards: StatCardItem[] = [
			{ icon: "shapes", value: String(typeCount), label: "Types", onClick: () => this.deps.navigation.navigateTo("types") },
			{ icon: "tag", value: String(propCount), label: "Properties", onClick: () => this.deps.navigation.navigateTo("properties") },
			{ icon: "file-spreadsheet", value: `${docCount} / ${csvCount}`, label: "Reports", onClick: () => this.deps.navigation.navigateTo("reports") },
		];

		renderStatGrid(section, cards, 3);
	}

	// ─────────────────────────────────────────────────────────
	// Active operations (state-backed, survives re-render)
	// ─────────────────────────────────────────────────────────

	private renderActiveOperations(container: HTMLElement, operations: ActiveOperation[]): void {
		const section = container.createDiv({ cls: "ft-section-mb" });
		this.renderSectionHeader(section, "activity", "Active Operations", operations.filter((o) => !o.completed).length);

		for (const op of operations) {
			const card = section.createDiv({ cls: "ft-card ft-mb-2" });
			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });

			if (op.completed) {
				const icon = row.createSpan();
				setIcon(icon, op.success ? "check-circle" : "x-circle");
				icon.addClass(op.success ? "ft-text-success" : "ft-text-error");
				row.createSpan({ text: op.message ?? op.name, cls: "ft-text-sm" });
			} else {
				const spinner = row.createSpan();
				setIcon(spinner, "loader");
				spinner.addClass("ft-opacity-60");
				spinner.addClass("ft-spin");
				const statusText = row.createSpan({ cls: "ft-text-sm" });
				const typeLabel = op.type === "canvas-import" ? "Canvas Import" : op.type === "import" ? "Importing" : op.type === "export" ? "Exporting" : "Pipeline";
				if (op.progress) {
					const pct = op.progress.total > 0 ? Math.round((op.progress.current / op.progress.total) * 100) : 0;
					statusText.textContent = `${typeLabel}... ${op.progress.current} / ${op.progress.total} (${pct}%)`;
					if (op.progress.lastFilename) {
						statusText.textContent += ` — ${op.progress.lastFilename}`;
					}
				} else {
					statusText.textContent = `Running ${op.type}: ${op.name}...`;
				}

				// Progress bar
				const barBg = card.createDiv({ cls: "ft-progress-bar-track" });
				const barFill = barBg.createDiv({ cls: "ft-progress-bar-fill-animated" });
				const pct = op.progress && op.progress.total > 0
					? Math.round((op.progress.current / op.progress.total) * 100)
					: 0;
				barFill.style.width = `${pct}%`;

				this.attachLiveListeners(op, card, barFill, statusText);
			}
		}
	}

	/** Attach real-time event listeners to an active operation card. */
	private attachLiveListeners(
		op: ActiveOperation,
		card: HTMLElement,
		barFill: HTMLElement,
		statusText: HTMLElement,
	): void {
		const transitionToResult = (success: boolean, message: string) => {
			card.empty();
			const resultRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.addClass(success ? "ft-text-success" : "ft-text-error");
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });
		};

		if (op.type === "import") {
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.import.progress", (event) => {
					if (event.payload.operationId !== op.operationId) return;
					const { current, total, lastFilename } = event.payload;
					const livePct = total > 0 ? Math.round((current / total) * 100) : 0;
					barFill.style.width = `${livePct}%`;
					statusText.textContent = `Importing... ${current} / ${total} (${livePct}%)`;
					if (lastFilename) statusText.textContent += ` — ${lastFilename}`;
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.import.completed", (event) => {
					if (event.payload.operationId !== op.operationId) return;
					const r = event.payload.result;
					transitionToResult(true, `${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
						(r.failed > 0 ? `, ${r.failed} failed` : ""));
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.import.failed", (event) => {
					if (event.payload.operationId !== op.operationId) return;
					transitionToResult(false, `Failed: ${event.payload.error}`);
				}),
			);
		} else if (op.type === "export") {
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.export.completed", (event) => {
					if (event.payload.operationId !== op.operationId) return;
					const r = event.payload.result;
					transitionToResult(true, `${r.totalRows} rows → ${r.outputPath}`);
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.export.failed", (event) => {
					if (event.payload.operationId !== op.operationId) return;
					transitionToResult(false, `Failed: ${event.payload.error}`);
				}),
			);
		} else if (op.type === "pipeline") {
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.pipeline.sourceCompleted", (event) => {
					if (event.payload.pipelineId !== op.operationId) return;
					const { sourceIndex, totalSources, sourceResult } = event.payload;
					const livePct = totalSources > 0 ? Math.round(((sourceIndex + 1) / totalSources) * 100) : 0;
					barFill.style.width = `${livePct}%`;
					const csvName = sourceResult.csvPath.split("/").pop() ?? sourceResult.csvPath;
					statusText.textContent = `Pipeline: source ${sourceIndex + 1} / ${totalSources} — ${csvName}`;
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.import.progress", (event) => {
					if (event.payload.pipelineId !== op.operationId) return;
					const { current, total, lastFilename } = event.payload;
					statusText.textContent = `Pipeline: row ${current} / ${total}`;
					if (lastFilename) statusText.textContent += ` — ${lastFilename}`;
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.export.started", (event) => {
					if (event.payload.pipelineId !== op.operationId) return;
					barFill.addClass("ft-w-full");
					statusText.textContent = `Pipeline: running export...`;
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.pipeline.completed", (event) => {
					const r = event.payload.result;
					transitionToResult(true, `${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
						(r.failed > 0 ? `, ${r.failed} failed` : ""));
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("dataExchange.pipeline.failed", (event) => {
					if (event.payload.pipelineId !== op.operationId) return;
					transitionToResult(false, `Failed: ${event.payload.error}`);
				}),
			);
		} else if (op.type === "canvas-import") {
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("canvas.import.progress", (event) => {
					const opId = `canvas:${event.payload.canvasPath}`;
					if (opId !== op.operationId) return;
					const { current, total, title } = event.payload;
					const livePct = total > 0 ? Math.round((current / total) * 100) : 0;
					barFill.style.width = `${livePct}%`;
					statusText.textContent = `Canvas Import... ${current} / ${total} (${livePct}%)`;
					if (title) statusText.textContent += ` — ${title}`;
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("canvas.import.completed", (event) => {
					const r = event.payload.result;
					const opId = `canvas:${r.canvasPath}`;
					if (opId !== op.operationId) return;
					transitionToResult(true, `${r.imported} imported, ${r.skipped} skipped` +
						(r.errors.length > 0 ? `, ${r.errors.length} errors` : ""));
				}),
			);
			this.liveUnsubscribes.push(
				this.deps.eventBus.on("canvas.import.failed", (event) => {
					const opId = `canvas:${event.payload.canvasPath}`;
					if (opId !== op.operationId) return;
					transitionToResult(false, `Failed: ${event.payload.error}`);
				}),
			);
		}
	}

	// ─────────────────────────────────────────────────────────
	// Canvas import configs
	// ─────────────────────────────────────────────────────────

	private renderCanvasStats(container: HTMLElement): void {
		const state = this.deps.getState();
		const count = state.canvasConfigs.length;
		if (count === 0) return;

		const section = container.createDiv({ cls: "ft-section-mb" });
		this.renderSectionHeader(section, "layout-dashboard", "Canvas Imports", count);

		const cards: StatCardItem[] = [
			{ icon: "layout-dashboard", value: String(count), label: "Saved Configs", onClick: () => this.deps.navigation.navigateTo("canvas") },
		];

		renderStatGrid(section, cards, 3);
	}

	cleanupLiveListeners(): void {
		for (const unsub of this.liveUnsubscribes) unsub();
		this.liveUnsubscribes = [];
	}
}
