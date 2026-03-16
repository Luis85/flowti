import { describe, it, expect } from "vitest";
import { randomWanderPoint, nearestUnoccupied, resolveAgentTarget } from "../../src/brain/movement.js";

describe("randomWanderPoint", () => {
	it("returns coordinates within room bounds", () => {
		const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
		const point = randomWanderPoint(bounds, () => 0.5);
		expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
		expect(point.x).toBeLessThanOrEqual(bounds.maxX);
		expect(point.y).toBeGreaterThanOrEqual(bounds.minY);
		expect(point.y).toBeLessThanOrEqual(bounds.maxY);
	});

	it("maps rng=0 to min bounds", () => {
		const bounds = { minX: 10, maxX: 50, minY: 20, maxY: 80 };
		const point = randomWanderPoint(bounds, () => 0);
		expect(point.x).toBe(10);
		expect(point.y).toBe(20);
	});

	it("maps rng=1 to max bounds", () => {
		const bounds = { minX: 10, maxX: 50, minY: 20, maxY: 80 };
		const point = randomWanderPoint(bounds, () => 1);
		expect(point.x).toBe(50);
		expect(point.y).toBe(80);
	});
});

describe("nearestUnoccupied", () => {
	it("picks the closest free workstation", () => {
		const position = { x: 10, y: 10 };
		const workstations = [
			{ id: "ws-0", x: 100, y: 100, occupied: false },
			{ id: "ws-1", x: 15, y: 15, occupied: false },
			{ id: "ws-2", x: 50, y: 50, occupied: true },
		];
		const result = nearestUnoccupied(position, workstations);
		expect(result).toEqual({ x: 15, y: 15 });
	});

	it("returns null when all occupied", () => {
		const position = { x: 10, y: 10 };
		const workstations = [
			{ id: "ws-0", x: 15, y: 15, occupied: true },
			{ id: "ws-1", x: 50, y: 50, occupied: true },
		];
		const result = nearestUnoccupied(position, workstations);
		expect(result).toBeNull();
	});

	it("returns null when workstations array is empty", () => {
		const result = nearestUnoccupied({ x: 0, y: 0 }, []);
		expect(result).toBeNull();
	});
});

describe("resolveAgentTarget", () => {
	it("finds a target from the relationship graph", () => {
		const relationships = [
			{ target: "alice", type: "mentor" },
			{ target: "bob", type: "peer" },
		];
		const agents = new Map<string, { x: number; y: number }>([
			["bob", { x: 30, y: 40 }],
		]);
		const result = resolveAgentTarget(relationships, agents);
		expect(result).toEqual({ x: 30, y: 40, targetId: "bob" });
	});

	it("returns first matching relationship", () => {
		const relationships = [
			{ target: "alice", type: "mentor" },
			{ target: "bob", type: "peer" },
		];
		const agents = new Map<string, { x: number; y: number }>([
			["alice", { x: 10, y: 20 }],
			["bob", { x: 30, y: 40 }],
		]);
		const result = resolveAgentTarget(relationships, agents);
		expect(result).toEqual({ x: 10, y: 20, targetId: "alice" });
	});

	it("returns null when no relationships match known agents", () => {
		const relationships = [
			{ target: "unknown", type: "peer" },
		];
		const agents = new Map<string, { x: number; y: number }>([
			["bob", { x: 30, y: 40 }],
		]);
		const result = resolveAgentTarget(relationships, agents);
		expect(result).toBeNull();
	});

	it("returns null when relationships are empty", () => {
		const agents = new Map<string, { x: number; y: number }>([
			["bob", { x: 30, y: 40 }],
		]);
		const result = resolveAgentTarget([], agents);
		expect(result).toBeNull();
	});
});
