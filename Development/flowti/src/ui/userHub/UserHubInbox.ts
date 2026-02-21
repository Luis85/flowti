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
		const header = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.padding = "0.25rem 0.5rem";
		header.style.borderBottom = "1px solid var(--background-modifier-border)";

		const count = header.createSpan({ cls: "ft-text-sm ft-text-muted" });
		const unread = items.filter((i) => !i.read).length;
		count.setText(`${items.length} item${items.length === 1 ? "" : "s"}${unread > 0 ? ` (${unread} unread)` : ""}`);

		const clearBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm ft-text-muted" });
		clearBtn.style.marginLeft = "auto";
		setIcon(clearBtn, "trash-2");
		clearBtn.appendText(" Clear all");
		clearBtn.addEventListener("click", () => {
			void this.deps.inboxService.clearAll();
		});

		for (const item of items) {
			const row = this.masterEl.createDiv({ cls: "ft-catalog-row ft-cursor-pointer" });

			if (state.selectedInboxItem?.id === item.id) {
				row.addClass("ft-catalog-row-active");
				row.style.backgroundColor = "var(--background-modifier-hover)";
			}

			if (!item.read) {
				row.style.fontWeight = "600";
			}

			const icon = row.createSpan();
			setIcon(icon, item.type === "action" ? "alert-circle" : "info");
			icon.style.opacity = "0.6";
			icon.style.marginRight = "0.5rem";

			row.createSpan({ text: item.title });

			const source = row.createSpan({
				text: formatSourceEvent(item.sourceEvent),
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
			source.style.marginLeft = "0.5rem";

			const time = row.createSpan({
				text: formatTime(item.timestamp),
				cls: "ft-text-muted ft-text-sm",
			});
			time.style.marginLeft = "auto";

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
		meta.createSpan({ text: formatSourceEvent(item.sourceEvent), cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: formatTime(item.timestamp) });

		// Source event type (clickable link to Event Catalog)
		const eventRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm ft-text-muted" });
		eventRow.style.marginTop = "0.25rem";
		eventRow.createSpan({ text: "Triggered by: " });
		const eventLink = eventRow.createSpan({ text: item.sourceEvent, cls: "ft-event-type ft-nav-link ft-cursor-pointer" });
		eventLink.setAttribute("aria-label", "View in Event Catalog");
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
			const fileIcon = fileRow.createSpan();
			setIcon(fileIcon, "file-text");
			fileIcon.style.opacity = "0.6";
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
