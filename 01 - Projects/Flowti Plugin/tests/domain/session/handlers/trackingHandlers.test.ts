/**
 * Tests for activity tracking, artifact tracking, cognitive overload detection,
 * and path reconciliation handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState } from "../../../../src/domain/session/types";
import {
	checkCognitiveOverload,
	trackArtifactToSession,
	trackActivityToSession,
	updateActivityFilter,
	handleFileRenamed,
	handleFolderRenamed,
} from "../../../../src/domain/session/handlers/trackingHandlers";

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

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

// ── checkCognitiveOverload ───────────────────────────────

describe("checkCognitiveOverload", () => {
	it("ignores non-running/non-paused sessions", () => {
		const session = makeSession({ status: "prepared" });
		const ctx = createMockContext([session]);

		checkCognitiveOverload(ctx, "session-1");

		expect(ctx.emitted).toHaveLength(0);
	});

	it("emits overload event when reasons change", () => {
		// Session with too many tasks triggers overload
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `task-${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({
			status: "running",
			startedAt: "2026-02-16T10:00:00.000Z",
			executionTasks: tasks,
		});
		const ctx = createMockContext([session]);

		checkCognitiveOverload(ctx, "session-1");

		expect(ctx.emitted.some(([e]) => e === "session.overload.detected")).toBe(true);
	});

	it("skips emission when reasons are the same as previous check", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `task-${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({
			status: "running",
			startedAt: "2026-02-16T10:00:00.000Z",
			executionTasks: tasks,
		});
		const ctx = createMockContext([session]);

		// First call sets reasons
		checkCognitiveOverload(ctx, "session-1");
		const firstEmitCount = ctx.emitted.length;

		// Second call with same state — should not emit again
		checkCognitiveOverload(ctx, "session-1");

		expect(ctx.emitted.length).toBe(firstEmitCount);
	});
});

// ── trackArtifactToSession ───────────────────────────────

describe("trackArtifactToSession", () => {
	it("ignores non-running sessions", async () => {
		const session = makeSession({ status: "paused" });
		const ctx = createMockContext([session]);

		await trackArtifactToSession(ctx, "session-1", "file.md", "created");

		expect(session.artifacts).toHaveLength(0);
	});

	it("tracks an artifact on a running session", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await trackArtifactToSession(ctx, "session-1", "file.md", "created");

		expect(session.artifacts).toHaveLength(1);
		expect(session.artifacts[0].path).toBe("file.md");
		expect(session.artifacts[0].action).toBe("created");
		expect(ctx.emitted.some(([e]) => e === "session.artifact.added")).toBe(true);
	});

	it("deduplicates artifacts within the dedup window", async () => {
		const session = makeSession({
			status: "running",
			artifacts: [{
				path: "file.md",
				action: "created",
				timestamp: "2026-02-16T10:00:00.000Z",
			}],
		});
		const ctx = createMockContext([session]);

		await trackArtifactToSession(ctx, "session-1", "file.md", "created");

		expect(session.artifacts).toHaveLength(1);
	});
});

// ── trackActivityToSession ───────────────────────────────

describe("trackActivityToSession", () => {
	it("ignores non-running sessions", async () => {
		const session = makeSession({ status: "paused" });
		const ctx = createMockContext([session]);

		await trackActivityToSession(ctx, "session-1", "file.md", "created", undefined, 1000);

		expect(session.activity).toHaveLength(0);
	});

	it("tracks activity on a running session", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await trackActivityToSession(ctx, "session-1", "file.md", "modified", undefined, 1000);

		expect(session.activity).toHaveLength(1);
		expect(session.activity[0].action).toBe("modified");
		expect(ctx.emitted.some(([e]) => e === "session.activity.tracked")).toBe(true);
	});

	it("excludes paths matching the global activity filter", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);
		ctx.globalActivityFilter = [".obsidian/"];

		await trackActivityToSession(ctx, "session-1", ".obsidian/plugins/test.json", "modified", undefined, 1000);

		expect(session.activity).toHaveLength(0);
	});

	it("deduplicates activity within the dedup window", async () => {
		const session = makeSession({
			status: "running",
			activity: [{
				timestamp: "2026-02-16T10:00:00.000Z",
				action: "modified",
				path: "file.md",
			}],
		});
		const ctx = createMockContext([session]);

		await trackActivityToSession(ctx, "session-1", "file.md", "modified", undefined, 1000);

		expect(session.activity).toHaveLength(1);
	});
});

// ── updateActivityFilter ─────────────────────────────────

describe("updateActivityFilter", () => {
	it("updates the per-session activity filter", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await updateActivityFilter(ctx, "session-1", [".obsidian/", "templates/"]);

		expect(session.activityFilter).toEqual([".obsidian/", "templates/"]);
		expect(ctx.emitted.some(([e]) => e === "session.activity.filter.updated")).toBe(true);
	});
});

// ── handleFileRenamed ────────────────────────────────────

describe("handleFileRenamed", () => {
	it("updates paths in affected sessions", async () => {
		const session = makeSession({ focusFile: "old/path.md" });
		const ctx = createMockContext([session]);

		await handleFileRenamed(ctx, "old/path.md", "new/path.md");

		expect(session.focusFile).toBe("new/path.md");
		expect(ctx.saveState).toHaveBeenCalled();
		expect(ctx.emitted.some(([e]) => e === "session.paths.updated")).toBe(true);
	});

	it("does nothing when no sessions are affected", async () => {
		const session = makeSession({ focusFile: "unrelated/file.md" });
		const ctx = createMockContext([session]);

		await handleFileRenamed(ctx, "old/path.md", "new/path.md");

		expect(ctx.saveState).not.toHaveBeenCalled();
	});
});

// ── handleFolderRenamed ──────────────────────────────────

describe("handleFolderRenamed", () => {
	it("updates paths in sessions under the renamed folder", async () => {
		const session = makeSession({
			focusFile: "old-folder/sub/file.md",
			notesFile: "old-folder/sub/notes.md",
		});
		const ctx = createMockContext([session]);

		await handleFolderRenamed(ctx, "old-folder", "new-folder");

		expect(session.focusFile).toBe("new-folder/sub/file.md");
		expect(session.notesFile).toBe("new-folder/sub/notes.md");
		expect(ctx.emitted.some(([e]) => e === "session.paths.updated")).toBe(true);
	});

	it("does nothing when no sessions are affected", async () => {
		const session = makeSession({ focusFile: "other/file.md" });
		const ctx = createMockContext([session]);

		await handleFolderRenamed(ctx, "old-folder", "new-folder");

		expect(ctx.saveState).not.toHaveBeenCalled();
	});
});
