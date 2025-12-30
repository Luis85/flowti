import { EventType, IEventBus } from "src/eventsystem";
import { InboxFullEvent } from "src/eventsystem/messages/InboxFullEvent";
import { InboxEvent } from "src/eventsystem/messages/InboxMachine";
import { MessageActionRequestedEvent } from "src/eventsystem/messages/MessageActionRequestedEvent";
import { MessageAddedEvent } from "src/eventsystem/messages/MessageAddedEvent";
import { NewMessageReceivedEvent } from "src/eventsystem/messages/NewMessageReceivedEvent";
import { ResetInboxEvent } from "src/eventsystem/messages/ResetInboxEvent";
import { SimulationMessage } from "src/models/SimulationMessage";
import { OneSeaterSettings } from "src/settings/types";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { InboxController } from "./InboxController";
import { MessageStore } from "src/simulation/stores/MessageStore";
export class InboxEventBridge {
	private controller: InboxController;
	private unsubscribers: Array<() => void> = [];
	private inboxWasFull = false;

	constructor(
		private bus: IEventBus,
		private simStore: SimulationStore,
		private msgStore: MessageStore,
		private settings: OneSeaterSettings,
	) {
		// Create the inbox controller (starts the XState actor)
		this.controller = new InboxController(bus, simStore, msgStore);

		// Bridge EventBus events to XState machine
		this.setupEventBridge();
	}

	private setupEventBridge(): void {
		// ─────────────────────────────────────────────────────────────────────────
		// Handle action requests (read, delete, spam, etc.)
		// ─────────────────────────────────────────────────────────────────────────
		this.subscribe(MessageActionRequestedEvent, (event: MessageActionRequestedEvent) => {
			this.controller.action(event.messageId, event.action, event.source);
		});

		// ─────────────────────────────────────────────────────────────────────────
		// Handle new messages
		// ─────────────────────────────────────────────────────────────────────────
		this.subscribe(NewMessageReceivedEvent, (event: NewMessageReceivedEvent) => {
			this.handleNewMessage(event);
		});

		// ─────────────────────────────────────────────────────────────────────────
		// Handle inbox reset
		// ─────────────────────────────────────────────────────────────────────────
		this.subscribe(ResetInboxEvent, () => {
			this.handleInboxReset();
		});
	}

	/**
	 * Handle incoming new message
	 */
	private handleNewMessage(event: NewMessageReceivedEvent): void {
		const isFull = this.msgStore.isInboxFull(this.settings.game.maxMessages);

		// Check if inbox is full
		if (isFull) {
			// Only fire event on transition to full
			if (!this.inboxWasFull) {
				this.inboxWasFull = true;
				this.bus.publish(new InboxFullEvent());
				console.warn(`[Inbox] Inbox full (${this.settings.game.maxMessages})`);
			}
			return;
		}

		// Reset flag when space available again
		if (this.inboxWasFull) {
			this.inboxWasFull = false;
		}

		const message: SimulationMessage = {
			id: event.id,
			type: event.type,
			subject: event.subject,
			priority: event.priority,
			author: event.author,
			simNowMs: event.simNowMs,
			dayIndex: event.dayIndex,
			minuteOfDay: event.minuteOfDay,
			timestamp: event.timestamp,
			body: event.body,
			possible_actions: event.possible_actions,
			tags: event.tags,
			lineItems: event.lineItems,
			read_at: event.read_at,
			deleted_at: event.deleted_at,
			spam_at: event.spam_at,
			is_spam: event.is_spam,
		};

		const added = this.msgStore.addMessage(message);

		if (added) {
			this.bus.publish(new MessageAddedEvent(message));
			this.controller.send({ type: "inbox:message:new", message });
		}
	}

	/**
	 * handle incoming helping hands
	 */
	private handleInboxReset(): void {
		this.controller.send({ type: "inbox:reset" });
	}

	/**
	 * Helper to subscribe and track for cleanup
	 */
	private subscribe<T>(
		eventType: EventType<T>,
		handler: (event: T) => void
	): void {
		this.bus.subscribe(eventType, handler);
		this.unsubscribers.push(() => {
			this.bus.unsubscribe(eventType, handler);
		});
	}

	/**
	 * Direct access to send events to the machine
	 */
	send(event: InboxEvent): void {
		this.controller.send(event);
	}

	/**
	 * Get the controller for direct access
	 */
	getController(): InboxController {
		return this.controller;
	}

	/**
	 * Get current inbox stats (delegates to store)
	 */
	getStats() {
		return this.msgStore.getInboxStats();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.unsubscribers.forEach((unsub) => unsub());
		this.unsubscribers = [];
		this.controller.destroy();
	}
}
