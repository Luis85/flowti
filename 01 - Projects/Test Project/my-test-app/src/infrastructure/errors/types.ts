/**
 * AppError — base error class for application-level errors.
 *
 * Extends Error with a machine-readable `code` and optional `context`.
 */
export class AppError extends Error {
	readonly code: string;
	readonly context?: Record<string, unknown>;

	constructor(message: string, code: string, context?: Record<string, unknown>) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.context = context;
	}
}
