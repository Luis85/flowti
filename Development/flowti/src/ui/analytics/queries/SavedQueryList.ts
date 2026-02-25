/**
 * Saved query master list sub-component.
 *
 * Renders saved queries with star/rename/duplicate/delete actions.
 * Favorites are sorted to the top of the list.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps } from "./types";

export type QuerySortKey = "name" | "sources" | "lastRun";

export interface QuerySortState {
	sortKey: QuerySortKey;
	onSortChange: (key: QuerySortKey) => void;
}

export class SavedQueryList {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
		private sortState?: QuerySortState,
	) {}

	render(): void {
		this.container.empty();
		const state = this.deps.hubDeps.getState();
		const svc = this.deps.hubDeps.analyticsService;

		const sortKey = this.sortState?.sortKey ?? "name";
		const savedQueries = [...svc.listQueries()].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			if (sortKey === "sources") return (b.sources?.length ?? 0) - (a.sources?.length ?? 0);
			if (sortKey === "lastRun") return (b.lastRowCount ?? -1) - (a.lastRowCount ?? -1);
			return a.name.localeCompare(b.name);
		});

		const sqHeader = this.container.createDiv({ cls: "ft-master-category-header" });
		sqHeader.createSpan({ text: "Saved Queries" });
		if (savedQueries.length > 0) {
			sqHeader.createSpan({ text: `${savedQueries.length}`, cls: "ft-master-category-count" });
		}

		const spacer = sqHeader.createDiv();
		spacer.style.flex = "1";

		// Sort dropdown
		const sortSelect = sqHeader.createEl("select", { cls: "ft-text-xs" });
		sortSelect.style.cssText = "padding:1px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;font-size:var(--font-ui-smaller)";
		for (const opt of [{ v: "name", l: "Name" }, { v: "sources", l: "Sources" }, { v: "lastRun", l: "Last Run" }]) {
			const o = sortSelect.createEl("option");
			o.value = opt.v;
			o.textContent = opt.l;
			if (opt.v === sortKey) o.selected = true;
		}
		sortSelect.addEventListener("change", () => {
			this.sortState?.onSortChange(sortSelect.value as QuerySortKey);
			this.deps.renderMaster();
		});

		const newBtn = sqHeader.createEl("span", { cls: "ft-nav-link" });
		newBtn.style.cursor = "pointer";
		const newIcon = newBtn.createSpan();
		setIcon(newIcon, "plus");
		newIcon.style.width = "14px";
		newIcon.style.height = "14px";
		newBtn.setAttribute("aria-label", "New query");
		newBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.deps.newQuery();
		});

		for (const sq of savedQueries) {
			const isSelected = state.selectedQueryId === sq.id;
			const item = this.container.createDiv({ cls: "ft-master-event-item" });
			item.style.cssText = `align-items:flex-start;padding-left:0.5rem${isSelected ? ";border-left:2px solid var(--interactive-accent);background:var(--background-secondary)" : ""}`;

			// Star toggle
			const starBtn = item.createEl("span", { cls: "ft-nav-link" });
			starBtn.style.flexShrink = "0";
			starBtn.style.cursor = "pointer";
			const starIcon = starBtn.createSpan();
			setIcon(starIcon, "star");
			starIcon.style.width = "14px";
			starIcon.style.height = "14px";
			if (!sq.isFavorite) {
				starBtn.style.opacity = "0.3";
			}
			starBtn.setAttribute("aria-label", sq.isFavorite ? "Unfavorite" : "Favorite");
			starBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void svc.toggleQueryFavorite(sq.id);
			});

			const textBlock = item.createDiv({ cls: "ft-master-event-name" });
			textBlock.style.minWidth = "0";
			textBlock.createDiv({ text: sq.name });
			if (sq.description) {
				const descEl = textBlock.createDiv({ cls: "ft-text-muted ft-text-xs" });
				descEl.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
				descEl.textContent = sq.description;
			}
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-xs" });
			sub.textContent = `${sq.sources.length} source${sq.sources.length > 1 ? "s" : ""}, ${sq.measures.length} measure${sq.measures.length > 1 ? "s" : ""}`;

			if (sq.lastRowCount !== undefined) {
				const rowsBadge = item.createSpan({ text: `${sq.lastRowCount}`, cls: "ft-text-xs ft-text-muted" });
				rowsBadge.style.flexShrink = "0";
			}

			// Rename button — replaces text with inline input
			const renameBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const renameIcon = renameBtn.createSpan();
			setIcon(renameIcon, "pencil");
			renameIcon.style.width = "14px";
			renameIcon.style.height = "14px";
			renameBtn.setAttribute("aria-label", "Rename query");
			renameBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				// Replace text block with inline input
				textBlock.empty();
				const renameInput = textBlock.createEl("input", { type: "text" });
				renameInput.value = sq.name;
				renameInput.style.cssText = "font-size:var(--font-ui-small);border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:2px 4px;border-radius:4px;width:100%";
				renameInput.addEventListener("blur", () => {
					const val = renameInput.value.trim();
					if (val && val !== sq.name) {
						void svc.renameQuery(sq.id, val).then(() => {
							this.deps.renderMaster();
						});
					} else {
						this.deps.renderMaster();
					}
				});
				renameInput.addEventListener("keydown", (ev) => {
					if (ev.key === "Enter") { ev.preventDefault(); renameInput.blur(); }
					if (ev.key === "Escape") { ev.preventDefault(); this.deps.renderMaster(); }
				});
				renameInput.addEventListener("click", (ev) => ev.stopPropagation());
				setTimeout(() => renameInput.focus(), 20);
			});

			// Duplicate button
			const dupeBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const dupeIcon = dupeBtn.createSpan();
			setIcon(dupeIcon, "copy");
			dupeIcon.style.width = "14px";
			dupeIcon.style.height = "14px";
			dupeBtn.setAttribute("aria-label", "Clone query");
			dupeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void svc.duplicateQuery(sq.id).then(() => {
					this.deps.renderMaster();
				});
			});

			// Delete button
			const delBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.setAttribute("aria-label", "Delete query");
			delBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.handleDelete(sq.id);
			});

			item.addEventListener("click", () => {
				this.deps.hubDeps.setState({ selectedQueryId: sq.id });
				this.deps.loadSavedQuery(sq.id);
			});
		}
	}

	private async handleDelete(queryId: string): Promise<void> {
		const svc = this.deps.hubDeps.analyticsService;
		await svc.deleteQuery(queryId);
		if (this.deps.hubDeps.getState().selectedQueryId === queryId) {
			this.deps.hubDeps.setState({ selectedQueryId: null });
		}
		this.deps.renderMaster();
	}
}
