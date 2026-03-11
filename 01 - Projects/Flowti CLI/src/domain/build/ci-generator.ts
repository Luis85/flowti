/**
 * ci-generator.ts — Generate GitHub Actions CI workflow from project config.
 *
 * Pure functions that extract CI configuration from a ProjectContext,
 * build workflow steps, and render GitHub Actions YAML.
 *
 * Command: `project:ci [--dry-run]`
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { ProjectContext, CommandHandler } from "../../infrastructure/types.js";

export type CiDeps = Pick<CliDeps, "disk" | "paths">;

// ── Types ────────────────────────────────────────────────────────────

export interface CiConfig {
	nodeVersion: string;
	branches: string[];
	buildCommand?: string;
	testCommand?: string;
	reportsCommand?: string;
	publishArtifacts: boolean;
}

export interface CiStep {
	name: string;
	run?: string;
	uses?: string;
	with?: Record<string, string>;
}

// ── Pure functions ───────────────────────────────────────────────────

/** Extract CI-relevant config from a project context. */
export function extractCiConfig(ctx: ProjectContext): CiConfig {
	const config: CiConfig = {
		nodeVersion: "22",
		branches: ["main", "master"],
		publishArtifacts: false,
	};

	// Build command from tools.build
	if (ctx.config.tools?.build) {
		config.buildCommand = ctx.config.tools.build;
	}

	// Test command from package.json scripts
	if (ctx.scripts["test"]) {
		config.testCommand = "npm test";
	}

	// Reports command from tools.reports
	if (ctx.config.tools?.reports) {
		config.reportsCommand = ctx.config.tools.reports;
	}

	// Publish artifacts flag
	if (ctx.config.publish) {
		config.publishArtifacts = true;
	}

	return config;
}

/** Build the ordered list of workflow steps from a CiConfig. */
export function buildWorkflowSteps(config: CiConfig): CiStep[] {
	const steps: CiStep[] = [];

	// Checkout
	steps.push({
		name: "Checkout",
		uses: "actions/checkout@v4",
	});

	// Setup Node.js
	steps.push({
		name: "Setup Node.js",
		uses: "actions/setup-node@v4",
		with: { "node-version": config.nodeVersion },
	});

	// Install dependencies
	steps.push({
		name: "Install dependencies",
		run: "npm ci",
	});

	// Build
	if (config.buildCommand) {
		steps.push({
			name: "Build",
			run: config.buildCommand,
		});
	}

	// Test
	if (config.testCommand) {
		steps.push({
			name: "Test",
			run: config.testCommand,
		});
	}

	// Reports
	if (config.reportsCommand) {
		steps.push({
			name: "Generate reports",
			run: config.reportsCommand,
		});
	}

	return steps;
}

/** Render a complete GitHub Actions workflow YAML string. */
export function generateWorkflowYaml(config: CiConfig): string {
	const steps = buildWorkflowSteps(config);
	const branchList = config.branches.map((b) => `${b}`).join(", ");

	const lines: string[] = [];

	lines.push("name: CI");
	lines.push("");
	lines.push("on:");
	lines.push("  push:");
	lines.push(`    branches: [${branchList}]`);
	lines.push("  pull_request:");
	lines.push(`    branches: [${branchList}]`);
	lines.push("");
	lines.push("jobs:");
	lines.push("  build:");
	lines.push("    runs-on: ubuntu-latest");
	lines.push("    steps:");

	for (const step of steps) {
		if (step.uses) {
			lines.push(`      - name: ${step.name}`);
			lines.push(`        uses: ${step.uses}`);
			if (step.with) {
				lines.push("        with:");
				for (const [key, value] of Object.entries(step.with)) {
					lines.push(`          ${key}: '${value}'`);
				}
			}
		} else if (step.run) {
			lines.push(`      - name: ${step.name}`);
			lines.push(`        run: ${step.run}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

// ── Data models ─────────────────────────────────────────────────────

export interface CiResult {
	yaml: string;
	dryRun: boolean;
	outputPath?: string;
}

// ── Command handler ──────────────────────────────────────────────────

export function runProjectCi(project: ProjectContext, dryRun: boolean, deps: CiDeps): CiResult {
	const ciConfig = extractCiConfig(project);
	const yaml = generateWorkflowYaml(ciConfig);

	if (dryRun) {
		return { yaml, dryRun: true };
	}

	// Write .github/workflows/ci.yml relative to the project path
	const workflowsDir = deps.paths.join(project.path, ".github", "workflows");
	if (!deps.disk.existsSync(workflowsDir)) {
		deps.disk.mkdirSync(workflowsDir, { recursive: true });
	}

	const outputPath = deps.paths.join(workflowsDir, "ci.yml");
	deps.disk.writeFileSync(outputPath, yaml, "utf-8");

	return { yaml, dryRun: false, outputPath };
}

export const createHandleProjectCi = (deps: CiDeps): CommandHandler => (_flags, _rawArgs, _command, project) => {
	if (!project) return;
	// Delegate to controller layer for display — kept for backward compatibility
	const dryRun = _flags["dry-run"] === true;
	runProjectCi(project, dryRun, deps);
};
