import { describe, it, expect } from "vitest";
import { getPreferredFoodStation, getPreferredDrinkStation } from "../../../src/game/data/food-preferences.js";

describe("food-preferences", () => {
	it("coffee-addict prefers CoffeeMachine for food", () => {
		expect(getPreferredFoodStation(["coffee-addict"])).toBe("CoffeeMachine");
	});

	it("snacker prefers SnackTable for food", () => {
		expect(getPreferredFoodStation(["snacker"])).toBe("SnackTable");
	});

	it("coffee-addict prefers CoffeeMachine for drinks", () => {
		expect(getPreferredDrinkStation(["coffee-addict"])).toBe("CoffeeMachine");
	});

	it("health-nut prefers WaterCooler for drinks", () => {
		expect(getPreferredDrinkStation(["health-nut"])).toBe("WaterCooler");
	});

	it("returns null for agents without food quirks", () => {
		expect(getPreferredFoodStation(["perfectionist"])).toBeNull();
	});

	it("returns null for empty quirk list", () => {
		expect(getPreferredFoodStation([])).toBeNull();
	});

	it("first matching quirk wins", () => {
		expect(getPreferredFoodStation(["snacker", "coffee-addict"])).toBe("SnackTable");
	});
});
