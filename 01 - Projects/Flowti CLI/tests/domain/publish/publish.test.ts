import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn((code: number) => { throw new Error(`exit(${code})`); }) },
}));

vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn(() => "text"),
	printOutput: vi.fn((_f: string, _d: unknown, render: () => void) => render()),
}));

vi.mock("../../../src/domain/health/health.js", () => ({
	collectHealth: vi.fn(() => ({
		name: "test",
		source: null,
		tests: { total: 100, passed: 100, failed: 0, suites: 10 },
		coverage: { lines: 90, branches: 85, functions: 92 },
		build: { success: true, durationMs: 3000 },
		lint: { errors: 0, warnings: 0 },
		git: { branch: "main", status: "clean" },
		components: 0,
	})),
}));

vi.mock("../../../src/domain/health/health-scoring.js", () => ({
	scoreHealth: vi.fn(() => ({
		overall: 90,
		grade: "A",
		categories: { tests: 100, coverage: 89, build: 100, lint: 100, git: 100 },
	})),
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

vi.mock("../../../src/domain/health/quality-gate.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/domain/health/quality-gate.js")>("../../../src/domain/health/quality-gate.js");
	return actual;
});

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/controller/publish.controller.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

const mockLog = vi.mocked(log);

function makeProject(publish?: { build?: string; test?: string }): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0" },
		config: { name: "test", publish },
		scripts: {},
	};
}

beforeEach(() => vi.clearAllMocks());

describe("publish commands", () => {
	it("publish runs build command from config", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build:release" });

		commands["publish"]({}, [], "publish", project);

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run build:release");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("publish defaults to npm run build", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["publish"]({}, [], "publish", project);

		expect(sh.calls[0].cmd).toBe("npm run build");
	});

	it("publish:all runs build and test on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build", test: "npm test" });

		commands["publish:all"]({}, [], "publish:all", project);

		expect(sh.calls).toHaveLength(2);
		expect(sh.calls[0].cmd).toBe("npm run build");
		expect(sh.calls[1].cmd).toBe("npm test");
	});

	it("publish:all exits on build failure", () => {
		const sh = createMockShell({ exitCodes: { "npm run build": 1 } });
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build", test: "npm test" });

		expect(() => commands["publish:all"]({}, [], "publish:all", project)).toThrow("exit(1)");
		expect(sh.calls).toHaveLength(1);
	});

	it("publish:all exits on test failure", () => {
		const sh = createMockShell({ exitCodes: { "npm test": 1 } });
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build", test: "npm test" });

		expect(() => commands["publish:all"]({}, [], "publish:all", project)).toThrow("exit(1)");
		expect(sh.calls).toHaveLength(2);
	});
});

describe("publish --dry-run", () => {
	it("does not run any commands", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({
			build: "npm run build",
			test: "npm test",
		});
		(project.config as { publish: { build: string; test: string; outDir: string; endpoints: Array<{ name: string; path: string }> } }).publish = {
			build: "npm run build",
			test: "npm test",
			outDir: "dist",
			endpoints: [{ name: "local", path: "/target" }],
		};

		commands["publish"]({ "dry-run": true }, [], "publish", project);

		expect(sh.calls).toHaveLength(0);
	});

	it("logs the pipeline preview", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build:release" });

		commands["publish"]({ "dry-run": true }, [], "publish", project);

		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("Dry run"))).toBe(true);
		expect(calls.some((m) => m.includes("npm run build:release"))).toBe(true);
	});

	it("shows endpoints when configured", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();
		(project.config as { publish: { outDir: string; endpoints: Array<{ name: string; path: string }> } }).publish = {
			outDir: "dist",
			endpoints: [
				{ name: "staging", path: "/staging" },
				{ name: "prod", path: "/prod" },
			],
		};

		commands["publish"]({ "dry-run": true }, [], "publish", project);

		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("staging"))).toBe(true);
		expect(calls.some((m) => m.includes("prod"))).toBe(true);
	});
});

// ── Quality Gates Integration ───────────────────────────────────────

function makeGatedProject(gateConfig: Record<string, unknown>, publish?: { build?: string; test?: string }): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0" },
		config: {
			name: "test",
			publish,
			health: { qualityGates: gateConfig },
		},
		scripts: {},
	};
}

describe("publish with quality gates", () => {
	it("passes gates and publishes when rules succeed", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeGatedProject(
			{ enabled: true, rules: [{ metric: "tests.failed", operator: "==", value: 0 }] },
			{ build: "npm run build" },
		);

		commands["publish"]({}, [], "publish", project);

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run build");
	});

	it("blocks publish when minScore fails", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeGatedProject(
			{ enabled: true, minScore: 99 },
			{ build: "npm run build" },
		);

		expect(() => commands["publish"]({}, [], "publish", project)).toThrow("exit(1)");
		expect(sh.calls).toHaveLength(0);
	});

	it("skips gates with --skip-gates", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeGatedProject(
			{ enabled: true, minScore: 99 },
			{ build: "npm run build" },
		);

		commands["publish"]({ "skip-gates": true }, [], "publish", project);

		expect(sh.calls).toHaveLength(1);
	});

	it("skips gates when enabled is false", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeGatedProject(
			{ enabled: false, minScore: 99 },
			{ build: "npm run build" },
		);

		commands["publish"]({}, [], "publish", project);

		expect(sh.calls).toHaveLength(1);
	});

	it("blocks publish:all when gates fail", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeGatedProject(
			{ enabled: true, minScore: 99 },
			{ build: "npm run build", test: "npm test" },
		);

		expect(() => commands["publish:all"]({}, [], "publish:all", project)).toThrow("exit(1)");
		expect(sh.calls).toHaveLength(0);
	});
});

describe("publish:check", () => {
	it("displays gate results", () => {
		const project = makeGatedProject({
			enabled: true,
			rules: [{ metric: "tests.failed", operator: "==", value: 0 }],
		});

		commands["publish:check"]({}, [], "publish:check", project);

		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("Quality Gates"))).toBe(true);
	});

	it("exits with 1 when gates fail", () => {
		const project = makeGatedProject({ enabled: true, minScore: 99 });

		expect(() => commands["publish:check"]({}, [], "publish:check", project)).toThrow("exit(1)");
	});

	it("logs error when no project", () => {
		commands["publish:check"]({}, [], "publish:check");

		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("No project selected"))).toBe(true);
	});
});
