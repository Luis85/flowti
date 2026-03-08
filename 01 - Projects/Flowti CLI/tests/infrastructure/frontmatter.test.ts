import { describe, it, expect } from "vitest";
import { parseScalar, parseFrontmatterContent } from "../../src/infrastructure/frontmatter.js";

describe("parseScalar", () => {
	it("parses booleans", () => {
		expect(parseScalar("true")).toBe(true);
		expect(parseScalar("false")).toBe(false);
	});

	it("parses integers", () => {
		expect(parseScalar("42")).toBe(42);
		expect(parseScalar("-7")).toBe(-7);
	});

	it("parses floats", () => {
		expect(parseScalar("3.14")).toBe(3.14);
		expect(parseScalar("-0.5")).toBe(-0.5);
	});

	it("strips surrounding quotes from strings", () => {
		expect(parseScalar('"hello"')).toBe("hello");
		expect(parseScalar("'world'")).toBe("world");
	});

	it("returns plain string when no special type", () => {
		expect(parseScalar("some text")).toBe("some text");
	});
});

describe("parseFrontmatterContent", () => {
	it("returns null when no frontmatter", () => {
		expect(parseFrontmatterContent("# Just a heading\nBody text")).toBeNull();
	});

	it("parses simple key-value pairs", () => {
		const md = `---\ntitle: Hello\ncount: 5\n---\n\n# Body`;
		const result = parseFrontmatterContent(md);
		expect(result).toEqual({ title: "Hello", count: 5 });
	});

	it("parses typed scalars", () => {
		const md = `---\nenabled: true\ndisabled: false\nversion: 1.5\ncount: 10\n---`;
		const result = parseFrontmatterContent(md);
		expect(result).toEqual({ enabled: true, disabled: false, version: 1.5, count: 10 });
	});

	it("parses arrays", () => {
		const md = `---\ntags:\n  - alpha\n  - beta\n---`;
		const result = parseFrontmatterContent(md);
		expect(result).toEqual({ tags: ["alpha", "beta"] });
	});

	it("parses empty arrays", () => {
		const md = `---\nitems: []\n---`;
		const result = parseFrontmatterContent(md);
		expect(result).toEqual({ items: [] });
	});

	it("handles Windows line endings", () => {
		const md = "---\r\nkey: value\r\n---\r\n\r\nBody";
		const result = parseFrontmatterContent(md);
		expect(result).toEqual({ key: "value" });
	});

	it("strips quotes from values", () => {
		const md = `---\ndate: "2026-01-01"\n---`;
		const result = parseFrontmatterContent(md);
		expect(result).toEqual({ date: "2026-01-01" });
	});
});
