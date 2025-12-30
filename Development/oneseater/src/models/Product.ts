export interface Product {
	id: string;
	name: string;
	description: string;
	category: ProductCategory;
	pricingType: PricingType;
	price: number;
	flags: ProductFlags;

	// Optional fields
	sku?: string; // Stock Keeping Unit
	currentStock?: number; // Current inventory level
	minStock?: number; // Minimum stock alert level

	// Metadata
	createdAt: number; // timestamp
	updatedAt: number; // timestamp
	isActive: boolean; // Can be used in transactions

	reorderPoint: number | undefined
}
export type PricingType = "per_unit" | "per_hour";

export type ProductCategory =
	| "service"
	| "physical_product"
	| "digital_product";

export interface ProductFlags {
	stockable: boolean; // Can be stored in inventory
	sellable: boolean; // Can be sold to customers
	producible: boolean; // Can be manufactured/created
	digital: boolean; // Digital product (no physical inventory)
}
