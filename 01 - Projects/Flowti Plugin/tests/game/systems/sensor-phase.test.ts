import { describe, it, expect, vi } from "vitest";
import { tickSensors, type SensorDeps } from "../../../src/game/systems/sensor-phase.js";
import { BlackboardManager } from "../../../src/game/systems/blackboard.js";

function makeDeps(overrides: Partial<SensorDeps> = {}): SensorDeps {
	return {
		getAgentNames: vi.fn(() => ["Alice"]),
		getNeeds: vi.fn(() => ({ energy: 80, social: 60, focus: 70, morale: 75, hunger: 50, thirst: 40 })),
		getRoom: vi.fn(() => "office"),
		getNearbyAgents: vi.fn(() => ["Bob"]),
		getNearbyEntities: vi.fn(() => ["desk-01"]),
		getNearestStation: vi.fn(() => ({ x: 200, y: 300 })),
		getWanderHint: vi.fn(() => null),
		getCascadeHint: vi.fn(() => null),
		getRoomAvoidance: vi.fn(() => null),
		getBreakThresholdBias: vi.fn(() => 0),
		getNearestWorkstation: vi.fn(() => ({ x: 350, y: 250 })),
		...overrides,
	};
}

describe("tickSensors", () => {
	it("writes needs snapshot to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		const deps = makeDeps();
		tickSensors(mgr, deps);
		const bb = mgr.get("Alice");
		expect(bb.needs.energy).toBe(80);
		expect(bb.needs.hunger).toBe(50);
		expect(bb.needs.thirst).toBe(40);
	});

	it("writes nearby agents to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps());
		expect(mgr.get("Alice").nearbyAgents).toEqual(["Bob"]);
	});

	it("writes nearby entities to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps());
		expect(mgr.get("Alice").nearbyEntities).toEqual(["desk-01"]);
	});

	it("writes current room to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps());
		expect(mgr.get("Alice").currentRoom).toBe("office");
	});

	it("writes station positions to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps());
		const bb = mgr.get("Alice");
		expect(bb.nearestFoodStation).toEqual({ x: 200, y: 300 });
		expect(bb.nearestDrinkStation).toEqual({ x: 200, y: 300 });
		expect(bb.nearestRestStation).toEqual({ x: 200, y: 300 });
	});

	it("writes null station when none available", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps({ getNearestStation: vi.fn(() => null) }));
		expect(mgr.get("Alice").nearestFoodStation).toBeNull();
	});

	it("writes echo wander hint to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps({ getWanderHint: vi.fn(() => ({ x: 300, y: 400 })) }));
		expect(mgr.get("Alice").wanderHint).toEqual({ x: 300, y: 400 });
	});

	it("writes cascade hint to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps({
			getCascadeHint: vi.fn(() => ({ hint: "seek-proximity", target: { x: 100, y: 100 } })),
		}));
		const bb = mgr.get("Alice");
		expect(bb.cascadeHint).toBe("seek-proximity");
		expect(bb.cascadeTarget).toEqual({ x: 100, y: 100 });
	});

	it("clears cascade hint when none pending", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		mgr.get("Alice").cascadeHint = "force-break"; // set from previous frame
		tickSensors(mgr, makeDeps());
		expect(mgr.get("Alice").cascadeHint).toBeNull();
	});

	it("writes room avoidance to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps({ getRoomAvoidance: vi.fn(() => "station") }));
		expect(mgr.get("Alice").roomAvoidance).toBe("station");
	});

	it("writes break threshold bias to blackboard", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		tickSensors(mgr, makeDeps({ getBreakThresholdBias: vi.fn(() => -5) }));
		expect(mgr.get("Alice").breakThresholdBias).toBe(-5);
	});

	it("skips agents not registered in blackboard manager", () => {
		const mgr = new BlackboardManager();
		// Alice is in deps.getAgentNames but NOT registered in blackboards
		const deps = makeDeps();
		expect(() => tickSensors(mgr, deps)).not.toThrow();
	});

	it("handles multiple agents", () => {
		const mgr = new BlackboardManager();
		mgr.register("Alice");
		mgr.register("Bob");
		const deps = makeDeps({ getAgentNames: vi.fn(() => ["Alice", "Bob"]) });
		tickSensors(mgr, deps);
		expect(mgr.get("Alice").needs.energy).toBe(80);
		expect(mgr.get("Bob").needs.energy).toBe(80);
	});
});
