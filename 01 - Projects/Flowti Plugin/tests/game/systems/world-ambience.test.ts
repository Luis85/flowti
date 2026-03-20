import { describe, it, expect } from "vitest";
import { WorldAmbience } from "../../../src/game/systems/world-ambience.js";
import type { DayPhase } from "../../../src/game/data/day-phase-config.js";

describe("WorldAmbience", () => {
	describe("lighting", () => {
		it("returns warm tint for morning-arrival", () => {
			const amb = new WorldAmbience();
			const light = amb.getLighting("morning-arrival");
			expect(light.r).toBeGreaterThan(200);
			expect(light.opacity).toBeGreaterThan(0);
		});

		it("returns no tint for productive-morning", () => {
			const amb = new WorldAmbience();
			const light = amb.getLighting("productive-morning");
			expect(light.opacity).toBe(0);
		});

		it("returns cool tint for evening-departure", () => {
			const amb = new WorldAmbience();
			const light = amb.getLighting("evening-departure");
			expect(light.b).toBeGreaterThan(light.r);
			expect(light.opacity).toBeGreaterThan(0.1);
		});
	});

	describe("weather", () => {
		it("starts with clear weather", () => {
			const amb = new WorldAmbience();
			expect(amb.getWeather()).toBe("clear");
		});

		it("cycles weather after configured number of day cycles", () => {
			const amb = new WorldAmbience(2); // change every 2 cycles
			amb.onCycleComplete();
			expect(amb.getWeather()).toBe("clear"); // 1 cycle, no change yet
			amb.onCycleComplete();
			// After 2 cycles, weather should change
			expect(amb.getWeather()).not.toBe("clear");
		});
	});

	describe("persistence", () => {
		it("serialize and restore preserve weather state", () => {
			const amb = new WorldAmbience(1);
			amb.onCycleComplete(); // triggers change
			const weather = amb.getWeather();
			const state = amb.serialize();
			const amb2 = new WorldAmbience(1);
			amb2.restore(state);
			expect(amb2.getWeather()).toBe(weather);
		});
	});
});
