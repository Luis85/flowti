/**
 * DashboardQueryMap — collapsible summary of queries used by a dashboard.
 *
 * Shows all unique queries powering tiles with their source file basenames
 * and tile counts, giving the user immediate context about what data powers
 * the dashboard.
 */

import { setIcon } from "obsidian";
import type { SavedAnalyticsQuery } from "../../domain/analytics/types";
import { getFreshnessColor, getFreshnessLevel, formatRelativeTime } from "../../domain/analytics/freshnessUtils";

export interface QueryMapEntry {
	query: SavedAnalyticsQuery;
	tileCount: number;
	sourceBasenames: string[];
}

export class DashboardQueryMap {
	constructor(
		private container: HTMLElement,
		private entries: QueryMapEntry[],
		private collapsed: boolean,
		private callbacks: {
			onToggleCollapse: () => void;
			onViewQuery: (queryId: string) => void;
		},
	) {}

	render(): void {
		if (this.entries.length === 0) return;

		const uniqueSources = new Set<string>();
		for (const e of this.entries) {
			for (const s of e.sourceBasenames) uniqueSources.add(s);
		}

		const section = this.container.createDiv({ cls: "ft-mb-2" });

		// Header row with collapse toggle
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.cursor = "pointer";
		header.style.userSelect = "none";
		header.addEventListener("click", () => this.callbacks.onToggleCollapse());

		const chevron = header.createSpan();
		setIcon(chevron, this.collapsed ? "chevron-right" : "chevron-down");
		chevron.style.width = "14px";
		chevron.style.height = "14px";
		chevron.style.opacity = "0.6";

		header.createSpan({
			text: `Queries (${this.entries.length} ${this.entries.length === 1 ? "query" : "queries"} from ${uniqueSources.size} ${uniqueSources.size === 1 ? "source" : "sources"})`,
			cls: "ft-text-sm",
		}).style.fontWeight = "500";

		if (this.collapsed) return;

		// Query list
		const list = section.createDiv({ cls: "ft-mt-1" });
		list.style.paddingLeft = "1.25rem";

		for (const entry of this.entries) {
			const row = list.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
			row.style.flexWrap = "wrap";

			// Query name (clickable)
			const nameLink = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const nameIcon = nameLink.createSpan();
			setIcon(nameIcon, "search");
			nameIcon.style.width = "12px";
			nameIcon.style.height = "12px";
			nameLink.appendText(` ${entry.query.name}`);
			nameLink.addEventListener("click", (e) => {
				e.stopPropagation();
				this.callbacks.onViewQuery(entry.query.id);
			});

			// Source basenames
			for (const src of entry.sourceBasenames) {
				const badge = row.createSpan({ text: src, cls: "ft-badge ft-text-xs" });
				badge.style.opacity = "0.7";
			}

			// Tile count
			const countBadge = row.createSpan({
				text: `${entry.tileCount} ${entry.tileCount === 1 ? "tile" : "tiles"}`,
				cls: "ft-text-xs ft-text-muted",
			});
			countBadge.style.flexShrink = "0";

			// Freshness
			if (entry.query.lastRun) {
				const level = getFreshnessLevel(entry.query.lastRun);
				const freshnessEl = row.createSpan({
					text: formatRelativeTime(entry.query.lastRun),
					cls: "ft-text-xs",
				});
				freshnessEl.style.color = getFreshnessColor(level);
				freshnessEl.style.flexShrink = "0";
			}
		}
	}
}

/** Extract basenames from a query's sources. */
export function getSourceBasenames(query: SavedAnalyticsQuery): string[] {
	if (!query.sources || query.sources.length === 0) return [];
	return query.sources.map((s) => {
		const parts = s.csvPath.split("/");
		return parts[parts.length - 1];
	});
}
