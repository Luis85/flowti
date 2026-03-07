import { describe, it, expect } from "vitest";
import { createMockClock } from "../mocks/mock-clock.js";

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
