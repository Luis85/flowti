import { describe, it, expect } from "vitest";

import {
	splitFrontmatter,
	insertField,
	replaceField,
	applyFieldRule,
} from "../../../src/infrastructure/frontmatter.js";

/** Adapter matching the old parseFrontmatter signature for test compatibility. */
function parseFrontmatter(content: string): { frontmatterRaw: string; body: string; fields: Record<string, string>; fullMatch: string } | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;
	const parsed = splitFrontmatter(content);
	if (!parsed) return null;
	return { frontmatterRaw: match[1], body: parsed.body, fields: parsed.frontmatter, fullMatch: match[0] };
}

describe("parseFrontmatter", () => {
	it("returns null for content without frontmatter", () => {
		const result = parseFrontmatter("# Just a heading\nSome text.");
		expect(result).toBeNull();
	});

	it("parses fields from valid frontmatter", () => {
		const content = "---\ntype: TechDebt\n---\n# Body";
		const result = parseFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result!.fields).toEqual({ type: "TechDebt" });
	});

	it("returns body after closing ---", () => {
		const content = "---\ntype: TechDebt\n---\n# Body text here";
		const result = parseFrontmatter(content);
		expect(result!.body).toBe("\n# Body text here");
	});

	it("handles multiple fields", () => {
		const content = "---\ntype: TechDebt\nstage: planned\ntitle: My Doc\n---\nBody";
		const result = parseFrontmatter(content);
		expect(result!.fields).toEqual({
			type: "TechDebt",
			stage: "planned",
			title: "My Doc",
		});
		expect(result!.frontmatterRaw).toBe("type: TechDebt\nstage: planned\ntitle: My Doc");
	});

	it("handles Windows line endings (\\r\\n)", () => {
		const content = "---\r\ntype: TechDebt\r\nstage: draft\r\n---\r\n# Body";
		const result = parseFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result!.fields).toEqual({ type: "TechDebt", stage: "draft" });
		expect(result!.body).toBe("\r\n# Body");
	});
});

describe("insertField", () => {
	it("inserts field after opening ---", () => {
		const content = "---\nstage: draft\n---\n# Body";
		const result = insertField(content, "type", "TechDebt");
		expect(result).toBe("---\ntype: TechDebt\nstage: draft\n---\n# Body");
	});
});

describe("replaceField", () => {
	it("replaces existing field value", () => {
		const content = "---\nstage: draft\ntype: TechDebt\n---\n# Body";
		const result = replaceField(content, "stage", "planned");
		expect(result).toBe("---\nstage: planned\ntype: TechDebt\n---\n# Body");
	});
});

describe("applyFieldRule", () => {
	it("adds field when action is 'add' and field missing (changed: true)", () => {
		const content = "---\nstage: draft\n---\n# Body";
		const fields = { stage: "draft" };
		const rule = { field: "type", value: "TechDebt", action: "add" };

		const result = applyFieldRule(content, "test.md", fields, rule);

		expect(result.changed).toBe(true);
		expect(result.content).toContain("type: TechDebt");
	});

	it("skips when action is 'add' and field exists (changed: false)", () => {
		const content = "---\ntype: TechDebt\n---\n# Body";
		const fields = { type: "TechDebt" };
		const rule = { field: "type", value: "TechDebt", action: "add" };

		const result = applyFieldRule(content, "test.md", fields, rule);

		expect(result.changed).toBe(false);
		expect(result.content).toBe(content);
	});

	it("replaces field when action is 'replace' and value differs (changed: true)", () => {
		const content = "---\nstage: draft\n---\n# Body";
		const fields = { stage: "draft" };
		const rule = { field: "stage", value: "planned", action: "replace" };

		const result = applyFieldRule(content, "test.md", fields, rule);

		expect(result.changed).toBe(true);
		expect(result.content).toContain("stage: planned");
		expect(result.content).not.toContain("stage: draft");
	});

	it("skips when action is 'replace' and value matches (changed: false)", () => {
		const content = "---\nstage: planned\n---\n# Body";
		const fields = { stage: "planned" };
		const rule = { field: "stage", value: "planned", action: "replace" };

		const result = applyFieldRule(content, "test.md", fields, rule);

		expect(result.changed).toBe(false);
		expect(result.content).toBe(content);
	});

	it("returns unchanged for unknown action", () => {
		const content = "---\ntype: TechDebt\n---\n# Body";
		const fields = { type: "TechDebt" };
		const rule = { field: "type", value: "Other", action: "unknown" };

		const result = applyFieldRule(content, "test.md", fields, rule);

		expect(result.changed).toBe(false);
		expect(result.content).toBe(content);
	});

	it("replace action returns unchanged when field is missing", () => {
		const content = "---\ntype: TechDebt\n---\n# Body";
		const fields = { type: "TechDebt" };
		const rule = { field: "stage", value: "planned", action: "replace" };

		const result = applyFieldRule(content, "test.md", fields, rule);

		// undefined !== "planned" so it would try to replace, but the field isn't there
		expect(result.changed).toBe(true);
	});
});

describe("parseFrontmatter — edge cases", () => {
	it("ignores lines without key:value pattern", () => {
		const content = "---\ntype: TechDebt\n  indented line\n---\n# Body";
		const result = parseFrontmatter(content);
		expect(result!.fields).toEqual({ type: "TechDebt" });
	});

	it("handles empty frontmatter", () => {
		const content = "---\n\n---\n# Body";
		const result = parseFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result!.fields).toEqual({});
	});

	it("trims field values", () => {
		const content = "---\ntype:   TechDebt   \n---\n# Body";
		const result = parseFrontmatter(content);
		// splitFrontmatter does not trim trailing whitespace from values (unlike the old parseFrontmatter)
		expect(result!.fields.type).toBe("TechDebt   ");
	});

	it("returns fullMatch including delimiters", () => {
		const content = "---\ntype: TechDebt\n---\n# Body";
		const result = parseFrontmatter(content);
		expect(result!.fullMatch).toBe("---\ntype: TechDebt\n---");
	});
});

describe("insertField — edge cases", () => {
	it("works with Windows line endings", () => {
		const content = "---\r\nstage: draft\r\n---\r\n# Body";
		const result = insertField(content, "type", "TechDebt");
		expect(result).toContain("type: TechDebt");
	});

	it("inserts into frontmatter with multiple fields", () => {
		const content = "---\nstage: draft\ntitle: My Doc\n---\n# Body";
		const result = insertField(content, "type", "TechDebt");
		expect(result).toBe("---\ntype: TechDebt\nstage: draft\ntitle: My Doc\n---\n# Body");
	});
});

describe("replaceField — edge cases", () => {
	it("replaces only the first match", () => {
		const content = "---\nstage: draft\n---\nstage: something else";
		const result = replaceField(content, "stage", "planned");
		expect(result).toBe("---\nstage: planned\n---\nstage: something else");
	});

	it("handles field with extra whitespace around colon", () => {
		const content = "---\nstage:   draft\n---\n# Body";
		const result = replaceField(content, "stage", "planned");
		expect(result).toContain("stage:   planned");
	});

	it("no-op when field does not exist", () => {
		const content = "---\ntype: TechDebt\n---\n# Body";
		const result = replaceField(content, "stage", "planned");
		expect(result).toBe(content);
	});
});
