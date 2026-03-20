import { describe, it, expect } from "vitest";
import { QuirkSystem } from "../../../src/game/systems/quirk-system.js";

describe("QuirkSystem", () => {
	it("assigns quirks on register for new agent", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", { dex: 15, int: 14 }, "engineering", []);
		const quirks = sys.getQuirks("Atlas");
		expect(quirks.length).toBeGreaterThanOrEqual(2);
		expect(quirks.length).toBeLessThanOrEqual(3);
	});

	it("restores existing quirks instead of re-rolling", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", { dex: 15 }, "engineering", ["pacer", "rubber-ducker"]);
		expect(sys.getQuirks("Atlas")).toEqual(["pacer", "rubber-ducker"]);
	});

	it("computes combined overrides from all quirks", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", {}, "general", ["social-butterfly", "fidgeter"]);
		const overrides = sys.getOverrides("Atlas");
		expect(overrides.socialRadiusMultiplier).toBe(1.5);
		expect(overrides.idleResistanceMultiplier).toBe(0.6);
	});

	it("returns empty overrides for unknown agent", () => {
		const sys = new QuirkSystem();
		const overrides = sys.getOverrides("nobody");
		expect(overrides).toEqual({});
	});

	it("getQuirkPhrases returns phrases for agent's quirks", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", {}, "general", ["coffee-addict"]);
		const phrases = sys.getQuirkPhrases("Atlas");
		expect(phrases.length).toBeGreaterThan(0);
		expect(phrases.some((p) => p.includes("coffee") || p.includes("caffeine") || p.includes("cup"))).toBe(true);
	});

	it("hasQuirk checks specific quirk", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", {}, "general", ["pacer"]);
		expect(sys.hasQuirk("Atlas", "pacer")).toBe(true);
		expect(sys.hasQuirk("Atlas", "hermit")).toBe(false);
	});
});
