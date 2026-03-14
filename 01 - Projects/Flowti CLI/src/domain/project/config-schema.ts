/**
 * config-schema.ts — Validation for per-project flowti.config.json.
 *
 * Pure functions that validate raw JSON against the ProjectConfig shape.
 * Returns errors (fatal) and warnings (non-fatal) for clear diagnostics.
 *
 * Review, health, and management validators live in config-validators.ts.
 */

import type { ProjectTarget } from "../../infrastructure/types.js";
import {
	type ConfigValidationResult,
	validateReview, validateHealth, validateManagement,
	validateReportGenerators, validatePublishEndpoints, validateDocs,
	validateCommandsMap, validatePaths, validateMake, validateComponents,
} from "./config-validators.js";

export type { ConfigValidationResult } from "./config-validators.js";
export { validateReview, validateHealth, validateManagement } from "./config-validators.js";

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

function warnUnknownKeys(cfg: Record<string, unknown>, warnings: string[]): void {
	for (const key of Object.keys(cfg)) {
		if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
			warnings.push(`Unknown top-level key: "${key}".`);
		}
	}
}
