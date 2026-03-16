/**
 * review.controller.test.ts — Tests for review commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		rmSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));
vi.mock("../../src/infrastructure/test-vault.js", () => ({
	resolveTestVaultRoot: vi.fn((name: string, root: string) => `${root}/../${name}`),
}));

// Mock domain modules
vi.mock("../../src/domain/review/change-analysis.js", () => ({
	analyzeWorkingTree: vi.fn(() => ({
		affectedDomains: ["infrastructure"],
		suggestedActions: ["Run unit tests"],
		changedFiles: [{ path: "src/main.ts", status: "M" }],
		summary: "1 file changed",
	})),
	analyzeBranchDiff: vi.fn(() => ({
		affectedDomains: ["domain"],
		suggestedActions: ["Run full test suite"],
		changedFiles: [{ path: "src/domain/foo.ts", status: "A" }],
		summary: "1 file added",
	})),
}));
vi.mock("../../src/domain/review/run-e2e.js", () => ({
	startInteractiveSession: vi.fn(),
	runE2ESuite: vi.fn(),
}));
vi.mock("../../src/ui/e2e/e2e-interactive.js", () => ({
	interactiveSession: vi.fn(),
}));
vi.mock("../../src/domain/review/traceability.js", () => ({
	buildTraceabilityMatrix: vi.fn(() => []),
	detectGaps: vi.fn(() => []),
	validateTraceabilityLinks: vi.fn(() => ({ valid: true, errors: [] })),
	coverageByCategory: vi.fn(() => ({})),
}));
vi.mock("../../src/domain/review/quality-gates.js", () => ({
	evaluateGates: vi.fn(() => ({ passed: true, results: [] })),
}));
vi.mock("../../src/domain/review/evidence.js", () => ({
	listRuns: vi.fn(() => [{ id: "run-1", date: "2026-01-01", status: "pass" }]),
}));
vi.mock("../../src/domain/e2e/journey/journey-loader.js", () => ({
	loadAllJourneys: vi.fn(() => []),
}));
vi.mock("../../src/domain/requirements/requirement-store.js", () => ({
	requirementStore: { list: vi.fn(() => []), updateField: vi.fn(), resolveDir: vi.fn(() => "") },
	useCaseStore: { list: vi.fn(() => []), resolveDir: vi.fn(() => "") },
	userStoryStore: { list: vi.fn(() => []), resolveDir: vi.fn(() => "") },
}));
vi.mock("../../src/ui/displays/review-display.js", () => ({
	renderChangeAnalysis: vi.fn(),
	renderReviewClean: vi.fn(),
	renderPipelineResult: vi.fn(),
	renderGateResult: vi.fn(),
	renderTraceabilityMatrix: vi.fn(),
	renderCoverageReport: vi.fn(),
	renderEvidenceList: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderShellCommand: vi.fn(),
	renderInteractiveOnly: vi.fn(),
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/review.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { shell } from "../../src/infrastructure/shell.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";
import { renderPipelineResult, renderGateResult, renderTraceabilityMatrix, renderCoverageReport, renderEvidenceList } from "../../src/ui/displays/review-display.js";
import { analyzeWorkingTree, analyzeBranchDiff } from "../../src/domain/review/change-analysis.js";
import { buildTraceabilityMatrix, detectGaps, validateTraceabilityLinks, coverageByCategory } from "../../src/domain/review/traceability.js";
import { evaluateGates } from "../../src/domain/review/quality-gates.js";
import { listRuns } from "../../src/domain/review/evidence.js";
import { loadAllJourneys } from "../../src/domain/e2e/journey/journey-loader.js";
import { requirementStore, useCaseStore, userStoryStore } from "../../src/domain/requirements/requirement-store.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("review.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths, proc,
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	describe("review", () => {
		it("runs the default review command (npm test)", () => {
			commands["review"]({}, [], "review", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"npm test",
				{ cwd: "/project", label: "Starting review session..." },
			);
		});

		it("uses custom runner from config", () => {
			const project = {
				...mockProject,
				config: {
					...mockProject.config,
					review: { runner: "npm run test:review" },
				},
			};

			commands["review"]({}, [], "review", project);

			expect(shell.run).toHaveBeenCalledWith(
				"npm run test:review",
				{ cwd: "/project", label: "Starting review session..." },
			);
		});
	});

	describe("review:all", () => {
		it("does nothing without a project", () => {
			commands["review:all"]({}, [], "review:all", undefined);

			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs the full gated pipeline (build, test, e2e)", () => {
			vi.mocked(shell.run).mockReturnValue(0);

			commands["review:all"]({}, [], "review:all", mockProject);

			expect(shell.run).toHaveBeenCalledTimes(3);
			expect(shell.run).toHaveBeenCalledWith(
				"npm run build",
				expect.objectContaining({ label: "Step 1/3: Build" }),
			);
			expect(shell.run).toHaveBeenCalledWith(
				"npm test",
				expect.objectContaining({ label: "Step 2/3: Test" }),
			);
			expect(shell.run).toHaveBeenCalledWith(
				"npx vitest run tests/e2e/",
				expect.objectContaining({ label: "Step 3/3: E2E" }),
			);
		});

		it("stops the pipeline when build fails", () => {
			vi.mocked(shell.run).mockReturnValueOnce(1);

			commands["review:all"]({}, [], "review:all", mockProject);

			expect(shell.run).toHaveBeenCalledTimes(1);
			expect(renderPipelineResult).toHaveBeenCalledWith(
				expect.objectContaining({ stoppedAt: "build", reason: "build failed" }),
				expect.any(Function),
			);
		});

		it("stops the pipeline when tests fail", () => {
			vi.mocked(shell.run)
				.mockReturnValueOnce(0)  // build passes
				.mockReturnValueOnce(1); // tests fail

			commands["review:all"]({}, [], "review:all", mockProject);

			expect(shell.run).toHaveBeenCalledTimes(2);
			expect(renderPipelineResult).toHaveBeenCalledWith(
				expect.objectContaining({ stoppedAt: "test", reason: "tests failed" }),
				expect.any(Function),
			);
		});
	});

	describe("review:clean", () => {
		it("does nothing without a project", () => {
			commands["review:clean"]({}, [], "review:clean", undefined);

			expect(disk.rmSync).not.toHaveBeenCalled();
		});

		it("removes the test vault when it exists", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);

			commands["review:clean"]({}, [], "review:clean", mockProject);

			expect(disk.rmSync).toHaveBeenCalledWith(
				expect.any(String),
				{ recursive: true, force: true },
			);
		});

		it("reports when no vault existed to remove", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			commands["review:clean"]({}, [], "review:clean", mockProject);

			expect(disk.rmSync).not.toHaveBeenCalled();
		});
	});

	describe("review:changes", () => {
		it("does nothing without a project", () => {
			commands["review:changes"]({}, [], "review:changes", undefined);

			expect(analyzeWorkingTree).not.toHaveBeenCalled();
			expect(analyzeBranchDiff).not.toHaveBeenCalled();
		});

		it("analyzes the working tree by default", () => {
			commands["review:changes"]({}, [], "review:changes", mockProject);

			expect(analyzeWorkingTree).toHaveBeenCalledWith("/project", expect.any(Object));
			expect(analyzeBranchDiff).not.toHaveBeenCalled();
		});

		it("analyzes branch diff when --base flag is provided", () => {
			commands["review:changes"]({ base: "main" }, [], "review:changes", mockProject);

			expect(analyzeBranchDiff).toHaveBeenCalledWith("/project", expect.any(Object), "main");
			expect(analyzeWorkingTree).not.toHaveBeenCalled();
		});
	});

	describe("review:traceability", () => {
		it("does nothing without a project", () => {
			commands["review:traceability"]({}, [], "review:traceability", undefined);
			expect(loadAllJourneys).not.toHaveBeenCalled();
		});

		it("loads journeys, requirements, use cases, and user stories", () => {
			commands["review:traceability"]({}, [], "review:traceability", mockProject);

			expect(loadAllJourneys).toHaveBeenCalled();
			expect(requirementStore.list).toHaveBeenCalledWith(expect.any(Object), "/project", undefined);
			expect(useCaseStore.list).toHaveBeenCalledWith(expect.any(Object), "/project", { dir: "docs/requirements/use-cases" });
			expect(userStoryStore.list).toHaveBeenCalledWith(expect.any(Object), "/project", { dir: "docs/requirements/user-stories" });
		});

		it("builds traceability matrix and validates links", () => {
			commands["review:traceability"]({}, [], "review:traceability", mockProject);

			expect(validateTraceabilityLinks).toHaveBeenCalled();
			expect(buildTraceabilityMatrix).toHaveBeenCalled();
			expect(renderTraceabilityMatrix).toHaveBeenCalled();
		});

		it("uses custom journeysDir from review config", () => {
			const project = {
				...mockProject,
				config: { ...mockProject.config, review: { journeysDir: "custom/journeys" } },
			};
			commands["review:traceability"]({}, [], "review:traceability", project);

			expect(loadAllJourneys).toHaveBeenCalledWith(
				expect.any(Function),
				expect.any(Function),
				"/project/custom/journeys",
			);
		});

		it("outputs JSON when format is json", () => {
			commands["review:traceability"]({ format: "json" }, [], "review:traceability", mockProject);

			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toHaveProperty("matrix");
			expect(output).toHaveProperty("validation");
			expect(output).toHaveProperty("projectLabel");
		});
	});

	describe("review:coverage", () => {
		it("does nothing without a project", () => {
			commands["review:coverage"]({}, [], "review:coverage", undefined);
			expect(loadAllJourneys).not.toHaveBeenCalled();
		});

		it("loads journeys and requirements, detects gaps", () => {
			commands["review:coverage"]({}, [], "review:coverage", mockProject);

			expect(loadAllJourneys).toHaveBeenCalled();
			expect(requirementStore.list).toHaveBeenCalled();
			expect(buildTraceabilityMatrix).toHaveBeenCalled();
			expect(detectGaps).toHaveBeenCalled();
			expect(coverageByCategory).toHaveBeenCalled();
			expect(renderCoverageReport).toHaveBeenCalled();
		});

		it("outputs JSON when format is json", () => {
			commands["review:coverage"]({ format: "json" }, [], "review:coverage", mockProject);

			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toHaveProperty("matrix");
			expect(output).toHaveProperty("gaps");
			expect(output).toHaveProperty("byCategory");
		});
	});

	describe("review:gates", () => {
		it("does nothing without a project", () => {
			commands["review:gates"]({}, [], "review:gates", undefined);
			expect(evaluateGates).not.toHaveBeenCalled();
		});

		it("returns message when no gates configured", () => {
			commands["review:gates"]({ format: "json" }, [], "review:gates", mockProject);

			expect(evaluateGates).not.toHaveBeenCalled();
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual(expect.objectContaining({
				evaluation: null,
				message: "No quality gates configured in review.gates",
			}));
		});

		it("evaluates gates when configured", () => {
			const project = {
				...mockProject,
				config: {
					...mockProject.config,
					review: { gates: { coverage: { requirementCoverage: 80 } } },
				},
			};
			commands["review:gates"]({}, [], "review:gates", project);

			expect(evaluateGates).toHaveBeenCalledWith(
				{ coverage: { requirementCoverage: 80 } },
				[],
			);
			expect(renderGateResult).toHaveBeenCalled();
		});

		it("outputs JSON with evaluation result", () => {
			const project = {
				...mockProject,
				config: {
					...mockProject.config,
					review: { gates: { coverage: { requirementCoverage: 80 } } },
				},
			};
			commands["review:gates"]({ format: "json" }, [], "review:gates", project);

			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toHaveProperty("evaluation");
			expect(output).toHaveProperty("projectLabel", "test");
		});
	});

	describe("review:evidence", () => {
		it("does nothing without a project", () => {
			commands["review:evidence"]({}, [], "review:evidence", undefined);
			expect(listRuns).not.toHaveBeenCalled();
		});

		it("lists evidence runs", () => {
			commands["review:evidence"]({}, [], "review:evidence", mockProject);

			expect(listRuns).toHaveBeenCalledWith(
				expect.any(Object),
				"/project",
				undefined,
			);
			expect(renderEvidenceList).toHaveBeenCalled();
		});

		it("passes custom evidenceDir from config", () => {
			const project = {
				...mockProject,
				config: {
					...mockProject.config,
					review: { evidenceDir: "custom/evidence" },
				},
			};
			commands["review:evidence"]({}, [], "review:evidence", project);

			expect(listRuns).toHaveBeenCalledWith(
				expect.any(Object),
				"/project",
				"custom/evidence",
			);
		});

		it("outputs JSON when format is json", () => {
			commands["review:evidence"]({ format: "json" }, [], "review:evidence", mockProject);

			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toHaveProperty("runs");
			expect(output).toHaveProperty("projectLabel", "test");
			expect(output.runs).toHaveLength(1);
		});
	});
});
