import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "",
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), statSync: vi.fn(() => ({ isDirectory: () => true })) },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/") },
}));
// Inline shell mock: uses custom defaults (exitCode: 1) and per-test vi.mocked() overrides.
// Cannot use mockShellPreset() — see tests/mocks/mock-presets.ts for the standard factory.
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { runSilent: vi.fn(() => null), runCaptureStatus: vi.fn(() => ({ exitCode: 1, stdout: "" })) },
}));
vi.mock("../../../src/infrastructure/fs.js", () => ({
	countFiles: vi.fn(() => 0),
}));
vi.mock("../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(() => ({})),
}));
vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn(() => "text"),
	printOutput: vi.fn(),
}));

import { collectHealth, type HealthSnapshot } from "../../../src/domain/health/health.js";
import { displayHealth } from "../../../src/ui/displays/health-display.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { countFiles } from "../../../src/infrastructure/fs.js";
import { parseFrontmatterContent } from "../../../src/infrastructure/frontmatter.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

const mockDisk = vi.mocked(disk);
const mockShell = vi.mocked(shell);
const mockCountFiles = vi.mocked(countFiles);
const mockParseFM = vi.mocked(parseFrontmatterContent);
const mockLog = vi.mocked(log);

const healthDeps = { disk, paths, shell } as const;

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/project",
		config: { name: "test-project" },
		pkg: { version: "1.0.0" },
		scripts: {},
		...overrides,
	} as ProjectContext;
}

const fullSnapshot: HealthSnapshot = {
	name: "my-app",
	source: { files: 120, testFiles: 60 },
	tests: { total: 500, passed: 500, failed: 0, suites: 40 },
	coverage: { lines: 92.5, branches: 85.3, functions: 95.0 },
	build: { success: true, durationMs: 2400 },
	lint: { errors: 0, warnings: 0 },
	git: { branch: "main", status: "clean" },
	security: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
	components: 12,
};

const emptySnapshot: HealthSnapshot = {
	name: "empty-project",
	source: null,
	tests: null,
	coverage: null,
	build: null,
	lint: null,
	git: null,
	security: null,
	components: 0,
};

beforeEach(() => {
	vi.clearAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
	mockDisk.readdirSync.mockReturnValue([]);
	mockDisk.readFileSync.mockReturnValue("");
	mockShell.runSilent.mockReturnValue(null);
	mockCountFiles.mockReturnValue(0);
	mockParseFM.mockReturnValue(null);
});

// ── displayHealth ────────────────────────────────────────────────────

describe("displayHealth", () => {
	it("renders all sections when snapshot is fully populated", () => {
		displayHealth(fullSnapshot);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg ?? ""));
		expect(calls.some((m) => m.includes("my-app"))).toBe(true);
		expect(calls.some((m) => m.includes("Source"))).toBe(true);
		expect(calls.some((m) => m.includes("Tests"))).toBe(true);
		expect(calls.some((m) => m.includes("Coverage"))).toBe(true);
		expect(calls.some((m) => m.includes("Build"))).toBe(true);
		expect(calls.some((m) => m.includes("Lint"))).toBe(true);
		expect(calls.some((m) => m.includes("Git"))).toBe(true);
		expect(calls.some((m) => m.includes("Summary:"))).toBe(true);
	});

	it("shows 'No report data found' when all metric sections are null", () => {
		displayHealth(emptySnapshot);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg ?? ""));
		expect(calls.some((m) => m.includes("No report data found"))).toBe(true);
	});

	it("shows failed count when tests have failures", () => {
		const snapshot: HealthSnapshot = {
			...fullSnapshot,
			tests: { total: 200, passed: 185, failed: 15, suites: 20 },
		};
		displayHealth(snapshot);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg ?? ""));
		expect(calls.some((m) => m.includes("Failed:"))).toBe(true);
		expect(calls.some((m) => m.includes("15"))).toBe(true);
	});

	it("shows green coverage indicators for high percentages", () => {
		displayHealth(fullSnapshot);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg ?? ""));
		expect(calls.some((m) => m.includes("92.5%"))).toBe(true);
		expect(calls.some((m) => m.includes("95.0%"))).toBe(true);
	});

	it("shows dirty status when git is dirty", () => {
		const snapshot: HealthSnapshot = {
			...fullSnapshot,
			git: { branch: "feature/wip", status: "dirty" },
		};
		displayHealth(snapshot);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg ?? ""));
		expect(calls.some((m) => m.includes("dirty"))).toBe(true);
		expect(calls.some((m) => m.includes("feature/wip"))).toBe(true);
	});

	it("builds correct summary indicators for each metric", () => {
		displayHealth(fullSnapshot);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg ?? ""));
		const summaryLine = calls.find((m) => m.includes("Summary:"));
		expect(summaryLine).toBeDefined();
		// All indicators should be present for a full snapshot
		expect(summaryLine).toContain("Tests");
		expect(summaryLine).toContain("Coverage");
		expect(summaryLine).toContain("Build");
		expect(summaryLine).toContain("Lint");
		expect(summaryLine).toContain("Git");
	});
});

// ── collectHealth ────────────────────────────────────────────────────

describe("collectHealth", () => {
	it("returns null sections when no report files exist", () => {
		const h = collectHealth(healthDeps, makeCtx());
		expect(h.tests).toBeNull();
		expect(h.coverage).toBeNull();
		expect(h.build).toBeNull();
		expect(h.lint).toBeNull();
		expect(h.source).toBeNull();
		expect(h.git).toBeNull();
	});

	it("returns source metrics when src dir exists", () => {
		mockDisk.existsSync.mockImplementation((p) => String(p).includes("src"));
		mockCountFiles.mockReturnValue(75);

		const h = collectHealth(healthDeps, makeCtx());
		expect(h.source).toBeDefined();
		expect(h.source!.files).toBe(75);
		expect(mockCountFiles).toHaveBeenCalled();
	});

	it("returns test metrics from Test Report frontmatter", () => {
		mockDisk.existsSync.mockImplementation((p) => String(p).includes("Test Report"));
		mockParseFM.mockReturnValue({ total: 350, passed: 340, failed: 10, suites: 28 });

		const h = collectHealth(healthDeps, makeCtx());
		expect(h.tests).toEqual({ total: 350, passed: 340, failed: 10, suites: 28 });
	});

	it("returns components count from components/ directory", () => {
		mockDisk.existsSync.mockImplementation((p) => String(p).includes("components"));
		mockDisk.readdirSync.mockReturnValue([
			"button", "card", "modal", ".storybook",
		] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.statSync).mockReturnValue({ isDirectory: () => true } as ReturnType<typeof disk.statSync>);

		const h = collectHealth(healthDeps, makeCtx());
		expect(h.components).toBe(3);
	});
});
