import { describe, it, expect, vi } from "vitest";

// Mock all infrastructure dependencies used by pipeline builders
vi.mock("../../../../src/infrastructure/proc.js", () => ({
	proc: { env: () => ({}), exit: vi.fn(), cwd: () => "/mock/cwd", argv: () => [] },
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	PLUGIN_ROOT: "/mock/vault/Development/flowti",
}));

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readdirSync: vi.fn(() => []), readFileSync: vi.fn(() => "{}"), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...a: string[]) => a.join("/"), resolve: (...a: string[]) => a.join("/"), basename: (p: string) => p.split("/").pop(), dirname: (p: string) => p.split("/").slice(0, -1).join("/") },
}));

vi.mock("../../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(() => null), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ output: "", exitCode: 0 })) },
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../src/infrastructure/input.js", () => ({ input: { ask: vi.fn(), askYesNo: vi.fn() } }));
vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({ parseFrontmatterContent: vi.fn(() => ({})) }));

vi.mock("../../../../src/ui/e2e/e2e-formatters.js", () => ({
	printPrerequisites: vi.fn(), printSessionBanner: vi.fn(), printMainMenu: vi.fn(),
	printResultBanner: vi.fn(), printIncrementMenu: vi.fn(), printSessionSummary: vi.fn(),
	printJourneyTable: vi.fn(), printIncrementSummary: vi.fn(), printPublishSummary: vi.fn(),
}));

vi.mock("../../../../src/domain/e2e/e2e-helpers.js", () => ({ yamlStr: (s: string) => s }));

import { buildSessionPipeline } from "../../../../src/domain/e2e/pipelines/session-pipeline.js";
import { buildIncrementPipeline } from "../../../../src/domain/e2e/pipelines/increment-pipeline.js";
import { buildPublishPipeline } from "../../../../src/domain/e2e/pipelines/publish-pipeline.js";
import { buildRebuildPipeline } from "../../../../src/domain/e2e/pipelines/rebuild-pipeline.js";
import { buildSuitePipeline } from "../../../../src/domain/e2e/pipelines/suite-pipeline.js";
import type { E2EPaths } from "../../../../src/domain/e2e/e2e-paths.js";
import type { SessionConfig, PrerequisiteResults } from "../../../../src/domain/e2e/e2e-types.js";

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

const mockConfig: SessionConfig = {
	sessionName: "test-session",
	selectedSlugs: ["login"],
	includeInstaller: false,
	includePrerequisites: false,
	stepFilter: {},
};

const mockPrereqs: PrerequisiteResults = {
	vaultExists: true, artifactsPresent: true, missingArtifacts: [],
	cliResponsive: true, vaultInstalled: true, testDataPresent: true,
};

// ── Session pipeline ────────────────────────────────────────────────

describe("buildSessionPipeline", () => {
	it("returns 6 steps in correct order", () => {
		const steps = buildSessionPipeline(mockE2e, {
			config: mockConfig,
			entries: [],
			prereqResults: mockPrereqs,
			startTime: Date.now(),
		});

		expect(steps).toHaveLength(6);
		expect(steps.map((s) => s.id)).toEqual([
			"e2e:env-config",
			"e2e:vitest",
			"e2e:report",
			"e2e:session-note",
			"e2e:cleanup",
			"e2e:env-cleanup",
		]);
	});

	it("all steps have labels", () => {
		const steps = buildSessionPipeline(mockE2e, {
			config: mockConfig, entries: [], prereqResults: mockPrereqs, startTime: Date.now(),
		});
		for (const step of steps) {
			expect(step.label).toBeTruthy();
		}
	});
});

// ── Increment pipeline ──────────────────────────────────────────────

describe("buildIncrementPipeline", () => {
	it("returns 2 steps: teardown → increment build", () => {
		const steps = buildIncrementPipeline(mockE2e);
		expect(steps).toHaveLength(2);
		expect(steps[0].id).toBe("e2e:teardown");
		expect(steps[1].id).toBe("e2e:increment-build");
	});
});

// ── Publish pipeline ────────────────────────────────────────────────

describe("buildPublishPipeline", () => {
	it("returns 1 step: publish", () => {
		const steps = buildPublishPipeline(mockE2e);
		expect(steps).toHaveLength(1);
		expect(steps[0].id).toBe("e2e:publish");
	});
});

// ── Rebuild pipeline ────────────────────────────────────────────────

describe("buildRebuildPipeline", () => {
	it("returns 6 steps in correct order", () => {
		const steps = buildRebuildPipeline(mockE2e);
		expect(steps).toHaveLength(6);
		expect(steps.map((s) => s.id)).toEqual([
			"e2e:teardown",
			"e2e:rebuild-env",
			"e2e:vitest",
			"e2e:report",
			"e2e:cleanup",
			"e2e:rebuild-env-cleanup",
		]);
	});
});

// ── Suite pipeline ──────────────────────────────────────────────────

describe("buildSuitePipeline", () => {
	it("returns 2 steps: vitest → report", () => {
		const steps = buildSuitePipeline(mockE2e);
		expect(steps).toHaveLength(2);
		expect(steps[0].id).toBe("e2e:vitest");
		expect(steps[1].id).toBe("e2e:report");
	});
});

// ── Cross-pipeline consistency ──────────────────────────────────────

describe("pipeline step ID uniqueness", () => {
	it("session pipeline has unique step IDs", () => {
		const steps = buildSessionPipeline(mockE2e, {
			config: mockConfig, entries: [], prereqResults: mockPrereqs, startTime: Date.now(),
		});
		const ids = steps.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("rebuild pipeline has unique step IDs", () => {
		const steps = buildRebuildPipeline(mockE2e);
		const ids = steps.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
