import { ItemView, WorkspaceLeaf, Modal, Notice } from "obsidian";
import { ProductCatalogUpdatedEvent } from "src/eventsystem/product/ProductCatalogUpdated";
import { ProductCreatedEvent } from "src/eventsystem/product/ProductCreatedEvent";
import { ProductDeletedEvent } from "src/eventsystem/product/ProductDeletedEvent";
import { ProductUpdatedEvent } from "src/eventsystem/product/ProductUpdatedEvent";
import { Product, ProductCategory } from "src/models/Product";
import { CreateProductInput } from "src/product";
import { getCategoryLabel, createDefaultService } from "src/product/utils";
import { ProductModal } from "../modals/ProductModal";
import { IEventBus } from "src/eventsystem";
import { ProductStore } from "src/simulation/stores/ProductStore";

export const GAME_PRODUCT_CATALOG_VIEW = "oneseater-product-catalog-view";

type CategoryFilter = "all" | ProductCategory;
type StatusFilter = "all" | "active" | "inactive";

const ITEMS_PER_PAGE = 50;

export class ProductCatalogView extends ItemView {
    private containerEl_: HTMLElement | null = null;
    private listEl: HTMLElement | null = null;

    // Filter state
    private searchQuery = "";
    private categoryFilter: CategoryFilter = "all";
    private statusFilter: StatusFilter = "all";
    private currentPage = 0;

    constructor(
        leaf: WorkspaceLeaf,
        private events: IEventBus,
        private store: ProductStore
    ) {
        super(leaf);
    }

    getViewType() {
        return GAME_PRODUCT_CATALOG_VIEW;
    }

    getDisplayText() {
        return "Product Catalog";
    }

    getIcon() {
        return "package";
    }

    async onOpen() {
        this.events.subscribe(ProductCatalogUpdatedEvent, this.onCatalogUpdate);

        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        this.containerEl_ = container.createDiv({ cls: "pc-container" });

        this.render();
    }

    async onClose() {
        this.events.unsubscribe(ProductCatalogUpdatedEvent, this.onCatalogUpdate);
        this.containerEl_ = null;
        this.listEl = null;
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────
    private onCatalogUpdate = () => {
        this.renderList();
    };

    // ─────────────────────────────────────────────────────────────
    // FILTERING & PAGINATION
    // ─────────────────────────────────────────────────────────────
    private getFilteredProducts(): Product[] {
        let products = this.store.getAll();

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query)
            );
        }

        // Category filter
        if (this.categoryFilter !== "all") {
            products = products.filter(p => p.category === this.categoryFilter);
        }

        // Status filter
        if (this.statusFilter === "active") {
            products = products.filter(p => p.isActive);
        } else if (this.statusFilter === "inactive") {
            products = products.filter(p => !p.isActive);
        }

        return products;
    }

    private getPagedProducts(): Product[] {
        const filtered = this.getFilteredProducts();
        const start = this.currentPage * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }

    private getTotalPages(): number {
        return Math.ceil(this.getFilteredProducts().length / ITEMS_PER_PAGE);
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    private render() {
        if (!this.containerEl_) return;
        this.containerEl_.empty();

        this.renderHeader();
        this.renderToolbar();
        this.renderListContainer();
    }

    private renderHeader() {
        if (!this.containerEl_) return;

        const header = this.containerEl_.createDiv({ cls: "pc-header" });

        // Left side: Title + Stats
        const left = header.createDiv({ cls: "pc-header-left" });

        const title = left.createDiv({ cls: "pc-title" });
        title.createSpan({ text: "📦", cls: "pc-title-icon" });
        title.createEl("h2", { text: "Products" });

        // Inline stats
        const stats = left.createDiv({ cls: "pc-header-stats" });
        const products = this.store.getAll();
        const activeCount = products.filter(p => p.isActive).length;

        this.createStat(stats, "Total", this.store.length);
        this.createStat(stats, "Active", activeCount);

        const lowStock = products.filter(p =>
            p.flags.stockable &&
            p.reorderPoint &&
            (p.currentStock ?? 0) < p.reorderPoint
        ).length;

        if (lowStock > 0) {
            this.createStat(stats, "Low Stock", lowStock, true);
        }

        // Right side: Actions
        const actions = header.createDiv({ cls: "pc-header-actions" });

        if (this.store.length === 0) {
            const defaultBtn = actions.createEl("button", {
                text: "Add Default",
                cls: "pc-btn pc-btn--small",
            });
            defaultBtn.addEventListener("click", () => this.addDefaultService());
        }

        const createBtn = actions.createEl("button", {
            text: "+ New Product",
            cls: "pc-btn pc-btn--primary",
        });
        createBtn.addEventListener("click", () => this.openCreateModal());
    }

    private createStat(parent: HTMLElement, label: string, value: number, isWarning = false) {
        const stat = parent.createDiv({ cls: `pc-stat ${isWarning ? "pc-stat--warning" : ""}` });
        stat.createSpan({ text: `${label}: `, cls: "pc-stat-label" });
        stat.createSpan({ text: String(value), cls: "pc-stat-value" });
    }

    private renderToolbar() {
        if (!this.containerEl_) return;

        const toolbar = this.containerEl_.createDiv({ cls: "pc-toolbar" });

        // Search
        const search = toolbar.createDiv({ cls: "pc-search" });
        search.createSpan({ text: "🔍", cls: "pc-search-icon" });

        const input = search.createEl("input", {
            cls: "pc-search-input",
            placeholder: "Search products...",
        });
        input.type = "text";
        input.value = this.searchQuery;
        input.addEventListener("input", (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value;
            this.currentPage = 0;
            this.renderList();
        });

        // Category tabs
        const tabs = toolbar.createDiv({ cls: "pc-tabs" });
        const categories: { key: CategoryFilter; label: string }[] = [
            { key: "all", label: "All" },
            { key: "service", label: "Services" },
            { key: "physical_product", label: "Physical" },
            { key: "digital_product", label: "Digital" },
        ];

        for (const cat of categories) {
            const tab = tabs.createEl("button", {
                text: cat.label,
                cls: `pc-tab ${this.categoryFilter === cat.key ? "is-active" : ""}`,
            });
            tab.addEventListener("click", () => {
                this.categoryFilter = cat.key;
                this.currentPage = 0;
                this.render();
            });
        }

        // Status filter
        const filters = toolbar.createDiv({ cls: "pc-filters" });
        const statuses: { key: StatusFilter; label: string }[] = [
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
        ];

        for (const status of statuses) {
            const pill = filters.createEl("button", {
                text: status.label,
                cls: `pc-filter-pill ${this.statusFilter === status.key ? "is-active" : ""}`,
            });
            pill.addEventListener("click", () => {
                this.statusFilter = status.key;
                this.currentPage = 0;
                this.render();
            });
        }
    }

    private renderListContainer() {
        if (!this.containerEl_) return;

        const container = this.containerEl_.createDiv({ cls: "pc-list-container" });

        // Header row
        const header = container.createDiv({ cls: "pc-list-header" });
        header.createSpan({ text: "Product" });
        header.createSpan({ text: "Category" });
        header.createSpan({ text: "Price" });
        header.createSpan({ text: "Status" });
        header.createSpan({ text: "" }); // Actions

        // List
        this.listEl = container.createDiv({ cls: "pc-list" });
        this.renderList();

        // Pagination
        this.renderPagination(container);
    }

    private renderList() {
        if (!this.listEl) return;
        this.listEl.empty();

        const products = this.getPagedProducts();

        if (products.length === 0) {
            this.renderEmptyState();
            return;
        }

        for (const product of products) {
            this.renderProductRow(product);
        }

        // Update pagination
        const pagination = this.containerEl_?.querySelector(".pc-pagination");
        if (pagination) {
            pagination.remove();
            const container = this.listEl.parentElement;
            if (container) this.renderPagination(container);
        }
    }

    private renderEmptyState() {
        if (!this.listEl) return;

        const empty = this.listEl.createDiv({ cls: "pc-empty" });
        empty.createDiv({ text: "📭", cls: "pc-empty-icon" });

        if (this.searchQuery || this.categoryFilter !== "all" || this.statusFilter !== "all") {
            empty.createDiv({ text: "No matching products", cls: "pc-empty-title" });
            empty.createDiv({ text: "Try adjusting your filters", cls: "pc-empty-subtitle" });
        } else {
            empty.createDiv({ text: "No products yet", cls: "pc-empty-title" });
            empty.createDiv({ text: "Create your first product to get started", cls: "pc-empty-subtitle" });
        }
    }

    private renderProductRow(product: Product) {
        if (!this.listEl) return;

        const row = this.listEl.createDiv({ cls: "pc-row" });

        // Product info
        const info = row.createDiv({ cls: "pc-product-info" });
        info.createDiv({ text: product.name, cls: "pc-product-name" });
        if (product.description) {
            info.createDiv({ text: product.description, cls: "pc-product-desc" });
        }

        // Category
        const category = row.createDiv({ cls: "pc-category" });
        category.createSpan({ text: this.getCategoryIcon(product.category), cls: "pc-category-icon" });
        category.createSpan({ text: getCategoryLabel(product.category) });

        // Price
        const price = row.createDiv({ cls: "pc-price" });
        price.createSpan({ text: `€${product.price.toFixed(2)}` });
        if (product.pricingType === "per_hour") {
            price.createSpan({ text: "/hr", cls: "pc-price-unit" });
        }

        // Status
        const statusCls = product.isActive ? "pc-status--active" : "pc-status--inactive";
        const status = row.createDiv({ cls: `pc-status ${statusCls}` });
        status.createSpan({ cls: "pc-status-dot" });
        status.createSpan({ text: product.isActive ? "Active" : "Inactive" });

        // Actions
        const actions = row.createDiv({ cls: "pc-actions" });

        this.createActionBtn(actions, "✏️", "Edit", () => this.openEditModal(product));
        this.createActionBtn(
            actions,
            product.isActive ? "⏸" : "▶",
            product.isActive ? "Deactivate" : "Activate",
            () => this.toggleStatus(product.id)
        );
        this.createActionBtn(actions, "🗑", "Delete", () => this.confirmDelete(product), true);
    }

    private getCategoryIcon(category: ProductCategory): string {
        switch (category) {
            case "service": return "🔧";
            case "physical_product": return "📦";
            case "digital_product": return "💾";
            default: return "•";
        }
    }

    private createActionBtn(
        parent: HTMLElement,
        icon: string,
        title: string,
        onClick: () => void,
        isDanger = false
    ) {
        const btn = parent.createEl("button", {
            text: icon,
            cls: `pc-action-btn ${isDanger ? "pc-action-btn--danger" : ""}`,
        });
        btn.title = title;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick();
        });
    }

    private renderPagination(container: HTMLElement) {
        const filtered = this.getFilteredProducts();
        const totalPages = this.getTotalPages();

        if (totalPages <= 1 && filtered.length <= ITEMS_PER_PAGE) return;

        const pagination = container.createDiv({ cls: "pc-pagination" });

        // Info
        const info = pagination.createDiv({ cls: "pc-pagination-info" });
        const start = this.currentPage * ITEMS_PER_PAGE + 1;
        const end = Math.min(start + ITEMS_PER_PAGE - 1, filtered.length);
        info.createSpan({ text: `${start}-${end} of ${filtered.length}` });

        // Controls
        const controls = pagination.createDiv({ cls: "pc-pagination-controls" });

        const prevBtn = controls.createEl("button", {
            text: "←",
            cls: "pc-btn pc-btn--small",
        });
        prevBtn.disabled = this.currentPage === 0;
        prevBtn.addEventListener("click", () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                this.renderList();
            }
        });

        controls.createSpan({ text: `${this.currentPage + 1} / ${totalPages}` });

        const nextBtn = controls.createEl("button", {
            text: "→",
            cls: "pc-btn pc-btn--small",
        });
        nextBtn.disabled = this.currentPage >= totalPages - 1;
        nextBtn.addEventListener("click", () => {
            if (this.currentPage < totalPages - 1) {
                this.currentPage++;
                this.renderList();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // MODALS
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

        modal.contentEl.createEl("p", {
            text: `Delete "${product.name}"? This cannot be undone.`,
        });

        const buttons = modal.contentEl.createDiv({
            cls: "modal-button-container",
        });
        buttons.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:16px";

        const cancelBtn = buttons.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => modal.close());

        const deleteBtn = buttons.createEl("button", {
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
			reorderPoint: 0,
        };

        this.events.publish(new ProductCreatedEvent(product));
        new Notice(`✓ Created: ${product.name}`);
    }

    private updateProduct(id: string, data: CreateProductInput) {
        const existing = this.store.findById(id);
        if (!existing) {
            new Notice("❌ Product not found");
            return;
        }

        const updated: Product = {
            ...existing,
            ...data,
            updatedAt: Date.now(),
        };

        this.events.publish(new ProductUpdatedEvent(updated));
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

    private toggleStatus(id: string) {
        const product = this.store.findById(id);
        if (!product) {
            new Notice("❌ Product not found");
            return;
        }

        const updated: Product = {
            ...product,
            isActive: !product.isActive,
            updatedAt: Date.now(),
        };

        this.events.publish(new ProductUpdatedEvent(updated));
        new Notice(`${updated.isActive ? "✓ Activated" : "⏸ Deactivated"}: ${updated.name}`);
    }

    private addDefaultService() {
        this.createProduct(createDefaultService());
    }
}
