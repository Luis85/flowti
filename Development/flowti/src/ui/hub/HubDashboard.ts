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

		// Section 1: Active Operations (top — most visible, rebuilt from state, live listeners)
		if (state.activeOperations.length > 0) {
			this.renderActiveOperations(this.dashboardEl, state.activeOperations);
		}

		// Section 2: Data Dictionary
		this.renderDictionaryStats(this.dashboardEl);

		// Section 3: Import Pipelines
		renderDashboardPipelines(this.dashboardEl, this.deps, this.renderSectionHeader.bind(this));

		// Section 4: Configured Imports
		renderConfiguredImports(this.dashboardEl, configuredCsv, this.deps, this.renderSectionHeader.bind(this));

		// Section 5: Configured Exports
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

	// ─────────────────────────────────────────────────────────
	// Active operations (state-backed, survives re-render)
	// ─────────────────────────────────────────────────────────

	private renderActiveOperations(container: HTMLElement, operations: ActiveOperation[]): void {
		const section = container.createDiv();
		section.style.marginBottom = "2rem";
		this.renderSectionHeader(section, "activity", "Active Operations", operations.filter((o) => !o.completed).length);

		for (const op of operations) {
			const card = section.createDiv({ cls: "ft-card ft-mb-2" });
			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });

			if (op.completed) {
				const icon = row.createSpan();
				setIcon(icon, op.success ? "check-circle" : "x-circle");
				icon.style.color = op.success ? "var(--text-success)" : "var(--text-error)";
				row.createSpan({ text: op.message ?? op.name, cls: "ft-text-sm" });
			} else {
				const spinner = row.createSpan();
				setIcon(spinner, "loader");
				spinner.style.opacity = "0.6";
				spinner.addClass("ft-spin");
				const statusText = row.createSpan({ cls: "ft-text-sm" });
				const typeLabel = op.type === "import" ? "Importing" : op.type === "export" ? "Exporting" : "Pipeline";
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
				const barBg = card.createDiv();
				barBg.style.cssText = "height:3px;background:var(--background-modifier-border);border-radius:2px;margin:0 0.5rem 0.5rem;overflow:hidden";
				const barFill = barBg.createDiv();
				const pct = op.progress && op.progress.total > 0
					? Math.round((op.progress.current / op.progress.total) * 100)
					: 0;
				barFill.style.cssText = `height:100%;width:${pct}%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease`;

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
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
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
					barFill.style.width = "100%";
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
		}
	}

	cleanupLiveListeners(): void {
		for (const unsub of this.liveUnsubscribes) unsub();
		this.liveUnsubscribes = [];
	}
}
