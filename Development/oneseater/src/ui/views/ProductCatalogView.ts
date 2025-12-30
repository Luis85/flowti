import { ItemView, WorkspaceLeaf, Modal, Notice } from "obsidian";
import { ProductCatalogUpdatedEvent } from "src/eventsystem/product/ProductCatalogUpdated";
import { ProductCreatedEvent } from "src/eventsystem/product/ProductCreatedEvent";
import { ProductDeletedEvent } from "src/eventsystem/product/ProductDeletedEvent";
import { ProductUpdatedEvent } from "src/eventsystem/product/ProductUpdatedEvent";
import { Product } from "src/models/Product";
import { CreateProductInput } from "src/product";
import { getProductStats, getCategoryLabel, createDefaultService } from "src/product/utils";
import { ProductModal } from "../modals/ProductModal";
import { IEventBus } from "src/eventsystem";
import { ProductStore } from "src/simulation/stores/ProductStore";

export const GAME_PRODUCT_CATALOG_VIEW = "oneseater-product-catalog-view";

export class ProductCatalogView extends ItemView {
	private rootEl?: HTMLElement;
	private statsEl?: HTMLElement;
	private productTableEl?: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		private events: IEventBus,
		private store: ProductStore  // Renamed for clarity
	) {
		super(leaf);
	}

	getViewType() {
		return GAME_PRODUCT_CATALOG_VIEW;
	}

	getDisplayText() {
		return "OneSeater - Your Products and Services";
	}

	async onOpen() {
		this.events.subscribe(ProductCatalogUpdatedEvent, this.onProductCatalogUpdate);

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("f1-dashboard");

		this.rootEl = container.createDiv({ cls: "f1-dashboard" });

		this.buildHeader();
		this.buildStatsBar();
		this.buildProductTable();
	}

	// ─────────────────────────────────────────────────────────────
	// EVENT HANDLERS
	// ─────────────────────────────────────────────────────────────
	private onProductCatalogUpdate = (_event: ProductCatalogUpdatedEvent) => {
		// Store reference is stable - just refresh UI
		this.refresh();
	};

	// ─────────────────────────────────────────────────────────────
	// HEADER
	// ─────────────────────────────────────────────────────────────
	private buildHeader() {
		if (!this.rootEl) return;

		const header = this.rootEl.createDiv({ cls: "pc-header" });

		const titleBlock = header.createDiv({ cls: "pc-header-title" });
		const titleRow = titleBlock.createDiv({ cls: "pc-title-row" });
		titleRow.createDiv({ text: "📦", cls: "pc-header-icon" });
		titleRow.createEl("h1", { text: "Product Catalog" });

		titleBlock.createEl("p", {
			text: "Manage your products and services",
			cls: "pc-header-desc",
		});

		const actions = header.createDiv({ cls: "pc-header-actions" });

		if (this.store.length === 0) {
			const defaultBtn = actions.createEl("button", {
				text: "Add Default Service",
				cls: "f1-btn f1-btn-small",
			});
			defaultBtn.addEventListener("click", () => this.addDefaultService());
		}

		const createBtn = actions.createEl("button", {
			text: "✚ Create Product",
			cls: "f1-btn f1-btn-primary",
		});
		createBtn.addEventListener("click", () => this.openCreateModal());
	}

	// ─────────────────────────────────────────────────────────────
	// STATS BAR
	// ─────────────────────────────────────────────────────────────
	private buildStatsBar() {
		if (!this.rootEl) return;
		this.statsEl = this.rootEl.createDiv({ cls: "pc-stats-bar" });
		this.renderStats();
	}

	private renderStats() {
		if (!this.statsEl) return;
		this.statsEl.empty();

		const stats = getProductStats(this.store.getAll());
		const grid = this.statsEl.createDiv({ cls: "pc-stats-grid" });

		this.createStatCard(grid, "📦", stats.total, "Total Products");
		this.createStatCard(grid, "✓", stats.active, "Active");
		this.createStatCard(grid, "🔧", stats.services, "Services");
		this.createStatCard(grid, "📦", stats.physicalProducts, "Physical");
		this.createStatCard(grid, "💾", stats.digitalProducts, "Digital");
		this.createStatCard(grid, "💰", `€${stats.totalInventoryValue.toFixed(2)}`, "Inventory Value");

		if (stats.itemsNeedingRestock > 0) {
			const restockCard = this.createStatCard(grid, "⚠️", stats.itemsNeedingRestock, "Need Restock");
			restockCard.addClass("pc-stat-warning");
		}
	}

	private createStatCard(parent: HTMLElement, icon: string, value: string | number, label: string): HTMLElement {
		const card = parent.createDiv({ cls: "pc-stat-card" });
		card.createDiv({ text: icon, cls: "pc-stat-icon" });
		card.createDiv({ text: String(value), cls: "pc-stat-value" });
		card.createDiv({ text: label, cls: "pc-stat-label" });
		return card;
	}

	// ─────────────────────────────────────────────────────────────
	// PRODUCT TABLE
	// ─────────────────────────────────────────────────────────────
	private buildProductTable() {
		if (!this.rootEl) return;

		const content = this.rootEl.createDiv({ cls: "f1-content" });
		this.productTableEl = content.createDiv({ cls: "pc-table-container" });
		this.renderProductTable();
	}

	private renderProductTable() {
		if (!this.productTableEl) return;
		this.productTableEl.empty();

		if (this.store.length === 0) {
			this.renderEmptyState();
			return;
		}

		const table = this.productTableEl.createEl("table", { cls: "f1-table pc-table" });

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		["Name", "Category", "Price", "Flags", "Status", "Actions"].forEach(text => {
			headerRow.createEl("th", { text });
		});

		const tbody = table.createEl("tbody");
		for (const product of this.store) {
			this.renderProductRow(tbody, product);
		}
	}

	private renderEmptyState() {
		if (!this.productTableEl) return;

		const empty = this.productTableEl.createDiv({ cls: "pc-empty-state" });
		empty.createDiv({ text: "📭", cls: "pc-empty-icon" });
		empty.createDiv({ text: "No products yet", cls: "pc-empty-title" });
		empty.createDiv({ text: "Create your first product to get started!", cls: "pc-empty-subtitle" });
	}

	private renderProductRow(tbody: HTMLElement, product: Product) {
		const row = tbody.createEl("tr");

		// Name & Description
		const nameCell = row.createEl("td");
		const nameDiv = nameCell.createDiv({ cls: "pc-product-name" });
		nameDiv.createDiv({ text: product.name, cls: "pc-name-text" });
		if (product.description) {
			nameDiv.createDiv({ text: product.description, cls: "pc-desc-text" });
		}

		// Category
		const categoryCell = row.createEl("td");
		categoryCell.createDiv({
			text: getCategoryLabel(product.category),
			cls: "pc-category-badge",
		});

		// Price
		const priceCell = row.createEl("td");
		const priceText = `€${product.price.toFixed(2)} ${product.pricingType === "per_hour" ? "/hr" : "/unit"}`;
		priceCell.createDiv({ text: priceText, cls: "pc-price-text" });

		// Flags
		const flagsCell = row.createEl("td");
		const flagsDiv = flagsCell.createDiv({ cls: "pc-flags-inline" });
		if (product.flags.stockable) flagsDiv.createSpan({ text: "📦", title: "Stockable" });
		if (product.flags.sellable) flagsDiv.createSpan({ text: "💰", title: "Sellable" });
		if (product.flags.producible) flagsDiv.createSpan({ text: "🏭", title: "Producible" });
		if (product.flags.digital) flagsDiv.createSpan({ text: "💾", title: "Digital" });

		// Status
		const statusCell = row.createEl("td");
		statusCell.createDiv({
			text: product.isActive ? "✓ Active" : "✗ Inactive",
			cls: product.isActive ? "pc-status-active" : "pc-status-inactive",
		});

		// Actions
		const actionsCell = row.createEl("td");
		const actionsDiv = actionsCell.createDiv({ cls: "pc-actions" });

		this.createActionButton(actionsDiv, "✏️", "Edit product", () => this.openEditModal(product));
		this.createActionButton(
			actionsDiv,
			product.isActive ? "⏸️" : "▶️",
			product.isActive ? "Deactivate" : "Activate",
			() => this.toggleProductStatus(product.id)
		);
		this.createActionButton(actionsDiv, "🗑️", "Delete product", () => this.confirmDelete(product));
	}

	private createActionButton(parent: HTMLElement, text: string, title: string, onClick: () => void) {
		const btn = parent.createEl("button", { text, cls: "f1-btn f1-btn-small" });
		btn.title = title;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// MODAL ACTIONS
	// ─────────────────────────────────────────────────────────────
	private openCreateModal() {
		new ProductModal(this.app, undefined, (data) => this.createProduct(data)).open();
	}

	private openEditModal(product: Product) {
		new ProductModal(this.app, product, (data) => this.updateProduct(product.id, data)).open();
	}

	private confirmDelete(product: Product) {
		const modal = new Modal(this.app);
		modal.titleEl.setText("Delete Product");

		modal.contentEl.createEl("p", { text: `Are you sure you want to delete "${product.name}"?` });
		modal.contentEl.createEl("p", { text: "This action cannot be undone.", cls: "mod-warning" });

		const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });
		buttonContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;";

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => modal.close());

		const deleteBtn = buttonContainer.createEl("button", { text: "Delete", cls: "mod-warning" });
		deleteBtn.addEventListener("click", () => {
			this.deleteProduct(product.id);
			modal.close();
		});

		modal.open();
	}

	// ─────────────────────────────────────────────────────────────
	// CRUD OPERATIONS (publish events only)
	// ─────────────────────────────────────────────────────────────
	private createProduct(data: CreateProductInput) {
		const product: Product = {
			id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			...data,
			currentStock: data.flags.stockable ? 0 : undefined,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isActive: true,
		};

		this.events.publish(new ProductCreatedEvent(product));
		new Notice(`✓ Created: ${product.name}`);
	}

	private updateProduct(id: string, data: CreateProductInput) {
		const existingProduct = this.store.findById(id);
		if (!existingProduct) {
			new Notice("❌ Product not found");
			return;
		}

		const updatedProduct: Product = {
			...existingProduct,
			...data,
			updatedAt: Date.now(),
		};

		this.events.publish(new ProductUpdatedEvent(updatedProduct));
		new Notice(`✓ Updated: ${data.name}`);
	}

	private deleteProduct(id: string) {
		const product = this.store.findById(id);
		if (!product) {
			new Notice("❌ Product not found");
			return;
		}

		this.events.publish(new ProductDeletedEvent(product));
		new Notice(`✓ Deleted: ${product.name}`);
	}

	private toggleProductStatus(id: string) {
		const product = this.store.findById(id);
		if (!product) {
			new Notice("❌ Product not found");
			return;
		}

		const updatedProduct: Product = {
			...product,
			isActive: !product.isActive,
			updatedAt: Date.now(),
		};

		this.events.publish(new ProductUpdatedEvent(updatedProduct));
		new Notice(`${updatedProduct.isActive ? "✓ Activated" : "⏸️ Deactivated"}: ${updatedProduct.name}`);
	}

	private addDefaultService() {
		const defaultService = createDefaultService();
		this.createProduct(defaultService);
	}

	// ─────────────────────────────────────────────────────────────
	// REFRESH UI
	// ─────────────────────────────────────────────────────────────
	private refresh() {
		const oldHeader = this.rootEl?.querySelector(".pc-header");
		if (oldHeader) {
			oldHeader.remove();
			this.buildHeader();
		}

		this.renderStats();
		this.renderProductTable();
	}

	async onClose() {
		this.events.unsubscribe(ProductCatalogUpdatedEvent, this.onProductCatalogUpdate);

		this.rootEl = undefined;
		this.statsEl = undefined;
		this.productTableEl = undefined;
	}
}
