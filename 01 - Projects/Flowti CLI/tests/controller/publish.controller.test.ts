/**
 * publish.controller.test.ts — Tests for the publish controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0) },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));
vi.mock("../../src/domain/health/health.js", () => ({
	collectHealth: vi.fn(() => ({
		testsPassed: 100,
		testsFailed: 0,
		coverageLines: 85,
		coverageBranches: 75,
		lintErrors: 0,
		lintWarnings: 2,
	})),
}));
vi.mock("../../src/domain/health/health-scoring.js", () => ({
	scoreHealth: vi.fn(() => ({ overall: 92, breakdown: {} })),
}));
vi.mock("../../src/domain/health/quality-gate.js", () => ({
	evaluateQualityGates: vi.fn(() => ({
		passed: true,
		results: [],
	})),
}));
vi.mock("../../src/ui/publish-display.js", () => ({
	renderDryRun: vi.fn(),
	renderGateResult: vi.fn(),
	renderGateBlocked: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderNoProject: vi.fn(),
}));

import { commands } from "../../src/controller/publish.controller.js";
import { shell } from "../../src/infrastructure/shell.js";
import { collectHealth } from "../../src/domain/health/health.js";
import { scoreHealth } from "../../src/domain/health/health-scoring.js";
import { evaluateQualityGates } from "../../src/domain/health/quality-gate.js";

const mockProject = {
	path: "/project",
	pkg: { name: "test", version: "1.0.0" },
	config: {
		name: "test",
		build: { commands: {} },
		test: { commands: {} },
		reports: { generators: [] },
		health: {
			qualityGates: { enabled: true, minScore: 80 },
		},
		publish: {
			build: "npm run build:prod",
			test: "npm run test:all",
			outDir: "dist",
			artifacts: ["dist/main.js"],
			endpoints: [],
		},
	},
	scripts: {},
};

describe("publish.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── publish (no project) ──────────────────────────────────────
	describe("publish", () => {
		it("runs build command when project is provided and gates pass", () => {
			commands["publish"]({}, [], "publish", mockProject);
			expect(shell.run).toHaveBeenCalledWith("npm run build:prod", { cwd: "/project", label: "Publishing..." });
		});

		it("uses fallback build command when no publish config", () => {
			const simpleProject = {
				...mockProject,
				config: { ...mockProject.config, publish: undefined, health: {} },
			};
			commands["publish"]({}, [], "publish", simpleProject);
			expect(shell.run).toHaveBeenCalledWith("npm run build", { cwd: "/project", label: "Publishing..." });
		});

		it("returns dry-run model when --dry-run flag is set", () => {
			commands["publish"]({ "dry-run": true }, [], "publish", mockProject);
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("blocks publish when quality gates fail", () => {
			vi.mocked(evaluateQualityGates).mockReturnValue({ passed: false, results: [] } as ReturnType<typeof evaluateQualityGates>);
			commands["publish"]({}, [], "publish", mockProject);
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("skips gate check when --skip-gates flag is set", () => {
			commands["publish"]({ "skip-gates": true }, [], "publish", mockProject);
			expect(collectHealth).not.toHaveBeenCalled();
			expect(shell.run).toHaveBeenCalled();
		});
	});

	// ── publish:check ─────────────────────────────────────────────
	describe("publish:check", () => {
		it("returns noProject when no project provided", () => {
			commands["publish:check"]({}, [], "publish:check", undefined);
			expect(collectHealth).not.toHaveBeenCalled();
		});

		it("returns gate check result when project is provided", () => {
			commands["publish:check"]({}, [], "publish:check", mockProject);
			expect(collectHealth).toHaveBeenCalledWith(mockProject);
			expect(scoreHealth).toHaveBeenCalled();
			expect(evaluateQualityGates).toHaveBeenCalled();
		});
	});

	// ── publish:all ───────────────────────────────────────────────
	describe("publish:all", () => {
		it("runs build then test commands sequentially", () => {
			vi.mocked(evaluateQualityGates).mockReturnValue({ passed: true, results: [] } as ReturnType<typeof evaluateQualityGates>);
			commands["publish:all"]({}, [], "publish:all", mockProject);
			expect(shell.run).toHaveBeenCalledTimes(2);
			expect(shell.run).toHaveBeenNthCalledWith(1, "npm run build:prod", expect.objectContaining({ label: "Step 1/2: Building..." }));
			expect(shell.run).toHaveBeenNthCalledWith(2, "npm run test:all", expect.objectContaining({ label: "Step 2/2: Testing..." }));
		});

		it("blocks when quality gates fail", () => {
			vi.mocked(evaluateQualityGates).mockReturnValue({ passed: false, results: [] } as ReturnType<typeof evaluateQualityGates>);
			commands["publish:all"]({}, [], "publish:all", mockProject);
			expect(shell.run).not.toHaveBeenCalled();
		});
	});
});
