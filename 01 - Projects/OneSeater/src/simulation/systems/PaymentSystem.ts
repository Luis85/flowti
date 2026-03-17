import { createSystem, ReadEvents, WriteEvents, ReadResource, Storage } from "sim-ecs";
import { NewMessageReceivedEvent } from "src/eventsystem/messages/NewMessageReceivedEvent";
import { OrderShippedEvent } from "src/eventsystem/orders/OrderShippedEvent";
import { PaymentCollectedEvent } from "src/eventsystem/orders/PaymentCollectedEvent";
import { PaymentFailedEvent } from "src/eventsystem/orders/PaymentFailedEvent";
import { PaymentReceivedEvent } from "src/eventsystem/orders/PaymentReceivedEvent";
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG, DAY_IN_MS } from "src/models/Payment";
import { SalesOrder } from "src/models/SalesOrder";
import { LineItem } from "src/orders";
import { GameSettingsStore } from "../stores/GameSettingsStore";
import { SimulationStore } from "../stores/SimulationStore";

/** ---------------------------
 *  Internal state
 *  --------------------------*/
type ScheduledPayment = {
	order: SalesOrder;
	dueAtSimMs: number;
	amount: number;
	customer: string;
	subject: string;
};

type PaymentSystemState = {
	scheduled: Record<string, ScheduledPayment>; // orderId -> scheduled payment
};

/** ---------------------------
 *  System
 *  --------------------------*/
export const PaymentSystem = createSystem({
	orderShippedRead: ReadEvents(OrderShippedEvent),
	paymentWrite: WriteEvents(PaymentReceivedEvent),

	paymentCollectedRead: ReadEvents(PaymentCollectedEvent),
	paymentFailedWrite: WriteEvents(PaymentFailedEvent),

	msgWrite: WriteEvents(NewMessageReceivedEvent),

	simStore: ReadResource(SimulationStore),
	settings: ReadResource(GameSettingsStore),

	systemState: Storage<PaymentSystemState>({
		scheduled: {},
	}),
})
	.withRunFunction((ctx) => {
		const {
			orderShippedRead,
			paymentWrite,
			paymentCollectedRead,
			paymentFailedWrite,
			msgWrite,
			simStore,
			settings,
			systemState,
		} = ctx;

		if (simStore.paused) return;

		const now = simStore.simNowMs;
		const cfg: PaymentConfig = DEFAULT_PAYMENT_CONFIG;
		cfg.paymentDelayMs = settings.paymentDelayDays * DAY_IN_MS
		cfg.paymentJitterMs = settings.paymentJitterDays * DAY_IN_MS
		cfg.paymentSuccessChance = settings.paymentSuccessChance

		// A) schedule (OrderShipped -> plan payment)
		for (const shipped of orderShippedRead.iter()) {
			scheduleForOrder(systemState, now, cfg, shipped.order);
		}

		// B) emit due payments (plan -> PaymentReceived + inbox message + store payment)
		for (const [orderId, sp] of Object.entries(systemState.scheduled)) {
			if (now < sp.dueAtSimMs) continue;

			const paymentId = createPaymentId(orderId);

			if (Math.random() <= clamp01(cfg.paymentSuccessChance)) {
				void paymentWrite.publish(
					new PaymentReceivedEvent(
						sp.customer,
						sp.subject,
						sp.amount,
						sp.order
					)
				);
				emitPaymentSideEffects({
					simStore,
					now,
					orderId,
					sp,
					msgWrite,
				});
			} else {
				const order = simStore.orders.find((o) => o.id === orderId);
				if (order) order.status = "failed";
				void paymentFailedWrite.publish(
					new PaymentFailedEvent(paymentId)
				);
			}

			delete systemState.scheduled[orderId];
		}

		// C) collect payments (PaymentCollected -> update store + TaskFinished)
		for (const collected of paymentCollectedRead.iter()) {
			
			const payment = simStore.payments.find(
				(p) => p.id === collected.paymentId
			);
			
			if (!payment) {
				console.log('could not find order for payment', collected, simStore.payments);
				continue;
			}

			payment.status = "collected";
		}
	})
	.build();

/** ---------------------------
 *  Helpers
 *  --------------------------*/
function clamp01(x: number) {
	return Math.max(0, Math.min(1, x));
}

function randBetween(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function calcOrderTotal(order: SalesOrder): number {
	return order.lineItems.reduce((sum: number, li: LineItem) => {
		const qty = li.quantity ?? 0;
		const price = li.price ?? 0;
		return sum + qty * price;
	}, 0);
}

function createPaymentId(orderId: string) {
	return `${orderId}`;
}

function scheduleForOrder(
	state: PaymentSystemState,
	now: number,
	cfg: PaymentConfig,
	order: SalesOrder
) {
	const orderId = order.id;
	if (state.scheduled[orderId]) return; // idempotent

	const jitter =
		cfg.paymentJitterMs > 0
			? randBetween(-cfg.paymentJitterMs, cfg.paymentJitterMs)
			: 0;

	const dueAtSimMs = now + Math.max(0, cfg.paymentDelayMs + jitter);
	const amount = cfg.useOrderTotal ? calcOrderTotal(order) : cfg.fixedAmount;

	state.scheduled[orderId] = {
		order,
		dueAtSimMs,
		amount,
		customer: order.customer,
		subject: `${cfg.subjectPrefix} ${orderId}`,
	};
}

function emitPaymentSideEffects(args: {
	simStore: SimulationStore;
	now: number;
	orderId: string;
	sp: ScheduledPayment;
	msgWrite: { publish: (e: NewMessageReceivedEvent) => Promise<void> | void };
}) {
	const { simStore, now, orderId, sp, msgWrite } = args;

	const paymentId = createPaymentId(orderId);

	// 1) persist payment record in store
	simStore.payments.push({
		id: paymentId,
		status: "new",
		customer: sp.customer,
		subject: sp.subject,
		orderId,
		amount: sp.amount,
	});

	// 2) publish inbox message
	const message = new NewMessageReceivedEvent(
		paymentId,
		"Payment",
		paymentId,
		"2 - Normal",
		sp.customer,
		now,
		simStore.dayIndex,
		simStore.minuteOfDay,
		now,
		`${sp.subject} - You received ${sp.amount} Monies from ${sp.customer}`,
		["read", "collect", "delete", "spam"],
		["finance", "income"]
	);

	void msgWrite.publish(message);

	return paymentId;
}
