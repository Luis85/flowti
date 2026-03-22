/**
 * food-preferences.ts — Quirk-based food/drink station preferences.
 *
 * Maps quirk IDs to preferred station names. When an agent is hungry/thirsty,
 * the BT checks their quirks for a preferred station before falling back to
 * nearest-available.
 */

/** Maps quirk IDs to preferred food stations. */
export const FOOD_STATION_PREFERENCES: Record<string, string> = {
	"coffee-addict": "CoffeeMachine",
	"snacker": "SnackTable",
};

/** Maps quirk IDs to preferred drink stations. */
export const DRINK_STATION_PREFERENCES: Record<string, string> = {
	"coffee-addict": "CoffeeMachine",
	"health-nut": "WaterCooler",
};

/**
 * Returns the preferred food station name for an agent based on their quirks,
 * or null if no preference applies. First matching quirk wins.
 */
export function getPreferredFoodStation(quirks: readonly string[]): string | null {
	for (const q of quirks) {
		const pref = FOOD_STATION_PREFERENCES[q];
		if (pref) return pref;
	}
	return null;
}

/**
 * Returns the preferred drink station name for an agent based on their quirks,
 * or null if no preference applies. First matching quirk wins.
 */
export function getPreferredDrinkStation(quirks: readonly string[]): string | null {
	for (const q of quirks) {
		const pref = DRINK_STATION_PREFERENCES[q];
		if (pref) return pref;
	}
	return null;
}
