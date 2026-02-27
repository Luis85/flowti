/**
 * Tests for note sync handlers — forward sync (session -> note file)
 * and reverse sync (note file -> session).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState } from "../../../../src/domain/session/types";
import {
	scheduleSyncNotesFile,
	syncNotesFile,
	findSessionByNotesFile,
	scheduleReverseSync,
	executeReverseSync,
} from "../../../../src/domain/session/handlers/syncHandlers";

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

// ── scheduleSyncNotesFile ────────────────────────────────

describe("scheduleSyncNotesFile", () => {
	it("returns early when no filesystem is available", () => {
		const session = makeSession({ notesFile: "notes.md" });
		const ctx = createMockContext([session]);
		(ctx as any).fileSystem = undefined;

		scheduleSyncNotesFile(ctx, "session-1");

		expect(ctx.noteSyncTimers.size).toBe(0);
	});

	it("sets up a debounced timer", () => {
		const session = makeSession({ notesFile: "03 - Resources/Sessions/notes.md" });
		const ctx = createMockContext([session]);

		scheduleSyncNotesFile(ctx, "session-1");

		expect(ctx.noteSyncTimers.has("session-1")).toBe(true);
	});

	it("clears previous timer before setting new one", () => {
		const session = makeSession({ notesFile: "03 - Resources/Sessions/notes.md" });
		const ctx = createMockContext([session]);

		scheduleSyncNotesFile(ctx, "session-1");
		const firstTimer = ctx.noteSyncTimers.get("session-1");

		scheduleSyncNotesFile(ctx, "session-1");
		const secondTimer = ctx.noteSyncTimers.get("session-1");

		expect(firstTimer).not.toBe(secondTimer);
	});
});

// ── syncNotesFile ────────────────────────────────────────

describe("syncNotesFile", () => {
	it("returns early when file does not exist", async () => {
		const session = makeSession({ notesFile: "03 - Resources/Sessions/notes.md" });
		const ctx = createMockContext([session]);
		(ctx.fileSystem!.fileExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

		await syncNotesFile(ctx, "session-1");

		expect(ctx.fileSystem!.updateFile).not.toHaveBeenCalled();
	});

	it("syncs content and updates cache on success", async () => {
		const session = makeSession({ notesFile: "03 - Resources/Sessions/notes.md" });
		const ctx = createMockContext([session]);

		await syncNotesFile(ctx, "session-1");

		expect(ctx.fileSystem!.updateFile).toHaveBeenCalled();
		expect(ctx.lastSyncedContent.has("03 - Resources/Sessions/notes.md")).toBe(true);
		expect(ctx.emitted.some(([e]) => e === "session.notes.synced")).toBe(true);
	});

	it("emits failure event on exception", async () => {
		const session = makeSession({ notesFile: "03 - Resources/Sessions/notes.md" });
		const ctx = createMockContext([session]);
		(ctx.fileSystem!.fileExists as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("disk error"));

		await syncNotesFile(ctx, "session-1");

		expect(ctx.emitted.some(([e]) => e === "session.notes.syncFailed")).toBe(true);
	});
});

// ── findSessionByNotesFile ───────────────────────────────

describe("findSessionByNotesFile", () => {
	it("returns the session matching the notes file path", () => {
		const session = makeSession({ notesFile: "03 - Resources/Sessions/my-notes.md" });
		const ctx = createMockContext([session]);

		const found = findSessionByNotesFile(ctx, "03 - Resources/Sessions/my-notes.md");

		expect(found).toBe(session);
	});

	it("returns undefined when no session matches", () => {
		const ctx = createMockContext();

		const found = findSessionByNotesFile(ctx, "non-existent.md");

		expect(found).toBeUndefined();
	});
});

// ── scheduleReverseSync ──────────────────────────────────

describe("scheduleReverseSync", () => {
	it("returns early when no filesystem is available", () => {
		const ctx = createMockContext();
		(ctx as any).fileSystem = undefined;

		scheduleReverseSync(ctx, "session-1", "notes.md");

		expect(ctx.reverseSyncTimers.size).toBe(0);
	});

	it("sets up a debounced reverse sync timer", () => {
		const ctx = createMockContext();

		scheduleReverseSync(ctx, "session-1", "notes.md");

		expect(ctx.reverseSyncTimers.has("session-1")).toBe(true);
	});
});

// ── executeReverseSync ───────────────────────────────────

describe("executeReverseSync", () => {
	it("returns early when file content matches last synced (self-sync)", async () => {
		const session = makeSession({ notesFile: "notes.md" });
		const ctx = createMockContext([session]);
		const cachedContent = "cached content";
		ctx.lastSyncedContent.set("notes.md", cachedContent);
		(ctx.fileSystem!.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cachedContent);

		await executeReverseSync(ctx, "session-1", "notes.md");

		expect(ctx.saveState).not.toHaveBeenCalled();
	});

	it("handles exceptions non-fatally", async () => {
		const session = makeSession({ notesFile: "notes.md" });
		const ctx = createMockContext([session]);
		(ctx.fileSystem!.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("parse error"));
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		await executeReverseSync(ctx, "session-1", "notes.md");

		// Should not throw — exception is caught and logged
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
