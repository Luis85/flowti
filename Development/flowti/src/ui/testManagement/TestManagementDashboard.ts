/**
 * Dashboard renderer for the Test Management Hub.
 *
 * Renders KPI stat cards, mini pyramid visualization,
 * recent run history, and a "needs attention" section.
 * All data sourced from TestManagementService queries.
 */

import { setIcon } from "obsidian";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import { deriveJourneyStatus } from "../../domain/testManagement/journeyParser";
import type { JourneyRegistryEntry } from "../../domain/testManagement/types";
import { renderStatGrid } from "../shared/StatCard";

export interface TestManagementDashboardDeps {
	testManagementService: TestManagementService;
	navigateTo: (page: string) => void;
}

export class TestManagementDashboard {
	constructor(private deps: TestManagementDashboardDeps) {}

	render(container: HTMLElement): void {
		container.empty();

		const journeys = this.deps.testManagementService.getJourneys();

		if (journeys.length === 0) {
			this.renderEmptyState(container);
			return;
		}

		const passing = journeys.filter((j) => deriveJourneyStatus(j) === "passing").length;
		const pyramid = this.deps.testManagementService.getPyramid();
		const compliance = this.deps.testManagementService.getCompliance();
		const avgCompliance = compliance.length > 0
			? Math.round(compliance.reduce((sum, s) => sum + s.percentage, 0) / compliance.length)
			: 0;

		// 1. KPI stat cards
		renderStatGrid(container, [
			{ icon: "route", value: String(journeys.length), label: "Journeys", onClick: () => this.deps.navigateTo("journeys") },
			{ icon: "check-circle", value: String(passing), label: "Passing", onClick: () => this.deps.navigateTo("journeys") },
			{ icon: "triangle", value: `${pyramid.e2e.count}/${pyramid.flow.count}/${pyramid.unit.count}`, label: "Pyramid", onClick: () => this.deps.navigateTo("pyramid") },
			{ icon: "shield", value: `${avgCompliance}%`, label: "Compliance", onClick: () => this.deps.navigateTo("compliance") },
		], 4);

		// 2. Mini pyramid
		this.renderMiniPyramid(container, pyramid);

		// 3. Recent runs
		this.renderRecentRuns(container, journeys);

		// 4. Needs attention
		this.renderNeedsAttention(container, journeys);
	}

	private renderEmptyState(container: HTMLElement): void {
		const empty = container.createDiv({ cls: "ft-tm-empty" });
		const iconEl = empty.createDiv({ cls: "ft-tm-empty-icon" });
		setIcon(iconEl, "shield-check");
		empty.createDiv({ text: "No journeys registered", cls: "ft-heading ft-heading-sm ft-mb-1" });
		empty.createDiv({ text: "Register journeys from the Journey Builder to see your test management dashboard.", cls: "ft-text-sm ft-text-muted" });
	}

	private renderMiniPyramid(container: HTMLElement, pyramid: ReturnType<TestManagementService["getPyramid"]>): void {
		const section = container.createDiv({ cls: "ft-tm-section" });
		section.createDiv({ text: "Test Pyramid", cls: "ft-tm-section-title" });

		const pyramidEl = section.createDiv({ cls: "ft-tm-pyramid-section" });
		const layers = [
			{ label: "E2E", count: pyramid.e2e.count, passRate: pyramid.e2e.passRate, cls: "ft-tm-pyramid-bar--e2e" },
			{ label: "Flow", count: pyramid.flow.count, passRate: pyramid.flow.passRate, cls: "ft-tm-pyramid-bar--flow" },
			{ label: "Unit", count: pyramid.unit.count, passRate: pyramid.unit.passRate, cls: "ft-tm-pyramid-bar--unit" },
		];

		for (const layer of layers) {
			const row = pyramidEl.createDiv({ cls: "ft-tm-pyramid-row" });
			row.createDiv({ text: layer.label, cls: "ft-tm-pyramid-label" });
			const barBg = row.createDiv({ cls: "ft-tm-pyramid-bar-bg" });
			const bar = barBg.createDiv({ cls: `ft-tm-pyramid-bar ${layer.cls}` });
			bar.style.width = `${layer.passRate}%`;
			row.createDiv({ text: `${layer.count} (${layer.passRate}%)`, cls: "ft-tm-pyramid-count" });
		}
	}

	private renderRecentRuns(container: HTMLElement, journeys: JourneyRegistryEntry[]): void {
		const withRuns = journeys.filter((j) => j.lastRunResult);
		if (withRuns.length === 0) return;

		const sorted = [...withRuns]
			.sort((a, b) => (b.lastRunResult!.date ?? "").localeCompare(a.lastRunResult!.date ?? ""))
			.slice(0, 5);

		const section = container.createDiv({ cls: "ft-tm-section" });
		section.createDiv({ text: "Recent Runs", cls: "ft-tm-section-title" });

		const list = section.createDiv({ cls: "ft-tm-recent-runs" });
		for (const journey of sorted) {
			const run = journey.lastRunResult!;
			const status = deriveJourneyStatus(journey);

			const item = list.createDiv({ cls: "ft-tm-run-item" });
			item.createDiv({ cls: `ft-tm-status-badge ft-tm-status-badge--${status}` });
			item.createDiv({ text: journey.name, cls: "ft-tm-run-name" });
			item.createDiv({
				text: `${run.passed}/${run.totalSteps} passed`,
				cls: "ft-tm-run-stats",
			});
		}
	}

	private renderNeedsAttention(container: HTMLElement, journeys: JourneyRegistryEntry[]): void {
		const attention = journeys.filter((j) => {
			const status = deriveJourneyStatus(j);
			return status === "failing" || status === "stale";
		});

		if (attention.length === 0) return;

		const section = container.createDiv({ cls: "ft-tm-section" });
		section.createDiv({ text: "Needs Attention", cls: "ft-tm-section-title" });

		const list = section.createDiv({ cls: "ft-tm-attention-section" });
		for (const journey of attention) {
			const status = deriveJourneyStatus(journey);
			const item = list.createDiv({ cls: "ft-tm-attention-item" });

			const iconEl = item.createSpan();
			setIcon(iconEl, status === "failing" ? "alert-circle" : "clock");
			item.createSpan({ text: journey.name });
			item.createSpan({ text: status === "failing" ? "Failing" : "Stale", cls: "ft-text-xs ft-text-muted" });

			item.addEventListener("click", () => this.deps.navigateTo("journeys"));
		}
	}
}
