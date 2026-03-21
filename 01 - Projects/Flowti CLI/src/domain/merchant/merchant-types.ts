/**
 * merchant-types.ts — Type definitions for the merchant catalog domain.
 */

export type ShopCategory = "capability" | "resource" | "cosmetic" | "pet-cosmetic" | "room";

export interface CatalogItem {
	readonly id: string;
	readonly name: string;
	readonly category: ShopCategory;
	readonly cost: { readonly coin: number };
	readonly requiresLevel?: number;
	readonly description: string;
	readonly oneTime?: boolean;
}

export interface MerchantCatalog {
	readonly version: number;
	readonly items: readonly CatalogItem[];
	readonly buyback: number;
	readonly restockCycle: string;
}
