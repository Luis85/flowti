import { describe, it, expect } from "vitest";
import { RUNNING_JOKES } from "../../../../src/game/systems/talk/templates/running-jokes.js";

describe("running-jokes", () => {
	it("has at least 12 jokes", () => {
		expect(RUNNING_JOKES.length).toBeGreaterThanOrEqual(12);
	});

	it("all jokes have unique IDs prefixed with joke:", () => {
		const ids = RUNNING_JOKES.map((j) => j.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^joke:/);
		}
	});

	it("all jokes have at least 2 variants", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.variants.length, joke.id).toBeGreaterThanOrEqual(2);
		}
	});

	it("maxEscalation does not exceed variants length", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.maxEscalation, joke.id).toBeLessThanOrEqual(joke.variants.length);
			expect(joke.maxEscalation, joke.id).toBeGreaterThan(0);
		}
	});

	it("all jokes have at least 1 callback line", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.callbackLines.length, joke.id).toBeGreaterThanOrEqual(1);
		}
	});

	it("all jokes include running-joke tag", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.tags, joke.id).toContain("running-joke");
		}
	});
});
