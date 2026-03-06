/**
 * Gate check pure functions for the Feature Lifecycle.
 *
 * Each gate function checks whether a feature meets the requirements
 * to advance to the next stage. All functions are pure — no I/O,
 * no Obsidian imports, fully testable with mock data.
 *
 * Gates:
 * - Problem Gate (idea → draft): PRD exists with problem + outcome
 * - Design Gate (draft → approved): Scope, FRs, events, FRI ≥ 11
 * - Readiness Gate (approved → in-progress): ACs, data model, review, FRI ≥ 19
 * - Build Gate (in-progress → review): PBI done, build passes, tests exist
 * - Quality Gate (review → done): All AC met, docs updated, TASM ≥ 19
 * - Release Gate (automatic on done): All above passed
 */

import type {
	FeatureEntry,
	GateCheckItem,
	GateCheckResult,
	GateName,
	FeatureStage,
} from "./types";
import { STAGE_GATE_MAP } from "./types";

/** Context data passed to gate checks (extracted from vault, not read during checks). */
export interface GateContext {
	/** Whether the PRD file exists */
	prdExists: boolean;
	/** Whether the PRD has a problem statement section */
	hasProblemStatement: boolean;
	/** Whether the PRD has an outcome section */
	hasOutcome: boolean;
	/** Whether the PRD has a scope section (in-scope + out-of-scope) */
	hasScope: boolean;
	/** Number of functional requirements listed */
	functionalRequirementCount: number;
	/** Whether the PRD has event impact section */
	hasEventImpact: boolean;
	/** Number of acceptance criteria */
	acceptanceCriteriaCount: number;
	/** Number of checked (completed) acceptance criteria */
	acceptanceCriteriaChecked: number;
	/** Whether the PRD has a data model section */
	hasDataModel: boolean;
	/** Whether a technical review doc exists with pass/conditional result */
	hasTechnicalReview: boolean;
	/** Number of PBIs in "done" stage */
	pbisDone: number;
	/** Whether the build passes (manual confirmation flag) */
	buildPasses: boolean;
	/** Whether tests exist for the feature */
	testsExist: boolean;
	/** Whether documentation is updated */
	docsUpdated: boolean;
	/** TASM score from most recent review (null if no review) */
	tasmScore: number | null;
}

/** Create a default (empty) gate context for testing. */
export function createDefaultGateContext(): GateContext {
	return {
		prdExists: false,
		hasProblemStatement: false,
		hasOutcome: false,
		hasScope: false,
		functionalRequirementCount: 0,
		hasEventImpact: false,
		acceptanceCriteriaCount: 0,
		acceptanceCriteriaChecked: 0,
		hasDataModel: false,
		hasTechnicalReview: false,
		pbisDone: 0,
		buildPasses: false,
		testsExist: false,
		docsUpdated: false,
		tasmScore: null,
	};
}

// ── Gate Check Functions ─────────────────────────────────────

/** Problem Gate: idea → draft */
export function checkProblemGate(entry: FeatureEntry, ctx: GateContext): GateCheckResult {
	const checks: GateCheckItem[] = [
		{
			id: "problem.prd_exists",
			label: "PRD file exists",
			passed: ctx.prdExists,
			reason: ctx.prdExists ? undefined : "No PRD file found",
			severity: "error",
		},
		{
			id: "problem.has_problem_statement",
			label: "Problem statement defined",
			passed: ctx.hasProblemStatement,
			reason: ctx.hasProblemStatement ? undefined : "PRD missing problem statement section",
			severity: "error",
		},
		{
			id: "problem.has_outcome",
			label: "Outcome section filled",
			passed: ctx.hasOutcome,
			reason: ctx.hasOutcome ? undefined : "PRD missing outcome section",
			severity: "error",
		},
		{
			id: "problem.has_domain",
			label: "Domain linked",
			passed: entry.domain !== "unknown",
			reason: entry.domain !== "unknown" ? undefined : "No domain linked in frontmatter",
			severity: "warning",
		},
	];

	return { gate: "problem", checks, passed: checks.every((c) => c.passed || c.severity !== "error") };
}

/** Design Gate: draft → approved */
export function checkDesignGate(entry: FeatureEntry, ctx: GateContext): GateCheckResult {
	const friTotal = entry.fri?.total ?? 0;
	const checks: GateCheckItem[] = [
		{
			id: "design.has_scope",
			label: "Scope section filled",
			passed: ctx.hasScope,
			reason: ctx.hasScope ? undefined : "PRD missing scope (in-scope + out-of-scope) section",
			severity: "error",
		},
		{
			id: "design.has_frs",
			label: "At least 3 functional requirements",
			passed: ctx.functionalRequirementCount >= 3,
			reason: ctx.functionalRequirementCount >= 3 ? undefined : `Only ${ctx.functionalRequirementCount} FRs (need ≥3)`,
			severity: "error",
		},
		{
			id: "design.has_event_impact",
			label: "Event impact section filled",
			passed: ctx.hasEventImpact,
			reason: ctx.hasEventImpact ? undefined : "PRD missing event impact section",
			severity: "warning",
		},
		{
			id: "design.fri_threshold",
			label: "FRI ≥ 11 (Conceptual)",
			passed: friTotal >= 11,
			reason: friTotal >= 11 ? undefined : `FRI is ${friTotal} (need ≥11)`,
			severity: "error",
		},
	];

	return { gate: "design", checks, passed: checks.every((c) => c.passed || c.severity !== "error") };
}

/** Readiness Gate: approved → in-progress */
export function checkReadinessGate(entry: FeatureEntry, ctx: GateContext): GateCheckResult {
	const friTotal = entry.fri?.total ?? 0;
	const checks: GateCheckItem[] = [
		{
			id: "readiness.has_acs",
			label: "At least 3 acceptance criteria",
			passed: ctx.acceptanceCriteriaCount >= 3,
			reason: ctx.acceptanceCriteriaCount >= 3 ? undefined : `Only ${ctx.acceptanceCriteriaCount} ACs (need ≥3)`,
			severity: "error",
		},
		{
			id: "readiness.has_data_model",
			label: "Data model section filled",
			passed: ctx.hasDataModel,
			reason: ctx.hasDataModel ? undefined : "PRD missing data model section",
			severity: "warning",
		},
		{
			id: "readiness.has_technical_review",
			label: "Technical review completed",
			passed: ctx.hasTechnicalReview,
			reason: ctx.hasTechnicalReview ? undefined : "No technical review document found",
			severity: "error",
		},
		{
			id: "readiness.fri_threshold",
			label: "FRI ≥ 19 (Technically Ready)",
			passed: friTotal >= 19,
			reason: friTotal >= 19 ? undefined : `FRI is ${friTotal} (need ≥19)`,
			severity: "error",
		},
	];

	return { gate: "readiness", checks, passed: checks.every((c) => c.passed || c.severity !== "error") };
}

/** Build Gate: in-progress → review */
export function checkBuildGate(_entry: FeatureEntry, ctx: GateContext): GateCheckResult {
	const checks: GateCheckItem[] = [
		{
			id: "build.pbi_done",
			label: "At least 1 PBI done",
			passed: ctx.pbisDone >= 1,
			reason: ctx.pbisDone >= 1 ? undefined : "No PBIs in 'done' stage",
			severity: "error",
		},
		{
			id: "build.build_passes",
			label: "Build pipeline passes",
			passed: ctx.buildPasses,
			reason: ctx.buildPasses ? undefined : "Build has not been confirmed",
			severity: "warning",
		},
		{
			id: "build.tests_exist",
			label: "Tests exist for the feature",
			passed: ctx.testsExist,
			reason: ctx.testsExist ? undefined : "No tests found for this feature",
			severity: "warning",
		},
	];

	return { gate: "build", checks, passed: checks.every((c) => c.passed || c.severity !== "error") };
}

/** Quality Gate: review → done */
export function checkQualityGate(_entry: FeatureEntry, ctx: GateContext): GateCheckResult {
	const allAcMet = ctx.acceptanceCriteriaCount > 0 && ctx.acceptanceCriteriaChecked >= ctx.acceptanceCriteriaCount;
	const tasmPasses = ctx.tasmScore !== null && ctx.tasmScore >= 19;
	const checks: GateCheckItem[] = [
		{
			id: "quality.all_ac_met",
			label: "All acceptance criteria met",
			passed: allAcMet,
			reason: allAcMet ? undefined : `${ctx.acceptanceCriteriaChecked}/${ctx.acceptanceCriteriaCount} ACs checked`,
			severity: "error",
		},
		{
			id: "quality.docs_updated",
			label: "Documentation updated",
			passed: ctx.docsUpdated,
			reason: ctx.docsUpdated ? undefined : "Documentation not confirmed as updated",
			severity: "warning",
		},
		{
			id: "quality.tasm_threshold",
			label: "TASM ≥ 19",
			passed: tasmPasses,
			reason: tasmPasses ? undefined : ctx.tasmScore === null ? "No TASM score recorded" : `TASM is ${ctx.tasmScore} (need ≥19)`,
			severity: "error",
		},
	];

	return { gate: "quality", checks, passed: checks.every((c) => c.passed || c.severity !== "error") };
}

// ── Gate Runner ──────────────────────────────────────────────

/** Map of gate names to their check functions. */
const GATE_CHECK_MAP: Record<GateName, (entry: FeatureEntry, ctx: GateContext) => GateCheckResult> = {
	problem: checkProblemGate,
	design: checkDesignGate,
	readiness: checkReadinessGate,
	build: checkBuildGate,
	quality: checkQualityGate,
	release: checkQualityGate, // Release gate reuses Quality gate checks
};

/** Run the gate check for a specific target stage. */
export function runGateCheck(entry: FeatureEntry, targetStage: FeatureStage, ctx: GateContext): GateCheckResult | null {
	const gateName = STAGE_GATE_MAP[targetStage];
	if (!gateName) return null; // "idea" has no gate

	const checkFn = GATE_CHECK_MAP[gateName];
	return checkFn(entry, ctx);
}
