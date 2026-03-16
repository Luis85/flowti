import { describe, it, expect } from "vitest";
import { tokens, utilities } from "../../src/components/tokens";

describe("tokens", () => {
	it("exports a CSSResult with --flowti- custom properties", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-font");
		expect(css).toContain("--flowti-text");
	});

	it("includes spacing tokens", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-space-xs");
		expect(css).toContain("--flowti-space-sm");
		expect(css).toContain("--flowti-space-md");
		expect(css).toContain("--flowti-space-lg");
		expect(css).toContain("--flowti-space-xl");
	});

	it("includes color tokens", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-color-success");
		expect(css).toContain("--flowti-color-warning");
		expect(css).toContain("--flowti-color-error");
		expect(css).toContain("--flowti-color-muted");
		expect(css).toContain("--flowti-color-info");
	});

	it("includes layout tokens", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-radius");
		expect(css).toContain("--flowti-border");
		expect(css).toContain("--flowti-grid-gap");
	});
});

describe("utilities", () => {
	it("includes sr-only class", () => {
		expect(utilities.cssText).toContain(".sr-only");
	});

	it("includes truncate class", () => {
		expect(utilities.cssText).toContain(".truncate");
	});
});
