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

function validateComponents(cfg: Record<string, unknown>, warnings: string[]): void {
	if (cfg.components === undefined) return;
	if (!cfg.components || typeof cfg.components !== "object") {
		warnings.push('"components" must be an object.');
		return;
	}
	const components = cfg.components as Record<string, unknown>;
	if (components.storybook !== undefined && typeof components.storybook !== "boolean") {
		warnings.push('"components.storybook" must be a boolean.');
	}
	if (components.storybookDir !== undefined && typeof components.storybookDir !== "string") {
		warnings.push('"components.storybookDir" must be a string.');
	}
	if (components.framework !== undefined) {
		const validFrameworks = ["html", "angular", "react", "vue"];
		if (typeof components.framework !== "string" || !validFrameworks.includes(components.framework)) {
			warnings.push(`"components.framework" must be one of: ${validFrameworks.join(", ")}.`);
		}
	}
}

function validateGeneratorEntry(entry: unknown, index: number, errors: string[]): void {
	if (!entry || typeof entry !== "object") {
		errors.push(`reports.generators[${index}]: must be an object.`);
		return;
	}
	const gen = entry as Record<string, unknown>;
	if (typeof gen.label !== "string" || gen.label.length === 0) {
		errors.push(`reports.generators[${index}]: missing "label".`);
	}
	if (!gen.id && !gen.command) {
		errors.push(`reports.generators[${index}]: must have "id" or "command" (or both).`);
	}
}

function validateReportGenerators(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.reports === undefined) return;
	if (!cfg.reports || typeof cfg.reports !== "object") {
		errors.push('"reports" must be an object.');
		return;
	}
	const reports = cfg.reports as Record<string, unknown>;
	if (reports.dir !== undefined && typeof reports.dir !== "string") {
		errors.push('"reports.dir" must be a string.');
	}
	if (reports.generators === undefined) return;
	if (!Array.isArray(reports.generators)) {
		errors.push('"reports.generators" must be an array.');
		return;
	}
	for (let i = 0; i < (reports.generators as unknown[]).length; i++) {
		validateGeneratorEntry((reports.generators as unknown[])[i], i, errors);
	}
}

function validateEndpointEntry(entry: unknown, index: number, errors: string[]): void {
	if (!entry || typeof entry !== "object") {
		errors.push(`publish.endpoints[${index}]: must be an object.`);
		return;
	}
	const ep = entry as Record<string, unknown>;
	if (typeof ep.name !== "string" || ep.name.length === 0) {
		errors.push(`publish.endpoints[${index}]: missing "name".`);
	}
	if (typeof ep.path !== "string" || ep.path.length === 0) {
		errors.push(`publish.endpoints[${index}]: missing "path".`);
	}
}

function validatePublishEndpoints(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.publish === undefined) return;
	if (!cfg.publish || typeof cfg.publish !== "object") {
		errors.push('"publish" must be an object.');
		return;
	}
	const publish = cfg.publish as Record<string, unknown>;
	if (publish.endpoints === undefined) return;
	if (!Array.isArray(publish.endpoints)) {
		errors.push('"publish.endpoints" must be an array.');
		return;
	}
	for (let i = 0; i < (publish.endpoints as unknown[]).length; i++) {
		validateEndpointEntry((publish.endpoints as unknown[])[i], i, errors);
	}
}

function validateDocGeneratorEntry(entry: unknown, index: number, errors: string[]): void {
	if (!entry || typeof entry !== "object") {
		errors.push(`docs.generators[${index}]: must be an object.`);
		return;
	}
	const gen = entry as Record<string, unknown>;
	if (typeof gen.label !== "string") {
		errors.push(`docs.generators[${index}]: missing "label".`);
	}
	if (typeof gen.command !== "string") {
		errors.push(`docs.generators[${index}]: missing "command".`);
	}
}

function validateDocs(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.docs === undefined) return;
	if (!cfg.docs || typeof cfg.docs !== "object") {
		errors.push('"docs" must be an object.');
		return;
	}
	const docs = cfg.docs as Record<string, unknown>;
	if (docs.generators === undefined) return;
	if (!Array.isArray(docs.generators)) {
		errors.push('"docs.generators" must be an array.');
		return;
	}
	for (let i = 0; i < (docs.generators as unknown[]).length; i++) {
		validateDocGeneratorEntry((docs.generators as unknown[])[i], i, errors);
	}
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
}

function warnUnknownKeys(cfg: Record<string, unknown>, warnings: string[]): void {
	for (const key of Object.keys(cfg)) {
		if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
			warnings.push(`Unknown top-level key: "${key}".`);
		}
	}
}
