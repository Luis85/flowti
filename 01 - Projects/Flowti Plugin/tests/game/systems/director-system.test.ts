import { describe, it, expect } from "vitest";
import { DirectorSystem } from "../../../src/game/systems/director-system.js";

describe("DirectorSystem", () => {
	describe("idle tracking", () => {
		it("increments idle time on update", () => {
			const sys = new DirectorSystem();
			sys.update(5000);
			expect(sys.getPresence().idleMs).toBe(5000);
		});

		it("resets idle on recordInteraction", () => {
			const sys = new DirectorSystem();
			sys.update(5000);
			sys.recordInteraction("click", { x: 100, y: 200 });
			expect(sys.getPresence().idleMs).toBe(0);
		});

		it("resets idle on mouse move", () => {
			const sys = new DirectorSystem();
			sys.update(5000);
			sys.onMouseMove(100, 200);
			expect(sys.getPresence().idleMs).toBe(0);
		});

		it("does not increment when not present", () => {
			const sys = new DirectorSystem();
			sys.setPresent(false);
			sys.update(5000);
			expect(sys.getPresence().idleMs).toBe(0);
		});
	});

	describe("cursor position", () => {
		it("tracks world position from mouse move", () => {
			const sys = new DirectorSystem();
			sys.onMouseMove(150, 250);
			expect(sys.getCursorPosition()).toEqual({ x: 150, y: 250 });
		});

		it("returns null position when mouse has not moved", () => {
			const sys = new DirectorSystem();
			expect(sys.getCursorPosition()).toBeNull();
		});

		it("clears position on mouse leave", () => {
			const sys = new DirectorSystem();
			sys.onMouseMove(100, 200);
			sys.onMouseLeave();
			expect(sys.getCursorPosition()).toBeNull();
		});
	});

	describe("context signals", () => {
		it("returns click signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("click", { x: 100, y: 200 });
			expect(signal.type).toBe("click");
		});

		it("returns message signal with morale boost", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("message", { x: 50, y: 50 });
			expect(signal.type).toBe("message");
			expect(signal.moraleEffect).toBe(2);
		});

		it("returns permission-grant signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("permission-grant");
			expect(signal.moraleEffect).toBe(5);
		});

		it("returns permission-deny signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("permission-deny");
			expect(signal.moraleEffect).toBe(-3);
		});

		it("returns task-praise signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("task-praise");
			expect(signal.moraleEffect).toBe(10);
		});
	});

	describe("proximity", () => {
		it("calculates distance to a point", () => {
			const sys = new DirectorSystem();
			sys.onMouseMove(100, 100);
			expect(sys.distanceTo(100, 200)).toBe(100);
		});

		it("returns Infinity when cursor position unknown", () => {
			const sys = new DirectorSystem();
			expect(sys.distanceTo(100, 100)).toBe(Infinity);
		});
	});
});
