import { App } from "obsidian";
import { IEventBus } from "src/eventsystem";
import { MessageActionRequestedEvent } from "src/eventsystem/messages/MessageActionRequestedEvent";
import { MessageAddedEvent } from "src/eventsystem/messages/MessageAddedEvent";
import { MessageDeletedEvent } from "src/eventsystem/messages/MessageDeletedEvent";
import { MessageMarkedAsSpamEvent } from "src/eventsystem/messages/MessageMarkedAsSpamEvent";
import { OneSeaterSettings } from "src/settings/types";
import { MessageStore } from "src/simulation/stores/MessageStore";
import { getTypeIcon, getPriorityDot } from "src/ui/helpers";
import { MessageModal } from "src/ui/modals/MessageModal";
import { ConfirmModal } from "src/ui/modals/ConfirmModal";
import { MessageReadEvent } from "src/eventsystem/messages/MessageReadEvent";
import { MessageType, MessageAction, ActionGateResult } from "src/messages/types";
import { SimulationMessage } from "src/models/SimulationMessage";
import { ResetInboxEvent } from "src/eventsystem/messages/ResetInboxEvent";

const WARNING_THRESHOLD = 25;
const DANGER_THRESHOLD = 50;
const PANIC_BUTTON_THRESHOLD = 0.8;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type FilterType = "all" | MessageType;
type FilterStatus = "all" | "unread" | "read";

interface InboxFilters {
	type: FilterType;
	status: FilterStatus;
}

interface FilterOption {
	value: string;
	label: string;
	icon?: string;
}

const TYPE_OPTIONS: FilterOption[] = [
	{ value: "all", label: "All Types" },
	{ value: "Payment", label: "Payments", icon: "💸" },
	{ value: "CustomerPurchaseOrder", label: "Order", icon: "💰"}
];

const STATUS_OPTIONS: FilterOption[] = [
	{ value: "all", label: "All" },
	{ value: "unread", label: "Unread", icon: "●" },
	{ value: "read", label: "Read", icon: "○" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Panel
// ═══════════════════════════════════════════════════════════════════════════

export class MessageInboxPanel {
	private settings?: OneSeaterSettings;
	private root?: HTMLElement;
	private header?: HTMLElement;
	private headerCount?: HTMLElement;
	private unreadCount?: HTMLElement;
	private filterButton?: HTMLButtonElement;
	private filterDropdown?: HTMLElement;
	private listEl?: HTMLElement;
	private sleepingOverlay?: HTMLElement;
	private panicButton?: HTMLButtonElement;
	private playerEnergy = 0;

	// Filter State
	private filters: InboxFilters = {
		type: "all",
		status: "all",
	};

	private isFilterOpen = false;

	/** DOM rows keyed by message ID */
	private rows = new Map<string, HTMLElement>();
	private pendingRemovals = new Set<string>();
	private isSleeping = false;

	// Click outside handler
	private boundCloseFilter = this.closeFilterDropdown.bind(this);

	constructor(
		private store: MessageStore,
		private events: IEventBus,
		private app?: App
	) {}

	setApp(app: App) {
		this.app = app;
	}

	setSettings(settings: OneSeaterSettings) {
		this.settings = settings;
	}

	setSleeping(sleeping: boolean) {
		if (this.isSleeping === sleeping) return;
		this.isSleeping = sleeping;

		this.root?.toggleClass("is-sleeping", sleeping);

		this.rows.forEach((row) => {
			row.toggleClass("is-sleeping", sleeping);
			row.querySelectorAll("button").forEach((btn) => {
				(btn as HTMLButtonElement).disabled = sleeping;
			});
		});

		if (this.panicButton) {
			this.panicButton.disabled = sleeping;
		}

		if (this.filterButton) {
			this.filterButton.disabled = sleeping;
		}

		this.sleepingOverlay?.toggleClass("is-visible", sleeping);
	}

	mount(parent: HTMLElement) {
		this.registerEvents();

		this.root = parent.createDiv({ cls: "mm-inbox" });

		// Header (includes filter button)
		this.createHeader();

		// List
		this.listEl = this.root.createDiv({ cls: "mm-inbox__list" });

		// Sleeping Overlay
		this.sleepingOverlay = this.root.createDiv({
			cls: "mm-inbox__sleeping-overlay",
		});
		this.sleepingOverlay.createDiv({
			cls: "mm-inbox__sleeping-icon",
			text: "😴",
		});
		this.sleepingOverlay.createDiv({
			cls: "mm-inbox__sleeping-text",
			text: "Sleeping...",
		});

		// Initial render from store
		this.fullSync();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Header Creation
	// ═══════════════════════════════════════════════════════════════════════

	private createHeader() {
		if (!this.root) return;

		this.header = this.root.createDiv({ cls: "mm-inbox__header" });

		// Left side: Icon + Title
		const titleWrap = this.header.createDiv({
			cls: "mm-inbox__title-wrap",
		});
		titleWrap.createDiv({ cls: "mm-inbox__icon", text: "📬" });
		titleWrap.createDiv({ cls: "mm-inbox__title", text: "Inbox" });

		// Right side: Filter + Badges + Panic
		const controls = this.header.createDiv({ cls: "mm-inbox__controls" });

		// Panic Button (hidden by default)
		this.panicButton = controls.createEl("button", {
			cls: "mm-inbox__panic-btn is-hidden",
			text: "🫣",
		});

		this.panicButton.title = "Clear all messages";
		this.panicButton.addEventListener("click", () => this.handlePanicButton());

		// Filter Button (compact)
		const filterWrap = controls.createDiv({ cls: "mm-inbox__filter-wrap" });
		
		this.filterButton = filterWrap.createEl("button", {
			cls: "mm-inbox__filter-btn",
			text: "Filter",
		});
		this.filterButton.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleFilterDropdown();
		});
		this.updateFilterButtonState();

		// Filter Dropdown (hidden by default)
		this.filterDropdown = filterWrap.createDiv({
			cls: "mm-inbox__filter-dropdown",
		});
		this.createFilterDropdownContent();

		// Badges
		const badges = controls.createDiv({ cls: "mm-inbox__badges" });

		this.unreadCount = badges.createDiv({
			cls: "mm-inbox__unread-count",
			text: "0",
		});
		this.unreadCount.title = "Unread messages";

		this.headerCount = badges.createDiv({
			cls: "mm-inbox__count",
			text: "0",
		});
		this.headerCount.title = "Total messages";
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Filter Dropdown
	// ═══════════════════════════════════════════════════════════════════════

	private createFilterDropdownContent() {
		if (!this.filterDropdown) return;

		this.filterDropdown.empty();

		// Type Section
		const typeSection = this.filterDropdown.createDiv({ cls: "mm-inbox__filter-section" });
		typeSection.createDiv({ cls: "mm-inbox__filter-section-title", text: "Type" });
		
		const typeOptions = typeSection.createDiv({ cls: "mm-inbox__filter-options" });
		for (const opt of TYPE_OPTIONS) {
			this.createFilterOption(typeOptions, "type", opt);
		}

		// Status Section
		const statusSection = this.filterDropdown.createDiv({ cls: "mm-inbox__filter-section" });
		statusSection.createDiv({ cls: "mm-inbox__filter-section-title", text: "Status" });
		
		const statusOptions = statusSection.createDiv({ cls: "mm-inbox__filter-options" });
		for (const opt of STATUS_OPTIONS) {
			this.createFilterOption(statusOptions, "status", opt);
		}

		// Clear Button (only if filters active)
		if (this.hasActiveFilters()) {
			const clearBtn = this.filterDropdown.createEl("button", {
				cls: "mm-inbox__filter-clear",
				text: "Clear filters",
			});
			clearBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.resetFilters();
				this.closeFilterDropdown();
			});
		}
	}

	private createFilterOption(
		parent: HTMLElement,
		filterKey: keyof InboxFilters,
		option: FilterOption
	) {
		const isActive = this.filters[filterKey] === option.value;
		
		const optEl = parent.createDiv({
			cls: `mm-inbox__filter-option ${isActive ? "is-active" : ""}`,
		});

		if (option.icon) {
			optEl.createSpan({ cls: "mm-inbox__filter-option-icon", text: option.icon });
		}
		optEl.createSpan({ text: option.label });

		optEl.addEventListener("click", (e) => {
			e.stopPropagation();
			(this.filters[filterKey] as string) = option.value;
			this.applyFiltersAndSort();
			this.updateFilterButtonState();
			this.createFilterDropdownContent(); // Rebuild to update active states
		});
	}

	private toggleFilterDropdown() {
		if (this.isFilterOpen) {
			this.closeFilterDropdown();
		} else {
			this.openFilterDropdown();
		}
	}

	private openFilterDropdown() {
		if (!this.filterDropdown || !this.filterButton) return;
		
		this.isFilterOpen = true;
		this.filterDropdown.addClass("is-open");
		this.filterButton.addClass("is-open");

		// Close on click outside
		setTimeout(() => {
			document.addEventListener("click", this.boundCloseFilter);
		}, 0);
	}

	private closeFilterDropdown() {
		if (!this.filterDropdown || !this.filterButton) return;
		
		this.isFilterOpen = false;
		this.filterDropdown.removeClass("is-open");
		this.filterButton.removeClass("is-open");
		
		document.removeEventListener("click", this.boundCloseFilter);
	}

	private updateFilterButtonState() {
		if (!this.filterButton) return;

		const hasFilters = this.hasActiveFilters();
		this.filterButton.toggleClass("has-filters", hasFilters);

		if (hasFilters) {
			const parts: string[] = [];
			if (this.filters.type !== "all") {
				const opt = TYPE_OPTIONS.find(o => o.value === this.filters.type);
				parts.push(opt?.icon || this.filters.type);
			}
			if (this.filters.status !== "all") {
				const opt = STATUS_OPTIONS.find(o => o.value === this.filters.status);
				parts.push(opt?.icon || this.filters.status);
			}
			this.filterButton.setText(parts.join(" ") + " ▾");
		} else {
			this.filterButton.setText("Filter ▾");
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Panic Button
	// ═══════════════════════════════════════════════════════════════════════

	private handlePanicButton() {
		if (this.isSleeping || !this.app) return;

		new ConfirmModal(
			this.app,
			{
				title: "😇 Clear Entire Inbox",
				message:
					"This will permanently delete ALL messages. But sometimes a fresh start could help. You do you.",
				confirmText: "Delete All",
				cancelText: "Cancel",
				variant: "danger",
			},
			(confirmed) => {
				if (confirmed) {
					this.events.publish(new ResetInboxEvent());
				}
			}
		).open();
	}

	private updatePanicButtonVisibility() {
		if (!this.panicButton || !this.settings) return;

		const max = this.settings.game.maxMessages;
		const current = this.store.getMessageCount();
		const fillPercent = current / max;

		const shouldShow = fillPercent >= PANIC_BUTTON_THRESHOLD;
		this.panicButton.toggleClass("is-hidden", !shouldShow);

		if (shouldShow) {
			this.panicButton.toggleClass("is-critical", fillPercent >= 0.95);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Filtering & Sorting
	// ═══════════════════════════════════════════════════════════════════════

	private getFilteredMessages(): SimulationMessage[] {
		let messages = this.store.getActiveMessages();

		// Apply type filter
		if (this.filters.type !== "all") {
			messages = messages.filter((m) => m.type === this.filters.type);
		}

		// Apply status filter
		if (this.filters.status === "unread") {
			messages = messages.filter((m) => !m.read_at);
		} else if (this.filters.status === "read") {
			messages = messages.filter((m) => !!m.read_at);
		}

		return messages;
	}

	private getSortedMessages(messages: SimulationMessage[]): SimulationMessage[] {
		// Always sort by date desc (newest first)
		return [...messages].sort((a, b) => b.simNowMs - a.simNowMs);
	}

	private applyFiltersAndSort() {
		if (!this.listEl) return;

		const filtered = this.getFilteredMessages();
		const sorted = this.getSortedMessages(filtered);

		// Hide all rows first
		this.rows.forEach((row, id) => {
			const isVisible = sorted.some((m) => m.id === id);
			row.toggleClass("is-filtered-out", !isVisible);
		});

		// Reorder visible rows
		sorted.forEach((msg) => {
			const row = this.rows.get(msg.id);
			if (row) {
				this.listEl!.appendChild(row);
			}
		});

		// Show/hide empty state
		const visibleCount = sorted.length;
		if (visibleCount === 0) {
			this.showEmptyState(this.hasActiveFilters());
		} else {
			this.listEl.querySelector(".mm-inbox__empty")?.remove();
		}

		this.updateFilteredCount(visibleCount);
	}

	private hasActiveFilters(): boolean {
		return this.filters.type !== "all" || this.filters.status !== "all";
	}

	private updateFilteredCount(visible: number) {
		const total = this.store.getMessageCount();
		if (this.hasActiveFilters() && this.headerCount) {
			this.headerCount.title = `Showing ${visible} of ${total} messages`;
		}
	}

	private resetFilters() {
		this.filters = { type: "all", status: "all" };
		this.applyFiltersAndSort();
		this.updateFilterButtonState();
		this.createFilterDropdownContent();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Public API
	// ═══════════════════════════════════════════════════════════════════════

	fullSync() {
		if (!this.store) return;
		this.clearView();

		const filtered = this.getFilteredMessages();
		const sorted = this.getSortedMessages(filtered);

		if (!this.listEl) return;

		for (const msg of sorted) {
			if (this.rows.has(msg.id)) continue;

			const row = this.createRow(msg);
			this.rows.set(msg.id, row);
			this.listEl.appendChild(row);
		}

		this.syncCounts();
		this.updatePanicButtonVisibility();
		this.setSleeping(this.isSleeping);

		if (sorted.length === 0) {
			this.showEmptyState(this.hasActiveFilters());
		}
	}

	syncCounts() {
		if (!this.store) return;
		const active = this.store.getActiveMessages();
		const unread = active.filter((m) => !m.read_at).length;

		this.setCount(active.length);
		this.updateUnreadCount(unread);
		this.updatePanicButtonVisibility();
	}

	setPlayerEnergy(v: number) {
		this.playerEnergy = v;
	}

	destroy() {
		this.closeFilterDropdown();
		this.clearView();
		this.pendingRemovals.clear();
		this.root?.remove();
		this.root = undefined;
		this.listEl = undefined;
		this.header = undefined;
		this.headerCount = undefined;
		this.unreadCount = undefined;
		this.filterButton = undefined;
		this.filterDropdown = undefined;
		this.sleepingOverlay = undefined;
		this.panicButton = undefined;
		this.isSleeping = false;

		this.unregisterEvents();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Getters
	// ═══════════════════════════════════════════════════════════════════════

	getVisibleCount(): number {
		if (!this.store) return 0;
		return this.store.getActiveMessages().length;
	}

	getUnreadCount(): number {
		if (!this.store) return 0;
		return this.store.getActiveMessages().filter((m) => !m.read_at).length;
	}

	getMessage(id: string): SimulationMessage | undefined {
		if (!this.store) return;
		return this.store.findMessage(id);
	}

	hasPendingOperations(): boolean {
		return this.pendingRemovals.size > 0;
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Private: Events
	// ═══════════════════════════════════════════════════════════════════════

	private registerEvents() {
		this.events.subscribe(MessageAddedEvent, this.onMessageAdded);
		this.events.subscribe(MessageReadEvent, this.onMessageRead);
		this.events.subscribe(MessageMarkedAsSpamEvent, this.onMessageSpam);
		this.events.subscribe(MessageDeletedEvent, this.onMessageDeleted);
	}

	private unregisterEvents() {
		this.events.unsubscribe(MessageAddedEvent, this.onMessageAdded);
		this.events.unsubscribe(MessageReadEvent, this.onMessageRead);
		this.events.unsubscribe(MessageMarkedAsSpamEvent, this.onMessageSpam);
		this.events.unsubscribe(MessageDeletedEvent, this.onMessageDeleted);
	}

	private onMessageAdded = (e: MessageAddedEvent) => {
		this.addRow(e.message);
		this.updatePanicButtonVisibility();
	};

	private onMessageRead = (e: MessageReadEvent) => {
		if (!this.store) return;
		const msg = this.store.findMessage(e.messageId);
		if (!msg) return;

		this.updateRow(msg);
		this.syncCounts();

		if (this.filters.status !== "all") {
			this.applyFiltersAndSort();
		}
	};

	private onMessageSpam = (e: MessageMarkedAsSpamEvent) => {
		this.removeRow(e.messageId);
		this.updatePanicButtonVisibility();
	};

	private onMessageDeleted = (e: MessageDeletedEvent) => {
		this.removeRow(e.messageId);
		this.updatePanicButtonVisibility();
	};

	// ═══════════════════════════════════════════════════════════════════════
	// Private: Row Management
	// ═══════════════════════════════════════════════════════════════════════

	private addRow(msg: SimulationMessage) {
		if (!this.listEl) return;
		if (this.rows.has(msg.id) || this.pendingRemovals.has(msg.id)) return;

		this.listEl.querySelector(".mm-inbox__empty")?.remove();

		const row = this.createRow(msg);
		this.rows.set(msg.id, row);

		const passesFilter = this.messagePassesFilter(msg);
		row.toggleClass("is-filtered-out", !passesFilter);

		row.addClass("is-entering");

		// Insert at top (newest first)
		if (this.listEl.firstChild) {
			this.listEl.insertBefore(row, this.listEl.firstChild);
		} else {
			this.listEl.appendChild(row);
		}

		requestAnimationFrame(() => row.removeClass("is-entering"));

		this.syncCounts();
	}

	private messagePassesFilter(msg: SimulationMessage): boolean {
		if (this.filters.type !== "all" && msg.type !== this.filters.type) {
			return false;
		}
		if (this.filters.status === "unread" && msg.read_at) {
			return false;
		}
		if (this.filters.status === "read" && !msg.read_at) {
			return false;
		}
		return true;
	}

	private updateRow(msg: SimulationMessage) {
		const row = this.rows.get(msg.id);
		if (!row) return;

		const isRead = !!msg.read_at;
		row.toggleClass("is-read", isRead);

		const indicator = row.querySelector(".mm-inbox__row-unread");
		indicator?.toggleClass("is-hidden", isRead);
	}

	private removeRow(id: string): boolean {
		if (this.pendingRemovals.has(id)) return false;

		const el = this.rows.get(id);
		if (!el) return false;

		this.pendingRemovals.add(id);
		this.rows.delete(id);

		el.addClass("is-leaving");

		setTimeout(() => {
			el.remove();
			this.pendingRemovals.delete(id);

			if (this.rows.size === 0 && this.pendingRemovals.size === 0) {
				this.showEmptyState(this.hasActiveFilters());
			}
		}, 200);

		this.syncCounts();
		return true;
	}

	private clearView() {
		this.rows.forEach((el) => el.remove());
		this.rows.clear();
		this.pendingRemovals.clear();
		this.listEl?.empty();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Private: UI Updates
	// ═══════════════════════════════════════════════════════════════════════

	private setCount(count: number) {
		if (!this.headerCount || !this.settings) return;

		const max = this.settings.game.maxMessages;
		const remaining = max - count;

		this.headerCount.setText(`${count}/${max}`);
		this.headerCount.title = `${remaining} slots remaining`;
		this.headerCount.removeClass("is-warning", "is-danger");

		const fillPercent = count / max;

		if (fillPercent >= PANIC_BUTTON_THRESHOLD) {
			this.headerCount.addClass("is-danger");
		} else if (fillPercent >= 0.5) {
			this.headerCount.addClass("is-warning");
		}
	}

	private updateUnreadCount(unread: number) {
		if (!this.unreadCount) return;

		this.unreadCount.setText(`${unread}`);
		this.unreadCount.toggleClass("is-hidden", unread === 0);
		this.unreadCount.removeClass("is-warning", "is-danger");

		if (unread > DANGER_THRESHOLD) {
			this.unreadCount.addClass("is-danger");
		} else if (unread > WARNING_THRESHOLD) {
			this.unreadCount.addClass("is-warning");
		}
	}

	private showEmptyState(isFiltered = false) {
		if (!this.listEl) return;
		if (this.listEl.querySelector(".mm-inbox__empty")) return;

		const empty = this.listEl.createDiv({ cls: "mm-inbox__empty" });

		if (isFiltered) {
			empty.createDiv({ cls: "mm-inbox__empty-icon", text: "🔍" });
			empty.createDiv({
				cls: "mm-inbox__empty-title",
				text: "No matching messages",
			});
			empty.createDiv({
				cls: "mm-inbox__empty-subtitle",
				text: "Try adjusting your filters",
			});

			const resetBtn = empty.createEl("button", {
				cls: "mm-inbox__empty-reset",
				text: "Clear Filters",
			});
			resetBtn.addEventListener("click", () => {
				this.resetFilters();
			});
		} else {
			empty.createDiv({ cls: "mm-inbox__empty-icon", text: "📭" });
			empty.createDiv({
				cls: "mm-inbox__empty-title",
				text: "No messages",
			});
			empty.createDiv({
				cls: "mm-inbox__empty-subtitle",
				text: "New messages will appear here",
			});
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Private: UI Creation
	// ═══════════════════════════════════════════════════════════════════════

	private createRow(msg: SimulationMessage): HTMLElement {
		const isRead = !!msg.read_at;

		const row = document.createElement("div");
		row.className = "mm-inbox__row";
		row.dataset.id = msg.id;

		if (this.isSleeping) row.addClass("is-sleeping");
		if (isRead) row.addClass("is-read");

		row.addEventListener("click", (e) => {
			if (this.isSleeping) return;
			if ((e.target as HTMLElement).tagName === "BUTTON") return;
			this.openMessage(msg.id);
		});

		// Content
		const content = document.createElement("div");
		content.className = "mm-inbox__row-content";

		const titleRow = document.createElement("div");
		titleRow.className = "mm-inbox__row-title";

		const unreadDot = document.createElement("span");
		unreadDot.className = "mm-inbox__row-unread";
		if (isRead) unreadDot.addClass("is-hidden");
		titleRow.appendChild(unreadDot);

		const typeBadge = document.createElement("span");
		typeBadge.className = "mm-inbox__row-type";
		typeBadge.textContent = getTypeIcon(msg.type);

		const subject = document.createElement("span");
		subject.className = "mm-inbox__row-subject";
		subject.textContent = msg.subject;

		titleRow.appendChild(typeBadge);
		titleRow.appendChild(subject);

		const meta = document.createElement("div");
		meta.className = "mm-inbox__row-meta";

		const author = document.createElement("span");
		author.className = "mm-inbox__row-author";
		author.textContent = msg.author;

		const priority = document.createElement("span");
		priority.className = `mm-inbox__row-priority is-${msg.priority.toLowerCase()}`;
		priority.textContent = getPriorityDot(msg.priority);

		const time = document.createElement("span");
		time.className = "mm-inbox__row-time";
		time.textContent = `Day ${msg.dayIndex}`;

		meta.appendChild(time);
		meta.appendChild(author);
		meta.appendChild(priority);

		content.appendChild(titleRow);
		content.appendChild(meta);

		// Actions
		const actions = document.createElement("div");
		actions.className = "mm-inbox__row-actions";

		const spamBtn = this.makeButton("Spam", "ghost", (e) => {
			e.stopPropagation();
			this.requestAction("spam", msg.id);
		});
		spamBtn.title = "Mark as spam";
		actions.appendChild(spamBtn);

		const deleteBtn = this.makeButton("🗑️", "danger", (e) => {
			e.stopPropagation();
			this.requestAction("delete", msg.id);
		});
		deleteBtn.title = "Delete message";
		actions.appendChild(deleteBtn);

		row.appendChild(content);
		row.appendChild(actions);
		return row;
	}

	private makeButton(
		label: string,
		variant: "primary" | "secondary" | "danger" | "ghost",
		onClick: (e: MouseEvent) => void | Promise<void>
	): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.className = `mm-inbox__btn mm-inbox__btn--${variant}`;
		btn.textContent = label;
		btn.disabled = this.isSleeping;

		btn.addEventListener("click", (e) => {
			if (this.isSleeping) return;
			void onClick(e);
		});

		return btn;
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Private: Actions
	// ═══════════════════════════════════════════════════════════════════════

	private requestAction(action: MessageAction, id: string) {
		if (this.isSleeping) return;
		this.events.publish(
			new MessageActionRequestedEvent(id, action, "inbox")
		);
	}

	private openMessage(id: string) {
		if (this.isSleeping || !this.store) return;

		const msg = this.store.findMessage(id);
		if (!msg || msg.deleted_at || msg.spam_at) return;

		if (!msg.read_at) {
			this.requestAction("read", id);
		}

		if (!this.app) return;

		const modal = new MessageModal(
			this.app,
			msg,
			(action) => this.requestAction(action, msg.id),
			{
				gateAction: this.gateFor(msg),
				getCostHint: (action) => this.costHint(action),
			}
		);
		modal.open();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Private: Gating
	// ═══════════════════════════════════════════════════════════════════════

	private minEnergyFor(action: MessageAction): number {
		switch (action) {
			case "read":
				return 2;
			case "spam":
				return 1;
			case "archive":
				return 1;
			case "collect":
				return 15;
			default:
				return 0;
		}
	}

	private costHint(action: MessageAction) {
		switch (action) {
			case "read":
				return { energyCost: 2, timeCostMinutes: 0, xpGain: 6 };
			case "archive":
				return { energyCost: 1, timeCostMinutes: 0, xpGain: 2 };
			case "spam":
				return { energyCost: 1, timeCostMinutes: 0, xpGain: 3 };
			case "collect":
				return { energyCost: 15, timeCostMinutes: 0, xpGain: 35 };
			default:
				return undefined;
		}
	}

	private gateFor(msg: SimulationMessage) {
		return (action: MessageAction): ActionGateResult => {
			if (!this.store) return { ok: false, reason: "System Error." };
			if (this.isSleeping)
				return { ok: false, reason: "Player is sleeping." };

			const current = this.store.findMessage(msg.id);
			if (!current) return { ok: false, reason: "Message not found." };
			if (current.deleted_at || current.spam_at)
				return { ok: false, reason: "Message deleted." };

			if (!current.possible_actions?.includes(action)) {
				return { ok: false, reason: "Action not allowed." };
			}

			const need = this.minEnergyFor(action);
			if ((this.playerEnergy ?? 0) < need) {
				return { ok: false, reason: "Not enough energy." };
			}

			return { ok: true };
		};
	}
}
