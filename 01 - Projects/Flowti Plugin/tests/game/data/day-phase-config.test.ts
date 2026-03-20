import { describe, it, expect } from "vitest";
import { DAY_PHASES, PHASE_MULTIPLIERS, type DayPhase } from "../../../src/game/data/day-phase-config.js";

describe("day-phase-config", () => {
	it("has 7 phases", () => {
		expect(DAY_PHASES).toHaveLength(7);
	});

	it("phase percentages sum to 1.0", () => {
		const total = DAY_PHASES.reduce((sum, p) => sum + p.percent, 0);
		expect(total).toBeCloseTo(1.0, 2);
	});

	it("every phase has need multipliers", () => {
		for (const phase of DAY_PHASES) {
			expect(phase.needMultipliers).toBeDefined();
			expect(phase.needMultipliers.energy).toBeGreaterThan(0);
			expect(phase.needMultipliers.social).toBeGreaterThan(0);
			expect(phase.needMultipliers.focus).toBeGreaterThan(0);
			expect(phase.needMultipliers.morale).toBeGreaterThan(0);
		}
	});

	it("PHASE_MULTIPLIERS returns multipliers for a phase", () => {
		const m = PHASE_MULTIPLIERS("lunch");
		expect(m.energy).toBe(1.5);
		expect(m.social).toBe(2.0);
	});

	it("PHASE_MULTIPLIERS returns 1.0 defaults for unknown phase", () => {
		const m = PHASE_MULTIPLIERS("nonexistent" as DayPhase);
		expect(m.energy).toBe(1.0);
	});
});
