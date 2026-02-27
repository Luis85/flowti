/**
 * Tests for session lifecycle handlers — create, start, pause, resume,
 * complete, archive, delete.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState } from "../../../../src/domain/session/types";
import {
	handleCreate,
	handleStart,
	handlePause,
	handleResume,
	handleComplete,
	handleArchive,
	handleDelete,
} from "../../../../src/domain/session/handlers/lifecycleHandlers";

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

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

// ── handleCreate ─────────────────────────────────────────

describe("handleCreate", () => {
	it("creates a session with minimal payload", async () => {
		const ctx = createMockContext();
		const result = await handleCreate(ctx, {
			type: "event-storming",
			title: "My Session",
			durationMinutes: 25,
		});

		expect(result.type).toBe("event-storming");
		expect(result.title).toBe("My Session");
		expect(result.durationMinutes).toBe(25);
		expect(result.status).toBe("prepared");
		expect(result.notesFile).toContain("My Session");
		expect(ctx.getState().sessions).toHaveLength(1);
		expect(ctx.emitted.some(([e]) => e === "session.created")).toBe(true);
	});

	it("creates a session with all optional fields", async () => {
		const ctx = createMockContext();
		const result = await handleCreate(ctx, {
			type: "documentation",
			title: "Full Session",
			durationMinutes: 50,
			focusFile: "path/to/focus.md",
			goals: ["Goal A", "Goal B"],
			decisions: ["Decision 1"],
			tasks: ["Task X", "Task Y"],
			contextBindings: [{ path: "src/domain/", type: "folder" }],
			notes: "Initial notes",
			reflections: [{ type: "observation", content: "Interesting" }],
		});

		expect(result.focusFile).toBe("path/to/focus.md");
		expect(result.goals).toHaveLength(2);
		expect(result.decisions).toHaveLength(1);
		expect(result.executionTasks).toHaveLength(2);
		expect(result.contextBindings).toHaveLength(1);
		expect(result.notes).toBe("Initial notes");
		expect(result.reflections).toHaveLength(1);
		expect(result.reflections[0].type).toBe("observation");
	});
});

// ── handleStart ──────────────────────────────────────────

describe("handleStart", () => {
	it("starts a prepared session", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleStart(ctx, "session-1");

		expect(session.status).toBe("running");
		expect(session.startedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(ctx.getState().activeSessionId).toBe("session-1");
		expect(session.timeline).toHaveLength(1);
		expect(session.timeline[0].action).toBe("started");
		expect(ctx.startTimer).toHaveBeenCalledWith(session);
		expect(ctx.emitted.some(([e]) => e === "session.started")).toBe(true);
	});

	it("blocks start when another session is running", async () => {
		const running = makeSession({ id: "running-1", status: "running" });
		const prepared = makeSession({ id: "session-2" });
		const ctx = createMockContext([running, prepared]);
		ctx.getState().activeSessionId = "running-1";

		await handleStart(ctx, "session-2");

		expect(prepared.status).toBe("prepared");
	});

	it("returns silently when session is not found", async () => {
		const ctx = createMockContext();

		await handleStart(ctx, "non-existent");

		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handlePause ──────────────────────────────────────────

describe("handlePause", () => {
	it("pauses a running session and accumulates elapsed time", async () => {
		const session = makeSession({
			status: "running",
			startedAt: "2026-02-16T09:55:00.000Z",
			elapsedBeforePauseMs: 0,
		});
		const ctx = createMockContext([session]);

		await handlePause(ctx, "session-1");

		expect(session.status).toBe("paused");
		expect(session.startedAt).toBeNull();
		expect(session.pausedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(session.elapsedBeforePauseMs).toBe(5 * 60 * 1000); // 5 minutes
		expect(session.timeline).toHaveLength(1);
		expect(session.timeline[0].action).toBe("paused");
		expect(ctx.stopTimer).toHaveBeenCalled();
	});

	it("ignores non-running sessions", async () => {
		const session = makeSession({ status: "paused" });
		const ctx = createMockContext([session]);

		await handlePause(ctx, "session-1");

		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleResume ─────────────────────────────────────────

describe("handleResume", () => {
	it("resumes a paused session", async () => {
		const session = makeSession({
			status: "paused",
			pausedAt: "2026-02-16T09:58:00.000Z",
			elapsedBeforePauseMs: 3000,
		});
		const ctx = createMockContext([session]);
		ctx.getState().activeSessionId = "session-1";

		await handleResume(ctx, "session-1");

		expect(session.status).toBe("running");
		expect(session.startedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(session.pausedAt).toBeNull();
		expect(ctx.startTimer).toHaveBeenCalledWith(session);
		expect(session.timeline).toHaveLength(1);
		expect(session.timeline[0].action).toBe("resumed");
	});

	it("ignores when active session is a different session", async () => {
		const session = makeSession({ status: "paused" });
		const ctx = createMockContext([session]);
		ctx.getState().activeSessionId = "other-session";

		await handleResume(ctx, "session-1");

		expect(session.status).toBe("paused");
	});
});

// ── handleComplete ───────────────────────────────────────

describe("handleComplete", () => {
	it("transitions a running session to reviewing", async () => {
		const session = makeSession({
			status: "running",
			startedAt: "2026-02-16T09:50:00.000Z",
		});
		const ctx = createMockContext([session]);
		ctx.getState().activeSessionId = "session-1";

		await handleComplete(ctx, "session-1");

		expect(session.status).toBe("reviewing");
		expect(session.startedAt).toBeNull();
		expect(ctx.stopTimer).toHaveBeenCalled();
		expect(ctx.getState().activeSessionId).toBeNull();
		expect(ctx.emitted.some(([e]) => e === "session.closure.started")).toBe(true);
	});

	it("ignores already completed sessions", async () => {
		const session = makeSession({ status: "completed" });
		const ctx = createMockContext([session]);

		await handleComplete(ctx, "session-1");

		expect(ctx.emitted).toHaveLength(0);
	});

	it("ignores already archived sessions", async () => {
		const session = makeSession({ status: "archived" });
		const ctx = createMockContext([session]);

		await handleComplete(ctx, "session-1");

		expect(ctx.emitted).toHaveLength(0);
	});

	it("ignores sessions already in reviewing state", async () => {
		const session = makeSession({ status: "reviewing" });
		const ctx = createMockContext([session]);

		await handleComplete(ctx, "session-1");

		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleArchive ────────────────────────────────────────

describe("handleArchive", () => {
	it("archives a completed session and clears activity", async () => {
		const session = makeSession({
			status: "completed",
			activity: [{ timestamp: "2026-02-16T10:00:00.000Z", action: "created", path: "file.md" }],
		});
		const ctx = createMockContext([session]);

		await handleArchive(ctx, "session-1");

		expect(session.status).toBe("archived");
		expect(session.activity).toHaveLength(0);
		expect(ctx.emitted.some(([e]) => e === "session.archived")).toBe(true);
	});

	it("ignores non-completed sessions", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleArchive(ctx, "session-1");

		expect(session.status).toBe("running");
		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleDelete ─────────────────────────────────────────

describe("handleDelete", () => {
	it("removes a session from state", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleDelete(ctx, "session-1");

		expect(ctx.getState().sessions).toHaveLength(0);
		expect(ctx.emitted.some(([e]) => e === "session.deleted")).toBe(true);
	});

	it("ignores non-existent session", async () => {
		const ctx = createMockContext();

		await handleDelete(ctx, "non-existent");

		expect(ctx.emitted).toHaveLength(0);
	});
});
