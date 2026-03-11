import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/mock/plugin",
	VAULT_ROOT: "/mock/vault",
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/proc.js", () => {
	const env: Record<string, string | undefined> = {};
	return { proc: { env: () => env, exit: vi.fn() } };
});

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

vi.mock("../../../src/domain/e2e/e2e-runner.js", () => ({
	runVitest: vi.fn(() => 0),
	generateReportAndOpen: vi.fn(),
}));

vi.mock("../../../src/ui/e2e/e2e-interactive.js", () => ({
	interactiveSession: vi.fn(async () => {}),
}));

vi.mock("../../../src/infrastructure/pipeline/pipeline-runner.js", () => ({
	runPipeline: vi.fn(async () => ({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 })),
}));

vi.mock("../../../src/domain/e2e/pipelines/suite-pipeline.js", () => ({
	buildSuitePipeline: vi.fn(() => []),
}));

import { proc } from "../../../src/infrastructure/proc.js";
import { runPipeline } from "../../../src/infrastructure/pipeline/pipeline-runner.js";
import { interactiveSession } from "../../../src/ui/e2e/e2e-interactive.js";
import { initE2EPaths, getE2EPaths, startInteractiveSession, runE2ESuite } from "../../../src/domain/e2e/e2e-service.js";

describe("E2EService", () => {
	describe("initE2EPaths", () => {
		it("initializes and returns E2E paths", () => {
			const e2e = initE2EPaths("/my/project");
			expect(e2e.projectRoot).toBe("/my/project");
			expect(e2e.pluginId).toBe("flowti-ibde");
		});

		it("uses review config when provided", () => {
			const e2e = initE2EPaths("/my/project", { pluginId: "custom-plugin" });
			expect(e2e.pluginId).toBe("custom-plugin");
		});
	});

	describe("getE2EPaths", () => {
		it("returns initialized paths after init", () => {
			initE2EPaths("/project-a");
			const e2e = getE2EPaths();
			expect(e2e.projectRoot).toBe("/project-a");
		});

		it("returns same paths on repeated calls", () => {
			initE2EPaths("/project-b");
			const e2e1 = getE2EPaths();
			const e2e2 = getE2EPaths();
			expect(e2e1).toBe(e2e2);
		});
	});

	describe("startInteractiveSession", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("calls interactiveSession with provided e2e paths", async () => {
			const e2e = initE2EPaths("/my/project");
			await startInteractiveSession(e2e);
			expect(interactiveSession).toHaveBeenCalledWith(e2e);
		});

		it("uses default e2e paths when none provided", async () => {
			initE2EPaths("/default/project");
			await startInteractiveSession();
			expect(interactiveSession).toHaveBeenCalledWith(
				expect.objectContaining({ projectRoot: "/default/project" }),
			);
		});
	});

	describe("runE2ESuite", () => {
		beforeEach(() => {
			vi.clearAllMocks();
			const env = proc.env();
			delete env.E2E_JOURNEY;
			delete env.E2E_RUN_INSTALLER;
			delete env.E2E_RUN_PREREQUISITES;
		});

		it("sets journey filter when provided", async () => {
			const e2e = initE2EPaths("/project");
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
			await runE2ESuite("getting-started", e2e);
			expect(proc.env().E2E_JOURNEY).toBe("getting-started");
		});

		it("auto-activates installer when journey includes installer", async () => {
			const e2e = initE2EPaths("/project");
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
			proc.env().E2E_JOURNEY = "installer,getting-started";
			await runE2ESuite(undefined, e2e);
			expect(proc.env().E2E_RUN_INSTALLER).toBe("true");
		});

		it("auto-activates prerequisites when journey includes prerequisites", async () => {
			const e2e = initE2EPaths("/project");
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
			proc.env().E2E_JOURNEY = "prerequisites";
			await runE2ESuite(undefined, e2e);
			expect(proc.env().E2E_RUN_PREREQUISITES).toBe("true");
		});

		it("exits with 0 when all tests pass", async () => {
			const e2e = initE2EPaths("/project");
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 5, failed: 0, skipped: 0 });
			await runE2ESuite(undefined, e2e);
			expect(proc.exit).toHaveBeenCalledWith(0);
		});

		it("exits with 1 when tests fail", async () => {
			const e2e = initE2EPaths("/project");
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 3, failed: 2, skipped: 0 });
			await runE2ESuite(undefined, e2e);
			expect(proc.exit).toHaveBeenCalledWith(1);
		});

		it("logs journey filter message", async () => {
			const e2e = initE2EPaths("/project");
			const log = vi.fn();
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
			await runE2ESuite("getting-started", e2e, log);
			expect(log).toHaveBeenCalledWith(expect.stringContaining("getting-started"));
		});

		it("runs pipeline with E2E Suite label", async () => {
			const e2e = initE2EPaths("/project");
			vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
			await runE2ESuite(undefined, e2e);
			expect(runPipeline).toHaveBeenCalledWith(
				expect.anything(),
				"/project",
				expect.objectContaining({ label: "E2E Suite" }),
			);
		});
	});
});
