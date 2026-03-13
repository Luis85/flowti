/**
 * publish.controller.test.ts — Tests for the publish controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) },
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: { join: vi.fn((...args: string[]) => args.join("/")), resolve: vi.fn((...args: string[]) => args.join("/")), relative: vi.fn((_a: string, b: string) => b), dirname: vi.fn((p: string) => p), basename: vi.fn((p: string) => p.split("/").pop() ?? p), isAbsolute: vi.fn(() => true) },
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date(), iso: () => "", ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../src/ui/renderers/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));
vi.mock("../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../src/infrastructure/request-response.js")>("../../src/infrastructure/request-response.js");
	return actual;
});
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
vi.mock("../../src/ui/displays/publish-display.js", () => ({
	renderDryRun: vi.fn(),
	renderGateResult: vi.fn(),
	renderGateBlocked: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderNoProject: vi.fn(),
	renderShellCommand: vi.fn(),
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
			expect(collectHealth).toHaveBeenCalledWith(expect.any(Object), mockProject);
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
