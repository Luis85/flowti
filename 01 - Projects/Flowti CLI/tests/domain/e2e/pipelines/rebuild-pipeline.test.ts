import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockedFunction } from "vitest";
import type { E2EPaths } from "../../../../src/domain/e2e/e2e-paths.js";
import type { IFileSystem, IShell, IPaths, IProcess } from "../../../../src/infrastructure/types.js";
import type { PipelineStep } from "../../../../src/infrastructure/pipeline/pipeline-types.js";

vi.mock("../../../../src/domain/e2e/steps/index.js", () => ({
	createTeardownStep: vi.fn(() => ({ id: "e2e:teardown", label: "Teardown", execute: vi.fn(() => ({ success: true })) })),
	createVitestStep: vi.fn(() => ({ id: "e2e:vitest", label: "Vitest", execute: vi.fn(() => ({ success: true })) })),
	createReportStep: vi.fn(() => ({ id: "e2e:report", label: "Report", execute: vi.fn(() => ({ success: true })) })),
	createCleanupStep: vi.fn(() => ({ id: "e2e:cleanup", label: "Cleanup", execute: vi.fn(() => ({ success: true })) })),
}));

import { buildRebuildPipeline } from "../../../../src/domain/e2e/pipelines/rebuild-pipeline.js";
import { createTeardownStep, createVitestStep, createReportStep, createCleanupStep } from "../../../../src/domain/e2e/steps/index.js";

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

function createMockDeps() {
	const mockEnv: Record<string, string | undefined> = {};
	return {
		disk: {} as IFileSystem,
		shell: {} as IShell,
		paths: {} as IPaths,
		proc: { env: () => mockEnv, exit: vi.fn(), argv: vi.fn(() => []), cwd: vi.fn(() => "/mock") } as unknown as IProcess,
		log: vi.fn() as (msg: string) => void,
		env: mockEnv,
	};
}

describe("buildRebuildPipeline", () => {
	let mockDeps: ReturnType<typeof createMockDeps>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDeps = createMockDeps();
	});

	it("returns exactly 6 steps", () => {
		const steps = buildRebuildPipeline(mockE2e, mockDeps);
		expect(steps).toHaveLength(6);
	});

	it("steps are in correct order", () => {
		const steps = buildRebuildPipeline(mockE2e, mockDeps);
		expect(steps.map((s) => s.id)).toEqual([
			"e2e:teardown",
			"e2e:rebuild-env",
			"e2e:vitest",
			"e2e:report",
			"e2e:cleanup",
			"e2e:rebuild-env-cleanup",
		]);
	});

	it("rebuild-env step sets environment variables", () => {
		const steps = buildRebuildPipeline(mockE2e, mockDeps);
		const envStep = steps.find((s) => s.id === "e2e:rebuild-env") as PipelineStep;

		envStep.execute();

		expect(mockDeps.env.E2E_JOURNEY).toBe("prerequisites,installer");
		expect(mockDeps.env.E2E_RUN_PREREQUISITES).toBe("true");
		expect(mockDeps.env.E2E_RUN_INSTALLER).toBe("true");
	});

	it("rebuild-env-cleanup step deletes environment variables", () => {
		const steps = buildRebuildPipeline(mockE2e, mockDeps);
		const envStep = steps.find((s) => s.id === "e2e:rebuild-env") as PipelineStep;
		const cleanupStep = steps.find((s) => s.id === "e2e:rebuild-env-cleanup") as PipelineStep;

		envStep.execute();
		cleanupStep.execute();

		expect(mockDeps.env.E2E_JOURNEY).toBeUndefined();
		expect(mockDeps.env.E2E_RUN_PREREQUISITES).toBeUndefined();
		expect(mockDeps.env.E2E_RUN_INSTALLER).toBeUndefined();
	});

	it("rebuild-env step returns success", () => {
		const steps = buildRebuildPipeline(mockE2e, mockDeps);
		const envStep = steps.find((s) => s.id === "e2e:rebuild-env") as PipelineStep;
		expect(envStep.execute()).toEqual({ success: true });
	});

	it("rebuild-env-cleanup step returns success", () => {
		const steps = buildRebuildPipeline(mockE2e, mockDeps);
		const cleanupStep = steps.find((s) => s.id === "e2e:rebuild-env-cleanup") as PipelineStep;
		expect(cleanupStep.execute()).toEqual({ success: true });
	});

	it("calls step factories with correct arguments", () => {
		buildRebuildPipeline(mockE2e, mockDeps);

		const teardown = createTeardownStep as MockedFunction<typeof createTeardownStep>;
		const vitest = createVitestStep as MockedFunction<typeof createVitestStep>;
		const report = createReportStep as MockedFunction<typeof createReportStep>;
		const cleanup = createCleanupStep as MockedFunction<typeof createCleanupStep>;

		expect(teardown).toHaveBeenCalledOnce();
		expect(teardown).toHaveBeenCalledWith(mockE2e, mockDeps);

		expect(vitest).toHaveBeenCalledOnce();
		expect(vitest).toHaveBeenCalledWith(mockE2e, mockDeps);

		expect(report).toHaveBeenCalledOnce();
		expect(report).toHaveBeenCalledWith(mockE2e, mockDeps);

		expect(cleanup).toHaveBeenCalledOnce();
		expect(cleanup).toHaveBeenCalledWith(mockE2e, mockDeps);
	});
});
