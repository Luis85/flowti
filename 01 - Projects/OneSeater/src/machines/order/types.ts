import { IEventBus } from "src/eventsystem";
import { OrderStatus, SalesOrder } from "src/models/SalesOrder";
import { SimulationMessage } from "src/models/SimulationMessage";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export type OrderAction =
  | "create"      // Accept CustomerPurchaseOrder → create SalesOrder
  | "process"     // new → active
  | "ship"        // active → shipped
  | "close"       // shipped → closed
  | "cancel"      // any → cancelled
  | "delete";     // remove from store

export type ActionSource = "system" | "player" | "auto" | "ui";

// ─────────────────────────────────────────────────────────────────────────────
// Task Definitions (XP, Energy, Time rewards)
// ─────────────────────────────────────────────────────────────────────────────

export type TaskDefinition = {
  taskKind: string;
  baseEnergy: number;
  baseTime: number;
  baseXp: number;
  tags: string[];
  /** Multiplier applied to lineItems count */
  perItemMultiplier?: number;
};

/**
 * Task definitions for each order transition
 * Energy/Time/XP scale with line item count
 */
export const ORDER_TASK_MAP: Record<string, TaskDefinition> = {
  "new->active": {
    taskKind: "order:processing",
    baseEnergy: 1,
    baseTime: 2,
    baseXp: 3,
    tags: ["operations"],
    perItemMultiplier: 1.2,
  },
  "active->shipped": {
    taskKind: "order:shipping",
    baseEnergy: 1,
    baseTime: 2,
    baseXp: 3,
    tags: ["operations", "logistics"],
    perItemMultiplier: 0.8, // per quantity
  },
  "shipped->closed": {
    taskKind: "order:closing",
    baseEnergy: 5,
    baseTime: 15,
    baseXp: 30,
    tags: ["operations", "finance"],
  },
  "create": {
    taskKind: "order:creation",
    baseEnergy: 1,
    baseTime: 0,
    baseXp: 2,
    tags: ["operations"],
    perItemMultiplier: 1,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Machine Events
// ─────────────────────────────────────────────────────────────────────────────

/** Create a new order from accepted CustomerPurchaseOrder */
export type OrderCreateEvent = {
  type: "order:create";
  message: SimulationMessage;
  source: ActionSource;
};

/** Process order: new → active */
export type OrderProcessEvent = {
  type: "order:process";
  orderId: string;
  source: ActionSource;
};

/** Ship order: active → shipped */
export type OrderShipEvent = {
  type: "order:ship";
  orderId: string;
  source: ActionSource;
};

/** Close order: shipped → closed */
export type OrderCloseEvent = {
  type: "order:close";
  orderId: string;
  source: ActionSource;
};

/** Cancel order (from any state except closed) */
export type OrderCancelEvent = {
  type: "order:cancel";
  orderId: string;
  reason?: string;
  source: ActionSource;
};

/** Delete order from store */
export type OrderDeleteEvent = {
  type: "order:delete";
  orderId: string;
  source: ActionSource;
};

/** Delete order from store */
export type OrderPayEvent = {
  type: "order:pay";
  orderId: string;
  source: ActionSource;
};

/** Delete order from store */
export type OrderFailEvent = {
  type: "order:fail";
  orderId: string;
  reason?: string;
  source: ActionSource;
};

/** Sync request (e.g., after loading saved state) */
export type OrderSyncEvent = {
  type: "order:sync";
};

export type OrderMachineEvent =
  | OrderCreateEvent
  | OrderProcessEvent
  | OrderShipEvent
  | OrderCloseEvent
  | OrderCancelEvent
  | OrderDeleteEvent
  | OrderPayEvent
  | OrderFailEvent
  | OrderSyncEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Machine Context
// ─────────────────────────────────────────────────────────────────────────────

export type OrderTransition = {
  orderId: string;
  from: OrderStatus | "none";
  to: OrderStatus | "deleted";
  timestamp: number;
};

export type LastOrderAction = {
  orderId: string;
  action: OrderAction;
  success: boolean;
  reason?: string;
  timestamp: number;
};

export type OrderContext = {
  bus: IEventBus;
  store: SimulationStore;
  /** Track published transitions to prevent duplicates */
  publishedTransitions: Set<string>;
  /** Last action result */
  lastAction?: LastOrderAction;
  /** Processing count for stats */
  processingCount: number;
};

export type OrderInput = {
  bus: IEventBus;
  store: SimulationStore;
};

// ─────────────────────────────────────────────────────────────────────────────
// Rejection Reasons
// ─────────────────────────────────────────────────────────────────────────────

export type RejectionReason =
  | "ORDER_NOT_FOUND"
  | "ORDER_ALREADY_EXISTS"
  | "INVALID_MESSAGE_TYPE"
  | "INVALID_TRANSITION"
  | "ORDER_ALREADY_CLOSED"
  | "ORDER_ALREADY_CANCELLED"
  | "ORDER_ALREADY_PAID"
  | "ORDER_ALREADY_FAILED"
  | "MISSING_LINE_ITEMS";

// ─────────────────────────────────────────────────────────────────────────────
// Validation Result
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true; order: SalesOrder }
  | { valid: false; reason: RejectionReason };

export type CreateValidationResult =
  | { valid: true; message: SimulationMessage }
  | { valid: false; reason: RejectionReason };
