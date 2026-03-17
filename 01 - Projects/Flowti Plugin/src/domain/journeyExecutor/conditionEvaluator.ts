/**
 * Condition Evaluator — pure function for evaluating step conditions.
 *
 * Supports simple expressions:
 *   - `{{var}}`           — truthy check (non-empty string)
 *   - `!{{var}}`          — falsy check (empty string or undefined)
 *   - `{{var}} == "value"` — equality check
 *   - `{{var}} != "value"` — inequality check
 */

/** Result of evaluating a step condition. */
export interface ConditionResult {
	/** Whether the step should execute. */
	shouldRun: boolean;
	/** Human-readable reason if skipped. */
	reason?: string;
}

/**
 * Evaluates a condition expression against the current variable map.
 *
 * @param expression - The condition expression to evaluate
 * @param variables - Current variable map from journey execution
 * @returns Whether the condition is met (truthy)
 */
export function evaluateCondition(expression: string, variables: Record<string, string>): boolean {
	const trimmed = expression.trim();

	// Negation: !{{var}}
	if (trimmed.startsWith("!")) {
		const inner = trimmed.slice(1).trim();
		return !evaluateCondition(inner, variables);
	}

	// Equality: {{var}} == "value"
	const eqMatch = trimmed.match(/^\{\{(\w+)\}\}\s*==\s*"([^"]*)"$/);
	if (eqMatch) {
		const [, key, expected] = eqMatch;
		return (variables[key] ?? "") === expected;
	}

	// Inequality: {{var}} != "value"
	const neqMatch = trimmed.match(/^\{\{(\w+)\}\}\s*!=\s*"([^"]*)"$/);
	if (neqMatch) {
		const [, key, expected] = neqMatch;
		return (variables[key] ?? "") !== expected;
	}

	// Truthy: {{var}}
	const varMatch = trimmed.match(/^\{\{(\w+)\}\}$/);
	if (varMatch) {
		const value = variables[varMatch[1]] ?? "";
		return value !== "";
	}

	// Unrecognized expression — treat as falsy (safe default)
	return false;
}

/**
 * Evaluates whether a step should run based on its condition config.
 *
 * @param condition - The step's condition configuration (skipIf / runIf)
 * @param variables - Current variable map
 * @returns ConditionResult with shouldRun flag and optional reason
 */
export function evaluateStepCondition(
	condition: { skipIf?: string; runIf?: string },
	variables: Record<string, string>,
): ConditionResult {
	// skipIf takes priority
	if (condition.skipIf) {
		if (evaluateCondition(condition.skipIf, variables)) {
			return { shouldRun: false, reason: `Skipped: skipIf "${condition.skipIf}" evaluated to true` };
		}
	}

	// runIf: step only runs if condition is true
	if (condition.runIf) {
		if (!evaluateCondition(condition.runIf, variables)) {
			return { shouldRun: false, reason: `Skipped: runIf "${condition.runIf}" evaluated to false` };
		}
	}

	return { shouldRun: true };
}
