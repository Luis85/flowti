import { describe, it, expect, beforeEach } from "vitest";
import { SceneRegistry } from "../../../src/game/systems/scene-registry.js";

describe("SceneRegistry", () => {
	let registry: SceneRegistry;
	beforeEach(() => { registry = new SceneRegistry(); });

	describe("entity tracking", () => {
		it("tracks entity room assignment", () => {
			registry.setEntityRoom("Bob", "office");
			expect(registry.getEntityRoom("Bob")).toBe("office");
		});
		it("returns undefined for unknown entity", () => {
			expect(registry.getEntityRoom("unknown")).toBeUndefined();
		});
		it("lists entities in a room", () => {
			registry.setEntityRoom("Bob", "office");
			registry.setEntityRoom("Alice", "office");
			registry.setEntityRoom("Cat", "hub");
			expect(registry.getEntitiesInRoom("office")).toEqual(["Bob", "Alice"]);
			expect(registry.getEntitiesInRoom("hub")).toEqual(["Cat"]);
			expect(registry.getEntitiesInRoom("village")).toEqual([]);
		});
		it("removes entity", () => {
			registry.setEntityRoom("Bob", "office");
			registry.removeEntity("Bob");
			expect(registry.getEntityRoom("Bob")).toBeUndefined();
			expect(registry.getEntitiesInRoom("office")).toEqual([]);
		});
		it("updates room when entity moves", () => {
			registry.setEntityRoom("Bob", "office");
			registry.setEntityRoom("Bob", "village");
			expect(registry.getEntityRoom("Bob")).toBe("village");
			expect(registry.getEntitiesInRoom("office")).toEqual([]);
			expect(registry.getEntitiesInRoom("village")).toEqual(["Bob"]);
		});
		it("lists all entity IDs", () => {
			registry.setEntityRoom("Bob", "office");
			registry.setEntityRoom("cat-hub", "hub");
			expect(registry.getAllEntityIds().sort()).toEqual(["Bob", "cat-hub"]);
		});
	});

	describe("transit state", () => {
		it("marks entity as in transit", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			expect(registry.isInTransit("Bob")).toBe(true);
		});
		it("returns transit details", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			expect(registry.getTransit("Bob")).toEqual({ target: "village", door: { x: 40, y: 250 } });
		});
		it("clears transit", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			registry.clearTransit("Bob");
			expect(registry.isInTransit("Bob")).toBe(false);
		});
		it("lists all transit IDs", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			registry.setInTransit("Alice", "hub", { x: 750, y: 250 });
			expect(registry.getAllTransitIds().sort()).toEqual(["Alice", "Bob"]);
		});
	});

	describe("object catalog", () => {
		it("registers and finds objects by type", () => {
			registry.registerObject("coffee-machine", "office", "energy", { x: 680, y: 120 });
			expect(registry.findObject("energy")).toEqual({
				id: "coffee-machine", room: "office", type: "energy", position: { x: 680, y: 120 },
			});
		});
		it("returns undefined for unknown type", () => {
			expect(registry.findObject("nonexistent")).toBeUndefined();
		});
		it("finds all objects of a type", () => {
			registry.registerObject("coffee-machine", "office", "energy", { x: 680, y: 120 });
			registry.registerObject("snack-table", "village", "energy", { x: 400, y: 380 });
			expect(registry.findObjectsOfType("energy")).toHaveLength(2);
		});
		it("lists objects in a room", () => {
			registry.registerObject("coffee-machine", "office", "energy", { x: 680, y: 120 });
			registry.registerObject("whiteboard", "office", "focus", { x: 400, y: 60 });
			registry.registerObject("snack-table", "village", "energy", { x: 400, y: 380 });
			expect(registry.getObjectsInRoom("office")).toHaveLength(2);
		});
	});
});
