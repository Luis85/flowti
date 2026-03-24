// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// Mock scene-configs to avoid excalibur dependency
vi.mock("../../../src/game/data/scene-configs.js", () => ({
	ROOM_IDS: ["hub", "office", "village", "station"],
}));

import config from "../../../configs/scene-objects.json";
import { validateSceneObjects } from "../../../src/game/data/scene-object-schema.js";

describe("scene-objects.json", () => {
	it("is valid", () => {
		const result = validateSceneObjects(config.objects);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("has 16 objects", () => {
		expect(config.objects).toHaveLength(16);
	});

	it("every room has at least one food and one drink station", () => {
		for (const room of ["hub", "office", "village", "station"]) {
			const food = config.objects.filter((o) => o.room === room && o.type === "food");
			const drink = config.objects.filter((o) => o.room === room && o.type === "drink");
			expect(food.length, `${room} missing food`).toBeGreaterThanOrEqual(1);
			expect(drink.length, `${room} missing drink`).toBeGreaterThanOrEqual(1);
		}
	});
});
