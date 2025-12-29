import { Product, ProductCategory, PricingType } from "src/models/Product";
import { Modal, App, Notice, Setting } from "obsidian";
import { CreateProductInput, DEFAULT_FLAGS } from "src/product";

export class ProductModal extends Modal {
	private product?: Product;
	private onSubmit: (data: CreateProductInput) => void;

	// Form data
	private name = "";
	private description = "";
	private category: ProductCategory = "service";
	private pricingType: PricingType = "per_hour";
	private price = 0;
	private sku = "";
	private minStock = 0;
	private flags = { ...DEFAULT_FLAGS.service };

	constructor(
		app: App,
		product: Product | undefined,
		onSubmit: (data: CreateProductInput) => void
	) {
		super(app);
		this.product = product;
		this.onSubmit = onSubmit;

		// Initialize with existing product data if editing
		if (product) {
			this.name = product.name;
			this.description = product.description;
			this.category = product.category;
			this.pricingType = product.pricingType;
			this.price = product.price;
			this.sku = product.sku || "";
			this.minStock = product.minStock || 0;
			this.flags = { ...product.flags };
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: this.product ? "Edit Product" : "Create New Product",
		});

		// Name
		new Setting(contentEl)
			.setName("Product/Service Name")
			.setDesc("Required")
			.addText((text) =>
				text
					.setPlaceholder("Enter product name")
					.setValue(this.name)
					.onChange((value) => {
						this.name = value;
					})
			);

		// Description
		new Setting(contentEl)
			.setName("Description")
			.setDesc("Required")
			.addTextArea((text) => {
				text
					.setPlaceholder("Describe your product or service")
					.setValue(this.description)
					.onChange((value) => {
						this.description = value;
					});
				text.inputEl.rows = 4;
			});

		// Category
		new Setting(contentEl)
			.setName("Category")
			.setDesc("Product type")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("service", "🔧 Service (Labor/Time)")
					.addOption("physical_product", "📦 Physical Product")
					.addOption("digital_product", "💾 Digital Product")
					.setValue(this.category)
					.onChange((value: ProductCategory) => {
						this.category = value;
						// Update flags to category defaults
						this.flags = { ...DEFAULT_FLAGS[value] };
						// Refresh the modal to show updated checkboxes
						this.onOpen();
					})
			);

		// Pricing Type
		new Setting(contentEl)
			.setName("Pricing Type")
			.setDesc("How to charge for this product")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("per_hour", "⏱️ Per Hour")
					.addOption("per_unit", "📦 Per Unit")
					.setValue(this.pricingType)
					.onChange((value: PricingType) => {
						this.pricingType = value;
					})
			);

		// Price
		new Setting(contentEl)
			.setName("Price")
			.setDesc("Price in €")
			.addText((text) =>
				text
					.setPlaceholder("100")
					.setValue(String(this.price))
					.onChange((value) => {
						this.price = parseFloat(value) || 0;
					})
					.inputEl.setAttribute("type", "number")
			);

		// SKU (Optional)
		new Setting(contentEl)
			.setName("SKU")
			.setDesc("Stock Keeping Unit (optional)")
			.addText((text) =>
				text
					.setPlaceholder("e.g. SRV-0001")
					.setValue(this.sku)
					.onChange((value) => {
						this.sku = value;
					})
			);

		// Min Stock (if stockable)
		if (this.flags.stockable) {
			new Setting(contentEl)
				.setName("Minimum Stock")
				.setDesc("Alert when stock falls below this level")
				.addText((text) =>
					text
						.setPlaceholder("0")
						.setValue(String(this.minStock))
						.onChange((value) => {
							this.minStock = parseInt(value) || 0;
						})
						.inputEl.setAttribute("type", "number")
				);
		}

		// Flags Section
		contentEl.createEl("h3", { text: "Product Flags" });

		new Setting(contentEl)
			.setName("📦 Stockable")
			.setDesc("Can be stored in inventory")
			.addToggle((toggle) =>
				toggle.setValue(this.flags.stockable).onChange((value) => {
					this.flags.stockable = value;
				})
			);

		new Setting(contentEl)
			.setName("💰 Sellable")
			.setDesc("Can be sold to customers")
			.addToggle((toggle) =>
				toggle.setValue(this.flags.sellable).onChange((value) => {
					this.flags.sellable = value;
				})
			);

		new Setting(contentEl)
			.setName("🏭 Producible")
			.setDesc("Can be manufactured/created")
			.addToggle((toggle) =>
				toggle.setValue(this.flags.producible).onChange((value) => {
					this.flags.producible = value;
				})
			);

		new Setting(contentEl)
			.setName("💾 Digital")
			.setDesc("Digital product (no physical inventory)")
			.addToggle((toggle) =>
				toggle.setValue(this.flags.digital).onChange((value) => {
					this.flags.digital = value;
				})
			);

		// Buttons
		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});
		buttonContainer.style.cssText =
			"display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;";

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const submitBtn = buttonContainer.createEl("button", {
			text: this.product ? "Update" : "Create",
			cls: "mod-cta",
		});
		submitBtn.addEventListener("click", () => {
			this.handleSubmit();
		});
	}

	private handleSubmit() {
		// Validation
		if (!this.name.trim()) {
			new Notice("Product name is required");
			return;
		}

		if (!this.description.trim()) {
			new Notice("Description is required");
			return;
		}

		if (this.price <= 0) {
			new Notice("Price must be greater than 0");
			return;
		}

		// Build data
		const data: CreateProductInput = {
			name: this.name.trim(),
			description: this.description.trim(),
			category: this.category,
			pricingType: this.pricingType,
			price: this.price,
			flags: this.flags,
			sku: this.sku.trim() || undefined,
			minStock: this.flags.stockable ? this.minStock : undefined,
		};

		this.onSubmit(data);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
