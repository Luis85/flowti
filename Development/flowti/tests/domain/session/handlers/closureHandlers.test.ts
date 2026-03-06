/**
 * Tests for closure ritual handlers — completeClosure, skipClosure,
 * finishReview.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState, ClosureResponse } from "../../../../src/domain/session/types";
import {
	completeClosure,
	skipClosure,
	finishReview,
} from "../../../../src/domain/session/handlers/closureHandlers";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session-1",
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
		featureName: null,
		...overrides,
	};
}

function createMockContext(sessions: Session[] = []): SessionHandlerContext & { emitted: [string, unknown][] } {
	const state: SessionState = { sessions, activeSessionId: null };
	const emitted: [string, unknown][] = [];
	return {
		eventBus: { emit: (type: string, payload: unknown) => { emitted.push([type, payload]); } } as any,
		fileSystem: {
			createFile: vi.fn().mockResolvedValue(undefined),
			readFile: vi.fn().mockResolvedValue(""),
			updateFile: vi.fn().mockResolvedValue(undefined),
			fileExists: vi.fn().mockResolvedValue(true),
		} as any,
		globalActivityFilter: [],
		customSessionTypes: {},
		noteSyncTimers: new Map(),
		lastSyncedContent: new Map(),
		reverseSyncTimers: new Map(),
		lastOverloadReasons: new Map(),
		findSession: (id: string) => state.sessions.find((s) => s.id === id),
		getState: () => state,
		saveState: vi.fn().mockResolvedValue(undefined),
		scheduleSyncNotesFile: vi.fn(),
		checkCognitiveOverload: vi.fn(),
		startTimer: vi.fn(),
		stopTimer: vi.fn(),
		emitted,
	};
}

const mockClosureResponse: ClosureResponse = {
	outcomeAchieved: "yes",
	whatWorked: "Good focus",
	whatDidnt: "Nothing",
	nextAction: "Continue",
	answers: { outcome: "yes" },
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

// ── completeClosure ──────────────────────────────────────

describe("completeClosure", () => {
	it("saves closure response and transitions to completed", async () => {
		const session = makeSession({ status: "reviewing" });
		const ctx = createMockContext([session]);

		await completeClosure(ctx, "session-1", mockClosureResponse);

		expect(session.status).toBe("completed");
		expect(session.closureResponse).toEqual(mockClosureResponse);
		expect(session.completedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(session.timeline).toHaveLength(1);
		expect(session.timeline[0].action).toBe("completed");
		expect(ctx.emitted.some(([e]) => e === "session.completed")).toBe(true);
		expect(ctx.emitted.some(([e]) => e === "session.closure.completed")).toBe(true);
		expect(ctx.scheduleSyncNotesFile).toHaveBeenCalledWith("session-1");
	});

	it("ignores sessions not in reviewing state", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await completeClosure(ctx, "session-1", mockClosureResponse);

		expect(session.status).toBe("running");
		expect(session.closureResponse).toBeNull();
		expect(ctx.emitted).toHaveLength(0);
	});

	it("ignores non-existent session", async () => {
		const ctx = createMockContext();

		await completeClosure(ctx, "non-existent", mockClosureResponse);

		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── skipClosure ──────────────────────────────────────────

describe("skipClosure", () => {
	it("transitions directly to completed without closure response", async () => {
		const session = makeSession({ status: "reviewing" });
		const ctx = createMockContext([session]);

		await skipClosure(ctx, "session-1");

		expect(session.status).toBe("completed");
		expect(session.closureResponse).toBeNull();
		expect(session.completedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(ctx.emitted.some(([e]) => e === "session.completed")).toBe(true);
		expect(ctx.scheduleSyncNotesFile).toHaveBeenCalledWith("session-1");
	});

	it("ignores sessions not in reviewing state", async () => {
		const session = makeSession({ status: "paused" });
		const ctx = createMockContext([session]);

		await skipClosure(ctx, "session-1");

		expect(session.status).toBe("paused");
		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── finishReview ─────────────────────────────────────────

describe("finishReview", () => {
	it("transitions to completed when closure response is present", async () => {
		const session = makeSession({
			status: "reviewing",
			closureResponse: mockClosureResponse,
		});
		const ctx = createMockContext([session]);

		await finishReview(ctx, session);

		expect(session.status).toBe("completed");
		expect(session.completedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(ctx.emitted.some(([e]) => e === "session.completed")).toBe(true);
	});

	it("ignores when session has no closure response", async () => {
		const session = makeSession({ status: "reviewing" });
		const ctx = createMockContext([session]);

		await finishReview(ctx, session);

		expect(session.status).toBe("reviewing");
		expect(ctx.emitted).toHaveLength(0);
	});

	it("ignores sessions not in reviewing state", async () => {
		const session = makeSession({
			status: "completed",
			closureResponse: mockClosureResponse,
		});
		const ctx = createMockContext([session]);

		await finishReview(ctx, session);

		// Status should remain unchanged
		expect(ctx.emitted).toHaveLength(0);
	});
});
