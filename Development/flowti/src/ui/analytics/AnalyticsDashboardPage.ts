/**
 * Dashboard page for the Analytics Hub.
 *
 * Shows overview stats (query count, dashboard count) and quick actions.
 */

import { setIcon } from "obsidian";
import type { AnalyticsHubDeps } from "./types";

export class AnalyticsDashboardPage {
	constructor(
		private containerEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	render(): void {
		this.containerEl.empty();

		const state = this.deps.getState();
		const queryCount = state.queries.length;
		const dashboardCount = state.dashboards.length;

		// Stats grid
		const statsGrid = this.containerEl.createDiv({ cls: "ft-stats-grid" });
		this.renderStat(statsGrid, "search", "Saved Queries", String(queryCount), "queries");
		this.renderStat(statsGrid, "layout-grid", "Dashboards", String(dashboardCount), "dashboards");

		// Quick actions
		const actions = this.containerEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		const newQueryLink = actions.createEl("span", { cls: "ft-nav-link" });
		const qIcon = newQueryLink.createSpan();
		setIcon(qIcon, "plus");
		newQueryLink.appendText(" New Query");
		newQueryLink.addEventListener("click", () => {
			this.deps.navigation.navigateTo("queries");
		});

		const newDashLink = actions.createEl("span", { cls: "ft-nav-link" });
		const dIcon = newDashLink.createSpan();
		setIcon(dIcon, "layout-grid");
		newDashLink.appendText(" New Dashboard");
		newDashLink.style.pointerEvents = "none";
		newDashLink.style.opacity = "0.5";
		newDashLink.setAttribute("title", "Coming soon");
	}

	private renderStat(container: HTMLElement, icon: string, label: string, value: string, tabId: string): void {
		const card = container.createDiv({ cls: "ft-stat-card" });
		card.style.cursor = "pointer";
		card.addEventListener("click", () => {
			this.deps.navigation.navigateTo(tabId as "queries" | "dashboards");
		});

		const iconEl = card.createDiv({ cls: "ft-stat-icon" });
		setIcon(iconEl, icon);

		const valEl = card.createDiv({ cls: "ft-stat-value" });
		valEl.textContent = value;

		const labelEl = card.createDiv({ cls: "ft-stat-label" });
		labelEl.textContent = label;
	}
}
