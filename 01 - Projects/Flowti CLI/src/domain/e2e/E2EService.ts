/**
 * E2EService.ts — E2E domain orchestrator.
 *
 * Provides project-aware entry points for E2E operations.
 * All methods resolve paths from the project's ReviewConfig.
 */

import { PLUGIN_ROOT } from "../../infrastructure/config.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import type { ReviewConfig } from "../../infrastructure/types.js";
import { resolveE2EPaths, type E2EPaths } from "./e2e-paths.js";
import { readProjectConfig } from "../project/project-config.js";
import { runVitest, generateReportAndOpen } from "./e2e-runner.js";
import { interactiveSession } from "./e2e-interactive.js";

// ── Lazy singleton (backward compat for script entry point) ─────────

let _e2e: E2EPaths | null = null;

function defaultE2E(): E2EPaths {
	if (!_e2e) {
		const { config } = readProjectConfig(PLUGIN_ROOT);
		_e2e = resolveE2EPaths(PLUGIN_ROOT, config?.review);
	}
	return _e2e;
}

/** Initialize E2E paths from an explicit project root and config. */
export function initE2EPaths(projectRoot: string, review?: ReviewConfig): E2EPaths {
	_e2e = resolveE2EPaths(projectRoot, review);
	return _e2e;
}

/** Get the current E2E paths (initializes from PLUGIN_ROOT if needed). */
export function getE2EPaths(): E2EPaths {
	return defaultE2E();
}

// ── Entry points ────────────────────────────────────────────────────

/** Run the interactive E2E session (--list mode). */
export async function startInteractiveSession(e2e?: E2EPaths): Promise<void> {
	await interactiveSession(e2e ?? defaultE2E());
}

/** Run a non-interactive E2E suite with optional journey filter. */
export function runE2ESuite(journeyFilter?: string, e2e?: E2EPaths): never {
	const resolved = e2e ?? defaultE2E();

	if (journeyFilter) {
		proc.env().E2E_JOURNEY = journeyFilter;
		log(`[e2e] Journey filter: ${journeyFilter}`);
	}

	// Auto-activate installer/prerequisites when explicitly requested
	const journeys = (proc.env().E2E_JOURNEY ?? "").split(",").map((j) => j.trim());
	if (journeys.includes("installer")) {
		proc.env().E2E_RUN_INSTALLER = "true";
		log("[e2e] Installer forced (explicitly requested).");
	}
	if (journeys.includes("prerequisites")) {
		proc.env().E2E_RUN_PREREQUISITES = "true";
		log("[e2e] Prerequisites forced (explicitly requested).");
	}

	const exitCode = runVitest(resolved);
	generateReportAndOpen(resolved);
	proc.exit(exitCode);
}
