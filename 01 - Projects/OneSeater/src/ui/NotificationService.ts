import { Notice } from "obsidian";
import { EventType, IEventBus } from "src/eventsystem";
import { InboxFullEvent } from "src/eventsystem/messages/InboxFullEvent";
import { MessageActionRejectedEvent } from "src/eventsystem/messages/MessageActionRejectedEvent";
import { NewMessageReceivedEvent } from "src/eventsystem/messages/NewMessageReceivedEvent";
import { OrderClosedEvent } from "src/eventsystem/orders/OrderClosedEvent";
import { OrderShippedEvent } from "src/eventsystem/orders/OrderShippedEvent";
import { OrderUpdatedEvent } from "src/eventsystem/orders/OrderUpdatedEvent";
import { PaymentCollectedEvent } from "src/eventsystem/orders/PaymentCollectedEvent";
import { PaymentFailedEvent } from "src/eventsystem/orders/PaymentFailedEvent";
import { SalesOrderCreatedEvent } from "src/eventsystem/orders/SalesOrderCreatedEvent";
import { TaskFinishedEvent } from "src/eventsystem/tasks/TaskFinishedEvent";
import { NotificationServiceOptions, NoticeCardOptions, createNoticeCard, NoticeVariant } from "./Notice";

const DEFAULT_OPTIONS: NotificationServiceOptions = {
	orders: true,
	messages: true,
	tasks: false,
	errors: true,
};

type NoticeChannel =
	| "toast"
	| "messageSticky"
	| "inboxSticky"
	| "orders"
	| "errors"
	| "tasks";

export class NotificationService {
	private unsubscribers: Array<() => void> = [];
	private options: NotificationServiceOptions;

	// Track notices per "channel" so sticky notices replace each other cleanly
	private activeByChannel = new Map<NoticeChannel, Notice>();

	constructor(
		private bus: IEventBus,
		options: NotificationServiceOptions = {}
	) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.setupSubscriptions();
		console.log("[NotificationService] Initialized");
	}

	// ───────────────────────────────────────────────────────────────────────────
	// Public API (direct calls)
	// ───────────────────────────────────────────────────────────────────────────

	info(title: string, body?: string, meta?: string, duration = 3500) {
		return this.notifyVariant("info", { title, body, meta, duration }, "toast");
	}

	success(title: string, body?: string, meta?: string, duration = 2500) {
		return this.notifyVariant(
			"success",
			{ title, body, meta, duration },
			"toast"
		);
	}

	warning(title: string, body?: string, meta?: string, duration = 4500) {
		return this.notifyVariant(
			"warning",
			{ title, body, meta, duration },
			"toast"
		);
	}

	error(title: string, body?: string, meta?: string, duration = 6000) {
		return this.notifyVariant("error", { title, body, meta, duration }, "errors");
	}

	/**
	 * Low-level: show a card notice. If channel is given, replaces previous in that channel.
	 */
	notifyCard(
		options: NoticeCardOptions,
		channel: NoticeChannel = "toast"
	): Notice | undefined {
		// replace prior in same channel
		this.hideChannel(channel);

		const notice = createNoticeCard(options);
		if (notice) this.activeByChannel.set(channel, notice);
		return notice;
	}

	hideChannel(channel: NoticeChannel) {
		const n = this.activeByChannel.get(channel);
		if (n) n.hide();
		this.activeByChannel.delete(channel);
	}

	// ───────────────────────────────────────────────────────────────────────────
	// Subscriptions
	// ───────────────────────────────────────────────────────────────────────────

	private setupSubscriptions(): void {
		if (this.options.orders) {
			this.sub(SalesOrderCreatedEvent, this.onOrderCreated);
			this.sub(OrderUpdatedEvent, this.onOrderUpdated);
			this.sub(OrderShippedEvent, this.onOrderShipped);
			this.sub(OrderClosedEvent, this.onOrderClosed);
			this.sub(PaymentCollectedEvent, this.onPaymentCollected);
			this.sub(PaymentFailedEvent, this.onPaymentFailed);
		}

		if (this.options.messages) {
			this.sub(NewMessageReceivedEvent, this.onNewMessage);
			this.sub(InboxFullEvent, this.onInboxFull);
		}

		if (this.options.errors) {
			this.sub(MessageActionRejectedEvent, this.onMessageActionRejected);
		}

		if (this.options.tasks) {
			this.sub(TaskFinishedEvent, this.onTaskFinished);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Order Event Handlers
	// ═══════════════════════════════════════════════════════════════════════════

	private onOrderCreated = (evt: SalesOrderCreatedEvent): void => {
		const order = evt.order;
		const itemCount = order.lineItems?.length || 0;

		this.notifyCard(
			{
				variant: "info",
				title: "New Sales Order",
				meta: order.customer,
				body: `${itemCount} item${itemCount !== 1 ? "s" : ""} to process`,
				duration: 4000,
				action: this.options.onViewOrder
					? { label: "View", onClick: () => this.options.onViewOrder?.(order.id) }
					: undefined,
			},
			"orders"
		);
	};

	private onOrderUpdated = (evt: OrderUpdatedEvent): void => {
		const order = evt.order;

		switch (order.status) {
			case "active":
				this.info("Order Processing", "Order is now being processed", order.id);
				break;

			case "paid":
				this.success("Payment Received", `Payment from ${order.customer}`, order.id);
				break;

			case "failed":
				this.notifyVariant(
					"error",
					{
						title: "Payment Failed",
						meta: order.id,
						body: order.cancellationReason || "Payment could not be processed",
						duration: 6000,
						action: this.options.onViewOrder
							? { label: "Review", onClick: () => this.options.onViewOrder?.(order.id) }
							: undefined,
					},
					"errors"
				);
				break;

			case "cancelled":
				this.warning("Order Cancelled", order.cancellationReason || "Order has been cancelled", order.id);
				break;
		}
	};

	private onOrderShipped = (evt: OrderShippedEvent): void => {
		const order = evt.order;
		this.info("🚚 Order Shipped", `Shipped to ${order.customer}`, order.id, 3000);
	};

	private onOrderClosed = (evt: OrderClosedEvent): void => {
		const order = evt.order;
		this.success("Order Complete", `Order for ${order.customer} completed`, order.id, 3000);
	};

	private onPaymentCollected = (evt: PaymentCollectedEvent): void => {
		this.success("Payment Collected", "Payment has been collected successfully", evt.paymentId, 2500);
	};

	private onPaymentFailed = (evt: PaymentFailedEvent): void => {
		this.notifyVariant(
			"error",
			{
				title: "Payment Failed!",
				meta: evt.paymentId,
				body: "The payment could not be processed",
				duration: 6000,
				action: this.options.onOpenOffice
					? { label: "Inspect", onClick: () => this.options.onOpenOffice?.() }
					: undefined,
			},
			"errors"
		);
	};

	// ═══════════════════════════════════════════════════════════════════════════
	// Message Event Handlers
	// ═══════════════════════════════════════════════════════════════════════════

	private onNewMessage = (evt: NewMessageReceivedEvent): void => {
		const title = `${evt.type}: ${evt.subject}`;
		const meta = `${evt.priority} · ${evt.author}`;
		const body = evt.body.length > 50 ? `${evt.body.slice(0, 50)}...` : evt.body;

		this.notifyVariant(
			"info",
			{
				title,
				meta,
				body,
				duration: 0, // sticky
				onlyWhenNotInOffice: true,
				action: this.options.onOpenOffice
					? { label: "Inspect", onClick: () => this.options.onOpenOffice?.() }
					: undefined,
			},
			"messageSticky"
		);
	};

	private onInboxFull = (_evt: InboxFullEvent): void => {
		this.notifyVariant(
			"warning",
			{
				title: "Inbox Full!",
				meta: "Action required",
				body: "You're missing new opportunities. Clean up your inbox!",
				duration: 4500,
				action: this.options.onOpenOffice
					? { label: "Inspect", onClick: () => this.options.onOpenOffice?.() }
					: undefined,
			},
			"inboxSticky"
		);
	};

	// ═══════════════════════════════════════════════════════════════════════════
	// Error Event Handlers
	// ═══════════════════════════════════════════════════════════════════════════

	private onMessageActionRejected = (evt: MessageActionRejectedEvent): void => {
		this.notifyVariant(
			"warning",
			{
				title: "Action Failed",
				meta: evt.action,
				body: evt.reason,
				duration: 4500,
			},
			"errors"
		);
	};

	// ═══════════════════════════════════════════════════════════════════════════
	// Task/XP Event Handlers
	// ═══════════════════════════════════════════════════════════════════════════

	private onTaskFinished = (evt: TaskFinishedEvent): void => {
		if (evt.xpGain < 1) return;

		this.notifyVariant(
			"success",
			{
				title: "Task Complete",
				meta: `+${evt.xpGain} XP`,
				body: evt.kind,
				duration: 2000,
			},
			"tasks"
		);
	};

	// ───────────────────────────────────────────────────────────────────────────
	// Helpers
	// ───────────────────────────────────────────────────────────────────────────

	private notifyVariant(
		variant: NoticeVariant,
		options: Omit<NoticeCardOptions, "variant">,
		channel: NoticeChannel
	) {
		return this.notifyCard({ ...options, variant }, channel);
	}

	private sub<T>(eventType: EventType<T>, handler: (event: T) => void): void {
		this.bus.subscribe(eventType, handler);
		this.unsubscribers.push(() => this.bus.unsubscribe(eventType, handler));
	}

	setOptions(options: Partial<NotificationServiceOptions>): void {
		this.options = { ...this.options, ...options };
	}

	destroy(): void {
		this.unsubscribers.forEach((unsub) => unsub());
		this.unsubscribers = [];

		for (const n of this.activeByChannel.values()) n.hide();
		this.activeByChannel.clear();

		console.log("[NotificationService] Destroyed");
	}
}
