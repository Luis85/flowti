import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn().mockReturnValue(false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
	},
}));

import {
	extractCiConfig,
	buildWorkflowSteps,
	generateWorkflowYaml,
	runProjectCi,
	handleProjectCi,
} from "../../../src/domain/build/ci-generator.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

/** Create a project context with the given overrides. */
function makeProject(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0", scripts: { test: "vitest run" } },
		config: { name: "test" },
		scripts: { test: "vitest run" },
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── extractCiConfig ──────────────────────────────────────────────────

describe("extractCiConfig", () => {
	it("returns default config for minimal project", () => {
		const ctx = makeProject({
			config: { name: "test" },
			scripts: {},
		});
		const config = extractCiConfig(ctx);

		expect(config.nodeVersion).toBe("22");
		expect(config.branches).toEqual(["main", "master"]);
		expect(config.buildCommand).toBeUndefined();
		expect(config.testCommand).toBeUndefined();
		expect(config.reportsCommand).toBeUndefined();
		expect(config.publishArtifacts).toBe(false);
	});

	it("extracts build command from tools.build", () => {
		const ctx = makeProject({
			config: { name: "test", tools: { build: "npm run build" } },
		});
		const config = extractCiConfig(ctx);

		expect(config.buildCommand).toBe("npm run build");
	});

	it("extracts test command when test script exists", () => {
		const ctx = makeProject({
			scripts: { test: "vitest run" },
		});
		const config = extractCiConfig(ctx);

		expect(config.testCommand).toBe("npm test");
	});

	it("extracts reports command from tools.reports", () => {
		const ctx = makeProject({
			config: { name: "test", tools: { reports: "npm run reports" } },
		});
		const config = extractCiConfig(ctx);

		expect(config.reportsCommand).toBe("npm run reports");
	});

	it("sets publishArtifacts when publish config exists", () => {
		const ctx = makeProject({
			config: {
				name: "test",
				publish: { outDir: "dist", artifacts: ["main.js"] },
			},
		});
		const config = extractCiConfig(ctx);

		expect(config.publishArtifacts).toBe(true);
	});

	it("extracts full config from a complete project context", () => {
		const ctx = makeProject({
			config: {
				name: "test",
				tools: { build: "npm run build", reports: "npm run reports" },
				publish: { outDir: "dist" },
			},
			scripts: { test: "vitest run", build: "esbuild" },
		});
		const config = extractCiConfig(ctx);

		expect(config.buildCommand).toBe("npm run build");
		expect(config.testCommand).toBe("npm test");
		expect(config.reportsCommand).toBe("npm run reports");
		expect(config.publishArtifacts).toBe(true);
	});
});

// ── buildWorkflowSteps ───────────────────────────────────────────────

describe("buildWorkflowSteps", () => {
	it("always includes checkout, setup-node, and install steps", () => {
		const steps = buildWorkflowSteps({
			nodeVersion: "22",
			branches: ["main"],
			publishArtifacts: false,
		});

		expect(steps).toHaveLength(3);
		expect(steps[0].name).toBe("Checkout");
		expect(steps[0].uses).toBe("actions/checkout@v4");
		expect(steps[1].name).toBe("Setup Node.js");
		expect(steps[1].uses).toBe("actions/setup-node@v4");
		expect(steps[1].with).toEqual({ "node-version": "22" });
		expect(steps[2].name).toBe("Install dependencies");
		expect(steps[2].run).toBe("npm ci");
	});

	it("includes build step when buildCommand is set", () => {
		const steps = buildWorkflowSteps({
			nodeVersion: "22",
			branches: ["main"],
			buildCommand: "npm run build",
			publishArtifacts: false,
		});

		const buildStep = steps.find((s) => s.name === "Build");
		expect(buildStep).toBeDefined();
		expect(buildStep!.run).toBe("npm run build");
	});

	it("includes test step when testCommand is set", () => {
		const steps = buildWorkflowSteps({
			nodeVersion: "22",
			branches: ["main"],
			testCommand: "npm test",
			publishArtifacts: false,
		});

		const testStep = steps.find((s) => s.name === "Test");
		expect(testStep).toBeDefined();
		expect(testStep!.run).toBe("npm test");
	});

	it("includes reports step when reportsCommand is set", () => {
		const steps = buildWorkflowSteps({
			nodeVersion: "22",
			branches: ["main"],
			reportsCommand: "npm run reports",
			publishArtifacts: false,
		});

		const reportsStep = steps.find((s) => s.name === "Generate reports");
		expect(reportsStep).toBeDefined();
		expect(reportsStep!.run).toBe("npm run reports");
	});

	it("builds full step list in correct order", () => {
		const steps = buildWorkflowSteps({
			nodeVersion: "20",
			branches: ["main"],
			buildCommand: "npm run build",
			testCommand: "npm test",
			reportsCommand: "npm run reports",
			publishArtifacts: false,
		});

		expect(steps).toHaveLength(6);
		expect(steps.map((s) => s.name)).toEqual([
			"Checkout",
			"Setup Node.js",
			"Install dependencies",
			"Build",
			"Test",
			"Generate reports",
		]);
	});

	it("respects custom node version", () => {
		const steps = buildWorkflowSteps({
			nodeVersion: "20",
			branches: ["main"],
			publishArtifacts: false,
		});

		expect(steps[1].with).toEqual({ "node-version": "20" });
	});
});

// ── generateWorkflowYaml ─────────────────────────────────────────────

describe("generateWorkflowYaml", () => {
	it("generates valid YAML structure", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main", "master"],
			buildCommand: "npm run build",
			testCommand: "npm test",
			publishArtifacts: false,
		});

		expect(yaml).toContain("name: CI");
		expect(yaml).toContain("on:");
		expect(yaml).toContain("  push:");
		expect(yaml).toContain("    branches: [main, master]");
		expect(yaml).toContain("  pull_request:");
		expect(yaml).toContain("jobs:");
		expect(yaml).toContain("  build:");
		expect(yaml).toContain("    runs-on: ubuntu-latest");
		expect(yaml).toContain("    steps:");
	});

	it("includes checkout and setup-node actions", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main"],
			publishArtifacts: false,
		});

		expect(yaml).toContain("uses: actions/checkout@v4");
		expect(yaml).toContain("uses: actions/setup-node@v4");
		expect(yaml).toContain("node-version: '22'");
	});

	it("includes npm ci step", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main"],
			publishArtifacts: false,
		});

		expect(yaml).toContain("run: npm ci");
	});

	it("includes build step when configured", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main"],
			buildCommand: "npm run build",
			publishArtifacts: false,
		});

		expect(yaml).toContain("name: Build");
		expect(yaml).toContain("run: npm run build");
	});

	it("includes test step when configured", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main"],
			testCommand: "npm test",
			publishArtifacts: false,
		});

		expect(yaml).toContain("name: Test");
		expect(yaml).toContain("run: npm test");
	});

	it("omits build step when not configured", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main"],
			publishArtifacts: false,
		});

		expect(yaml).not.toContain("name: Build");
	});

	it("omits reports step when not configured", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["main"],
			publishArtifacts: false,
		});

		expect(yaml).not.toContain("name: Generate reports");
	});

	it("uses custom branches", () => {
		const yaml = generateWorkflowYaml({
			nodeVersion: "22",
			branches: ["develop"],
			publishArtifacts: false,
		});

		expect(yaml).toContain("branches: [develop]");
	});
});

// ── runProjectCi ─────────────────────────────────────────────────────

describe("runProjectCi", () => {
	it("returns yaml and dryRun flag in dry-run mode", () => {
		const project = makeProject({
			config: { name: "test", tools: { build: "npm run build" } },
		});

		const result = runProjectCi(project, true);

		expect(result.dryRun).toBe(true);
		expect(result.yaml).toContain("name: CI");
		expect(result.outputPath).toBeUndefined();
		expect(disk.writeFileSync).not.toHaveBeenCalled();
		expect(disk.mkdirSync).not.toHaveBeenCalled();
	});

	it("writes ci.yml and returns outputPath when not dry-run", () => {
		const project = makeProject({
			config: { name: "test", tools: { build: "npm run build" } },
		});

		const result = runProjectCi(project, false);

		expect(result.dryRun).toBe(false);
		expect(result.outputPath).toBe("/test/project/.github/workflows/ci.yml");
		expect(disk.mkdirSync).toHaveBeenCalledWith(
			"/test/project/.github/workflows",
			{ recursive: true },
		);
		expect(disk.writeFileSync).toHaveBeenCalledWith(
			"/test/project/.github/workflows/ci.yml",
			expect.stringContaining("name: CI"),
			"utf-8",
		);
	});

	it("skips mkdir when workflows dir already exists", () => {
		const project = makeProject();
		vi.mocked(disk.existsSync).mockReturnValue(true);

		runProjectCi(project, false);

		expect(disk.mkdirSync).not.toHaveBeenCalled();
		expect(disk.writeFileSync).toHaveBeenCalled();
	});

	it("generates workflow with all configured steps", () => {
		const project = makeProject({
			config: {
				name: "full-project",
				tools: { build: "npm run build", reports: "npm run reports" },
			},
			scripts: { test: "vitest run", build: "esbuild" },
		});

		const result = runProjectCi(project, false);

		expect(result.yaml).toContain("run: npm run build");
		expect(result.yaml).toContain("run: npm test");
		expect(result.yaml).toContain("run: npm run reports");
	});
});

// ── handleProjectCi (backward compat) ───────────────────────────────

describe("handleProjectCi", () => {
	it("does nothing when no project is provided", () => {
		handleProjectCi({}, [], "project:ci", undefined);

		expect(disk.writeFileSync).not.toHaveBeenCalled();
	});
});
