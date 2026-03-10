import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
		readdirSync: vi.fn(() => []),
		readFileSync: vi.fn(() => "{}"),
		existsSync: vi.fn(() => false),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/domain/e2e/e2e-helpers.js", () => ({
	yamlStr: (s: string) => s,
}));

vi.mock("../../../src/domain/e2e/e2e-session.js", () => ({
	loadJourneyEntries: vi.fn(() => [
		{ slug: "login", name: "Login Flow", chapter: "1", steps: 5, description: "" },
		{ slug: "setup", name: "Setup", chapter: "2", steps: 3, description: "" },
	]),
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import {
	buildSessionFrontmatter,
	buildPrereqRows,
	writeSessionNote,
} from "../../../src/domain/e2e/e2e-session-note.js";
import type { SessionConfig, PrerequisiteResults, TestStats } from "../../../src/domain/e2e/e2e-types.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

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

// ── buildSessionFrontmatter ─────────────────────────────────────────

describe("buildSessionFrontmatter", () => {
	const config: SessionConfig = {
		sessionName: "test-session",
		selectedSlugs: ["login", "setup"],
		includeInstaller: true,
		includePrerequisites: false,
		stepFilter: {},
	};
	const stats: TestStats = { totalTests: 20, passed: 18, failed: 2, skipped: 0 };
	const now = new Date("2026-03-08T12:00:00Z");

	it("starts and ends with YAML delimiters", () => {
		const lines = buildSessionFrontmatter("test-session", config, stats, "passed", "10.5", now);
		expect(lines[0]).toBe("---");
		expect(lines[lines.length - 1]).toBe("---");
	});

	it("includes session metadata", () => {
		const lines = buildSessionFrontmatter("test-session", config, stats, "passed", "10.5", now);
		const text = lines.join("\n");
		expect(text).toContain("type: E2ESession");
		expect(text).toContain("session: test-session");
		expect(text).toContain("status: passed");
		expect(text).toContain("duration_s: 10.5");
	});

	it("includes test stats", () => {
		const lines = buildSessionFrontmatter("test-session", config, stats, "passed", "10.5", now);
		const text = lines.join("\n");
		expect(text).toContain("total_tests: 20");
		expect(text).toContain("passed: 18");
		expect(text).toContain("failed: 2");
	});

	it("lists selected journey slugs", () => {
		const lines = buildSessionFrontmatter("test-session", config, stats, "passed", "10.5", now);
		const text = lines.join("\n");
		expect(text).toContain("  - login");
		expect(text).toContain("  - setup");
	});

	it("includes config flags", () => {
		const lines = buildSessionFrontmatter("test-session", config, stats, "passed", "10.5", now);
		const text = lines.join("\n");
		expect(text).toContain("installer: true");
		expect(text).toContain("prerequisites: false");
	});

	it("includes e2e and session tags", () => {
		const lines = buildSessionFrontmatter("test-session", config, stats, "passed", "10.5", now);
		const text = lines.join("\n");
		expect(text).toContain("  - e2e");
		expect(text).toContain("  - session");
	});
});

// ── buildPrereqRows ─────────────────────────────────────────────────

describe("buildPrereqRows", () => {
	it("renders check marks for passing prerequisites", () => {
		const prereqs: PrerequisiteResults = {
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: true,
			testDataPresent: true,
		};
		const rows = buildPrereqRows(prereqs);
		expect(rows).toHaveLength(5);
		for (const row of rows) {
			expect(row).toContain("\u2713");
		}
	});

	it("renders cross marks for failing prerequisites", () => {
		const prereqs: PrerequisiteResults = {
			vaultExists: false,
			artifactsPresent: false,
			missingArtifacts: ["main.js"],
			cliResponsive: false,
			vaultInstalled: false,
			testDataPresent: false,
		};
		const rows = buildPrereqRows(prereqs);
		expect(rows[0]).toContain("\u2717");
		expect(rows[1]).toContain("\u2717");
		expect(rows[2]).toContain("\u2717");
	});

	it("shows special messages for optional prereqs", () => {
		const prereqs: PrerequisiteResults = {
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: false,
			testDataPresent: false,
		};
		const rows = buildPrereqRows(prereqs);
		expect(rows[3]).toContain("not yet");
		expect(rows[4]).toContain("generated during setup");
	});
});

// ── writeSessionNote ────────────────────────────────────────────────

describe("writeSessionNote", () => {
	const config: SessionConfig = {
		sessionName: "test-session",
		selectedSlugs: ["login"],
		includeInstaller: false,
		includePrerequisites: false,
		stepFilter: {},
	};
	const prereqs: PrerequisiteResults = {
		vaultExists: true, artifactsPresent: true, missingArtifacts: [],
		cliResponsive: true, vaultInstalled: true, testDataPresent: true,
	};
	const stats: TestStats = { totalTests: 10, passed: 10, failed: 0, skipped: 0 };

	it("writes note to test vault and mirrors to dev vault", () => {
		const path = writeSessionNote("test-session", config, ["Login Flow"], prereqs, stats, Date.now() - 5000, 0, mockE2e);
		expect(disk.writeFileSync).toHaveBeenCalledTimes(2);
		expect(disk.mkdirSync).toHaveBeenCalledTimes(2);
		expect(path).toContain("test-session");
	});

	it("includes success callout when exit code is 0", () => {
		writeSessionNote("test-session", config, ["Login Flow"], prereqs, stats, Date.now(), 0, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("success");
		expect(content).toContain("All tests passed");
	});

	it("includes danger callout when exit code is non-zero", () => {
		const failStats: TestStats = { totalTests: 10, passed: 8, failed: 2, skipped: 0 };
		writeSessionNote("test-session", config, ["Login Flow"], prereqs, failStats, Date.now(), 1, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("danger");
		expect(content).toContain("Some tests failed");
	});

	it("includes configuration table", () => {
		writeSessionNote("test-session", config, ["Login Flow"], prereqs, stats, Date.now(), 0, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Configuration");
		expect(content).toContain("Login Flow");
	});

	it("includes prerequisites table", () => {
		writeSessionNote("test-session", config, ["Login Flow"], prereqs, stats, Date.now(), 0, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Prerequisites");
	});

	it("includes journey table with step counts", () => {
		writeSessionNote("test-session", config, ["Login Flow"], prereqs, stats, Date.now(), 0, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Journeys");
		expect(content).toContain("Login Flow");
	});

	it("includes results table and links", () => {
		writeSessionNote("test-session", config, ["Login Flow"], prereqs, stats, Date.now(), 0, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Results");
		expect(content).toContain("## Links");
		expect(content).toContain("[[E2E Report]]");
	});
});
