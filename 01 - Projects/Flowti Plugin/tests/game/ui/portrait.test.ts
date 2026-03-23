// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("lit", () => ({
	html: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock("../../../src/game/sprites/character-pool.js", () => ({
	resolveCharacter: vi.fn((_name: string, _domain: string) => "NinjaBlue"),
}));

vi.mock("../../../src/game/ui/game-ui-constants.js", () => ({
	TRUST_TIER_COLORS: { supervised: "#f59e0b", trusted: "#22c55e", autonomous: "#8b5cf6" },
}));

import { portraitSrc, fallbackInitial, renderPortrait } from "../../../src/game/ui/portrait.js";

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
		expect(fallbackInitial("")).toBe("?");
	});
});

describe("renderPortrait", () => {
	it("returns a TemplateResult with img src pointing to Faceset path", () => {
		const result = renderPortrait("Atlas", "engineering", 48, "trusted") as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		expect(result.strings).toBeDefined();
		const flatTemplate = result.strings.join("");
		expect(flatTemplate).toContain("<img");
		expect(flatTemplate).toContain("<div");
	});

	it("includes the resolved Faceset src in values", () => {
		const result = renderPortrait("Atlas", "engineering", 48) as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		const imgSrc = result.values.find(v => typeof v === "string" && v.includes("Faceset.png"));
		expect(imgSrc).toBeDefined();
	});

	it("includes agent name as alt text", () => {
		const result = renderPortrait("Atlas", "engineering", 48) as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		expect(result.values).toContain("Atlas");
	});

	it("applies trust tier border color", () => {
		const result = renderPortrait("Atlas", "engineering", 48, "trusted") as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		const imgStyle = result.values.find(v => typeof v === "string" && v.includes("#22c55e"));
		expect(imgStyle).toBeDefined();
	});

	it("uses default border color when no trustTier is provided", () => {
		const result = renderPortrait("Atlas", "engineering", 48) as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		const imgStyle = result.values.find(v => typeof v === "string" && v.includes("#6b7280"));
		expect(imgStyle).toBeDefined();
	});

	it("includes fallback initial in values", () => {
		const result = renderPortrait("Atlas", "engineering", 48) as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		expect(result.values).toContain("A");
	});

	it("applies the specified size to styles", () => {
		const result = renderPortrait("Atlas", "engineering", 64) as {
			strings: TemplateStringsArray;
			values: unknown[];
		};
		const style = result.values.find(v => typeof v === "string" && v.includes("width:64px"));
		expect(style).toBeDefined();
	});
});
