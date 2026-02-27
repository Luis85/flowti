/**
 * Inbox component for the User Hub.
 *
 * Renders actionable and informational items from domain events
 * in a master-detail split layout. Supports mark-read, dismiss,
 * and clear-all actions via InboxService.
 */

import { setIcon } from "obsidian";
import { formatSourceEvent, formatTime, type UserHubComponentDeps, type InboxItem } from "./types";
import { VaultFolderTriagePanel } from "./VaultFolderTriagePanel";

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

		// Header with clear-all action
		const header = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-session-list-header" });

		const count = header.createSpan({ cls: "ft-text-sm ft-text-muted" });
		const unread = items.filter((i) => !i.read).length;
		count.setText(`${items.length} item${items.length === 1 ? "" : "s"}${unread > 0 ? ` (${unread} unread)` : ""}`);

		if (unread > 0) {
			const markAllBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm ft-text-muted" });
			setIcon(markAllBtn, "check-check");
			markAllBtn.appendText(" Mark all read");
			markAllBtn.addEventListener("click", () => {
				void this.deps.inboxService.markAllRead();
			});
		}

		const clearBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm ft-text-muted ft-ml-auto" });
		setIcon(clearBtn, "trash-2");
		clearBtn.appendText(" Clear all");
		clearBtn.addEventListener("click", () => {
			void this.deps.inboxService.clearAll();
		});

		for (const item of items) {
			const isSelected = state.selectedInboxItem?.id === item.id;
			const row = this.masterEl.createDiv({ cls: `ft-catalog-row ft-cursor-pointer${isSelected ? " ft-catalog-row-active ft-session-row-selected" : ""}${!item.read ? " ft-inbox-row-unread" : ""}` });

			const icon = row.createSpan({ cls: "ft-inbox-item-icon" });
			setIcon(icon, item.type === "action" ? "alert-circle" : "info");

			row.createSpan({ text: item.title });

			row.createSpan({
				text: formatSourceEvent(item.sourceEvent),
				cls: "ft-badge ft-badge-muted ft-text-sm ft-inbox-item-source",
			});

			row.createSpan({
				text: formatTime(item.timestamp),
				cls: "ft-text-muted ft-text-sm ft-ml-auto",
			});

			row.addEventListener("click", () => {
				this.deps.setState({ selectedInboxItem: item });
				// Mark as read when selected
				if (!item.read) {
					void this.deps.inboxService.markRead(item.id);
				}
				this.deps.scheduleRender();
			});
		}
	}

	renderDetail(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const item = state.selectedInboxItem;

		if (!item) {
			const empty = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-detail-empty" });
			const icon = empty.createSpan();
			setIcon(icon, "inbox");
			empty.createSpan({ text: "Select an item to view details" });
			return;
		}

		this.renderItemDetail(item);
	}

	private renderEmptyState(): void {
		const empty = this.masterEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center ft-inbox-empty" });

		const icon = empty.createDiv({ cls: "ft-inbox-empty-icon" });
		setIcon(icon, "inbox");
		icon.querySelector("svg")?.setAttribute("width", "48");
		icon.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({ text: "No items in your inbox", cls: "ft-heading ft-heading-sm" });
		empty.createDiv({
			text: "Actionable items from watchers, imports, and exports will appear here.",
			cls: "ft-text-muted ft-text-sm ft-inbox-empty-hint",
		});
	}

	private renderItemDetail(item: InboxItem): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-section" });
		header.createEl("h3", { text: item.title, cls: "ft-heading" });

		const meta = header.createDiv({ cls: "ft-flex ft-gap-2 ft-text-sm ft-text-muted" });
		meta.createSpan({ text: item.type === "action" ? "Action Required" : "Information", cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: formatSourceEvent(item.sourceEvent), cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: formatTime(item.timestamp) });

		// Source event type (clickable link to Event Catalog)
		const eventRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm ft-text-muted ft-inbox-event-row-mt" });
		eventRow.createSpan({ text: "Triggered by: " });
		const eventLink = eventRow.createSpan({ text: item.sourceEvent, cls: "ft-event-type ft-nav-link ft-cursor-pointer" });
		eventLink.setAttribute("aria-label", "View in event catalog");
		eventLink.addEventListener("click", () => {
			this.deps.navigateToEvent(item.sourceEvent);
		});

		if (item.description) {
			const body = this.detailEl.createDiv({ cls: "ft-detail-section" });
			body.createEl("p", { text: item.description });
		}

		// Clickable link to the underlying note file
		if (item.filePath) {
			const fileRow = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-items-center ft-gap-1 ft-text-sm" });
			const fileIcon = fileRow.createSpan({ cls: "ft-inbox-file-icon" });
			setIcon(fileIcon, "file-text");
			const fileLink = fileRow.createSpan({ text: item.filePath, cls: "ft-nav-link ft-cursor-pointer" });
			fileLink.setAttribute("aria-label", "Open note");
			fileLink.addEventListener("click", () => {
				this.deps.openFile(item.filePath!);
			});
		}

		// Vault folder triage panel (replaces generic "Mark read" for vault folder items)
		if (item.sourceHub === "vault-folder" && !item.read) {
			new VaultFolderTriagePanel(this.detailEl, this.deps, item).render();
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-gap-2" });

		if (!item.read && item.sourceHub !== "vault-folder") {
			const readBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(readBtn, "check");
			readBtn.appendText(" Mark read");
			readBtn.addEventListener("click", () => {
				void this.deps.inboxService.markRead(item.id);
			});
		}

		const dismissBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(dismissBtn, "x");
		dismissBtn.appendText(" Dismiss");
		dismissBtn.addEventListener("click", () => {
			void this.deps.inboxService.dismiss(item.id);
		});
	}
}
