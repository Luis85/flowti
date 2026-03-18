import { describe, it, expect } from "vitest";
import { validateComponents } from "../../../src/domain/make/markdown-sitemap-import.js";

// ── Fixtures ────────────────────────────────────────────────────────

const ALL_FIELDS = ["name", "category", "description", "props", "slots", "variants", "status"];

const validButton: Record<string, unknown> = {
	name: "Button",
	category: "atoms",
	description: "Primary interactive element",
	status: "ready",
	props: ["variant", "disabled"],
	slots: ["default", "icon"],
	variants: ["primary", "outlined"],
};

const validCard: Record<string, unknown> = {
	name: "Card",
	category: "atoms",
	description: "Content container",
	status: "draft",
	props: ["elevation"],
	slots: ["header", "body"],
	variants: ["flat", "raised"],
};

// ── validateComponents ──────────────────────────────────────────────

describe("validateComponents", () => {
	it("accepts all valid records", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Button.md": validButton,
			"Card.md": validCard,
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(2);
		expect(result.warnings).toHaveLength(0);
		expect(result.valid[0].name).toBe("Button");
		expect(result.valid[1].name).toBe("Card");
	});

	it("skips records missing a required field with warning", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Button.md": validButton,
			"NoName.md": { category: "atoms", description: "Oops", status: "ready", props: [], slots: [], variants: [] },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(1);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].file).toBe("NoName.md");
		expect(result.warnings[0].reason).toContain("name");
	});

	it("skips records with invalid status value", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Bad.md": { ...validButton, status: "archived" },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].reason).toContain("status");
	});

	it("accepts empty arrays for props, slots, variants", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Empty.md": { ...validButton, props: [], slots: [], variants: [] },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(1);
	});

	it("returns empty valid and no warnings for empty input", () => {
		const result = validateComponents({}, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it("validates only the fields in requiredFields", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Minimal.md": { name: "Minimal", category: "atoms" },
		};
		const result = validateComponents(files, ["name", "category"]);
		expect(result.valid).toHaveLength(1);
		expect(result.valid[0].name).toBe("Minimal");
	});

	it("skips records where props is not an array", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Bad.md": { ...validButton, props: "not-an-array" },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings[0].reason).toContain("props");
	});

	it("skips records where name is empty string", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Bad.md": { ...validButton, name: "" },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings[0].reason).toContain("name");
	});
});
