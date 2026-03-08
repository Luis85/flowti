/**
 * config-schema.ts — Validation for per-project flowti.config.json.
 *
 * Pure functions that validate raw JSON against the ProjectConfig shape.
 * Returns errors (fatal) and warnings (non-fatal) for clear diagnostics.
 */

import type { FlowtiToolId, MakeTemplateId } from "../../infrastructure/types.js";

export interface ConfigValidationResult {
	errors: string[];
	warnings: string[];
}

const VALID_TOOL_IDS: FlowtiToolId[] = ["build", "reports", "devtools"];
const VALID_MAKE_TEMPLATES: MakeTemplateId[] = ["journey", "component"];
const KNOWN_TOP_LEVEL_KEYS = new Set([
	"name", "tools", "make", "reports", "docs", "publish", "review",
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
	validateTools(cfg, errors);
	validateMake(cfg, warnings);
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

function validateTools(cfg: Record<string, unknown>, errors: string[]): void {
	if (cfg.tools === undefined) return;
	if (!cfg.tools || typeof cfg.tools !== "object") {
		errors.push('"tools" must be an object.');
		return;
	}
	const tools = cfg.tools as Record<string, unknown>;
	for (const key of Object.keys(tools)) {
		if (!VALID_TOOL_IDS.includes(key as FlowtiToolId)) {
			errors.push(`tools: unknown tool ID "${key}". Valid: ${VALID_TOOL_IDS.join(", ")}.`);
		}
		if (typeof tools[key] !== "string") {
			errors.push(`tools.${key}: value must be a string (command).`);
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
