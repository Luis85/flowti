/**
 * errors.ts — Structured error types for the Flowti CLI.
 *
 * Two error categories:
 *   CliError      — User-facing errors with actionable guidance.
 *                   Displayed cleanly without stack traces.
 *   InternalError — Developer bugs or unexpected failures.
 *                   Displayed with full stack traces for debugging.
 *
 * The top-level error boundary in main.ts formats these differently.
 */

/**
 * User-facing error with actionable guidance.
 *
 * Use for: missing config, invalid input, failed prerequisites,
 * missing files, unsupported operations.
 */
export class CliError extends Error {
	readonly guidance: string;

	constructor(message: string, guidance: string) {
		super(message);
		this.name = "CliError";
		this.guidance = guidance;
	}
}

/**
 * Developer bug or unexpected internal failure.
 *
 * Use for: assertion failures, missing registry entries,
 * impossible states, broken invariants.
 */
export class InternalError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InternalError";
	}
}

/**
 * Format an error for display. CliError shows guidance without stack;
 * InternalError and unknown errors show full details for debugging.
 */
export function formatError(err: unknown): string {
	if (err instanceof CliError) {
		return `${err.message}\n  ${err.guidance}`;
	}

	if (err instanceof InternalError) {
		return `Internal error: ${err.message}\n${err.stack ?? ""}`;
	}

	if (err instanceof Error) {
		return `Unexpected error: ${err.message}\n${err.stack ?? ""}`;
	}

	return `Unexpected error: ${String(err)}`;
}

/**
 * Type guard for CliError — useful in catch blocks to decide
 * whether to show guidance or stack traces.
 */
export function isCliError(err: unknown): err is CliError {
	return err instanceof CliError;
}
