import { describe, it, expect } from "vitest";
import { drawOfficeFloor, drawVillageFloor, drawStationFloor } from "../../src/actors/scene-backgrounds.js";

// Mock CanvasRenderingContext2D since we're in node
function createMockCtx() {
	return {
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
		fillRect: () => {},
		strokeRect: () => {},
		beginPath: () => {},
		moveTo: () => {},
		lineTo: () => {},
		stroke: () => {},
		createRadialGradient: () => ({
			addColorStop: () => {},
		}),
		arc: () => {},
		fill: () => {},
	} as unknown as CanvasRenderingContext2D;
}

describe("scene backgrounds", () => {
	it("drawOfficeFloor runs without error", () => {
		expect(() => drawOfficeFloor(createMockCtx(), 1200, 700)).not.toThrow();
	});
	it("drawVillageFloor runs without error", () => {
		expect(() => drawVillageFloor(createMockCtx(), 1200, 700)).not.toThrow();
	});
	it("drawStationFloor runs without error", () => {
		expect(() => drawStationFloor(createMockCtx(), 1200, 700)).not.toThrow();
	});
});
