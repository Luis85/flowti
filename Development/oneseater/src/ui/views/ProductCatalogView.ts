import { ItemView, WorkspaceLeaf, Modal, Notice } from "obsidian";
import { SimulationTickEvent } from "src/eventsystem/engine/SimulationTickEvent";
import { ProductCatalogUpdatedEvent } from "src/eventsystem/product/ProductCatalogUpdated";
import { ProductCreatedEvent } from "src/eventsystem/product/ProductCreatedEvent";
import { ProductDeletedEvent } from "src/eventsystem/product/ProductDeletedEvent";
import { ProductUpdatedEvent } from "src/eventsystem/product/ProductUpdatedEvent";
import { Product } from "src/models/Product";
import { CreateProductInput } from "src/product";
import { getProductStats, getCategoryLabel, createDefaultService } from "src/product/utils";
import { ProductModal } from "../modals/ProductModal";
import { IEventBus } from "src/eventsystem";


export const GAME_PRODUCT_CATALOG_VIEW = "oneseater-product-catalog-view";

export class ProductCatalogView extends ItemView {
	private events: IEventBus;
	private products: Product[] = [];
	private rootEl?: HTMLElement;
	private statsEl?: HTMLElement;
	private productTableEl?: HTMLElement;
	private initialized = false;

	constructor(leaf: WorkspaceLeaf, events: IEventBus) {
		super(leaf);
		this.events = events;
	}

	getViewType() {
		return GAME_PRODUCT_CATALOG_VIEW;
	}

	getDisplayText() {
		return "OneSeater - Your Products and Services";
	}

	async onOpen() {
		// Subscribe to events
		this.events.subscribe(
			ProductCatalogUpdatedEvent,
			this.onProductCatalogUpdate
		);
		this.events.subscribe(SimulationTickEvent, this.onSimulationTick);

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("f1-dashboard");

		this.rootEl = container.createDiv({ cls: "f1-dashboard" });

		// Build UI
		this.buildHeader();
		this.buildStatsBar();
		this.buildProductTable();

		// Initial state will come from first SimulationTickEvent
		console.log("ProductCatalogView: Waiting for initial state from SimulationTickEvent");
	}

	// ─────────────────────────────────────────────────────────────
	// EVENT HANDLERS
	// ─────────────────────────────────────────────────────────────
	private onSimulationTick = (event: SimulationTickEvent) => {
		// Load initial products from first tick
		if (!this.initialized && event.state?.products) {
			this.products = event.state.products;
			this.initialized = true;
			this.refresh();
			console.log(
				"ProductCatalogView: Loaded initial products from SimulationTickEvent",
				this.products
			);
		}
	};

	private onProductCatalogUpdate = (event: ProductCatalogUpdatedEvent) => {
		console.log("ProductCatalogView: Catalog updated", event.products);
		this.products = event.products;
		this.refresh();
	};

	// ─────────────────────────────────────────────────────────────
	// HEADER
	// ─────────────────────────────────────────────────────────────
	private buildHeader() {
		if (!this.rootEl) return;

		const header = this.rootEl.createDiv({ cls: "pc-header" });

		// Left: Title & Description
		const titleBlock = header.createDiv({ cls: "pc-header-title" });

		const titleRow = titleBlock.createDiv({ cls: "pc-title-row" });
		titleRow.createDiv({ text: "📦", cls: "pc-header-icon" });
		titleRow.createEl("h1", { text: "Product Catalog" });

		titleBlock.createEl("p", {
			text: "Manage your products and services",
			cls: "pc-header-desc",
		});

		// Right: Actions
		const actions = header.createDiv({ cls: "pc-header-actions" });

		// Only show "Add Default Service" if no products exist
		if (this.products.length === 0) {
			const defaultBtn = actions.createEl("button", {
				text: "Add Default Service",
				cls: "f1-btn f1-btn-small",
			});
			defaultBtn.addEventListener("click", () =>
				this.addDefaultService()
			);
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

		const stats = getProductStats(this.products);

		// Stats Grid
		const grid = this.statsEl.createDiv({ cls: "pc-stats-grid" });

		this.createStatCard(grid, "📦", stats.total, "Total Products");
		this.createStatCard(grid, "✓", stats.active, "Active");
		this.createStatCard(grid, "🔧", stats.services, "Services");
		this.createStatCard(grid, "📦", stats.physicalProducts, "Physical");
		this.createStatCard(grid, "💾", stats.digitalProducts, "Digital");
		this.createStatCard(
			grid,
			"💰",
			`€${stats.totalInventoryValue.toFixed(2)}`,
			"Inventory Value"
		);

		if (stats.itemsNeedingRestock > 0) {
			const restockCard = this.createStatCard(
				grid,
				"⚠️",
				stats.itemsNeedingRestock,
				"Need Restock"
			);
			restockCard.addClass("pc-stat-warning");
		}
	}

	private createStatCard(
		parent: HTMLElement,
		icon: string,
		value: string | number,
		label: string
	): HTMLElement {
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
		this.productTableEl = content.createDiv({
			cls: "pc-table-container",
		});
		this.renderProductTable();
	}

	private renderProductTable() {
		if (!this.productTableEl) return;
		this.productTableEl.empty();

		if (this.products.length === 0) {
			const empty = this.productTableEl.createDiv({
				cls: "pc-empty-state",
			});
			empty.createDiv({ text: "📭", cls: "pc-empty-icon" });
			empty.createDiv({
				text: "No products yet",
				cls: "pc-empty-title",
			});
			empty.createDiv({
				text: "Create your first product to get started!",
				cls: "pc-empty-subtitle",
			});
			return;
		}

		// Table
		const table = this.productTableEl.createEl("table", {
			cls: "f1-table pc-table",
		});

		// Header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		["Name", "Category", "Price", "Flags", "Status", "Actions"].forEach(
			(text) => {
				headerRow.createEl("th", { text });
			}
		);

		// Body
		const tbody = table.createEl("tbody");
		for (const product of this.products) {
			const row = tbody.createEl("tr");

			// Name & Description
			const nameCell = row.createEl("td");
			const nameDiv = nameCell.createDiv({ cls: "pc-product-name" });
			nameDiv.createDiv({ text: product.name, cls: "pc-name-text" });
			if (product.description) {
				nameDiv.createDiv({
					text: product.description,
					cls: "pc-desc-text",
				});
			}

			// Category
			const categoryCell = row.createEl("td");
			categoryCell.createDiv({
				text: getCategoryLabel(product.category),
				cls: "pc-category-badge",
			});

			// Price
			const priceCell = row.createEl("td");
			const priceText = `€${product.price.toFixed(2)} ${
				product.pricingType === "per_hour" ? "/hr" : "/unit"
			}`;
			priceCell.createDiv({ text: priceText, cls: "pc-price-text" });

			// Flags
			const flagsCell = row.createEl("td");
			const flagsDiv = flagsCell.createDiv({ cls: "pc-flags-inline" });
			if (product.flags.stockable)
				flagsDiv.createSpan({ text: "📦", title: "Stockable" });
			if (product.flags.sellable)
				flagsDiv.createSpan({ text: "💰", title: "Sellable" });
			if (product.flags.producible)
				flagsDiv.createSpan({ text: "🏭", title: "Producible" });
			if (product.flags.digital)
				flagsDiv.createSpan({ text: "💾", title: "Digital" });

			// Status
			const statusCell = row.createEl("td");
			statusCell.createDiv({
				text: product.isActive ? "✓ Active" : "✗ Inactive",
				cls: product.isActive
					? "pc-status-active"
					: "pc-status-inactive",
			});

			// Actions
			const actionsCell = row.createEl("td");
			const actionsDiv = actionsCell.createDiv({ cls: "pc-actions" });

			const editBtn = actionsDiv.createEl("button", {
				text: "✏️",
				cls: "f1-btn f1-btn-small",
			});
			editBtn.title = "Edit product";
			editBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.openEditModal(product);
			});

			const toggleBtn = actionsDiv.createEl("button", {
				text: product.isActive ? "⏸️" : "▶️",
				cls: "f1-btn f1-btn-small",
			});
			toggleBtn.title = product.isActive ? "Deactivate" : "Activate";
			toggleBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleProductStatus(product.id);
			});

			const deleteBtn = actionsDiv.createEl("button", {
				text: "🗑️",
				cls: "f1-btn f1-btn-small",
			});
			deleteBtn.title = "Delete product";
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.confirmDelete(product);
			});
		}
	}

	// ─────────────────────────────────────────────────────────────
	// MODAL ACTIONS
	// ─────────────────────────────────────────────────────────────
	private openCreateModal() {
		new ProductModal(this.app, undefined, (data) => {
			this.createProduct(data);
		}).open();
	}

	private openEditModal(product: Product) {
		new ProductModal(this.app, product, (data) => {
			this.updateProduct(product.id, data);
		}).open();
	}

	private confirmDelete(product: Product) {
		const modal = new Modal(this.app);
		modal.titleEl.setText("Delete Product");

		modal.contentEl.createEl("p", {
			text: `Are you sure you want to delete "${product.name}"?`,
		});
		modal.contentEl.createEl("p", {
			text: "This action cannot be undone.",
			cls: "mod-warning",
		});

		const buttonContainer = modal.contentEl.createDiv({
			cls: "modal-button-container",
		});
		buttonContainer.style.cssText =
			"display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;";

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => {
			modal.close();
		});

		const deleteBtn = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
		});
		deleteBtn.addEventListener("click", () => {
			this.deleteProduct(product.id);
			modal.close();
		});

		modal.open();
	}

	// ─────────────────────────────────────────────────────────────
	// CRUD OPERATIONS
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

		// Publish event - the system will handle updating the store
		this.events.publish(new ProductCreatedEvent(product));

		new Notice(`✓ Created: ${product.name}`);
	}

	private updateProduct(id: string, data: CreateProductInput) {
		const existingProduct = this.products.find((p) => p.id === id);
		if (!existingProduct) {
			new Notice("❌ Product not found");
			return;
		}

		const updatedProduct: Product = {
			...existingProduct,
			...data,
			updatedAt: Date.now(),
		};

		// Publish event - the system will handle updating the store
		this.events.publish(new ProductUpdatedEvent(updatedProduct));

		new Notice(`✓ Updated: ${data.name}`);
	}

	private deleteProduct(id: string) {
		const product = this.products.find((p) => p.id === id);
		if (!product) {
			new Notice("❌ Product not found");
			return;
		}

		// Publish event - the system will handle updating the store
		this.events.publish(new ProductDeletedEvent(product));

		new Notice(`✓ Deleted: ${product.name}`);
	}

	private toggleProductStatus(id: string) {
		const product = this.products.find((p) => p.id === id);
		if (!product) {
			new Notice("❌ Product not found");
			return;
		}

		const updatedProduct: Product = {
			...product,
			isActive: !product.isActive,
			updatedAt: Date.now(),
		};

		// Publish event - the system will handle updating the store
		this.events.publish(new ProductUpdatedEvent(updatedProduct));

		new Notice(
			`${updatedProduct.isActive ? "✓ Activated" : "⏸️ Deactivated"}: ${
				updatedProduct.name
			}`
		);
	}

	private addDefaultService() {
		const defaultService = createDefaultService();
		this.createProduct(defaultService);
	}

	// ─────────────────────────────────────────────────────────────
	// REFRESH UI
	// ─────────────────────────────────────────────────────────────
	private refresh() {
		// Rebuild header (to show/hide "Add Default Service" button)
		const oldHeader = this.rootEl?.querySelector(".pc-header");
		if (oldHeader) {
			oldHeader.remove();
			this.buildHeader();
		}

		// Update stats
		this.renderStats();

		// Update table
		this.renderProductTable();
	}

	async onClose() {
		this.events.unsubscribe(
			ProductCatalogUpdatedEvent,
			this.onProductCatalogUpdate
		);
		this.events.unsubscribe(SimulationTickEvent, this.onSimulationTick);

		this.rootEl = undefined;
		this.statsEl = undefined;
		this.productTableEl = undefined;
	}
}
