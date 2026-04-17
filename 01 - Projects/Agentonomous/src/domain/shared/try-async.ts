import type { Result } from './result.js';
import { err, ok } from './result.js';
import { type AppError, type AppErrorSeverity, appErrorFromUnknown } from './app-error.js';

/**
 * Run an async function and wrap any thrown error as an AppError, inverting
 * it into the Result type the codebase uses everywhere else.  Eliminates
 * try/catch boilerplate for "call a flaky thing, handle it as data".
 *
 * @example
 *   const result = await tryAsync(
 *     () => vault.adapter.read(path),
 *     { code: 'VAULT_READ_FAILED', source: 'file-detail' },
 *   );
 *   if (isErr(result)) ports.logger.warn('file-detail', result.error.message);
 */
export async function tryAsync<T>(
	fn: () => Promise<T>,
	context: { code: string; source: string; severity?: AppErrorSeverity },
): Promise<Result<T, AppError>> {
	try {
		return ok(await fn());
	} catch (cause) {
		return err(appErrorFromUnknown(cause, context));
	}
}

/** Synchronous variant. */
export function trySync<T>(
	fn: () => T,
	context: { code: string; source: string; severity?: AppErrorSeverity },
): Result<T, AppError> {
	try {
		return ok(fn());
	} catch (cause) {
		return err(appErrorFromUnknown(cause, context));
	}
}
