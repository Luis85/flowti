import { describe, it, expect } from "vitest";
import { parseScalar, parseFrontmatterContent, parseFrontmatterStrings, splitFrontmatter, joinFrontmatter } from "../../src/infrastructure/frontmatter.js";

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

// ── parseFrontmatterStrings ─────────────────────────────────────────

describe("parseFrontmatterStrings", () => {
	it("returns empty object when no frontmatter", () => {
		expect(parseFrontmatterStrings("# Heading\nBody")).toEqual({});
	});

	it("parses key-value pairs as strings", () => {
		const md = "---\nname: Hello\ncount: 5\nenabled: true\n---\nBody";
		expect(parseFrontmatterStrings(md)).toEqual({ name: "Hello", count: "5", enabled: "true" });
	});

	it("strips quotes from values", () => {
		const md = '---\nname: "hello"\nother: \'world\'\n---';
		expect(parseFrontmatterStrings(md)).toEqual({ name: "hello", other: "world" });
	});

	it("handles Windows line endings", () => {
		const md = "---\r\nkey: value\r\n---\r\nBody";
		expect(parseFrontmatterStrings(md)).toEqual({ key: "value" });
	});
});

// ── splitFrontmatter ────────────────────────────────────────────────

describe("splitFrontmatter", () => {
	it("returns null when no frontmatter", () => {
		expect(splitFrontmatter("# Heading\nBody")).toBeNull();
	});

	it("splits frontmatter and body", () => {
		const md = "---\ntype: doc\n---\n\n# Title\nBody";
		const result = splitFrontmatter(md);
		expect(result).not.toBeNull();
		expect(result!.frontmatter).toEqual({ type: "doc" });
		expect(result!.body).toBe("\n\n# Title\nBody");
	});

	it("returns null for unclosed frontmatter", () => {
		expect(splitFrontmatter("---\nkey: value\nno closing")).toBeNull();
	});

	it("handles empty body after frontmatter", () => {
		const md = "---\nkey: val\n---";
		const result = splitFrontmatter(md);
		expect(result).not.toBeNull();
		expect(result!.frontmatter).toEqual({ key: "val" });
		expect(result!.body).toBe("");
	});
});

// ── joinFrontmatter ─────────────────────────────────────────────────

describe("joinFrontmatter", () => {
	it("serializes frontmatter and body", () => {
		const result = joinFrontmatter({ type: "component", status: "active" }, "\n# Title\n");
		expect(result).toBe("---\ntype: component\nstatus: active\n---\n# Title\n");
	});

	it("handles empty frontmatter", () => {
		const result = joinFrontmatter({}, "\n# Title\n");
		expect(result).toBe("---\n---\n# Title\n");
	});

	it("roundtrips with splitFrontmatter", () => {
		const original = "---\ntype: event\nname: test\n---\n\n# Body";
		const split = splitFrontmatter(original);
		const joined = joinFrontmatter(split!.frontmatter, split!.body);
		expect(joined).toBe(original);
	});
});
