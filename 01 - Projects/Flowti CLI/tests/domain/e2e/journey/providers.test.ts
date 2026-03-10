import { describe, it, expect, vi } from "vitest";
import { createDefaultRegistry } from "../../../../src/domain/e2e/journey/providers/index.js";
import { createCliProvider } from "../../../../src/domain/e2e/journey/providers/cli-provider.js";
import { createTypescriptProvider } from "../../../../src/domain/e2e/journey/providers/typescript-provider.js";
import { createObsidianVaultProvider } from "../../../../src/domain/e2e/journey/providers/obsidian-vault-provider.js";
import { createObsidianPluginProvider } from "../../../../src/domain/e2e/journey/providers/obsidian-plugin-provider.js";
import { createWebappProvider } from "../../../../src/domain/e2e/journey/providers/webapp-provider.js";
import { resolveEnvironment } from "../../../../src/domain/e2e/journey/journey-executor.js";
import { BASE_TOOLS } from "../../../../src/domain/e2e/journey/journey-tools.js";
import type { ToolDeps } from "../../../../src/domain/e2e/journey/journey-executor.js";

function mockDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => false),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		...overrides,
	};
}

// ── Default registry ─────────────────────────────────────────────────

describe("createDefaultRegistry", () => {
	it("registers all 5 targets", () => {
		const reg = createDefaultRegistry();
		const targets = reg.targets();
		expect(targets).toContain("cli");
		expect(targets).toContain("typescript");
		expect(targets).toContain("obsidian-vault");
		expect(targets).toContain("obsidian-plugin");
		expect(targets).toContain("webapp");
		expect(targets).toHaveLength(5);
	});

	it("resolves capabilities for base tools", () => {
		const reg = createDefaultRegistry();
		const results = reg.checkCapabilities(["command", "filesystem", "frontmatter"], mockDeps());
		expect(results.every((r) => r.available)).toBe(true);
	});

	it("resolves tools for each target", () => {
		const reg = createDefaultRegistry();
		for (const target of reg.targets()) {
			const tools = reg.resolveTools(target, BASE_TOOLS);
			// All targets include base tools
			expect(tools.command).toBeDefined();
			expect(tools.frontmatter).toBeDefined();
		}
	});
});

// ── CLI provider ─────────────────────────────────────────────────────

describe("createCliProvider", () => {
	it("targets cli with no extra tools", () => {
		const p = createCliProvider();
		expect(p.target).toBe("cli");
		expect(Object.keys(p.tools)).toHaveLength(0);
	});

	it("declares command and filesystem capabilities", () => {
		const p = createCliProvider();
		expect(p.capabilities).toContain("command");
		expect(p.capabilities).toContain("filesystem");
	});
});

// ── TypeScript provider ──────────────────────────────────────────────

describe("createTypescriptProvider", () => {
	it("targets typescript", () => {
		const p = createTypescriptProvider();
		expect(p.target).toBe("typescript");
	});

	it("provides tsc-check and lint tools", () => {
		const p = createTypescriptProvider();
		expect(p.tools["tsc-check"]).toBeDefined();
		expect(p.tools["lint"]).toBeDefined();
	});

	it("tsc-check tool runs npx tsc --noEmit", () => {
		const deps = mockDeps();
		const p = createTypescriptProvider();
		const result = p.tools["tsc-check"](
			{ tool: "tsc-check" }, deps, { cwd: "/project" },
		);
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("tsc --noEmit"),
			expect.objectContaining({ cwd: "/project" }),
		);
		expect((result as { success: boolean }).success).toBe(true);
	});

	it("lint tool runs configurable command", () => {
		const deps = mockDeps();
		const p = createTypescriptProvider();
		p.tools["lint"](
			{ tool: "lint", command: "npm run lint" }, deps, { cwd: "/project", variables: {} },
		);
		expect(deps.exec).toHaveBeenCalledWith(
			"npm run lint",
			expect.objectContaining({ cwd: "/project" }),
		);
	});
});

// ── Obsidian Vault provider ──────────────────────────────────────────

describe("createObsidianVaultProvider", () => {
	it("targets obsidian-vault", () => {
		const p = createObsidianVaultProvider();
		expect(p.target).toBe("obsidian-vault");
	});

	it("provides vault-note and vault-structure tools", () => {
		const p = createObsidianVaultProvider();
		expect(p.tools["vault-note"]).toBeDefined();
		expect(p.tools["vault-structure"]).toBeDefined();
	});

	it("setup creates .obsidian directory", () => {
		const deps = mockDeps({ exists: vi.fn(() => false) });
		const p = createObsidianVaultProvider();
		p.setup!(deps, { cwd: "/vault" });
		expect(deps.mkdir).toHaveBeenCalledWith("/vault/.obsidian");
	});

	it("setup skips if .obsidian exists", () => {
		const deps = mockDeps({ exists: vi.fn(() => true) });
		const p = createObsidianVaultProvider();
		p.setup!(deps, { cwd: "/vault" });
		expect(deps.mkdir).not.toHaveBeenCalled();
	});

	it("vault-note create writes file", () => {
		const deps = mockDeps();
		const p = createObsidianVaultProvider();
		const result = p.tools["vault-note"](
			{ tool: "vault-note", op: "create", path: "/vault/notes/test.md", content: "# Test" },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(true);
		expect(deps.writeFile).toHaveBeenCalledWith("/vault/notes/test.md", "# Test");
	});

	it("vault-note exists checks path", () => {
		const deps = mockDeps({ exists: vi.fn(() => false) });
		const p = createObsidianVaultProvider();
		const result = p.tools["vault-note"](
			{ tool: "vault-note", op: "exists", path: "/vault/missing.md" },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(false);
	});

	it("vault-structure passes when all paths exist", () => {
		const deps = mockDeps({ exists: vi.fn(() => true) });
		const p = createObsidianVaultProvider();
		const result = p.tools["vault-structure"](
			{ tool: "vault-structure", paths: [".obsidian", "notes/"] },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(true);
	});

	it("vault-structure fails when paths are missing", () => {
		const deps = mockDeps({ exists: vi.fn(() => false) });
		const p = createObsidianVaultProvider();
		const result = p.tools["vault-structure"](
			{ tool: "vault-structure", paths: [".obsidian", "notes/"] },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(false);
	});
});

// ── Obsidian Plugin provider ─────────────────────────────────────────

describe("createObsidianPluginProvider", () => {
	it("targets obsidian-plugin", () => {
		const p = createObsidianPluginProvider();
		expect(p.target).toBe("obsidian-plugin");
	});

	it("provides obsidian-cli, plugin-deploy, and plugin-state tools", () => {
		const p = createObsidianPluginProvider();
		expect(p.tools["obsidian-cli"]).toBeDefined();
		expect(p.tools["plugin-deploy"]).toBeDefined();
		expect(p.tools["plugin-state"]).toBeDefined();
	});

	it("plugin-state read returns data.json content", () => {
		const deps = mockDeps({ readFile: vi.fn(() => '{"key":"val"}') });
		const vars: Record<string, string> = {};
		const p = createObsidianPluginProvider();
		const result = p.tools["plugin-state"](
			{ tool: "plugin-state", op: "read", dataJsonPath: "/data.json", storeAs: "state" },
			deps, { variables: vars },
		);
		expect((result as { success: boolean }).success).toBe(true);
		expect(vars.state).toBe('{"key":"val"}');
	});

	it("plugin-state set updates a field", () => {
		const deps = mockDeps({ readFile: vi.fn(() => '{"existing":"val"}') });
		const p = createObsidianPluginProvider();
		const result = p.tools["plugin-state"](
			{ tool: "plugin-state", op: "set", dataJsonPath: "/data.json", field: "new", value: "hello" },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(true);
		const written = JSON.parse(vi.mocked(deps.writeFile).mock.calls[0][1]);
		expect(written.existing).toBe("val");
		expect(written.new).toBe("hello");
	});

	it("plugin-deploy builds and copies artifacts", () => {
		const deps = mockDeps({ exists: vi.fn(() => true), readFile: vi.fn(() => "content") });
		const p = createObsidianPluginProvider();
		const result = p.tools["plugin-deploy"](
			{ tool: "plugin-deploy", pluginDir: "/vault/.obsidian/plugins/test", artifacts: ["main.js"] },
			deps, { cwd: "/project", variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(true);
		expect(deps.exec).toHaveBeenCalledWith("npm run build", expect.anything());
		expect(deps.writeFile).toHaveBeenCalledWith(
			"/vault/.obsidian/plugins/test/main.js",
			"content",
		);
	});

	it("plugin-deploy fails on build failure", () => {
		const deps = mockDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "", stderr: "build error" })),
		});
		const p = createObsidianPluginProvider();
		const result = p.tools["plugin-deploy"](
			{ tool: "plugin-deploy", pluginDir: "/vault/plugins/test" },
			deps, { cwd: "/project", variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(false);
	});
});

// ── Webapp provider ──────────────────────────────────────────────────

describe("createWebappProvider", () => {
	it("targets webapp", () => {
		const p = createWebappProvider();
		expect(p.target).toBe("webapp");
	});

	it("provides http-check, dev-server, and bundle-check tools", () => {
		const p = createWebappProvider();
		expect(p.tools["http-check"]).toBeDefined();
		expect(p.tools["dev-server"]).toBeDefined();
		expect(p.tools["bundle-check"]).toBeDefined();
	});

	it("http-check uses curl", () => {
		const deps = mockDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "200", stderr: "" })),
		});
		const p = createWebappProvider();
		const result = p.tools["http-check"](
			{ tool: "http-check", url: "http://localhost:3000" },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(true);
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("curl"),
			expect.anything(),
		);
	});

	it("http-check fails on status mismatch", () => {
		const deps = mockDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "404", stderr: "" })),
		});
		const p = createWebappProvider();
		const result = p.tools["http-check"](
			{ tool: "http-check", url: "http://localhost:3000", expectedStatus: 200 },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(false);
	});

	it("bundle-check passes when file exists and under limit", () => {
		const deps = mockDeps({
			exists: vi.fn(() => true),
			readFile: vi.fn(() => "x".repeat(100 * 1024)),
		});
		const p = createWebappProvider();
		const result = p.tools["bundle-check"](
			{ tool: "bundle-check", path: "dist/app.js", maxSizeKb: 200 },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(true);
	});

	it("bundle-check fails when over limit", () => {
		const deps = mockDeps({
			exists: vi.fn(() => true),
			readFile: vi.fn(() => "x".repeat(500 * 1024)),
		});
		const p = createWebappProvider();
		const result = p.tools["bundle-check"](
			{ tool: "bundle-check", path: "dist/app.js", maxSizeKb: 100 },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(false);
	});

	it("bundle-check fails when file missing", () => {
		const deps = mockDeps({ exists: vi.fn(() => false) });
		const p = createWebappProvider();
		const result = p.tools["bundle-check"](
			{ tool: "bundle-check", path: "dist/missing.js" },
			deps, { variables: {} },
		);
		expect((result as { success: boolean }).success).toBe(false);
	});
});

// ── resolveEnvironment ───────────────────────────────────────────────

describe("resolveEnvironment", () => {
	it("returns base tools when no provider", () => {
		const env = resolveEnvironment();
		expect(env.tools.command).toBeDefined();
		expect(env.tools.frontmatter).toBeDefined();
		expect(env.setup).toBeUndefined();
	});

	it("merges provider tools when provider given", () => {
		const provider = createTypescriptProvider();
		const env = resolveEnvironment(provider);
		expect(env.tools["tsc-check"]).toBeDefined();
		expect(env.tools.command).toBeDefined();
	});

	it("includes provider setup/teardown", () => {
		const provider = createObsidianVaultProvider();
		const env = resolveEnvironment(provider);
		expect(env.setup).toBeDefined();
	});
});
