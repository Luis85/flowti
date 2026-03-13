/**
 * config-schema.ts — Validation for per-project flowti.config.json.
 *
 * Pure functions that validate raw JSON against the ProjectConfig shape.
 * Returns errors (fatal) and warnings (non-fatal) for clear diagnostics.
 */

import type { MakeTemplateId, ProjectTarget } from "../../infrastructure/types.js";

export interface ConfigValidationResult {
	errors: string[];
	warnings: string[];
}

const VALID_MAKE_TEMPLATES: MakeTemplateId[] = ["journey", "component"];
const VALID_PROJECT_TYPES: ProjectTarget[] = ["project", "typescript", "typescript-cli", "obsidian-plugin"];
const KNOWN_TOP_LEVEL_KEYS = new Set([
	"name", "type", "build", "test", "devtools", "paths",
	"make", "components", "reports", "docs", "publish", "review", "health",
	"management", "templates",
]);

/** Validate a raw object as a ProjectConfig. */
export function validateProjectConfig(raw: unknown): ConfigValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!raw || typeof raw !== "object") {
		return { errors: ["Config must be a non-null object."], warnings };
	}

	const cfg = raw as Record<string, unknown>;

	validateName(cfg, errors);
	validateType(cfg, warnings);
	validateCommandsMap(cfg, "build", warnings);
	validateCommandsMap(cfg, "test", warnings);
	validateCommandsMap(cfg, "devtools", warnings);
	validatePaths(cfg, warnings);
	validateMake(cfg, warnings);
	validateComponents(cfg, warnings);
	validateReportGenerators(cfg, errors);
	validatePublishEndpoints(cfg, errors);
	validateDocs(cfg, errors);
	validateReview(cfg, warnings);
	validateHealth(cfg, warnings);
	validateManagement(cfg, warnings);
	warnUnknownKeys(cfg, warnings);

	return { errors, warnings };
}

/** Type guard: validates and narrows to valid config. */
export function isValidProjectConfig(raw: unknown): boolean {
	return validateProjectConfig(raw).errors.length === 0;
}

// ── Validators ───────────────────────────────────────────────────────

function validateName(cfg: Record<string, unknown>, errors: string[]): void {
	if (typeof cfg.name !== "string" || cfg.name.length === 0) {
		errors.push('Missing or empty required field: "name".');
	}
}

function validateType(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.type === undefined) return;
	if (typeof cfg.type !== "string" || !VALID_PROJECT_TYPES.includes(cfg.type as ProjectTarget)) {
		warnings.push(`"type" must be one of: ${VALID_PROJECT_TYPES.join(", ")}.`);
	}
}

function validateCommandsMap(cfg: Record<string, unknown>, key: string, warnings: string[]): void {
	if (cfg[key] === undefined) return;
	if (!cfg[key] || typeof cfg[key] !== "object") {
		warnings.push(`"${key}" must be an object.`);
		return;
	}
	const section = cfg[key] as Record<string, unknown>;
	if (section.commands !== undefined) {
		if (!section.commands || typeof section.commands !== "object") {
			warnings.push(`"${key}.commands" must be an object.`);
			return;
		}
		const cmds = section.commands as Record<string, unknown>;
		for (const name of Object.keys(cmds)) {
			if (typeof cmds[name] !== "string") {
				warnings.push(`${key}.commands.${name}: value must be a string.`);
			}
		}
	}
	if (section.thresholds !== undefined) {
		validateLintThresholds(section.thresholds, key, warnings);
	}
}

function validateLintThresholds(raw: unknown, parentKey: string, warnings: string[]): void {
	if (!raw || typeof raw !== "object") {
		warnings.push(`"${parentKey}.thresholds" must be an object.`);
		return;
	}
	const t = raw as Record<string, unknown>;
	if (t.maxComplexity !== undefined && (typeof t.maxComplexity !== "number" || t.maxComplexity < 1)) {
		warnings.push(`"${parentKey}.thresholds.maxComplexity" must be a positive number.`);
	}
	if (t.maxLines !== undefined && (typeof t.maxLines !== "number" || t.maxLines < 1)) {
		warnings.push(`"${parentKey}.thresholds.maxLines" must be a positive number.`);
	}
}

function validatePaths(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.paths === undefined) return;
	if (!cfg.paths || typeof cfg.paths !== "object") {
		warnings.push('"paths" must be an object.');
		return;
	}
	const p = cfg.paths as Record<string, unknown>;
	for (const key of Object.keys(p)) {
		if (typeof p[key] !== "string") {
			warnings.push(`paths.${key}: value must be a string.`);
		}
	}
}

function validateMake(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.make === undefined) return;
	if (!cfg.make || typeof cfg.make !== "object") {
		warnings.push('"make" must be an object.');
		return;
	}
	const make = cfg.make as Record<string, unknown>;
	if (make.templates !== undefined) {
		if (!Array.isArray(make.templates)) {
			warnings.push('"make.templates" must be an array.');
			return;
		}
		for (const tmpl of make.templates as unknown[]) {
			if (typeof tmpl !== "string" || !VALID_MAKE_TEMPLATES.includes(tmpl as MakeTemplateId)) {
				warnings.push(`make.templates: unknown template "${tmpl}". Valid: ${VALID_MAKE_TEMPLATES.join(", ")}.`);
			}
		}
	}
}

function expectType(obj: Record<string, unknown>, key: string, expected: string, prefix: string, warnings: string[]): void {
	if (obj[key] !== undefined && typeof obj[key] !== expected) {
		warnings.push(`"${prefix}.${key}" must be a ${expected}.`);
	}
}

function validateComponents(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.components === undefined) return;
	if (!cfg.components || typeof cfg.components !== "object") {
		warnings.push('"components" must be an object.');
		return;
	}
	const components = cfg.components as Record<string, unknown>;
	expectType(components, "storybook", "boolean", "components", warnings);
	expectType(components, "storybookDir", "string", "components", warnings);
	if (components.framework !== undefined) {
		const validFrameworks = ["html", "angular", "react", "vue"];
		if (typeof components.framework !== "string" || !validFrameworks.includes(components.framework)) {
			warnings.push(`"components.framework" must be one of: ${validFrameworks.join(", ")}.`);
		}
	}
}

function validateArrayEntries(
	section: Record<string, unknown>, arrayKey: string, prefix: string,
	validate: (entry: unknown, index: number, errors: string[]) => void, errors: string[],
): void {
	if (section[arrayKey] === undefined) return;
	if (!Array.isArray(section[arrayKey])) {
		errors.push(`"${prefix}.${arrayKey}" must be an array.`);
		return;
	}
	for (let i = 0; i < (section[arrayKey] as unknown[]).length; i++) {
		validate((section[arrayKey] as unknown[])[i], i, errors);
	}
}

function validateReportGenerators(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.reports === undefined) return;
	if (!cfg.reports || typeof cfg.reports !== "object") { errors.push('"reports" must be an object.'); return; }
	const reports = cfg.reports as Record<string, unknown>;
	if (reports.dir !== undefined && typeof reports.dir !== "string") errors.push('"reports.dir" must be a string.');
	if (reports.outputDir !== undefined && typeof reports.outputDir !== "string") errors.push('"reports.outputDir" must be a string.');
	validateArrayEntries(reports, "generators", "reports", (entry, i, errs) => {
		if (!entry || typeof entry !== "object") { errs.push(`reports.generators[${i}]: must be an object.`); return; }
		const gen = entry as Record<string, unknown>;
		if (typeof gen.label !== "string" || gen.label.length === 0) errs.push(`reports.generators[${i}]: missing "label".`);
		if (!gen.id && !gen.command) errs.push(`reports.generators[${i}]: must have "id" or "command" (or both).`);
	}, errors);
}

function validatePublishEndpoints(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.publish === undefined) return;
	if (!cfg.publish || typeof cfg.publish !== "object") { errors.push('"publish" must be an object.'); return; }
	validateArrayEntries(cfg.publish as Record<string, unknown>, "endpoints", "publish", (entry, i, errs) => {
		if (!entry || typeof entry !== "object") { errs.push(`publish.endpoints[${i}]: must be an object.`); return; }
		const ep = entry as Record<string, unknown>;
		if (typeof ep.name !== "string" || ep.name.length === 0) errs.push(`publish.endpoints[${i}]: missing "name".`);
		if (typeof ep.path !== "string" || ep.path.length === 0) errs.push(`publish.endpoints[${i}]: missing "path".`);
	}, errors);
}

function validateDocs(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.docs === undefined) return;
	if (!cfg.docs || typeof cfg.docs !== "object") { errors.push('"docs" must be an object.'); return; }
	validateArrayEntries(cfg.docs as Record<string, unknown>, "generators", "docs", (entry, i, errs) => {
		if (!entry || typeof entry !== "object") { errs.push(`docs.generators[${i}]: must be an object.`); return; }
		const gen = entry as Record<string, unknown>;
		if (typeof gen.label !== "string") errs.push(`docs.generators[${i}]: missing "label".`);
		if (typeof gen.command !== "string") errs.push(`docs.generators[${i}]: missing "command".`);
	}, errors);
}

function validateReviewEnvironment(review: Record<string, unknown>, warnings: string[]): void {
	const validTargets = ["cli", "obsidian-vault", "obsidian-plugin", "typescript", "webapp"];
	if (review.target !== undefined && (typeof review.target !== "string" || !validTargets.includes(review.target))) {
		warnings.push(`"review.target" must be one of: ${validTargets.join(", ")}.`);
	}
	if (review.capabilities !== undefined && !Array.isArray(review.capabilities)) {
		warnings.push('"review.capabilities" must be an array of strings.');
	}
}

function validateReviewExecution(review: Record<string, unknown>, warnings: string[]): void {
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

function validateReviewEvidence(review: Record<string, unknown>, warnings: string[]): void {
	expectType(review, "evidenceDir", "string", "review", warnings);
	expectType(review, "screenshots", "boolean", "review", warnings);
	expectType(review, "logs", "boolean", "review", warnings);
	expectType(review, "traces", "boolean", "review", warnings);
	expectType(review, "retainRuns", "number", "review", warnings);
}

function validateReview(cfg: Record<string, unknown>, warnings: string[]): void {
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

function validateSubObject(
	parent: Record<string, unknown>, key: string, parentPrefix: string,
	fields: [string, string][], warnings: string[],
): void {
	if (parent[key] === undefined) return;
	if (!parent[key] || typeof parent[key] !== "object") {
		warnings.push(`"${parentPrefix}.${key}" must be an object.`);
		return;
	}
	const obj = parent[key] as Record<string, unknown>;
	for (const [field, type] of fields) expectType(obj, field, type, `${parentPrefix}.${key}`, warnings);
}

function validateReviewGates(gates: Record<string, unknown>, warnings: string[]): void {
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

function validateHealth(cfg: Record<string, unknown>, warnings: string[]): void {
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

const MANAGEMENT_DIR_SECTIONS = ["resources", "timelog", "deliverables", "raid", "requirements", "capa"] as const;

function validateDirSections(mgmt: Record<string, unknown>, warnings: string[]): void {
	for (const section of MANAGEMENT_DIR_SECTIONS) {
		if (mgmt[section] === undefined) continue;
		if (!mgmt[section] || typeof mgmt[section] !== "object") {
			warnings.push(`"management.${section}" must be an object.`);
			continue;
		}
		expectType(mgmt[section] as Record<string, unknown>, "dir", "string", `management.${section}`, warnings);
	}
}

function validateManagement(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.management === undefined) return;
	if (!cfg.management || typeof cfg.management !== "object") {
		warnings.push('"management" must be an object.');
		return;
	}
	const mgmt = cfg.management as Record<string, unknown>;
	validateDirSections(mgmt, warnings);
	if (mgmt.lifecycle !== undefined) {
		if (!mgmt.lifecycle || typeof mgmt.lifecycle !== "object") {
			warnings.push('"management.lifecycle" must be an object.');
		} else {
			expectType(mgmt.lifecycle as Record<string, unknown>, "featuresDir", "string", "management.lifecycle", warnings);
			expectType(mgmt.lifecycle as Record<string, unknown>, "productsDir", "string", "management.lifecycle", warnings);
		}
	}
}

function warnUnknownKeys(cfg: Record<string, unknown>, warnings: string[]): void {
	for (const key of Object.keys(cfg)) {
		if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
			warnings.push(`Unknown top-level key: "${key}".`);
		}
	}
}
