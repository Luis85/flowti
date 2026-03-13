import { describe, it, expect, vi } from "vitest";
import { createWebappProvider } from "../../../../../src/domain/e2e/journey/providers/webapp-provider.js";
import type { ToolDeps } from "../../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyExecutorOptions } from "../../../../../src/domain/e2e/journey/journey-types.js";

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

function r(result: unknown): { success: boolean; output?: string; error?: string } {
	return result as { success: boolean; output?: string; error?: string };
}

// ── http-check ───────────────────────────────────────────────────────

describe("http-check", () => {
	const provider = createWebappProvider();

	it("fails when no url specified", () => {
		const deps = mockDeps();
		const result = r(provider.tools["http-check"]({ tool: "http-check" }, deps, opts()));
		expect(result.success).toBe(false);
		expect(result.error).toContain("No url");
	});

	it("succeeds with default expectedStatus 200", () => {
		const deps = mockDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "200", stderr: "" })),
		});
		const result = r(provider.tools["http-check"](
			{ tool: "http-check", url: "http://localhost:3000" }, deps, opts(),
		));
		expect(result.success).toBe(true);
		expect(result.output).toContain("200");
	});

	it("fails when status does not match expected", () => {
		const deps = mockDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "500", stderr: "" })),
		});
		const result = r(provider.tools["http-check"](
			{ tool: "http-check", url: "http://localhost:3000", expectedStatus: 200 }, deps, opts(),
		));
		expect(result.success).toBe(false);
		expect(result.error).toContain("Expected 200");
	});

	it("handles exec failure gracefully", () => {
		const deps = mockDeps({
			exec: vi.fn(() => { throw new Error("connection refused"); }),
		});
		const result = r(provider.tools["http-check"](
			{ tool: "http-check", url: "http://localhost:9999" }, deps, opts(),
		));
		expect(result.success).toBe(false);
		expect(result.error).toContain("connection refused");
	});
});

// ── dev-server ───────────────────────────────────────────────────────

describe("dev-server", () => {
	const provider = createWebappProvider();

	it("start fires command in background", () => {
		const deps = mockDeps();
		const result = r(provider.tools["dev-server"](
			{ tool: "dev-server", op: "start", command: "npm run dev", port: 4000 }, deps, opts(),
		));
		expect(result.success).toBe(true);
		expect(result.output).toContain("4000");
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("4000"));
	});

	it("start uses default command and port", () => {
		const deps = mockDeps();
		const result = r(provider.tools["dev-server"](
			{ tool: "dev-server", op: "start" }, deps, opts(),
		));
		expect(result.success).toBe(true);
		expect(result.output).toContain("3000");
	});

	it("start succeeds even when exec throws (background process)", () => {
		const deps = mockDeps({
			exec: vi.fn(() => { throw new Error("timeout"); }),
		});
		const result = r(provider.tools["dev-server"](
			{ tool: "dev-server", op: "start" }, deps, opts(),
		));
		expect(result.success).toBe(true);
	});

	it("stop kills process on port", () => {
		const deps = mockDeps();
		const result = r(provider.tools["dev-server"](
			{ tool: "dev-server", op: "stop", port: 8080 }, deps, opts(),
		));
		expect(result.success).toBe(true);
		expect(result.output).toContain("8080");
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("kill-port 8080"),
			expect.anything(),
		);
	});

	it("stop succeeds even when kill-port fails", () => {
		const deps = mockDeps({
			exec: vi.fn(() => { throw new Error("kill failed"); }),
		});
		const result = r(provider.tools["dev-server"](
			{ tool: "dev-server", op: "stop" }, deps, opts(),
		));
		expect(result.success).toBe(true);
	});

	it("fails on unknown op", () => {
		const deps = mockDeps();
		const result = r(provider.tools["dev-server"](
			{ tool: "dev-server", op: "restart" }, deps, opts(),
		));
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unknown dev-server op");
	});
});

// ── bundle-check ─────────────────────────────────────────────────────

describe("bundle-check", () => {
	const provider = createWebappProvider();

	it("fails when no path specified", () => {
		const deps = mockDeps();
		const result = r(provider.tools["bundle-check"]({ tool: "bundle-check" }, deps, opts()));
		expect(result.success).toBe(false);
		expect(result.error).toContain("No path");
	});

	it("succeeds when no maxSizeKb specified (any size ok)", () => {
		const deps = mockDeps({
			exists: vi.fn(() => true),
			readFile: vi.fn(() => "x".repeat(1024 * 1024)),
		});
		const result = r(provider.tools["bundle-check"](
			{ tool: "bundle-check", path: "dist/bundle.js" }, deps, opts(),
		));
		expect(result.success).toBe(true);
		expect(result.output).toContain("KB");
	});

	it("handles read error", () => {
		const deps = mockDeps({
			exists: vi.fn(() => true),
			readFile: vi.fn(() => { throw new Error("read failed"); }),
		});
		const result = r(provider.tools["bundle-check"](
			{ tool: "bundle-check", path: "dist/bundle.js" }, deps, opts(),
		));
		expect(result.success).toBe(false);
		expect(result.error).toContain("read failed");
	});
});
