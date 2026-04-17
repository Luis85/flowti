/**
 * Structured error type for cross-cutting error handling.  Every module
 * that reports an error to the user (via NotificationPort), logs a failure,
 * or emits on the `error` event bus channel should shape the error as an
 * `AppError` so downstream consumers (ErrorHandler, ui/stores) get a
 * consistent surface.
 *
 * `severity` matches the `error` event channel:
 *   - 'user'   — the user caused or can fix this (show a Notice, level=warn)
 *   - 'system' — transient platform/infra failure (show a Notice, level=error)
 *   - 'fatal'  — unrecoverable; plugin should degrade (emit error+notification)
 */
export type AppErrorSeverity = 'user' | 'system' | 'fatal';

export type AppError = {
	readonly code: string;
	readonly message: string;
	readonly source: string;
	readonly severity: AppErrorSeverity;
	readonly cause?: unknown;
};

export function appError(input: {
	code: string;
	message: string;
	source: string;
	severity?: AppErrorSeverity;
	cause?: unknown;
}): AppError {
	const base: AppError = {
		code: input.code,
		message: input.message,
		source: input.source,
		severity: input.severity ?? 'system',
	};
	return input.cause === undefined ? base : { ...base, cause: input.cause };
}

export function appErrorFromUnknown(
	cause: unknown,
	context: { code: string; source: string; severity?: AppErrorSeverity },
): AppError {
	const message = cause instanceof Error ? cause.message : String(cause);
	return appError({ ...context, message, cause });
}
