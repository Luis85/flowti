import { IState } from "sim-ecs";
import { Payment } from "src/models/Payment";
import { PlayerState, defaultPlayer } from "src/models/Player";
import { Product } from "src/models/Product";
import { SalesOrder, OrderStatus } from "src/models/SalesOrder";
import { SimulationMessage } from "src/models/SimulationMessage";
import { DayPhase, InboxStats, OrderStats } from "../types";

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

	messages: SimulationMessage[] = [];
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
	// Message Inbox - Queries
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Find a message by ID
	 */
	public findMessage(id: string): SimulationMessage | undefined {
		return this.messages.find((m) => m.id === id);
	}

	/**
	 * Find message index by ID
	 */
	public findMessageIndex(id: string): number {
		return this.messages.findIndex((m) => m.id === id);
	}

	/**
	 * Check if a message exists
	 */
	public hasMessage(id: string): boolean {
		return this.findMessageIndex(id) >= 0;
	}

	/**
	 * Get all active (non-deleted) messages
	 */
	public getActiveMessages(): SimulationMessage[] {
		return this.messages.filter((m) => !m.deleted_at && !m.spam_at);
	}

	/**
	 * Get all deleted (deleted and spam) messages
	 */
	public getDeletedMessages(): SimulationMessage[] {
		return this.messages.filter((m) => m.deleted_at && m.spam_at);
	}

	/**
	 * Get unread messages
	 */
	public getUnreadMessages(): SimulationMessage[] {
		return this.messages.filter((m) => !m.deleted_at && !m.read_at);
	}

	/**
	 * Get messages by type
	 */
	public getMessagesByType(type: string): SimulationMessage[] {
		return this.messages.filter((m) => !m.deleted_at && m.type === type);
	}

	/**
	 * Count active messages
	 */
	public getMessageCount(): number {
		return this.getActiveMessages().length;
	}

	/**
	 * Count unread messages
	 */
	public getUnreadCount(): number {
		return this.getUnreadMessages().length;
	}

	/**
	 * Check if inbox is full
	 */
	public isInboxFull(maxSize = 50): boolean {
		return this.getMessageCount() >= maxSize;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Message Inbox - Mutations
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Add a new message to the inbox
	 * @returns true if added, false if duplicate
	 */
	public addMessage(message: SimulationMessage): boolean {
		// Prevent duplicates
		if (this.hasMessage(message.id)) {
			return false;
		}
		this.messages.push(message);
		return true;
	}

	/**
	 * Mark a message as read
	 * @returns true if marked, false if not found or already read
	 */
	public markMessageAsRead(id: string): boolean {
		const msg = this.findMessage(id);
		if (!msg || msg.read_at) return false;

		msg.read_at = this.simNowMs || Date.now();
		return true;
	}

	/**
	 * Mark a message as spam
	 * @returns true if marked, false if not found
	 */
	public markMessageAsSpam(id: string): boolean {
		const msg = this.findMessage(id);
		if (!msg) return false;

		const now = this.simNowMs || Date.now();
		msg.is_spam = true;
		msg.spam_at = msg.spam_at ?? now;
		msg.read_at = msg.read_at ?? now;
		return true;
	}

	/**
	 * Soft delete a message (set deleted_at timestamp)
	 * @returns true if deleted, false if not found or already deleted
	 */
	public softDeleteMessage(id: string): boolean {
		const msg = this.findMessage(id);
		if (!msg || msg.deleted_at) return false;

		msg.deleted_at = this.simNowMs || Date.now();
		return true;
	}

	/**
	 * Hard delete a message (remove from array)
	 * @returns true if removed, false if not found
	 */
	public hardDeleteMessage(id: string): boolean {
		const idx = this.findMessageIndex(id);
		if (idx < 0) return false;

		this.messages.splice(idx, 1);
		return true;
	}

	/**
	 * Archive a message (soft delete with archive flag)
	 * @returns true if archived, false if not found
	 */
	public archiveMessage(id: string): boolean {
		const msg = this.findMessage(id);
		if (!msg) return false;

		const now = this.simNowMs || Date.now();
		msg.read_at = msg.read_at ?? now;
		msg.deleted_at = now;
		return true;
	}

	/**
	 * Bulk delete all read messages
	 * @returns number of deleted messages
	 */
	public deleteAllReadMessages(hardDelete = true): number {
		const readMessages = this.messages.filter(
			(m) => m.read_at && !m.deleted_at
		);
		const count = readMessages.length;

		if (hardDelete) {
			this.messages = this.messages.filter(
				(m) => !m.read_at || m.deleted_at
			);
		} else {
			const now = this.simNowMs || Date.now();
			readMessages.forEach((m) => {
				m.deleted_at = now;
			});
		}

		return count;
	}

	/**
	 * Bulk delete all spam messages
	 * @returns number of deleted messages
	 */
	public deleteAllSpamMessages(): number {
		const before = this.messages.length;
		this.messages = this.messages.filter((m) => !m.is_spam);
		return before - this.messages.length;
	}

	/**
	 * Mark all messages as read
	 * @returns number of messages marked
	 */
	public markAllAsRead(): number {
		const now = this.simNowMs || Date.now();
		let count = 0;

		this.messages.forEach((m) => {
			if (!m.read_at && !m.deleted_at) {
				m.read_at = now;
				count++;
			}
		});

		return count;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Message Inbox - Stats
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Get inbox statistics
	 */
	public getInboxStats(): InboxStats {
		const active = this.getActiveMessages();
		const unread = active.filter((m) => !m.read_at);
		const spam = this.messages.filter((m) => m.is_spam);

		const byType: Record<string, number> = {};
		active.forEach((m) => {
			byType[m.type] = (byType[m.type] || 0) + 1;
		});

		const byPriority: Record<string, number> = {};
		active.forEach((m) => {
			byPriority[m.priority] = (byPriority[m.priority] || 0) + 1;
		});

		return {
			total: active.length,
			unread: unread.length,
			read: active.length - unread.length,
			spam: spam.length,
			byType,
			byPriority,
		};
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
