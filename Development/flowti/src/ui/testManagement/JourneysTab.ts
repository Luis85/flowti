/**
 * Journeys tab — master/detail renderer for the Test Management Hub.
 *
 * Master panel: filtered journey list with status/type badges.
 * Detail panel: header, run history, traceability (actors/services/tools), file links.
 */

import { setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { JourneyRegistryEntry, JourneyStatus, JourneyType } from "../../domain/testManagement/types";
import { deriveJourneyStatus } from "../../domain/testManagement/journeyParser";

// ── Types ───────────────────────────────────────────────────

export interface JourneysTabDeps {
	testManagementService: TestManagementService;
	eventBus: IEventBus;
}

export interface JourneysTabFilters {
	typeFilter: JourneyType | "all";
	statusFilter: JourneyStatus | "all";
}

// ── Component ───────────────────────────────────────────────

export class JourneysTab {
	private selectedJourneyName: string | null = null;
	private filters: JourneysTabFilters = { typeFilter: "all", statusFilter: "all" };

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: JourneysTabDeps,
	) {}

	setFilters(filters: Partial<JourneysTabFilters>): void {
		Object.assign(this.filters, filters);
	}

	resetSelection(): void {
		this.selectedJourneyName = null;
		this.filters = { typeFilter: "all", statusFilter: "all" };
	}

	/** Pre-select a journey by name (used by cross-hub navigation). */
	selectByName(name: string): void {
		this.selectedJourneyName = name;
	}

	render(filterText: string): void {
		const journeys = this.deps.testManagementService.getJourneys();
		const filtered = this.applyFilters(journeys, filterText);

		this.masterEl.empty();
		this.detailEl.empty();

		if (filtered.length === 0) {
			this.renderEmptyState();
			return;
		}

		this.renderMasterList(filtered);

		// Auto-select: previously selected or first
		const selected = filtered.find((j) => j.name === this.selectedJourneyName) ?? filtered[0];
		this.selectedJourneyName = selected.name;
		this.renderDetail(selected);
		this.highlightSelectedRow();
	}

	// ── Master list ─────────────────────────────────────────

	private renderMasterList(journeys: JourneyRegistryEntry[]): void {
		for (const journey of journeys) {
			this.renderJourneyRow(this.masterEl, journey);
		}
	}

	private renderJourneyRow(container: HTMLElement, journey: JourneyRegistryEntry): HTMLElement {
		const status = deriveJourneyStatus(journey);
		const isSelected = journey.name === this.selectedJourneyName;

		const row = container.createDiv({
			cls: `ft-list-item ft-px-3 ft-py-2 ft-cursor-pointer ft-tm-journey-row${isSelected ? " ft-list-item-active" : ""}`,
		});
		row.dataset.journeyName = journey.name;

		// Status badge
		row.createDiv({ cls: `ft-tm-status-badge ft-tm-status-badge--${status}` });

		// Name
		row.createDiv({ text: journey.name, cls: "ft-tm-journey-name" });

		// Type badge
		row.createDiv({ text: journey.type, cls: "ft-tm-type-badge" });

		// Step count
		row.createDiv({ text: `${journey.stepCount} steps`, cls: "ft-tm-step-count" });

		// Last run date
		if (journey.lastRunResult?.date) {
			const date = journey.lastRunResult.date.slice(0, 10);
			row.createDiv({ text: date, cls: "ft-tm-run-date" });
		}

		row.addEventListener("click", () => {
			this.selectedJourneyName = journey.name;
			this.detailEl.empty();
			this.renderDetail(journey);
			this.highlightSelectedRow();
		});

		return row;
	}

	private highlightSelectedRow(): void {
		const rows = Array.from(this.masterEl.querySelectorAll(".ft-list-item"));
		for (const row of rows) {
			const el = row as HTMLElement;
			if (el.dataset.journeyName === this.selectedJourneyName) {
				el.classList.add("ft-list-item-active");
			} else {
				el.classList.remove("ft-list-item-active");
			}
		}
	}

	// ── Detail panel ────────────────────────────────────────

	private renderDetail(journey: JourneyRegistryEntry): void {
		this.renderDetailHeader(this.detailEl, journey);
		this.renderDetailActions(this.detailEl, journey);
		this.renderRunHistory(this.detailEl, journey);
		this.renderTraceability(this.detailEl, journey);
		this.renderFiles(this.detailEl, journey);
	}

	private renderDetailActions(container: HTMLElement, journey: JourneyRegistryEntry): void {
		const actions = container.createDiv({ cls: "ft-tm-detail-actions" });

		const openBtn = actions.createEl("button", { text: "Open in builder", cls: "ft-text-sm" });
		openBtn.dataset.testId = "tm-open-in-builder";
		openBtn.addEventListener("click", () => {
			void this.deps.eventBus.emit("ui.openJourneyBuilder", {});
			void this.deps.eventBus.emit("journey-builder.import-requested", { path: journey.jsonPath });
		});

		const reviewBtn = actions.createEl("button", { text: "Request review", cls: "ft-text-sm" });
		reviewBtn.dataset.testId = "tm-request-review";
		reviewBtn.addEventListener("click", () => {
			this.deps.testManagementService.requestReview(journey.name);
		});

		const runBtn = actions.createEl("button", { text: "Run journey", cls: "ft-text-sm" });
		runBtn.dataset.testId = "tm-run-journey";
		runBtn.addEventListener("click", () => {
			void this.deps.eventBus.emit("ui.runJourney", {
				journeyName: journey.name,
				jsonPath: journey.jsonPath,
				canvasPath: journey.canvasPath,
			});
		});
	}

	private renderDetailHeader(container: HTMLElement, journey: JourneyRegistryEntry): void {
		const header = container.createDiv({ cls: "ft-tm-detail-header" });
		header.createEl("h3", { text: journey.name });

		const meta = header.createDiv({ cls: "ft-tm-detail-meta" });
		const status = deriveJourneyStatus(journey);

		meta.createSpan({ cls: `ft-tm-status-badge ft-tm-status-badge--${status}` });
		meta.createSpan({ text: status, cls: "ft-tm-type-badge" });
		meta.createSpan({ text: journey.type, cls: "ft-tm-type-badge" });

		if (journey.domain) {
			meta.createSpan({ text: journey.domain });
		}
		if (journey.chapter !== undefined) {
			meta.createSpan({ text: `Ch. ${journey.chapter}` });
		}
		meta.createSpan({ text: `${journey.stepCount} steps` });
	}

	private renderRunHistory(container: HTMLElement, journey: JourneyRegistryEntry): void {
		const section = container.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({ text: "Run History", cls: "ft-tm-detail-section-title" });

		if (journey.runHistory.length === 0) {
			section.createDiv({ text: "No runs recorded", cls: "ft-text-sm ft-text-muted" });
			return;
		}

		const sorted = [...journey.runHistory].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

		for (const run of sorted) {
			const row = section.createDiv({ cls: "ft-tm-run-history-row" });

			// Date
			row.createDiv({ text: run.date?.slice(0, 10) ?? "—", cls: "ft-tm-run-date-col" });

			// Result badge + counts
			const resultEl = row.createDiv({ cls: "ft-tm-run-result-col" });
			resultEl.createSpan({ cls: `ft-tm-status-badge ft-tm-status-badge--${run.failed > 0 ? "failing" : "passing"}` });
			resultEl.createSpan({ text: ` ${run.passed}/${run.totalSteps} passed` });
			if (run.failed > 0) resultEl.createSpan({ text: `, ${run.failed} failed`, cls: "ft-text-muted" });
			if (run.skipped > 0) resultEl.createSpan({ text: `, ${run.skipped} skipped`, cls: "ft-text-muted" });

			// Duration
			const secs = Math.round(run.durationMs / 1000);
			row.createDiv({ text: `${secs}s`, cls: "ft-tm-run-duration-col" });
		}
	}

	private renderTraceability(container: HTMLElement, journey: JourneyRegistryEntry): void {
		const hasContent = journey.actors.length > 0
			|| journey.services.length > 0
			|| journey.tools.length > 0
			|| journey.complianceTags.length > 0
			|| journey.prd;

		if (!hasContent) return;

		const section = container.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({ text: "Traceability", cls: "ft-tm-detail-section-title" });

		if (journey.prd) {
			const prdRow = section.createDiv({ cls: "ft-text-sm ft-mb-1" });
			prdRow.createSpan({ text: "PRD: ", cls: "ft-text-muted" });
			prdRow.createSpan({ text: journey.prd });
		}

		this.renderChipGroup(section, "Actors", journey.actors);
		this.renderChipGroup(section, "Services", journey.services);
		this.renderChipGroup(section, "Tools", journey.tools);
		this.renderChipGroup(section, "Compliance", journey.complianceTags);
	}

	private renderFiles(container: HTMLElement, journey: JourneyRegistryEntry): void {
		const section = container.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({ text: "Files", cls: "ft-tm-detail-section-title" });

		this.renderFileLink(section, "file-json", "Journey JSON", journey.jsonPath);
		if (journey.canvasPath) this.renderFileLink(section, "layout-template", "Canvas", journey.canvasPath);
		if (journey.testSourcePath) this.renderFileLink(section, "file-code", "Test Source", journey.testSourcePath);
	}

	private renderFileLink(container: HTMLElement, icon: string, label: string, path: string): void {
		const row = container.createDiv({ cls: "ft-tm-file-link" });
		const iconEl = row.createSpan();
		setIcon(iconEl, icon);
		row.createSpan({ text: `${label}: ${path}` });
	}

	private renderChipGroup(container: HTMLElement, label: string, items: string[]): void {
		if (items.length === 0) return;
		const group = container.createDiv({ cls: "ft-mb-1" });
		group.createSpan({ text: `${label}: `, cls: "ft-text-sm ft-text-muted" });
		const chips = group.createSpan({ cls: "ft-tm-chips" });
		for (const item of items) {
			chips.createSpan({ text: item, cls: "ft-tm-chip" });
		}
	}

	// ── Empty state ─────────────────────────────────────────

	private renderEmptyState(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-tm-empty" });
		const iconEl = empty.createDiv({ cls: "ft-tm-empty-icon" });
		setIcon(iconEl, "route");
		empty.createDiv({ text: "No journeys found", cls: "ft-heading ft-heading-sm ft-mb-1" });
		empty.createDiv({ text: "Register journeys or adjust your filters.", cls: "ft-text-sm ft-text-muted" });
	}

	// ── Filtering ───────────────────────────────────────────

	private applyFilters(journeys: JourneyRegistryEntry[], filterText: string): JourneyRegistryEntry[] {
		let result = journeys;

		// Text search
		if (filterText) {
			const lower = filterText.toLowerCase();
			result = result.filter((j) =>
				j.name.toLowerCase().includes(lower)
				|| (j.domain ?? "").toLowerCase().includes(lower),
			);
		}

		// Type filter
		if (this.filters.typeFilter !== "all") {
			result = result.filter((j) => j.type === this.filters.typeFilter);
		}

		// Status filter
		if (this.filters.statusFilter !== "all") {
			result = result.filter((j) => deriveJourneyStatus(j) === this.filters.statusFilter);
		}

		return result;
	}
}
