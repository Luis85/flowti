/**
 * generator-registry.ts — Report Generator Registry.
 *
 * Maps generator IDs to callable functions. All report generation
 * is handled by the CLI binary directly — no npx/npm spawning.
 */

import type { GeneratorFn, GeneratorOutput } from "../../infrastructure/types.js";
import type { ReportDeps } from "../../infrastructure/deps.js";
import type { PipelineContext } from "../../infrastructure/pipeline/pipeline-types.js";
import { generateTestReport } from "./cli/generate-test-report.js";
import { generateCoverageReport } from "./cli/generate-coverage-report.js";
import { generateCodebaseReport } from "./cli/generate-codebase-report.js";
import { generateComplexityReport } from "./cli/generate-complexity-report.js";
import { generateProjectStatusReport } from "./cli/generate-status-report.js";
import { generateSummaryReport } from "./cli/generate-summary-report.js";
import { generateEntityReference } from "./generators/entity-reference.js";
import { generateCliReference } from "./generators/cli-reference.js";
import { generateCycleReport } from "./cli/generate-cycle-report.js";
import { generatePerformanceReport } from "./cli/generate-performance-report.js";
import { generateTraceReport } from "./cli/generate-trace-report.js";
import { generateEventCatalog } from "./cli/generate-event-catalog.js";
import { generateCommandReference } from "./cli/generate-command-reference.js";
import { generateDataDictionary } from "./cli/generate-data-dictionary.js";
import { generateToolReference } from "./cli/generate-tool-reference.js";

export type GeneratorCategory = "report" | "reference";

interface RegistryEntry {
	fn: GeneratorFn;
	category: GeneratorCategory;
}

/** Unified generator registry: maps IDs to functions with category metadata. */
const GENERATORS: ReadonlyMap<string, RegistryEntry> = new Map<string, RegistryEntry>([
	["test", { fn: generateTestReport, category: "report" }],
	["coverage", { fn: generateCoverageReport, category: "report" }],
	["codebase", { fn: generateCodebaseReport, category: "report" }],
	["complexity", { fn: generateComplexityReport, category: "report" }],
	["status", { fn: generateProjectStatusReport, category: "report" }],
	["summary", { fn: generateSummaryReport, category: "report" }],
	["entity-reference", { fn: generateEntityReference, category: "reference" }],
	["cli-reference", { fn: generateCliReference, category: "reference" }],
	["cycle", { fn: generateCycleReport, category: "report" }],
	["performance", { fn: generatePerformanceReport, category: "report" }],
	["trace", { fn: generateTraceReport, category: "report" }],
	["event-catalog", { fn: generateEventCatalog, category: "reference" }],
	["command-reference", { fn: generateCommandReference, category: "reference" }],
	["data-dictionary", { fn: generateDataDictionary, category: "reference" }],
	["tool-reference", { fn: generateToolReference, category: "reference" }],
]);

/** Run a generator by its ID, optionally passing pipeline context. Returns null if unknown. */
export function runGenerator(id: string, projectPath: string, deps: ReportDeps, ctx?: PipelineContext): GeneratorOutput | null {
	const entry = GENERATORS.get(id);
	if (!entry) return null;
	return entry.fn(projectPath, deps, ctx);
}

/** Check if a generator ID is registered. */
export function hasGenerator(id: string): boolean {
	return GENERATORS.has(id);
}

/** List all registered generator IDs. */
export function listGeneratorIds(): string[] {
	return [...GENERATORS.keys()];
}

/** List generator IDs filtered by category. */
export function listByCategory(category: GeneratorCategory): string[] {
	return [...GENERATORS.entries()]
		.filter(([, entry]) => entry.category === category)
		.map(([id]) => id);
}

// ── Reference aliases (backward compatibility) ───────────────────────

/** Run a reference generator by its ID. Returns null if unknown. */
export function runReference(id: string, projectPath: string, deps: ReportDeps): GeneratorOutput | null {
	const entry = GENERATORS.get(id);
	if (!entry || entry.category !== "reference") return null;
	return entry.fn(projectPath, deps);
}

/** Check if a reference ID is registered. */
export function hasReference(id: string): boolean {
	const entry = GENERATORS.get(id);
	return entry !== undefined && entry.category === "reference";
}

/** List all registered reference IDs. */
export function listReferenceIds(): string[] {
	return listByCategory("reference");
}
