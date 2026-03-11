/**
 * review.controller.test.ts — Tests for review commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: {
		run: vi.fn(() => 0),
		runCaptureStatus: vi.fn(() => ({ output: "", exitCode: 0 })),
	},
}));
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
vi.mock("../../src/ui/review-display.js", () => ({
	renderChangeAnalysis: vi.fn(),
	renderReviewClean: vi.fn(),
	renderPipelineResult: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/review.controller.js";
import { shell } from "../../src/infrastructure/shell.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { log } from "../../src/infrastructure/logger.js";
import { renderPipelineResult } from "../../src/ui/review-display.js";
import { analyzeWorkingTree, analyzeBranchDiff } from "../../src/domain/review/change-analysis.js";

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
});
