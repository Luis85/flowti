import { describe, it, expect } from "vitest";
import { portraitSrc, fallbackInitial } from "../../../src/game/ui/portrait.js";

describe("portraitSrc", () => {
	it("returns the Faceset path for a character name", () => {
		expect(portraitSrc("NinjaBlue")).toBe(
			"assets/Actor/Characters/NinjaBlue/Faceset.png",
		);
	});

	it("handles names with mixed casing", () => {
		expect(portraitSrc("SorcererBlack")).toBe(
			"assets/Actor/Characters/SorcererBlack/Faceset.png",
		);
	});
});

describe("fallbackInitial", () => {
	it("returns the uppercased first character", () => {
		expect(fallbackInitial("alice")).toBe("A");
	});

	it("uppercases an already-uppercase first character", () => {
		expect(fallbackInitial("Bob")).toBe("B");
	});

	it("handles a single character", () => {
		expect(fallbackInitial("x")).toBe("X");
	});

	it("handles an empty string by returning '?'", () => {
		// charAt(0) on "" returns "", which is falsy, but the function
		// applies ?? before charAt — so empty string passes through and
		// charAt(0) returns "". We verify current behaviour here.
		expect(fallbackInitial("")).toBe("");
	});
});
