/**
 * clock.ts — Centralized date/time operations.
 *
 * All new Date() and Date.now() calls should go through this service
 * for testability — tests inject a mock clock with fixed timestamps.
 */

import type { IClock } from "./types.js";
export type { IClock } from "./types.js";

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
