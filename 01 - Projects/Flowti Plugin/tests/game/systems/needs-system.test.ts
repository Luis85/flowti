import { describe, it, expect } from "vitest";
import { NeedsSystem } from "../../../src/game/systems/needs-system.js";

describe("NeedsSystem", () => {
	describe("register", () => {
		it("initializes agent with default needs", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			const needs = sys.getNeeds("Atlas");
			expect(needs.energy).toBe(80);
			expect(needs.social).toBe(60);
			expect(needs.focus).toBe(70);
			expect(needs.morale).toBe(75);
		});
	});

	describe("attribute modifiers", () => {
		it("high CON slows energy decay during work", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const modded = new NeedsSystem();
			modded.register("Tank", { con: 20 });

			const getState = () => "working";
			const getNearby = () => [] as string[];
			base.update(10_000, getState, getNearby);
			modded.update(10_000, getState, getNearby);

			expect(modded.getNeeds("Tank").energy).toBeGreaterThan(base.getNeeds("Base").energy);
		});

		it("high CHA increases social decay rate", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const social = new NeedsSystem();
			social.register("Charmer", { cha: 20 });

			const getState = () => "idle";
			const getNearby = () => [] as string[];
			base.update(10_000, getState, getNearby);
			social.update(10_000, getState, getNearby);

			expect(social.getNeeds("Charmer").social).toBeLessThan(base.getNeeds("Base").social);
		});

		it("high INT slows focus decay during work", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const smart = new NeedsSystem();
			smart.register("Brain", { int: 20 });

			const getState = () => "working";
			const getNearby = () => [] as string[];
			base.update(10_000, getState, getNearby);
			smart.update(10_000, getState, getNearby);

			expect(smart.getNeeds("Brain").focus).toBeGreaterThan(base.getNeeds("Base").focus);
		});

		it("high WIS slows morale decay", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const wise = new NeedsSystem();
			wise.register("Sage", { wis: 20 });

			const getState = () => "idle";
			const getNearby = () => [] as string[];
			base.update(10_000, getState, getNearby);
			wise.update(10_000, getState, getNearby);

			expect(wise.getNeeds("Sage").morale).toBeGreaterThanOrEqual(base.getNeeds("Base").morale);
		});
	});

	describe("behavior thresholds", () => {
		it("returns force-break when energy < 30", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: -60 });
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "force-break" });
		});

		it("returns seek-agent when social < 25", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { social: -40 });
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "seek-agent" });
		});

		it("returns seek-quiet when focus < 20", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { focus: -55 });
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "seek-quiet" });
		});

		it("returns demoralized when morale < 10", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { morale: -70 });
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "demoralized" });
		});

		it("returns empty array when all needs healthy", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			expect(sys.checkThresholds("Atlas")).toEqual([]);
		});
	});

	describe("mood derivation", () => {
		it("returns tired when energy low", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: -60 });
			expect(sys.getMood("Atlas")).toBe("tired");
		});

		it("returns excited when morale high", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { morale: 10 });
			expect(sys.getMood("Atlas")).toBe("excited");
		});

		it("returns neutral for unknown agent", () => {
			const sys = new NeedsSystem();
			expect(sys.getMood("nobody")).toBe("neutral");
		});
	});

	describe("applyEffect", () => {
		it("clamps values to 0-100", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: 200 });
			expect(sys.getNeeds("Atlas").energy).toBe(100);
			sys.applyEffect("Atlas", { energy: -300 });
			expect(sys.getNeeds("Atlas").energy).toBe(0);
		});
	});

	describe("update", () => {
		it("restores energy during on-break", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: -40 });
			sys.update(5000, () => "on-break", () => []);
			expect(sys.getNeeds("Atlas").energy).toBeGreaterThan(40);
		});

		it("applies social bonus for nearby agents", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			const before = sys.getNeeds("Atlas").social;
			sys.update(5000, () => "idle", () => ["Rex", "Sage"]);
			expect(sys.getNeeds("Atlas").social).toBeGreaterThan(before);
		});
	});
});
