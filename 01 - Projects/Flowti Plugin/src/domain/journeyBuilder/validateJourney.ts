/**
 * Validates a journey definition JSON string and returns structured errors.
 *
 * Used by the import pipeline to give the user clear feedback when a
 * journey file is malformed or missing required fields.
 */

export interface JourneyValidationResult {
	valid: boolean;
	/** Human-readable errors (empty when valid). */
	errors: string[];
	/** The parsed data when JSON is syntactically valid. */
	data?: Record<string, unknown>;
}

/**
 * Validates raw JSON text as a journey definition.
 *
 * Checks:
 * 1. Syntactically valid JSON
 * 2. Top-level is an object (not array/primitive)
 * 3. Required field: `journey` (string, non-empty)
 * 4. Required field: `steps` (array)
 * 5. Each step has `id` (string) and `title` (string)
 * 6. Each step's `actions` (if present) is an array with valid `tool` fields
 */
/** Validates a single action within a step. */
function validateAction(action: unknown, stepNum: number, actionNum: number, errors: string[]): void {
	if (action === null || typeof action !== "object" || Array.isArray(action)) {
		errors.push(`Step ${stepNum}, action ${actionNum}: must be an object`);
	} else if (typeof (action as Record<string, unknown>).tool !== "string" || ((action as Record<string, unknown>).tool as string).trim() === "") {
		errors.push(`Step ${stepNum}, action ${actionNum}: missing or empty "tool" field`);
	}
}

/** Validates a single step and its actions. */
function validateStep(step: unknown, stepNum: number, errors: string[]): void {
	if (step === null || typeof step !== "object" || Array.isArray(step)) {
		errors.push(`Step ${stepNum}: must be an object`);
		return;
	}
	const obj = step as Record<string, unknown>;
	if (typeof obj.id !== "string" || obj.id.trim() === "") {
		errors.push(`Step ${stepNum}: missing or empty "id" field`);
	}
	if (typeof obj.title !== "string") {
		errors.push(`Step ${stepNum}: missing "title" field`);
	}
	if ("actions" in obj && !Array.isArray(obj.actions)) {
		errors.push(`Step ${stepNum}: "actions" must be an array`);
	} else if (Array.isArray(obj.actions)) {
		for (let j = 0; j < obj.actions.length; j++) {
			validateAction(obj.actions[j], stepNum, j + 1, errors);
		}
	}
}

export function validateJourneyJSON(json: string): JourneyValidationResult {
	const errors: string[] = [];

	// 1. Parse JSON
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { valid: false, errors: [`Invalid JSON: ${message}`] };
	}

	// 2. Must be an object
	if (data === null || typeof data !== "object" || Array.isArray(data)) {
		return { valid: false, errors: ["Journey file must contain a JSON object, not an array or primitive"] };
	}

	const obj = data as Record<string, unknown>;

	// 3. Required: journey name
	if (typeof obj.journey !== "string" || obj.journey.trim() === "") {
		errors.push('Missing or empty "journey" field (the journey name)');
	}

	// 4. Required: steps array
	if (!Array.isArray(obj.steps)) {
		errors.push('Missing or invalid "steps" field (expected an array)');
	} else {
		for (let i = 0; i < obj.steps.length; i++) {
			validateStep(obj.steps[i], i + 1, errors);
		}
	}

	return { valid: errors.length === 0, errors, data: obj };
}
