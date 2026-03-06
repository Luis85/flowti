/**
 * Coverage tab — PRD-to-journey coverage matrix for the Test Management Hub.
 *
 * Master panel: PRD rows with coverage status badges (covered/partial/uncovered).
 * Detail panel: PRD info, linked journeys, domain coverage summary, gap analysis.
 */

import { setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { CoverageEntry, CoverageStatus } from "../../domain/testManagement/types";
import { computeDomainCoverage, findGaps } from "../../domain/testManagement/coverageCalculator";

// ── Types ───────────────────────────────────────────────────

export interface CoverageTabDeps {
	testManagementService: TestManagementService;
	eventBus: IEventBus;
}

// ── Component ───────────────────────────────────────────────

export class CoverageTab {
	private selectedPrdName: string | null = null;
	private allEntries: CoverageEntry[] = [];

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CoverageTabDeps,
	) {}

	resetSelection(): void {
		this.selectedPrdName = null;
	}

	render(filterText: string): void {
		const prds = this.deps.testManagementService.getPrds();
		this.allEntries = this.deps.testManagementService.getCoverage(prds);
		const filtered = this.applyFilter(this.allEntries, filterText);

		this.masterEl.empty();
		this.detailEl.empty();

		if (filtered.length === 0) {
			this.renderEmptyState();
			return;
		}

		this.renderMasterList(filtered);

		// Auto-select: previously selected or first
		const selected = filtered.find((e) => e.prdName === this.selectedPrdName) ?? filtered[0];
		this.selectedPrdName = selected.prdName;
		this.renderDetail(selected);
		this.highlightSelectedRow();
	}

	// ── Master list ─────────────────────────────────────────

	private renderMasterList(entries: CoverageEntry[]): void {
		for (const entry of entries) {
			this.renderPrdRow(this.masterEl, entry);
		}
	}

	private renderPrdRow(container: HTMLElement, entry: CoverageEntry): HTMLElement {
		const isSelected = entry.prdName === this.selectedPrdName;

		const row = container.createDiv({
			cls: `ft-list-item ft-px-3 ft-py-2 ft-cursor-pointer ft-tm-coverage-row${isSelected ? " ft-list-item-active" : ""}`,
		});
		row.dataset.prdName = entry.prdName;

		// Coverage status badge
		row.createDiv({ cls: `ft-tm-coverage-badge ft-tm-coverage-badge--${entry.status}` });

		// PRD name
		row.createDiv({ text: entry.prdName, cls: "ft-tm-coverage-name" });

		// Stage badge
		row.createDiv({ text: entry.prdStage, cls: "ft-tm-type-badge" });

		// Journey count
		row.createDiv({
			text: `${entry.journeyCount} ${entry.journeyCount === 1 ? "journey" : "journeys"}`,
			cls: "ft-tm-step-count",
		});

		row.addEventListener("click", () => {
			this.selectedPrdName = entry.prdName;
			this.detailEl.empty();
			this.renderDetail(entry);
			this.highlightSelectedRow();
		});

		return row;
	}

	private highlightSelectedRow(): void {
		const rows = Array.from(this.masterEl.querySelectorAll(".ft-list-item"));
		for (const row of rows) {
			const el = row as HTMLElement;
			if (el.dataset.prdName === this.selectedPrdName) {
				el.classList.add("ft-list-item-active");
			} else {
				el.classList.remove("ft-list-item-active");
			}
		}
	}

	// ── Detail panel ────────────────────────────────────────

	private renderDetail(entry: CoverageEntry): void {
		this.renderDetailHeader(this.detailEl, entry);
		this.renderLinkedJourneys(this.detailEl, entry);
		this.renderDomainSummary(this.detailEl, this.allEntries);
		this.renderGapsSummary(this.detailEl, this.allEntries);
	}

	private renderDetailHeader(container: HTMLElement, entry: CoverageEntry): void {
		const header = container.createDiv({ cls: "ft-tm-detail-header" });
		header.createEl("h3", { text: entry.prdName });

		const meta = header.createDiv({ cls: "ft-tm-detail-meta" });

		meta.createSpan({ cls: `ft-tm-coverage-badge ft-tm-coverage-badge--${entry.status}` });
		meta.createSpan({ text: this.statusLabel(entry.status), cls: "ft-tm-type-badge" });
		meta.createSpan({ text: entry.prdStage, cls: "ft-tm-type-badge" });
		meta.createSpan({ text: entry.domain });
		meta.createSpan({
			text: `${entry.journeyCount} ${entry.journeyCount === 1 ? "journey" : "journeys"}`,
		});
	}

	private renderLinkedJourneys(container: HTMLElement, entry: CoverageEntry): void {
		const section = container.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({
			text: `Linked journeys (${entry.journeyCount})`,
			cls: "ft-tm-detail-section-title",
		});

		if (entry.journeyNames.length === 0) {
			section.createDiv({
				text: "No journeys linked to this PRD",
				cls: "ft-text-sm ft-text-muted",
			});
			return;
		}

		for (const name of entry.journeyNames) {
			section.createDiv({
				text: name,
				cls: "ft-text-sm ft-py-1",
			});
		}
	}

	private renderDomainSummary(container: HTMLElement, entries: CoverageEntry[]): void {
		const section = container.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({ text: "Domain coverage", cls: "ft-tm-detail-section-title" });

		const domainCoverage = computeDomainCoverage(entries);
		const domains = Object.keys(domainCoverage).sort();

		if (domains.length === 0) {
			section.createDiv({ text: "No domain data", cls: "ft-text-sm ft-text-muted" });
			return;
		}

		for (const domain of domains) {
			const { total, covered } = domainCoverage[domain];
			const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

			const row = section.createDiv({ cls: "ft-tm-domain-row" });
			row.createDiv({ text: domain, cls: "ft-tm-domain-label" });

			const barBg = row.createDiv({ cls: "ft-tm-domain-bar-bg" });
			const bar = barBg.createDiv({ cls: "ft-tm-domain-bar" });
			bar.style.width = `${pct}%`;

			row.createDiv({ text: `${covered}/${total}`, cls: "ft-tm-domain-stat" });
		}
	}

	private renderGapsSummary(container: HTMLElement, entries: CoverageEntry[]): void {
		const section = container.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({ text: "Coverage gaps", cls: "ft-tm-detail-section-title" });

		const gaps = findGaps(entries);

		if (gaps.length === 0) {
			section.createDiv({
				text: "All active PRDs have test coverage",
				cls: "ft-text-sm ft-text-muted",
			});
			return;
		}

		for (const gap of gaps) {
			const row = section.createDiv({ cls: "ft-tm-gap-row" });
			row.createDiv({ cls: "ft-tm-coverage-badge ft-tm-coverage-badge--uncovered" });
			row.createDiv({ text: gap.prdName, cls: "ft-tm-coverage-name" });
			row.createDiv({ text: gap.prdStage, cls: "ft-tm-type-badge" });
		}
	}

	// ── Empty state ─────────────────────────────────────────

	private renderEmptyState(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-tm-empty" });
		const iconEl = empty.createDiv({ cls: "ft-tm-empty-icon" });
		setIcon(iconEl, "check-circle");
		empty.createDiv({ text: "No PRDs found", cls: "ft-heading ft-heading-sm ft-mb-1" });
		empty.createDiv({
			text: "PRD files with type: ProductRequirementsDocument frontmatter will appear here. Configure the features folder in settings.",
			cls: "ft-text-sm ft-text-muted",
		});
	}

	// ── Filtering ───────────────────────────────────────────

	private applyFilter(entries: CoverageEntry[], filterText: string): CoverageEntry[] {
		if (!filterText) return entries;
		const lower = filterText.toLowerCase();
		return entries.filter((e) =>
			e.prdName.toLowerCase().includes(lower)
			|| e.domain.toLowerCase().includes(lower),
		);
	}

	// ── Helpers ─────────────────────────────────────────────

	private statusLabel(status: CoverageStatus): string {
		return status === "covered" ? "Covered" : status === "partial" ? "Partial" : "Uncovered";
	}
}
