import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────

vi.mock("../../../../src/infrastructure/proc.js", () => {
	const env: Record<string, string | undefined> = {};
	return { proc: { env: () => env, exit: vi.fn() } };
});

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readdirSync: vi.fn(() => []), readFileSync: vi.fn(() => "{}"), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...a: string[]) => a.join("/"), resolve: (...a: string[]) => a.join("/"), basename: (p: string) => p.split("/").pop(), dirname: (p: string) => p.split("/").slice(0, -1).join("/") },
}));

vi.mock("../../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(() => null), runCapture: vi.fn(() => "") },
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../src/infrastructure/clock.js", () => ({ clock: { now: () => new Date(), safeIso: () => "2026-01-01T00:00:00" } }));
vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({ parseFrontmatterContent: vi.fn(() => ({})) }));

vi.mock("../../../../src/ui/e2e/e2e-formatters.js", () => ({
	printPrerequisites: vi.fn(), printSessionBanner: vi.fn(), printMainMenu: vi.fn(),
	printResultBanner: vi.fn(), printIncrementMenu: vi.fn(), printSessionSummary: vi.fn(),
	printJourneyTable: vi.fn(), printIncrementSummary: vi.fn(), printPublishSummary: vi.fn(),
}));

vi.mock("../../../../src/domain/e2e/e2e-helpers.js", () => ({ yamlStr: (s: string) => s }));

// Mock domain dependencies used by steps
const mockRunVitest = vi.fn(() => 0);
vi.mock("../../../../src/domain/e2e/e2e-runner.js", () => ({
	runVitest: (...args: unknown[]) => mockRunVitest(...args),
	generateReport: vi.fn(() => "/vault-e2e/E2E Report.md"),
	openReportInObsidian: vi.fn(),
	restorePluginState: vi.fn(),
}));

vi.mock("../../../../src/domain/e2e/e2e-teardown.js", () => ({
	performTeardown: vi.fn(async () => {}),
}));

vi.mock("../../../../src/domain/e2e/e2e-session.js", () => ({
	configureSessionEnv: vi.fn(),
	cleanSessionEnv: vi.fn(),
	loadJourneyEntries: vi.fn(() => []),
	resolveJourneyNames: vi.fn(() => []),
}));

vi.mock("../../../../src/domain/e2e/e2e-session-note.js", () => ({
	writeSessionNote: vi.fn(() => "/vault-e2e/session-note.md"),
}));

vi.mock("../../../../src/domain/e2e/e2e-build.js", () => ({
	readTestStats: vi.fn(() => ({ totalTests: 5, passed: 5, failed: 0, skipped: 0 })),
	readBuildStats: vi.fn(() => ({ build: null, test: null, coverage: null, performance: null, cycle: null, e2e: null, traceability: null, unitTests: { totalTests: 0, passed: 0, failed: 0, skipped: 0 } })),
	quickBuildAndDeploy: vi.fn(() => 0),
}));

vi.mock("../../../../src/domain/e2e/e2e-state-reports.js", () => ({
	generateIncrementStateReport: vi.fn(),
	generatePublishStateReport: vi.fn(),
}));

import { proc } from "../../../../src/infrastructure/proc.js";
import { shell } from "../../../../src/infrastructure/shell.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { log } from "../../../../src/infrastructure/logger.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import {
	createEnvConfigStep,
	createEnvCleanupStep,
	createVitestStep,
	createReportStep,
	createSessionNoteStep,
	createTeardownStep,
	createCleanupStep,
	createQuickBuildStep,
	createIncrementBuildStep,
	createPublishStep,
} from "../../../../src/domain/e2e/steps/index.js";
import { configureSessionEnv, cleanSessionEnv } from "../../../../src/domain/e2e/e2e-session.js";
import { performTeardown } from "../../../../src/domain/e2e/e2e-teardown.js";
import type { E2EPaths } from "../../../../src/domain/e2e/e2e-paths.js";
import type { PipelineContext } from "../../../../src/infrastructure/pipeline/pipeline-types.js";

const mockDeps = { disk, shell, paths, proc, clock, log } as const;

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

function createMockContext(): PipelineContext {
	const data = new Map<string, unknown>();
	return {
		projectPath: "/project",
		startTime: Date.now(),
		getStepData: (id: string) => data.get(id),
		setStepData: (id: string, value: unknown) => data.set(id, value),
		log: () => {},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Env steps ───────────────────────────────────────────────────────

describe("createEnvConfigStep", () => {
	it("has correct id and label", () => {
		const step = createEnvConfigStep({ sessionName: "s", selectedSlugs: [], includeInstaller: false, includePrerequisites: false, stepFilter: {} }, mockDeps);
		expect(step.id).toBe("e2e:env-config");
		expect(step.label).toBe("Configure Environment");
	});

	it("calls configureSessionEnv and returns success", () => {
		const config = { sessionName: "s", selectedSlugs: ["a"], includeInstaller: false, includePrerequisites: false, stepFilter: {} };
		const step = createEnvConfigStep(config, mockDeps);
		const output = step.execute(createMockContext());
		expect(output).toEqual({ success: true });
		expect(configureSessionEnv).toHaveBeenCalledWith(config, mockDeps);
	});
});

describe("createEnvCleanupStep", () => {
	it("has correct id and calls cleanSessionEnv", () => {
		const step = createEnvCleanupStep(mockDeps);
		expect(step.id).toBe("e2e:env-cleanup");
		const output = step.execute(createMockContext());
		expect(output).toEqual({ success: true });
		expect(cleanSessionEnv).toHaveBeenCalled();
	});
});

// ── Vitest step ─────────────────────────────────────────────────────

describe("createVitestStep", () => {
	it("has correct id and label", () => {
		const step = createVitestStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:vitest");
		expect(step.label).toBe("Vitest E2E Suite");
	});

	it("returns success when vitest passes", () => {
		mockRunVitest.mockReturnValue(0);
		const ctx = createMockContext();
		const step = createVitestStep(mockE2e, mockDeps);
		const output = step.execute(ctx);
		expect(output.success).toBe(true);
		expect(output.data).toEqual({ exitCode: 0 });
	});

	it("returns failure when vitest fails", () => {
		mockRunVitest.mockReturnValue(1);
		const ctx = createMockContext();
		const step = createVitestStep(mockE2e, mockDeps);
		const output = step.execute(ctx);
		expect(output.success).toBe(false);
	});

	it("stores exit code in pipeline context", () => {
		mockRunVitest.mockReturnValue(0);
		const ctx = createMockContext();
		const step = createVitestStep(mockE2e, mockDeps);
		step.execute(ctx);
		expect(ctx.getStepData("e2e:vitest")).toEqual({ exitCode: 0 });
	});
});

// ── Report step ─────────────────────────────────────────────────────

describe("createReportStep", () => {
	it("has correct id and depends on vitest", () => {
		const step = createReportStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:report");
		expect(step.dependencies).toContain("e2e:vitest");
	});

	it("returns success with report path", () => {
		const step = createReportStep(mockE2e, mockDeps);
		const output = step.execute(createMockContext());
		expect(output.success).toBe(true);
		expect(output.outputPath).toBe("/vault-e2e/E2E Report.md");
	});
});

// ── Session note step ───────────────────────────────────────────────

describe("createSessionNoteStep", () => {
	it("has correct id and depends on vitest", () => {
		const step = createSessionNoteStep(mockE2e, {
			config: { sessionName: "s", selectedSlugs: ["a"], includeInstaller: false, includePrerequisites: false, stepFilter: {} },
			entries: [],
			prereqResults: { vaultExists: true, artifactsPresent: true, missingArtifacts: [], cliResponsive: true, vaultInstalled: true, testDataPresent: true },
			startTime: Date.now(),
		});
		expect(step.id).toBe("e2e:session-note");
		expect(step.dependencies).toContain("e2e:vitest");
	});

	it("reads exit code from vitest step data", () => {
		const ctx = createMockContext();
		ctx.setStepData("e2e:vitest", { exitCode: 0 });

		const step = createSessionNoteStep(mockE2e, {
			config: { sessionName: "s", selectedSlugs: [], includeInstaller: false, includePrerequisites: false, stepFilter: {} },
			entries: [], prereqResults: { vaultExists: true, artifactsPresent: true, missingArtifacts: [], cliResponsive: true, vaultInstalled: true, testDataPresent: true },
			startTime: Date.now(),
		});

		const output = step.execute(ctx);
		expect(output.success).toBe(true);
		expect(output.outputPath).toBe("/vault-e2e/session-note.md");
	});
});

// ── Teardown step ───────────────────────────────────────────────────

describe("createTeardownStep", () => {
	it("has correct id and label", () => {
		const step = createTeardownStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:teardown");
		expect(step.label).toBe("Teardown Vault");
	});

	it("calls performTeardown and returns success", async () => {
		const step = createTeardownStep(mockE2e, mockDeps);
		const output = await step.execute(createMockContext());
		expect(output).toEqual({ success: true });
		expect(performTeardown).toHaveBeenCalledWith(mockE2e, mockDeps);
	});
});

// ── Cleanup step ────────────────────────────────────────────────────

describe("createCleanupStep", () => {
	it("has correct id and returns success", () => {
		const step = createCleanupStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:cleanup");
		const output = step.execute(createMockContext());
		expect(output).toEqual({ success: true });
	});
});

// ── Build steps ─────────────────────────────────────────────────────

describe("createQuickBuildStep", () => {
	it("has correct id", () => {
		const step = createQuickBuildStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:quick-build");
	});

	it("returns success when build succeeds", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		const step = createQuickBuildStep(mockE2e, mockDeps);
		const output = step.execute(createMockContext());
		expect(output.success).toBe(true);
	});
});

describe("createIncrementBuildStep", () => {
	it("has correct id and depends on teardown", () => {
		const step = createIncrementBuildStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:increment-build");
		expect(step.dependencies).toContain("e2e:teardown");
	});

	it("returns success when build passes", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		const ctx = createMockContext();
		const step = createIncrementBuildStep(mockE2e, mockDeps);
		const output = step.execute(ctx);
		expect(output.success).toBe(true);
	});

	it("returns failure when build fails", () => {
		vi.mocked(shell.run).mockReturnValue(1);
		const ctx = createMockContext();
		const step = createIncrementBuildStep(mockE2e, mockDeps);
		const output = step.execute(ctx);
		expect(output.success).toBe(false);
	});

	it("stores data in pipeline context", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		const ctx = createMockContext();
		const step = createIncrementBuildStep(mockE2e, mockDeps);
		step.execute(ctx);
		const data = ctx.getStepData("e2e:increment-build") as Record<string, unknown>;
		expect(data.exitCode).toBe(0);
		expect(data.duration).toBeDefined();
	});
});

describe("createPublishStep", () => {
	it("has correct id", () => {
		const step = createPublishStep(mockE2e, mockDeps);
		expect(step.id).toBe("e2e:publish");
	});

	it("stores data in pipeline context", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		const ctx = createMockContext();
		const step = createPublishStep(mockE2e, mockDeps);
		step.execute(ctx);
		const data = ctx.getStepData("e2e:publish") as Record<string, unknown>;
		expect(data.exitCode).toBe(0);
	});
});
