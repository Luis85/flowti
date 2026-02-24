/**
 * Saved query master list sub-component.
 *
 * Renders saved queries with star/rename/duplicate/delete actions.
 * Favorites are sorted to the top of the list.
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps } from "./types";

export class SavedQueryList {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const state = this.deps.hubDeps.getState();
		const svc = this.deps.hubDeps.analyticsService;

		const savedQueries = [...svc.listQueries()].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return 0;
		});
		if (savedQueries.length === 0) return;

		const sqHeader = this.container.createDiv({ cls: "ft-master-category-header" });
		sqHeader.createSpan({ text: "Saved Queries" });
		sqHeader.createSpan({ text: `${savedQueries.length}`, cls: "ft-master-category-count" });

		for (const sq of savedQueries) {
			const isSelected = state.selectedQueryId === sq.id;
			const item = this.container.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});
			item.style.alignItems = "flex-start";

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
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
			sub.textContent = `${sq.sources.length} source${sq.sources.length > 1 ? "s" : ""}, ${sq.measures.length} measure${sq.measures.length > 1 ? "s" : ""}`;

			if (sq.lastRowCount !== undefined) {
				item.createSpan({ text: `${sq.lastRowCount} rows`, cls: "ft-badge ft-badge-muted" });
			}

			// Rename button
			const renameBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const renameIcon = renameBtn.createSpan();
			setIcon(renameIcon, "pencil");
			renameIcon.style.width = "14px";
			renameIcon.style.height = "14px";
			renameBtn.setAttribute("aria-label", "Rename query");
			renameBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const newName = prompt("Rename query:", sq.name);
				if (newName && newName.trim()) {
					void svc.renameQuery(sq.id, newName.trim()).then(() => {
						this.deps.renderMaster();
					});
				}
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
