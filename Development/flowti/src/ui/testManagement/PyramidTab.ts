/**
 * Pyramid tab — 3-layer test pyramid visualization for the Test Management Hub.
 *
 * Master panel: layer cards (E2E, Flow, Unit) with counts, pass rates, trends.
 * Detail panel: drill-down list for selected layer.
 */

import { setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { PyramidLayer, TrendDirection } from "../../domain/testManagement/types";
import { deriveJourneyStatus } from "../../domain/testManagement/journeyParser";

// ── Types ───────────────────────────────────────────────────

export interface PyramidTabDeps {
	testManagementService: TestManagementService;
	eventBus: IEventBus;
}

type LayerId = "e2e" | "flow" | "unit";

interface LayerDef {
	id: LayerId;
	label: string;
	icon: string;
	countLabel: string;
}

const LAYERS: LayerDef[] = [
	{ id: "e2e", label: "E2E Journeys", icon: "route", countLabel: "journeys" },
	{ id: "flow", label: "Flow Suites", icon: "git-branch", countLabel: "suites" },
	{ id: "unit", label: "Unit Suites", icon: "box", countLabel: "suites" },
];

// ── Component ───────────────────────────────────────────────

export class PyramidTab {
	private selectedLayer: LayerId = "e2e";

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: PyramidTabDeps,
	) {}

	render(filterText: string): void {
		this.masterEl.empty();
		this.detailEl.empty();

		const pyramid = this.deps.testManagementService.getPyramidWithTrends();
		const hasBaseline = !!this.deps.testManagementService.getBaseline();

		this.renderLayerCards(pyramid, hasBaseline);
		this.renderDrillDown(filterText);
	}

	resetSelection(): void {
		this.selectedLayer = "e2e";
	}

	// ── Master panel — layer cards ──────────────────────────

	private renderLayerCards(
		pyramid: { e2e: PyramidLayer; flow: PyramidLayer; unit: PyramidLayer },
		hasBaseline: boolean,
	): void {
		const cards = this.masterEl.createDiv({ cls: "ft-tm-pyramid-cards" });

		for (const def of LAYERS) {
			const layer = pyramid[def.id];
			this.renderLayerCard(cards, def, layer, hasBaseline);
		}

		// Set Baseline button
		const footer = this.masterEl.createDiv({ cls: "ft-tm-pyramid-footer" });
		const btn = footer.createEl("button", { text: "Set baseline", cls: "mod-cta" });
		btn.addEventListener("click", () => {
			this.deps.testManagementService.setBaseline();
			this.render("");
		});
	}

	private renderLayerCard(
		container: HTMLElement,
		def: LayerDef,
		layer: PyramidLayer,
		hasBaseline: boolean,
	): void {
		const isActive = this.selectedLayer === def.id;
		const isDimmed = layer.count === 0 && def.id !== "e2e";

		const cls = [
			"ft-tm-pyramid-card",
			isActive ? "ft-tm-pyramid-card--active" : "",
			isDimmed ? "ft-tm-pyramid-card--dimmed" : "",
		].filter(Boolean).join(" ");

		const card = container.createDiv({ cls });
		card.dataset.layerId = def.id;

		// Icon
		const iconEl = card.createDiv({ cls: "ft-tm-pyramid-card-icon" });
		setIcon(iconEl, def.icon);

		// Info: label + stats
		const info = card.createDiv({ cls: "ft-tm-pyramid-card-info" });
		info.createDiv({ text: def.label, cls: "ft-tm-pyramid-card-label" });

		const stats = info.createDiv({ cls: "ft-tm-pyramid-card-stats" });
		stats.createSpan({ text: `${layer.count} ${def.countLabel}` });
		stats.createSpan({ text: ` · ${layer.passRate}% pass rate` });

		if (hasBaseline) {
			this.renderTrendIcon(stats, layer.trend);
		}

		// Progress bar
		const barBg = card.createDiv({ cls: "ft-tm-pyramid-bar-bg" });
		const bar = barBg.createDiv({ cls: `ft-tm-pyramid-bar ft-tm-pyramid-bar--${def.id}` });
		bar.style.width = `${layer.passRate}%`;

		card.addEventListener("click", () => {
			this.selectedLayer = def.id;
			this.detailEl.empty();
			this.renderDrillDown("");
			this.highlightActiveCard();
		});
	}

	private renderTrendIcon(container: HTMLElement, trend: TrendDirection): void {
		const icons: Record<TrendDirection, string> = { up: "↑", down: "↓", stable: "→" };
		container.createSpan({ text: ` ${icons[trend]}`, cls: `ft-tm-trend ft-tm-trend--${trend}` });
	}

	private highlightActiveCard(): void {
		const cards = Array.from(this.masterEl.querySelectorAll(".ft-tm-pyramid-card"));
		for (const card of cards) {
			const el = card as HTMLElement;
			if (el.dataset.layerId === this.selectedLayer) {
				el.classList.add("ft-tm-pyramid-card--active");
			} else {
				el.classList.remove("ft-tm-pyramid-card--active");
			}
		}
	}

	// ── Detail panel — drill-down ───────────────────────────

	private renderDrillDown(filterText: string): void {
		this.detailEl.empty();

		if (this.selectedLayer === "e2e") {
			this.renderE2eDrillDown(filterText);
		} else {
			const pyramid = this.deps.testManagementService.getPyramid();
			const layer = pyramid[this.selectedLayer];
			if (layer.count > 0) {
				this.renderLayerSummary(this.selectedLayer, layer);
			} else {
				this.renderGuidanceCallout(this.selectedLayer);
			}
		}
	}

	private renderE2eDrillDown(filterText: string): void {
		const journeys = this.deps.testManagementService.getJourneys();

		let filtered = journeys;
		if (filterText) {
			const lower = filterText.toLowerCase();
			filtered = journeys.filter((j) =>
				j.name.toLowerCase().includes(lower)
				|| (j.domain ?? "").toLowerCase().includes(lower),
			);
		}

		if (filtered.length === 0) {
			this.renderEmptyDrillDown();
			return;
		}

		const header = this.detailEl.createDiv({ cls: "ft-tm-detail-section" });
		header.createDiv({ text: `E2E Journeys (${filtered.length})`, cls: "ft-tm-detail-section-title" });

		for (const journey of filtered) {
			const status = deriveJourneyStatus(journey);
			const row = header.createDiv({ cls: "ft-tm-pyramid-drilldown-row" });

			// Status badge
			row.createDiv({ cls: `ft-tm-status-badge ft-tm-status-badge--${status}` });

			// Name
			row.createDiv({ text: journey.name, cls: "ft-tm-pyramid-drilldown-name" });

			// Type badge
			row.createDiv({ text: journey.type, cls: "ft-tm-type-badge" });

			// Pass/fail stats
			const latest = journey.lastRunResult;
			if (latest) {
				row.createDiv({
					text: `${latest.passed}/${latest.totalSteps} passed`,
					cls: "ft-tm-pyramid-drilldown-stats",
				});
			}
		}
	}

	private renderLayerSummary(layerId: LayerId, layer: PyramidLayer): void {
		const def = LAYERS.find((l) => l.id === layerId)!;
		const section = this.detailEl.createDiv({ cls: "ft-tm-detail-section" });
		section.createDiv({ text: `${def.label} (${layer.count})`, cls: "ft-tm-detail-section-title" });

		const stats = section.createDiv({ cls: "ft-tm-pyramid-drilldown-row" });
		const iconEl = stats.createDiv({ cls: "ft-tm-pyramid-card-icon" });
		setIcon(iconEl, def.icon);
		const info = stats.createDiv({ cls: "ft-tm-pyramid-card-info" });
		info.createDiv({ text: `${layer.count} ${def.countLabel}`, cls: "ft-tm-pyramid-drilldown-name" });
		info.createDiv({ text: `${layer.passRate}% pass rate`, cls: "ft-tm-pyramid-drilldown-stats" });

		const note = section.createDiv({ cls: "ft-text-sm ft-text-muted ft-mt-1" });
		note.textContent = layerId === "flow"
			? "Flow integration tests from tests/flows/. Metrics sourced from vitest report."
			: "Unit and component tests. Metrics sourced from vitest report.";
	}

	private renderGuidanceCallout(layerId: LayerId): void {
		const label = LAYERS.find((l) => l.id === layerId)?.label ?? layerId;
		const guidance = this.detailEl.createDiv({ cls: "ft-tm-pyramid-guidance" });

		const iconEl = guidance.createDiv({ cls: "ft-tm-pyramid-guidance-icon" });
		setIcon(iconEl, layerId === "flow" ? "git-branch" : "box");

		guidance.createDiv({ text: label, cls: "ft-heading ft-heading-sm ft-mb-1" });
		guidance.createDiv({
			text: "This layer requires Expert mode (vitest detected) to populate metrics.",
			cls: "ft-text-sm ft-text-muted",
		});
	}

	private renderEmptyDrillDown(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-tm-pyramid-guidance" });
		const iconEl = empty.createDiv({ cls: "ft-tm-pyramid-guidance-icon" });
		setIcon(iconEl, "route");
		empty.createDiv({ text: "No test data", cls: "ft-heading ft-heading-sm ft-mb-1" });
		empty.createDiv({ text: "Register journeys to populate the test pyramid.", cls: "ft-text-sm ft-text-muted" });
	}
}
