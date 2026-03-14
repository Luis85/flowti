/**
 * config-validators-review.ts — Review, health, and management validators.
 *
 * Extracted from config-validators.ts to stay under the per-file
 * decision-point threshold. Pure functions that validate review,
 * health, and management config sections.
 */

import { expectType, validateSubObject } from "./config-validators.js";

// ── Review ───────────────────────────────────────────────────────────

export function validateReviewEnvironment(review: Record<string, unknown>, warnings: string[]): void {
	const validTargets = ["cli", "obsidian-vault", "obsidian-plugin", "typescript", "webapp"];
	if (review.target !== undefined && (typeof review.target !== "string" || !validTargets.includes(review.target))) {
		warnings.push(`"review.target" must be one of: ${validTargets.join(", ")}.`);
	}
	if (review.capabilities !== undefined && !Array.isArray(review.capabilities)) {
		warnings.push('"review.capabilities" must be an array of strings.');
	}
}

export function validateReviewExecution(review: Record<string, unknown>, warnings: string[]): void {
	const validSequencers = ["alphabetical", "risk-priority", "chapter-order"];
	if (review.sequencer !== undefined && (typeof review.sequencer !== "string" || !validSequencers.includes(review.sequencer))) {
		warnings.push(`"review.sequencer" must be one of: ${validSequencers.join(", ")}.`);
	}
	expectType(review, "bail", "number", "review", warnings);
	expectType(review, "timeout", "number", "review", warnings);
	expectType(review, "hookTimeout", "number", "review", warnings);
	expectType(review, "parallel", "boolean", "review", warnings);
	expectType(review, "stepFilter", "string", "review", warnings);
}

export function validateReviewEvidence(review: Record<string, unknown>, warnings: string[]): void {
	expectType(review, "evidenceDir", "string", "review", warnings);
	expectType(review, "screenshots", "boolean", "review", warnings);
	expectType(review, "logs", "boolean", "review", warnings);
	expectType(review, "traces", "boolean", "review", warnings);
	expectType(review, "retainRuns", "number", "review", warnings);
}

export function validateReviewGates(gates: Record<string, unknown>, warnings: string[]): void {
	validateSubObject(gates, "coverage", "review.gates", [
		["requirementCoverage", "number"], ["journeyCoverage", "number"], ["statementCoverage", "number"],
	], warnings);
	validateSubObject(gates, "security", "review.gates", [
		["required", "boolean"], ["maxCritical", "number"], ["maxHigh", "number"],
	], warnings);
	validateSubObject(gates, "risk", "review.gates", [
		["criticalMustPass", "boolean"], ["highMustPass", "boolean"],
	], warnings);
	validateSubObject(gates, "release", "review.gates", [
		["allGatesMustPass", "boolean"], ["requireApproval", "boolean"],
	], warnings);
}

export function validateReview(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.review === undefined) return;
	if (!cfg.review || typeof cfg.review !== "object") {
		warnings.push('"review" must be an object.');
		return;
	}
	const review = cfg.review as Record<string, unknown>;
	if (review.journeysDir !== undefined && typeof review.journeysDir !== "string") {
		warnings.push('"review.journeysDir" must be a string.');
	}
	validateReviewEnvironment(review, warnings);
	validateReviewExecution(review, warnings);
	validateReviewEvidence(review, warnings);
	if (review.gates !== undefined) {
		if (!review.gates || typeof review.gates !== "object") {
			warnings.push('"review.gates" must be an object.');
		} else {
			validateReviewGates(review.gates as Record<string, unknown>, warnings);
		}
	}
}

// ── Health ────────────────────────────────────────────────────────────

export function validateHealth(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.health === undefined) return;
	if (!cfg.health || typeof cfg.health !== "object") {
		warnings.push('"health" must be an object.');
		return;
	}
	const health = cfg.health as Record<string, unknown>;
	if (health.thresholds !== undefined) {
		if (!health.thresholds || typeof health.thresholds !== "object") {
			warnings.push('"health.thresholds" must be an object.');
		} else {
			const t = health.thresholds as Record<string, unknown>;
			validateSubObject(t, "coverage", "health.thresholds", [["min", "number"], ["target", "number"]], warnings);
			validateSubObject(t, "lint", "health.thresholds", [["maxErrors", "number"], ["maxWarnings", "number"]], warnings);
			validateSubObject(t, "tests", "health.thresholds", [["minPassed", "number"]], warnings);
		}
	}
	if (health.qualityGates !== undefined && (!health.qualityGates || typeof health.qualityGates !== "object")) {
		warnings.push('"health.qualityGates" must be an object.');
	}
}

// ── Management ───────────────────────────────────────────────────────

export const MANAGEMENT_DIR_SECTIONS = ["resources", "timelog", "deliverables", "raid", "requirements", "capa", "iterations", "agents"] as const;

export function validateDirSections(mgmt: Record<string, unknown>, warnings: string[]): void {
	for (const section of MANAGEMENT_DIR_SECTIONS) {
		if (mgmt[section] === undefined) continue;
		if (!mgmt[section] || typeof mgmt[section] !== "object") {
			warnings.push(`"management.${section}" must be an object.`);
			continue;
		}
		const sectionObj = mgmt[section] as Record<string, unknown>;
		expectType(sectionObj, "dir", "string", `management.${section}`, warnings);
		if (section === "agents") validateAgentsRoster(sectionObj, warnings);
	}
}

function validateAgentsRoster(agents: Record<string, unknown>, warnings: string[]): void {
	if (agents.roster === undefined) return;
	if (!Array.isArray(agents.roster)) {
		warnings.push('"management.agents.roster" must be an array of strings.');
		return;
	}
	for (let i = 0; i < agents.roster.length; i++) {
		if (typeof agents.roster[i] !== "string" || (agents.roster[i] as string).length === 0) {
			warnings.push(`management.agents.roster[${i}]: must be a non-empty string.`);
		}
	}
}

function validatePhaseBinding(state: string, binding: unknown, warnings: string[]): void {
	const prefix = `management.iterations.orchestration.phases.${state}`;
	if (!binding || typeof binding !== "object") {
		warnings.push(`"${prefix}" must be an object.`);
		return;
	}
	const b = binding as Record<string, unknown>;
	if (typeof b.agent !== "string" || b.agent.length === 0) {
		warnings.push(`"${prefix}.agent" is required and must be a non-empty string.`);
	}
	expectType(b, "role", "string", prefix, warnings);
	expectType(b, "instruction", "string", prefix, warnings);
}

function validateOrchestration(iterations: Record<string, unknown>, warnings: string[]): void {
	if (iterations.orchestration === undefined) return;
	if (!iterations.orchestration || typeof iterations.orchestration !== "object") {
		warnings.push('"management.iterations.orchestration" must be an object.');
		return;
	}
	const orch = iterations.orchestration as Record<string, unknown>;
	if (orch.phases === undefined) return;
	if (!orch.phases || typeof orch.phases !== "object") {
		warnings.push('"management.iterations.orchestration.phases" must be an object.');
		return;
	}
	for (const [state, binding] of Object.entries(orch.phases as Record<string, unknown>)) {
		validatePhaseBinding(state, binding, warnings);
	}
}

export function validateManagement(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.management === undefined) return;
	if (!cfg.management || typeof cfg.management !== "object") {
		warnings.push('"management" must be an object.');
		return;
	}
	const mgmt = cfg.management as Record<string, unknown>;
	validateDirSections(mgmt, warnings);
	if (mgmt.iterations !== undefined && mgmt.iterations && typeof mgmt.iterations === "object") {
		expectType(mgmt.iterations as Record<string, unknown>, "durationDays", "number", "management.iterations", warnings);
		expectType(mgmt.iterations as Record<string, unknown>, "lifecycle", "string", "management.iterations", warnings);
		validateOrchestration(mgmt.iterations as Record<string, unknown>, warnings);
	}
	if (mgmt.lifecycle !== undefined) {
		if (!mgmt.lifecycle || typeof mgmt.lifecycle !== "object") {
			warnings.push('"management.lifecycle" must be an object.');
		} else {
			expectType(mgmt.lifecycle as Record<string, unknown>, "featuresDir", "string", "management.lifecycle", warnings);
			expectType(mgmt.lifecycle as Record<string, unknown>, "productsDir", "string", "management.lifecycle", warnings);
		}
	}
}
