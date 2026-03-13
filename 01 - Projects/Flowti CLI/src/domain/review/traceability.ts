/**
 * traceability.ts — Traceability engine for the Review platform.
 *
 * Validates journey traceability links against the requirements store,
 * builds a traceability matrix, calculates coverage, and detects gaps.
 *
 * ISO 9001 §8.2.3/§8.2.4 — Design inputs documented, outputs verified.
 * IREB §3.4/§4.2 — Requirements validation and traceability.
 */

import type { JourneyDefinition, JourneyStep, RiskLevel, QualityCategory } from "../e2e/journey/journey-types.js";
import { isRefStep } from "../e2e/journey/journey-types.js";
import type { JourneyResult } from "../e2e/journey/journey-types.js";

// ── Types ────────────────────────────────────────────────────────────

/** A single row in the traceability matrix. */
export interface TraceabilityRow {
	requirementId: string;
	status: "verified" | "failed" | "untested" | "partial";
	journeys: string[];
	steps: string[];
	lastResult?: "pass" | "fail";
	evidence?: string[];
	risk?: RiskLevel;
	category?: QualityCategory;
}

/** Full traceability matrix linking requirements to journeys and results. */
export interface TraceabilityMatrix {
	rows: TraceabilityRow[];
	totalRequirements: number;
	verified: number;
	failed: number;
	untested: number;
	partial: number;
	coveragePercent: number;
}

/** A gap in traceability — a requirement with no linked journey. */
export interface TraceabilityGap {
	requirementId: string;
	reason: "no-journey" | "no-steps" | "failed";
}

/** Validation result for traceability links. */
export interface TraceabilityValidation {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/** Requirement summary (minimal, for traceability — avoids importing full store). */
export interface RequirementRef {
	id: string;
	name: string;
	status: string;
}

// ── Link extraction ──────────────────────────────────────────────────

/** Extract all requirement IDs referenced by a journey (both journey- and step-level). */
export function extractRequirementIds(journey: JourneyDefinition): string[] {
	const ids = new Set<string>();

	if (journey.traceability?.requirements) {
		for (const id of journey.traceability.requirements) ids.add(id);
	}

	for (const stepOrRef of journey.steps) {
		if (isRefStep(stepOrRef)) continue;
		const step = stepOrRef as JourneyStep;
		if (step.traceability?.requirements) {
			for (const id of step.traceability.requirements) ids.add(id);
		}
	}

	return [...ids];
}

/** Extract all use case IDs referenced by a journey. */
export function extractUseCaseIds(journey: JourneyDefinition): string[] {
	return journey.traceability?.useCases ?? [];
}

/** Extract all user story IDs referenced by a journey. */
export function extractUserStoryIds(journey: JourneyDefinition): string[] {
	return journey.traceability?.userStories ?? [];
}

// ── Validation ───────────────────────────────────────────────────────

function checkUnknownIds(ids: string[], knownSet: Set<string>, label: string, journeyName: string, out: string[]): void {
	for (const id of ids) {
		if (knownSet.size > 0 && !knownSet.has(id)) out.push(`Journey "${journeyName}": references unknown ${label} "${id}"`);
	}
}

function validateJourneyLinks(
	journey: JourneyDefinition, reqSet: Set<string>, ucSet: Set<string>, usSet: Set<string>,
	errors: string[], warnings: string[],
): void {
	const reqIds = extractRequirementIds(journey);
	checkUnknownIds(reqIds, reqSet, "requirement", journey.journey, errors);
	checkUnknownIds(extractUseCaseIds(journey), ucSet, "use case", journey.journey, warnings);
	checkUnknownIds(extractUserStoryIds(journey), usSet, "user story", journey.journey, warnings);
	if (!journey.traceability && !reqIds.length) {
		warnings.push(`Journey "${journey.journey}": no traceability links defined`);
	}
}

/**
 * Validate that all traceability links in journeys point to existing requirements.
 */
export function validateTraceabilityLinks(
	journeys: JourneyDefinition[],
	knownRequirements: string[],
	knownUseCases?: string[],
	knownUserStories?: string[],
): TraceabilityValidation {
	const errors: string[] = [];
	const warnings: string[] = [];
	const reqSet = new Set(knownRequirements);
	const ucSet = new Set(knownUseCases ?? []);
	const usSet = new Set(knownUserStories ?? []);
	for (const journey of journeys) validateJourneyLinks(journey, reqSet, ucSet, usSet, errors, warnings);
	return { valid: errors.length === 0, errors, warnings };
}

// ── Matrix building ──────────────────────────────────────────────────

function resolveRowStatus(linkedJourneys: string[], lastResult: "pass" | "fail" | undefined): TraceabilityRow["status"] {
	if (linkedJourneys.length === 0) return "untested";
	if (lastResult === "fail") return "failed";
	if (lastResult === "pass") return "verified";
	return "partial";
}

function collectLinkedSteps(journey: JourneyDefinition, reqId: string): string[] {
	const steps: string[] = [];
	for (const stepOrRef of journey.steps) {
		if (isRefStep(stepOrRef)) continue;
		const step = stepOrRef as JourneyStep;
		if (step.traceability?.requirements?.includes(reqId)) {
			steps.push(`${journey.journey}#${step.id}`);
		}
	}
	return steps;
}

function buildRowForRequirement(
	req: RequirementRef, journeys: JourneyDefinition[], resultMap: Map<string, JourneyResult>,
): TraceabilityRow {
	const linkedJourneys: string[] = [];
	const linkedSteps: string[] = [];
	let lastResult: "pass" | "fail" | undefined;
	let risk: RiskLevel | undefined;
	let category: QualityCategory | undefined;

	for (const journey of journeys) {
		if (!extractRequirementIds(journey).includes(req.id)) continue;
		linkedJourneys.push(journey.journey);
		if (journey.traceability?.risk) risk = journey.traceability.risk;
		if (journey.traceability?.category) category = journey.traceability.category;
		linkedSteps.push(...collectLinkedSteps(journey, req.id));
		const journeyResult = resultMap.get(journey.journey);
		if (journeyResult) lastResult = journeyResult.steps.some((s) => s.status === "fail") ? "fail" : "pass";
	}

	return {
		requirementId: req.id, status: resolveRowStatus(linkedJourneys, lastResult),
		journeys: linkedJourneys, steps: linkedSteps, lastResult, risk, category,
	};
}

/**
 * Build a traceability matrix from journeys, requirements, and optional results.
 */
export function buildTraceabilityMatrix(
	journeys: JourneyDefinition[],
	requirements: RequirementRef[],
	results?: JourneyResult[],
): TraceabilityMatrix {
	const resultMap = new Map<string, JourneyResult>();
	if (results) for (const r of results) resultMap.set(r.journeyName, r);

	const rows = requirements.map((req) => buildRowForRequirement(req, journeys, resultMap));
	const verified = rows.filter((r) => r.status === "verified").length;
	const failed = rows.filter((r) => r.status === "failed").length;
	const untested = rows.filter((r) => r.status === "untested").length;
	const partial = rows.filter((r) => r.status === "partial").length;
	const total = rows.length;

	return {
		rows, totalRequirements: total, verified, failed, untested, partial,
		coveragePercent: total > 0 ? Math.round(((verified + partial) / total) * 100) : 0,
	};
}

// ── Gap detection ────────────────────────────────────────────────────

/** Detect gaps in requirement traceability. */
export function detectGaps(matrix: TraceabilityMatrix): TraceabilityGap[] {
	const gaps: TraceabilityGap[] = [];

	for (const row of matrix.rows) {
		if (row.status === "untested") {
			gaps.push({ requirementId: row.requirementId, reason: row.journeys.length === 0 ? "no-journey" : "no-steps" });
		} else if (row.status === "failed") {
			gaps.push({ requirementId: row.requirementId, reason: "failed" });
		}
	}

	return gaps;
}

// ── Coverage summary ─────────────────────────────────────────────────

/** Coverage by ISO 25010 quality category. */
export interface CategoryCoverage {
	category: QualityCategory;
	total: number;
	verified: number;
	percent: number;
}

/** Calculate per-category coverage. */
export function coverageByCategory(matrix: TraceabilityMatrix): CategoryCoverage[] {
	const categories = new Map<QualityCategory, { total: number; verified: number }>();

	for (const row of matrix.rows) {
		if (!row.category) continue;
		const entry = categories.get(row.category) ?? { total: 0, verified: 0 };
		entry.total++;
		if (row.status === "verified") entry.verified++;
		categories.set(row.category, entry);
	}

	return [...categories.entries()].map(([category, data]) => ({
		category,
		total: data.total,
		verified: data.verified,
		percent: data.total > 0 ? Math.round((data.verified / data.total) * 100) : 0,
	}));
}
