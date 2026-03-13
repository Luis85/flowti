import { describe, it, expect, vi } from "vitest";
import { interpolate, resolveString, BASE_TOOLS } from "../../../../src/domain/e2e/journey/journey-tools.js";
import type { ToolDeps } from "../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyExecutorOptions } from "../../../../src/domain/e2e/journey/journey-types.js";

// ── Mock deps ────────────────────────────────────────────────────────

function mockDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => false),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		clock: { ms: () => 1000 },
		...overrides,
	};
}

function opts(overrides?: Partial<JourneyExecutorOptions>): JourneyExecutorOptions {
	return { cwd: "/project", variables: {}, ...overrides };
}

function r(result: unknown): { success: boolean; output?: string; error?: string; durationMs?: number } {
	return result as { success: boolean; output?: string; error?: string; durationMs?: number };
}

// ── interpolate ──────────────────────────────────────────────────────

describe("interpolate", () => {
	it("replaces {{var}} with variable values", () => {
		expect(interpolate("hello {{name}}", { name: "world" })).toBe("hello world");
	});

	it("preserves unresolved variables", () => {
		expect(interpolate("{{missing}}", {})).toBe("{{missing}}");
	});

	it("replaces multiple variables", () => {
		expect(interpolate("{{a}} and {{b}}", { a: "1", b: "2" })).toBe("1 and 2");
	});

	it("returns non-string values unchanged", () => {
		expect(interpolate(42, {})).toBe(42);
		expect(interpolate(null, {})).toBeNull();
		expect(interpolate(undefined, {})).toBeUndefined();
		expect(interpolate(true, {})).toBe(true);
	});

	it("handles empty variables object", () => {
		expect(interpolate("no vars here", {})).toBe("no vars here");
	});
});

// ── resolveString ────────────────────────────────────────────────────

describe("resolveString", () => {
	it("extracts and interpolates a field from action", () => {
		const action = { tool: "test", path: "/{{dir}}/file.txt" };
		expect(resolveString(action, "path", { dir: "docs" })).toBe("/docs/file.txt");
	});

	it("returns empty string for missing field", () => {
		expect(resolveString({ tool: "test" }, "path", {})).toBe("");
	});

	it("returns empty string for undefined field", () => {
		expect(resolveString({ tool: "test", path: undefined }, "path", {})).toBe("");
	});
});

// ── BASE_TOOLS registry ──────────────────────────────────────────────

describe("BASE_TOOLS", () => {
	it("contains all 9 base tools", () => {
		const expected = ["command", "assert", "wait", "log", "file-write", "file-read", "file-exists", "frontmatter", "screenshot"];
		for (const name of expected) {
			expect(BASE_TOOLS[name]).toBeDefined();
		}
		expect(Object.keys(BASE_TOOLS)).toHaveLength(9);
	});

	it("all tools return ActionResult with durationMs", () => {
		const deps = mockDeps();
		// Test a sync tool
		const logResult = r(BASE_TOOLS["log"]({ tool: "log", message: "test" }, deps, opts()));
		expect(logResult.durationMs).toBeDefined();
		expect(typeof logResult.durationMs).toBe("number");
	});
});

// ── command tool edge cases ──────────────────────────────────────────

describe("toolCommand edge cases", () => {
	it("passes env from opts to exec", () => {
		const deps = mockDeps();
		const env = { MY_VAR: "test" };
		BASE_TOOLS["command"]({ tool: "command", id: "echo hello" }, deps, opts({ env }));
		expect(deps.exec).toHaveBeenCalledWith(
			"echo hello",
			expect.objectContaining({ env }),
		);
	});

	it("uses custom commandTimeout", () => {
		const deps = mockDeps();
		BASE_TOOLS["command"]({ tool: "command", id: "slow-cmd" }, deps, opts({ commandTimeout: 60000 }));
		expect(deps.exec).toHaveBeenCalledWith(
			"slow-cmd",
			expect.objectContaining({ timeout: 60000 }),
		);
	});

	it("interpolates variables in command id", () => {
		const deps = mockDeps();
		BASE_TOOLS["command"](
			{ tool: "command", id: "npm run {{script}}" },
			deps, opts({ variables: { script: "build" } }),
		);
		expect(deps.exec).toHaveBeenCalledWith(
			"npm run build",
			expect.anything(),
		);
	});
});

// ── assert tool edge cases ───────────────────────────────────────────

describe("toolAssert edge cases", () => {
	it("frontmatter-equals succeeds when values match", () => {
		const deps = mockDeps({
			readFile: vi.fn(() => "---\nstatus: pass\n---\n# Test"),
		});
		const result = r(BASE_TOOLS["assert"](
			{ tool: "assert", type: "frontmatter-equals", path: "/test.md", field: "status", expected: "pass" },
			deps, opts(),
		));
		expect(result.success).toBe(true);
	});

	it("frontmatter-equals fails when values differ", () => {
		const deps = mockDeps({
			readFile: vi.fn(() => "---\nstatus: fail\n---\n# Test"),
		});
		const result = r(BASE_TOOLS["assert"](
			{ tool: "assert", type: "frontmatter-equals", path: "/test.md", field: "status", expected: "pass" },
			deps, opts(),
		));
		expect(result.success).toBe(false);
		expect(result.error).toContain('Expected status="pass"');
	});

	it("frontmatter-equals fails when no frontmatter present", () => {
		const deps = mockDeps({
			readFile: vi.fn(() => "# No frontmatter"),
		});
		const result = r(BASE_TOOLS["assert"](
			{ tool: "assert", type: "frontmatter-equals", path: "/test.md", field: "status", expected: "pass" },
			deps, opts(),
		));
		expect(result.success).toBe(false);
		expect(result.error).toContain("No frontmatter");
	});

	it("exit-code uses default expected 0", () => {
		const deps = mockDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		});
		const result = r(BASE_TOOLS["assert"](
			{ tool: "assert", type: "exit-code", command: "true" },
			deps, opts(),
		));
		expect(result.success).toBe(true);
	});
});

// ── file-read storeAs ────────────────────────────────────────────────

describe("toolFileRead storeAs", () => {
	it("stores content in variables when storeAs is set", () => {
		const deps = mockDeps({ readFile: vi.fn(() => "file content") });
		const variables: Record<string, string> = {};
		BASE_TOOLS["file-read"](
			{ tool: "file-read", path: "/test.txt", storeAs: "myVar" },
			deps, opts({ variables }),
		);
		expect(variables.myVar).toBe("file content");
	});

	it("does not store when storeAs is absent", () => {
		const deps = mockDeps({ readFile: vi.fn(() => "content") });
		const variables: Record<string, string> = {};
		BASE_TOOLS["file-read"](
			{ tool: "file-read", path: "/test.txt" },
			deps, opts({ variables }),
		);
		expect(Object.keys(variables)).toHaveLength(0);
	});
});

// ── screenshot ───────────────────────────────────────────────────────

describe("toolScreenshot", () => {
	it("returns success with skip message", () => {
		const deps = mockDeps();
		const result = r(BASE_TOOLS["screenshot"]({ tool: "screenshot" }, deps, opts()));
		expect(result.success).toBe(true);
		expect(result.output).toContain("skipped");
	});
});
