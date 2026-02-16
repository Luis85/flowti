import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	computeRemainingMs,
	computeElapsedMs,
	isTimerExpired,
	formatDuration,
	createSession,
} from "../../../src/domain/session/helpers";
import type { Session } from "../../../src/domain/session/types";

// ─────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "test-1",
		type: "event-storming",
		title: "Test Session",
		status: "prepared",
		durationMinutes: 25,
		createdAt: "2026-02-16T10:00:00.000Z",
		startedAt: null,
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: null,
		...overrides,
	};
}

// ─────────────────────────────────────────────────────────────
// computeRemainingMs
// ─────────────────────────────────────────────────────────────

describe("computeRemainingMs", () => {
	it("returns full duration for a prepared session", () => {
		const session = makeSession({ durationMinutes: 25 });
		expect(computeRemainingMs(session)).toBe(25 * 60_000);
	});

	it("returns remaining time for an active session", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 5 * 60_000).toISOString(),
			durationMinutes: 25,
		});
		expect(computeRemainingMs(session, now)).toBe(20 * 60_000);
	});

	it("returns 0 when timer has expired", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 30 * 60_000).toISOString(),
			durationMinutes: 25,
		});
		expect(computeRemainingMs(session, now)).toBe(0);
	});

	it("accounts for elapsedBeforePauseMs in a paused session", () => {
		const session = makeSession({
			status: "paused",
			startedAt: null,
			durationMinutes: 25,
			elapsedBeforePauseMs: 10 * 60_000,
		});
		expect(computeRemainingMs(session)).toBe(15 * 60_000);
	});

	it("accounts for elapsedBeforePauseMs in a resumed session", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 5 * 60_000).toISOString(),
			durationMinutes: 25,
			elapsedBeforePauseMs: 10 * 60_000,
		});
		// 10 min previous + 5 min current = 15 min elapsed, 10 min remaining
		expect(computeRemainingMs(session, now)).toBe(10 * 60_000);
	});
});

// ─────────────────────────────────────────────────────────────
// computeElapsedMs
// ─────────────────────────────────────────────────────────────

describe("computeElapsedMs", () => {
	it("returns 0 for a prepared session", () => {
		const session = makeSession();
		expect(computeElapsedMs(session)).toBe(0);
	});

	it("returns current segment duration for an active session", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 5 * 60_000).toISOString(),
		});
		expect(computeElapsedMs(session, now)).toBe(5 * 60_000);
	});

	it("returns accumulated time for a paused session", () => {
		const session = makeSession({
			status: "paused",
			startedAt: null,
			elapsedBeforePauseMs: 12 * 60_000,
		});
		expect(computeElapsedMs(session)).toBe(12 * 60_000);
	});

	it("returns accumulated + current for a resumed session", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 3 * 60_000).toISOString(),
			elapsedBeforePauseMs: 7 * 60_000,
		});
		expect(computeElapsedMs(session, now)).toBe(10 * 60_000);
	});
});

// ─────────────────────────────────────────────────────────────
// isTimerExpired
// ─────────────────────────────────────────────────────────────

describe("isTimerExpired", () => {
	it("returns false for a fresh session", () => {
		const session = makeSession({ durationMinutes: 25 });
		expect(isTimerExpired(session)).toBe(false);
	});

	it("returns true when elapsed exceeds duration", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 26 * 60_000).toISOString(),
			durationMinutes: 25,
		});
		expect(isTimerExpired(session, now)).toBe(true);
	});

	it("returns true at exact boundary", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 25 * 60_000).toISOString(),
			durationMinutes: 25,
		});
		expect(isTimerExpired(session, now)).toBe(true);
	});

	it("returns false when just under the boundary", () => {
		const now = Date.now();
		const session = makeSession({
			status: "active",
			startedAt: new Date(now - 25 * 60_000 + 1).toISOString(),
			durationMinutes: 25,
		});
		expect(isTimerExpired(session, now)).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────
// formatDuration
// ─────────────────────────────────────────────────────────────

describe("formatDuration", () => {
	it("formats 25 minutes", () => {
		expect(formatDuration(25 * 60_000)).toBe("25:00");
	});

	it("formats 0 ms", () => {
		expect(formatDuration(0)).toBe("00:00");
	});

	it("formats 1 minute 30 seconds", () => {
		expect(formatDuration(90_000)).toBe("01:30");
	});

	it("formats seconds with leading zero", () => {
		expect(formatDuration(5_000)).toBe("00:05");
	});

	it("handles negative values as 00:00", () => {
		expect(formatDuration(-1000)).toBe("00:00");
	});

	it("truncates sub-second precision", () => {
		expect(formatDuration(61_500)).toBe("01:01");
	});
});

// ─────────────────────────────────────────────────────────────
// createSession
// ─────────────────────────────────────────────────────────────

describe("createSession", () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it("creates a session with default values", () => {
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const session = createSession("s1", "event-storming", "My Session", 25);

		expect(session.id).toBe("s1");
		expect(session.type).toBe("event-storming");
		expect(session.title).toBe("My Session");
		expect(session.status).toBe("prepared");
		expect(session.durationMinutes).toBe(25);
		expect(session.createdAt).toBe("2026-02-16T10:00:00.000Z");
		expect(session.startedAt).toBeNull();
		expect(session.pausedAt).toBeNull();
		expect(session.elapsedBeforePauseMs).toBe(0);
		expect(session.completedAt).toBeNull();
		expect(session.artifacts).toEqual([]);
		expect(session.notes).toBe("");
		expect(session.focusFile).toBeNull();
	});

	it("creates a session with a focus file", () => {
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const session = createSession("s2", "service-design", "Focused", 50, "docs/my-feature.md");

		expect(session.focusFile).toBe("docs/my-feature.md");
		expect(session.type).toBe("service-design");
		expect(session.durationMinutes).toBe(50);
	});

	it("accepts all session types", () => {
		const types: Array<import("../../../src/domain/session/types").SessionType> = [
			"event-storming",
			"service-design",
			"requirements-refinement",
			"backlog-structuring",
			"knowledge-cleanup",
		];
		for (const type of types) {
			const session = createSession("id", type, "title", 50);
			expect(session.type).toBe(type);
			expect(session.durationMinutes).toBe(50);
		}
	});
});
