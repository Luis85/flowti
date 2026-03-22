import { describe, it, expect } from "vitest";
import {
	FragmentComposer,
	type FragmentPool,
} from "../../../../src/game/systems/talk/fragment-composer.js";

const OPENERS: FragmentPool = {
	id: "test-openers",
	slot: "opener",
	filters: {},
	fragments: ["Hmm,", "So,", "Well,"],
};

const CORES: FragmentPool = {
	id: "test-cores",
	slot: "core",
	filters: {},
	fragments: ["this is interesting", "that looks wrong", "I have thoughts"],
};

const CLOSERS: FragmentPool = {
	id: "test-closers",
	slot: "closer",
	filters: {},
	fragments: ["...probably", "...I think", "...maybe"],
};

const QUALIFIERS: FragmentPool = {
	id: "test-qualifiers",
	slot: "qualifier",
	filters: {},
	fragments: ["...but what do I know", "...in theory"],
};

const INTERJECTIONS: FragmentPool = {
	id: "test-interjections",
	slot: "interjection",
	filters: {},
	fragments: ["Wait—", "Oh—", "Huh."],
};

describe("FragmentComposer", () => {
	it("constructs with pools", () => {
		const composer = new FragmentComposer([OPENERS, CORES, CLOSERS, QUALIFIERS, INTERJECTIONS]);
		expect(composer).toBeDefined();
	});

	it("compose returns a non-empty string", () => {
		const composer = new FragmentComposer([OPENERS, CORES, CLOSERS, QUALIFIERS, INTERJECTIONS]);
		const result = composer.compose({});
		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");
	});

	it("compose with mood filter selects from matching pools", () => {
		const moodPool: FragmentPool = {
			id: "excited-openers",
			slot: "opener",
			filters: { mood: ["excited"] },
			fragments: ["YES!", "Oh wow!"],
		};
		const composer = new FragmentComposer([moodPool, CORES]);
		const result = composer.compose({ mood: "excited" });
		expect(result).toBeTruthy();
	});

	it("compose with domain filter selects from matching pools", () => {
		const domainPool: FragmentPool = {
			id: "eng-cores",
			slot: "core",
			filters: { domain: ["engineering"] },
			fragments: ["the build is broken"],
		};
		const composer = new FragmentComposer([OPENERS, domainPool]);
		const result = composer.compose({ domain: "engineering" });
		expect(result).toContain("the build is broken");
	});

	it("avoids recently used phrases", () => {
		const tinyPool: FragmentPool = {
			id: "tiny-cores",
			slot: "core",
			filters: {},
			fragments: ["only option"],
		};
		const composer = new FragmentComposer([tinyPool]);
		const result1 = composer.compose({}, ["only option"]);
		// With only one option and it's avoided, falls back to it anyway
		expect(result1).toBe("only option");
	});
});
