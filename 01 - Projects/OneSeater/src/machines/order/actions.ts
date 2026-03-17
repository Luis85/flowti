import { OrderCatalogUpdatedEvent } from "src/eventsystem/orders/OrderCatalogUpdated";
import { OrderClosedEvent } from "src/eventsystem/orders/OrderClosedEvent";
import { OrderDeletedEvent } from "src/eventsystem/orders/OrderDeletedEvent";
import { OrderShippedEvent } from "src/eventsystem/orders/OrderShippedEvent";
import { OrderUpdatedEvent } from "src/eventsystem/orders/OrderUpdatedEvent";
import { SalesOrderCreatedEvent } from "src/eventsystem/orders/SalesOrderCreatedEvent";
import { TaskFinishedEvent, TaskKind } from "src/eventsystem/tasks/TaskFinishedEvent";
import { SalesOrder, OrderStatus } from "src/models/SalesOrder";
import { SimulationMessage } from "src/models/SimulationMessage";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { findOrderIndex, validateCreate, createTransitionKey, validateProcess, validateShip, calculateTotalQuantity, validateClose, validatePay, validateFail, validateCancel, validateDelete } from "./guards";
import { RejectionReason, ORDER_TASK_MAP, ActionSource, LastOrderAction } from "./types";
import { IEventBus } from "src/eventsystem";



export type ExecuteResult =
	| { success: true; order: SalesOrder }
	| { success: false; reason: RejectionReason };

/**
 * Create a SalesOrder from a CustomerPurchaseOrder message
 */
export function createOrderFromMessage(
	store: SimulationStore,
	message: SimulationMessage
): SalesOrder {
	const order: SalesOrder = {
		type: "SalesOrder",
		id: `${message.id} - Sales Order`,
		status: "new",
		customer: message.author,
		customerPo: { ...message },
		taker: "Player",
		shipToAddress: message.author,
		billToAddress: message.author,
		lineItems: message.lineItems || [],
		createdAt: store.simNowMs,
	};

	store.orders.push(order);
	return order;
}

/**
 * Update order status
 */
export function updateOrderStatus(
	store: SimulationStore,
	orderId: string,
	newStatus: OrderStatus
): SalesOrder | null {
	const idx = findOrderIndex(store, orderId);
	if (idx < 0) return null;

	const order = store.orders[idx];
	const updatedOrder: SalesOrder = {
		...order,
		status: newStatus,
		updatedAt: store.simNowMs,
	};

	// Add status-specific timestamps
	switch (newStatus) {
		case "active":
			updatedOrder.processedAt = store.simNowMs;
			break;
		case "shipped":
			updatedOrder.shippedAt = store.simNowMs;
			break;
		case "closed":
			updatedOrder.closedAt = store.simNowMs;
			break;
		case "paid":
			updatedOrder.paidAt = store.simNowMs;
			break;
		case "failed":
			// No specific timestamp, but we track the status
			break;
		case "cancelled":
			updatedOrder.cancelledAt = store.simNowMs;
			break;
	}

	store.orders[idx] = updatedOrder;
	return updatedOrder;
}

/**
 * Delete an order from the store
 */
export function deleteOrder(store: SimulationStore, orderId: string): boolean {
	const idx = findOrderIndex(store, orderId);
	if (idx < 0) return false;

	store.orders.splice(idx, 1);
	return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Publishers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publish SalesOrderCreatedEvent
 */
export function publishOrderCreated(bus: IEventBus, order: SalesOrder): void {
	bus.publish(new SalesOrderCreatedEvent(order));
}

/**
 * Publish OrderUpdatedEvent
 */
export function publishOrderUpdated(bus: IEventBus, order: SalesOrder): void {
	bus.publish(new OrderUpdatedEvent(order));
}

/**
 * Publish OrderShippedEvent
 */
export function publishOrderShipped(bus: IEventBus, order: SalesOrder): void {
	bus.publish(new OrderShippedEvent(order));
}

/**
 * Publish OrderClosedEvent
 */
export function publishOrderClosed(bus: IEventBus, order: SalesOrder): void {
	bus.publish(new OrderClosedEvent(order));
}

/**
 * Publish OrderDeletedEvent
 */
export function publishOrderDeleted(bus: IEventBus, order: SalesOrder): void {
	bus.publish(new OrderDeletedEvent(order));
}

/**
 * Publish OrderCatalogUpdatedEvent
 */
export function publishCatalogUpdated(
	bus: IEventBus,
	orders: SalesOrder[]
): void {
	bus.publish(new OrderCatalogUpdatedEvent(orders));
}

/**
 * Publish TaskFinishedEvent for order transition
 */
export function publishOrderTask(
	bus: IEventBus,
	orderId: string,
	transitionKey: string,
	lineItemCount: number,
	totalQuantity: number,
	metadata: Record<string, unknown> = {}
): void {
	const taskDef = ORDER_TASK_MAP[transitionKey];
	if (!taskDef) return;

	// Calculate scaled values based on line items or quantity
	const multiplier = taskDef.perItemMultiplier ?? 0;
	const scaleValue =
		transitionKey === "active->shipped" ? totalQuantity : lineItemCount;

	const energy = taskDef.baseEnergy + multiplier * scaleValue;
	const time = taskDef.baseTime + multiplier * scaleValue;
	const xp = Math.round(taskDef.baseXp + multiplier * scaleValue);

	bus.publish(
		new TaskFinishedEvent(
			`order:${orderId}:${transitionKey.replace("->", "-")}`,
			taskDef.taskKind as TaskKind,
			"customer",
			energy,
			time,
			xp,
			{ orderId, transition: transitionKey, ...metadata },
			taskDef.tags
		)
	);
}

/**
 * EXECUTIONERS
 * 
 */

/**
 * Execute order creation
 */
export function executeCreate(
	bus: IEventBus,
	store: SimulationStore,
	message: SimulationMessage,
	publishedTransitions: Set<string>,
	source: ActionSource
): ExecuteResult {
	// Validate
	const validation = validateCreate(store, message);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Create order
	const order = createOrderFromMessage(store, message);

	// Publish events
	publishOrderCreated(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Publish task
	const lineItemCount = order.lineItems?.length || 0;
	publishOrderTask(bus, order.id, "create", lineItemCount + 1, 0, {
		messageId: message.id,
	});

	// Mark transition as published
	publishedTransitions.add(createTransitionKey(order.id, "new"));

	return { success: true, order };
}

/**
 * Execute process action (new → active)
 */
export function executeProcess(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource
): ExecuteResult {
	// Validate
	const validation = validateProcess(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Check if transition already published
	const transitionKey = createTransitionKey(orderId, "active");
	if (publishedTransitions.has(transitionKey)) {
		// Already processed, return success but don't re-publish
		return { success: true, order: validation.order };
	}

	// Update status
	const order = updateOrderStatus(store, orderId, "active");
	if (!order) {
		return { success: false, reason: "ORDER_NOT_FOUND" };
	}

	// Publish events
	publishOrderUpdated(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Publish task
	const lineItemCount = order.lineItems?.length || 1;
	publishOrderTask(bus, orderId, "new->active", lineItemCount, 0);

	// Mark transition
	publishedTransitions.add(transitionKey);

	return { success: true, order };
}

/**
 * Execute ship action (active → shipped)
 */
export function executeShip(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource
): ExecuteResult {
	// Validate
	const validation = validateShip(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Check if transition already published
	const transitionKey = createTransitionKey(orderId, "shipped");
	if (publishedTransitions.has(transitionKey)) {
		return { success: true, order: validation.order };
	}

	// Update status
	const order = updateOrderStatus(store, orderId, "shipped");
	if (!order) {
		return { success: false, reason: "ORDER_NOT_FOUND" };
	}

	// Publish events
	publishOrderShipped(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Publish task - use quantity for shipping
	const totalQuantity = calculateTotalQuantity(order.lineItems);
	publishOrderTask(bus, orderId, "active->shipped", 0, totalQuantity);

	// Mark transition
	publishedTransitions.add(transitionKey);

	return { success: true, order };
}

/**
 * Execute close action (shipped → closed)
 */
export function executeClose(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource
): ExecuteResult {
	// Validate
	const validation = validateClose(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Check if transition already published
	const transitionKey = createTransitionKey(orderId, "closed");
	if (publishedTransitions.has(transitionKey)) {
		return { success: true, order: validation.order };
	}

	// Update status
	const order = updateOrderStatus(store, orderId, "closed");
	if (!order) {
		return { success: false, reason: "ORDER_NOT_FOUND" };
	}

	// Publish events
	publishOrderClosed(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Publish task
	publishOrderTask(bus, orderId, "shipped->closed", 0, 0);

	// Mark transition
	publishedTransitions.add(transitionKey);

	return { success: true, order };
}

/**
 * Execute pay action (shipped → paid)
 */
export function executePay(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource
): ExecuteResult {
	// Validate
	const validation = validatePay(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Check if transition already published
	const transitionKey = createTransitionKey(orderId, "paid");
	if (publishedTransitions.has(transitionKey)) {
		return { success: true, order: validation.order };
	}

	// Update status
	const order = updateOrderStatus(store, orderId, "paid");
	if (!order) {
		return { success: false, reason: "ORDER_NOT_FOUND" };
	}

	// Publish events
	publishOrderUpdated(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Publish task
	publishOrderTask(bus, orderId, "shipped->paid", 0, 0);

	// Mark transition
	publishedTransitions.add(transitionKey);

	return { success: true, order };
}

/**
 * Execute fail action (shipped → failed)
 */
export function executeFail(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource,
	reason?: string
): ExecuteResult {
	// Validate
	const validation = validateFail(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Check if transition already published
	const transitionKey = createTransitionKey(orderId, "failed");
	if (publishedTransitions.has(transitionKey)) {
		return { success: true, order: validation.order };
	}

	// Update status
	const order = updateOrderStatus(store, orderId, "failed");
	if (!order) {
		return { success: false, reason: "ORDER_NOT_FOUND" };
	}

	// Store failure reason if provided
	if (reason) {
		order.cancellationReason = reason; // Reuse cancellationReason for failure reason
	}

	// Publish events
	publishOrderUpdated(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Publish task
	publishOrderTask(bus, orderId, "shipped->failed", 0, 0);

	// Mark transition
	publishedTransitions.add(transitionKey);

	return { success: true, order };
}

/**
 * Execute cancel action (any → cancelled)
 */
export function executeCancel(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource,
	reason?: string
): ExecuteResult {
	// Validate
	const validation = validateCancel(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	// Check if transition already published
	const transitionKey = createTransitionKey(orderId, "cancelled");
	if (publishedTransitions.has(transitionKey)) {
		return { success: true, order: validation.order };
	}

	// Update status
	const order = updateOrderStatus(store, orderId, "cancelled");
	if (!order) {
		return { success: false, reason: "ORDER_NOT_FOUND" };
	}

	// Store cancellation reason
	if (reason) {
		order.cancellationReason = reason;
	}

	// Publish events
	publishOrderUpdated(bus, order);
	publishCatalogUpdated(bus, store.orders);

	// Mark transition
	publishedTransitions.add(transitionKey);

	return { success: true, order };
}

/**
 * Execute delete action
 */
export function executeDelete(
	bus: IEventBus,
	store: SimulationStore,
	orderId: string,
	publishedTransitions: Set<string>,
	source: ActionSource
): ExecuteResult {
	// Validate
	const validation = validateDelete(store, orderId);
	if (!validation.valid) {
		return { success: false, reason: validation.reason };
	}

	const order = validation.order;

	// Delete from store
	deleteOrder(store, orderId);

	// Clean up transition tracking
	for (const key of publishedTransitions) {
		if (key.startsWith(orderId)) {
			publishedTransitions.delete(key);
		}
	}

	// Publish events
	publishOrderDeleted(bus, order);
	publishCatalogUpdated(bus, store.orders);

	return { success: true, order };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create LastOrderAction result
// ─────────────────────────────────────────────────────────────────────────────

export function createLastActionResult(
	orderId: string,
	action: string,
	result: ExecuteResult
): LastOrderAction {
	return {
		orderId,
		action: action as LastOrderAction["action"],
		success: result.success,
		reason: result.success ? undefined : result.reason,
		timestamp: Date.now(),
	};
}
