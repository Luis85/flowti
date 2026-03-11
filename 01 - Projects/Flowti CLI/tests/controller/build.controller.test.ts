/**
 * build.controller.test.ts — Tests for the build controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runCaptureStatus: vi.fn(() => ({ exitCode: 0 })) },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/domain/build/build-freshness.js", () => ({
	checkFreshness: vi.fn(() => ({ needsRebuild: false, reason: "up-to-date" })),
	recordBuild: vi.fn(() => ({ fileCount: 5, sourceHash: "abc123def456xyz" })),
	resolveBuildPaths: vi.fn((root: string) => ({ srcDir: `${root}/src`, binDir: `${root}/dist` })),
}));
vi.mock("../../src/domain/build/ci-generator.js", () => ({
	runProjectCi: vi.fn(() => ({ dryRun: true, yaml: "name: ci\n" })),
}));
vi.mock("../../src/ui/build-display.js", () => ({
	renderFreshnessCheck: vi.fn(),
	renderBuildAuto: vi.fn(),
	renderBuildRecorded: vi.fn(),
	renderCiDryRun: vi.fn(),
	renderCiWritten: vi.fn(),
	renderCiResult: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderShellCommand: vi.fn(),
}));

import { commands } from "../../src/controller/build.controller.js";
import { shell } from "../../src/infrastructure/shell.js";
import { checkFreshness, recordBuild, resolveBuildPaths } from "../../src/domain/build/build-freshness.js";
import { runProjectCi } from "../../src/domain/build/ci-generator.js";

const mockProject = {
	path: "/project",
	pkg: { name: "test", version: "1.0.0", scripts: { build: "esbuild", test: "vitest" } },
	config: {
		name: "test",
		build: { commands: { fast: "npm run build" } },
		test: { commands: { unit: "npm test" } },
		reports: { generators: [] },
		health: {},
	},
	scripts: { build: "esbuild", test: "vitest" },
};

describe("build.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── build ──────────────────────────────────────────────────────
	describe("build", () => {
		it("calls shell.run with the resolved build command", () => {
			commands["build"]({}, [], "build", mockProject);
			expect(shell.run).toHaveBeenCalledWith("npm run build", { cwd: "/project", label: "Building..." });
		});

		it("uses fallback when no project is provided", () => {
			commands["build"]({}, [], "build", undefined);
			expect(shell.run).toHaveBeenCalledWith("npm run build", { cwd: undefined, label: "Building..." });
		});
	});

	// ── test ───────────────────────────────────────────────────────
	describe("test", () => {
		it("calls shell.run with the resolved test command", () => {
			commands["test"]({}, [], "test", mockProject);
			expect(shell.run).toHaveBeenCalledWith("npm test", { cwd: "/project", label: "Running tests..." });
		});
	});

	// ── build:check ───────────────────────────────────────────────
	describe("build:check", () => {
		it("calls resolveBuildPaths and checkFreshness", () => {
			commands["build:check"]({}, [], "build:check", mockProject);
			expect(resolveBuildPaths).toHaveBeenCalledWith("/project", expect.anything());
			expect(checkFreshness).toHaveBeenCalledWith("/project/src", "/project/dist", expect.anything());
		});

		it("returns undefined when no project", () => {
			commands["build:check"]({}, [], "build:check", undefined);
			expect(checkFreshness).not.toHaveBeenCalled();
		});
	});

	// ── build:record ──────────────────────────────────────────────
	describe("build:record", () => {
		it("calls recordBuild and returns model with fileCount and hashPrefix", () => {
			commands["build:record"]({}, [], "build:record", mockProject);
			expect(resolveBuildPaths).toHaveBeenCalledWith("/project", expect.anything());
			expect(recordBuild).toHaveBeenCalledWith("/project/src", "/project/dist", expect.anything());
		});

		it("returns undefined when no project", () => {
			commands["build:record"]({}, [], "build:record", undefined);
			expect(recordBuild).not.toHaveBeenCalled();
		});
	});

	// ── build:watch ───────────────────────────────────────────────
	describe("build:watch", () => {
		it("appends --reload when flag is set", () => {
			commands["build:watch"]({ reload: true }, [], "build:watch", mockProject);
			const call = vi.mocked(shell.run).mock.calls[0];
			expect(call[0]).toContain("--reload");
		});
	});

	// ── project:ci ────────────────────────────────────────────────
	describe("project:ci", () => {
		it("calls runProjectCi with the project context", () => {
			commands["project:ci"]({ "dry-run": true }, [], "project:ci", mockProject);
			expect(runProjectCi).toHaveBeenCalledWith(mockProject, true, expect.anything());
		});

		it("returns undefined when no project", () => {
			commands["project:ci"]({}, [], "project:ci", undefined);
			expect(runProjectCi).not.toHaveBeenCalled();
		});
	});
});
