import { describe, it, expect } from "vitest";
import { selectPetVoice } from "../../../../src/game/systems/talk/pet-voice-selector.js";

describe("selectPetVoice", () => {
	it("returns instinct when hungry", () => {
		// Run 100 times — should never return eloquent when hungry
		const voices = new Set<string>();
		for (let i = 0; i < 100; i++) {
			voices.add(selectPetVoice({ hunger: 20, thirst: 70, state: "idle" }));
		}
		expect(voices).not.toContain("eloquent");
	});

	it("returns only instinct when sleeping", () => {
		const voices = new Set<string>();
		for (let i = 0; i < 100; i++) {
			voices.add(selectPetVoice({ hunger: 70, thirst: 70, state: "sleeping" }));
		}
		expect(voices.size).toBe(1);
		expect(voices).toContain("instinct");
	});

	it("favors eloquent when nearby agent has low morale", () => {
		let eloquentCount = 0;
		for (let i = 0; i < 1000; i++) {
			if (selectPetVoice({ hunger: 70, thirst: 70, nearbyAgentMorale: 20, state: "idle" }) === "eloquent") {
				eloquentCount++;
			}
		}
		// Should be roughly 70% — check it's at least 50% (generous tolerance for randomness)
		expect(eloquentCount).toBeGreaterThan(500);
	});

	it("returns all three voices in default state", () => {
		const voices = new Set<string>();
		for (let i = 0; i < 300; i++) {
			voices.add(selectPetVoice({ hunger: 70, thirst: 70, state: "idle" }));
		}
		expect(voices.size).toBe(3);
	});

	it("returns instinct or gremlin when thirsty", () => {
		const voices = new Set<string>();
		for (let i = 0; i < 100; i++) {
			voices.add(selectPetVoice({ hunger: 70, thirst: 20, state: "idle" }));
		}
		expect(voices).not.toContain("eloquent");
	});

	it("favors gremlin when idle with high energy", () => {
		let gremlinCount = 0;
		for (let i = 0; i < 1000; i++) {
			if (selectPetVoice({ hunger: 70, thirst: 70, state: "idle", energy: 90 }) === "gremlin") {
				gremlinCount++;
			}
		}
		// Should be roughly 60% — check it's at least 40%
		expect(gremlinCount).toBeGreaterThan(400);
	});
});
