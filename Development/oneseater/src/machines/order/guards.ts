import { SalesOrder, OrderStatus } from "src/models/SalesOrder";
import { SimulationMessage } from "src/models/SimulationMessage";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import {
	CreateValidationResult,
	ValidationResult,
	RejectionReason,
} from "./types";
import { LineItem } from "src/orders";

/**
 * Get valid transitions from a status
 */
export function getValidTransitions(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case "new":
      return ["active", "cancelled"];
    case "active":
      return ["shipped", "cancelled"];
    case "shipped":
      return ["closed", "cancelled", "paid"];
    case "closed":
      return ["paid"]; 
	case "paid":
		return [];// Terminal state
    case "cancelled":
      return []; // Terminal state
    default:
      return [];
  }
}

/**
 * Find an order by ID
 */
export function findOrder(
	store: SimulationStore,
	orderId: string
): SalesOrder | undefined {
	return store.orders.find((o) => o.id === orderId);
}

/**
 * Find order index by ID
 */
export function findOrderIndex(
	store: SimulationStore,
	orderId: string
): number {
	return store.orders.findIndex((o) => o.id === orderId);
}

/**
 * Check if an order exists
 */
export function orderExists(store: SimulationStore, orderId: string): boolean {
	return findOrderIndex(store, orderId) >= 0;
}

/**
 * Check if order already exists for a message (prevent duplicates)
 */
export function orderExistsForMessage(
	store: SimulationStore,
	messageId: string
): boolean {
	return store.orders.some((o) => o.customerPo?.id === messageId);
}

/**
 * Get orders by status
 */
export function getOrdersByStatus(
	store: SimulationStore,
	status: OrderStatus
): SalesOrder[] {
	return store.getOrdersByStatus(status)
}

/**
 * Get active (non-terminal) orders
 */
export function getActiveOrders(store: SimulationStore): SalesOrder[] {
	return store.getActiveOrders();
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate order creation from CustomerPurchaseOrder message
 */
export function validateCreate(
	store: SimulationStore,
	message: SimulationMessage
): CreateValidationResult {
	// Must be CustomerPurchaseOrder type
	if (message.type !== "CustomerPurchaseOrder") {
		return { valid: false, reason: "INVALID_MESSAGE_TYPE" };
	}

	// Must have line items
	if (!message.lineItems || message.lineItems.length === 0) {
		return { valid: false, reason: "MISSING_LINE_ITEMS" };
	}

	// Check for duplicate
	if (orderExistsForMessage(store, message.id)) {
		return { valid: false, reason: "ORDER_ALREADY_EXISTS" };
	}

	return { valid: true, message };
}

/**
 * Validate order transition
 */
export function validateTransition(
	store: SimulationStore,
	orderId: string,
	targetStatus: OrderStatus
): ValidationResult {
	const order = findOrder(store, orderId);

	if (!order) {
		return { valid: false, reason: "ORDER_NOT_FOUND" };
	}

	const currentStatus = order.status;

	// Check terminal states
	if (currentStatus === "closed" && targetStatus !== "paid") {
		return { valid: false, reason: "ORDER_ALREADY_CLOSED" };
	}

	if (currentStatus === "cancelled") {
		return { valid: false, reason: "ORDER_ALREADY_CANCELLED" };
	}

	// Check valid transition
	if (!isValidTransition(currentStatus, targetStatus)) {
		return { valid: false, reason: "INVALID_TRANSITION" };
	}

	return { valid: true, order };
}

/**
 * Validate order deletion
 */
export function validateDelete(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	const order = findOrder(store, orderId);

	if (!order) {
		return { valid: false, reason: "ORDER_NOT_FOUND" };
	}

	return { valid: true, order };
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite Validation for Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate process action (new → active)
 */
export function validateProcess(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	return validateTransition(store, orderId, "active");
}

/**
 * Validate ship action (active → shipped)
 */
export function validateShip(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	return validateTransition(store, orderId, "shipped");
}

/**
 * Validate close action (shipped/paid → closed)
 */
export function validateClose(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	return validateTransition(store, orderId, "closed");
}

/**
 * Validate pay action (shipped → paid)
 */
export function validatePay(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	const order = store.findOrder(orderId)
	if(!order) return {valid: false, reason: "ORDER_NOT_FOUND"}
	return validateTransition(store, orderId, "paid");
}

/**
 * Validate fail action (shipped → failed)
 */
export function validateFail(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	return validateTransition(store, orderId, "failed");
}

/**
 * Validate cancel action (any non-terminal → cancelled)
 */
export function validateCancel(
	store: SimulationStore,
	orderId: string
): ValidationResult {
	return validateTransition(store, orderId, "cancelled");
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable rejection messages
// ─────────────────────────────────────────────────────────────────────────────

export const REJECTION_MESSAGES: Record<RejectionReason, string> = {
	ORDER_NOT_FOUND: "Order not found.",
	ORDER_ALREADY_EXISTS: "Order already exists for this purchase order.",
	INVALID_MESSAGE_TYPE: "Message must be a CustomerPurchaseOrder.",
	INVALID_TRANSITION: "Invalid status transition.",
	ORDER_ALREADY_CLOSED: "Order is already closed.",
	ORDER_ALREADY_CANCELLED: "Order is already cancelled.",
	ORDER_ALREADY_PAID: "Order is already marked as paid.",
	ORDER_ALREADY_FAILED: "Order payment has already failed.",
	MISSING_LINE_ITEMS: "Order must have at least one line item.",
} as const;


/**
 * Create a transition key for duplicate tracking
 */
export function createTransitionKey(orderId: string, status: OrderStatus): string {
  return `${orderId}:${status}`;
}

/**
 * Calculate total quantity from line items
 */
export function calculateTotalQuantity(lineItems: LineItem[] | undefined): number {
  if (!lineItems) return 0;
  return lineItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}


/**
 * Check if transition is valid
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return getValidTransitions(from).includes(to);
}
