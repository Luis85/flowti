import { describe, it, expect } from "vitest";
import { PET_REACTIVE_PHRASES } from "../../../../src/game/systems/talk/templates/pet-reactive-phrases.js";
import { PET_PHRASE_CHAINS } from "../../../../src/game/systems/talk/templates/pet-phrase-chains.js";

const PET_TRIGGERS = [
	"pet-hungry", "pet-sleepy", "pet-bored", "pet-startled",
	"pet-affectionate", "pet-jealous", "pet-zoomies",
] as const;

describe("pet-reactive-phrases", () => {
	it("every pet trigger has at least 8 phrases", () => {
		for (const trigger of PET_TRIGGERS) {
			expect(PET_REACTIVE_PHRASES[trigger].length, trigger).toBeGreaterThanOrEqual(8);
		}
	});

	it("all phrases have weight > 0", () => {
		for (const trigger of PET_TRIGGERS) {
			for (const t of PET_REACTIVE_PHRASES[trigger]) {
				expect(t.weight).toBeGreaterThan(0);
			}
		}
	});
});

describe("pet-phrase-chains", () => {
	it("has at least 15 chains", () => {
		expect(PET_PHRASE_CHAINS.length).toBeGreaterThanOrEqual(15);
	});

	it("each chain has at least 2 steps", () => {
		for (const chain of PET_PHRASE_CHAINS) {
			expect(chain.steps.length, chain.id).toBeGreaterThanOrEqual(2);
		}
	});
});
