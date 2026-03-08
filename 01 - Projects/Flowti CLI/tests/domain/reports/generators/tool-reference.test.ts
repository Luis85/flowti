import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string, ext?: string) => {
			const base = p.split("/").pop() ?? "";
			return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
		},
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/mock",
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00Z", ms: () => 1000000 },
}));

import {
	extractBlock,
	extractBracketBlock,
	extractStringField,
	extractStringArrayField,
	tsObjectToJson,
} from "../../../../src/domain/reports/generators/tool-reference.js";

// ── Tests ────────────────────────────────────────────────────────────

describe("extractBlock", () => {
	it("extracts a balanced brace block", () => {
		const source = 'prefix { inner: "value" } suffix';
		const result = extractBlock(source, 7);
		expect(result).toBe('{ inner: "value" }');
	});

	it("handles nested braces", () => {
		const source = '{ outer: { inner: "x" } }';
		const result = extractBlock(source, 0);
		expect(result).toBe('{ outer: { inner: "x" } }');
	});

	it("returns null when not starting at brace", () => {
		expect(extractBlock("abc", 0)).toBeNull();
	});

	it("returns null for unbalanced braces", () => {
		expect(extractBlock("{ unclosed", 0)).toBeNull();
	});
});

describe("extractBracketBlock", () => {
	it("extracts a balanced bracket block", () => {
		const source = 'prefix ["a", "b"] suffix';
		const result = extractBracketBlock(source, 7);
		expect(result).toBe('["a", "b"]');
	});

	it("handles nested brackets", () => {
		const source = '[[1, 2], [3]]';
		expect(extractBracketBlock(source, 0)).toBe('[[1, 2], [3]]');
	});

	it("returns null when not starting at bracket", () => {
		expect(extractBracketBlock("abc", 0)).toBeNull();
	});

	it("returns null for unbalanced brackets", () => {
		expect(extractBracketBlock("[unclosed", 0)).toBeNull();
	});
});

describe("extractStringField", () => {
	it("extracts a simple string field", () => {
		expect(extractStringField('name: "screenshot"', "name")).toBe("screenshot");
	});

	it("handles escaped quotes", () => {
		expect(extractStringField('desc: "default: \\"dom\\""', "desc")).toBe('default: "dom"');
	});

	it("returns null when field not found", () => {
		expect(extractStringField('name: "test"', "missing")).toBeNull();
	});

	it("handles multiline values", () => {
		const block = `description: "line one\nline two"`;
		expect(extractStringField(block, "description")).toBe("line one\nline two");
	});
});

describe("extractStringArrayField", () => {
	it("extracts a string array", () => {
		const block = 'tags: ["ui", "action", "dom"]';
		expect(extractStringArrayField(block, "tags")).toEqual(["ui", "action", "dom"]);
	});

	it("returns empty array when field not found", () => {
		expect(extractStringArrayField("no match", "tags")).toEqual([]);
	});

	it("returns empty array for empty brackets", () => {
		expect(extractStringArrayField("tags: []", "tags")).toEqual([]);
	});
});

describe("tsObjectToJson", () => {
	it("quotes unquoted keys", () => {
		expect(tsObjectToJson('{ tool: "screenshot" }')).toBe('{ "tool": "screenshot" }');
	});

	it("removes trailing commas", () => {
		expect(tsObjectToJson('{ "a": 1, }')).toBe('{ "a": 1}');
	});

	it("handles nested objects", () => {
		const input = '{ tool: "click", selector: ".btn", }';
		const result = tsObjectToJson(input);
		expect(JSON.parse(result)).toEqual({ tool: "click", selector: ".btn" });
	});

	it("preserves quoted keys", () => {
		const input = '{ "already-quoted": "value" }';
		const result = tsObjectToJson(input);
		expect(result).toContain('"already-quoted"');
	});
});
