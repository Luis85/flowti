import { OrderStatus } from "src/models/SalesOrder";

export type LineItem = {
	type: LineItemType,
	status: OrderStatus,
	productId?: string,
	productName?: string,
	quantity?: number,
	unitOfMeasurement?: string,
	price?: number,
	cost?: number,
	note?: string,
	disposition?: DispositionType,
	isKnownProduct?: boolean,
}

export type LineItemType =
	| "OfferLineItem"
	| "QuoteLineItem"
	| "ProposalLineItem"
	| "CustomerPurchaseOrderLineItem"
	| "CustomerComplainLineItem"
	| "SalesOrderLineItem"
	| "PurchaseOrderLineItem"
	| "ProductionOrderLineItem"
	| "RecipeLineItem"
	| "PickTicketLineItem"
	| "ShippingLineItem"
	| "InvoiceLineItem"
	| "QualityIssueItem";

	export type DispositionType = "inventory" | "dropship" | "manufacture" | "service"
/**
 * Strategy for generating line items in purchase orders
 */
export type LineItemStrategy =
	// No line items - just description in body
	| { type: "none" }
	// Pick N random products from available catalog
	| { type: "known_products"; count: number | [number, number]; quantityRange?: [number, number] }
	// Use unknown/fictional products (customer wants things we don't have)
	| { type: "unknown_products"; products: UnknownProductSpec[] }
	// Mix of known and unknown products
	| { type: "mixed"; knownCount: number; unknownProducts: UnknownProductSpec[] }
	// Custom defined line items (for specific templates)
	| { type: "custom"; items: LineItemTemplate[] };

/**
 * Template for a single line item
 */
export type LineItemTemplate =
	// Reference to a known product (will be resolved at runtime)
	| { type: "known_product"; productId?: string; quantity: number | [number, number] }
	// Unknown product (customer asks for something we don't offer)
	| { type: "unknown_product"; name: string; quantity: number | [number, number]; estimatedPrice?: number };

/**
 * Specification for unknown products
 */
export interface UnknownProductSpec {
	name: string;
	quantity: number | [number, number];
	estimatedPrice?: number;
}
