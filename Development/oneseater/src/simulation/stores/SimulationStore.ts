import { IState } from "sim-ecs";
import { Payment } from "src/models/Payment";
import { PlayerState, defaultPlayer } from "src/models/Player";
import { Product } from "src/models/Product";
import { SalesOrder, OrderStatus } from "src/models/SalesOrder";
import { DayPhase, OrderStats } from "../types";

export class SimulationStore {
	started: number | undefined = undefined;
	lastTick: number;
	paused = false;
	inboxFull = false;
	debug = false;
	speed = 1;
	beforePause = 1;

	// frame timings
	deltaTime = 0; // dt aus render loop / engine tick
	lastSimDtMs = 0; // dt nach scaling

	phase: DayPhase = "night";
	simNowMs = 0; // absolute sim time
	dayIndex = 0; // day counter
	minuteOfDay = 0; // 0..1439

	player: PlayerState = defaultPlayer();

	products: Product[] = [];
	orders: SalesOrder[] = [];
	payments: Payment[] = [];
	currentState?: IState;

	// ─────────────────────────────────────────────────────────────────────────
	// Serialization
	// ─────────────────────────────────────────────────────────────────────────

	public serializeStore(store: SimulationStore): string {
		return JSON.stringify(store, null, 2);
	}

	public loadStore(savedData: Partial<SimulationStore>): SimulationStore {
		return {
			...this,
			...savedData,
		};
	}

	public deserializeStore(data: string): SimulationStore {
		try {
			const parsed = JSON.parse(data) as Partial<SimulationStore>;
			return this.loadStore(parsed);
		} catch (error) {
			console.error("Error deserializing store:", error);
			return this;
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Simulation Control
	// ─────────────────────────────────────────────────────────────────────────

	public pause() {
		if (this.paused) return;
		this.paused = true;
		this.beforePause = this.speed || this.beforePause || 1;
		this.speed = 0;
	}

	public resume() {
		if (!this.paused) return;
		this.paused = false;
		this.speed = this.beforePause || 1;
	}

	public togglePause() {
		if (this.paused) this.resume();
		else this.pause();
	}

	public isWeekend(): boolean {
		const day = new Date(this.simNowMs).getDay();
		return day === 0 || day === 6;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Product Management
	// ─────────────────────────────────────────────────────────────────────────

	public getSellableProducts(): Product[] {
		return this.products.filter((p) => p.flags.sellable && p.isActive);
	}

	public getAvailableServices(): Product[] {
		return this.products.filter(
			(p) => p.category === "service" && p.isActive
		);
	}

	public calculateInventoryValue(): number {
		return this.products
			.filter((p) => p.flags.stockable && p.currentStock)
			.reduce((sum, p) => sum + p.price * (p.currentStock || 0), 0);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Order Management - Queries
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Find an order by ID
	 */
	public findOrder(id: string): SalesOrder | undefined {
		return this.orders.find((o) => o.id === id);
	}

	/**
	 * Find order index by ID
	 */
	public findOrderIndex(id: string): number {
		return this.orders.findIndex((o) => o.id === id);
	}

	/**
	 * Check if an order exists
	 */
	public hasOrder(id: string): boolean {
		return this.findOrderIndex(id) >= 0;
	}

	/**
	 * Check if order already exists for a CustomerPurchaseOrder message
	 */
	public orderExistsForMessage(messageId: string): boolean {
		return this.orders.some((o) => o.customerPo?.id === messageId);
	}

	/**
	 * Get orders by status
	 */
	public getOrdersByStatus(status: string): SalesOrder[] {
		return this.orders.filter((o) => o.status === status);
	}

	/**
	 * Get active (non-terminal) orders
	 */
	public getActiveOrders(): SalesOrder[] {
		return this.orders.filter(
			(o) => o.status !== "closed" && o.status !== "cancelled"
		);
	}

	/**
	 * Get new orders (awaiting processing)
	 */
	public getNewOrders(): SalesOrder[] {
		return this.getOrdersByStatus("new");
	}

	/**
	 * Get orders ready to ship
	 */
	public getReadyToShipOrders(): SalesOrder[] {
		return this.getOrdersByStatus("active");
	}

	/**
	 * Get shipped orders (awaiting closure)
	 */
	public getShippedOrders(): SalesOrder[] {
		return this.getOrdersByStatus("shipped");
	}

	/**
	 * Count orders by status
	 */
	public getOrderCount(status?: string): number {
		if (status) {
			return this.getOrdersByStatus(status).length;
		}
		return this.orders.length;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Order Management - Mutations
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Add a new order
	 * @returns true if added, false if duplicate
	 */
	public addOrder(order: SalesOrder): boolean {
		if (this.hasOrder(order.id)) {
			return false;
		}
		this.orders.push(order);
		return true;
	}

	/**
	 * Update an order's status
	 * @returns updated order or null if not found
	 */
	public updateOrderStatus(
		id: string,
		status: OrderStatus
	): SalesOrder | null {
		const idx = this.findOrderIndex(id);
		if (idx < 0) return null;

		const order = this.orders[idx];
		const now = this.simNowMs || Date.now();

		const updatedOrder: SalesOrder = {
			...order,
			status,
			updatedAt: now,
		};

		// Add status-specific timestamps
		switch (status) {
			case "active":
				updatedOrder.processedAt = now;
				break;
			case "shipped":
				updatedOrder.shippedAt = now;
				break;
			case "closed":
				updatedOrder.closedAt = now;
				break;
			case "cancelled":
				updatedOrder.cancelledAt = now;
				break;
		}

		this.orders[idx] = updatedOrder;
		return updatedOrder;
	}

	/**
	 * Delete an order
	 * @returns true if deleted, false if not found
	 */
	public deleteOrder(id: string): boolean {
		const idx = this.findOrderIndex(id);
		if (idx < 0) return false;

		this.orders.splice(idx, 1);
		return true;
	}

	/**
	 * Update an order (full replacement)
	 * @returns true if updated, false if not found
	 */
	public updateOrder(order: SalesOrder): boolean {
		const idx = this.findOrderIndex(order.id);
		if (idx < 0) return false;

		this.orders[idx] = {
			...order,
			updatedAt: this.simNowMs || Date.now(),
		};
		return true;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Order Management - Stats
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Get order statistics
	 */
	public getOrderStats(): OrderStats {
		const byStatus: Record<string, number> = {};
		this.orders.forEach((o) => {
			byStatus[o.status] = (byStatus[o.status] || 0) + 1;
		});

		const byCustomer: Record<string, number> = {};
		this.orders.forEach((o) => {
			const customer = o.customer || "Unknown";
			byCustomer[customer] = (byCustomer[customer] || 0) + 1;
		});

		// Calculate total value
		let totalValue = 0;
		this.orders.forEach((o) => {
			o.lineItems?.forEach((item) => {
				totalValue += (item.price || 0) * (item.quantity || 0);
			});
		});

		return {
			total: this.orders.length,
			new: byStatus["new"] || 0,
			active: byStatus["active"] || 0,
			shipped: byStatus["shipped"] || 0,
			closed: byStatus["closed"] || 0,
			cancelled: byStatus["cancelled"] || 0,
			byStatus,
			byCustomer,
			totalValue,
		};
	}
}
