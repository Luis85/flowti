import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
	},
}));

// Inline shell mock: per-test vi.mocked(shell.runSilent) overrides require vi.fn().
// See tests/mocks/mock-presets.ts for the standard mockShellPreset() factory.
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { runSilent: vi.fn(() => null) },
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

const mockExit = vi.fn();
vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: mockExit },
}));

// Must mock the re-export to avoid importing real UI module
vi.mock("../../../src/ui/e2e/e2e-formatters.js", () => ({
	printPrerequisites: vi.fn(),
	printSessionBanner: vi.fn(),
	printMainMenu: vi.fn(),
	printResultBanner: vi.fn(),
	printIncrementMenu: vi.fn(),
	printSessionSummary: vi.fn(),
	printJourneyTable: vi.fn(),
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { log as logFn } from "../../../src/infrastructure/logger.js";
import { proc } from "../../../src/infrastructure/proc.js";
import { checkPrerequisites, validatePrerequisites, collapseFileExplorer } from "../../../src/domain/e2e/e2e-prerequisites.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";
import type { PrerequisiteResults } from "../../../src/domain/e2e/e2e-types.js";

const deps = { disk, paths, shell, log: logFn, proc } as any;

const mockE2e: E2EPaths = {
	projectRoot: "/project",
	pluginId: "flowti-ibde",
	journeysDir: "/project/tests/e2e/journeys",
	testVault: "/vault-e2e",
	vaultName: "vault-e2e",
	pluginDir: "/vault-e2e/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault-e2e/.obsidian/plugins/flowti-ibde/data.json",
	pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
	testDataCsv: "/vault-e2e/data.csv",
	reportsDir: "/project/docs/reports",
	devRunsDir: "/project/docs/reports/e2e/runs",
	devTracesDir: "/project/docs/reports/e2e/traces",
	devJourneysDir: "/project/docs/journeys",
	vitestResults: "/project/docs/reports/e2e/e2e-results.json",
	dataJsonCandidates: [],
};

beforeEach(() => {
	vi.clearAllMocks();
});

// ── checkPrerequisites ──────────────────────────────────────────────

describe("checkPrerequisites", () => {
	it("returns all false when vault does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.vaultExists).toBe(false);
		expect(results.artifactsPresent).toBe(false);
		expect(results.cliResponsive).toBe(false);
		expect(results.vaultInstalled).toBe(false);
	});

	it("checks artifact presence when vault exists", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => {
			if (p === mockE2e.testVault) return true;
			if (p.includes("main.js")) return true;
			if (p.includes("manifest.json")) return true;
			if (p.includes("styles.css")) return true;
			return false;
		});
		vi.mocked(shell.runSilent).mockReturnValue(null);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.vaultExists).toBe(true);
		expect(results.artifactsPresent).toBe(true);
		expect(results.missingArtifacts).toHaveLength(0);
	});

	it("reports missing artifacts", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => {
			if (p === mockE2e.testVault) return true;
			if (p.includes("main.js")) return true;
			return false;
		});
		vi.mocked(shell.runSilent).mockReturnValue(null);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.artifactsPresent).toBe(false);
		expect(results.missingArtifacts).toContain("manifest.json");
		expect(results.missingArtifacts).toContain("styles.css");
	});

	it("checks CLI responsiveness via eval", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => p === mockE2e.testVault);
		vi.mocked(shell.runSilent).mockReturnValue("=> 2");

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.cliResponsive).toBe(true);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("eval"));
	});

	it("marks CLI as unresponsive when output is null", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => p === mockE2e.testVault);
		vi.mocked(shell.runSilent).mockReturnValue(null);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.cliResponsive).toBe(false);
	});

	it("checks vault installed via data.json", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => {
			if (p === mockE2e.testVault) return true;
			if (p === mockE2e.dataJsonPath) return true;
			return false;
		});
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			installer: { installed: true },
		}) as never);
		vi.mocked(shell.runSilent).mockReturnValue(null);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.vaultInstalled).toBe(true);
	});

	it("marks vault as not installed when data.json is malformed", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => {
			if (p === mockE2e.testVault) return true;
			if (p === mockE2e.dataJsonPath) return true;
			return false;
		});
		vi.mocked(disk.readFileSync).mockReturnValue("not json" as never);
		vi.mocked(shell.runSilent).mockReturnValue(null);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.vaultInstalled).toBe(false);
	});

	it("checks test data presence", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => p === mockE2e.testDataCsv);

		const results = checkPrerequisites(mockE2e, deps);
		expect(results.testDataPresent).toBe(true);
	});
});

// ── validatePrerequisites ───────────────────────────────────────────

describe("validatePrerequisites", () => {
	it("exits when vault does not exist", () => {
		const prereqs: PrerequisiteResults = {
			vaultExists: false, artifactsPresent: false, missingArtifacts: [],
			cliResponsive: false, vaultInstalled: false, testDataPresent: false,
		};
		validatePrerequisites(prereqs, deps);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("exits when CLI is not responsive", () => {
		const prereqs: PrerequisiteResults = {
			vaultExists: true, artifactsPresent: true, missingArtifacts: [],
			cliResponsive: false, vaultInstalled: false, testDataPresent: false,
		};
		validatePrerequisites(prereqs, deps);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("does not exit when vault exists and CLI is responsive", () => {
		const prereqs: PrerequisiteResults = {
			vaultExists: true, artifactsPresent: true, missingArtifacts: [],
			cliResponsive: true, vaultInstalled: false, testDataPresent: false,
		};
		validatePrerequisites(prereqs, deps);
		expect(mockExit).not.toHaveBeenCalled();
	});
});

// ── collapseFileExplorer ────────────────────────────────────────────

describe("collapseFileExplorer", () => {
	it("calls obsidian CLI eval to collapse folders", () => {
		vi.mocked(shell.runSilent).mockReturnValue("ok");
		collapseFileExplorer(mockE2e, deps);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("vault-e2e"));
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("file-explorer"));
	});

	it("handles null response gracefully", () => {
		vi.mocked(shell.runSilent).mockReturnValue(null);
		expect(() => collapseFileExplorer(mockE2e, deps)).not.toThrow();
	});
});
