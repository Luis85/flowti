vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../../../src/infrastructure/shell.js", () => ({ sh: {} }));
vi.mock("../../../../../src/infrastructure/paths.js", () => ({ paths: {} }));

import { createVaultTestProvider } from "../../../../../src/domain/e2e/journey/providers/vault-test-provider.js";
import type { ToolDeps } from "../../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyExecutorOptions } from "../../../../../src/domain/e2e/journey/journey-types.js";

function createMockToolDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "ok", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => true),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		clock: { ms: () => Date.now() },
		...overrides,
	};
}

describe("createVaultTestProvider", () => {
	it("returns a valid EnvironmentProvider", () => {
		const provider = createVaultTestProvider();
		expect(provider.target).toBe("vault-test");
		expect(provider.label).toBe("Vault Test");
		expect(provider.capabilities).toContain("vault-cli");
		expect(provider.capabilities).toContain("vault-provision");
		expect(provider.capabilities).toContain("vault-project");
		expect(provider.capabilities).toContain("command");
		expect(provider.capabilities).toContain("filesystem");
	});

	it("provides vault-cli tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-cli"]).toBeDefined();
	});

	it("provides vault-project tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-project"]).toBeDefined();
	});

	it("provides vault-assert tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-assert"]).toBeDefined();
	});

	it("has setup and teardown functions", () => {
		const provider = createVaultTestProvider();
		expect(typeof provider.setup).toBe("function");
		expect(typeof provider.teardown).toBe("function");
	});
});

describe("vault-cli tool", () => {
	it("executes CLI command in vault root", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "help" };

		const result = provider.tools["vault-cli"](action, deps, opts);

		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("help"),
			expect.objectContaining({ cwd: "/tmp/test-vault" }),
		);
		expect(result.success).toBe(true);
	});

	it("fails when exit code does not match expectExit", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "", stderr: "error" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "build", expectExit: 0 };

		const result = provider.tools["vault-cli"](action, deps, opts);
		expect(result.success).toBe(false);
	});

	it("succeeds when exit code matches non-zero expectExit", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "fail output", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "build", expectExit: 1 };

		const result = provider.tools["vault-cli"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("checks stdoutContains when provided", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "flowti v1.0.0", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "help", stdoutContains: "flowti" };

		const result = provider.tools["vault-cli"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("fails when stdoutContains does not match", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "something else", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "help", stdoutContains: "flowti" };

		const result = provider.tools["vault-cli"](action, deps, opts);
		expect(result.success).toBe(false);
	});

	it("stores stdout in variables via storeAs", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "output data", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "info", storeAs: "result" };

		provider.tools["vault-cli"](action, deps, opts);
		expect(opts.variables!["result"]).toBe("output data");
	});

	it("parses JSON output when format is json", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: '{"score": 85}', stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "health", format: "json", storeAs: "health" };

		provider.tools["vault-cli"](action, deps, opts);
		expect(opts.variables!["health"]).toEqual({ score: 85 });
	});
});

describe("vault-project tool", () => {
	it("list operation reads project directories", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-project", op: "list", storeAs: "projects" };

		const result = provider.tools["vault-project"](action, deps, opts);
		expect(result.tool).toBe("vault-project");
	});

	it("info operation runs flowti info with project flag", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: '{"name":"Healthy App"}', stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-project", op: "info", project: "Healthy App", storeAs: "info" };

		const result = provider.tools["vault-project"](action, deps, opts);

		expect(result.success).toBe(true);
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("info"),
			expect.objectContaining({ cwd: "/tmp/vault" }),
		);
	});

	it("run operation executes command with project flag", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-project", op: "run", project: "Healthy App", command: "build" };

		const result = provider.tools["vault-project"](action, deps, opts);

		expect(result.success).toBe(true);
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining('build --project="Healthy App"'),
			expect.anything(),
		);
	});
});

describe("vault-assert tool", () => {
	it("health-score: passes when score is in range", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", healthResult: { score: 85 } },
		};
		const action = { tool: "vault-assert", type: "health-score", source: "healthResult", min: 70, max: 100 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("health-score: fails when score is below min", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", healthResult: { score: 30 } },
		};
		const action = { tool: "vault-assert", type: "health-score", source: "healthResult", min: 70, max: 100 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(false);
	});

	it("json-field: passes with eq operator", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { name: "test" } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "name", operator: "eq", expected: "test" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("json-field: passes with gte operator", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { count: 10 } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "count", operator: "gte", expected: 5 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("json-field: supports dot-path traversal", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { nested: { value: 42 } } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "nested.value", operator: "eq", expected: 42 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("json-field: contains operator for strings", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { message: "hello world" } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "message", operator: "contains", expected: "world" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("report-exists: passes when report file exists", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({ exists: vi.fn(() => true) });
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-assert", type: "report-exists", project: "Healthy App", report: "health" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("report-exists: fails when report file missing", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({ exists: vi.fn(() => false) });
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-assert", type: "report-exists", project: "Healthy App", report: "health" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(false);
	});
});
