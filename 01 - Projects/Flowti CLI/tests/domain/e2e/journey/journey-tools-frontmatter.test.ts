import { describe, it, expect, vi } from "vitest";
import { toolFrontmatter } from "../../../../src/domain/e2e/journey/journey-tools.js";
import type { ToolDeps } from "../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyExecutorOptions } from "../../../../src/domain/e2e/journey/journey-types.js";

function mockDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => true),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		...overrides,
	};
}

const opts: JourneyExecutorOptions = { variables: {} };

const SAMPLE_MD = `---
title: Test Note
status: pass
count: 42
tags:
  - alpha
  - beta
---
# Body content
`;

// ── frontmatter: read ────────────────────────────────────────────────

describe("frontmatter: read", () => {
	it("reads all frontmatter fields as JSON", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "read", path: "/note.md" },
			deps, opts,
		);
		expect(result.success).toBe(true);
		const parsed = JSON.parse(result.output!);
		expect(parsed.title).toBe("Test Note");
		expect(parsed.status).toBe("pass");
		expect(parsed.count).toBe(42);
	});

	it("stores result in variable when storeAs specified", () => {
		const vars: Record<string, string> = {};
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		toolFrontmatter(
			{ tool: "frontmatter", op: "read", path: "/note.md", storeAs: "fm" },
			deps, { variables: vars },
		);
		expect(vars.fm).toBeDefined();
		expect(JSON.parse(vars.fm).title).toBe("Test Note");
	});

	it("fails when no frontmatter found", () => {
		const deps = mockDeps({ readFile: vi.fn(() => "# Just a heading\n") });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "read", path: "/no-fm.md" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No frontmatter");
	});
});

// ── frontmatter: get ─────────────────────────────────────────────────

describe("frontmatter: get", () => {
	it("gets a specific field value", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "get", path: "/note.md", field: "title" },
			deps, opts,
		);
		expect(result.success).toBe(true);
		expect(result.output).toBe("title=Test Note");
	});

	it("stores field value in variable", () => {
		const vars: Record<string, string> = {};
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		toolFrontmatter(
			{ tool: "frontmatter", op: "get", path: "/note.md", field: "status", storeAs: "st" },
			deps, { variables: vars },
		);
		expect(vars.st).toBe("pass");
	});

	it("returns empty string for missing field", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "get", path: "/note.md", field: "missing" },
			deps, opts,
		);
		expect(result.success).toBe(true);
		expect(result.output).toBe("missing=");
	});

	it("fails when no field specified", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "get", path: "/note.md" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No field");
	});
});

// ── frontmatter: set ─────────────────────────────────────────────────

describe("frontmatter: set", () => {
	it("updates an existing field", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "set", path: "/note.md", field: "status", value: "fail" },
			deps, opts,
		);
		expect(result.success).toBe(true);
		expect(result.output).toBe("status=fail");
		expect(deps.writeFile).toHaveBeenCalledOnce();
		const written = vi.mocked(deps.writeFile).mock.calls[0][1];
		expect(written).toContain("status: fail");
	});

	it("adds a new field to existing frontmatter", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		toolFrontmatter(
			{ tool: "frontmatter", op: "set", path: "/note.md", field: "newField", value: "hello" },
			deps, opts,
		);
		const written = vi.mocked(deps.writeFile).mock.calls[0][1];
		expect(written).toContain("newField: hello");
	});

	it("creates frontmatter on file without it", () => {
		const deps = mockDeps({ readFile: vi.fn(() => "# No frontmatter\n") });
		toolFrontmatter(
			{ tool: "frontmatter", op: "set", path: "/bare.md", field: "type", value: "note" },
			deps, opts,
		);
		const written = vi.mocked(deps.writeFile).mock.calls[0][1];
		expect(written).toContain("---");
		expect(written).toContain("type: note");
	});

	it("fails when no field specified", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "set", path: "/note.md", value: "x" },
			deps, opts,
		);
		expect(result.success).toBe(false);
	});
});

// ── frontmatter: assert ──────────────────────────────────────────────

describe("frontmatter: assert", () => {
	it("passes when field matches expected value", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "assert", path: "/note.md", field: "status", expected: "pass" },
			deps, opts,
		);
		expect(result.success).toBe(true);
	});

	it("fails when field does not match", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "assert", path: "/note.md", field: "status", expected: "fail" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain('Expected status="fail"');
		expect(result.error).toContain('got "pass"');
	});

	it("fails when no frontmatter found", () => {
		const deps = mockDeps({ readFile: vi.fn(() => "# No FM") });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "assert", path: "/bare.md", field: "x", expected: "y" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No frontmatter");
	});

	it("compares numeric fields as strings", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "assert", path: "/note.md", field: "count", expected: "42" },
			deps, opts,
		);
		expect(result.success).toBe(true);
	});
});

// ── Edge cases ───────────────────────────────────────────────────────

describe("frontmatter: edge cases", () => {
	it("fails when no path specified", () => {
		const deps = mockDeps();
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "read" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No path");
	});

	it("fails when no op specified", () => {
		const deps = mockDeps();
		const result = toolFrontmatter(
			{ tool: "frontmatter", path: "/note.md" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No op");
	});

	it("fails for unknown op", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "delete", path: "/note.md" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unknown frontmatter op");
	});

	it("handles read errors gracefully", () => {
		const deps = mockDeps({ readFile: vi.fn(() => { throw new Error("ENOENT"); }) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "read", path: "/missing.md" },
			deps, opts,
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("ENOENT");
	});

	it("supports variable interpolation in path", () => {
		const deps = mockDeps({ readFile: vi.fn(() => SAMPLE_MD) });
		const result = toolFrontmatter(
			{ tool: "frontmatter", op: "read", path: "{{vault}}/note.md" },
			deps, { variables: { vault: "/my-vault" } },
		);
		expect(result.success).toBe(true);
		expect(deps.readFile).toHaveBeenCalledWith("/my-vault/note.md");
	});
});
