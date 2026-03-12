/**
 * e2e-renderer.ts — Renderer interface for E2E domain output.
 *
 * Domain code calls these methods instead of importing UI directly.
 * The UI layer provides the default ANSI implementation; tests can
 * inject a no-op or capturing renderer.
 */

import type { E2EPaths } from "./e2e-paths.js";
import type { PrerequisiteResults, TestStats, BuildStats, JourneyEntry, SessionConfig } from "./e2e-types.js";

export interface E2ERenderer {
	prerequisites(results: PrerequisiteResults, e2e: E2EPaths): void;
	journeyTable(entries: JourneyEntry[]): void;
	stepTable(def: Record<string, unknown>, steps: Array<Record<string, unknown>>): void;
	executionBanner(config: SessionConfig, selectedNames: string[]): void;
	sessionSummary(sessionName: string, selectedNames: string[], startTime: number, stats: TestStats): void;
	incrementSummary(exitCode: number, duration: string, stats: BuildStats): void;
	publishSummary(exitCode: number, duration: string, stats: BuildStats): void;
}

/** No-op renderer — used as default when no renderer is injected. */
export const nullRenderer: E2ERenderer = {
	prerequisites() {},
	journeyTable() {},
	stepTable() {},
	executionBanner() {},
	sessionSummary() {},
	incrementSummary() {},
	publishSummary() {},
};
