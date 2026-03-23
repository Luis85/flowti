import { describe, it, expect } from "vitest";
import { LocomotionSystem, createLocomotionEntry } from "../../../src/game/systems/locomotion-system.js";

const BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };

describe("LocomotionSystem", () => {
	describe("walk-to", () => {
		it("moves agent toward target", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const entry = createLocomotionEntry({
				command: "walk-to",
				target: { x: 500, y: 300 },
				position: { x: 400, y: 300 },
			});
			sys.updateAgent(entry, 1000);
			expect(entry.position.x).toBeGreaterThan(400);
			expect(entry.arrived).toBe(false);
		});

		it("sets arrived when reaching target", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const entry = createLocomotionEntry({
				command: "walk-to",
				target: { x: 402, y: 300 },
				position: { x: 400, y: 300 },
			});
			sys.updateAgent(entry, 1000);
			expect(entry.arrived).toBe(true);
			expect(entry.command).toBe("none");
			expect(entry.target).toBeNull();
		});

		it("respects movement style speed multiplier", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const slow = createLocomotionEntry({
				command: "walk-to",
				target: { x: 500, y: 300 },
				position: { x: 400, y: 300 },
				movementStyle: "deliberate",
			});
			const fast = createLocomotionEntry({
				command: "walk-to",
				target: { x: 500, y: 300 },
				position: { x: 400, y: 300 },
				movementStyle: "darting",
			});
			sys.updateAgent(slow, 1000);
			sys.updateAgent(fast, 1000);
			expect(fast.position.x).toBeGreaterThan(slow.position.x);
		});

		it("clamps position to bounds", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const entry = createLocomotionEntry({
				command: "walk-to",
				target: { x: 900, y: 300 },
				position: { x: 780, y: 300 },
			});
			sys.updateAgent(entry, 5000);
			expect(entry.position.x).toBeLessThanOrEqual(800 - 16); // SPRITE_MARGIN
		});
	});

	describe("wander", () => {
		it("resolves a target and switches to walk-to", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const entry = createLocomotionEntry({
				command: "wander",
				position: { x: 400, y: 300 },
			});
			sys.updateAgent(entry, 16);
			expect(entry.target).not.toBeNull();
			expect(entry.command).toBe("walk-to");
		});
	});

	describe("none (idle)", () => {
		it("does not move when command is none", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const entry = createLocomotionEntry({ position: { x: 400, y: 300 } });
			sys.updateAgent(entry, 1000);
			expect(entry.position.x).toBe(400);
			expect(entry.position.y).toBe(300);
		});

		it("cycles idle pose over time", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const entry = createLocomotionEntry({
				position: { x: 400, y: 300 },
				idleStyle: "fidgety",
			});
			// Advance well past fidgety threshold (3000-6000ms)
			sys.updateAgent(entry, 10000);
			expect(entry.idlePoseIndex).toBeGreaterThan(0);
		});
	});

	describe("separation", () => {
		it("pushes overlapping idle agents apart", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const a = createLocomotionEntry({ position: { x: 400, y: 300 } });
			const b = createLocomotionEntry({ position: { x: 402, y: 300 } });
			sys.applySeparation([a, b]);
			const dist = Math.abs(a.position.x - b.position.x);
			expect(dist).toBeGreaterThan(2);
		});

		it("does not nudge moving agents", () => {
			const sys = new LocomotionSystem(BOUNDS);
			const moving = createLocomotionEntry({
				command: "walk-to",
				target: { x: 500, y: 300 },
				position: { x: 400, y: 300 },
			});
			const idle = createLocomotionEntry({ position: { x: 402, y: 300 } });
			const origX = moving.position.x;
			sys.applySeparation([moving, idle]);
			expect(moving.position.x).toBe(origX); // moving agent not nudged
		});
	});
});
