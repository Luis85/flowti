import { describe, it, expect } from "vitest";
import {
	BlackboardManager,
	createDefaultBlackboard,
	type SyncableActor,
} from "../../../src/game/systems/blackboard.js";

describe("createDefaultBlackboard", () => {
	it("returns blackboard with correct defaults", () => {
		const bb = createDefaultBlackboard();
		expect(bb.intent).toBe("idle");
		expect(bb.movementCommand).toBe("none");
		expect(bb.movementTarget).toBeNull();
		expect(bb.arrived).toBe(false);
		expect(bb.isMoving).toBe(false);
		expect(bb.position).toEqual({ x: 0, y: 0 });
		expect(bb.nearbyAgents).toEqual([]);
		expect(bb.nearbyEntities).toEqual([]);
		expect(bb.currentRoom).toBe("");
		expect(bb.nearestFoodStation).toBeNull();
		expect(bb.nearestDrinkStation).toBeNull();
		expect(bb.nearestRestStation).toBeNull();
		expect(bb.nearestWorkstation).toBeNull();
		expect(bb.wanderHint).toBeNull();
		expect(bb.cascadeHint).toBeNull();
		expect(bb.cascadeTarget).toBeNull();
		expect(bb.roomAvoidance).toBeNull();
		expect(bb.breakThresholdBias).toBe(0);
		expect(bb.speechRequest).toBeNull();
		expect(bb.intentDetail).toBe("");
	});

	it("returns independent instances", () => {
		const a = createDefaultBlackboard();
		const b = createDefaultBlackboard();
		a.intent = "working";
		expect(b.intent).toBe("idle");
	});
});

describe("BlackboardManager", () => {
	describe("register / get", () => {
		it("registers an agent and returns its blackboard", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			const bb = mgr.get("Alice");
			expect(bb).toBeDefined();
			expect(bb.intent).toBe("idle");
		});

		it("returns same blackboard on repeated get", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			expect(mgr.get("Alice")).toBe(mgr.get("Alice"));
		});

		it("register is idempotent — does not overwrite", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			mgr.get("Alice").intent = "working";
			mgr.register("Alice");
			expect(mgr.get("Alice").intent).toBe("working");
		});

		it("throws on get for unregistered agent", () => {
			const mgr = new BlackboardManager();
			expect(() => mgr.get("nobody")).toThrow(/No blackboard/);
		});
	});

	describe("unregister", () => {
		it("removes an agent", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			mgr.unregister("Alice");
			expect(() => mgr.get("Alice")).toThrow();
		});

		it("does nothing for unknown agent", () => {
			const mgr = new BlackboardManager();
			expect(() => mgr.unregister("nobody")).not.toThrow();
		});
	});

	describe("has", () => {
		it("returns true for registered agent", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			expect(mgr.has("Alice")).toBe(true);
		});

		it("returns false for unknown agent", () => {
			const mgr = new BlackboardManager();
			expect(mgr.has("Bob")).toBe(false);
		});
	});

	describe("getAll / size", () => {
		it("returns all registered blackboards", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			mgr.register("Bob");
			expect(mgr.getAll().size).toBe(2);
			expect(mgr.size).toBe(2);
		});

		it("returns empty map when none registered", () => {
			const mgr = new BlackboardManager();
			expect(mgr.getAll().size).toBe(0);
		});
	});

	describe("push", () => {
		it("syncs movement command to actor component", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			const bb = mgr.get("Alice");
			bb.movementCommand = "walk-to";
			bb.movementTarget = { x: 100, y: 200 };

			const mc = { command: "none" as const, target: null, arrived: false };
			const actor: SyncableActor = { pos: { x: 0, y: 0 }, movementComponent: mc };
			mgr.push(() => actor);

			expect(mc.command).toBe("walk-to");
			expect(mc.target).toEqual({ x: 100, y: 200 });
		});

		it("syncs intent to actor component", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			const bb = mgr.get("Alice");
			bb.intent = "seeking";
			bb.intentDetail = "seek-food";

			const ic = { intent: "idle", detail: "" };
			const actor: SyncableActor = { pos: { x: 0, y: 0 }, intentComponent: ic };
			mgr.push(() => actor);

			expect(ic.intent).toBe("seeking");
			expect(ic.detail).toBe("seek-food");
		});

		it("skips agents with no actor on scene", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			mgr.get("Alice").movementCommand = "walk-to";
			// getActor returns undefined — no crash
			expect(() => mgr.push(() => undefined)).not.toThrow();
		});
	});

	describe("pull", () => {
		it("syncs position from actor", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");

			const actor: SyncableActor = { pos: { x: 50, y: 75 } };
			mgr.pull(() => actor);

			expect(mgr.get("Alice").position).toEqual({ x: 50, y: 75 });
		});

		it("syncs arrived and isMoving from movement component", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");

			const mc = { command: "walk-to" as const, target: { x: 100, y: 100 }, arrived: true };
			const actor: SyncableActor = { pos: { x: 100, y: 100 }, movementComponent: mc };
			mgr.pull(() => actor);

			const bb = mgr.get("Alice");
			expect(bb.arrived).toBe(true);
			expect(bb.isMoving).toBe(true); // command is "walk-to", not "none"
		});

		it("isMoving is false when command is none", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");

			const mc = { command: "none" as const, target: null, arrived: false };
			const actor: SyncableActor = { pos: { x: 0, y: 0 }, movementComponent: mc };
			mgr.pull(() => actor);

			expect(mgr.get("Alice").isMoving).toBe(false);
		});

		it("skips agents with no actor on scene", () => {
			const mgr = new BlackboardManager();
			mgr.register("Alice");
			expect(() => mgr.pull(() => undefined)).not.toThrow();
		});
	});
});
