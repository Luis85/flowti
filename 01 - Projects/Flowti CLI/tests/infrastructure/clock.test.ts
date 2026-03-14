import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clock } from "../../src/infrastructure/clock.js";
import { createMockClock } from "../mocks/mock-clock.js";

/* ── SystemClock (real singleton, tested with fake timers) ── */

describe("clock (SystemClock singleton)", () => {
	const FIXED = new Date("2026-03-14T10:30:45.123Z");

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FIXED);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("now()", () => {
		it("returns a Date instance", () => {
			expect(clock.now()).toBeInstanceOf(Date);
		});

		it("returns the current system time", () => {
			expect(clock.now().getTime()).toBe(FIXED.getTime());
		});
	});

	describe("ms()", () => {
		it("returns a number", () => {
			expect(typeof clock.ms()).toBe("number");
		});

		it("returns milliseconds matching the fixed time", () => {
			expect(clock.ms()).toBe(FIXED.getTime());
		});
	});

	describe("iso()", () => {
		it("returns an ISO 8601 string", () => {
			expect(clock.iso()).toBe("2026-03-14T10:30:45.123Z");
		});

		it("is a valid date string that round-trips", () => {
			const result = clock.iso();
			expect(new Date(result).toISOString()).toBe(result);
		});
	});

	describe("safeIso()", () => {
		it("returns a string with no colons", () => {
			expect(clock.safeIso()).not.toContain(":");
		});

		it("replaces colons with dashes", () => {
			expect(clock.safeIso()).toBe("2026-03-14T10-30-45.123Z");
		});

		it("is derived from the same timestamp as iso()", () => {
			expect(clock.safeIso()).toBe(clock.iso().replace(/:/g, "-"));
		});
	});
});

/* ── createMockClock (test helper) ── */

const DEFAULT_ISO = "2025-06-15T10:30:00.000Z";
const DEFAULT_MS = new Date(DEFAULT_ISO).getTime();

describe("createMockClock", () => {
	it("returns default timestamp 2025-06-15T10:30:00.000Z", () => {
		const clock = createMockClock();
		expect(clock.iso()).toBe(DEFAULT_ISO);
	});

	it("now() returns a Date object matching the fixed time", () => {
		const clock = createMockClock();
		const d = clock.now();
		expect(d).toBeInstanceOf(Date);
		expect(d.getTime()).toBe(DEFAULT_MS);
	});

	it("ms() returns the millisecond timestamp", () => {
		const clock = createMockClock();
		expect(clock.ms()).toBe(DEFAULT_MS);
	});

	it("iso() returns ISO string", () => {
		const clock = createMockClock();
		expect(clock.iso()).toBe(DEFAULT_ISO);
	});

	it("safeIso() returns ISO string with colons replaced by dashes", () => {
		const clock = createMockClock();
		expect(clock.safeIso()).toBe("2025-06-15T10-30-00.000Z");
	});

	it("advance() moves time forward", () => {
		const clock = createMockClock();
		clock.advance(5000);
		expect(clock.ms()).toBe(DEFAULT_MS + 5000);
	});

	it("set() with ISO string changes the time", () => {
		const clock = createMockClock();
		const newIso = "2026-01-01T00:00:00.000Z";
		clock.set(newIso);
		expect(clock.iso()).toBe(newIso);
	});

	it("set() with ms number changes the time", () => {
		const clock = createMockClock();
		const target = 1_000_000_000_000;
		clock.set(target);
		expect(clock.ms()).toBe(target);
	});

	it("multiple advance() calls accumulate", () => {
		const clock = createMockClock();
		clock.advance(1000);
		clock.advance(2000);
		clock.advance(3000);
		expect(clock.ms()).toBe(DEFAULT_MS + 6000);
	});
});
