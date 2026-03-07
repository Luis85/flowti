/**
 * mock-clock.ts — In-memory IClock for tests.
 *
 * Usage:
 *   const c = createMockClock("2025-06-15T10:30:00.000Z");
 *   c.now();  // fixed Date
 *   c.ms();   // fixed ms
 *   c.advance(5000); // move forward 5 seconds
 */

import type { IClock } from "../../src/infrastructure/clock.js";

export interface MockClock extends IClock {
	/** Advance the clock by the given number of milliseconds. */
	advance(ms: number): void;
	/** Set the clock to a specific timestamp. */
	set(isoOrMs: string | number): void;
}

export function createMockClock(iso: string = "2025-06-15T10:30:00.000Z"): MockClock {
	let current = new Date(iso).getTime();

	return {
		now(): Date {
			return new Date(current);
		},

		ms(): number {
			return current;
		},

		iso(): string {
			return new Date(current).toISOString();
		},

		safeIso(): string {
			return new Date(current).toISOString().replace(/:/g, "-");
		},

		advance(ms: number): void {
			current += ms;
		},

		set(isoOrMs: string | number): void {
			current = typeof isoOrMs === "string" ? new Date(isoOrMs).getTime() : isoOrMs;
		},
	};
}
