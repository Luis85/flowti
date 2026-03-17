/**
 * LineItemGenerator Configuration Presets
 * 
 * Ready-to-use configurations for different game stages and scenarios.
 * Import and apply these to quickly tune the generator.
 */

// ═══════════════════════════════════════════════════════════════
// GAME STAGE PRESETS
// ═══════════════════════════════════════════════════════════════

/**
 * Early Game (Levels 1-10)
 * - Small orders
 * - Few products per order
 * - Easy to fulfill
 */
export const EARLY_GAME_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [1, 5] as [number, number],
		SMALL: [1, 3] as [number, number],
		MEDIUM: [3, 8] as [number, number],
		BULK: [10, 30] as [number, number],
		ENTERPRISE: [50, 150] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 1,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 3,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Custom/Unknown Product",
		CUSTOM_REQUEST_NOTE: "Custom Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: false,
		SHUFFLE_RANDOMNESS: 0.5,
	},
};

/**
 * Mid Game (Levels 11-25)
 * - Medium orders
 * - Moderate product variety
 * - Balanced challenge
 */
export const MID_GAME_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [5, 15] as [number, number],
		SMALL: [2, 8] as [number, number],
		MEDIUM: [10, 30] as [number, number],
		BULK: [30, 100] as [number, number],
		ENTERPRISE: [100, 300] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 2,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 6,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Custom/Unknown Product",
		CUSTOM_REQUEST_NOTE: "Custom Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: false,
		SHUFFLE_RANDOMNESS: 0.5,
	},
};

/**
 * Late Game (Levels 26+)
 * - Large orders
 * - High product variety
 * - Complex fulfillment
 */
export const LATE_GAME_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [10, 30] as [number, number],
		SMALL: [5, 15] as [number, number],
		MEDIUM: [15, 50] as [number, number],
		BULK: [50, 200] as [number, number],
		ENTERPRISE: [200, 1000] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 3,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 10,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Custom/Unknown Product",
		CUSTOM_REQUEST_NOTE: "Custom Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: true, // Better randomness for complex orders
		SHUFFLE_RANDOMNESS: 0.6,
	},
};

// ═══════════════════════════════════════════════════════════════
// BUSINESS MODEL PRESETS
// ═══════════════════════════════════════════════════════════════

/**
 * Boutique/Premium Business
 * - Very small, exclusive orders
 * - High value per item
 * - Limited product selection per order
 */
export const BOUTIQUE_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [1, 3] as [number, number],
		SMALL: [1, 2] as [number, number],
		MEDIUM: [2, 5] as [number, number],
		BULK: [5, 15] as [number, number],
		ENTERPRISE: [15, 50] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 1,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 2,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "piece",
		UNKNOWN_PRODUCT_NOTE: "Bespoke Item",
		CUSTOM_REQUEST_NOTE: "Custom Commission",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: false,
		SHUFFLE_RANDOMNESS: 0.3, // Less randomness for curated selection
	},
};

/**
 * Wholesale Business
 * - Large bulk orders
 * - Multiple products
 * - High volumes
 */
export const WHOLESALE_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [20, 100] as [number, number],
		SMALL: [10, 30] as [number, number],
		MEDIUM: [30, 100] as [number, number],
		BULK: [100, 500] as [number, number],
		ENTERPRISE: [500, 2000] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 4,
		MIN_CATALOG_SIZE: 3,
		MAX_PRODUCTS_PER_ORDER: 12,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "case",
		UNKNOWN_PRODUCT_NOTE: "Special Order Item",
		CUSTOM_REQUEST_NOTE: "Wholesale Inquiry",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: true,
		SHUFFLE_RANDOMNESS: 0.7, // High randomness for variety
	},
};

/**
 * Service Business
 * - Small quantities (hours, sessions)
 * - Few items per order
 * - Service-oriented
 */
export const SERVICE_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [1, 10] as [number, number],
		SMALL: [1, 5] as [number, number],
		MEDIUM: [5, 20] as [number, number],
		BULK: [20, 100] as [number, number],
		ENTERPRISE: [100, 500] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 1,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 3,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "hour",
		UNKNOWN_PRODUCT_NOTE: "Custom Service Package",
		CUSTOM_REQUEST_NOTE: "Consultation Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: false,
		SHUFFLE_RANDOMNESS: 0.4,
	},
};

// ═══════════════════════════════════════════════════════════════
// SPECIAL EVENT PRESETS
// ═══════════════════════════════════════════════════════════════

/**
 * Black Friday / Sales Event
 * - Very high volumes
 * - Many products
 * - Chaotic orders
 */
export const SALES_EVENT_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [15, 50] as [number, number],
		SMALL: [10, 25] as [number, number],
		MEDIUM: [25, 75] as [number, number],
		BULK: [75, 300] as [number, number],
		ENTERPRISE: [300, 1500] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 4,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 15,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Sale Item",
		CUSTOM_REQUEST_NOTE: "Special Offer",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: true,
		SHUFFLE_RANDOMNESS: 0.8, // High chaos
	},
};

/**
 * Holiday Season
 * - Moderate to high volumes
 * - Gift-oriented
 * - Mixed product types
 */
export const HOLIDAY_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [5, 20] as [number, number],
		SMALL: [2, 10] as [number, number],
		MEDIUM: [10, 40] as [number, number],
		BULK: [40, 150] as [number, number],
		ENTERPRISE: [150, 600] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 3,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 8,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Gift Item",
		CUSTOM_REQUEST_NOTE: "Holiday Special Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: true,
		SHUFFLE_RANDOMNESS: 0.6,
	},
};

// ═══════════════════════════════════════════════════════════════
// DIFFICULTY PRESETS
// ═══════════════════════════════════════════════════════════════

/**
 * Easy Mode
 * - Small, manageable orders
 * - Low complexity
 * - Beginner-friendly
 */
export const EASY_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [1, 5] as [number, number],
		SMALL: [1, 3] as [number, number],
		MEDIUM: [3, 10] as [number, number],
		BULK: [10, 30] as [number, number],
		ENTERPRISE: [30, 100] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 1,
		MIN_CATALOG_SIZE: 1,
		MAX_PRODUCTS_PER_ORDER: 2,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Custom Item",
		CUSTOM_REQUEST_NOTE: "Special Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: false,
		SHUFFLE_RANDOMNESS: 0.3,
	},
};

/**
 * Hard Mode
 * - Large, complex orders
 * - High variety
 * - Challenging fulfillment
 */
export const HARD_PRESET = {
	QUANTITY_DEFAULTS: {
		DEFAULT: [20, 50] as [number, number],
		SMALL: [10, 25] as [number, number],
		MEDIUM: [25, 75] as [number, number],
		BULK: [75, 250] as [number, number],
		ENTERPRISE: [250, 1000] as [number, number],
	},
	PRODUCT_SELECTION: {
		MIXED_KNOWN_COUNT: 5,
		MIN_CATALOG_SIZE: 5,
		MAX_PRODUCTS_PER_ORDER: 15,
	},
	LINE_ITEM_DEFAULTS: {
		UNIT_OF_MEASUREMENT: "unit",
		UNKNOWN_PRODUCT_NOTE: "Complex Custom Item",
		CUSTOM_REQUEST_NOTE: "Complex Request",
	},
	RANDOM_CONFIG: {
		USE_FISHER_YATES: true,
		SHUFFLE_RANDOMNESS: 0.8,
	},
};

// ═══════════════════════════════════════════════════════════════
// PRESET APPLICATION HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Apply a preset to the LineItemGenerator constants
 * 
 * @example
 * import { applyPreset, MID_GAME_PRESET } from "./LineItemGeneratorPresets";
 * applyPreset(MID_GAME_PRESET);
 */
export function applyPreset(preset: typeof EARLY_GAME_PRESET) {
	// Note: This requires importing the actual generator file
	// For proper usage, import the constants directly in your code:
	// 
	// import { 
	//     QUANTITY_DEFAULTS, 
	//     PRODUCT_SELECTION,
	//     LINE_ITEM_DEFAULTS,
	//     RANDOM_CONFIG
	// } from "./LineItemGenerator";
	// 
	// Then apply manually:
	// Object.assign(QUANTITY_DEFAULTS, preset.QUANTITY_DEFAULTS);
	// etc.
	
	console.warn("[LineItemGenerator] Use applyPresetManually() or import constants directly");
	console.log("Preset to apply:", preset);
}

/**
 * Helper to manually apply a preset
 * Use this in your code where you have access to the LineItemGenerator constants
 * 
 * @example
 * import { QUANTITY_DEFAULTS, PRODUCT_SELECTION, LINE_ITEM_DEFAULTS, RANDOM_CONFIG } from "./LineItemGenerator";
 * import { applyPresetManually, MID_GAME_PRESET } from "./LineItemGeneratorPresets";
 * 
 * applyPresetManually(
 *     MID_GAME_PRESET,
 *     QUANTITY_DEFAULTS,
 *     PRODUCT_SELECTION,
 *     LINE_ITEM_DEFAULTS,
 *     RANDOM_CONFIG
 * );
 */
export function applyPresetManually(
	preset: typeof EARLY_GAME_PRESET,
	quantityDefaults: typeof EARLY_GAME_PRESET.QUANTITY_DEFAULTS,
	productSelection: typeof EARLY_GAME_PRESET.PRODUCT_SELECTION,
	lineItemDefaults: typeof EARLY_GAME_PRESET.LINE_ITEM_DEFAULTS,
	randomConfig: typeof EARLY_GAME_PRESET.RANDOM_CONFIG
) {
	Object.assign(quantityDefaults, preset.QUANTITY_DEFAULTS);
	Object.assign(productSelection, preset.PRODUCT_SELECTION);
	Object.assign(lineItemDefaults, preset.LINE_ITEM_DEFAULTS);
	Object.assign(randomConfig, preset.RANDOM_CONFIG);
	
	console.log("[LineItemGenerator] Preset applied successfully");
}

/**
 * Get all available presets
 */
export const PRESETS = {
	// Game Stages
	EARLY_GAME: EARLY_GAME_PRESET,
	MID_GAME: MID_GAME_PRESET,
	LATE_GAME: LATE_GAME_PRESET,

	// Business Models
	BOUTIQUE: BOUTIQUE_PRESET,
	WHOLESALE: WHOLESALE_PRESET,
	SERVICE: SERVICE_PRESET,

	// Events
	SALES_EVENT: SALES_EVENT_PRESET,
	HOLIDAY: HOLIDAY_PRESET,

	// Difficulty
	EASY: EASY_PRESET,
	HARD: HARD_PRESET,
};

/**
 * Apply preset by name
 * 
 * @example
 * import { 
 *     QUANTITY_DEFAULTS, 
 *     PRODUCT_SELECTION,
 *     LINE_ITEM_DEFAULTS,
 *     RANDOM_CONFIG
 * } from "./LineItemGenerator";
 * import { applyPresetByName } from "./LineItemGeneratorPresets";
 * 
 * applyPresetByName(
 *     "MID_GAME",
 *     QUANTITY_DEFAULTS,
 *     PRODUCT_SELECTION,
 *     LINE_ITEM_DEFAULTS,
 *     RANDOM_CONFIG
 * );
 */
export function applyPresetByName(
	presetName: keyof typeof PRESETS,
	quantityDefaults: typeof EARLY_GAME_PRESET.QUANTITY_DEFAULTS,
	productSelection: typeof EARLY_GAME_PRESET.PRODUCT_SELECTION,
	lineItemDefaults: typeof EARLY_GAME_PRESET.LINE_ITEM_DEFAULTS,
	randomConfig: typeof EARLY_GAME_PRESET.RANDOM_CONFIG
) {
	const preset = PRESETS[presetName];
	if (!preset) {
		console.error(`[LineItemGenerator] Unknown preset: ${presetName}`);
		return;
	}
	applyPresetManually(preset, quantityDefaults, productSelection, lineItemDefaults, randomConfig);
}
