import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import {
	parseFrontmatter,
	insertField,
	replaceField,
	applyFieldRule,
} from "../../../src/domain/devtools/frontmatter-utils.js";

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
});
