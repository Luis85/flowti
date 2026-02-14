import { TFile, setIcon } from "obsidian";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	renderStat, renderRelatedSection,
	findRelatedFlows, findRelatedSystems, findRelatedActors,
	openFile, normalizeNonConformingFiles,
} from "./helpers";
import {
	getProductDocPathResolved,
} from "../eventDocTemplate";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps, ProductEntry } from "./types";
import { scanEntityFolder } from "./entityScanner";

/**
 * Products tab component for the Event Catalog view.
 * Renders the master list of products and the detail panel for a selected product.
 */
export class ProductsTab {
	private entries: ProductEntry[] = [];
	private selectedProduct: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getEntries(): ProductEntry[] { return this.entries; }
	getSelectedProduct(): string | null { return this.selectedProduct; }
	setSelectedProduct(name: string | null): void { this.selectedProduct = name; }

	render(): void {
		this.renderMaster();
		this.renderDetail();
	}

	// -----------------------------------------------------------------
	// Scanning
	// -----------------------------------------------------------------

	scan(): void {
		const result = scanEntityFolder<ProductEntry>({
			entityType: "products",
			nameFields: ["product", "name"],
			docType: "ProductDoc",
			normalizeNameKey: "product",
			mapEntry: (raw, ctx) => ({
				...raw,
				resolvedEvents: raw.events
					.map((t) => ctx.entryMap.get(t))
					.filter((e): e is EventCatalogEntry => e !== undefined),
			}),
		}, this.deps);
		this.entries = result.entries;
		normalizeNonConformingFiles(this.deps.app, result.nonConforming);
	}

	// -----------------------------------------------------------------
	// Master list
	// -----------------------------------------------------------------

	renderMaster(): void {
		this.scan();
		this.masterEl.empty();

		const state = this.deps.getState();
		let products = this.entries;

		if (state.filterText) {
			products = products.filter(
				(p) =>
					p.name.toLowerCase().includes(state.filterText) ||
					p.description.toLowerCase().includes(state.filterText) ||
					p.events.some((e) => e.toLowerCase().includes(state.filterText)) ||
					p.domains.some((d) => d.toLowerCase().includes(state.filterText)) ||
					p.services.some((svc) => svc.toLowerCase().includes(state.filterText)),
			);
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Products" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new product");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "Create New Product",
				placeholder: "My Product",
				submitLabel: "Create",
				inputName: "Product name",
				inputDesc: "A name for this product",
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		for (const p of products) {
			const isSelected = this.selectedProduct === p.name;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "package");
			iconEl.addClass("ft-icon-muted");
			iconEl.addClass("ft-flex-shrink-0");

			item.createSpan({ text: p.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${p.resolvedEvents.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedProduct = p.name;
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// -----------------------------------------------------------------
	// Detail panel
	// -----------------------------------------------------------------

	renderDetail(): void {
		this.detailEl.empty();

		if (!this.selectedProduct) {
			this.renderDetailEmpty();
			return;
		}

		const productData = this.entries.find((p) => p.name === this.selectedProduct);
		if (!productData) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: productData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${productData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${productData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${productData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (productData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: productData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains -- clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (productData.domains.length > 0) {
			for (const dom of productData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services -- clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (productData.services.length > 0) {
			for (const svc of productData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.deps.navigation.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions" });

		// Open doc file
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Doc");
		docBtn.addEventListener("click", () => {
			void openFile(this.deps.workspace, productData.filePath);
		});

		// Delete product
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete product "${productData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteDoc(productData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${productData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const eventType of productData.events) {
			const resolved = productData.resolvedEvents.find((e) => e.type === eventType);
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.createSpan({ text: eventType, cls: "ft-event-type" });
			if (resolved) {
				row.addClass("ft-cursor-pointer");
				row.createSpan({ text: resolved.category, cls: "ft-catalog-meta" });
				row.addEventListener("click", () => {
					this.deps.navigation.navigateToEvent(eventType);
				});
			} else {
				row.createSpan({ text: "unresolved", cls: "ft-catalog-meta ft-text-muted" });
			}
		}

		// Related entities
		const state = this.deps.getState();
		const criteria = { events: productData.events, domains: productData.domains, services: productData.services };

		renderRelatedSection(
			this.detailEl, "Related Flows",
			findRelatedFlows(state.flowEntries, criteria).map((f) => ({
				name: f.name,
				onClick: () => this.deps.navigation.navigateToFlow(f.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Systems",
			findRelatedSystems(state.systemEntries, criteria).map((s) => ({
				name: s.name,
				onClick: () => this.deps.navigation.navigateToSystem(s.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Actors",
			findRelatedActors(state.actorEntries, criteria).map((a) => ({
				name: a.name,
				onClick: () => this.deps.navigation.navigateToActor(a.name),
			})),
		);
	}

	// -----------------------------------------------------------------
	// Detail empty state
	// -----------------------------------------------------------------

	private renderDetailEmpty(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "package");
		icon.addClass("ft-icon-subtle");

		empty.createEl("p", { text: "Select a product to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${this.entries.length}`, "products");
		const totalEvents = this.entries.reduce((sum, p) => sum + p.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.entries.flatMap((p) => p.domains)).size;
		renderStat(stats, `${totalDomains}`, "domains");
	}

	// -----------------------------------------------------------------
	// Document CRUD
	// -----------------------------------------------------------------

	createDoc(name: string): void {
		const folder = this.deps.getEntityFolder("products");
		const docPath = getProductDocPathResolved(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, docPath);
			return;
		}
		this.selectedProduct = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: "ProductDoc",
			name,
			entityType: "products",
			source: "ProductsTab",
		});
	}

	deleteDoc(filePath: string): void {
		this.selectedProduct = null;
		void this.deps.eventBus.emit("doc.delete", {
			path: filePath,
			source: "ProductsTab",
		});
	}
}
