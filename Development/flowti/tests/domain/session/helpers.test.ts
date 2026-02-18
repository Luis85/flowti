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
} from "../../../src/domain/session/helpers";
import type { Session, SessionTimelineEntry, SessionTypeConfig } from "../../../src/domain/session/types";
import { SESSION_TYPE_CONFIGS } from "../../../src/domain/session/types";

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
		expect(fm.type).toBe("event-storming");
		expect(fm.status).toBe("completed");
		expect(fm.duration).toBe(25);
		expect(fm.completed).toBe("2026-02-16T10:25:00.000Z");
	});

	it("includes optional fields when set", () => {
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

	it("includes artifacts section", () => {
		const session = makeSession({
			artifacts: [{ path: "src/types.ts", action: "created", timestamp: "2026-02-16T10:05:00.000Z" }],
		});
		const body = generateSessionSummaryBody(session);
		expect(body).toContain("### Artifacts");
		expect(body).toContain("- [[src/types.ts]] *(created)*");
	});

	it("omits optional sections when empty", () => {
		const session = makeSession({ goals: [], links: [], artifacts: [], notes: "" });
		const body = generateSessionSummaryBody(session);
		expect(body).not.toContain("### Goals");
		expect(body).not.toContain("### Links");
		expect(body).not.toContain("### Artifacts");
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
		expect(md).toContain('title: "Sprint Planning"');
		expect(md).toContain('status: "completed"');
		expect(md).toContain("# Sprint Planning");
		expect(md).toContain("## Session Summary");
	});

	it("includes goals and artifacts in body", () => {
		const session = makeSession({
			goals: [
				{ id: "g1", text: "Write tests", completed: true, completedAt: "2026-02-16T10:20:00.000Z" },
			],
			artifacts: [{ path: "src/types.ts", action: "created", timestamp: "2026-02-16T10:05:00.000Z" }],
		});
		const md = generateSessionSummary(session);
		expect(md).toContain("### Goals");
		expect(md).toContain("- [x] Write tests");
		expect(md).toContain("### Artifacts");
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

	it("includes timeline and time summary", () => {
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
		expect(md).toContain("### Time Summary");
		expect(md).toContain("**Wall clock:**");
		expect(md).toContain("**Active time:**");
		expect(md).toContain("**Total pause:**");
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
	it("has 8 pre-built type configs", () => {
		expect(Object.keys(SESSION_TYPE_CONFIGS)).toHaveLength(8);
	});

	it("includes all 8 session types", () => {
		const types = Object.keys(SESSION_TYPE_CONFIGS);
		expect(types).toContain("documentation");
		expect(types).toContain("event-storming");
		expect(types).toContain("service-design");
		expect(types).toContain("domain-design");
		expect(types).toContain("requirements-refinement");
		expect(types).toContain("backlog-structuring");
		expect(types).toContain("knowledge-cleanup");
		expect(types).toContain("vault-hygiene");
	});

	it("each config has required fields", () => {
		for (const [key, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			expect(config.type).toBe(key);
			expect(config.label).toBeTruthy();
			expect(config.icon).toBeTruthy();
			expect(config.guidingQuestions.length).toBeGreaterThan(0);
			expect(config.defaultDuration).toBeGreaterThan(0);
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
