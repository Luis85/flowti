import { EventType, IEventBus } from "src/eventsystem";
import { OrderAcceptedEvent } from "src/eventsystem/orders/OrderAcceptedEvent";
import { OrderCancelRequestedEvent } from "src/eventsystem/orders/OrderCancelRequestedEvent";
import { OrderCloseRequestedEvent } from "src/eventsystem/orders/OrderCloseRequestedEvent";
import { OrderDeletedEvent } from "src/eventsystem/orders/OrderDeletedEvent";
import { OrderPayRequestedEvent } from "src/eventsystem/orders/OrderPayRequestedEvent";
import { OrderProcessRequestedEvent } from "src/eventsystem/orders/OrderProcessRequestedEvent";
import { OrderShipRequestedEvent } from "src/eventsystem/orders/OrderShipRequestedEvent";
import { PaymentCollectedEvent } from "src/eventsystem/orders/PaymentCollectedEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { OrderController } from "./OrderController";
import { ActionSource, OrderMachineEvent } from "./types";

export interface OrderEventBridgeOptions {
  debug?: boolean;
}

export class OrderEventBridge {
  private controller: OrderController;
  private unsubscribers: Array<() => void> = [];

  constructor(
    private bus: IEventBus,
    private store: SimulationStore,
    options: OrderEventBridgeOptions = {}
  ) {
    // Create the order controller
    this.controller = new OrderController(bus, store, {
      debug: options.debug,
    });

    // Bridge EventBus events to XState machine
    this.setupEventBridge();

    console.log("[OrderEventBridge] Initialized");
  }

  private setupEventBridge(): void {
    // ─────────────────────────────────────────────────────────────────────────
    // OrderAcceptedEvent → Create new SalesOrder
    // (from InboxMachine when player accepts a CustomerPurchaseOrder)
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderAcceptedEvent, (event: OrderAcceptedEvent) => {
      if (!event.message) {
        console.warn("[OrderEventBridge] OrderAcceptedEvent missing message");
        return;
      }

      // Only process CustomerPurchaseOrder messages
      if (event.message.type !== "CustomerPurchaseOrder") {
        return;
      }

      this.controller.create(event.message, "system");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OrderProcessRequestedEvent → Process order (new → active)
    // (from UI when player clicks "Process")
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderProcessRequestedEvent, (event: OrderProcessRequestedEvent) => {
      this.controller.process(event.orderId, event.source as ActionSource);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OrderShipRequestedEvent → Ship order (active → shipped)
    // (from UI when player clicks "Ship")
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderShipRequestedEvent, (event: OrderShipRequestedEvent) => {
      this.controller.ship(event.orderId, event.source as ActionSource);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OrderCloseRequestedEvent → Close order (shipped/paid → closed)
    // (from UI when player clicks "Close")
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderCloseRequestedEvent, (event: OrderCloseRequestedEvent) => {
      this.controller.close(event.orderId, event.source as ActionSource);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OrderPayRequestedEvent → Mark as paid (shipped → paid)
    // (from payment system or UI)
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderPayRequestedEvent, (event: OrderPayRequestedEvent) => {
      this.controller.pay(event.orderId, event.source as ActionSource);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PaymentCollectedEvent → Mark as paid (shipped → paid)
    // (legacy event from payment collection flow)
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(PaymentCollectedEvent, (event: PaymentCollectedEvent) => {
      // Find the order associated with this payment
      const payment = this.store.payments.find((p) => p.id === event.paymentId);
      if (payment?.orderId) {
        this.controller.pay(payment.orderId, "system");
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OrderCancelRequestedEvent → Cancel order
    // (from UI when player clicks "Cancel")
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderCancelRequestedEvent, (event: OrderCancelRequestedEvent) => {
      this.controller.cancel(event.orderId, event.reason, event.source as ActionSource);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OrderDeletedEvent → Delete order from store
    // ─────────────────────────────────────────────────────────────────────────
    this.subscribe(OrderDeletedEvent, (event: OrderDeletedEvent) => {
      const order = event.order;
      if (!order?.id) return;

      this.controller.delete(order.id, "system");
    });
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
  send(event: OrderMachineEvent): void {
    this.controller.send(event);
  }

  /**
   * Get the controller for direct access
   */
  getController(): OrderController {
    return this.controller;
  }

  /**
   * Get order statistics
   */
  getStats(): OrderStats {
    const orders = this.store.orders;
    
    const byStatus: Record<string, number> = {};
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    return {
      total: orders.length,
      new: byStatus["new"] || 0,
      active: byStatus["active"] || 0,
      shipped: byStatus["shipped"] || 0,
      paid: byStatus["paid"] || 0,
      failed: byStatus["failed"] || 0,
      closed: byStatus["closed"] || 0,
      cancelled: byStatus["cancelled"] || 0,
      byStatus,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.controller.destroy();
    console.log("[OrderEventBridge] Destroyed");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderStats {
  total: number;
  new: number;
  active: number;
  shipped: number;
  paid: number;
  failed: number;
  closed: number;
  cancelled: number;
  byStatus: Record<string, number>;
}
