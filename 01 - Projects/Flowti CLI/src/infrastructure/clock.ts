/**
 * clock.ts — Centralized date/time operations.
 *
 * All new Date() and Date.now() calls should go through this service
 * for testability — tests inject a mock clock with fixed timestamps.
 */

export interface IClock {
	/** Current date/time. */
	now(): Date;
	/** Millisecond timestamp (like Date.now()). */
	ms(): number;
	/** ISO 8601 timestamp string. */
	iso(): string;
	/** Filename-safe timestamp (colons replaced with dashes). */
	safeIso(): string;
}

class SystemClock implements IClock {
	now(): Date {
		return new Date();
	}

	ms(): number {
		return Date.now();
	}

	iso(): string {
		return new Date().toISOString();
	}

	safeIso(): string {
		return new Date().toISOString().replace(/:/g, "-");
	}
}

export const clock: IClock = new SystemClock();
