/**
 * config-validators.ts — Section validators for flowti.config.json.
 *
 * Extracted from config-schema.ts to reduce decision-point complexity.
 * Pure functions that validate health, management, reports, publish,
 * docs, commands, paths, make, and components config sections.
 *
 * Review validators live in config-validators-review.ts.
 */

import type { MakeTemplateId } from "../../infrastructure/types.js";

export interface ConfigValidationResult {
	errors: string[];
	warnings: string[];
}

export {
	validateReview,
	validateReviewEnvironment,
	validateReviewExecution,
	validateReviewEvidence,
	validateReviewGates,
	validateHealth,
	validateManagement,
	validateDirSections,
	MANAGEMENT_DIR_SECTIONS,
} from "./config-validators-review.js";

const VALID_MAKE_TEMPLATES: MakeTemplateId[] = ["journey", "component"];

/** Type-check a single optional field. */
export function expectType(obj: Record<string, unknown>, key: string, expected: string, prefix: string, warnings: string[]): void {
	if (obj[key] !== undefined && typeof obj[key] !== expected) {
		warnings.push(`"${prefix}.${key}" must be a ${expected}.`);
	}
}

export function validateSubObject(
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

// ── Array entry validators ──────────────────────────────────────────

export function validateArrayEntries(
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

// ── Reports ─────────────────────────────────────────────────────────

export function validateReportGenerators(cfg: Record<string, unknown>, errors: string[]): void {
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

// ── Publish ─────────────────────────────────────────────────────────

export function validatePublishEndpoints(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.publish === undefined) return;
	if (!cfg.publish || typeof cfg.publish !== "object") { errors.push('"publish" must be an object.'); return; }
	validateArrayEntries(cfg.publish as Record<string, unknown>, "endpoints", "publish", (entry, i, errs) => {
		if (!entry || typeof entry !== "object") { errs.push(`publish.endpoints[${i}]: must be an object.`); return; }
		const ep = entry as Record<string, unknown>;
		if (typeof ep.name !== "string" || ep.name.length === 0) errs.push(`publish.endpoints[${i}]: missing "name".`);
		if (typeof ep.path !== "string" || ep.path.length === 0) errs.push(`publish.endpoints[${i}]: missing "path".`);
	}, errors);
}

// ── Docs ────────────────────────────────────────────────────────────

export function validateDocs(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.docs === undefined) return;
	if (!cfg.docs || typeof cfg.docs !== "object") { errors.push('"docs" must be an object.'); return; }
	validateArrayEntries(cfg.docs as Record<string, unknown>, "generators", "docs", (entry, i, errs) => {
		if (!entry || typeof entry !== "object") { errs.push(`docs.generators[${i}]: must be an object.`); return; }
		const gen = entry as Record<string, unknown>;
		if (typeof gen.label !== "string") errs.push(`docs.generators[${i}]: missing "label".`);
		if (typeof gen.command !== "string") errs.push(`docs.generators[${i}]: missing "command".`);
	}, errors);
}

// ── Commands / Devtools / Paths / Make / Components ─────────────────

export function validateCommandsMap(cfg: Record<string, unknown>, key: string, warnings: string[]): void {
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

export function validatePaths(cfg: Record<string, unknown>, warnings: string[]): void {
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

export function validateMake(cfg: Record<string, unknown>, warnings: string[]): void {
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

export function validateComponents(cfg: Record<string, unknown>, warnings: string[]): void {
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
