import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock infrastructure before any imports
vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
		relative: (from: string, to: string) => to,
		sep: "/",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
	VAULT_ROOT: "/vault",
}));

vi.mock("../../../../src/infrastructure/proc.js", () => ({
	proc: {
		argv: () => [] as string[],
		env: () => ({}),
		cwd: () => "/cwd",
	},
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
		ms: () => 1741608000000,
	},
}));

// Mock the e2e sub-modules to prevent side effects
vi.mock("../../../../src/domain/reports/generators/e2e/e2e-report-summary.js", () => ({
	generateE2EReport: vi.fn(),
	writeJourneyOutputs: vi.fn(),
	aggregateJourneyStats: vi.fn(() => ({ total: 0, passed: 0, failed: 0, skipped: 0 })),
	computeReconciledTotals: vi.fn(() => ({ totalTests: 0, totalPassed: 0, totalFailed: 0, totalSkipped: 0, totalDev: 0 })),
	cleanupResults: vi.fn(),
}));

vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

vi.mock("../../../../src/domain/review/e2e-paths.js", () => ({
	resolveE2EPaths: vi.fn(() => ({
		e2eDir: "/e2e",
		resultsDir: "/results",
		reportsDir: "/reports",
		outputDir: "/output",
	})),
}));

vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(() => null),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("e2e-report entry point", () => {
	it("exports initE2EReportPaths function", async () => {
		const mod = await import("../../../../src/domain/reports/generators/e2e-report.js");
		expect(mod.initE2EReportPaths).toBeDefined();
		expect(typeof mod.initE2EReportPaths).toBe("function");
	}, 30_000);

	it("re-exports utility functions", async () => {
		const mod = await import("../../../../src/domain/reports/generators/e2e-report.js");
		// Check some re-exported functions exist
		expect(mod.resolveMode).toBeDefined();
		expect(mod.formatDuration).toBeDefined();
		expect(mod.statusCallout).toBeDefined();
	});

	it("re-exports summary functions", async () => {
		const mod = await import("../../../../src/domain/reports/generators/e2e-report.js");
		expect(mod.generateE2EReport).toBeDefined();
	});

	it("initE2EReportPaths sets paths without error", async () => {
		const { disk } = await import("../../../../src/infrastructure/filesystem.js");
		const { paths } = await import("../../../../src/infrastructure/paths.js");
		const { proc } = await import("../../../../src/infrastructure/proc.js");
		const mod = await import("../../../../src/domain/reports/generators/e2e-report.js");
		expect(() => mod.initE2EReportPaths("/test-root", "/mock/vault", { disk, paths, proc })).not.toThrow();
	});
});
