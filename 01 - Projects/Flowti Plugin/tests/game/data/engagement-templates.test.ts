import { describe, it, expect } from "vitest";
import {
	TIER1_TEMPLATES,
	TIER2_TEMPLATES,
	TIER3_TEMPLATES,
	interpolateTemplate,
} from "../../../src/game/data/engagement-templates.js";

describe("TIER1_TEMPLATES", () => {
	it("is a non-empty array", () => {
		expect(TIER1_TEMPLATES.length).toBeGreaterThan(0);
	});

	it("every entry has a non-empty text string", () => {
		for (const t of TIER1_TEMPLATES) {
			expect(typeof t.text).toBe("string");
			expect(t.text.length).toBeGreaterThan(0);
		}
	});

	it("contains at least one template with a {variable}", () => {
		const hasVar = TIER1_TEMPLATES.some(t => /\{\w+\}/.test(t.text));
		expect(hasVar).toBe(true);
	});
});

describe("TIER2_TEMPLATES", () => {
	it("is a non-empty array", () => {
		expect(TIER2_TEMPLATES.length).toBeGreaterThan(0);
	});

	it("every entry has a non-empty text string", () => {
		for (const t of TIER2_TEMPLATES) {
			expect(typeof t.text).toBe("string");
			expect(t.text.length).toBeGreaterThan(0);
		}
	});

	it("contains at least one template with a {variable}", () => {
		const hasVar = TIER2_TEMPLATES.some(t => /\{\w+\}/.test(t.text));
		expect(hasVar).toBe(true);
	});
});

describe("TIER3_TEMPLATES", () => {
	it("is a non-empty array", () => {
		expect(TIER3_TEMPLATES.length).toBeGreaterThan(0);
	});

	it("every entry has a non-empty text string", () => {
		for (const t of TIER3_TEMPLATES) {
			expect(typeof t.text).toBe("string");
			expect(t.text.length).toBeGreaterThan(0);
		}
	});

	it("contains at least one template with a {variable}", () => {
		const hasVar = TIER3_TEMPLATES.some(t => /\{\w+\}/.test(t.text));
		expect(hasVar).toBe(true);
	});
});

describe("interpolateTemplate()", () => {
	it("replaces a known variable", () => {
		const result = interpolateTemplate("Working on {task} now.", { task: "linting" });
		expect(result).toBe("Working on linting now.");
	});

	it("replaces multiple occurrences of the same variable", () => {
		const result = interpolateTemplate("{task} then {task} again.", { task: "build" });
		expect(result).toBe("build then build again.");
	});

	it("replaces multiple distinct variables", () => {
		const result = interpolateTemplate(
			"Feeling {mood_adj} about {domain}.",
			{ mood_adj: "optimistic", domain: "engineering" },
		);
		expect(result).toBe("Feeling optimistic about engineering.");
	});

	it("leaves unknown {variables} unchanged", () => {
		const result = interpolateTemplate("Hello {unknown} world.", { task: "build" });
		expect(result).toBe("Hello {unknown} world.");
	});

	it("handles empty vars object — leaves all placeholders unchanged", () => {
		const result = interpolateTemplate("The {task} is {domain}.", {});
		expect(result).toBe("The {task} is {domain}.");
	});

	it("returns a string with no placeholders unchanged if no vars match", () => {
		const result = interpolateTemplate("No variables here.", { task: "build" });
		expect(result).toBe("No variables here.");
	});

	it("handles empty template string", () => {
		const result = interpolateTemplate("", { task: "build" });
		expect(result).toBe("");
	});

	it("works with a real TIER1 template", () => {
		const template = TIER1_TEMPLATES[0];
		const result = interpolateTemplate(template.text, { task: "refactoring", domain: "engineering" });
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("works with a real TIER3 template", () => {
		const template = TIER3_TEMPLATES[0];
		const result = interpolateTemplate(template.text, { domain: "quality", task: "test run" });
		expect(typeof result).toBe("string");
	});
});
