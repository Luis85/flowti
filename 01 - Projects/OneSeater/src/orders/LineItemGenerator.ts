import { Product } from "src/models/Product";
import { OrderStatus } from "src/models/SalesOrder";
import { LineItemStrategy, LineItem, LineItemTemplate } from "src/orders";
import { randomFromRange, pickRandom } from "src/messages/utils";

// ═══════════════════════════════════════════════════════════════
// TUNING CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default quantity ranges for different order types
 */
export const QUANTITY_DEFAULTS = {
	/** Default range when not specified in strategy */
	DEFAULT: [1, 10] as [number, number],
	
	/** Small orders (individual customers) */
	SMALL: [1, 5] as [number, number],
	
	/** Medium orders (regular business) */
	MEDIUM: [5, 20] as [number, number],
	
	/** Bulk orders (wholesale, events) */
	BULK: [20, 100] as [number, number],
	
	/** Enterprise orders (large contracts) */
	ENTERPRISE: [100, 500] as [number, number],
};

/**
 * Product selection configuration
 */
export const PRODUCT_SELECTION = {
	/** Default number of different products in mixed orders */
	MIXED_KNOWN_COUNT: 2,
	
	/** Minimum products needed in catalog to generate orders */
	MIN_CATALOG_SIZE: 1,
	
	/** Maximum products to select for large orders */
	MAX_PRODUCTS_PER_ORDER: 10,
};

/**
 * Line item metadata defaults
 */
export const LINE_ITEM_DEFAULTS = {
	/** Default unit of measurement for products */
	UNIT_OF_MEASUREMENT: "unit" as string,
	
	/** Note text for unknown/custom products */
	UNKNOWN_PRODUCT_NOTE: "Custom/Unknown Product",
	
	/** Note text for custom requests */
	CUSTOM_REQUEST_NOTE: "Custom Request",
};

/**
 * Random selection configuration
 */
export const RANDOM_CONFIG = {
	/** Use Fisher-Yates shuffle instead of simple sort */
	USE_FISHER_YATES: false,
	
	/** Minimum randomness for shuffle (0-1) */
	SHUFFLE_RANDOMNESS: 0.5,
};

// ═══════════════════════════════════════════════════════════════
// LINE ITEM GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Generates line items based on strategy and available products
 * Returns LineItem[] directly
 */
export class LineItemGenerator {
	/**
	 * Generate line items from strategy
	 * @param strategy Line item generation strategy
	 * @param availableProducts Products currently in catalog
	 * @param rng Random number generator (returns 0-1)
	 */
	static generate(
		strategy: LineItemStrategy | undefined,
		availableProducts: Product[],
		rng: () => number
	): LineItem[] {
		if (!strategy) return [];

		// Check minimum catalog size
		if (
			availableProducts.length < PRODUCT_SELECTION.MIN_CATALOG_SIZE &&
			strategy.type !== "none" &&
			strategy.type !== "unknown_products"
		) {
			console.warn(
				`[LineItemGenerator] Catalog too small (${availableProducts.length} products). Need at least ${PRODUCT_SELECTION.MIN_CATALOG_SIZE}.`
			);
			return [];
		}

		switch (strategy.type) {
			case "none":
				return [];

			case "known_products":
				return this.generateKnownProducts(
					strategy,
					availableProducts,
					rng
				);

			case "unknown_products":
				return this.generateUnknownProducts(strategy, rng);

			case "mixed":
				return this.generateMixed(strategy, availableProducts, rng);

			case "custom":
				return this.generateCustom(strategy, availableProducts, rng);

			default:
				return [];
		}
	}

	/**
	 * Generate line items from known products in catalog
	 */
	private static generateKnownProducts(
		strategy: Extract<LineItemStrategy, { type: "known_products" }>,
		availableProducts: Product[],
		rng: () => number
	): LineItem[] {
		if (availableProducts.length === 0) return [];

		const count = Math.min(
			randomFromRange(strategy.count, rng()),
			PRODUCT_SELECTION.MAX_PRODUCTS_PER_ORDER
		);
		
		const selected = pickRandom(availableProducts, count, rng);
		const quantityRange = strategy.quantityRange || QUANTITY_DEFAULTS.DEFAULT;

		return selected.map((product) => ({
			type: "CustomerPurchaseOrderLineItem" as const,
			status: "new",
			productId: product.id,
			productName: product.name,
			quantity: randomFromRange(quantityRange, rng()),
			price: product.price,
			unitOfMeasurement: LINE_ITEM_DEFAULTS.UNIT_OF_MEASUREMENT,
			isKnownProduct: true,
		}));
	}

	/**
	 * Generate line items from unknown/fictional products
	 */
	private static generateUnknownProducts(
		strategy: Extract<LineItemStrategy, { type: "unknown_products" }>,
		rng: () => number
	): LineItem[] {
		return strategy.products.map((spec) => ({
			type: "CustomerPurchaseOrderLineItem" as const,
			status: "new" as OrderStatus,
			productId: undefined,
			productName: spec.name,
			quantity: randomFromRange(spec.quantity, rng()),
			price: spec.estimatedPrice,
			unitOfMeasurement: LINE_ITEM_DEFAULTS.UNIT_OF_MEASUREMENT,
			isKnownProduct: false,
			note: LINE_ITEM_DEFAULTS.UNKNOWN_PRODUCT_NOTE,
		}));
	}

	/**
	 * Generate mixed line items (known + unknown)
	 */
	private static generateMixed(
		strategy: Extract<LineItemStrategy, { type: "mixed" }>,
		availableProducts: Product[],
		rng: () => number
	): LineItem[] {
		const items: LineItem[] = [];

		// Add known products
		const knownCount = strategy.knownCount || PRODUCT_SELECTION.MIXED_KNOWN_COUNT;
		if (knownCount > 0 && availableProducts.length > 0) {
			const selected = pickRandom(
				availableProducts,
				Math.min(knownCount, availableProducts.length),
				rng
			);
			items.push(
				...selected.map((product) => ({
					type: "CustomerPurchaseOrderLineItem" as const,
					status: "new" as OrderStatus,
					productId: product.id,
					productName: product.name,
					quantity: randomFromRange(QUANTITY_DEFAULTS.SMALL, rng()),
					price: product.price,
					unitOfMeasurement: LINE_ITEM_DEFAULTS.UNIT_OF_MEASUREMENT,
					isKnownProduct: true,
				}))
			);
		}

		// Add unknown products
		items.push(
			...strategy.unknownProducts.map((spec) => ({
				type: "CustomerPurchaseOrderLineItem" as const,
				status: "new" as OrderStatus,
				productId: undefined,
				productName: spec.name,
				quantity: randomFromRange(spec.quantity, rng()),
				price: spec.estimatedPrice,
				unitOfMeasurement: LINE_ITEM_DEFAULTS.UNIT_OF_MEASUREMENT,
				isKnownProduct: false,
				note: LINE_ITEM_DEFAULTS.UNKNOWN_PRODUCT_NOTE,
			}))
		);

		// Shuffle to mix known and unknown
		return items.sort(() => rng() - RANDOM_CONFIG.SHUFFLE_RANDOMNESS);
	}

	/**
	 * Generate custom line items from templates
	 */
	private static generateCustom(
		strategy: Extract<LineItemStrategy, { type: "custom" }>,
		availableProducts: Product[],
		rng: () => number
	): LineItem[] {
		return strategy.items
			.map((template) => {
				if (template.type === "known_product") {
					return this.resolveKnownProduct(
						template,
						availableProducts,
						rng
					);
				} else {
					return this.resolveUnknownProduct(template, rng);
				}
			})
			.filter((item): item is LineItem => item !== null);
	}

	/**
	 * Resolve a known product template
	 */
	private static resolveKnownProduct(
		template: Extract<LineItemTemplate, { type: "known_product" }>,
		availableProducts: Product[],
		rng: () => number
	): LineItem | null {
		let product: Product | undefined;

		if (template.productId) {
			// Specific product requested
			product = availableProducts.find(
				(p) => p.id === template.productId
			);
		} else {
			// Pick random product
			const selected = pickRandom(availableProducts, 1, rng);
			product = selected[0];
		}

		if (!product) return null;

		return {
			type: "CustomerPurchaseOrderLineItem",
			status: "new" as OrderStatus,
			productId: product.id,
			productName: product.name,
			quantity: randomFromRange(template.quantity, rng()),
			price: product.price,
			unitOfMeasurement: LINE_ITEM_DEFAULTS.UNIT_OF_MEASUREMENT,
			isKnownProduct: true,
		};
	}

	/**
	 * Resolve an unknown product spec/template
	 */
	private static resolveUnknownProduct(
		spec: Extract<LineItemTemplate, { type: "unknown_product" }>,
		rng: () => number
	): LineItem {
		return {
			type: "CustomerPurchaseOrderLineItem",
			status: "new" as OrderStatus,
			productId: undefined,
			productName: spec.name,
			quantity: randomFromRange(spec.quantity, rng()),
			price: spec.estimatedPrice,
			unitOfMeasurement: LINE_ITEM_DEFAULTS.UNIT_OF_MEASUREMENT,
			isKnownProduct: false,
			note: LINE_ITEM_DEFAULTS.CUSTOM_REQUEST_NOTE,
		};
	}
}
