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

		const section = this.container.createDiv();
		section.style.marginTop = "1.5rem";
		section.style.paddingTop = "0.75rem";

		// Header row with collapse toggle
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.cursor = "pointer";
		header.style.userSelect = "none";
		header.addEventListener("click", () => this.callbacks.onToggleCollapse());

		const chevron = header.createSpan();
		setIcon(chevron, this.collapsed ? "chevron-right" : "chevron-down");
		chevron.style.cssText = "width:12px;height:12px;opacity:0.5;display:inline-flex;align-items:center;flex-shrink:0";

		header.createSpan({
			text: `Queries (${this.entries.length} ${this.entries.length === 1 ? "query" : "queries"} from ${uniqueSources.size} ${uniqueSources.size === 1 ? "source" : "sources"})`,
			cls: "ft-text-xs ft-text-muted",
		});

		if (this.collapsed) return;

		// Query list
		const list = section.createDiv({ cls: "ft-mt-1" });
		list.style.paddingLeft = "1rem";

		for (const entry of this.entries) {
			const row = list.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			row.style.flexWrap = "wrap";
			row.style.padding = "0.15rem 0";

			// Query name (clickable)
			const nameLink = row.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			nameLink.style.display = "inline-flex";
			nameLink.style.alignItems = "center";
			nameLink.style.gap = "0.25rem";
			const nameIcon = nameLink.createSpan();
			setIcon(nameIcon, "search");
			nameIcon.style.cssText = "width:10px;height:10px;flex-shrink:0;display:inline-flex;align-items:center";
			const svg = nameIcon.querySelector("svg");
			if (svg) { svg.setAttribute("width", "10"); svg.setAttribute("height", "10"); }
			nameLink.appendText(entry.query.name);
			nameLink.addEventListener("click", (e) => {
				e.stopPropagation();
				this.callbacks.onViewQuery(entry.query.id);
			});

			// Source basenames
			for (const src of entry.sourceBasenames) {
				const badge = row.createSpan({ text: src, cls: "ft-badge ft-badge-muted" });
				badge.style.cssText = "font-size:0.6rem;padding:0 0.2rem;opacity:0.7";
			}

			// Tile count + freshness (compact)
			const meta = row.createSpan({ cls: "ft-text-muted" });
			meta.style.cssText = "font-size:0.6rem;flex-shrink:0;margin-left:auto";
			const parts: string[] = [`${entry.tileCount} ${entry.tileCount === 1 ? "tile" : "tiles"}`];
			if (entry.query.lastRun) {
				parts.push(formatRelativeTime(entry.query.lastRun));
			}
			meta.textContent = parts.join(" \u00b7 ");
			if (entry.query.lastRun) {
				const level = getFreshnessLevel(entry.query.lastRun);
				meta.style.color = getFreshnessColor(level);
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
