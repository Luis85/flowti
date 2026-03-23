import { describe, it, expect } from "vitest";
import { MovementComponent, IntentComponent } from "../../../src/game/components/agent-components.js";

describe("MovementComponent", () => {
	it("defaults to no movement", () => {
		const c = new MovementComponent();
		expect(c.command).toBe("none");
		expect(c.target).toBeNull();
		expect(c.arrived).toBe(false);
		expect(c.speed).toBe(40);
		expect(c.movementStyle).toBe("brisk");
	});

	it("accepts command and target", () => {
		const c = new MovementComponent();
		c.command = "walk-to";
		c.target = { x: 100, y: 200 };
		expect(c.command).toBe("walk-to");
		expect(c.target).toEqual({ x: 100, y: 200 });
	});
});

describe("IntentComponent", () => {
	it("defaults to idle", () => {
		const c = new IntentComponent();
		expect(c.intent).toBe("idle");
		expect(c.detail).toBe("");
		expect(c.idlePose).toBe("idle");
		expect(c.idlePoseTimer).toBe(0);
	});
});
