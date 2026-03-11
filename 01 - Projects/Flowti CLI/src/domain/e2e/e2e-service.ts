/**
 * e2e-service.ts — E2E domain orchestrator.
 *
 * Provides project-aware entry points for E2E operations.
 * All methods resolve paths from the project's ReviewConfig.
 */

import { PLUGIN_ROOT } from "../../infrastructure/config.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import { runPipeline } from "../../infrastructure/pipeline/pipeline-runner.js";
import type { ReviewConfig } from "../../infrastructure/types.js";
import { resolveE2EPaths, type E2EPaths } from "./e2e-paths.js";
import { readProjectConfig } from "../project/project-config.js";
import { buildSuitePipeline } from "./pipelines/suite-pipeline.js";

// ── Lazy singleton (backward compat for script entry point) ─────────

let _e2e: E2EPaths | null = null;

function defaultE2E(deps: Pick<CliDeps, "disk" | "paths" | "proc">): E2EPaths {
	if (!_e2e) {
		const { config } = readProjectConfig(PLUGIN_ROOT, { disk: deps.disk, paths: deps.paths });
		_e2e = resolveE2EPaths(PLUGIN_ROOT, config?.review, deps);
	}
	return _e2e;
}

/** Initialize E2E paths from an explicit project root and config. */
export function initE2EPaths(projectRoot: string, review: ReviewConfig | undefined, deps: Pick<CliDeps, "paths" | "proc">): E2EPaths {
	_e2e = resolveE2EPaths(projectRoot, review, deps);
	return _e2e;
}

/** Get the current E2E paths (initializes from PLUGIN_ROOT if needed). */
export function getE2EPaths(deps: Pick<CliDeps, "disk" | "paths" | "proc">): E2EPaths {
	return defaultE2E(deps);
}

// ── Entry points ────────────────────────────────────────────────────

/** Run the interactive E2E session (--list mode). */
export async function startInteractiveSession(runInteractive: (e2e: E2EPaths) => Promise<void>, deps: Pick<CliDeps, "disk" | "paths" | "proc">, e2e?: E2EPaths): Promise<void> {
	await runInteractive(e2e ?? defaultE2E(deps));
}

/** Run a non-interactive E2E suite with optional journey filter. */
export async function runE2ESuite(deps: Pick<CliDeps, "disk" | "shell" | "paths" | "proc" | "log">, journeyFilter?: string, e2e?: E2EPaths): Promise<never> {
	const resolved = e2e ?? defaultE2E(deps);

	if (journeyFilter) {
		deps.proc.env().E2E_JOURNEY = journeyFilter;
		deps.log(`[e2e] Journey filter: ${journeyFilter}`);
	}

	// Auto-activate installer/prerequisites when explicitly requested
	const journeys = (deps.proc.env().E2E_JOURNEY ?? "").split(",").map((j) => j.trim());
	if (journeys.includes("installer")) {
		deps.proc.env().E2E_RUN_INSTALLER = "true";
		deps.log("[e2e] Installer forced (explicitly requested).");
	}
	if (journeys.includes("prerequisites")) {
		deps.proc.env().E2E_RUN_PREREQUISITES = "true";
		deps.log("[e2e] Prerequisites forced (explicitly requested).");
	}

	const steps = buildSuitePipeline(resolved, deps);
	const result = await runPipeline(steps, resolved.projectRoot, { label: "E2E Suite" });
	deps.proc.exit(result.failed > 0 ? 1 : 0);
}
