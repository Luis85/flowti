/**
 * quality-gates.ts — Quality gate evaluation for the Review platform.
 *
 * Automated pass/fail decisions before release. Supports coverage,
 * security, risk, and release gates. Auto-creates CAPA items on failure.
 *
 * ISO 9001 §8.5.2 — Corrective action.
 * ISO 9001 §8.6 — Release of products and services.
 */

import type { JourneyResult, RiskLevel } from "../e2e/journey/journey-types.js";
import type { TraceabilityMatrix } from "./traceability.js";

// ── Gate configuration types ─────────────────────────────────────────

export interface CoverageGateConfig {
	/** Minimum requirement coverage percentage. */
	requirementCoverage?: number;
	/** Minimum journey coverage percentage (journeys with passing results). */
	journeyCoverage?: number;
	/** Minimum statement/code coverage percentage. */
	statementCoverage?: number;
}

export interface SecurityGateConfig {
	/** Whether security gate is required. */
	required?: boolean;
	/** Maximum allowed critical security findings. */
	maxCritical?: number;
	/** Maximum allowed high security findings. */
	maxHigh?: number;
}

export interface RiskGateConfig {
	/** All critical-risk journeys must pass. */
	criticalMustPass?: boolean;
	/** All high-risk journeys must pass. */
	highMustPass?: boolean;
}

export interface ReleaseGateConfig {
	/** All sub-gates must pass for release eligibility. */
	allGatesMustPass?: boolean;
	/** Require manual approval even if all gates pass. */
	requireApproval?: boolean;
}

/** Full quality gate configuration. */
export interface QualityGateConfig {
	coverage?: CoverageGateConfig;
	security?: SecurityGateConfig;
	risk?: RiskGateConfig;
	release?: ReleaseGateConfig;
}

// ── Gate results ─────────────────────────────────────────────────────

/** Result of evaluating a single gate. */
export interface GateResult {
	gate: string;
	passed: boolean;
	details: string;
	metrics?: Record<string, number>;
}

/** Result of evaluating all quality gates. */
export interface GateEvaluationResult {
	gates: GateResult[];
	allPassed: boolean;
	releaseEligible: boolean;
	/** CAPA items to create for failures. */
	capaItems: CAPAItem[];
}

/** A CAPA item generated from a gate failure. */
export interface CAPAItem {
	name: string;
	description: string;
	severity: "critical" | "high" | "medium" | "low";
	source: "e2e-gate-failure";
	linkedJourney?: string;
	linkedRequirement?: string;
	gate: string;
}

// ── Gate evaluators ──────────────────────────────────────────────────

/** Evaluate the coverage gate. */
export function evaluateCoverageGate(
	config: CoverageGateConfig,
	matrix?: TraceabilityMatrix,
	statementCoverage?: number,
): GateResult {
	const details: string[] = [];
	const metrics: Record<string, number> = {};
	let passed = true;

	if (config.requirementCoverage !== undefined && matrix) {
		metrics.requirementCoverage = matrix.coveragePercent;
		if (matrix.coveragePercent < config.requirementCoverage) {
			details.push(`Requirement coverage ${matrix.coveragePercent}% < ${config.requirementCoverage}%`);
			passed = false;
		} else {
			details.push(`Requirement coverage ${matrix.coveragePercent}% ≥ ${config.requirementCoverage}%`);
		}
	}

	if (config.statementCoverage !== undefined && statementCoverage !== undefined) {
		metrics.statementCoverage = statementCoverage;
		if (statementCoverage < config.statementCoverage) {
			details.push(`Statement coverage ${statementCoverage}% < ${config.statementCoverage}%`);
			passed = false;
		} else {
			details.push(`Statement coverage ${statementCoverage}% ≥ ${config.statementCoverage}%`);
		}
	}

	if (config.journeyCoverage !== undefined) {
		// Journey coverage calculated from results — checked elsewhere
		details.push("Journey coverage: evaluated with results");
	}

	return {
		gate: "coverage",
		passed,
		details: details.join("; "),
		metrics,
	};
}

/** Count security findings by risk level from journey results. */
function countSecurityFindings(results: JourneyResult[]): { critical: number; high: number; medium: number; low: number } {
	const counts = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const r of results) {
		if (r.traceability?.category !== "security") continue;
		if (r.failed > 0) {
			const risk = r.traceability.risk ?? "medium";
			counts[risk]++;
		}
	}
	return counts;
}

/** Evaluate the security gate. */
export function evaluateSecurityGate(config: SecurityGateConfig, results: JourneyResult[]): GateResult {
	if (!config.required) {
		return { gate: "security", passed: true, details: "Security gate not required" };
	}

	const findings = countSecurityFindings(results);
	const details: string[] = [];
	let passed = true;

	if (config.maxCritical !== undefined && findings.critical > config.maxCritical) {
		details.push(`${findings.critical} critical findings > max ${config.maxCritical}`);
		passed = false;
	}

	if (config.maxHigh !== undefined && findings.high > config.maxHigh) {
		details.push(`${findings.high} high findings > max ${config.maxHigh}`);
		passed = false;
	}

	if (passed) {
		details.push(`Security: ${findings.critical} critical, ${findings.high} high — within limits`);
	}

	return {
		gate: "security",
		passed,
		details: details.join("; "),
		metrics: findings,
	};
}

/** Evaluate the risk gate. */
export function evaluateRiskGate(config: RiskGateConfig, results: JourneyResult[]): GateResult {
	const details: string[] = [];
	let passed = true;

	const riskResults = groupByRisk(results);

	if (config.criticalMustPass) {
		const critFailed = riskResults.critical.filter((r) => r.failed > 0);
		if (critFailed.length > 0) {
			details.push(`${critFailed.length} critical journey(s) failed: ${critFailed.map((r) => r.journeyName).join(", ")}`);
			passed = false;
		} else {
			details.push(`All ${riskResults.critical.length} critical journeys passed`);
		}
	}

	if (config.highMustPass) {
		const highFailed = riskResults.high.filter((r) => r.failed > 0);
		if (highFailed.length > 0) {
			details.push(`${highFailed.length} high-risk journey(s) failed: ${highFailed.map((r) => r.journeyName).join(", ")}`);
			passed = false;
		} else {
			details.push(`All ${riskResults.high.length} high-risk journeys passed`);
		}
	}

	return {
		gate: "risk",
		passed,
		details: details.join("; "),
	};
}

/** Group journey results by risk level. */
function groupByRisk(results: JourneyResult[]): Record<RiskLevel, JourneyResult[]> {
	const groups: Record<RiskLevel, JourneyResult[]> = { critical: [], high: [], medium: [], low: [] };
	for (const r of results) {
		const risk = r.traceability?.risk ?? "low";
		groups[risk].push(r);
	}
	return groups;
}

// ── Full gate evaluation ─────────────────────────────────────────────

/**
 * Evaluate all quality gates and produce an overall result.
 */
export function evaluateGates(
	config: QualityGateConfig,
	results: JourneyResult[],
	matrix?: TraceabilityMatrix,
	statementCoverage?: number,
): GateEvaluationResult {
	const gates: GateResult[] = [];

	if (config.coverage) {
		gates.push(evaluateCoverageGate(config.coverage, matrix, statementCoverage));
	}

	if (config.security) {
		gates.push(evaluateSecurityGate(config.security, results));
	}

	if (config.risk) {
		gates.push(evaluateRiskGate(config.risk, results));
	}

	const allPassed = gates.every((g) => g.passed);
	const releaseEligible = config.release?.allGatesMustPass ? allPassed : true;

	// Generate CAPA items for failures
	const capaItems = generateCAPAItems(gates, results);

	return {
		gates,
		allPassed,
		releaseEligible: releaseEligible && !config.release?.requireApproval,
		capaItems,
	};
}

// ── Auto-CAPA generation ─────────────────────────────────────────────

function securityCAPAs(gate: GateResult, results: JourneyResult[]): CAPAItem[] {
	return results
		.filter((r) => r.traceability?.category === "security" && r.failed > 0)
		.map((r) => ({
			name: `Security gate failure — ${r.journeyName}`,
			description: `Security journey "${r.journeyName}" failed with ${r.failed} step failure(s). ${gate.details}`,
			severity: (r.traceability!.risk ?? "high") as CAPAItem["severity"],
			source: "e2e-gate-failure" as const,
			linkedJourney: r.journeyName,
			gate: "security",
		}));
}

function riskCAPAs(gate: GateResult, results: JourneyResult[]): CAPAItem[] {
	return results
		.filter((r) => (r.traceability?.risk === "critical" || r.traceability?.risk === "high") && r.failed > 0)
		.map((r) => ({
			name: `Risk gate failure — ${r.journeyName}`,
			description: `${r.traceability!.risk}-risk journey "${r.journeyName}" failed. ${gate.details}`,
			severity: r.traceability!.risk as CAPAItem["severity"],
			source: "e2e-gate-failure" as const,
			linkedJourney: r.journeyName,
			gate: "risk",
		}));
}

/** Generate CAPA items from gate failures. */
function generateCAPAItems(gates: GateResult[], results: JourneyResult[]): CAPAItem[] {
	const items: CAPAItem[] = [];
	for (const gate of gates) {
		if (gate.passed) continue;
		if (gate.gate === "security") items.push(...securityCAPAs(gate, results));
		else if (gate.gate === "risk") items.push(...riskCAPAs(gate, results));
		else if (gate.gate === "coverage") {
			items.push({ name: "Coverage gate failure", description: gate.details, severity: "medium", source: "e2e-gate-failure", gate: "coverage" });
		}
	}
	return items;
}
