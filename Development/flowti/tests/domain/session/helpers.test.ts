import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	computeRemainingMs,
	computeElapsedMs,
	isTimerExpired,
	formatDuration,
	createSession,
	createGoal,
	createDecision,
	computePauseSegments,
	computeTotalPauseMs,
	computeWallClockMs,
	computeActiveTimeMs,
	computeTimelineSummary,
	formatDurationHuman,
	generateSessionSummary,
	generateSessionFrontmatter,
	generateSessionSummaryBody,
	mergeSessionNotes,
	createContextBinding,
	resolveTypeConfig,
	resolvePlaceholder,
	generateSessionOutput,
	BUILT_IN_OUTPUT_TEMPLATES,
	parseSectionCheckboxes,
	parseSectionText,
	reverseParseSessionNotes,
	computeReverseSyncDiff,
	detectCognitiveOverload,
	computeActivityIntelligence,
} from "../../../src/domain/session/helpers";
import type { Session, SessionOutputTemplate, SessionTimelineEntry, SessionTypeConfig } from "../../../src/domain/session/types";
import { SESSION_TYPE_CONFIGS, DEFAULT_COGNITIVE_LOAD_THRESHOLDS } from "../../../src/domain/session/types";

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
		timeline: [],
		goals: [],
		links: [],
		notesFile: null,
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
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
		expect(session.timeline).toEqual([]);
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

// ─────────────────────────────────────────────────────────────
// computePauseSegments
// ─────────────────────────────────────────────────────────────

describe("computePauseSegments", () => {
	it("returns empty array for session with no timeline", () => {
		const session = makeSession();
		expect(computePauseSegments(session)).toEqual([]);
	});

	it("returns empty array when no pauses occurred", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
		});
		expect(computePauseSegments(session)).toEqual([]);
	});

	it("returns single segment for one pause+resume", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:05:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:08:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
		});
		const segments = computePauseSegments(session);
		expect(segments).toHaveLength(1);
		expect(segments[0].pausedAt).toBe("2026-02-16T10:05:00.000Z");
		expect(segments[0].resumedAt).toBe("2026-02-16T10:08:00.000Z");
		expect(segments[0].durationMs).toBe(3 * 60_000);
	});

	it("returns multiple segments for multiple pause/resume cycles", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:05:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:07:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:15:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:20:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
		});
		const segments = computePauseSegments(session);
		expect(segments).toHaveLength(2);
		expect(segments[0].durationMs).toBe(2 * 60_000);
		expect(segments[1].durationMs).toBe(5 * 60_000);
	});

	it("handles ongoing pause (no resume yet)", () => {
		const now = Date.parse("2026-02-16T10:12:00.000Z");
		const session = makeSession({
			status: "paused",
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
			],
		});
		const segments = computePauseSegments(session, now);
		expect(segments).toHaveLength(1);
		expect(segments[0].resumedAt).toBeNull();
		expect(segments[0].durationMs).toBe(2 * 60_000);
	});

	it("handles pause ended by completion (no explicit resume)", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:05:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:10:00.000Z" },
			],
		});
		const segments = computePauseSegments(session);
		expect(segments).toHaveLength(1);
		expect(segments[0].resumedAt).toBe("2026-02-16T10:10:00.000Z");
		expect(segments[0].durationMs).toBe(5 * 60_000);
	});
});

// ─────────────────────────────────────────────────────────────
// computeTotalPauseMs
// ─────────────────────────────────────────────────────────────

describe("computeTotalPauseMs", () => {
	it("returns 0 when no pauses", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
		});
		expect(computeTotalPauseMs(session)).toBe(0);
	});

	it("returns sum of multiple pause segments", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:05:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:07:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:15:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:20:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
		});
		expect(computeTotalPauseMs(session)).toBe(7 * 60_000); // 2 + 5
	});
});

// ─────────────────────────────────────────────────────────────
// computeWallClockMs
// ─────────────────────────────────────────────────────────────

describe("computeWallClockMs", () => {
	it("returns 0 for session with no started entry", () => {
		const session = makeSession();
		expect(computeWallClockMs(session)).toBe(0);
	});

	it("returns time from first start to completedAt", () => {
		const session = makeSession({
			completedAt: "2026-02-16T10:30:00.000Z",
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:30:00.000Z" },
			],
		});
		expect(computeWallClockMs(session)).toBe(30 * 60_000);
	});

	it("returns time from first start to now for active sessions", () => {
		const now = Date.parse("2026-02-16T10:15:00.000Z");
		const session = makeSession({
			status: "active",
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
			],
		});
		expect(computeWallClockMs(session, now)).toBe(15 * 60_000);
	});
});

// ─────────────────────────────────────────────────────────────
// computeActiveTimeMs
// ─────────────────────────────────────────────────────────────

describe("computeActiveTimeMs", () => {
	it("equals wall clock when no pauses", () => {
		const session = makeSession({
			completedAt: "2026-02-16T10:25:00.000Z",
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
		});
		expect(computeActiveTimeMs(session)).toBe(25 * 60_000);
	});

	it("equals wall clock minus pause time with pauses", () => {
		const session = makeSession({
			completedAt: "2026-02-16T10:30:00.000Z",
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:15:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:30:00.000Z" },
			],
		});
		// wall = 30min, pause = 5min, active = 25min
		expect(computeActiveTimeMs(session)).toBe(25 * 60_000);
	});
});

// ─────────────────────────────────────────────────────────────
// computeTimelineSummary
// ─────────────────────────────────────────────────────────────

describe("computeTimelineSummary", () => {
	it("returns zero-valued summary for empty timeline", () => {
		const summary = computeTimelineSummary(makeSession());
		expect(summary.wallClockMs).toBe(0);
		expect(summary.activeTimeMs).toBe(0);
		expect(summary.totalPauseMs).toBe(0);
		expect(summary.pauseCount).toBe(0);
		expect(summary.pauseSegments).toEqual([]);
	});

	it("returns complete summary for a session with pauses", () => {
		const session = makeSession({
			completedAt: "2026-02-16T10:30:00.000Z",
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:12:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:20:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:25:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:30:00.000Z" },
			],
		});
		const summary = computeTimelineSummary(session);
		expect(summary.wallClockMs).toBe(30 * 60_000);
		expect(summary.totalPauseMs).toBe(7 * 60_000); // 2 + 5
		expect(summary.activeTimeMs).toBe(23 * 60_000);
		expect(summary.pauseCount).toBe(2);
		expect(summary.pauseSegments).toHaveLength(2);
	});
});

// ─────────────────────────────────────────────────────────────
// formatDurationHuman
// ─────────────────────────────────────────────────────────────

describe("formatDurationHuman", () => {
	it("formats seconds only", () => {
		expect(formatDurationHuman(45_000)).toBe("45s");
	});

	it("formats minutes and seconds", () => {
		expect(formatDurationHuman(5 * 60_000 + 30_000)).toBe("5m 30s");
	});

	it("formats hours and minutes", () => {
		expect(formatDurationHuman(3600_000 + 12 * 60_000)).toBe("1h 12m");
	});

	it("formats 0 ms as 0s", () => {
		expect(formatDurationHuman(0)).toBe("0s");
	});

	it("handles negative as 0s", () => {
		expect(formatDurationHuman(-5000)).toBe("0s");
	});

	it("truncates sub-second precision", () => {
		expect(formatDurationHuman(61_500)).toBe("1m 1s");
	});
});

// ─────────────────────────────────────────────────────────────
// createGoal
// ─────────────────────────────────────────────────────────────

describe("createGoal", () => {
	it("creates a goal with default values", () => {
		const goal = createGoal("goal_1", "Finish review");

		expect(goal.id).toBe("goal_1");
		expect(goal.text).toBe("Finish review");
		expect(goal.completed).toBe(false);
		expect(goal.completedAt).toBeNull();
	});

	it("creates distinct goals for different IDs", () => {
		const g1 = createGoal("goal_a", "First");
		const g2 = createGoal("goal_b", "Second");

		expect(g1.id).not.toBe(g2.id);
		expect(g1.text).not.toBe(g2.text);
	});
});

// ─────────────────────────────────────────────────────────────
// createSession — goals field
// ─────────────────────────────────────────────────────────────

describe("createSession — goals", () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it("creates a session with empty goals array", () => {
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const session = createSession("s1", "event-storming", "Test", 25);
		expect(session.goals).toEqual([]);
	});
});

describe("createSession — links", () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it("creates a session with empty links array", () => {
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const session = createSession("s1", "event-storming", "Test", 25);
		expect(session.links).toEqual([]);
	});
});

describe("createSession — notesFile", () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it("creates a session with null notesFile", () => {
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const session = createSession("s1", "event-storming", "Test", 25);
		expect(session.notesFile).toBeNull();
	});
});

// ─────────────────────────────────────────────────────────────
// generateSessionSummary
// ─────────────────────────────────────────────────────────────

describe("generateSessionFrontmatter", () => {
	it("sets type to SessionNote and sessionType to the session type", () => {
		const session = makeSession({ type: "event-storming" });
		const fm = generateSessionFrontmatter(session);
		expect(fm.type).toBe("SessionNote");
		expect(fm.sessionType).toBe("event-storming");
	});

	it("includes core session fields", () => {
		const session = makeSession({
			title: "Sprint Planning",
			type: "event-storming",
			status: "completed",
			durationMinutes: 25,
			completedAt: "2026-02-16T10:25:00.000Z",
		});
		const fm = generateSessionFrontmatter(session);
		expect(fm.title).toBe("Sprint Planning");
		expect(fm.type).toBe("SessionNote");
		expect(fm.sessionType).toBe("event-storming");
		expect(fm.status).toBe("completed");
		expect(fm.duration).toBe(25);
		expect(fm.completed).toBe("2026-02-16T10:25:00.000Z");
		expect(fm.sessionId).toBe("test-1");
	});

	it("includes optional context fields when set", () => {
		const session = makeSession({ focusFile: "src/main.ts", canvasFile: "canvas.canvas" });
		const fm = generateSessionFrontmatter(session);
		expect(fm.focusFile).toBe("src/main.ts");
		expect(fm.canvasFile).toBe("canvas.canvas");
	});

	it("omits optional fields when null", () => {
		const session = makeSession({ focusFile: null, canvasFile: null, completedAt: null });
		const fm = generateSessionFrontmatter(session);
		expect(fm.focusFile).toBeUndefined();
		expect(fm.canvasFile).toBeUndefined();
		expect(fm.completed).toBeUndefined();
	});

	it("includes energy when set", () => {
		const session = makeSession({ energy: 4 });
		const fm = generateSessionFrontmatter(session);
		expect(fm.energy).toBe(4);
	});

	it("omits energy when null", () => {
		const session = makeSession({ energy: null });
		const fm = generateSessionFrontmatter(session);
		expect(fm.energy).toBeUndefined();
	});

	it("includes intent as flat string", () => {
		const session = makeSession({
			intent: { primaryOutcome: "Deliver FR-15", mode: "deep-work" },
		});
		const fm = generateSessionFrontmatter(session);
		expect(fm.intent).toBe("Deliver FR-15");
	});

	it("omits intent when null", () => {
		const session = makeSession({ intent: null });
		const fm = generateSessionFrontmatter(session);
		expect(fm.intent).toBeUndefined();
	});

	it("includes activity intelligence metrics when non-zero", () => {
		const session = makeSession({
			startedAt: "2026-02-20T10:00:00.000Z",
			completedAt: "2026-02-20T10:30:00.000Z",
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/b.ts", action: "created", timestamp: "2026-02-20T10:10:00.000Z" },
			],
			artifacts: [
				{ path: "src/a.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
			],
			executionTasks: [
				{ id: "t1", label: "Done", completed: true, order: 0 },
			],
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "completed", timestamp: "2026-02-20T10:30:00.000Z" },
			],
		});
		const fm = generateSessionFrontmatter(session);
		expect(fm.filesModified).toBe(2);
		expect(fm.artifactsProduced).toBe(1);
		expect(fm.tasksCompleted).toBe(1);
		expect(fm.eventsEmitted).toBe(2);
		expect(fm.wallClockMs).toBe(30 * 60_000);
		expect(fm.activeTimeMs).toBe(30 * 60_000);
		expect(fm.pauseTimeMs).toBeUndefined();
	});

	it("omits activity intelligence metrics when all zero", () => {
		const session = makeSession();
		const fm = generateSessionFrontmatter(session);
		expect(fm.filesModified).toBeUndefined();
		expect(fm.artifactsProduced).toBeUndefined();
		expect(fm.tasksCompleted).toBeUndefined();
		expect(fm.eventsEmitted).toBeUndefined();
		expect(fm.wallClockMs).toBeUndefined();
		expect(fm.activeTimeMs).toBeUndefined();
		expect(fm.pauseTimeMs).toBeUndefined();
	});
});

describe("generateSessionSummaryBody", () => {
	it("starts with session summary marker", () => {
		const session = makeSession();
		const body = generateSessionSummaryBody(session);
		expect(body).toMatch(/^## Session Summary/);
	});

	it("includes goals with checkmarks", () => {
		const session = makeSession({
			goals: [
				{ id: "g1", text: "Write tests", completed: true, completedAt: "2026-02-16T10:20:00.000Z" },
				{ id: "g2", text: "Update docs", completed: false, completedAt: null },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Goals");
		expect(body).toContain("- [x] Write tests");
		expect(body).toContain("- [ ] Update docs");
	});

	it("does not include links section (merged into context bindings)", () => {
		const session = makeSession({
			links: [{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" }],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Links");
	});

	it("aggregates artifacts into Activity Intelligence instead of separate section", () => {
		const session = makeSession({
			artifacts: [{ path: "src/types.ts", action: "created", timestamp: "2026-02-16T10:05:00.000Z" }],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Artifacts");
		expect(body).toContain("### Activity Intelligence");
		expect(body).toContain("**Artifacts produced:** 1");
	});

	it("omits optional sections when empty", () => {
		const session = makeSession({ goals: [], links: [], artifacts: [], notes: "" });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Goals");
		expect(body).not.toContain("### Links");
		expect(body).not.toContain("### Session Notes");
	});

	it("includes decisions section with title and description", () => {
		const session = makeSession({
			decisions: [
				{ id: "d1", title: "Use EventBus", description: "For decoupled communication", recordedAt: "2026-02-16T10:10:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Decisions");
		expect(body).toContain("**Use EventBus**: For decoupled communication");
	});

	it("includes decision context when present", () => {
		const session = makeSession({
			decisions: [
				{ id: "d1", title: "Use DDD", description: "Domain-driven design", recordedAt: "2026-02-16T10:10:00.000Z", context: "architecture review" },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("*(architecture review)*");
	});

	it("omits decisions section when empty", () => {
		const session = makeSession({ decisions: [] });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Decisions");
	});

	it("renders decision with title only (no description)", () => {
		const session = makeSession({
			decisions: [
				{ id: "d1", title: "Use EventBus", recordedAt: "2026-02-16T10:10:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("- **Use EventBus**");
		expect(body).not.toContain("- **Use EventBus**:");
	});

	it("includes energy level when set", () => {
		const session = makeSession({ energy: 4 });
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("**Energy:**");
		expect(body).toContain("Good");
		expect(body).toContain("(4/5)");
	});

	it("omits energy when null", () => {
		const session = makeSession({ energy: null });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("**Energy:**");
	});

	it("renders energy with correct label for each level", () => {
		const labels: Record<number, string> = { 1: "Drained", 2: "Low", 3: "Moderate", 4: "Good", 5: "Energized" };
		for (const [level, label] of Object.entries(labels)) {
			const session = makeSession({ energy: Number(level) as 1 | 2 | 3 | 4 | 5 });
			const body = generateSessionSummaryBody(session);
			expect(body).toContain(label);
			expect(body).toContain(`(${level}/5)`);
		}
	});

	it("places energy before guiding questions", () => {
		const session = makeSession({ energy: 3 });
		const body = generateSessionSummaryBody(session);
		const energyIdx = body.indexOf("**Energy:**");
		const questionsIdx = body.indexOf("### Guiding Questions");
		expect(energyIdx).toBeGreaterThan(-1);
		expect(questionsIdx).toBeGreaterThan(-1);
		expect(energyIdx).toBeLessThan(questionsIdx);
	});

	it("includes execution plan section with checkmarks", () => {
		const session = makeSession({
			executionTasks: [
				{ id: "t1", label: "Write tests", completed: true, completedAt: "2026-02-16T10:10:00.000Z", order: 0 },
				{ id: "t2", label: "Update docs", completed: false, order: 1 },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Execution Plan");
		expect(body).toContain("- [x] Write tests");
		expect(body).toContain("- [ ] Update docs");
	});

	it("omits execution plan section when empty", () => {
		const session = makeSession({ executionTasks: [] });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Execution Plan");
	});

	it("renders execution plan sorted by order", () => {
		const session = makeSession({
			executionTasks: [
				{ id: "t2", label: "Second", completed: false, order: 1 },
				{ id: "t1", label: "First", completed: false, order: 0 },
			],
		});
		const body = generateSessionSummaryBody(session);
		const firstIdx = body.indexOf("- [ ] First");
		const secondIdx = body.indexOf("- [ ] Second");
		expect(firstIdx).toBeLessThan(secondIdx);
	});

	it("places execution plan between goals and context bindings", () => {
		const session = makeSession({
			goals: [{ id: "g1", text: "Test goal", completed: false, completedAt: null }],
			executionTasks: [{ id: "t1", label: "Test task", completed: false, order: 0 }],
			contextBindings: [{ id: "ctx1", path: "src/main.ts", type: "file", label: "main.ts", boundAt: "2026-02-16T10:00:00.000Z" }],
		});
		const body = generateSessionSummaryBody(session);
		const goalsIdx = body.indexOf("### Goals");
		const execIdx = body.indexOf("### Execution Plan");
		const ctxIdx = body.indexOf("### Context Bindings");
		expect(goalsIdx).toBeLessThan(execIdx);
		expect(execIdx).toBeLessThan(ctxIdx);
	});

	it("includes reflections section with category icons", () => {
		const session = makeSession({
			reflections: [
				{ id: "r1", type: "observation", content: "Code is clean", timestamp: "2026-02-16T10:10:00.000Z" },
				{ id: "r2", type: "blocker", content: "API not ready", timestamp: "2026-02-16T10:11:00.000Z" },
				{ id: "r3", type: "idea", content: "Use caching", timestamp: "2026-02-16T10:12:00.000Z" },
				{ id: "r4", type: "decision", content: "Go with plan B", timestamp: "2026-02-16T10:13:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Reflections");
		expect(body).toContain("👁 **[observation]** Code is clean");
		expect(body).toContain("🚫 **[blocker]** API not ready");
		expect(body).toContain("💡 **[idea]** Use caching");
		expect(body).toContain("⚖️ **[decision]** Go with plan B");
	});

	it("omits reflections section when empty", () => {
		const session = makeSession({ reflections: [] });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Reflections");
	});

	it("places reflections between decisions and context bindings", () => {
		const session = makeSession({
			decisions: [{ id: "d1", title: "Use DDD", recordedAt: "2026-02-16T10:10:00.000Z" }],
			reflections: [{ id: "r1", type: "observation", content: "Good approach", timestamp: "2026-02-16T10:11:00.000Z" }],
			contextBindings: [{ id: "ctx1", path: "src/main.ts", type: "file", label: "main.ts", boundAt: "2026-02-16T10:00:00.000Z" }],
		});
		const body = generateSessionSummaryBody(session);
		const decIdx = body.indexOf("### Decisions");
		const refIdx = body.indexOf("### Reflections");
		const ctxIdx = body.indexOf("### Context Bindings");
		expect(decIdx).toBeLessThan(refIdx);
		expect(refIdx).toBeLessThan(ctxIdx);
	});

	it("includes closure ritual section with all built-in fields", () => {
		const session = makeSession({
			closureResponse: {
				outcomeAchieved: "partial",
				whatWorked: "Focused execution on core logic",
				whatDidnt: "Got distracted by refactoring",
				nextAction: "Finish remaining tests",
				answers: {},
			},
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Closure Ritual");
		expect(body).toContain("**Outcome achieved:** partial");
		expect(body).toContain("**What worked:** Focused execution on core logic");
		expect(body).toContain("**What didn't:** Got distracted by refactoring");
		expect(body).toContain("**Next action:** Finish remaining tests");
	});

	it("includes custom closure answers", () => {
		const session = makeSession({
			closureResponse: {
				outcomeAchieved: "yes",
				whatWorked: "Good flow",
				whatDidnt: "",
				nextAction: "",
				answers: { "Satisfaction": "4", "Key insight": "Smaller increments work better" },
			},
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("**Satisfaction:** 4");
		expect(body).toContain("**Key insight:** Smaller increments work better");
	});

	it("omits closure ritual section when no closure response", () => {
		const session = makeSession({ closureResponse: null });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Closure Ritual");
	});

	it("omits empty closure fields", () => {
		const session = makeSession({
			closureResponse: {
				outcomeAchieved: "no",
				whatWorked: "",
				whatDidnt: "",
				nextAction: "",
				answers: { "Extra": "" },
			},
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("**Outcome achieved:** no");
		expect(body).not.toContain("**What worked:**");
		expect(body).not.toContain("**What didn't:**");
		expect(body).not.toContain("**Next action:**");
		expect(body).not.toContain("**Extra:**");
	});

	it("places closure ritual between reflections and context bindings", () => {
		const session = makeSession({
			reflections: [{ id: "r1", type: "observation", content: "Good", timestamp: "2026-02-16T10:10:00.000Z" }],
			closureResponse: {
				outcomeAchieved: "yes",
				whatWorked: "Focus",
				whatDidnt: "",
				nextAction: "",
				answers: {},
			},
			contextBindings: [{ id: "ctx1", path: "src/main.ts", type: "file", label: "main.ts", boundAt: "2026-02-16T10:00:00.000Z" }],
		});
		const body = generateSessionSummaryBody(session);
		const refIdx = body.indexOf("### Reflections");
		const closureIdx = body.indexOf("### Closure Ritual");
		const ctxIdx = body.indexOf("### Context Bindings");
		expect(refIdx).toBeLessThan(closureIdx);
		expect(closureIdx).toBeLessThan(ctxIdx);
	});

	it("includes Activity Intelligence section with all metrics", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/b.ts", action: "created", timestamp: "2026-02-20T10:10:00.000Z" },
			],
			artifacts: [
				{ path: "src/a.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
			],
			executionTasks: [
				{ id: "t1", label: "Done", completed: true, order: 0 },
			],
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "completed", timestamp: "2026-02-20T10:30:00.000Z" },
			],
			startedAt: "2026-02-20T10:00:00.000Z",
			completedAt: "2026-02-20T10:30:00.000Z",
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Activity Intelligence");
		expect(body).toContain("**Files modified:** 2");
		expect(body).toContain("**Artifacts produced:** 1");
		expect(body).toContain("**Tasks completed:** 1");
		expect(body).toContain("**Events emitted:** 2");
		expect(body).toContain("**Wall clock:**");
		expect(body).toContain("**Active time:**");
		// No separate sections — all aggregated
		expect(body).not.toContain("### Artifacts");
		expect(body).not.toContain("### Time Summary");
	});

	it("omits Activity Intelligence section when no activity data", () => {
		const session = makeSession();
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Activity Intelligence");
		expect(body).not.toContain("### Time Summary");
	});

	it("includes pause time in Activity Intelligence when session was paused", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
			],
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-20T10:10:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-20T10:15:00.000Z" },
				{ action: "completed", timestamp: "2026-02-20T10:30:00.000Z" },
			],
			startedAt: "2026-02-20T10:00:00.000Z",
			completedAt: "2026-02-20T10:30:00.000Z",
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("**Pause time:**");
	});

	it("includes artifact wiki-links inside Activity Intelligence section", () => {
		const session = makeSession({
			artifacts: [
				{ path: "src/types.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/helpers.ts", action: "modified", timestamp: "2026-02-20T10:10:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("**Artifacts:**");
		expect(body).toContain("- [[src/types.ts]] *(created)*");
		expect(body).toContain("- [[src/helpers.ts]] *(modified)*");
	});

	it("omits artifact links sub-section when no artifacts", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
			],
			artifacts: [],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Activity Intelligence");
		expect(body).not.toContain("**Artifacts:**");
	});

	it("excludes filtered activity from Activity Intelligence metrics", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
				{ path: "node_modules/lib/b.ts", action: "modified", timestamp: "2026-02-20T10:01:00.000Z" },
				{ path: "src/c.ts", action: "created", timestamp: "2026-02-20T10:02:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session, ["node_modules/"]);
		expect(body).toContain("**Files modified:** 2");
	});

	it("excludes filtered artifacts from links and count", () => {
		const session = makeSession({
			artifacts: [
				{ path: "src/types.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "dist/bundle.js", action: "created", timestamp: "2026-02-20T10:10:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session, ["dist/"]);
		expect(body).toContain("**Artifacts produced:** 1");
		expect(body).toContain("- [[src/types.ts]] *(created)*");
		expect(body).not.toContain("dist/bundle.js");
	});

	it("respects per-session activityFilter for artifacts", () => {
		const session = makeSession({
			artifacts: [
				{ path: "src/types.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "tests/types.test.ts", action: "created", timestamp: "2026-02-20T10:10:00.000Z" },
			],
			activityFilter: ["tests/"],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("**Artifacts produced:** 1");
		expect(body).toContain("- [[src/types.ts]] *(created)*");
		expect(body).not.toContain("tests/types.test.ts");
	});

	it("retroactively filters entries stored before filter was configured", () => {
		// Activity was stored without filter, now filter is set — entries must be excluded at render time
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
				{ path: "vendor/lib.js", action: "modified", timestamp: "2026-02-20T10:01:00.000Z" },
			],
			artifacts: [
				{ path: "vendor/output.js", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
			],
		});
		const body = generateSessionSummaryBody(session, ["vendor/"]);
		expect(body).toContain("**Files modified:** 1");
		expect(body).toContain("**Artifacts produced:** 0");
		expect(body).not.toContain("vendor/");
	});
});

describe("generateSessionSummary", () => {
	it("generates frontmatter + title + body", () => {
		const session = makeSession({
			title: "Sprint Planning",
			type: "event-storming",
			status: "completed",
			durationMinutes: 25,
			completedAt: "2026-02-16T10:25:00.000Z",
		});
		const md = generateSessionSummary(session);
		expect(md).toContain("---");
		expect(md).toContain('type: "SessionNote"');
		expect(md).toContain('title: "Sprint Planning"');
		expect(md).toContain('sessionType: "event-storming"');
		expect(md).toContain('status: "completed"');
		expect(md).toContain("# Sprint Planning");
		expect(md).toContain("## Session Summary");
	});

	it("includes goals and aggregated artifacts in body", () => {
		const session = makeSession({
			goals: [
				{ id: "g1", text: "Write tests", completed: true, completedAt: "2026-02-16T10:20:00.000Z" },
			],
			artifacts: [{ path: "src/types.ts", action: "created", timestamp: "2026-02-16T10:05:00.000Z" }],
		});
		const md = generateSessionSummary(session);
		expect(md).toContain("### Goals");
		expect(md).toContain("- [x] Write tests");
		expect(md).toContain("**Artifacts produced:** 1");
	});

	it("includes focus file in frontmatter", () => {
		const session = makeSession({ focusFile: "src/main.ts" });
		const md = generateSessionSummary(session);
		expect(md).toContain('focusFile: "src/main.ts"');
	});

	it("includes session notes in body", () => {
		const session = makeSession({ notes: "Important findings here" });
		const md = generateSessionSummary(session);
		expect(md).toContain("### Session Notes");
		expect(md).toContain("Important findings here");
	});

	it("includes timeline and time metrics in Activity Intelligence", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-16T10:12:00.000Z" },
				{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
			],
			completedAt: "2026-02-16T10:25:00.000Z",
		});
		const md = generateSessionSummary(session);
		expect(md).toContain("### Timeline");
		expect(md).toContain("### Activity Intelligence");
		expect(md).toContain("**Wall clock:**");
		expect(md).toContain("**Active time:**");
		expect(md).toContain("**Pause time:**");
	});
});

describe("mergeSessionNotes", () => {
	it("preserves user content before session summary", () => {
		const existing = [
			"---",
			'title: "My Session"',
			'status: "active"',
			"---",
			"",
			"# My Session",
			"",
			"User wrote this paragraph during the session.",
			"",
			"## Session Summary",
			"",
			"### Goals",
			"- [ ] Old goal",
			"",
		].join("\n");
		const session = makeSession({
			title: "My Session",
			status: "completed",
			goals: [{ id: "g1", text: "New goal", completed: true, completedAt: "2026-02-16T10:20:00.000Z" }],
		});
		const result = mergeSessionNotes(existing, session);
		expect(result).toContain("User wrote this paragraph during the session.");
		expect(result).toContain("### Goals");
		expect(result).toContain("- [x] New goal");
		expect(result).not.toContain("- [ ] Old goal");
	});

	it("updates frontmatter while preserving user-added fields", () => {
		const existing = [
			"---",
			'title: "Old Title"',
			'status: "active"',
			'myCustomField: "keep me"',
			"---",
			"",
			"Some content.",
			"",
		].join("\n");
		const session = makeSession({ title: "Updated Title", status: "completed" });
		const result = mergeSessionNotes(existing, session);
		expect(result).toContain('title: "Updated Title"');
		expect(result).toContain('status: "completed"');
		expect(result).toContain('myCustomField: "keep me"');
	});

	it("handles file with no frontmatter", () => {
		const existing = "# My notes\n\nSome user content.\n";
		const session = makeSession({ title: "Test" });
		const result = mergeSessionNotes(existing, session);
		expect(result).toContain("---");
		expect(result).toContain('title: "Test"');
		expect(result).toContain("# My notes");
		expect(result).toContain("Some user content.");
		expect(result).toContain("## Session Summary");
	});

	it("handles file with no session summary marker", () => {
		const existing = [
			"---",
			'title: "My Session"',
			"---",
			"",
			"User content without summary.",
			"",
		].join("\n");
		const session = makeSession();
		const result = mergeSessionNotes(existing, session);
		expect(result).toContain("User content without summary.");
		expect(result).toContain("## Session Summary");
	});

	it("handles empty file", () => {
		const session = makeSession({ title: "Fresh" });
		const result = mergeSessionNotes("", session);
		expect(result).toContain("---");
		expect(result).toContain('title: "Fresh"');
		expect(result).toContain("## Session Summary");
	});
});

// ─────────────────────────────────────────────────────────────
// createContextBinding
// ─────────────────────────────────────────────────────────────

describe("createContextBinding", () => {
	it("derives label from folder name", () => {
		const binding = createContextBinding("id-1", "folder", "src/domain/session/");
		expect(binding.label).toBe("session");
	});

	it("derives label from file basename without extension", () => {
		const binding = createContextBinding("id-2", "file", "src/domain/session/types.ts");
		expect(binding.label).toBe("types");
	});

	it("sets boundAt to ISO timestamp", () => {
		const binding = createContextBinding("id-3", "domain", "src/domain/session/");
		const parsed = Date.parse(binding.boundAt);
		expect(Number.isNaN(parsed)).toBe(false);
		expect(binding.boundAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	it("preserves type and path", () => {
		const binding = createContextBinding("id-4", "feature", "src/domain/session/helpers.ts");
		expect(binding.type).toBe("feature");
		expect(binding.path).toBe("src/domain/session/helpers.ts");
	});
});

// ─────────────────────────────────────────────────────────────
// SESSION_TYPE_CONFIGS registry
// ─────────────────────────────────────────────────────────────

describe("SESSION_TYPE_CONFIGS", () => {
	it("has 11 pre-built type configs", () => {
		expect(Object.keys(SESSION_TYPE_CONFIGS)).toHaveLength(11);
	});

	it("includes all 10 session types", () => {
		const types = Object.keys(SESSION_TYPE_CONFIGS);
		expect(types).toContain("documentation");
		expect(types).toContain("event-storming");
		expect(types).toContain("service-design");
		expect(types).toContain("domain-design");
		expect(types).toContain("requirements-refinement");
		expect(types).toContain("backlog-structuring");
		expect(types).toContain("knowledge-cleanup");
		expect(types).toContain("vault-hygiene");
		expect(types).toContain("daily-tracking");
		expect(types).toContain("train-of-thought");
	});

	it("each config has required fields", () => {
		for (const [key, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			expect(config.type).toBe(key);
			expect(config.label).toBeTruthy();
			expect(config.icon).toBeTruthy();
			expect(Array.isArray(config.guidingQuestions)).toBe(true);
			expect(typeof config.defaultDuration).toBe("number");
			expect(Array.isArray(config.defaultGoals)).toBe(true);
		}
	});

	it("vault-hygiene has 15 min default, domain-design has 50 min", () => {
		expect(SESSION_TYPE_CONFIGS["vault-hygiene"].defaultDuration).toBe(15);
		expect(SESSION_TYPE_CONFIGS["domain-design"].defaultDuration).toBe(50);
	});
});

// ─────────────────────────────────────────────────────────────
// resolveTypeConfig
// ─────────────────────────────────────────────────────────────

describe("resolveTypeConfig", () => {
	it("returns built-in config for known type", () => {
		const config = resolveTypeConfig("event-storming");
		expect(config.type).toBe("event-storming");
		expect(config.label).toBe("Event Storming");
		expect(config.defaultDuration).toBe(50);
	});

	it("returns documentation config for each built-in type", () => {
		const docConfig = resolveTypeConfig("documentation");
		expect(docConfig.type).toBe("documentation");
		expect(docConfig.label).toBe("Documentation");
	});

	it("returns domain-design config", () => {
		const config = resolveTypeConfig("domain-design");
		expect(config.type).toBe("domain-design");
		expect(config.guidingQuestions).toContain("What are the bounded contexts?");
	});

	it("returns custom config when provided and matching", () => {
		const custom: Record<string, SessionTypeConfig> = {
			"event-storming": {
				type: "event-storming",
				label: "Custom Storming",
				icon: "custom-icon",
				guidingQuestions: ["Custom question?"],
				defaultDuration: 99,
				defaultGoals: ["Custom goal"],
			},
		};
		const config = resolveTypeConfig("event-storming", custom);
		expect(config.label).toBe("Custom Storming");
		expect(config.defaultDuration).toBe(99);
	});

	it("falls back to built-in when custom does not match", () => {
		const custom: Record<string, SessionTypeConfig> = {
			"event-storming": {
				type: "event-storming",
				label: "Custom",
				icon: "x",
				guidingQuestions: [],
				defaultDuration: 10,
				defaultGoals: [],
			},
		};
		const config = resolveTypeConfig("service-design", custom);
		expect(config.type).toBe("service-design");
		expect(config.label).toBe("Service Design");
	});

	it("returns documentation config as fallback for empty custom map", () => {
		const config = resolveTypeConfig("documentation", {});
		expect(config.type).toBe("documentation");
	});

	it("custom config takes priority over built-in", () => {
		const custom: Record<string, SessionTypeConfig> = {
			"documentation": {
				type: "documentation",
				label: "My Docs",
				icon: "pencil",
				guidingQuestions: ["What to write?"],
				defaultDuration: 30,
				defaultGoals: ["Draft outline"],
			},
		};
		const config = resolveTypeConfig("documentation", custom);
		expect(config.label).toBe("My Docs");
		expect(config.defaultDuration).toBe(30);
		expect(config.defaultGoals).toEqual(["Draft outline"]);
	});
});

// ─────────────────────────────────────────────────────────────
// createDecision
// ─────────────────────────────────────────────────────────────

describe("createDecision", () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it("creates a decision with required fields", () => {
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		const d = createDecision("d1", "Use DDD", "Domain-driven design");
		expect(d.id).toBe("d1");
		expect(d.title).toBe("Use DDD");
		expect(d.description).toBe("Domain-driven design");
		expect(d.recordedAt).toBe("2026-02-18T14:00:00.000Z");
		expect(d.context).toBeUndefined();
	});

	it("creates a decision with title only", () => {
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		const d = createDecision("d3", "Use DDD");
		expect(d.title).toBe("Use DDD");
		expect(d.description).toBeUndefined();
		expect(d.context).toBeUndefined();
	});

	it("includes optional context", () => {
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		const d = createDecision("d2", "Use Redis", "For caching", "performance review");
		expect(d.context).toBe("performance review");
	});
});

// ─────────────────────────────────────────────────────────────
// createSession — decisions
// ─────────────────────────────────────────────────────────────

describe("createSession — decisions", () => {
	it("creates a session with empty decisions array", () => {
		const session = createSession("s1", "documentation", "Test", 25);
		expect(session.decisions).toEqual([]);
	});
});

describe("createSession — outputArtifacts", () => {
	it("creates a session with empty outputArtifacts array", () => {
		const session = createSession("s1", "documentation", "Test", 25);
		expect(session.outputArtifacts).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────
// Session Output Artifacts
// ─────────────────────────────────────────────────────────────

describe("BUILT_IN_OUTPUT_TEMPLATES", () => {
	it("has 3 templates", () => {
		expect(BUILT_IN_OUTPUT_TEMPLATES).toHaveLength(3);
	});

	it("has meeting-invite, action-items, and review-summary types", () => {
		const types = BUILT_IN_OUTPUT_TEMPLATES.map((t) => t.type);
		expect(types).toEqual(["meeting-invite", "action-items", "review-summary"]);
	});
});

describe("resolvePlaceholder", () => {
	const session = makeSession({
		title: "Sprint Review",
		type: "documentation",
		completedAt: "2026-02-18T12:00:00.000Z",
		createdAt: "2026-02-18T10:00:00.000Z",
		startedAt: null,
		elapsedBeforePauseMs: 1500000, // 25 minutes
		goals: [
			{ id: "g1", text: "Review architecture", completed: true, completedAt: "2026-02-18T11:00:00.000Z" },
			{ id: "g2", text: "Draft ADR", completed: false, completedAt: null },
		],
		decisions: [
			{ id: "d1", title: "Use EventBus", description: "For decoupled comms", recordedAt: "2026-02-18T11:30:00.000Z" },
			{ id: "d2", title: "Separate models", recordedAt: "2026-02-18T11:45:00.000Z" },
		],
		artifacts: [
			{ path: "notes/design.md", action: "created", timestamp: "2026-02-18T11:00:00.000Z" },
		],
		contextBindings: [
			{ id: "b1", type: "domain", label: "Session Domain", path: "domains/session", boundAt: "2026-02-18T10:00:00.000Z" },
		],
		notes: "Some session notes here.",
	});

	it("resolves {{title}}", () => {
		expect(resolvePlaceholder("{{title}}", session)).toBe("Sprint Review");
	});

	it("resolves {{date}} from completedAt", () => {
		expect(resolvePlaceholder("{{date}}", session)).toBe("2026-02-18");
	});

	it("resolves {{date}} from createdAt when no completedAt", () => {
		const s = makeSession({ completedAt: null, createdAt: "2026-01-15T10:00:00.000Z" });
		expect(resolvePlaceholder("{{date}}", s)).toBe("2026-01-15");
	});

	it("resolves {{type}} as human-readable label", () => {
		expect(resolvePlaceholder("{{type}}", session)).toBe("Documentation");
	});

	it("resolves {{duration}} as human-readable time", () => {
		const result = resolvePlaceholder("{{duration}}", session);
		expect(result).toBe("25m 0s");
	});

	it("resolves {{goals}} as checkbox list", () => {
		const result = resolvePlaceholder("{{goals}}", session);
		expect(result).toContain("- [x] Review architecture");
		expect(result).toContain("- [ ] Draft ADR");
	});

	it("resolves {{goals}} as fallback for empty goals", () => {
		const s = makeSession({ goals: [] });
		expect(resolvePlaceholder("{{goals}}", s)).toBe("*No goals recorded.*");
	});

	it("resolves {{decisions}} as bullet list", () => {
		const result = resolvePlaceholder("{{decisions}}", session);
		expect(result).toContain("- **Use EventBus**: For decoupled comms");
		expect(result).toContain("- **Separate models**");
	});

	it("resolves {{decisions}} as fallback for empty", () => {
		const s = makeSession({ decisions: [] });
		expect(resolvePlaceholder("{{decisions}}", s)).toBe("*No decisions recorded.*");
	});

	it("resolves {{artifacts}} as wikilink list", () => {
		const result = resolvePlaceholder("{{artifacts}}", session);
		expect(result).toContain("- [[notes/design.md]] *(created)*");
	});

	it("resolves {{context}} as comma-separated labels", () => {
		expect(resolvePlaceholder("{{context}}", session)).toBe("Session Domain");
	});

	it("resolves {{notes}}", () => {
		expect(resolvePlaceholder("{{notes}}", session)).toBe("Some session notes here.");
	});

	it("resolves {{notes}} as fallback for empty", () => {
		const s = makeSession({ notes: "" });
		expect(resolvePlaceholder("{{notes}}", s)).toBe("*No notes recorded.*");
	});

	it("resolves {{overview}} with date, type, and duration", () => {
		const result = resolvePlaceholder("{{overview}}", session);
		expect(result).toContain("- **Date:** 2026-02-18");
		expect(result).toContain("- **Type:** Documentation");
		// Uses computeElapsedMs (accumulator-based), not computeActiveTimeMs (timeline-based)
		expect(result).toContain("- **Duration:** 25m 0s");
	});

	it("resolves {{overview}} correctly with empty timeline", () => {
		// Session with elapsedBeforePauseMs but no timeline entries
		// computeActiveTimeMs would return 0, but computeElapsedMs returns 1500000 (25m)
		const s = makeSession({
			elapsedBeforePauseMs: 1500000,
			timeline: [],
			completedAt: "2026-02-18T12:00:00.000Z",
			type: "event-storming",
		});
		const result = resolvePlaceholder("{{overview}}", s);
		expect(result).toContain("- **Duration:** 25m 0s");
		expect(result).not.toContain("- **Duration:** 0s");
	});

	it("preserves unknown placeholders", () => {
		expect(resolvePlaceholder("{{unknown}}", session)).toBe("{{unknown}}");
	});
});

describe("generateSessionOutput", () => {
	const session = makeSession({
		title: "Sprint Review",
		type: "documentation",
		status: "completed",
		completedAt: "2026-02-18T12:00:00.000Z",
		elapsedBeforePauseMs: 1500000,
		goals: [{ id: "g1", text: "Review", completed: true, completedAt: "2026-02-18T11:00:00.000Z" }],
		decisions: [{ id: "d1", title: "Use EventBus", recordedAt: "2026-02-18T11:30:00.000Z" }],
	});

	it("generates meeting-invite markdown", () => {
		const template = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "meeting-invite")!;
		const output = generateSessionOutput(session, template);
		expect(output).toContain("# Meeting Invite: Sprint Review");
		expect(output).toContain("## Overview");
		expect(output).toContain("## Goals");
		expect(output).toContain("- [x] Review");
		expect(output).toContain("## Decisions");
		expect(output).toContain("- **Use EventBus**");
	});

	it("generates action-items markdown", () => {
		const template = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "action-items")!;
		const output = generateSessionOutput(session, template);
		expect(output).toContain("# Action Items: Sprint Review");
		expect(output).toContain("## Summary");
		expect(output).toContain("## Action Items");
		expect(output).toContain("## Files Changed");
	});

	it("generates review-summary markdown", () => {
		const template = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "review-summary")!;
		const output = generateSessionOutput(session, template);
		expect(output).toContain("# Review Summary: Sprint Review");
		expect(output).toContain("## Session Overview");
		expect(output).toContain("## Goals");
		expect(output).toContain("## Decisions");
		expect(output).toContain("## Artifacts");
		expect(output).toContain("## Notes");
	});

	it("generates output with a custom template", () => {
		const custom: SessionOutputTemplate = {
			type: "custom",
			title: "Custom Report",
			description: "A custom output",
			sections: [
				{ heading: "Title", placeholder: "{{title}}" },
				{ heading: "Date", placeholder: "{{date}}" },
			],
		};
		const output = generateSessionOutput(session, custom);
		expect(output).toContain("# Custom Report: Sprint Review");
		expect(output).toContain("## Title\n\nSprint Review");
		expect(output).toContain("## Date\n\n2026-02-18");
	});

	it("handles empty session fields gracefully", () => {
		const emptySession = makeSession({ goals: [], decisions: [], artifacts: [], notes: "" });
		const template = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "review-summary")!;
		const output = generateSessionOutput(emptySession, template);
		expect(output).toContain("*No goals recorded.*");
		expect(output).toContain("*No decisions recorded.*");
		expect(output).toContain("*No artifacts tracked.*");
		expect(output).toContain("*No notes recorded.*");
	});

	it("preserves unknown placeholders in full output", () => {
		const custom: SessionOutputTemplate = {
			type: "custom",
			title: "Custom",
			description: "test",
			sections: [
				{ heading: "Known", placeholder: "{{title}}" },
				{ heading: "Unknown", placeholder: "{{future_field}}" },
			],
		};
		const output = generateSessionOutput(session, custom);
		expect(output).toContain("## Known\n\nSprint Review");
		expect(output).toContain("## Unknown\n\n{{future_field}}");
	});

	it("generates output with single-section template", () => {
		const minimal: SessionOutputTemplate = {
			type: "custom",
			title: "Minimal",
			description: "test",
			sections: [{ heading: "Overview", placeholder: "{{overview}}" }],
		};
		const output = generateSessionOutput(session, minimal);
		expect(output).toContain("# Minimal: Sprint Review");
		expect(output).toContain("## Overview");
		// Overview contains date, duration, type
		expect(output).toContain("Documentation");
	});
});

// ─────────────────────────────────────────────────────────────
// Reverse Parse Functions
// ─────────────────────────────────────────────────────────────

describe("parseSectionCheckboxes", () => {
	it("parses checked and unchecked items", () => {
		const text = "- [x] Done task\n- [ ] Pending task\n- [x] Another done";
		const result = parseSectionCheckboxes(text);
		expect(result).toEqual([
			{ label: "Done task", checked: true },
			{ label: "Pending task", checked: false },
			{ label: "Another done", checked: true },
		]);
	});

	it("returns empty array for no checkboxes", () => {
		expect(parseSectionCheckboxes("Some plain text\n")).toEqual([]);
	});

	it("ignores non-checkbox bullet lines", () => {
		const text = "- Regular bullet\n- [x] Checkbox item";
		expect(parseSectionCheckboxes(text)).toEqual([{ label: "Checkbox item", checked: true }]);
	});
});

describe("parseSectionText", () => {
	it("extracts text between headings", () => {
		const content = "### Goals\n- [x] Go\n\n### Execution Plan\n- [ ] Task\n\n### Decisions";
		const result = parseSectionText(content, "### Goals", ["### Execution Plan", "### Decisions"]);
		expect(result).toContain("- [x] Go");
		expect(result).not.toContain("Task");
	});

	it("returns empty string for missing heading", () => {
		expect(parseSectionText("### Other\nstuff", "### Missing", ["### Other"])).toBe("");
	});

	it("extracts until end when no next heading", () => {
		const content = "### Session Notes\nMy notes here.";
		const result = parseSectionText(content, "### Session Notes", ["### NonExistent"]);
		expect(result).toBe("My notes here.");
	});
});

describe("reverseParseSessionNotes", () => {
	it("parses goals and tasks from full note content", () => {
		const content = [
			"---",
			"session-id: s1",
			"---",
			"# My Session",
			"User content.",
			"",
			"## Session Summary",
			"",
			"### Goals",
			"- [x] Write tests",
			"- [ ] Deploy",
			"",
			"### Execution Plan",
			"- [ ] Build feature",
			"- [x] Review code",
			"",
			"### Context Bindings",
			"- **file**: [[src/main.ts]] *(main)*",
			"",
			"### Session Notes",
			"My important notes.",
		].join("\n");
		const parsed = reverseParseSessionNotes(content);
		expect(parsed.goals).toEqual([
			{ label: "Write tests", checked: true },
			{ label: "Deploy", checked: false },
		]);
		expect(parsed.tasks).toEqual([
			{ label: "Build feature", checked: false },
			{ label: "Review code", checked: true },
		]);
		expect(parsed.sessionNotes).toBe("My important notes.");
	});

	it("returns empty result when no summary marker", () => {
		const parsed = reverseParseSessionNotes("# Just a note\nSome text.");
		expect(parsed.goals).toEqual([]);
		expect(parsed.tasks).toEqual([]);
		expect(parsed.sessionNotes).toBe("");
	});

	it("handles missing sections gracefully", () => {
		const content = "## Session Summary\n\n### Goals\n- [x] Only goal\n";
		const parsed = reverseParseSessionNotes(content);
		expect(parsed.goals).toEqual([{ label: "Only goal", checked: true }]);
		expect(parsed.tasks).toEqual([]);
		expect(parsed.sessionNotes).toBe("");
	});
});

describe("computeReverseSyncDiff", () => {
	it("detects toggled goal checkbox", () => {
		const session = makeSession({
			goals: [
				{ id: "g1", text: "Write tests", completed: false, completedAt: null },
				{ id: "g2", text: "Deploy", completed: true, completedAt: "2026-02-16T10:20:00.000Z" },
			],
		});
		const parsed = {
			goals: [
				{ label: "Write tests", checked: true },
				{ label: "Deploy", checked: false },
			],
			tasks: [],
			sessionNotes: "",
		};
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.goalToggles).toEqual([
			{ goalId: "g1", completed: true },
			{ goalId: "g2", completed: false },
		]);
		expect(diff.changes).toContain('goal "Write tests" checked');
		expect(diff.changes).toContain('goal "Deploy" unchecked');
	});

	it("detects toggled task checkbox", () => {
		const session = makeSession({
			executionTasks: [
				{ id: "t1", label: "Build", completed: false, order: 0 },
			],
		});
		const parsed = {
			goals: [],
			tasks: [{ label: "Build", checked: true }],
			sessionNotes: "",
		};
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.taskToggles).toEqual([{ taskId: "t1", completed: true }]);
		expect(diff.changes).toContain('task "Build" checked');
	});

	it("detects notes text change", () => {
		const session = makeSession({ notes: "Old notes" });
		const parsed = { goals: [], tasks: [], sessionNotes: "New notes" };
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.notesUpdate).toBe("New notes");
		expect(diff.changes).toContain("notes updated");
	});

	it("returns empty diff when nothing changed", () => {
		const session = makeSession({
			goals: [{ id: "g1", text: "Write tests", completed: true, completedAt: "2026-02-16T10:20:00.000Z" }],
			notes: "Same notes",
		});
		const parsed = {
			goals: [{ label: "Write tests", checked: true }],
			tasks: [],
			sessionNotes: "Same notes",
		};
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.goalToggles).toEqual([]);
		expect(diff.taskToggles).toEqual([]);
		expect(diff.notesUpdate).toBeNull();
		expect(diff.changes).toEqual([]);
	});

	it("detects new goals not in session", () => {
		const session = makeSession({ goals: [] });
		const parsed = {
			goals: [{ label: "New goal from note", checked: false }],
			tasks: [],
			sessionNotes: "",
		};
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.goalToggles).toEqual([]);
		expect(diff.newGoals).toEqual([{ label: "New goal from note", checked: false }]);
		expect(diff.changes).toContain('goal "New goal from note" added');
	});

	it("detects new tasks not in session", () => {
		const session = makeSession({ executionTasks: [] });
		const parsed = {
			goals: [],
			tasks: [{ label: "New task from note", checked: true }],
			sessionNotes: "",
		};
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.taskToggles).toEqual([]);
		expect(diff.newTasks).toEqual([{ label: "New task from note", checked: true }]);
		expect(diff.changes).toContain('task "New task from note" added');
	});

	it("combines toggles and additions in one diff", () => {
		const session = makeSession({
			goals: [{ id: "g1", text: "Existing goal", completed: false, completedAt: null }],
			executionTasks: [{ id: "t1", label: "Existing task", completed: false, order: 0 }],
		});
		const parsed = {
			goals: [
				{ label: "Existing goal", checked: true },
				{ label: "Brand new goal", checked: false },
			],
			tasks: [
				{ label: "Existing task", checked: true },
				{ label: "Brand new task", checked: false },
			],
			sessionNotes: "",
		};
		const diff = computeReverseSyncDiff(session, parsed);
		expect(diff.goalToggles).toHaveLength(1);
		expect(diff.newGoals).toHaveLength(1);
		expect(diff.taskToggles).toHaveLength(1);
		expect(diff.newTasks).toHaveLength(1);
		expect(diff.changes).toHaveLength(4);
	});
});

// ─────────────────────────────────────────────────────────────
// detectCognitiveOverload (FR-16)
// ─────────────────────────────────────────────────────────────

describe("detectCognitiveOverload", () => {
	it("returns not overloaded for empty session", () => {
		const session = makeSession();
		const result = detectCognitiveOverload(session);
		expect(result.overloaded).toBe(false);
		expect(result.reasons).toHaveLength(0);
	});

	it("detects task count exceeding threshold", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const result = detectCognitiveOverload(session);
		expect(result.overloaded).toBe(true);
		expect(result.reasons).toContainEqual(expect.stringContaining("Too many tasks"));
	});

	it("does not trigger for task count at threshold", () => {
		const tasks = Array.from({ length: 5 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const result = detectCognitiveOverload(session);
		expect(result.reasons.some(r => r.includes("Too many tasks"))).toBe(false);
	});

	it("detects binding count exceeding threshold", () => {
		const bindings = Array.from({ length: 9 }, (_, i) => ({
			id: `ctx${i}`, type: "file" as const, label: `file${i}.md`, path: `/file${i}.md`, boundAt: new Date().toISOString(),
		}));
		const session = makeSession({ contextBindings: bindings });
		const result = detectCognitiveOverload(session);
		expect(result.overloaded).toBe(true);
		expect(result.reasons).toContainEqual(expect.stringContaining("Too many context bindings"));
	});

	it("detects duration exceeding threshold", () => {
		const startedAt = new Date(Date.now() - 130 * 60_000).toISOString();
		const session = makeSession({ startedAt, elapsedBeforePauseMs: 0 });
		const result = detectCognitiveOverload(session);
		expect(result.overloaded).toBe(true);
		expect(result.reasons).toContainEqual(expect.stringContaining("Session duration exceeded"));
	});

	it("does not trigger duration for sessions not started", () => {
		const session = makeSession({ startedAt: null });
		const result = detectCognitiveOverload(session);
		expect(result.reasons.some(r => r.includes("duration"))).toBe(false);
	});

	it("detects compound low energy + high task load", () => {
		const tasks = Array.from({ length: 4 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ energy: 2, executionTasks: tasks });
		const result = detectCognitiveOverload(session);
		expect(result.overloaded).toBe(true);
		expect(result.reasons).toContainEqual(expect.stringContaining("Low energy"));
	});

	it("skips compound check when energy is null", () => {
		const tasks = Array.from({ length: 4 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ energy: null, executionTasks: tasks });
		const result = detectCognitiveOverload(session);
		expect(result.reasons.some(r => r.includes("Low energy"))).toBe(false);
	});

	it("does not trigger compound when energy above threshold", () => {
		const tasks = Array.from({ length: 4 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ energy: 3, executionTasks: tasks });
		const result = detectCognitiveOverload(session);
		expect(result.reasons.some(r => r.includes("Low energy"))).toBe(false);
	});

	it("does not trigger compound when tasks <= 3", () => {
		const tasks = Array.from({ length: 3 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ energy: 1, executionTasks: tasks });
		const result = detectCognitiveOverload(session);
		expect(result.reasons.some(r => r.includes("Low energy"))).toBe(false);
	});

	it("accumulates multiple reasons", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const bindings = Array.from({ length: 9 }, (_, i) => ({
			id: `ctx${i}`, type: "file" as const, label: `file${i}.md`, path: `/file${i}.md`, boundAt: new Date().toISOString(),
		}));
		const session = makeSession({ executionTasks: tasks, contextBindings: bindings, energy: 1 });
		const result = detectCognitiveOverload(session);
		expect(result.overloaded).toBe(true);
		expect(result.reasons.length).toBeGreaterThanOrEqual(3);
	});

	it("uses custom thresholds when provided", () => {
		const tasks = Array.from({ length: 3 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const result = detectCognitiveOverload(session, { ...DEFAULT_COGNITIVE_LOAD_THRESHOLDS, maxTasks: 2 });
		expect(result.overloaded).toBe(true);
		expect(result.reasons).toContainEqual(expect.stringContaining("Too many tasks"));
	});
});

// ─────────────────────────────────────────────────────────────
// computeActivityIntelligence (FR-15)
// ─────────────────────────────────────────────────────────────

describe("computeActivityIntelligence", () => {
	it("returns all zeros for an empty session", () => {
		const session = makeSession();
		const result = computeActivityIntelligence(session, Date.now());
		expect(result).toEqual({
			filesModified: 0,
			artifactsProduced: 0,
			tasksCompleted: 0,
			eventsEmitted: 0,
			wallClockMs: 0,
			activeTimeMs: 0,
			pauseTimeMs: 0,
		});
	});

	it("counts unique files modified", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
				{ path: "src/b.ts", action: "created", timestamp: "2026-02-20T10:01:00.000Z" },
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:02:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.filesModified).toBe(2);
	});

	it("counts completed execution tasks", () => {
		const session = makeSession({
			executionTasks: [
				{ id: "t1", label: "Task 1", completed: true, order: 0 },
				{ id: "t2", label: "Task 2", completed: false, order: 1 },
				{ id: "t3", label: "Task 3", completed: true, order: 2 },
			],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.tasksCompleted).toBe(2);
	});

	it("counts timeline entries as events emitted", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-20T10:15:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-20T10:20:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.eventsEmitted).toBe(3);
	});

	it("computes active time from timeline", () => {
		const now = Date.parse("2026-02-20T10:30:00.000Z");
		const session = makeSession({
			status: "running",
			startedAt: "2026-02-20T10:00:00.000Z",
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, now);
		expect(result.activeTimeMs).toBe(30 * 60_000);
		expect(result.pauseTimeMs).toBe(0);
	});

	it("computes pause time from timeline", () => {
		const now = Date.parse("2026-02-20T10:30:00.000Z");
		const session = makeSession({
			status: "running",
			startedAt: "2026-02-20T10:00:00.000Z",
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-20T10:10:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-20T10:20:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, now);
		expect(result.pauseTimeMs).toBe(10 * 60_000);
		expect(result.activeTimeMs).toBe(20 * 60_000);
	});

	it("handles session with all fields populated", () => {
		const now = Date.parse("2026-02-20T11:00:00.000Z");
		const session = makeSession({
			status: "completed",
			startedAt: "2026-02-20T10:00:00.000Z",
			completedAt: "2026-02-20T11:00:00.000Z",
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/b.ts", action: "created", timestamp: "2026-02-20T10:10:00.000Z" },
				{ path: "src/c.ts", action: "deleted", timestamp: "2026-02-20T10:15:00.000Z" },
			],
			artifacts: [
				{ path: "src/a.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/b.ts", action: "modified", timestamp: "2026-02-20T10:10:00.000Z" },
			],
			executionTasks: [
				{ id: "t1", label: "Done", completed: true, order: 0 },
				{ id: "t2", label: "Pending", completed: false, order: 1 },
			],
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-20T10:30:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-20T10:35:00.000Z" },
				{ action: "completed", timestamp: "2026-02-20T11:00:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, now);
		expect(result.filesModified).toBe(3);
		expect(result.artifactsProduced).toBe(2);
		expect(result.tasksCompleted).toBe(1);
		expect(result.eventsEmitted).toBe(4);
		expect(result.wallClockMs).toBe(60 * 60_000);
		expect(result.activeTimeMs).toBe(55 * 60_000);
		expect(result.pauseTimeMs).toBe(5 * 60_000);
	});

	it("counts artifacts produced", () => {
		const session = makeSession({
			artifacts: [
				{ path: "src/a.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/b.ts", action: "modified", timestamp: "2026-02-20T10:10:00.000Z" },
				{ path: "src/c.ts", action: "created", timestamp: "2026-02-20T10:15:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.artifactsProduced).toBe(3);
	});

	it("handles single activity entry", () => {
		const session = makeSession({
			activity: [
				{ path: "README.md", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.filesModified).toBe(1);
	});

	it("handles many duplicate activity paths", () => {
		const activity = Array.from({ length: 50 }, (_, i) => ({
			path: `src/file-${i % 5}.ts`,
			action: "modified" as const,
			timestamp: new Date(Date.parse("2026-02-20T10:00:00.000Z") + i * 1000).toISOString(),
		}));
		const session = makeSession({ activity });
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.filesModified).toBe(5);
	});

	it("returns zero tasks completed when all pending", () => {
		const session = makeSession({
			executionTasks: [
				{ id: "t1", label: "Task 1", completed: false, order: 0 },
				{ id: "t2", label: "Task 2", completed: false, order: 1 },
			],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.tasksCompleted).toBe(0);
	});

	it("returns zero events for session without timeline", () => {
		const session = makeSession({ timeline: [] });
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.eventsEmitted).toBe(0);
	});

	it("excludes activity matching global filter", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
				{ path: "node_modules/lib/b.ts", action: "modified", timestamp: "2026-02-20T10:01:00.000Z" },
				{ path: "src/c.ts", action: "created", timestamp: "2026-02-20T10:02:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, Date.now(), ["node_modules/"]);
		expect(result.filesModified).toBe(2);
	});

	it("excludes artifacts matching global filter", () => {
		const session = makeSession({
			artifacts: [
				{ path: "src/a.ts", action: "created", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "dist/bundle.js", action: "created", timestamp: "2026-02-20T10:10:00.000Z" },
			],
		});
		const result = computeActivityIntelligence(session, Date.now(), ["dist/"]);
		expect(result.artifactsProduced).toBe(1);
	});

	it("excludes activity matching per-session filter", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
				{ path: "tests/b.test.ts", action: "modified", timestamp: "2026-02-20T10:01:00.000Z" },
			],
			activityFilter: ["tests/"],
		});
		const result = computeActivityIntelligence(session, Date.now());
		expect(result.filesModified).toBe(1);
	});

	it("excludes activity matching both global and per-session filters", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:00:00.000Z" },
				{ path: "node_modules/lib/b.ts", action: "modified", timestamp: "2026-02-20T10:01:00.000Z" },
				{ path: "tests/c.test.ts", action: "modified", timestamp: "2026-02-20T10:02:00.000Z" },
			],
			activityFilter: ["tests/"],
		});
		const result = computeActivityIntelligence(session, Date.now(), ["node_modules/"]);
		expect(result.filesModified).toBe(1);
	});
});

