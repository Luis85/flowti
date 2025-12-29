/**
 * Product Catalog Types
 * ERP-style product and service management
 */

import { ProductCategory, PricingType, ProductFlags } from "src/models/Product";

export interface CreateProductInput {
	name: string;
	description: string;
	category: ProductCategory;
	pricingType: PricingType;
	price: number;
	flags: ProductFlags;
	sku?: string;
	minStock?: number;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
	id: string;
	isActive?: boolean;
}

/**
 * Default product flags for different categories
 */
export const DEFAULT_FLAGS: Record<ProductCategory, ProductFlags> = {
	service: {
		stockable: false,
		sellable: true,
		producible: false,
		digital: false,
	},
	physical_product: {
		stockable: true,
		sellable: true,
		producible: true,
		digital: false,
	},
	digital_product: {
		stockable: false,
		sellable: true,
		producible: true,
		digital: true,
	},
};

export interface ProductStats {
	total: number;
	active: number;
	services: number;
	physicalProducts: number;
	digitalProducts: number;
	stockableItems: number;
	totalInventoryValue: number;
	itemsNeedingRestock: number;
}
