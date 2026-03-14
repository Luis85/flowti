/**
 * review-display.ts — Console renderers for review controller responses.
 *
 * Pure display functions that render review data models with ANSI colors.
 */

import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { ChangeImpact } from "../../domain/review/change-analysis.js";
import type { TraceabilityMatrix, TraceabilityValidation, TraceabilityGap, CategoryCoverage } from "../../domain/review/traceability.js";
import type { GateEvaluationResult } from "../../domain/review/quality-gates.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ChangeAnalysisModel {
	projectLabel: string;
	impact: ChangeImpact;
}

export interface ReviewCleanModel {
	removed: boolean;
	vaultPath: string;
}

export interface PipelineResultModel {
	stoppedAt: string | null;
	reason: string | null;
}

export interface GateResultModel {
	evaluation: GateEvaluationResult | null;
	projectLabel: string;
	message?: string;
}

export interface TraceabilityModel {
	matrix: TraceabilityMatrix;
	validation: TraceabilityValidation;
	projectLabel: string;
}

export interface CoverageModel {
	matrix: TraceabilityMatrix;
	gaps: TraceabilityGap[];
	byCategory: CategoryCoverage[];
	projectLabel: string;
}

export interface EvidenceListModel {
	runs: string[];
	projectLabel: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderChangeAnalysis(data: ChangeAnalysisModel, log: (msg?: string) => void): void {
	log(`\n  ${CYAN}Change Analysis${RESET}  ${DIM}${data.projectLabel}${RESET}\n`);
	log(`  ${data.impact.summary}\n`);
	if (data.impact.changedFiles.length > 0) {
		log(`  ${DIM}Changed files:${RESET}`);
		for (const f of data.impact.changedFiles) log(`    ${YELLOW}${f.status}${RESET} ${f.path}`);
		log();
	}
	if (data.impact.affectedDomains.length > 0) log(`  ${DIM}Affected domains:${RESET} ${data.impact.affectedDomains.join(", ")}`);
	if (data.impact.suggestedActions.length > 0) log(`  ${DIM}Suggested actions:${RESET} ${data.impact.suggestedActions.join(", ")}`);
	log();
}

export function renderPipelineResult(data: PipelineResultModel, log: (msg?: string) => void): void {
	if (data.stoppedAt) {
		log(`Pipeline stopped — ${data.reason ?? `${data.stoppedAt} failed`}.`);
	}
}

export function renderReviewClean(data: ReviewCleanModel, log: (msg?: string) => void): void {
	if (!data.removed) {
		log(`\n  ${YELLOW}Test vault does not exist: ${data.vaultPath}${RESET}\n`);
		return;
	}
	log(`\n  ${GREEN}Removed${RESET} test vault: ${DIM}${data.vaultPath}${RESET}\n`);
}

export function renderGateResult(data: GateResultModel, log: (msg?: string) => void): void {
	log(`\n  ${CYAN}Quality Gates${RESET}  ${DIM}${data.projectLabel}${RESET}\n`);

	if (!data.evaluation) {
		log(`  ${YELLOW}${data.message ?? "No gate evaluation available."}${RESET}\n`);
		return;
	}

	for (const gate of data.evaluation.gates) {
		const icon = gate.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		log(`  ${icon} ${gate.gate}: ${gate.details}`);
	}

	log();
	const status = data.evaluation.releaseEligible
		? `${GREEN}RELEASE ELIGIBLE${RESET}`
		: `${RED}RELEASE BLOCKED${RESET}`;
	log(`  Status: ${status}`);

	if (data.evaluation.capaItems.length > 0) {
		log(`\n  ${YELLOW}Auto-CAPA items:${RESET}`);
		for (const capa of data.evaluation.capaItems) {
			log(`    ${RED}${capa.severity}${RESET} ${capa.name}`);
		}
	}
	log();
}

function renderValidationMessages(validation: TraceabilityModel["validation"], log: (msg?: string) => void): void {
	if (validation.errors.length > 0) {
		log(`  ${RED}Validation errors:${RESET}`);
		for (const e of validation.errors) log(`    ${RED}✗${RESET} ${e}`);
		log();
	}
	if (validation.warnings.length > 0) {
		log(`  ${YELLOW}Warnings:${RESET}`);
		for (const w of validation.warnings) log(`    ${YELLOW}!${RESET} ${w}`);
		log();
	}
}

function statusColor(status: string): string {
	if (status === "verified") return GREEN;
	if (status === "failed") return RED;
	if (status === "partial") return YELLOW;
	return DIM;
}

export function renderTraceabilityMatrix(data: TraceabilityModel, log: (msg?: string) => void): void {
	log(`\n  ${CYAN}Traceability Matrix${RESET}  ${DIM}${data.projectLabel}${RESET}\n`);
	renderValidationMessages(data.validation, log);

	const m = data.matrix;
	log(`  Requirements: ${m.totalRequirements} total`);
	log(`    ${GREEN}Verified:${RESET} ${m.verified}  ${YELLOW}Partial:${RESET} ${m.partial}  ${RED}Failed:${RESET} ${m.failed}  ${DIM}Untested:${RESET} ${m.untested}`);
	log(`    Coverage: ${m.coveragePercent}%\n`);

	if (m.rows.length > 0) {
		log(`  ${DIM}${"Requirement".padEnd(14)} ${"Status".padEnd(10)} ${"Journey".padEnd(30)} Step${RESET}`);
		for (const row of m.rows.slice(0, 50)) {
			log(`  ${row.requirementId.padEnd(14)} ${statusColor(row.status)}${row.status.padEnd(10)}${RESET} ${(row.journeys[0] ?? "—").padEnd(30)} ${row.steps[0] ?? "—"}`);
		}
	}
	log();
}

export function renderCoverageReport(data: CoverageModel, log: (msg?: string) => void): void {
	log(`\n  ${CYAN}Requirement Coverage${RESET}  ${DIM}${data.projectLabel}${RESET}\n`);

	const m = data.matrix;
	log(`  Requirements: ${m.totalRequirements} total`);
	log(`    Linked to journeys: ${m.verified + m.partial + m.failed} (${m.coveragePercent}%)`);
	log(`    Untested: ${m.untested}`);
	log(`    Failed: ${m.failed}\n`);

	if (data.byCategory.length > 0) {
		log(`  ${DIM}ISO 25010 Category Coverage:${RESET}`);
		for (const cat of data.byCategory) {
			const bar = progressBar(cat.percent);
			log(`    ${cat.category.padEnd(25)} ${bar}  ${cat.percent}%  (${cat.verified}/${cat.total})`);
		}
		log();
	}

	if (data.gaps.length > 0) {
		log(`  ${YELLOW}Gaps:${RESET}`);
		for (const gap of data.gaps.slice(0, 20)) {
			const label = gap.reason === "no-journey" ? "No journey linked" : gap.reason === "failed" ? "Last run failed" : "No steps verify";
			log(`    ${gap.requirementId}: ${label}`);
		}
	}
	log();
}

export function renderEvidenceList(data: EvidenceListModel, log: (msg?: string) => void): void {
	log(`\n  ${CYAN}Evidence Runs${RESET}  ${DIM}${data.projectLabel}${RESET}\n`);

	if (data.runs.length === 0) {
		log(`  ${DIM}No evidence runs found.${RESET}\n`);
		return;
	}

	for (const run of data.runs.slice(0, 20)) {
		log(`  ${run}`);
	}
	log(`\n  ${DIM}${data.runs.length} run(s) total${RESET}\n`);
}

// ── Helpers ──────────────────────────────────────────────────────────

function progressBar(percent: number, width = 14): string {
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;
	return `${GREEN}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
}
