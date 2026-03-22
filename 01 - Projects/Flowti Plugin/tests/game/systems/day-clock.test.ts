import { describe, it, expect, vi } from "vitest";
import { DayClock } from "../../../src/game/systems/day-clock.js";

describe("DayClock", () => {
	describe("initial state", () => {
		it("starts at morning-arrival phase", () => {
			const clock = new DayClock();
			expect(clock.getPhase()).toBe("morning-arrival");
		});

		it("starts at cycle 0", () => {
			const clock = new DayClock();
			expect(clock.getCycleCount()).toBe(0);
		});
	});

	describe("phase progression", () => {
		it("advances to productive-morning after 8% of cycle", () => {
			const clock = new DayClock(60_000); // 1 min total cycle for fast testing
			clock.update(4_800 + 1); // 8% of 60s = 4.8s
			expect(clock.getPhase()).toBe("productive-morning");
		});

		it("advances through all 7 phases in order", () => {
			const clock = new DayClock(7_000); // 7s total, ~1s per phase conceptually
			const phases: string[] = [clock.getPhase()];
			// Advance in small steps collecting phase changes (69 steps to avoid cycle wrap at 7000ms)
			for (let i = 0; i < 69; i++) {
				clock.update(100);
				const p = clock.getPhase();
				if (p !== phases[phases.length - 1]) phases.push(p);
			}
			expect(phases).toEqual([
				"morning-arrival",
				"productive-morning",
				"lunch",
				"afternoon",
				"afternoon-slump",
				"wind-down",
				"evening-departure",
			]);
		});

		it("increments cycle count after full cycle", () => {
			const clock = new DayClock(1_000); // 1s cycle
			clock.update(1_001);
			expect(clock.getCycleCount()).toBe(1);
			expect(clock.getPhase()).toBe("morning-arrival");
		});
	});

	describe("callbacks", () => {
		it("fires onPhaseChange when phase transitions", () => {
			const cb = vi.fn();
			const clock = new DayClock(10_000);
			clock.onPhaseChange(cb);
			clock.update(801); // past 8% of 10s = 800ms
			expect(cb).toHaveBeenCalledWith("productive-morning");
		});

		it("does not fire callback without phase change", () => {
			const cb = vi.fn();
			const clock = new DayClock(100_000);
			clock.onPhaseChange(cb);
			clock.update(100); // still in morning-arrival
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe("cycleEnd callbacks", () => {
		it("fires onCycleEnd when cycle wraps", () => {
			const cb = vi.fn();
			const clock = new DayClock(1_000);
			clock.onCycleEnd(cb);
			clock.update(1_001);
			expect(cb).toHaveBeenCalledOnce();
		});

		it("does not fire mid-cycle", () => {
			const cb = vi.fn();
			const clock = new DayClock(10_000);
			clock.onCycleEnd(cb);
			clock.update(5_000);
			expect(cb).not.toHaveBeenCalled();
		});

		it("offCycleEnd unsubscribes correctly", () => {
			const cb = vi.fn();
			const clock = new DayClock(1_000);
			clock.onCycleEnd(cb);
			clock.offCycleEnd(cb);
			clock.update(1_001);
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe("getProgress", () => {
		it("returns 0-1 progress within current phase", () => {
			const clock = new DayClock(100_000); // 100s
			clock.update(4_000); // 4s into morning-arrival (8% = 8s)
			expect(clock.getProgress()).toBeCloseTo(0.5, 1);
		});
	});

	describe("getCycleProgress", () => {
		it("returns 0-1 across full cycle", () => {
			const clock = new DayClock(10_000);
			clock.update(5_000);
			expect(clock.getCycleProgress()).toBeCloseTo(0.5, 1);
		});
	});

	describe("getPhaseMultipliers", () => {
		it("returns need multipliers for current phase", () => {
			const clock = new DayClock();
			const m = clock.getPhaseMultipliers();
			expect(m.energy).toBe(1.2); // morning-arrival
			expect(m.social).toBe(1.5);
		});
	});

	describe("getTimeOfDay", () => {
		it("returns morning for early phases", () => {
			const clock = new DayClock();
			expect(clock.getTimeOfDay()).toBe("morning");
		});

		it("returns evening for departure phase", () => {
			const clock = new DayClock(1_000);
			clock.update(930); // into evening-departure (92-100%)
			expect(clock.getTimeOfDay()).toBe("evening");
		});
	});

	describe("persistence", () => {
		it("serialize returns restorable state", () => {
			const clock = new DayClock(10_000);
			clock.update(3_000);
			const state = clock.serialize();
			expect(state.cycleCount).toBe(0);
			expect(state.elapsedMs).toBeCloseTo(3_000, -1);
		});

		it("restore resumes from saved state", () => {
			const clock = new DayClock(10_000);
			clock.restore({ cycleCount: 5, elapsedMs: 5_000, lastUpdated: Date.now() });
			expect(clock.getCycleCount()).toBe(5);
			expect(clock.getCycleProgress()).toBeCloseTo(0.5, 1);
		});

		it("restore with elapsed > cycle duration starts fresh cycle", () => {
			const clock = new DayClock(10_000);
			clock.restore({ cycleCount: 3, elapsedMs: 0, lastUpdated: Date.now() - 15_000 });
			// elapsed since save > 10s cycle → fresh cycle
			expect(clock.getCycleCount()).toBe(4);
			expect(clock.getPhase()).toBe("morning-arrival");
		});
	});
});
