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
		// 5. Validate each step
		for (let i = 0; i < obj.steps.length; i++) {
			const step = obj.steps[i] as Record<string, unknown> | null;
			if (step === null || typeof step !== "object" || Array.isArray(step)) {
				errors.push(`Step ${i + 1}: must be an object`);
				continue;
			}
			if (typeof step.id !== "string" || step.id.trim() === "") {
				errors.push(`Step ${i + 1}: missing or empty "id" field`);
			}
			if (typeof step.title !== "string") {
				errors.push(`Step ${i + 1}: missing "title" field`);
			}

			// 6. Actions (optional but must be array when present)
			if ("actions" in step && !Array.isArray(step.actions)) {
				errors.push(`Step ${i + 1}: "actions" must be an array`);
			} else if (Array.isArray(step.actions)) {
				for (let j = 0; j < step.actions.length; j++) {
					const action = step.actions[j] as Record<string, unknown> | null;
					if (action === null || typeof action !== "object" || Array.isArray(action)) {
						errors.push(`Step ${i + 1}, action ${j + 1}: must be an object`);
					} else if (typeof action.tool !== "string" || action.tool.trim() === "") {
						errors.push(`Step ${i + 1}, action ${j + 1}: missing or empty "tool" field`);
					}
				}
			}
		}
	}

	return { valid: errors.length === 0, errors, data: obj };
}
