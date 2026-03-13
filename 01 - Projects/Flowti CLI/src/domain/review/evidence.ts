/**
 * evidence.ts — Evidence collection for the Review platform.
 *
 * Manages evidence directories, run manifests, and per-step artifact collection.
 * Every test run produces verifiable artifacts for audit trail.
 *
 * ISO 9001 §9.1.1 — Monitoring, measurement, analysis, and evaluation.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { JourneyResult, StepResult } from "../e2e/journey/journey-types.js";

export type EvidenceDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Types ────────────────────────────────────────────────────────────

/** Metadata for a single evidence run. */
export interface RunManifest {
	runId: string;
	timestamp: string;
	project: string;
	projectType?: string;
	environment: {
		provider?: string;
		capabilities?: string[];
		nodeVersion: string;
		platform: string;
	};
	config: Record<string, unknown>;
	trigger: "manual" | "ci" | "scheduled";
	operator?: string;
	journeyCount: number;
	totalSteps: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
}

/** Evidence artifact reference. */
export interface EvidenceArtifact {
	type: "log" | "screenshot" | "assertion" | "trace" | "metric" | "snapshot";
	path: string;
	stepId: string;
	journeyName: string;
	timestamp: string;
}

/** Summary of evidence collected for a run. */
export interface EvidenceSummary {
	runId: string;
	runDir: string;
	manifest: RunManifest;
	artifacts: EvidenceArtifact[];
	journeyResults: string[];
}

// ── Run ID generation ────────────────────────────────────────────────

/** Generate a run ID from the current timestamp. */
export function generateRunId(deps: Pick<CliDeps, "clock">): string {
	return deps.clock.safeIso().replace(/[:.]/g, "-");
}

// ── Directory management ─────────────────────────────────────────────

/** Resolve the evidence base directory for a project. */
export function evidenceBaseDir(deps: Pick<CliDeps, "paths">, projectPath: string, configDir?: string): string {
	return deps.paths.join(projectPath, configDir ?? "docs/evidence");
}

/** Resolve the directory for a specific run. */
export function runDir(deps: Pick<CliDeps, "paths">, projectPath: string, runId: string, configDir?: string): string {
	return deps.paths.join(evidenceBaseDir(deps, projectPath, configDir), "runs", runId);
}

/** Ensure the run directory and subdirectories exist. */
export function createRunDir(deps: EvidenceDeps, projectPath: string, runId: string, configDir?: string): string {
	const dir = runDir(deps, projectPath, runId, configDir);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.mkdirSync(deps.paths.join(dir, "journeys"), { recursive: true });
	return dir;
}

/** Create a step evidence directory. */
export function createStepDir(deps: EvidenceDeps, baseRunDir: string, journeySlug: string, stepId: string): string {
	const dir = deps.paths.join(baseRunDir, "journeys", journeySlug, stepId);
	deps.disk.mkdirSync(dir, { recursive: true });
	return dir;
}

// ── Manifest ─────────────────────────────────────────────────────────

/** Create a run manifest from aggregated journey results. */
export function createRunManifest(
	runId: string,
	project: string,
	results: JourneyResult[],
	deps: Pick<CliDeps, "clock">,
	config?: Record<string, unknown>,
	trigger?: RunManifest["trigger"],
	projectType?: string,
	provider?: string,
): RunManifest {
	let totalSteps = 0;
	let passed = 0;
	let failed = 0;
	let skipped = 0;
	let totalDuration = 0;

	for (const r of results) {
		totalSteps += r.totalSteps;
		passed += r.passed;
		failed += r.failed;
		skipped += r.skipped;
		totalDuration += r.durationMs;
	}

	return {
		runId,
		timestamp: deps.clock.safeIso(),
		project,
		projectType,
		environment: {
			provider,
			nodeVersion: typeof process !== "undefined" ? process.version : "unknown",
			platform: typeof process !== "undefined" ? process.platform : "unknown",
		},
		config: config ?? {},
		trigger: trigger ?? "manual",
		journeyCount: results.length,
		totalSteps,
		passed,
		failed,
		skipped,
		durationMs: totalDuration,
	};
}

/** Save a run manifest to disk. */
export function saveRunManifest(deps: EvidenceDeps, baseRunDir: string, manifest: RunManifest): string {
	const path = deps.paths.join(baseRunDir, "run-manifest.json");
	deps.disk.writeFileSync(path, JSON.stringify(manifest, null, "\t"), "utf-8");
	return path;
}

// ── Per-step evidence ────────────────────────────────────────────────

/** Save step result as JSON evidence. */
export function saveStepResult(deps: EvidenceDeps, stepDir: string, result: StepResult): string {
	const path = deps.paths.join(stepDir, "result.json");
	deps.disk.writeFileSync(path, JSON.stringify(result, null, "\t"), "utf-8");
	return path;
}

/** Save a log artifact for a step. */
export function saveStepLog(deps: EvidenceDeps, stepDir: string, content: string): string {
	const path = deps.paths.join(stepDir, "log.txt");
	deps.disk.writeFileSync(path, content, "utf-8");
	return path;
}

/** Save assertions JSON for a step. */
export function saveStepAssertions(deps: EvidenceDeps, stepDir: string, assertions: unknown): string {
	const path = deps.paths.join(stepDir, "assertions.json");
	deps.disk.writeFileSync(path, JSON.stringify(assertions, null, "\t"), "utf-8");
	return path;
}

// ── Journey result saving ────────────────────────────────────────────

/** Save a full journey result to its evidence directory. */
export function saveJourneyResult(deps: EvidenceDeps, baseRunDir: string, journeySlug: string, result: JourneyResult): string {
	const dir = deps.paths.join(baseRunDir, "journeys", journeySlug);
	deps.disk.mkdirSync(dir, { recursive: true });
	const path = deps.paths.join(dir, "result.json");
	deps.disk.writeFileSync(path, JSON.stringify(result, null, "\t"), "utf-8");
	return path;
}

// ── Run summary ──────────────────────────────────────────────────────

/** Aggregate results into a summary JSON. */
export function saveRunSummary(deps: EvidenceDeps, baseRunDir: string, results: JourneyResult[]): string {
	const summary = {
		journeys: results.map((r) => ({
			name: r.journeyName,
			totalSteps: r.totalSteps,
			passed: r.passed,
			failed: r.failed,
			skipped: r.skipped,
			durationMs: r.durationMs,
		})),
		totals: {
			journeys: results.length,
			passed: results.reduce((n, r) => n + r.passed, 0),
			failed: results.reduce((n, r) => n + r.failed, 0),
			skipped: results.reduce((n, r) => n + r.skipped, 0),
		},
	};

	const path = deps.paths.join(baseRunDir, "summary.json");
	deps.disk.writeFileSync(path, JSON.stringify(summary, null, "\t"), "utf-8");
	return path;
}

// ── Evidence collection orchestration ────────────────────────────────

/**
 * Collect all evidence for a completed run.
 * Creates directories, saves manifest, journey results, and summary.
 */
export function collectEvidence(
	deps: EvidenceDeps,
	projectPath: string,
	project: string,
	runId: string,
	results: JourneyResult[],
	config?: Record<string, unknown>,
	configDir?: string,
): EvidenceSummary {
	const baseDir = createRunDir(deps, projectPath, runId, configDir);
	const manifest = createRunManifest(runId, project, results, deps, config);

	saveRunManifest(deps, baseDir, manifest);

	const journeyResultPaths: string[] = [];
	const artifacts: EvidenceArtifact[] = [];

	for (const result of results) {
		const slug = result.journeyName.toLowerCase().replace(/\s+/g, "-");
		const resultPath = saveJourneyResult(deps, baseDir, slug, result);
		journeyResultPaths.push(resultPath);

		// Save per-step evidence
		for (const step of result.steps) {
			if (step.status === "skip") continue;
			const stepDir = createStepDir(deps, baseDir, slug, step.stepId);
			saveStepResult(deps, stepDir, step);

			// Collect action outputs as log
			const logLines = step.actions
				.map((a) => `[${a.tool}] ${a.success ? "PASS" : "FAIL"}: ${a.output ?? a.error ?? ""}`)
				.join("\n");
			if (logLines) {
				saveStepLog(deps, stepDir, logLines);
				artifacts.push({
					type: "log",
					path: deps.paths.join(stepDir, "log.txt"),
					stepId: step.stepId,
					journeyName: result.journeyName,
					timestamp: deps.clock.safeIso(),
				});
			}
		}
	}

	saveRunSummary(deps, baseDir, results);

	return {
		runId,
		runDir: baseDir,
		manifest,
		artifacts,
		journeyResults: journeyResultPaths,
	};
}

// ── Run retention ────────────────────────────────────────────────────

/** List existing run IDs sorted by timestamp (newest first). */
export function listRuns(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, configDir?: string): string[] {
	const runsDir = deps.paths.join(evidenceBaseDir(deps, projectPath, configDir), "runs");
	if (!deps.disk.existsSync(runsDir)) return [];

	return deps.disk.readdirSync(runsDir)
		.filter((name: string) => !name.startsWith("."))
		.sort()
		.reverse();
}

/** Remove old runs beyond the retention limit. */
export function pruneRuns(deps: EvidenceDeps, projectPath: string, retainCount: number, configDir?: string): number {
	const runs = listRuns(deps, projectPath, configDir);
	let removed = 0;

	for (let i = retainCount; i < runs.length; i++) {
		const dir = runDir(deps, projectPath, runs[i], configDir);
		deps.disk.rmSync(dir, { recursive: true, force: true });
		removed++;
	}

	return removed;
}
