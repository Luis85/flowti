/**
 * Journey parser — pure functions.
 *
 * Converts raw JSON objects (journey definitions and run results)
 * into typed domain entities. No I/O, no EventBus.
 */

import type { JourneyRegistryEntry, JourneyRunSummary, JourneyStatus, JourneyType } from "./types";

const VALID_JOURNEY_TYPES: JourneyType[] = ["functional", "regression", "smoke", "exploratory", "blueprint"];
const DEFAULT_STALE_THRESHOLD_DAYS = 30;

/** Parse a raw journey definition JSON into a registry entry. Returns null for invalid input. */
export function parseJourneyDefinition(json: Record<string, unknown>): JourneyRegistryEntry | null {
	if (!json || typeof json !== "object") return null;
	const name = typeof json.journey === "string" ? json.journey : "";
	if (!name) return null;

	const steps = Array.isArray(json.steps) ? json.steps : [];
	const setup = Array.isArray(json.setup) ? json.setup : [];
	const teardown = Array.isArray(json.teardown) ? json.teardown : [];
	const allSteps = [...setup, ...steps, ...teardown];

	return {
		name,
		chapter: typeof json.chapter === "number" ? json.chapter : undefined,
		type: parseJourneyType(json.type),
		category: typeof json.category === "string" ? json.category : undefined,
		domain: typeof json.domain === "string" ? json.domain : undefined,
		prd: typeof json.prd === "string" ? json.prd : undefined,
		feature: typeof json.feature === "string" ? json.feature : undefined,
		actors: parseStringArray(json.actors),
		services: parseStringArray(json.services),
		stepCount: steps.length,
		tools: extractTools(allSteps as Array<{ actions?: Array<{ tool?: string }> }>),
		jsonPath: "",
		canvasPath: typeof json.canvasPath === "string" ? json.canvasPath : undefined,
		testSourcePath: typeof json.testSource === "string" ? json.testSource : undefined,
		complianceTags: parseStringArray(json.complianceTags),
		runHistory: [],
	};
}

/** Parse a raw journey result JSON into a run summary. Returns null for invalid input. */
export function parseJourneyResult(json: Record<string, unknown>): JourneyRunSummary | null {
	if (!json || typeof json !== "object") return null;
	const totalSteps = typeof json.totalSteps === "number" ? json.totalSteps : -1;
	if (totalSteps < 0) return null;

	return {
		date: typeof json.date === "string" ? json.date : new Date().toISOString(),
		totalSteps,
		passed: typeof json.passed === "number" ? json.passed : 0,
		failed: typeof json.failed === "number" ? json.failed : 0,
		skipped: typeof json.skipped === "number" ? json.skipped : 0,
		durationMs: typeof json.durationMs === "number" ? json.durationMs : 0,
	};
}

/** Derive the current status of a journey from its run history. */
export function deriveJourneyStatus(
	entry: JourneyRegistryEntry,
	staleThresholdDays: number = DEFAULT_STALE_THRESHOLD_DAYS,
): JourneyStatus {
	if (entry.runHistory.length === 0 && !entry.lastRunResult) return "never-run";

	const latest = entry.lastRunResult ?? entry.runHistory[entry.runHistory.length - 1];
	if (!latest) return "never-run";

	// Check staleness
	const runDate = new Date(latest.date);
	const now = new Date();
	const daysSinceRun = (now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24);
	if (daysSinceRun > staleThresholdDays) return "stale";

	return latest.failed > 0 ? "failing" : "passing";
}

/** Extract unique tool names from step actions. */
export function extractTools(steps: Array<{ actions?: Array<{ tool?: string }> }>): string[] {
	const tools = new Set<string>();
	for (const step of steps) {
		if (!Array.isArray(step.actions)) continue;
		for (const action of step.actions) {
			if (typeof action.tool === "string" && action.tool) {
				tools.add(action.tool);
			}
		}
	}
	return [...tools].sort();
}

// ── Helpers (private) ────────────────────────────────────────

function parseJourneyType(value: unknown): JourneyType {
	if (typeof value === "string" && VALID_JOURNEY_TYPES.includes(value as JourneyType)) {
		return value as JourneyType;
	}
	return "functional";
}

function parseStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((v): v is string => typeof v === "string");
}
