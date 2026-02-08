/**
 * Retry utilities and error types for file sync operations.
 *
 * @module retry
 */

// ===========================
// Path validation error
// ===========================
export class PathTraversalError extends Error {
	constructor(
		public readonly sourcePath: string,
		public readonly baseFolder: string
	) {
		super(
			`Path traversal detected: "${sourcePath}" is outside base folder "${baseFolder}"`
		);
		this.name = "PathTraversalError";
	}
}

// ===========================
// Retry configuration
// ===========================
export interface RetryConfig {
	/** Maximum number of retry attempts (default: 3) */
	maxRetries: number;
	/** Base delay between retries in ms (default: 100) */
	baseDelayMs: number;
	/** Maximum delay between retries in ms (default: 2000) */
	maxDelayMs: number;
	/** Whether to use exponential backoff (default: true) */
	exponentialBackoff: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 100,
	maxDelayMs: 2000,
	exponentialBackoff: true,
};

/**
 * Determines if an error is retryable (transient).
 * Retryable errors include: EBUSY, ENOTEMPTY, EPERM (temporary), network errors.
 */
export function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const msg = error.message.toLowerCase();
	const code = (error as NodeJS.ErrnoException).code;

	// File system transient errors
	if (code === "EBUSY") return true; // File locked
	if (code === "ENOTEMPTY") return true; // Directory not empty (race)
	if (code === "EAGAIN") return true; // Resource temporarily unavailable
	if (code === "EMFILE") return true; // Too many open files
	if (code === "ENFILE") return true; // Too many open files in system

	// Common transient error patterns
	if (msg.includes("resource busy")) return true;
	if (msg.includes("locked")) return true;
	if (msg.includes("in use by another process")) return true;
	if (msg.includes("network")) return true;
	if (msg.includes("timeout")) return true;

	// Non-retryable errors
	if (code === "ENOENT") return false; // File not found - won't magically appear
	if (code === "EACCES") return false; // Permission denied - permanent
	if (code === "EEXIST") return false; // Already exists - permanent

	return false;
}

/**
 * Executes an async operation with retry logic.
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	config: Partial<RetryConfig> = {},
	onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
	const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
		try {
			return await operation();
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			lastError = error;

			// Don't retry on last attempt or non-retryable errors
			if (attempt >= cfg.maxRetries || !isRetryableError(error)) {
				throw error;
			}

			// Calculate delay with exponential backoff
			let delay = cfg.baseDelayMs;
			if (cfg.exponentialBackoff) {
				delay = Math.min(
					cfg.baseDelayMs * Math.pow(2, attempt),
					cfg.maxDelayMs
				);
			}

			// Add jitter (±25%) to prevent thundering herd
			const jitter = delay * 0.25 * (Math.random() * 2 - 1);
			delay = Math.round(delay + jitter);

			if (onRetry) {
				onRetry(attempt + 1, error, delay);
			}

			await new Promise((r) => setTimeout(r, delay));
		}
	}

	throw lastError ?? new Error("Retry failed");
}
