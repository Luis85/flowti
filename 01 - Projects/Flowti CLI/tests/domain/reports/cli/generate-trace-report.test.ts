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
	PLUGIN_ROOT: "/plugin",
	VAULT_ROOT: "/vault",
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
vi.mock("../../../../src/domain/reports/generators/trace-report.js", () => ({
	scanDir: vi.fn(() => []),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { scanDir } from "../../../../src/domain/reports/generators/trace-report.js";
import { generateTraceReport } from "../../../../src/domain/reports/cli/generate-trace-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateTraceReport", () => {
	it("returns success with 100% coverage when no documents found", () => {
		vi.mocked(scanDir).mockReturnValue([]);

		const result = generateTraceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics).toEqual(expect.objectContaining({
			documents_scanned: 0,
			gaps_found: 0,
			coverage_pct: 100,
		}));
	});

	it("returns success with gaps when inbox items lack parent", () => {
		vi.mocked(scanDir).mockImplementation((dir, docType) => {
			if (docType === "inbox") {
				return [{ id: "inbox-item-1", type: "inbox", frontmatter: { stage: "in-progress" } }];
			}
			return [];
		});

		const result = generateTraceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics).toEqual(expect.objectContaining({
			gaps_found: expect.any(Number),
		}));
		const gaps = result.metrics?.["gaps_found"] as number;
		expect(gaps).toBeGreaterThan(0);
	});

	it("returns success with gaps for delivered PBI without cycle", () => {
		vi.mocked(scanDir).mockImplementation((_dir, docType) => {
			if (docType === "pbi") {
				return [
					{
						id: "PBI-001",
						type: "pbi",
						frontmatter: { stage: "delivered", feature: "some-feature" },
					},
				];
			}
			return [];
		});

		const result = generateTraceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		const gapsFound = result.metrics?.["gaps_found"] as number;
		expect(gapsFound).toBeGreaterThan(0);
	});

	it("returns success with no warnings when all docs have complete traceability", () => {
		vi.mocked(scanDir).mockImplementation((_dir, docType) => {
			if (docType === "pbi") {
				return [
					{
						id: "PBI-001",
						type: "pbi",
						frontmatter: { stage: "delivered", delivered_in: "Cycle-10", feature: "some-feature" },
					},
				];
			}
			return [];
		});

		const result = generateTraceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.warnings).toBeUndefined();
	});

	it("returns warnings array when gaps found", () => {
		vi.mocked(scanDir).mockImplementation((_dir, docType) => {
			if (docType === "inbox") {
				return [{ id: "inbox-item-1", type: "inbox", frontmatter: { stage: "in-progress" } }];
			}
			return [];
		});

		const result = generateTraceReport("/project", mockDeps);

		expect(result.warnings).toBeDefined();
		expect(result.warnings!.length).toBeGreaterThan(0);
		expect(result.warnings![0]).toMatch(/gap/i);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(scanDir).mockReturnValue([]);

		const logFn = vi.fn();
		const ctx = {
			log: logFn,
			projectPath: "/project",
			getResults: () => [],
			pushResult: vi.fn(),
			getStepResult: vi.fn(),
			setCommandOutput: vi.fn(),
			getCommandOutput: vi.fn(),
			setStepData: vi.fn(),
			getStepData: vi.fn(),
		};

		generateTraceReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
