/**
 * Inbox component for the User Hub.
 *
 * First increment: renders an empty placeholder state.
 * Future increments will populate items from subscription notifications,
 * import/export results, and other actionable events.
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps, InboxItem } from "./types";

export class UserHubInbox {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	renderMaster(filterText: string): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		const items = state.inboxItems.filter((item) =>
			!filterText || item.title.toLowerCase().includes(filterText),
		);

		if (items.length === 0) {
			this.renderEmptyState();
			return;
		}

		for (const item of items) {
			const row = this.masterEl.createDiv({ cls: "ft-catalog-row ft-cursor-pointer" });

			if (!item.read) {
				row.style.fontWeight = "600";
			}

			const icon = row.createSpan();
			setIcon(icon, item.type === "action" ? "alert-circle" : "info");
			icon.style.opacity = "0.6";
			icon.style.marginRight = "0.5rem";

			row.createSpan({ text: item.title });

			const time = row.createSpan({
				text: this.formatTime(item.timestamp),
				cls: "ft-text-muted ft-text-sm",
			});
			time.style.marginLeft = "auto";

			row.addEventListener("click", () => {
				this.deps.setState({ selectedInboxItem: item });
				this.deps.scheduleRender();
			});
		}
	}

	renderDetail(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const item = state.selectedInboxItem;

		if (!item) {
			const empty = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			empty.style.justifyContent = "center";
			empty.style.padding = "3rem";
			empty.style.color = "var(--text-muted)";
			const icon = empty.createSpan();
			setIcon(icon, "inbox");
			empty.createSpan({ text: "Select an item to view details" });
			return;
		}

		this.renderItemDetail(item);
	}

	private renderEmptyState(): void {
		const empty = this.masterEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center" });
		empty.style.justifyContent = "center";
		empty.style.padding = "3rem";
		empty.style.color = "var(--text-muted)";

		const icon = empty.createDiv();
		setIcon(icon, "inbox");
		icon.style.opacity = "0.4";
		icon.style.marginBottom = "0.75rem";
		icon.querySelector("svg")?.setAttribute("width", "48");
		icon.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({ text: "No items in your inbox", cls: "ft-heading ft-heading-sm" });
		empty.createDiv({
			text: "Actionable items from watchers, imports, and exports will appear here.",
			cls: "ft-text-muted ft-text-sm",
		}).style.marginTop = "0.25rem";
	}

	private renderItemDetail(item: InboxItem): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-section" });
		header.createEl("h3", { text: item.title, cls: "ft-heading" });

		const meta = header.createDiv({ cls: "ft-flex ft-gap-2 ft-text-sm ft-text-muted" });
		meta.createSpan({ text: item.type === "action" ? "Action Required" : "Information", cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: this.formatTime(item.timestamp) });

		if (item.description) {
			const body = this.detailEl.createDiv({ cls: "ft-detail-section" });
			body.createEl("p", { text: item.description });
		}
	}

	private formatTime(timestamp: string): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	}
}
