/**
 * generator-registry.ts — Report Generator Registry.
 *
 * Maps generator IDs to callable functions. All report generation
 * is handled by the CLI binary directly — no npx/npm spawning.
 */

import type { GeneratorFn, GeneratorOutput } from "../../infrastructure/types.js";
import { generateTestReport } from "./cli/generate-test-report.js";
import { generateCoverageReport } from "./cli/generate-coverage-report.js";
import { generateCodebaseReport } from "./cli/generate-codebase-report.js";
import { generateComplexityReport } from "./cli/generate-complexity-report.js";
import { generateProjectStatusReport } from "./cli/generate-status-report.js";
import { generateSummaryReport } from "./cli/generate-summary-report.js";

/** Built-in generator registry: maps generator IDs to functions. */
const GENERATORS: ReadonlyMap<string, GeneratorFn> = new Map<string, GeneratorFn>([
	["test", generateTestReport],
	["coverage", generateCoverageReport],
	["codebase", generateCodebaseReport],
	["complexity", generateComplexityReport],
	["status", generateProjectStatusReport],
	["summary", generateSummaryReport],
]);

/** Run a generator by its ID. Returns null if the ID is unknown. */
export function runGenerator(id: string, projectPath: string): GeneratorOutput | null {
	const fn = GENERATORS.get(id);
	if (!fn) return null;
	return fn(projectPath);
}

/** Check if a generator ID is registered. */
export function hasGenerator(id: string): boolean {
	return GENERATORS.has(id);
}

/** List all registered generator IDs. */
export function listGeneratorIds(): string[] {
	return [...GENERATORS.keys()];
}
