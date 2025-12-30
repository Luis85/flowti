import { App } from "obsidian";
import { IEventBus } from "src/eventsystem";
import { ProductUpdatedEvent } from "src/eventsystem/product/ProductUpdatedEvent";
import { GameViewModel } from "src/models/GameViewModel";
import { Product } from "src/models/Product";
import { OrderStatus, SalesOrder } from "src/models/SalesOrder";
import { ProductStore } from "src/simulation/stores/ProductStore";
import { SalesOrderModal } from "src/ui/modals/SalesOrderModal";

export interface FinanceData {
	budget: number;
	income: number;
	expenses: number;
}

// Status configuration for display and workflow
export const ORDER_STATUS_CONFIG: Record<
	OrderStatus,
	{
		label: string;
		icon: string;
		color: string;
		nextAction?: { label: string; callback: keyof FinancePanelCallbacks };
	}
> = {
	new: {
		label: "New",
		icon: "🆕",
		color: "var(--color-blue, #b8c9ddff)",
		nextAction: { label: "Process", callback: "onProcessOrder" },
	},
	active: {
		label: "Active",
		icon: "⚙️",
		color: "var(--color-orange, #2c669fff)",
		nextAction: { label: "Ship", callback: "onShipOrder" },
	},
	shipped: {
		label: "Shipped",
		icon: "🚚",
		color: "var(--color-purple, #c7cb3eff)",
		nextAction: { label: "Close", callback: "onCloseOrder" },
	},
	closed: {
		label: "Closed",
		icon: "✅",
		color: "var(--color-green, #82d9a2ff)",
	},
	paid: {
		label: "Paid",
		icon: "💰",
		color: "var(--color-green, #308034ff)",
	},
	failed: {
		label: "Failed",
		icon: "❌",
		color: "var(--color-red, #803030ff)",
	},
	cancelled: {
		label: "Cancelled",
		icon: "❌",
		color: "var(--color-red, #803030ff)",
	},
};

const STATUS_PRIORITY: Record<OrderStatus, number> = {
	failed: 0,
	new: 1,
	active: 2,
	shipped: 3,
	closed: 4,
	paid: 5,
	cancelled: 6,
};

export interface FinancePanelCallbacks {
	onViewOrder?: (order: SalesOrder) => void;
	onProcessOrder?: (order: SalesOrder) => void;
	onShipOrder?: (order: SalesOrder) => void;
	onCloseOrder?: (order: SalesOrder) => void;
}

type TabType = "sales" | "products" | "purchase" | "production";

interface TabConfig {
	key: TabType;
	label: string;
	enabled: boolean;
}

const TAB_CONFIG: TabConfig[] = [
	{ key: "sales", label: "Sales", enabled: true },
	{ key: "products", label: "Products", enabled: true },
	{ key: "purchase", label: "Purchase", enabled: false },
	{ key: "production", label: "Production", enabled: false },
];

export class FinancePanel {
	private root?: HTMLElement;
	private app?: App;
	private callbacks: FinancePanelCallbacks = {};

	// DOM cache - static elements
	private budgetValueEl?: HTMLElement;
	private incomeValueEl?: HTMLElement;
	private expenseValueEl?: HTMLElement;
	private netValueEl?: HTMLElement;
	private ordersListEl?: HTMLElement;
	private ordersCountEl?: HTMLElement;
	private emptyStateEl?: HTMLElement;
	private statusFilterEl?: HTMLElement;
	private tabsContainer?: HTMLElement;

	// Products tab DOM elements
	private productsContentEl?: HTMLElement;
	private productsListEl?: HTMLElement;
	private productsEmptyEl?: HTMLElement;
	private productsAlertEl?: HTMLElement;

	// Orders content wrapper
	private ordersContentEl?: HTMLElement;

	// DOM cache - dynamic elements
	private orderRowCache: Map<string, HTMLElement> = new Map();
	private productRowCache: Map<string, HTMLElement> = new Map();

	// State
	private activeTab: TabType = "sales";
	private activeStatusFilter: OrderStatus | "all" = "all";
	private built = false;
	private isSleeping = false;

	// Cache for change detection
	private lastOrderCount = -1;
	private lastOrderHash = "";
	private lastFinanceHash = "";
	private lastProductHash = "";

	// References for event delegation
	private currentOrders: Map<string, SalesOrder> = new Map();
	private currentProducts: Map<string, Product> = new Map();

	constructor(private products: ProductStore, private events: IEventBus) {}

	mount(parent: HTMLElement) {
		this.root = parent.createDiv({ cls: "mm-panel mm-finance" });
	}

	setApp(app: App) {
		this.app = app;
	}

	setCallbacks(callbacks: FinancePanelCallbacks) {
		this.callbacks = callbacks;
	}

	render(model: GameViewModel) {
		if (!this.root) return;

		if (!this.built) {
			this.buildStructure();
			this.built = true;
		}
		this.isSleeping = model.player.status === "sleeping";

		if (this.isSleeping) this.root.addClass("sleeping");
		else this.root.removeClass("sleeping");

		const data = this.deriveFinanceData(model);
		this.updateFinanceValues(data);

		// Update content based on active tab
		if (this.activeTab === "sales") {
			this.updateOrdersList(model.orders || []);
		} else if (this.activeTab === "products") {
			this.updateProductsList();
		}
	}

	private buildStructure() {
		if (!this.root) return;

		// Header
		const header = this.root.createDiv({ cls: "mm-finance__header" });
		header.createDiv({ cls: "mm-finance__title", text: "FINANCES" });

		// Summary Row
		this.buildSummaryRow();

		// Main Content Area (tabs + content)
		const mainContent = this.root.createDiv({ cls: "mm-finance__main" });

		// Tabs Header
		const tabsHeader = mainContent.createDiv({
			cls: "mm-finance__tabs-header",
		});
		this.tabsContainer = tabsHeader.createDiv({ cls: "mm-finance__tabs" });
		this.buildTabs();
		this.ordersCountEl = tabsHeader.createDiv({
			cls: "mm-finance__orders-count",
		});

		// Tab Content Container
		const contentContainer = mainContent.createDiv({
			cls: "mm-finance__content",
		});

		// Orders Content (Sales tab)
		this.ordersContentEl = contentContainer.createDiv({
			cls: "mm-finance__orders mm-finance__tab-content mm-finance__tab-content--active",
		});
		this.buildOrdersContent();

		// Products Content
		this.productsContentEl = contentContainer.createDiv({
			cls: "mm-finance__products mm-finance__tab-content",
		});
		this.buildProductsContent();
	}

	private buildSummaryRow() {
		if (!this.root) return;

		const summaryRow = this.root.createDiv({ cls: "mm-finance__summary" });

		const budgetBox = summaryRow.createDiv({
			cls: "mm-finance__summary-item mm-finance__summary-item--budget",
		});
		budgetBox.createDiv({
			cls: "mm-finance__summary-label",
			text: "Budget",
		});
		this.budgetValueEl = budgetBox.createDiv({
			cls: "mm-finance__summary-value mm-finance__summary-value--accent",
		});

		const incomeBox = summaryRow.createDiv({
			cls: "mm-finance__summary-item",
		});
		incomeBox.createDiv({
			cls: "mm-finance__summary-label",
			text: "Income",
		});
		this.incomeValueEl = incomeBox.createDiv({
			cls: "mm-finance__summary-value mm-finance__summary-value--income",
		});

		const expenseBox = summaryRow.createDiv({
			cls: "mm-finance__summary-item",
		});
		expenseBox.createDiv({
			cls: "mm-finance__summary-label",
			text: "Expenses",
		});
		this.expenseValueEl = expenseBox.createDiv({
			cls: "mm-finance__summary-value mm-finance__summary-value--expense",
		});

		const netBox = summaryRow.createDiv({
			cls: "mm-finance__summary-item",
		});
		netBox.createDiv({ cls: "mm-finance__summary-label", text: "Net" });
		this.netValueEl = netBox.createDiv({
			cls: "mm-finance__summary-value",
		});
	}

	private buildTabs() {
		if (!this.tabsContainer) return;

		TAB_CONFIG.forEach((tab) => {
			const tabEl = this.tabsContainer!.createDiv({
				cls: `mm-finance__tab ${
					tab.key === this.activeTab ? "mm-finance__tab--active" : ""
				} ${!tab.enabled ? "mm-finance__tab--disabled" : ""}`,
				text: tab.label,
				attr: { "data-tab": tab.key },
			});

			if (!tab.enabled) {
				tabEl.setAttribute("title", "Coming soon");
			} else {
				tabEl.addEventListener("click", () =>
					this.setActiveTab(tab.key)
				);
			}
		});
	}

	private buildOrdersContent() {
		if (!this.ordersContentEl) return;

		// Status filter
		this.statusFilterEl = this.ordersContentEl.createDiv({
			cls: "mm-finance__status-filter",
		});
		this.buildStatusFilter();

		// Orders list
		this.ordersListEl = this.ordersContentEl.createDiv({
			cls: "mm-finance__orders-list",
		});
		this.setupOrdersEventDelegation();

		// Empty state
		this.emptyStateEl = this.ordersListEl.createDiv({
			cls: "mm-finance__orders-empty",
		});
		this.emptyStateEl.createDiv({
			cls: "mm-finance__orders-empty-icon",
			text: "📋",
		});
		this.emptyStateEl.createDiv({
			cls: "mm-finance__orders-empty-text",
			text: "No active orders",
		});
		this.emptyStateEl.createDiv({
			cls: "mm-finance__orders-empty-hint",
			text: "Accept customer POs from inbox",
		});
	}

	private buildProductsContent() {
		if (!this.productsContentEl) return;

		// Alert banner (shown when no sellable active products)
		this.productsAlertEl = this.productsContentEl.createDiv({
			cls: "mm-finance__products-alert",
		});
		this.productsAlertEl.createDiv({
			cls: "mm-finance__products-alert-icon",
			text: "⚠️",
		});
		const alertText = this.productsAlertEl.createDiv({
			cls: "mm-finance__products-alert-text",
		});
		alertText.createDiv({
			cls: "mm-finance__products-alert-title",
			text: "No Sellable Products",
		});
		alertText.createDiv({
			cls: "mm-finance__products-alert-desc",
			text: "Activate at least one sellable product to receive sales orders.",
		});

		// Products list
		this.productsListEl = this.productsContentEl.createDiv({
			cls: "mm-finance__products-list",
		});
		this.setupProductsEventDelegation();

		// Empty state (no products at all)
		this.productsEmptyEl = this.productsListEl.createDiv({
			cls: "mm-finance__products-empty",
		});
		this.productsEmptyEl.createDiv({
			cls: "mm-finance__products-empty-icon",
			text: "📦",
		});
		this.productsEmptyEl.createDiv({
			cls: "mm-finance__products-empty-text",
			text: "No products defined",
		});
		this.productsEmptyEl.createDiv({
			cls: "mm-finance__products-empty-hint",
			text: "Create products in the Product Manager",
		});
	}

	private buildStatusFilter() {
		if (!this.statusFilterEl) return;

		const filters: Array<{ key: OrderStatus | "all"; label: string }> = [
			{ key: "all", label: "All" },
			{ key: "new", label: "🆕" },
			{ key: "active", label: "⚙️" },
			{ key: "shipped", label: "🚚" },
			{ key: "paid", label: "💰" },
			{ key: "closed", label: "✅" },
		];

		filters.forEach(({ key, label }) => {
			if (!this.statusFilterEl) return;
			const btn = this.statusFilterEl.createDiv({
				cls: `mm-finance__status-btn ${
					key === "all" ? "mm-finance__status-btn--active" : ""
				}`,
				attr: { "data-status": key },
			});
			btn.textContent = label;
			btn.addEventListener("click", () => this.setStatusFilter(key));
		});
	}

	private setupOrdersEventDelegation() {
		if (!this.ordersListEl) return;

		this.ordersListEl.addEventListener("click", (e) => {
			if (this.isSleeping) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			const target = e.target as HTMLElement;
			const row = target.closest(".mm-finance__order-row") as HTMLElement;
			if (!row) return;

			const orderId = row.dataset.orderId;
			if (!orderId) return;

			const order = this.currentOrders.get(orderId);
			if (!order) return;

			const btn = target.closest("button") as HTMLElement;
			if (btn) {
				e.stopPropagation();
				const action = btn.dataset.action;
				if (action === "view") {
					this.openOrderModal(order);
				} else if (action === "next") {
					const statusConfig = ORDER_STATUS_CONFIG[order.status];
					if (statusConfig?.nextAction) {
						const cb =
							this.callbacks[statusConfig.nextAction.callback];
						if (cb) cb(order);
					}
				}
			} else {
				this.openOrderModal(order);
			}
		});
	}

	private setupProductsEventDelegation() {
		if (!this.productsListEl) return;

		this.productsListEl.addEventListener("click", (e) => {
			if (this.isSleeping) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			const target = e.target as HTMLElement;
			const row = target.closest(
				".mm-finance__product-row"
			) as HTMLElement;
			if (!row) return;

			const productId = row.dataset.productId;
			if (!productId) return;

			const product = this.currentProducts.get(productId);
			if (!product) return;

			const btn = target.closest("button") as HTMLElement;
			if (btn) {
				e.stopPropagation();
				const action = btn.dataset.action;
				if (action === "toggle") {
					this.toggleProductActive(product);
				}
			}
		});
	}

	/**
	 * Toggle product active state via event
	 */
	private toggleProductActive(product: Product) {
		const updatedProduct: Product = {
			...product,
			isActive: !product.isActive,
			updatedAt: Date.now(),
		};

		// Dispatch event - no direct mutation!
		this.events.publish(new ProductUpdatedEvent(updatedProduct));
	}

	private setActiveTab(tab: TabType) {
		if (tab === this.activeTab) return;

		// Update tab button states
		this.tabsContainer
			?.querySelectorAll(".mm-finance__tab")
			.forEach((el) => {
				const tabKey = el.getAttribute("data-tab");
				el.classList.toggle("mm-finance__tab--active", tabKey === tab);
			});

		// Update content visibility
		this.ordersContentEl?.classList.toggle(
			"mm-finance__tab-content--active",
			tab === "sales"
		);
		this.productsContentEl?.classList.toggle(
			"mm-finance__tab-content--active",
			tab === "products"
		);

		// Show/hide count badge based on tab
		if (this.ordersCountEl) {
			this.ordersCountEl.classList.toggle("is-hidden", tab !== "sales");
		}

		this.activeTab = tab;

		// Force re-render of content
		if (tab === "products") {
			this.lastProductHash = "";
			this.updateProductsList();
		}
	}

	private setStatusFilter(status: OrderStatus | "all") {
		if (status === this.activeStatusFilter) return;

		this.statusFilterEl
			?.querySelectorAll(".mm-finance__status-btn")
			.forEach((btn) => {
				btn.classList.toggle(
					"mm-finance__status-btn--active",
					btn.getAttribute("data-status") === status
				);
			});

		this.activeStatusFilter = status;
		this.lastOrderHash = ""; // Force re-render
	}

	private updateFinanceValues(data: FinanceData) {
		const hash = `${data.budget}|${data.income}|${data.expenses}`;
		if (hash === this.lastFinanceHash) return;
		this.lastFinanceHash = hash;

		if (this.budgetValueEl)
			this.budgetValueEl.textContent = this.fmt(data.budget);
		if (this.incomeValueEl)
			this.incomeValueEl.textContent = this.fmt(data.income);
		if (this.expenseValueEl)
			this.expenseValueEl.textContent = this.fmt(data.expenses);

		if (this.netValueEl) {
			const net = data.income - data.expenses;
			this.netValueEl.textContent = `${net >= 0 ? "+" : ""}${this.fmt(
				net
			)}`;
			this.netValueEl.classList.toggle(
				"mm-finance__summary-value--income",
				net >= 0
			);
			this.netValueEl.classList.toggle(
				"mm-finance__summary-value--expense",
				net < 0
			);
		}
	}

	private deriveFinanceData(model: GameViewModel): FinanceData {
		const payments = model.payments ?? [];
		const income = this.calculateCollectedIncome(payments);
		const budget = 0;
		const expenses = 0;
		return { budget, income, expenses };
	}

	private calculateCollectedIncome(
		payments: Array<{ status: string; amount: number }>
	): number {
		let sum = 0;
		for (const p of payments) {
			if (p?.status === "collected") sum += p.amount ?? 0;
		}
		return sum;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Orders List
	// ─────────────────────────────────────────────────────────────────────────

	private updateOrdersList(orders: SalesOrder[]) {
		if (!this.ordersListEl || !this.ordersCountEl || !this.emptyStateEl)
			return;

		let filteredOrders = orders;
		if (this.activeStatusFilter !== "all") {
			filteredOrders = filteredOrders.filter(
				(o) => o.status === this.activeStatusFilter
			);
		}

		const orderHash = this.computeOrderHash(filteredOrders);
		if (orderHash === this.lastOrderHash) return;
		this.lastOrderHash = orderHash;

		this.currentOrders.clear();
		orders.forEach((o) => this.currentOrders.set(o.id, o));

		const totalCount = orders.length;
		if (totalCount !== this.lastOrderCount) {
			this.lastOrderCount = totalCount;
			this.ordersCountEl.textContent = totalCount.toString();
			this.ordersCountEl.classList.toggle("is-hidden", totalCount === 0);
		}

		const sortedOrders = this.sortOrdersByStatus(filteredOrders);
		const isEmpty = sortedOrders.length === 0;
		this.emptyStateEl.classList.toggle("is-hidden", !isEmpty);

		if (isEmpty) {
			const emptyText = this.emptyStateEl.querySelector(
				".mm-finance__orders-empty-text"
			);
			const emptyHint = this.emptyStateEl.querySelector(
				".mm-finance__orders-empty-hint"
			);
			if (this.activeStatusFilter !== "all") {
				if (emptyText)
					emptyText.textContent = `No ${this.activeStatusFilter} orders`;
				if (emptyHint) emptyHint.textContent = "Try a different filter";
			} else {
				if (emptyText) emptyText.textContent = "No active orders";
				if (emptyHint)
					emptyHint.textContent = "Accept customer POs from inbox";
			}
		}

		this.reconcileOrderRows(sortedOrders);
	}

	private computeOrderHash(orders: SalesOrder[]): string {
		if (orders.length === 0) return "empty";
		let hash = `${this.activeStatusFilter}:${orders.length}:`;
		for (const o of orders) {
			hash += `${o.id}|${o.status},`;
		}
		return hash;
	}

	private reconcileOrderRows(orders: SalesOrder[]) {
		if (!this.ordersListEl) return;

		const currentIds = new Set(orders.map((o) => o.id));
		const existingIds = new Set(this.orderRowCache.keys());

		for (const id of existingIds) {
			if (!currentIds.has(id)) {
				const row = this.orderRowCache.get(id);
				row?.remove();
				this.orderRowCache.delete(id);
			}
		}

		let previousRow: HTMLElement | null = null;

		for (const order of orders) {
			let row = this.orderRowCache.get(order.id);

			if (row) {
				this.updateOrderRow(row, order);
				row.classList.toggle("is-disabled", this.isSleeping);
			} else {
				row = this.createOrderRow(order);
				this.orderRowCache.set(order.id, row);
			}

			if (previousRow) {
				if (row.previousElementSibling !== previousRow) {
					previousRow.after(row);
				}
			} else {
				if (this.ordersListEl.firstElementChild !== this.emptyStateEl) {
					this.ordersListEl.insertBefore(
						row,
						this.ordersListEl.firstElementChild
					);
				} else if (this.emptyStateEl.nextElementSibling !== row) {
					this.emptyStateEl.after(row);
				}
			}

			previousRow = row;
		}
	}

	private createOrderRow(order: SalesOrder): HTMLElement {
		const statusConfig =
			ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.new;

		const row = document.createElement("div");
		row.className = `mm-finance__order-row mm-finance__order-row--${order.status}`;
		row.dataset.orderId = order.id;
		if (this.isSleeping) row.classList.add("is-disabled");

		const indicator = document.createElement("div");
		indicator.className = "mm-finance__order-status-indicator";
		indicator.style.setProperty("--status-color", statusConfig.color);
		row.appendChild(indicator);

		const info = document.createElement("div");
		info.className = "mm-finance__order-info";

		const titleRow = document.createElement("div");
		titleRow.className = "mm-finance__order-title";

		const customer = document.createElement("span");
		customer.className = "mm-finance__order-customer";
		customer.textContent = order.customer;
		titleRow.appendChild(customer);

		const badge = document.createElement("span");
		badge.className = `mm-finance__order-status-badge mm-finance__order-status-badge--${order.status}`;
		badge.textContent = `${statusConfig.icon} ${statusConfig.label}`;
		badge.style.setProperty("--status-color", statusConfig.color);
		titleRow.appendChild(badge);

		info.appendChild(titleRow);

		const meta = document.createElement("div");
		meta.className = "mm-finance__order-meta";

		const idSpan = document.createElement("span");
		idSpan.className = "mm-finance__order-id";
		idSpan.textContent = `#${order.id.slice(0, 8)}`;
		meta.appendChild(idSpan);

		const itemCount = order.lineItems?.length || 0;
		const itemsSpan = document.createElement("span");
		itemsSpan.textContent = `${itemCount} item${
			itemCount !== 1 ? "s" : ""
		}`;
		meta.appendChild(itemsSpan);

		const totalValue = this.calculateOrderTotal(order);
		if (totalValue > 0) {
			const valueSpan = document.createElement("span");
			valueSpan.className = "mm-finance__order-value";
			valueSpan.textContent = this.fmt(totalValue);
			meta.appendChild(valueSpan);
		}

		info.appendChild(meta);
		row.appendChild(info);

		const actions = document.createElement("div");
		actions.className = "mm-finance__order-actions";

		const viewBtn = document.createElement("button");
		viewBtn.className = "mm-finance__order-btn mm-finance__order-btn--view";
		viewBtn.textContent = "View";
		viewBtn.dataset.action = "view";
		actions.appendChild(viewBtn);

		if (statusConfig.nextAction) {
			const actionBtn = document.createElement("button");
			actionBtn.className = `mm-finance__order-btn mm-finance__order-btn--action mm-finance__order-btn--${order.status}`;
			actionBtn.textContent = statusConfig.nextAction.label;
			actionBtn.dataset.action = "next";
			actionBtn.style.setProperty("--status-color", statusConfig.color);
			actions.appendChild(actionBtn);
		}

		row.appendChild(actions);
		this.ordersListEl?.appendChild(row);
		return row;
	}

	private updateOrderRow(row: HTMLElement, order: SalesOrder) {
		const currentStatus = row.className.match(
			/mm-finance__order-row--(\w+)/
		)?.[1];
		if (currentStatus === order.status) return;

		const statusConfig =
			ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.new;

		row.className = `mm-finance__order-row mm-finance__order-row--${order.status}`;
		row.classList.toggle("is-disabled", this.isSleeping);

		const indicator = row.querySelector(
			".mm-finance__order-status-indicator"
		) as HTMLElement;
		if (indicator)
			indicator.style.setProperty("--status-color", statusConfig.color);

		const badge = row.querySelector(
			".mm-finance__order-status-badge"
		) as HTMLElement;
		if (badge) {
			badge.className = `mm-finance__order-status-badge mm-finance__order-status-badge--${order.status}`;
			badge.textContent = `${statusConfig.icon} ${statusConfig.label}`;
			badge.style.setProperty("--status-color", statusConfig.color);
		}

		const actions = row.querySelector(".mm-finance__order-actions");
		const actionBtn = actions?.querySelector(
			".mm-finance__order-btn--action"
		) as HTMLElement;

		if (statusConfig.nextAction) {
			if (actionBtn) {
				actionBtn.className = `mm-finance__order-btn mm-finance__order-btn--action mm-finance__order-btn--${order.status}`;
				actionBtn.textContent = statusConfig.nextAction.label;
				actionBtn.style.setProperty(
					"--status-color",
					statusConfig.color
				);
			} else {
				const newBtn = document.createElement("button");
				newBtn.className = `mm-finance__order-btn mm-finance__order-btn--action mm-finance__order-btn--${order.status}`;
				newBtn.textContent = statusConfig.nextAction.label;
				newBtn.dataset.action = "next";
				newBtn.style.setProperty("--status-color", statusConfig.color);
				actions?.appendChild(newBtn);
			}
		} else if (actionBtn) {
			actionBtn.remove();
		}
	}

	private sortOrdersByStatus(orders: SalesOrder[]): SalesOrder[] {
		return [...orders].sort((a, b) => {
			const priorityA = STATUS_PRIORITY[a.status] ?? 99;
			const priorityB = STATUS_PRIORITY[b.status] ?? 99;
			if (priorityA !== priorityB) return priorityA - priorityB;
			return (b.createdAt || 0) - (a.createdAt || 0);
		});
	}

	private calculateOrderTotal(order: SalesOrder): number {
		if (!order.lineItems) return 0;
		let total = 0;
		for (const item of order.lineItems) {
			total += (item.quantity || 0) * (item.price || 0);
		}
		return total;
	}

	private openOrderModal(order: SalesOrder) {
		if (!this.app) return;
		const modal = new SalesOrderModal(this.app, order, this.callbacks);
		modal.open();
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Products List
	// ─────────────────────────────────────────────────────────────────────────

	private updateProductsList() {
		if (
			!this.productsListEl ||
			!this.productsEmptyEl ||
			!this.productsAlertEl
		)
			return;

		const allProducts = this.products.getAll();
		const productHash = this.computeProductHash(allProducts);

		if (productHash === this.lastProductHash) return;
		this.lastProductHash = productHash;

		// Update products map for event delegation
		this.currentProducts.clear();
		allProducts.forEach((p) => this.currentProducts.set(p.id, p));

		// Check for sellable active products (required for receiving orders)
		const sellableProducts = this.products.getSellableProducts();
		const hasNoSellableProducts =
			sellableProducts.length === 0 && allProducts.length > 0;

		// Show/hide alert banner
		this.productsAlertEl.classList.toggle(
			"is-hidden",
			!hasNoSellableProducts
		);

		// Show/hide empty state
		const isEmpty = allProducts.length === 0;
		this.productsEmptyEl.classList.toggle("is-hidden", !isEmpty);

		// Sort: active first, then sellable, then by name
		const sortedProducts = [...allProducts].sort((a, b) => {
			// Active products first
			if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
			// Then sellable products
			if (a.flags.sellable !== b.flags.sellable)
				return a.flags.sellable ? -1 : 1;
			// Then alphabetically
			return a.name.localeCompare(b.name);
		});

		this.reconcileProductRows(sortedProducts);
	}

	private computeProductHash(products: Product[]): string {
		if (products.length === 0) return "empty";
		let hash = `${products.length}:`;
		for (const p of products) {
			hash += `${p.id}|${p.isActive}|${p.currentStock ?? 0},`;
		}
		return hash;
	}

	private reconcileProductRows(products: Product[]) {
		if (!this.productsListEl) return;

		const currentIds = new Set(products.map((p) => p.id));
		const existingIds = new Set(this.productRowCache.keys());

		// Remove rows that no longer exist
		for (const id of existingIds) {
			if (!currentIds.has(id)) {
				const row = this.productRowCache.get(id);
				row?.remove();
				this.productRowCache.delete(id);
			}
		}

		let previousRow: HTMLElement | null = null;

		for (const product of products) {
			let row = this.productRowCache.get(product.id);

			if (row) {
				this.updateProductRow(row, product);
				row.classList.toggle("is-disabled", this.isSleeping);
			} else {
				row = this.createProductRow(product);
				this.productRowCache.set(product.id, row);
			}

			// Ensure correct order in DOM
			if (previousRow) {
				if (row.previousElementSibling !== previousRow) {
					previousRow.after(row);
				}
			} else {
				if (
					this.productsListEl.firstElementChild !==
					this.productsEmptyEl
				) {
					this.productsListEl.insertBefore(
						row,
						this.productsListEl.firstElementChild
					);
				} else if (this.productsEmptyEl.nextElementSibling !== row) {
					this.productsEmptyEl.after(row);
				}
			}

			previousRow = row;
		}
	}

	private createProductRow(product: Product): HTMLElement {
		const row = document.createElement("div");
		row.className = `mm-finance__product-row ${
			!product.isActive ? "mm-finance__product-row--inactive" : ""
		}`;
		row.dataset.productId = product.id;
		if (this.isSleeping) row.classList.add("is-disabled");

		// Status indicator
		const indicator = document.createElement("div");
		indicator.className = "mm-finance__product-status-indicator";
		indicator.style.setProperty(
			"--status-color",
			this.getProductStatusColor(product)
		);
		row.appendChild(indicator);

		// Info section
		const info = document.createElement("div");
		info.className = "mm-finance__product-info";

		const titleRow = document.createElement("div");
		titleRow.className = "mm-finance__product-title";

		const name = document.createElement("span");
		name.className = "mm-finance__product-name";
		name.textContent = product.name;
		titleRow.appendChild(name);

		const badge = document.createElement("span");
		badge.className = `mm-finance__product-status-badge ${this.getProductBadgeClass(
			product
		)}`;
		badge.textContent = this.getProductStatusText(product);
		titleRow.appendChild(badge);

		info.appendChild(titleRow);

		const meta = document.createElement("div");
		meta.className = "mm-finance__product-meta";

		// Price with pricing type indicator
		const priceSpan = document.createElement("span");
		priceSpan.className = "mm-finance__product-price";
		priceSpan.textContent = `${this.fmt(product.price)}${
			product.pricingType === "per_hour" ? "/hr" : ""
		}`;
		meta.appendChild(priceSpan);

		// Category
		const categorySpan = document.createElement("span");
		categorySpan.className = "mm-finance__product-category";
		categorySpan.textContent = this.formatCategory(product.category);
		meta.appendChild(categorySpan);

		// Stock level (if stockable)
		if (product.flags.stockable && product.currentStock !== undefined) {
			const stockSpan = document.createElement("span");
			stockSpan.className = "mm-finance__product-stock";
			const isLowStock =
				product.minStock !== undefined &&
				product.currentStock <= product.minStock;
			if (isLowStock) {
				stockSpan.classList.add("mm-finance__product-stock--low");
			}
			stockSpan.textContent = `📦 ${product.currentStock}`;
			meta.appendChild(stockSpan);
		}

		// Not sellable indicator
		if (!product.flags.sellable) {
			const notSellableSpan = document.createElement("span");
			notSellableSpan.className =
				"mm-finance__product-flag mm-finance__product-flag--not-sellable";
			notSellableSpan.textContent = "Not sellable";
			meta.appendChild(notSellableSpan);
		}

		info.appendChild(meta);
		row.appendChild(info);

		// Actions
		const actions = document.createElement("div");
		actions.className = "mm-finance__product-actions";

		const toggleBtn = document.createElement("button");
		toggleBtn.className = `mm-finance__product-btn mm-finance__product-btn--toggle ${
			product.isActive
				? "mm-finance__product-btn--pause"
				: "mm-finance__product-btn--activate"
		}`;
		toggleBtn.textContent = product.isActive ? "Pause" : "Activate";
		toggleBtn.dataset.action = "toggle";
		actions.appendChild(toggleBtn);

		row.appendChild(actions);

		this.productsListEl?.appendChild(row);
		return row;
	}

	private getProductStatusColor(product: Product): string {
		if (!product.isActive) return "var(--color-yellow, #fbbf24)";
		if (!product.flags.sellable) return "var(--color-cyan, #22d3ee)";
		return "var(--color-green, #4ade80)";
	}

	private getProductBadgeClass(product: Product): string {
		if (!product.isActive)
			return "mm-finance__product-status-badge--paused";
		if (!product.flags.sellable)
			return "mm-finance__product-status-badge--internal";
		return "mm-finance__product-status-badge--active";
	}

	private getProductStatusText(product: Product): string {
		if (!product.isActive) return "⏸ Paused";
		if (!product.flags.sellable) return "🔧 Internal";
		return "✓ Active";
	}

	private formatCategory(category: string): string {
		return category
			.replace(/_/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	private updateProductRow(row: HTMLElement, product: Product) {
		const isCurrentlyActive = !row.classList.contains(
			"mm-finance__product-row--inactive"
		);

		if (isCurrentlyActive === product.isActive) return; // No change

		row.classList.toggle(
			"mm-finance__product-row--inactive",
			!product.isActive
		);
		row.classList.toggle("is-disabled", this.isSleeping);

		// Update indicator
		const indicator = row.querySelector(
			".mm-finance__product-status-indicator"
		) as HTMLElement;
		if (indicator) {
			indicator.style.setProperty(
				"--status-color",
				this.getProductStatusColor(product)
			);
		}

		// Update badge
		const badge = row.querySelector(
			".mm-finance__product-status-badge"
		) as HTMLElement;
		if (badge) {
			badge.className = `mm-finance__product-status-badge ${this.getProductBadgeClass(
				product
			)}`;
			badge.textContent = this.getProductStatusText(product);
		}

		// Update toggle button
		const toggleBtn = row.querySelector(
			".mm-finance__product-btn--toggle"
		) as HTMLElement;
		if (toggleBtn) {
			toggleBtn.className = `mm-finance__product-btn mm-finance__product-btn--toggle ${
				product.isActive
					? "mm-finance__product-btn--pause"
					: "mm-finance__product-btn--activate"
			}`;
			toggleBtn.textContent = product.isActive ? "Pause" : "Activate";
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Utilities
	// ─────────────────────────────────────────────────────────────────────────

	private fmt(n: number): string {
		if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
		if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
		return `$${n}`;
	}

	destroy() {
		this.root?.remove();
		this.root = undefined;
		this.built = false;
		this.orderRowCache.clear();
		this.productRowCache.clear();
		this.currentOrders.clear();
		this.currentProducts.clear();
		this.lastOrderHash = "";
		this.lastFinanceHash = "";
		this.lastProductHash = "";
		this.lastOrderCount = -1;
	}
}
