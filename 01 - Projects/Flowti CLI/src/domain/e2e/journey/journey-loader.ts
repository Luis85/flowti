/**
 * journey-loader.ts — Load and validate journey definition files.
 *
 * Reads `.journey` JSON files from disk and returns typed definitions.
 * Used by both the test runner and the CLI's interactive session.
 */

import type { JourneyDefinition } from "./journey-types.js";

/** Errors encountered during journey validation. */
export interface ValidationError {
	path: string;
	message: string;
}

/** Result of validating a journey definition. */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

/**
 * Parse and validate a journey JSON string.
 * Returns the typed definition or throws with validation errors.
 */
export function parseJourneyDefinition(json: string, sourcePath?: string): JourneyDefinition {
	const raw = JSON.parse(json) as Record<string, unknown>;
	const errors = validateRaw(raw);

	if (errors.length > 0) {
		const file = sourcePath ?? "<unknown>";
		throw new Error(`Invalid journey definition (${file}):\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n")}`);
	}

	return raw as unknown as JourneyDefinition;
}

function isNonEmptyString(value: unknown): boolean {
	return typeof value === "string" && value.length > 0;
}

function validateStep(step: Record<string, unknown>, prefix: string): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!isNonEmptyString(step.id)) errors.push({ path: `${prefix}.id`, message: "must be a non-empty string" });
	if (!isNonEmptyString(step.title)) errors.push({ path: `${prefix}.title`, message: "must be a non-empty string" });

	if (!Array.isArray(step.actions)) {
		errors.push({ path: `${prefix}.actions`, message: "must be an array" });
		return errors;
	}

	for (let j = 0; j < step.actions.length; j++) {
		const action = step.actions[j] as Record<string, unknown>;
		if (!isNonEmptyString(action.tool)) {
			errors.push({ path: `${prefix}.actions[${j}].tool`, message: "must be a non-empty string" });
		}
	}

	return errors;
}

/**
 * Validate a raw JSON object against the journey schema.
 */
export function validateRaw(raw: Record<string, unknown>): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!isNonEmptyString(raw.journey)) {
		errors.push({ path: "journey", message: "must be a non-empty string" });
	}

	if (!Array.isArray(raw.steps)) {
		errors.push({ path: "steps", message: "must be an array" });
		return errors;
	}

	for (let i = 0; i < raw.steps.length; i++) {
		errors.push(...validateStep(raw.steps[i] as Record<string, unknown>, `steps[${i}]`));
	}

	return errors;
}

/**
 * Validate a journey definition object.
 */
export function validateJourney(definition: JourneyDefinition): ValidationResult {
	const errors = validateRaw(definition as unknown as Record<string, unknown>);
	return { valid: errors.length === 0, errors };
}

/**
 * Load a journey definition from a file path.
 */
export function loadJourneyFile(readFile: (path: string) => string, filePath: string): JourneyDefinition {
	const content = readFile(filePath);
	return parseJourneyDefinition(content, filePath);
}
