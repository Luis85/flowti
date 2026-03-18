import { describe, it, expect } from "vitest";
import { preferredWorkstation } from "../../../src/game/brain/movement.js";

describe("preferredWorkstation", () => {
	it("returns nearest unoccupied workstation", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 200, y: 100, occupied: false },
			{ id: "ws-2", x: 110, y: 100, occupied: false },
		];
		const result = preferredWorkstation(pos, workstations);
		expect(result).toBeDefined();
		expect(result!.id).toBe("ws-2");
	});
	it("skips occupied workstations", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 110, y: 100, occupied: true },
			{ id: "ws-2", x: 200, y: 100, occupied: false },
		];
		const result = preferredWorkstation(pos, workstations);
		expect(result!.id).toBe("ws-2");
	});
	it("returns null when all occupied", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 110, y: 100, occupied: true },
		];
		const result = preferredWorkstation(pos, workstations);
		expect(result).toBeNull();
	});
	it("returns preferred workstation when available", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 110, y: 100, occupied: false },
			{ id: "ws-preferred", x: 500, y: 500, occupied: false },
		];
		const result = preferredWorkstation(pos, workstations, "ws-preferred");
		expect(result!.id).toBe("ws-preferred");
	});
	it("falls back to nearest when preferred is occupied", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 110, y: 100, occupied: false },
			{ id: "ws-preferred", x: 500, y: 500, occupied: true },
		];
		const result = preferredWorkstation(pos, workstations, "ws-preferred");
		expect(result!.id).toBe("ws-1");
	});
});
