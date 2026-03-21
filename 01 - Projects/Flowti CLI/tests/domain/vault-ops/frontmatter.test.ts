import { describe, expect, it } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../../src/domain/vault-ops/frontmatter.js";

describe("parseFrontmatter", () => {
	it("parses YAML frontmatter and body", () => {
		const content = [
			"---",
			"title: My Note",
			"tags:",
			"  - alpha",
			"  - beta",
			"---",
			"Body text here.",
		].join("\n");

		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			title: "My Note",
			tags: ["alpha", "beta"],
		});
		expect(result.body).toBe("\nBody text here.");
	});

	it("returns empty frontmatter when no delimiters", () => {
		const content = "Just a plain body.";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("Just a plain body.");
	});

	it("returns empty frontmatter when delimiters but no content", () => {
		const content = "---\n---\nBody only.";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("\nBody only.");
	});

	it("handles multiline body after frontmatter", () => {
		const content = [
			"---",
			"key: value",
			"---",
			"Line one.",
			"Line two.",
			"Line three.",
		].join("\n");

		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ key: "value" });
		expect(result.body).toBe("\nLine one.\nLine two.\nLine three.");
	});

	it("handles boolean and numeric values", () => {
		const content = [
			"---",
			"active: true",
			"archived: false",
			"count: 42",
			"ratio: 3.14",
			"empty: null",
			"---",
			"",
		].join("\n");

		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			active: true,
			archived: false,
			count: 42,
			ratio: 3.14,
			empty: null,
		});
	});

	it("handles quoted strings", () => {
		const content = [
			"---",
			'title: "Hello: World"',
			"---",
			"",
		].join("\n");

		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ title: "Hello: World" });
	});

	it("handles empty file", () => {
		const result = parseFrontmatter("");
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("");
	});

	it("preserves leading newline in body", () => {
		const content = "---\ntitle: Test\n---\n\nParagraph after blank line.";
		const result = parseFrontmatter(content);
		expect(result.body).toBe("\n\nParagraph after blank line.");
	});
});

describe("serializeFrontmatter", () => {
	it("serializes frontmatter and body", () => {
		const result = serializeFrontmatter(
			{ title: "My Note", status: "draft" },
			"\nBody text here."
		);
		expect(result).toBe(
			"---\ntitle: My Note\nstatus: draft\n---\nBody text here."
		);
	});

	it("serializes array values", () => {
		const result = serializeFrontmatter(
			{ tags: ["alpha", "beta"] },
			"\nBody."
		);
		expect(result).toBe(
			"---\ntags:\n  - alpha\n  - beta\n---\nBody."
		);
	});

	it("serializes boolean and numeric values", () => {
		const result = serializeFrontmatter(
			{ active: true, count: 42 },
			"\n"
		);
		expect(result).toBe("---\nactive: true\ncount: 42\n---\n");
	});

	it("quotes strings with colons", () => {
		const result = serializeFrontmatter(
			{ title: "Hello: World" },
			"\n"
		);
		expect(result).toBe('---\ntitle: "Hello: World"\n---\n');
	});

	it("returns only body when frontmatter is empty", () => {
		const result = serializeFrontmatter({}, "Just body.");
		expect(result).toBe("Just body.");
	});

	it("handles null and undefined values by omitting them", () => {
		const result = serializeFrontmatter(
			{ title: "Keep", removed: null, gone: undefined, status: "open" },
			"\nBody."
		);
		expect(result).toBe(
			"---\ntitle: Keep\nstatus: open\n---\nBody."
		);
	});

	it("returns only body when all values are null or undefined", () => {
		const result = serializeFrontmatter(
			{ a: null, b: undefined },
			"Body only."
		);
		expect(result).toBe("Body only.");
	});

	it("roundtrips with parseFrontmatter", () => {
		const original = {
			title: "Roundtrip Test",
			active: true,
			count: 7,
			tags: ["x", "y"],
		};
		const body = "\nSome body content.";

		const serialized = serializeFrontmatter(original, body);
		const parsed = parseFrontmatter(serialized);
		const reserialized = serializeFrontmatter(
			parsed.frontmatter as Record<string, unknown>,
			parsed.body
		);

		const reparsed = parseFrontmatter(reserialized);
		expect(reparsed.frontmatter).toEqual(original);
		expect(reparsed.body).toBe(body);
	});
});
