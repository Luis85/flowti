import { App, Modal } from "obsidian";
import { SalesOrder } from "src/models/SalesOrder";
import { FinancePanelCallbacks, ORDER_STATUS_CONFIG } from "src/ui/panels/office/FinancePanel";


const LINE_STATUS_CONFIG: Record<string, { icon: string; color: string }> = {
	new: { icon: "🆕", color: "var(--color-blue, #60a5fa)" },
	active: { icon: "⚙️", color: "var(--color-orange, #fb923c)" },
	shipped: { icon: "🚚", color: "var(--color-purple, #a78bfa)" },
	closed: { icon: "✅", color: "var(--color-green, #4ade80)" },
	paid: { icon: "💰", color: "var(--color-green, #4ade80)" },
};

export class SalesOrderModal extends Modal {
	private order: SalesOrder;
	private callbacks: FinancePanelCallbacks;

	constructor(app: App, order: SalesOrder, callbacks: FinancePanelCallbacks) {
		super(app);
		this.order = order;
		this.callbacks = callbacks;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("mm-order-modal");

		const statusConfig = ORDER_STATUS_CONFIG[this.order.status] || ORDER_STATUS_CONFIG.new;

		// ═══════════════════════════════════════════════════════════════════
		// HEADER
		// ═══════════════════════════════════════════════════════════════════
		const header = contentEl.createDiv({ cls: "mm-order-modal__header" });

		header.createDiv({ cls: "mm-order-modal__icon", text: "📦" });

		const titleBlock = header.createDiv({ cls: "mm-order-modal__title-block" });

		// Title row with status badge
		const titleRow = titleBlock.createDiv({ cls: "mm-order-modal__title-row" });
		titleRow.createDiv({ cls: "mm-order-modal__title", text: "Sales Order" });

		const statusBadge = titleRow.createDiv({ cls: "mm-order-modal__status-badge" });
		statusBadge.textContent = `${statusConfig.icon} ${statusConfig.label}`;
		statusBadge.style.setProperty("--status-color", statusConfig.color);

		// Meta info
		const meta = titleBlock.createDiv({ cls: "mm-order-modal__meta" });
		meta.createSpan({ text: `ID: ${this.order.id}` });
		meta.createSpan({ text: "•" });
		meta.createSpan({ text: this.formatDate(this.order.createdAt) });

		// ═══════════════════════════════════════════════════════════════════
		// CUSTOMER INFO
		// ═══════════════════════════════════════════════════════════════════
		const customerSection = contentEl.createDiv({ cls: "mm-order-modal__section" });
		customerSection.createDiv({ cls: "mm-order-modal__section-title", text: "Customer" });

		const customerGrid = customerSection.createDiv({ cls: "mm-order-modal__customer-grid" });

		this.createInfoRow(customerGrid, "Customer", this.order.customer);
		this.createInfoRow(customerGrid, "Customer PO", this.order.customerPo.id);
		this.createInfoRow(customerGrid, "Ship To", this.order.shipToAddress);
		this.createInfoRow(customerGrid, "Bill To", this.order.billToAddress);
		this.createInfoRow(customerGrid, "Order Taker", this.order.taker);

		// ═══════════════════════════════════════════════════════════════════
		// LINE ITEMS
		// ═══════════════════════════════════════════════════════════════════
		if (this.order.lineItems && this.order.lineItems.length > 0) {
			const itemsSection = contentEl.createDiv({ cls: "mm-order-modal__section" });
			itemsSection.createDiv({ cls: "mm-order-modal__section-title", text: "Line Items" });

			const tableWrapper = itemsSection.createDiv({ cls: "mm-order-modal__table-wrapper" });
			const table = tableWrapper.createEl("table", { cls: "mm-order-modal__table" });

			// Table header
			const thead = table.createEl("thead");
			const headerRow = thead.createEl("tr");
			["Product", "Status", "Qty", "Unit", "Price", "Total"].forEach((h) => {
				headerRow.createEl("th", { text: h });
			});

			// Table body
			const tbody = table.createEl("tbody");
			let orderTotal = 0;

			this.order.lineItems.forEach((item) => {
				const row = tbody.createEl("tr");
				const qty = item.quantity || 0;
				const price = item.price || 0;
				const lineTotal = qty * price;
				orderTotal += lineTotal;

				// Product name
				row.createEl("td", {
					text: item.productName || item.productId || "Unknown",
					cls: item.isKnownProduct === false ? "mm-order-modal__unknown-product" : "",
				});

				// Line item status
				const statusCell = row.createEl("td");
				const lineStatus = item.status || "new";
				const lineStatusConfig = LINE_STATUS_CONFIG[lineStatus] || LINE_STATUS_CONFIG.new;
				const lineStatusEl = statusCell.createSpan({ cls: "mm-order-modal__line-status" });
				lineStatusEl.textContent = `${lineStatusConfig.icon}`;
				lineStatusEl.style.setProperty("--status-color", lineStatusConfig.color);
				lineStatusEl.setAttribute("title", lineStatus);

				row.createEl("td", { text: qty.toString() });
				row.createEl("td", { text: item.unitOfMeasurement || "-" });
				row.createEl("td", { text: price > 0 ? this.fmt(price) : "-" });
				row.createEl("td", { text: lineTotal > 0 ? this.fmt(lineTotal) : "-" });

				// Note row if exists
				if (item.note) {
					const noteRow = tbody.createEl("tr", { cls: "mm-order-modal__note-row" });
					const noteCell = noteRow.createEl("td");
					noteCell.setAttribute("colspan", "6");
					noteCell.createSpan({ cls: "mm-order-modal__note", text: `📝 ${item.note}` });
				}
			});

			// Total row
			const totalRow = tbody.createEl("tr", { cls: "mm-order-modal__total-row" });
			totalRow.createEl("td", { text: "Total", attr: { colspan: "5" } });
			totalRow.createEl("td", { text: this.fmt(orderTotal), cls: "mm-order-modal__total-value" });
		}

		// ═══════════════════════════════════════════════════════════════════
		// ACTIONS
		// ═══════════════════════════════════════════════════════════════════
		const actions = contentEl.createDiv({ cls: "mm-order-modal__actions" });

		const actionsLeft = actions.createDiv({ cls: "mm-order-modal__actions-left" });
		const actionsRight = actions.createDiv({ cls: "mm-order-modal__actions-right" });

		// Close button (always visible)
		const closeBtn = actionsLeft.createEl("button", {
			cls: "mm-order-modal__btn mm-order-modal__btn--secondary",
			text: "Close",
		});
		closeBtn.addEventListener("click", () => this.close());

		// Primary action button (based on status)
		if (statusConfig.nextAction) {
			const { label, callback } = statusConfig.nextAction;
			const actionBtn = actionsRight.createEl("button", {
				cls: "mm-order-modal__btn mm-order-modal__btn--primary",
				text: label,
			});
			actionBtn.style.setProperty("--status-color", statusConfig.color);
			actionBtn.addEventListener("click", () => {
				const cb = this.callbacks[callback];
				if (cb) cb(this.order);
				this.close();
			});
		} else {
			// Order is closed - show disabled state
			const completedBtn = actionsRight.createEl("button", {
				cls: "mm-order-modal__btn mm-order-modal__btn--primary",
				text: "✅ Order Completed",
			});
			completedBtn.disabled = true;
			completedBtn.style.setProperty("--status-color", statusConfig.color);
		}
	}

	private createInfoRow(parent: HTMLElement, label: string, value: string) {
		const row = parent.createDiv({ cls: "mm-order-modal__info-row" });
		row.createSpan({ cls: "mm-order-modal__info-label", text: label });
		row.createSpan({ cls: "mm-order-modal__info-value", text: value || "-" });
	}

	private formatDate(timestamp: number): string {
		if (!timestamp) return "-";
		const date = new Date(timestamp);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	private fmt(n: number): string {
		if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
		if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
		return `$${n.toFixed(2)}`;
	}

	onClose() {
		this.contentEl.empty();
	}
}
