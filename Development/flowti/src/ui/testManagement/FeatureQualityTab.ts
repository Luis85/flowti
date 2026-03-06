/**
 * Feature Quality tab — 5th tab in Test Management Hub.
 *
 * Master: feature list with quality badges (journey count, pass/fail, coverage).
 * Detail: linked journeys with run status, quality metrics.
 */

import { setIcon } from "obsidian";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { IEventBus } from "../../infrastructure/events/types";
import { computeFeatureQuality, type FeatureQuality } from "../../domain/testManagement/featureQualityCalculator";

export interface FeatureQualityTabDeps {
	testManagementService: TestManagementService;
	eventBus: IEventBus;
	/** Get known feature names. Optional — falls back to journeys' feature fields. */
	getFeatureNames?: () => string[];
}

export class FeatureQualityTab {
	private selectedFeature: string | null = null;
	private entries: FeatureQuality[] = [];

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: FeatureQualityTabDeps,
	) {}

	resetSelection(): void {
		this.selectedFeature = null;
	}

	render(filterText: string): void {
		const journeys = this.deps.testManagementService.getJourneys();

		// Collect feature names: explicit list or derived from journeys
		let featureNames: string[];
		if (this.deps.getFeatureNames) {
			featureNames = this.deps.getFeatureNames();
		} else {
			const names = new Set<string>();
			for (const j of journeys) {
				if (j.feature) names.add(j.feature);
				if (j.prd) names.add(j.prd);
			}
			featureNames = [...names];
		}

		this.entries = computeFeatureQuality(journeys, featureNames);

		const filtered = filterText
			? this.entries.filter((e) => e.featureName.toLowerCase().includes(filterText))
			: this.entries;

		this.masterEl.empty();
		this.detailEl.empty();

		if (this.entries.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-tm-empty" });
			empty.createDiv({ text: "No feature quality data", cls: "ft-tm-empty-title" });
			empty.createDiv({ text: "Add a \"feature\" field to your journey definitions to link tests to features.", cls: "ft-tm-empty-hint" });
			this.renderEmptyDetail();
			return;
		}

		if (filtered.length === 0) {
			this.masterEl.createDiv({ text: "No matching features", cls: "ft-tm-empty" });
			this.renderEmptyDetail();
			return;
		}

		// Auto-select
		if (!this.selectedFeature || !filtered.find((e) => e.featureName === this.selectedFeature)) {
			this.selectedFeature = filtered[0].featureName;
		}

		// Master list
		for (const entry of filtered) {
			const isActive = entry.featureName === this.selectedFeature;
			const row = this.masterEl.createDiv({
				cls: `ft-master-event-item${isActive ? " ft-master-event-selected" : ""}`,
			});
			row.dataset.featureName = entry.featureName;

			row.createSpan({ text: entry.featureName, cls: "ft-master-item-label" });

			// Pass rate badge
			const badge = row.createSpan({ cls: "ft-badge ft-badge-sm" });
			badge.textContent = `${entry.passRate}%`;
			if (entry.passRate >= 80) badge.classList.add("ft-badge-green");
			else if (entry.passRate >= 50) badge.classList.add("ft-badge-yellow");
			else badge.classList.add("ft-badge-red");

			// Journey count
			row.createSpan({ text: `${entry.journeyCount} journeys`, cls: "ft-master-item-meta" });

			row.addEventListener("click", () => {
				this.selectedFeature = entry.featureName;
				this.render(filterText);
			});
		}

		// Detail
		const selected = filtered.find((e) => e.featureName === this.selectedFeature);
		if (selected) {
			this.renderDetail(selected);
		}
	}

	private renderEmptyDetail(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });
		empty.createDiv({ text: "Select a feature to view quality details", cls: "ft-detail-placeholder" });
	}

	private renderDetail(entry: FeatureQuality): void {
		// Header
		const header = this.detailEl.createDiv({ cls: "ft-tm-detail-header" });
		const title = header.createEl("h3", { cls: "ft-detail-event-type" });
		title.textContent = entry.featureName;

		// Badges row
		const badges = header.createDiv({ cls: "ft-tm-badges" });
		const rateBadge = badges.createSpan({ cls: "ft-badge" });
		rateBadge.textContent = `${entry.passRate}% pass rate`;
		if (entry.passRate >= 80) rateBadge.classList.add("ft-badge-green");
		else if (entry.passRate >= 50) rateBadge.classList.add("ft-badge-yellow");
		else rateBadge.classList.add("ft-badge-red");

		const countBadge = badges.createSpan({ cls: "ft-badge" });
		countBadge.textContent = `${entry.journeyCount} journeys`;

		const stepsBadge = badges.createSpan({ cls: "ft-badge" });
		stepsBadge.textContent = `${entry.totalSteps} steps`;

		// Trend
		const trendBadge = badges.createSpan({ cls: "ft-badge" });
		const trendIcon = trendBadge.createSpan();
		switch (entry.trend) {
			case "improving":
				setIcon(trendIcon, "trending-up");
				trendBadge.appendText(" Improving");
				trendBadge.classList.add("ft-badge-green");
				break;
			case "degrading":
				setIcon(trendIcon, "trending-down");
				trendBadge.appendText(" Degrading");
				trendBadge.classList.add("ft-badge-red");
				break;
			case "stable":
				setIcon(trendIcon, "minus");
				trendBadge.appendText(" Stable");
				break;
			default:
				trendBadge.textContent = "No trend data";
				break;
		}

		// Linked journeys section
		const section = this.detailEl.createDiv({ cls: "ft-tm-detail-section" });
		section.createEl("h4", { text: "Linked journeys" });

		if (entry.journeyNames.length === 0) {
			section.createDiv({ text: "No journeys linked to this feature", cls: "ft-tm-empty-hint" });
			return;
		}

		const journeys = this.deps.testManagementService.getJourneys();
		const list = section.createDiv({ cls: "ft-tm-list" });

		for (const name of entry.journeyNames) {
			const journey = journeys.find((j) => j.name === name);
			const row = list.createDiv({ cls: "ft-catalog-row" });

			const nameSpan = row.createSpan({ cls: "ft-master-item-label" });
			nameSpan.textContent = name;

			if (journey) {
				const latest = journey.lastRunResult ?? journey.runHistory[journey.runHistory.length - 1];
				if (latest) {
					const statusBadge = row.createSpan({ cls: "ft-badge ft-badge-sm" });
					if (latest.failed > 0) {
						statusBadge.textContent = `${latest.passed}/${latest.totalSteps} passed`;
						statusBadge.classList.add("ft-badge-red");
					} else {
						statusBadge.textContent = "All passed";
						statusBadge.classList.add("ft-badge-green");
					}
				} else {
					row.createSpan({ text: "Never run", cls: "ft-master-item-meta" });
				}
			}
		}
	}
}
