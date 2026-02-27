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

		sqHeader.createDiv({ cls: "ft-flex-1" });

		// Sort dropdown
		const sortSelect = sqHeader.createEl("select", { cls: "ft-sort-select" });
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

		const newBtn = sqHeader.createEl("span", { cls: "ft-nav-link ft-cursor-pointer" });
		const newIcon = newBtn.createSpan({ cls: "ft-icon-sm" });
		setIcon(newIcon, "plus");
		newBtn.setAttribute("aria-label", "New query");
		newBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.deps.newQuery();
		});

		for (const sq of savedQueries) {
			const isSelected = state.selectedQueryId === sq.id;
			const item = this.container.createDiv({ cls: `ft-master-event-item ft-query-item${isSelected ? " ft-query-item-selected" : ""}` });

			// Star toggle
			const starBtn = item.createEl("span", { cls: `ft-nav-link ft-flex-shrink-0 ft-cursor-pointer${!sq.isFavorite ? " ft-opacity-30" : ""}` });
			const starIcon = starBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(starIcon, "star");
			starBtn.setAttribute("aria-label", sq.isFavorite ? "Unfavorite" : "Favorite");
			starBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void svc.toggleQueryFavorite(sq.id);
			});

			const textBlock = item.createDiv({ cls: "ft-master-event-name ft-min-w-0" });
			textBlock.createDiv({ text: sq.name });
			if (sq.description) {
				const descEl = textBlock.createDiv({ cls: "ft-text-muted ft-text-xs ft-truncate" });
				descEl.textContent = sq.description;
			}
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-xs" });
			sub.textContent = `${sq.sources.length} source${sq.sources.length > 1 ? "s" : ""}, ${sq.measures.length} measure${sq.measures.length > 1 ? "s" : ""}`;

			if (sq.lastRowCount !== undefined) {
				item.createSpan({ text: `${sq.lastRowCount}`, cls: "ft-text-xs ft-text-muted ft-flex-shrink-0" });
			}

			// Rename button — replaces text with inline input
			const renameBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const renameIcon = renameBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(renameIcon, "pencil");
			renameBtn.setAttribute("aria-label", "Rename query");
			renameBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				// Replace text block with inline input
				textBlock.empty();
				const renameInput = textBlock.createEl("input", { type: "text", cls: "ft-rename-input" });
				renameInput.value = sq.name;
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
			const dupeIcon = dupeBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(dupeIcon, "copy");
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
