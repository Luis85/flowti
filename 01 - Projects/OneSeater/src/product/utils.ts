/**
 * Product Management Utilities
 *
 * Helper functions for working with products and services
 */

import { Product, PricingType, ProductCategory } from "src/models/Product";
import { CreateProductInput, DEFAULT_FLAGS, ProductStats } from ".";

/**
 * Helper to create default service (player's work)
 */
export function createDefaultService(): CreateProductInput {
	return {
		name: "Car Repairs",
		description: "Professional car mechanic looking for work.",
		category: "service",
		pricingType: "per_hour",
		price: 6,
		flags: DEFAULT_FLAGS.service,
	};
}

/**
 * Calculate total value of products in inventory
 */
export function calculateInventoryValue(products: Product[]): number {
	return products.reduce((total, product) => {
		if (!product.flags.stockable || !product.currentStock) {
			return total;
		}
		return total + product.price * product.currentStock;
	}, 0);
}

/**
 * Get products that need restocking (below min stock level)
 */
export function getProductsNeedingRestock(products: Product[]): Product[] {
	return products.filter(
		(p) =>
			p.flags.stockable &&
			p.isActive &&
			p.minStock !== undefined &&
			p.currentStock !== undefined &&
			p.currentStock < p.minStock
	);
}

/**
 * Get all sellable and active products
 */
export function getSellableProducts(products: Product[]): Product[] {
	return products.filter((p) => p.flags.sellable && p.isActive);
}

/**
 * Get all services (for player work)
 */
export function getServices(products: Product[]): Product[] {
	return products.filter((p) => p.category === "service" && p.isActive);
}

/**
 * Calculate hourly rate from a service product
 */
export function getHourlyRate(product: Product): number | null {
	if (product.category !== "service") return null;
	if (product.pricingType !== "per_hour") return null;
	return product.price;
}

/**
 * Format price display
 */
export function formatPrice(price: number, pricingType: PricingType): string {
	const formatted = price.toFixed(2);
	const suffix = pricingType === "per_hour" ? "/hr" : "";
	return `€${formatted}${suffix}`;
}

/**
 * Generate SKU if not provided
 */
export function generateSKU(
	product: { name: string; category: ProductCategory },
	index: number
): string {
	const categoryPrefix: Record<ProductCategory, string> = {
		service: "SRV",
		physical_product: "PHY",
		digital_product: "DIG",
	};

	const prefix = categoryPrefix[product.category];
	const nameShort = product.name
		.substring(0, 3)
		.toUpperCase()
		.replace(/[^A-Z]/g, "");
	const number = String(index).padStart(4, "0");

	return `${prefix}-${nameShort}${number}`;
}

/**
 * Validate stock level
 */
export function validateStock(product: Product, quantity: number): boolean {
	if (!product.flags.stockable) return true; // Services have no stock
	if (product.currentStock === undefined) return false;
	return product.currentStock >= quantity;
}

/**
 * Check if product can be produced
 */
export function canProduce(product: Product): boolean {
	return product.flags.producible && product.isActive;
}

/**
 * Get product statistics
 */
export function getProductStats(products: Product[]): ProductStats {
	return {
		total: products.length,
		active: products.filter((p) => p.isActive).length,
		services: products.filter((p) => p.category === "service").length,
		physicalProducts: products.filter(
			(p) => p.category === "physical_product"
		).length,
		digitalProducts: products.filter(
			(p) => p.category === "digital_product"
		).length,
		stockableItems: products.filter((p) => p.flags.stockable).length,
		totalInventoryValue: calculateInventoryValue(products),
		itemsNeedingRestock: getProductsNeedingRestock(products).length,
	};
}

/**
 * Sort products by various criteria
 */
export type ProductSortKey =
	| "name"
	| "price"
	| "category"
	| "createdAt"
	| "updatedAt";

export function sortProducts(
	products: Product[],
	key: ProductSortKey,
	ascending = true
): Product[] {
	const sorted = [...products].sort((a, b) => {
		let comparison = 0;

		switch (key) {
			case "name":
				comparison = a.name.localeCompare(b.name);
				break;
			case "price":
				comparison = a.price - b.price;
				break;
			case "category":
				comparison = a.category.localeCompare(b.category);
				break;
			case "createdAt":
				comparison = a.createdAt - b.createdAt;
				break;
			case "updatedAt":
				comparison = a.updatedAt - b.updatedAt;
				break;
		}

		return ascending ? comparison : -comparison;
	});

	return sorted;
}

/**
 * Filter products by search query
 */
export function searchProducts(products: Product[], query: string): Product[] {
	const lowerQuery = query.toLowerCase().trim();
	if (!lowerQuery) return products;

	return products.filter(
		(p) =>
			p.name.toLowerCase().includes(lowerQuery) ||
			p.description.toLowerCase().includes(lowerQuery) ||
			p.sku?.toLowerCase().includes(lowerQuery)
	);
}

/**
 * Export products to CSV format
 */
export function exportProductsToCSV(products: Product[]): string {
	const headers = [
		"ID",
		"Name",
		"Description",
		"Category",
		"Pricing Type",
		"Price",
		"SKU",
		"Stockable",
		"Sellable",
		"Producible",
		"Digital",
		"Current Stock",
		"Min Stock",
		"Active",
		"Created At",
		"Updated At",
	];

	const rows = products.map((p) => [
		p.id,
		p.name,
		p.description,
		p.category,
		p.pricingType,
		p.price.toString(),
		p.sku || "",
		p.flags.stockable ? "Yes" : "No",
		p.flags.sellable ? "Yes" : "No",
		p.flags.producible ? "Yes" : "No",
		p.flags.digital ? "Yes" : "No",
		p.currentStock?.toString() || "",
		p.minStock?.toString() || "",
		p.isActive ? "Yes" : "No",
		new Date(p.createdAt).toISOString(),
		new Date(p.updatedAt).toISOString(),
	]);

	const csvContent = [headers, ...rows]
		.map((row) => row.map((cell) => `"${cell}"`).join(","))
		.join("\n");

	return csvContent;
}

/**
 * Import products from CSV format
 */
export function importProductsFromCSV(csvContent: string): Product[] {
	const lines = csvContent.split("\n");
	if (lines.length < 2) return [];

	const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
	const products: Product[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const values = line.split(",").map((v) => v.replace(/"/g, "").trim());
		const row: Record<string, string> = {};

		headers.forEach((header, index) => {
			row[header] = values[index] || "";
		});

		try {
			const product: Product = {
				id: row.ID,
				name: row.Name,
				description: row.Description,
				category: row.Category as ProductCategory,
				pricingType: row["Pricing Type"] as PricingType,
				price: parseFloat(row.Price),
				sku: row.SKU || undefined,
				flags: {
					stockable: row.Stockable === "Yes",
					sellable: row.Sellable === "Yes",
					producible: row.Producible === "Yes",
					digital: row.Digital === "Yes",
				},
				currentStock: row["Current Stock"]
					? parseInt(row["Current Stock"])
					: undefined,
				minStock: row["Min Stock"]
					? parseInt(row["Min Stock"])
					: undefined,
				isActive: row.Active === "Yes",
				createdAt: new Date(row["Created At"]).getTime(),
				updatedAt: new Date(row["Updated At"]).getTime(),
			};

			products.push(product);
		} catch (err) {
			console.error(`Error parsing product at line ${i + 1}:`, err);
		}
	}

	return products;
}

export function getCategoryLabel(category: ProductCategory): string {
	const labels: Record<ProductCategory, string> = {
		service: "🔧 Service",
		physical_product: "📦 Physical",
		digital_product: "💾 Digital",
	};
	return labels[category];
}

/**
 * Fisher-Yates shuffle (more random, slightly slower)
 */
export function fisherYatesShuffle<T>(array: T[], rng: () => number): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}
