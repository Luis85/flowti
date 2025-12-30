import { App } from "obsidian";
import { IEventBus } from "src/eventsystem";
import { MessageActionRequestedEvent } from "src/eventsystem/messages/MessageActionRequestedEvent";
import { MessageAddedEvent } from "src/eventsystem/messages/MessageAddedEvent";
import { MessageDeletedEvent } from "src/eventsystem/messages/MessageDeletedEvent";
import { MessageMarkedAsSpamEvent } from "src/eventsystem/messages/MessageMarkedAsSpamEvent";
import { MessageReadEvent } from "src/eventsystem/messages/MessageReadEvent";
import { MessageAction, ActionGateResult } from "src/messages/types";
import { SimulationMessage } from "src/models/SimulationMessage";
import { OneSeaterSettings } from "src/settings/types";
import { MessageStore } from "src/simulation/stores/MessageStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { getTypeIcon, getPriorityDot } from "src/ui/helpers";
import { MessageModal } from "src/ui/modals/MessageModal";

const WARNING_THRESHOLD = 25;
const DANGER_THRESHOLD = 50;

export class MessageInboxPanel {
	private settings?: OneSeaterSettings;
	private root?: HTMLElement;
	private header?: HTMLElement;
	private headerCount?: HTMLElement;
	private unreadCount?: HTMLElement;
	private listEl?: HTMLElement;
	private sleepingOverlay?: HTMLElement;
	private playerEnergy = 0;

	/** DOM rows keyed by message ID */
	private rows = new Map<string, HTMLElement>();
	private pendingRemovals = new Set<string>();
	private isSleeping = false;

	constructor(private store: MessageStore, private events: IEventBus, private app?: App) {}

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

		this.sleepingOverlay?.toggleClass("is-visible", sleeping);
	}

	mount(parent: HTMLElement) {
		this.registerEvents();

		this.root = parent.createDiv({ cls: "mm-inbox" });

		// Header
		this.header = this.root.createDiv({ cls: "mm-inbox__header" });

		const titleWrap = this.header.createDiv({
			cls: "mm-inbox__title-wrap",
		});
		titleWrap.createDiv({ cls: "mm-inbox__icon", text: "📬" });
		titleWrap.createDiv({ cls: "mm-inbox__title", text: "Inbox" });

		const badges = this.header.createDiv({ cls: "mm-inbox__badges" });

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

		this.listEl = this.root.createDiv({ cls: "mm-inbox__list" });

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

	// === Public API ===

	/**
	 * Full sync from store - use sparingly (e.g., on mount, after bulk operations)
	 */
	fullSync() {
		if (!this.store) return;
		this.clearView();

		const activeMessages = this.store.getActiveMessages();

		if (!this.listEl) return;

		// Newest first
		const sorted = [...activeMessages].sort(
			(a, b) => b.simNowMs - a.simNowMs
		);

		for (const msg of sorted) {
			if (this.rows.has(msg.id)) continue;

			const row = this.createRow(msg);
			this.rows.set(msg.id, row);
			this.listEl.appendChild(row);
		}

		this.syncCounts();
		this.setSleeping(this.isSleeping);

		if (sorted.length === 0) {
			this.showEmptyState();
		}
	}

	/**
	 * Sync counts from store
	 */
	syncCounts() {
		if (!this.store) return;
		const active = this.store.getActiveMessages();
		const unread = active.filter((m) => !m.read_at).length;

		this.setCount(active.length);
		this.updateUnreadCount(unread);
	}

	setPlayerEnergy(v: number) {
		this.playerEnergy = v;
	}

	destroy() {
		this.clearView();
		this.pendingRemovals.clear();
		this.root?.remove();
		this.root = undefined;
		this.listEl = undefined;
		this.header = undefined;
		this.headerCount = undefined;
		this.unreadCount = undefined;
		this.sleepingOverlay = undefined;
		this.isSleeping = false;

		this.unregisterEvents();
	}

	// === Getters (delegate to store) ===

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

	// === Private: Events ===

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
	};

	private onMessageRead = (e: MessageReadEvent) => {
		if (!this.store) return;
		const msg = this.store.findMessage(e.messageId);
		if (!msg) return;

		this.updateRow(msg);
		this.syncCounts();
	};

	private onMessageSpam = (e: MessageMarkedAsSpamEvent) => {
		this.removeRow(e.messageId);
	};

	private onMessageDeleted = (e: MessageDeletedEvent) => {
		this.removeRow(e.messageId);
	};

	// === Private: Row Management ===

	private addRow(msg: SimulationMessage) {
		if (!this.listEl) return;
		if (this.rows.has(msg.id) || this.pendingRemovals.has(msg.id)) return;

		// Remove empty state
		this.listEl.querySelector(".mm-inbox__empty")?.remove();

		const row = this.createRow(msg);
		this.rows.set(msg.id, row);

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
				this.showEmptyState();
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

	// === Private: UI Updates ===

	private setCount(count: number) {
		if (!this.headerCount || !this.settings) return;

		const max = this.settings.game.maxMessages;
		const remaining = max - count;

		this.headerCount.setText(`${count}/${max}`);
		this.headerCount.title = `${remaining} slots remaining`;
		this.headerCount.removeClass("is-warning", "is-danger");

		// Thresholds relativ zum Limit (z.B. 50%, 80%)
		const TRESHOLD = 0.8;
		const fillPercent = count / max;

		if (fillPercent >= TRESHOLD) {
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

	private showEmptyState() {
		if (!this.listEl) return;
		if (this.listEl.querySelector(".mm-inbox__empty")) return;

		const empty = this.listEl.createDiv({ cls: "mm-inbox__empty" });
		empty.createDiv({ cls: "mm-inbox__empty-icon", text: "📭" });
		empty.createDiv({ cls: "mm-inbox__empty-title", text: "No messages" });
		empty.createDiv({
			cls: "mm-inbox__empty-subtitle",
			text: "New messages will appear here",
		});
	}

	// === Private: UI Creation ===

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

	// === Private: Actions ===

	private requestAction(action: MessageAction, id: string) {
		if (this.isSleeping) return;
		this.events.publish(
			new MessageActionRequestedEvent(id, action, "inbox")
		);
	}

	private openMessage(id: string) {
		if (this.isSleeping || !this.store) return;

		// Always get fresh from store
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

	// === Private: Gating ===

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

			// Fresh check from store
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
