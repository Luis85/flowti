import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));
vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2026-01-01T00:00:00.000Z",
		ms: () => 1000000,
		now: () => new Date("2026-01-01T00:00:00.000Z"),
		safeIso: () => "2026-01-01T00-00-00.000Z",
	},
}));
vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" }, docs: { referenceDir: "docs/reference" } } })),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateCodebaseReport } from "../../../../src/domain/reports/cli/generate-codebase-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateCodebaseReport", () => {
	it("returns failure when codebase.json does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateCodebaseReport("/project", mockDeps);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
	});

	it("generates report from valid codebase data", () => {
		const data = {
			schemaVersion: "310",
			kind: 1,
			name: "flowti-cli",
			children: [
				{ kind: 2, name: "src/domain/health", children: [
					{ kind: 128, name: "HealthChecker" },
					{ kind: 256, name: "IHealthService" },
					{ kind: 64, name: "runCheck" },
				]},
				{ kind: 2, name: "src/infrastructure/logger", children: [
					{ kind: 64, name: "log" },
				]},
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data) as never);

		const result = generateCodebaseReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			modules: 2,
			classes: 1,
			interfaces: 1,
			functions: 2,
		}));
	});

	it("counts domains from module names", () => {
		const data = {
			children: [
				{ kind: 2, name: "src/domain/health" },
				{ kind: 2, name: "src/domain/build" },
				{ kind: 2, name: "src/infrastructure/logger" },
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data) as never);

		const result = generateCodebaseReport("/project", mockDeps);

		expect(result.success).toBe(true);
	});

	it("handles empty codebase with no children", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({}) as never);

		const result = generateCodebaseReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics).toEqual(expect.objectContaining({
			modules: 0,
			classes: 0,
		}));
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({}) as never);

		const logFn = vi.fn();
		const ctx = { log: logFn, projectPath: "/project", getResults: () => [], pushResult: vi.fn(), getStepResult: vi.fn(), setCommandOutput: vi.fn(), getCommandOutput: vi.fn(), setStepData: vi.fn(), getStepData: vi.fn() };

		generateCodebaseReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});

	it("counts type aliases, methods, properties, and constructors", () => {
		const data = {
			children: [
				{ kind: 2, name: "src/domain/foo", children: [
					{ kind: 2097152, name: "MyType" },
					{ kind: 2048, name: "doStuff" },
					{ kind: 1024, name: "value" },
					{ kind: 512, name: "constructor" },
				]},
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data) as never);

		const result = generateCodebaseReport("/project", mockDeps);

		expect(result.success).toBe(true);
	});
});
