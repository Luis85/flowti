/**
 * Analytics section for the CsvLanding page.
 * Shows saved analytics queries that reference this CSV file,
 * with navigation to the Analytics Hub.
 */

import { setIcon } from "obsidian";
import type { CsvComponentDeps } from "./types";
import { formatRelativeTime } from "../../domain/analytics/freshnessUtils";
import { getFreshnessColor, getFreshnessLevel } from "../../domain/analytics/freshnessUtils";

export class CsvAnalyticsSection {
	constructor(private deps: CsvComponentDeps) {}

	render(container: HTMLElement): void {
		const file = this.deps.getFile();
		if (!file || !this.deps.getQueriesBySource) return;

		const queries = this.deps.getQueriesBySource(file.path);

		const section = container.createDiv({ cls: "ft-mb-3" });
		section.createEl("h3", { text: "Analytics", cls: "ft-heading ft-heading-sm ft-mb-2" });

		if (queries.length > 0) {
			const card = section.createDiv({ cls: "ft-card ft-mb-2" });
			const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			const icon = headerRow.createSpan();
			setIcon(icon, "bar-chart-2");
			icon.addClass("ft-icon-muted");
			headerRow.createSpan({ text: "Used by analytics", cls: "ft-text-sm" }).style.fontWeight = "500";

			for (const query of queries) {
				this.renderQueryRow(card, query);
			}
		} else {
			const emptyCard = section.createDiv({ cls: "ft-card ft-mb-2" });
			emptyCard.createDiv({
				text: "No analytics queries reference this file yet.",
				cls: "ft-text-sm ft-text-muted ft-mb-2",
			});
			if (this.deps.openAnalyticsHub) {
				const actionsRow = emptyCard.createDiv({ cls: "ft-flex ft-gap-2" });
				const createBtn = actionsRow.createEl("span", { cls: "ft-nav-link" });
				setIcon(createBtn.createSpan(), "bar-chart-2");
				createBtn.appendText(" Create Query");
				createBtn.addEventListener("click", () => {
					this.deps.openAnalyticsHub!("queries", file!.path);
				});
			}
		}
	}

	private renderQueryRow(
		container: HTMLElement,
		query: import("../../domain/analytics/types").SavedAnalyticsQuery,
	): void {
		const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		row.style.flexWrap = "wrap";

		// Query name
		const nameEl = row.createSpan({ text: query.name, cls: "ft-text-sm" });
		nameEl.style.fontWeight = "500";

		// Auto-summary from dimensions/measures
		const summary = this.buildAutoSummary(query);
		if (summary) {
			row.createSpan({ text: summary, cls: "ft-text-xs ft-text-muted" });
		}

		// Freshness
		if (query.lastRun) {
			const level = getFreshnessLevel(query.lastRun);
			const freshnessEl = row.createSpan({
				text: formatRelativeTime(query.lastRun),
				cls: "ft-text-xs",
			});
			freshnessEl.style.color = getFreshnessColor(level);
		}

		// Open in Analytics Hub link
		if (this.deps.openAnalyticsHub) {
			const openLink = row.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			const linkIcon = openLink.createSpan();
			setIcon(linkIcon, "external-link");
			linkIcon.style.width = "12px";
			linkIcon.style.height = "12px";
			openLink.appendText(" Open");
			openLink.addEventListener("click", () => {
				this.deps.openAnalyticsHub!("queries", query.id);
			});
		}
	}

	private buildAutoSummary(
		query: import("../../domain/analytics/types").SavedAnalyticsQuery,
	): string {
		if (query.description) return query.description;
		const parts: string[] = [];
		if (query.measures?.length) {
			const m = query.measures[0];
			parts.push(`${m.function}(${m.column})`);
		}
		if (query.dimensions?.length) {
			parts.push(`by ${query.dimensions[0].column}`);
		}
		return parts.join(" ");
	}
}
