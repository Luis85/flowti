import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { Session, SessionState, SessionTemplate } from "../../../src/domain/session/types";
import { MAX_SESSIONS, MAX_TEMPLATES, MAX_CONTEXT_BINDINGS, MAX_OUTPUT_ARTIFACTS, ACTIVITY_DEDUP_WINDOW_MS } from "../../../src/domain/session/types";
import { generateRerunTitle } from "../../../src/domain/session/SessionService";
import { BUILT_IN_OUTPUT_TEMPLATES } from "../../../src/domain/session/helpers";
import { createMockStorage } from "../../mocks/storage";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session_test-1",
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

describe("SessionService", () => {
	let service: SessionService;
	let storage: ITypedStorage<SessionState>;
	let eventBus: IEventBus;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const mock = createMockStorage<SessionState>();
		storage = mock.storage;
		eventBus = new EventBus();
		service = new SessionService({ storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	// ── Load ─────────────────────────────────────────────────

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getSessions()).toEqual([]);
			expect(service.getActiveSession()).toBeNull();
		});

		it("should load persisted session state", async () => {
			const existingState: SessionState = {
				sessions: [makeSession({ id: "s1" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(existingState);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getSessions()).toHaveLength(1);
			expect(service.getSessions()[0].id).toBe("s1");
		});

		it("should emit session.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("session.loaded", handler);
			await service.load();

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessions: [],
						activeSessionId: null,
					}),
				}),
			);
		});

		it("should resume active session timer on load", async () => {
			const now = Date.now();
			const existingState: SessionState = {
				sessions: [makeSession({
					id: "s1",
					status: "active",
					startedAt: new Date(now - 5 * 60_000).toISOString(),
					durationMinutes: 25,
				})],
				activeSessionId: "s1",
			};
			const mock = createMockStorage(existingState);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });

			const tickHandler = vi.fn();
			eventBus.on("session.timer.tick", tickHandler);

			await service.load();

			// Advance 1 second — should emit tick
			vi.advanceTimersByTime(1000);
			expect(tickHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessionId: "s1",
					}),
				}),
			);
		});

		it("should complete expired session on load", async () => {
			const now = Date.now();
			const existingState: SessionState = {
				sessions: [makeSession({
					id: "s1",
					status: "active",
					startedAt: new Date(now - 30 * 60_000).toISOString(),
					durationMinutes: 25,
				})],
				activeSessionId: "s1",
			};
			const mock = createMockStorage(existingState);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });

			const closureHandler = vi.fn();
			eventBus.on("session.closure.started", closureHandler);
			await service.load();

			expect(closureHandler).toHaveBeenCalled();
			expect(service.getActiveSession()).toBeNull();
			// Session is now in "reviewing" state (awaiting closure)
			const session = service.getSessions()[0];
			expect(session.status).toBe("reviewing");
		});
	});

	// ── Session lookup ───────────────────────────────────────

	describe("getSessionById", () => {
		it("should return session by ID", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1" }), makeSession({ id: "s2" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getSessionById("s1")?.id).toBe("s1");
			expect(service.getSessionById("s2")?.id).toBe("s2");
			expect(service.getSessionById("unknown")).toBeNull();
		});
	});

	describe("getCurrentSession", () => {
		it("should return active session when one exists", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", status: "active", startedAt: new Date().toISOString() })],
				activeSessionId: "s1",
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getCurrentSession()?.id).toBe("s1");
		});

		it("should return workspace session when no active session", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", status: "prepared" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();
			service.workspaceSessionId = "s1";

			expect(service.getCurrentSession()?.id).toBe("s1");
		});

		it("should prefer workspace session over active session", async () => {
			const state: SessionState = {
				sessions: [
					makeSession({ id: "s1", status: "active", startedAt: new Date().toISOString() }),
					makeSession({ id: "s2", status: "prepared" }),
				],
				activeSessionId: "s1",
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();
			service.workspaceSessionId = "s2";

			expect(service.getCurrentSession()?.id).toBe("s2");
		});

		it("should return null when no active or workspace session", async () => {
			await service.load();
			expect(service.getCurrentSession()).toBeNull();
		});
	});

	// ── Create ───────────────────────────────────────────────

	describe("create", () => {
		it("should create a session in prepared state", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "My Session",
				durationMinutes: 25,
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						session: expect.objectContaining({
							type: "event-storming",
							title: "My Session",
							status: "prepared",
							durationMinutes: 25,
						}),
					}),
				}),
			);
			expect(service.getSessions()).toHaveLength(1);
		});

		it("should create a session with a focus file", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Focused Session",
				durationMinutes: 25,
				focusFile: "docs/my-feature.md",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						session: expect.objectContaining({
							title: "Focused Session",
							focusFile: "docs/my-feature.md",
						}),
					}),
				}),
			);
		});

		it("should default focusFile to notesFile when not provided", async () => {
			await service.load();
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "No Focus",
				durationMinutes: 25,
			});

			const session = service.getSessions()[0];
			expect(session.focusFile).toBe(session.notesFile);
		});

		it("should auto-set notesFile path from session title", async () => {
			await service.load();
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Sprint Planning",
				durationMinutes: 25,
			});

			expect(service.getSessions()[0].notesFile).toMatch(/^03 - Resources\/Sessions\/\d{4}-\d{2}-\d{2} Sprint Planning \([a-f0-9]{6}\)\.md$/);
		});

		it("should sanitize special characters in notesFile path", async () => {
			await service.load();
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Sprint: Review/Test",
				durationMinutes: 25,
			});

			expect(service.getSessions()[0].notesFile).toMatch(/^03 - Resources\/Sessions\/\d{4}-\d{2}-\d{2} Sprint- Review-Test \([a-f0-9]{6}\)\.md$/);
		});

		it("should default focusFile to notesFile when not explicitly set", async () => {
			await service.load();
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Focus Test",
				durationMinutes: 25,
			});

			const session = service.getSessions()[0];
			expect(session.focusFile).toBe(session.notesFile);
		});

		it("should preserve explicit focusFile when provided", async () => {
			await service.load();
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Focus Test",
				durationMinutes: 25,
				focusFile: "src/main.ts",
			});

			const session = service.getSessions()[0];
			expect(session.focusFile).toBe("src/main.ts");
			expect(session.focusFile).not.toBe(session.notesFile);
		});

		it("should evict oldest when exceeding MAX_SESSIONS", async () => {
			const sessions = Array.from({ length: MAX_SESSIONS }, (_, i) =>
				makeSession({ id: `s${i}` }),
			);
			const mock = createMockStorage<SessionState>({ sessions, activeSessionId: null });
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getSessions()).toHaveLength(MAX_SESSIONS);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "New",
				durationMinutes: 25,
			});

			expect(service.getSessions()).toHaveLength(MAX_SESSIONS);
			// Newest should be first
			expect(service.getSessions()[0].title).toBe("New");
		});
	});

	// ── Lifecycle ────────────────────────────────────────────

	describe("lifecycle transitions", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should start a prepared session", async () => {
			const handler = vi.fn();
			eventBus.on("session.started", handler);

			await eventBus.emit("session.start", { sessionId });

			expect(handler).toHaveBeenCalled();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.status).toBe("running");
			expect(session.startedAt).not.toBeNull();
			expect(service.getActiveSession()?.id).toBe(sessionId);
		});

		it("should not start an already completed session", async () => {
			// Start, then complete
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.started", handler);
			await eventBus.emit("session.start", { sessionId });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should pause an active session", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5 * 60_000); // 5 minutes

			const handler = vi.fn();
			eventBus.on("session.paused", handler);
			await eventBus.emit("session.pause", { sessionId });

			expect(handler).toHaveBeenCalled();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.status).toBe("paused");
			expect(session.startedAt).toBeNull();
			expect(session.pausedAt).not.toBeNull();
			expect(session.elapsedBeforePauseMs).toBeGreaterThanOrEqual(5 * 60_000);
		});

		it("should not pause a prepared session", async () => {
			const handler = vi.fn();
			eventBus.on("session.paused", handler);
			await eventBus.emit("session.pause", { sessionId });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should resume a paused session", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5 * 60_000);
			await eventBus.emit("session.pause", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.resumed", handler);
			await eventBus.emit("session.resume", { sessionId });

			expect(handler).toHaveBeenCalled();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.status).toBe("running");
			expect(session.startedAt).not.toBeNull();
			expect(session.pausedAt).toBeNull();
		});

		it("should not resume an active session", async () => {
			await eventBus.emit("session.start", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.resumed", handler);
			await eventBus.emit("session.resume", { sessionId });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should complete an active session", async () => {
			await eventBus.emit("session.start", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.completed", handler);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			expect(handler).toHaveBeenCalled();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.status).toBe("completed");
			expect(session.completedAt).not.toBeNull();
			expect(service.getActiveSession()).toBeNull();
		});

		it("should complete a paused session", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5 * 60_000);
			await eventBus.emit("session.pause", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.completed", handler);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			expect(handler).toHaveBeenCalled();
		});

		it("should not complete an already completed session", async () => {
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.completed", handler);
			await eventBus.emit("session.complete", { sessionId });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should archive a completed session", async () => {
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			const handler = vi.fn();
			eventBus.on("session.archived", handler);
			await eventBus.emit("session.archive", { sessionId });

			expect(handler).toHaveBeenCalled();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.status).toBe("archived");
		});

		it("should not archive a non-completed session", async () => {
			const handler = vi.fn();
			eventBus.on("session.archived", handler);
			await eventBus.emit("session.archive", { sessionId });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should only allow one active session at a time", async () => {
			await eventBus.emit("session.start", { sessionId });

			// Create second session
			await eventBus.emit("session.create", {
				type: "service-design",
				title: "Second",
				durationMinutes: 50,
			});
			// Use getSessions() to find the second session (avoids async event timing)
			const secondSession = service.getSessions().find((s) => s.title === "Second");
			expect(secondSession).toBeDefined();

			// Try to start second — should be ignored because first is active
			const startHandler = vi.fn();
			eventBus.on("session.started", startHandler);
			await eventBus.emit("session.start", { sessionId: secondSession!.id });

			expect(startHandler).not.toHaveBeenCalled();
			expect(service.getActiveSession()?.id).toBe(sessionId);
		});
	});

	// ── Delete ───────────────────────────────────────────────

	describe("delete", () => {
		it("should delete a session", async () => {
			await service.load();
			const createdHandler = vi.fn();
			eventBus.on("session.created", createdHandler);
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 25 });
			const id = createdHandler.mock.calls[0][0].payload.session.id;

			const handler = vi.fn();
			eventBus.on("session.deleted", handler);
			await eventBus.emit("session.delete", { sessionId: id });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ payload: { sessionId: id } }),
			);
			expect(service.getSessions()).toHaveLength(0);
		});

		it("should clear activeSessionId when deleting the active session", async () => {
			await service.load();
			const createdHandler = vi.fn();
			eventBus.on("session.created", createdHandler);
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 25 });
			const id = createdHandler.mock.calls[0][0].payload.session.id;

			await eventBus.emit("session.start", { sessionId: id });
			expect(service.getActiveSession()?.id).toBe(id);

			await eventBus.emit("session.delete", { sessionId: id });
			expect(service.getActiveSession()).toBeNull();
		});

		it("should ignore deleting a non-existent session", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.deleted", handler);
			await eventBus.emit("session.delete", { sessionId: "nonexistent" });
			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── Refresh ──────────────────────────────────────────────

	describe("refresh", () => {
		it("should emit session.loaded with current state", async () => {
			await service.load();
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 25 });

			const handler = vi.fn();
			eventBus.on("session.loaded", handler);
			await eventBus.emit("session.refresh", {});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessions: expect.arrayContaining([
							expect.objectContaining({ title: "T" }),
						]),
					}),
				}),
			);
		});
	});

	// ── Timer ────────────────────────────────────────────────

	describe("timer", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Timer Test",
				durationMinutes: 1, // 1 minute for easy testing
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should emit timer.tick every second while active", async () => {
			await eventBus.emit("session.start", { sessionId });

			const tickHandler = vi.fn();
			eventBus.on("session.timer.tick", tickHandler);

			vi.advanceTimersByTime(3000);

			expect(tickHandler).toHaveBeenCalledTimes(3);
			const lastCall = tickHandler.mock.calls[2][0].payload;
			expect(lastCall.sessionId).toBe(sessionId);
			expect(lastCall.remainingMs).toBeLessThan(60_000);
			expect(lastCall.elapsedMs).toBeGreaterThan(0);
		});

		it("should emit timer.completed when timer expires", async () => {
			await eventBus.emit("session.start", { sessionId });

			const completedHandler = vi.fn();
			eventBus.on("session.timer.completed", completedHandler);
			const sessionCompletedHandler = vi.fn();
			eventBus.on("session.completed", sessionCompletedHandler);

			// Use async variant to flush microtasks from void-ed completeSession()
			await vi.advanceTimersByTimeAsync(61_000);

			expect(completedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId },
				}),
			);

			// completeSession now stops at "reviewing"; skip closure to reach "completed"
			await service.skipClosure(sessionId);
			expect(sessionCompletedHandler).toHaveBeenCalled();
		});

		it("should stop ticking when paused", async () => {
			await eventBus.emit("session.start", { sessionId });

			const tickHandler = vi.fn();
			eventBus.on("session.timer.tick", tickHandler);

			vi.advanceTimersByTime(2000); // 2 ticks
			expect(tickHandler).toHaveBeenCalledTimes(2);

			await eventBus.emit("session.pause", { sessionId });
			tickHandler.mockClear();

			vi.advanceTimersByTime(5000);
			expect(tickHandler).not.toHaveBeenCalled();
		});

		it("should resume ticking after resume", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(10_000);
			await eventBus.emit("session.pause", { sessionId });

			vi.advanceTimersByTime(5_000); // time passes while paused

			await eventBus.emit("session.resume", { sessionId });

			const tickHandler = vi.fn();
			eventBus.on("session.timer.tick", tickHandler);

			vi.advanceTimersByTime(3000);
			expect(tickHandler).toHaveBeenCalledTimes(3);

			// Remaining should reflect only active time, not paused time
			const lastTick = tickHandler.mock.calls[2][0].payload;
			// Active: 10s + 3s = 13s, Total: 60s → remaining ~47s
			expect(lastTick.remainingMs).toBeGreaterThan(40_000);
			expect(lastTick.remainingMs).toBeLessThan(50_000);
		});
	});

	// ── Artifact tracking ────────────────────────────────────

	describe("artifact tracking", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Artifact Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
			await eventBus.emit("session.start", { sessionId });
		});

		it("should record artifact on file.created during active session", async () => {
			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.created", { path: "notes/test.md", source: "user" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessionId,
						artifact: expect.objectContaining({
							path: "notes/test.md",
							action: "created",
						}),
					}),
				}),
			);
		});

		it("should record artifact on file.modified during active session", async () => {
			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.modified", { path: "notes/existing.md", source: "user" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						artifact: expect.objectContaining({
							action: "modified",
						}),
					}),
				}),
			);
		});

		it("should not record artifact when no active session", async () => {
			// Complete the session first
			await eventBus.emit("session.complete", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.created", { path: "notes/test.md", source: "user" });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should not record artifact when session is paused", async () => {
			await eventBus.emit("session.pause", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.created", { path: "notes/test.md", source: "user" });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should deduplicate artifacts within 1 second", async () => {
			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.modified", { path: "notes/test.md", source: "user" });
			await eventBus.emit("file.modified", { path: "notes/test.md", source: "user" });

			// Same path+action within dedup window — only first recorded
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should allow same artifact after dedup window expires", async () => {
			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.modified", { path: "notes/test.md", source: "user" });
			vi.advanceTimersByTime(1100); // past dedup window
			await eventBus.emit("file.modified", { path: "notes/test.md", source: "user" });

			expect(handler).toHaveBeenCalledTimes(2);
		});

		it("should allow different paths within dedup window", async () => {
			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.created", { path: "notes/a.md", source: "user" });
			await eventBus.emit("file.created", { path: "notes/b.md", source: "user" });

			expect(handler).toHaveBeenCalledTimes(2);
		});

		it("should allow different actions for same path within dedup window", async () => {
			const handler = vi.fn();
			eventBus.on("session.artifact.added", handler);

			await eventBus.emit("file.created", { path: "notes/test.md", source: "user" });
			await eventBus.emit("file.modified", { path: "notes/test.md", source: "user" });

			expect(handler).toHaveBeenCalledTimes(2);
		});
	});

	// ── Persistence ──────────────────────────────────────────

	describe("persistence", () => {
		it("should save state after create", async () => {
			await service.load();
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 25 });

			expect(storage.save).toHaveBeenCalled();
		});

		it("should save state after start", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 25 });
			const id = handler.mock.calls[0][0].payload.session.id;

			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.start", { sessionId: id });

			expect(storage.save).toHaveBeenCalled();
		});

		it("should save state after artifact added", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 25 });
			const id = handler.mock.calls[0][0].payload.session.id;
			await eventBus.emit("session.start", { sessionId: id });

			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(storage.save).toHaveBeenCalled();
		});
	});

	// ── Dispose ──────────────────────────────────────────────

	describe("dispose", () => {
		it("should stop timer and unsubscribe listeners on dispose", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "T", durationMinutes: 1 });
			const id = handler.mock.calls[0][0].payload.session.id;
			await eventBus.emit("session.start", { sessionId: id });

			const tickHandler = vi.fn();
			eventBus.on("session.timer.tick", tickHandler);

			service.dispose();

			vi.advanceTimersByTime(5000);
			expect(tickHandler).not.toHaveBeenCalled();
		});
	});

	// ── Template CRUD ───────────────────────────────────────

	describe("template CRUD", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should return empty templates by default", () => {
			expect(service.getSavedTemplates()).toEqual([]);
		});

		it("should save a template with generated id and createdAt", async () => {
			const result = await service.saveTemplate({
				name: "Sprint Storming",
				type: "event-storming",
				durationMinutes: 25,
			});

			expect(result.id).toMatch(/^tmpl_/);
			expect(result.createdAt).toBeGreaterThan(0);
			expect(result.name).toBe("Sprint Storming");
			expect(result.type).toBe("event-storming");
			expect(result.durationMinutes).toBe(25);
		});

		it("should persist templates to storage", async () => {
			await service.saveTemplate({
				name: "T1",
				type: "event-storming",
				durationMinutes: 25,
			});

			expect(storage.save).toHaveBeenCalled();
		});

		it("should return saved templates via getSavedTemplates", async () => {
			await service.saveTemplate({ name: "T1", type: "event-storming", durationMinutes: 25 });
			await service.saveTemplate({ name: "T2", type: "service-design", durationMinutes: 50 });

			const templates = service.getSavedTemplates();
			expect(templates).toHaveLength(2);
			expect(templates[0].name).toBe("T1");
			expect(templates[1].name).toBe("T2");
		});

		it("should return a template by ID", async () => {
			const saved = await service.saveTemplate({ name: "T1", type: "event-storming", durationMinutes: 25 });

			const found = service.getTemplate(saved.id);
			expect(found).toBeDefined();
			expect(found!.name).toBe("T1");
		});

		it("should return undefined for unknown template ID", () => {
			expect(service.getTemplate("nonexistent")).toBeUndefined();
		});

		it("should update an existing template", async () => {
			const saved = await service.saveTemplate({ name: "T1", type: "event-storming", durationMinutes: 25 });

			await service.updateTemplate(saved.id, { name: "T1 Updated", durationMinutes: 50 });

			const updated = service.getTemplate(saved.id);
			expect(updated!.name).toBe("T1 Updated");
			expect(updated!.durationMinutes).toBe(50);
			expect(updated!.type).toBe("event-storming"); // unchanged
		});

		it("should no-op when updating a non-existent template", async () => {
			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await service.updateTemplate("nonexistent", { name: "X" });
			expect(storage.save).not.toHaveBeenCalled();
		});

		it("should delete a template by ID", async () => {
			const saved = await service.saveTemplate({ name: "T1", type: "event-storming", durationMinutes: 25 });

			await service.deleteTemplate(saved.id);

			expect(service.getSavedTemplates()).toHaveLength(0);
			expect(service.getTemplate(saved.id)).toBeUndefined();
		});

		it("should no-op when deleting a non-existent template", async () => {
			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await service.deleteTemplate("nonexistent");
			expect(storage.save).not.toHaveBeenCalled();
		});

		it("should evict oldest templates when exceeding MAX_TEMPLATES", async () => {
			for (let i = 0; i < MAX_TEMPLATES; i++) {
				vi.advanceTimersByTime(10); // ensure different createdAt
				await service.saveTemplate({ name: `T${i}`, type: "event-storming", durationMinutes: 25 });
			}

			expect(service.getSavedTemplates()).toHaveLength(MAX_TEMPLATES);

			// Add one more — should evict oldest
			vi.advanceTimersByTime(10);
			await service.saveTemplate({ name: "Overflow", type: "event-storming", durationMinutes: 25 });

			const templates = service.getSavedTemplates();
			expect(templates).toHaveLength(MAX_TEMPLATES);
			// Newest should still be present
			expect(templates.some((t) => t.name === "Overflow")).toBe(true);
			// Oldest (T0) should be evicted
			expect(templates.some((t) => t.name === "T0")).toBe(false);
		});

		it("should save a template with optional description", async () => {
			const saved = await service.saveTemplate({
				name: "T1",
				type: "event-storming",
				durationMinutes: 25,
				description: "My description",
			});

			expect(saved.description).toBe("My description");
		});
	});

	// ── Template Import/Export ──────────────────────────────

	describe("template import/export", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should export a template as JSON with version 1", async () => {
			const saved = await service.saveTemplate({
				name: "Sprint Storming",
				type: "event-storming",
				durationMinutes: 25,
				description: "Event storming for sprints",
				goals: ["Map events", "Find aggregates"],
			});

			const exported = service.exportTemplate(saved.id);
			expect(exported).not.toBeNull();
			expect(exported!.version).toBe(1);
			expect(exported!.template.name).toBe("Sprint Storming");
			expect(exported!.template.type).toBe("event-storming");
			expect(exported!.template.durationMinutes).toBe(25);
			expect(exported!.template.description).toBe("Event storming for sprints");
			expect(exported!.template.goals).toEqual(["Map events", "Find aggregates"]);
		});

		it("should strip id and createdAt from export", async () => {
			const saved = await service.saveTemplate({
				name: "Export Clean",
				type: "documentation",
				durationMinutes: 30,
			});

			const exported = service.exportTemplate(saved.id);
			expect(exported!.template).not.toHaveProperty("id");
			expect(exported!.template).not.toHaveProperty("createdAt");
		});

		it("should return null when exporting non-existent template", () => {
			const exported = service.exportTemplate("tmpl_nonexistent");
			expect(exported).toBeNull();
		});

		it("should emit session.template.exported on export", async () => {
			const saved = await service.saveTemplate({
				name: "Export Event",
				type: "event-storming",
				durationMinutes: 25,
			});

			const handler = vi.fn();
			eventBus.on("session.template.exported", handler);

			service.exportTemplate(saved.id);

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.template.id).toBe(saved.id);
		});

		it("should import a valid template export", async () => {
			const exportData = {
				version: 1,
				template: {
					name: "Imported Template",
					type: "service-design",
					durationMinutes: 45,
					description: "From another vault",
				},
			};

			const imported = await service.importTemplate(exportData);
			expect(imported).not.toBeNull();
			expect(imported!.id).toMatch(/^tmpl_/);
			expect(imported!.name).toBe("Imported Template");
			expect(imported!.type).toBe("service-design");
			expect(imported!.durationMinutes).toBe(45);
			expect(imported!.createdAt).toBeGreaterThan(0);

			// Verify it's in the templates list
			expect(service.getSavedTemplates()).toHaveLength(1);
		});

		it("should emit session.template.imported on import", async () => {
			const handler = vi.fn();
			eventBus.on("session.template.imported", handler);

			await service.importTemplate({
				version: 1,
				template: {
					name: "Import Event",
					type: "event-storming",
					durationMinutes: 25,
				},
			});

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.template.name).toBe("Import Event");
		});

		it("should round-trip export then import", async () => {
			const original = await service.saveTemplate({
				name: "Round Trip",
				type: "domain-design",
				durationMinutes: 60,
				description: "Full round-trip test",
				goals: ["Goal A", "Goal B"],
				decisions: ["Decision X"],
			});

			const exported = service.exportTemplate(original.id);
			expect(exported).not.toBeNull();

			// Delete original to simulate importing into a different vault
			await service.deleteTemplate(original.id);
			expect(service.getSavedTemplates()).toHaveLength(0);

			const imported = await service.importTemplate(exported);
			expect(imported).not.toBeNull();
			expect(imported!.name).toBe("Round Trip");
			expect(imported!.type).toBe("domain-design");
			expect(imported!.durationMinutes).toBe(60);
			expect(imported!.description).toBe("Full round-trip test");
			expect(imported!.goals).toEqual(["Goal A", "Goal B"]);
			expect(imported!.decisions).toEqual(["Decision X"]);
			// ID and createdAt should be new
			expect(imported!.id).not.toBe(original.id);
		});

		it("should reject import with duplicate name", async () => {
			await service.saveTemplate({
				name: "Existing Template",
				type: "event-storming",
				durationMinutes: 25,
			});

			const result = await service.importTemplate({
				version: 1,
				template: {
					name: "Existing Template",
					type: "service-design",
					durationMinutes: 45,
				},
			});

			expect(result).toBeNull();
			expect(service.getSavedTemplates()).toHaveLength(1);
		});

		it("should reject import with missing version", async () => {
			const result = await service.importTemplate({
				template: { name: "No Version", type: "event-storming", durationMinutes: 25 },
			});
			expect(result).toBeNull();
		});

		it("should reject import with wrong version", async () => {
			const result = await service.importTemplate({
				version: 2,
				template: { name: "Wrong Version", type: "event-storming", durationMinutes: 25 },
			});
			expect(result).toBeNull();
		});

		it("should reject import with missing name", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: { type: "event-storming", durationMinutes: 25 },
			});
			expect(result).toBeNull();
		});

		it("should reject import with empty name", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: { name: "  ", type: "event-storming", durationMinutes: 25 },
			});
			expect(result).toBeNull();
		});

		it("should reject import with missing type", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: { name: "No Type", durationMinutes: 25 },
			});
			expect(result).toBeNull();
		});

		it("should reject import with invalid durationMinutes", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: { name: "Bad Duration", type: "event-storming", durationMinutes: -5 },
			});
			expect(result).toBeNull();
		});

		it("should reject import with non-object data", async () => {
			expect(await service.importTemplate(null)).toBeNull();
			expect(await service.importTemplate("string")).toBeNull();
			expect(await service.importTemplate(42)).toBeNull();
			expect(await service.importTemplate(undefined)).toBeNull();
		});

		it("should reject import with non-object template field", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: "not an object",
			});
			expect(result).toBeNull();
		});

		it("should import template with optional fields", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: {
					name: "Minimal Template",
					type: "documentation",
					durationMinutes: 25,
				},
			});

			expect(result).not.toBeNull();
			expect(result!.description).toBeUndefined();
			expect(result!.focusFile).toBeUndefined();
			expect(result!.goals).toBeUndefined();
			expect(result!.decisions).toBeUndefined();
		});
	});

	// ── Save Template from Session ──────────────────────────

	describe("saveTemplateFromSession", () => {
		let completedSessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "service-design",
				title: "Sprint 12",
				durationMinutes: 50,
			});
			completedSessionId = handler.mock.calls[0][0].payload.session.id;

			// Complete the session
			await eventBus.emit("session.start", { sessionId: completedSessionId });
			await eventBus.emit("session.complete", { sessionId: completedSessionId });
			await service.skipClosure(completedSessionId);
		});

		it("should create template from completed session", async () => {
			const tmpl = await service.saveTemplateFromSession(completedSessionId, "Sprint Template");

			expect(tmpl).not.toBeNull();
			expect(tmpl!.name).toBe("Sprint Template");
			expect(tmpl!.type).toBe("service-design");
			expect(tmpl!.durationMinutes).toBe(50);
		});

		it("should create template from archived session", async () => {
			await eventBus.emit("session.archive", { sessionId: completedSessionId });

			const tmpl = await service.saveTemplateFromSession(completedSessionId, "Archived Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.name).toBe("Archived Template");
		});

		it("should create template from active session", async () => {
			await eventBus.emit("session.create", { type: "event-storming", title: "Active", durationMinutes: 25 });
			const activeSession = service.getSessions().find((s) => s.title === "Active");
			expect(activeSession).toBeDefined();
			await eventBus.emit("session.start", { sessionId: activeSession!.id });

			const tmpl = await service.saveTemplateFromSession(activeSession!.id, "Active Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.name).toBe("Active Template");
			expect(tmpl!.type).toBe("event-storming");
		});

		it("should create template from prepared session", async () => {
			await eventBus.emit("session.create", { type: "event-storming", title: "Prepared", durationMinutes: 25 });
			const preparedSession = service.getSessions().find((s) => s.title === "Prepared");
			expect(preparedSession).toBeDefined();

			const tmpl = await service.saveTemplateFromSession(preparedSession!.id, "Prepared Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.name).toBe("Prepared Template");
		});

		it("should return null for non-existent session", async () => {
			const tmpl = await service.saveTemplateFromSession("nonexistent", "X");
			expect(tmpl).toBeNull();
		});

		it("should include focusFile in saved template", async () => {
			// Create a session with focusFile, complete it, save as template
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Focus Sprint",
				durationMinutes: 25,
				focusFile: "docs/events.md",
			});
			// State mutation is synchronous in handleCreate (before any await)
			const focused = service.getSessions().find((s) => s.title === "Focus Sprint");
			expect(focused).toBeDefined();
			expect(focused!.focusFile).toBe("docs/events.md");
			await eventBus.emit("session.start", { sessionId: focused!.id });
			await eventBus.emit("session.complete", { sessionId: focused!.id });

			const tmpl = await service.saveTemplateFromSession(focused!.id, "Focus Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.focusFile).toBe("docs/events.md");
		});
	});

	// ── Rerun Session ───────────────────────────────────────

	describe("rerunSession", () => {
		let completedSessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Sprint 12",
				durationMinutes: 25,
			});
			completedSessionId = handler.mock.calls[0][0].payload.session.id;

			await eventBus.emit("session.start", { sessionId: completedSessionId });
			await eventBus.emit("session.complete", { sessionId: completedSessionId });
			await service.skipClosure(completedSessionId);
		});

		it("should create a new prepared session from completed session", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await service.rerunSession(completedSessionId);

			expect(handler).toHaveBeenCalled();
			const newSession = handler.mock.calls[0][0].payload.session;
			expect(newSession.title).toBe("Sprint 12 (2)");
			expect(newSession.type).toBe("event-storming");
			expect(newSession.durationMinutes).toBe(25);
			expect(newSession.status).toBe("prepared");
		});

		it("should create a new session from archived session", async () => {
			await eventBus.emit("session.archive", { sessionId: completedSessionId });

			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.rerunSession(completedSessionId);

			expect(handler).toHaveBeenCalled();
			expect(handler.mock.calls[0][0].payload.session.title).toBe("Sprint 12 (2)");
		});

		it("should increment suffix on repeated reruns", async () => {
			// First rerun: Sprint 12 → Sprint 12 (2)
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.rerunSession(completedSessionId);

			const rerunId = handler.mock.calls[0][0].payload.session.id;
			// Complete the rerun
			await eventBus.emit("session.start", { sessionId: rerunId });
			await eventBus.emit("session.complete", { sessionId: rerunId });
			await service.skipClosure(rerunId);

			// Second rerun: Sprint 12 (2) → Sprint 12 (3)
			handler.mockClear();
			await service.rerunSession(rerunId);
			expect(handler.mock.calls[0][0].payload.session.title).toBe("Sprint 12 (3)");
		});

		it("should not rerun an active session", async () => {
			await eventBus.emit("session.create", { type: "event-storming", title: "Active", durationMinutes: 25 });
			const activeSession = service.getSessions().find((s) => s.title === "Active");
			expect(activeSession).toBeDefined();
			await eventBus.emit("session.start", { sessionId: activeSession!.id });

			const countBefore = service.getSessions().length;
			await service.rerunSession(activeSession!.id);
			expect(service.getSessions().length).toBe(countBefore);
		});

		it("should not rerun a prepared session", async () => {
			await eventBus.emit("session.create", { type: "event-storming", title: "P", durationMinutes: 25 });
			const preparedSession = service.getSessions().find((s) => s.title === "P");
			expect(preparedSession).toBeDefined();

			const countBefore = service.getSessions().length;
			await service.rerunSession(preparedSession!.id);
			expect(service.getSessions().length).toBe(countBefore);
		});

		it("should not rerun a non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.rerunSession("nonexistent");
			expect(handler).not.toHaveBeenCalled();
		});

		it("should carry focusFile forward on rerun", async () => {
			// Create a session with focusFile, complete it, then rerun
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Focused Sprint",
				durationMinutes: 25,
				focusFile: "docs/hubs.md",
			});

			const focused = service.getSessions().find((s) => s.title === "Focused Sprint");
			expect(focused).toBeDefined();
			await eventBus.emit("session.start", { sessionId: focused!.id });
			await eventBus.emit("session.complete", { sessionId: focused!.id });
			await service.skipClosure(focused!.id);

			const countBefore = service.getSessions().length;
			await service.rerunSession(focused!.id);

			// Should have one more session than before
			expect(service.getSessions().length).toBe(countBefore + 1);
			const rerun = service.getSessions()[0]; // newest first
			expect(rerun.focusFile).toBe("docs/hubs.md");
		});
	});

	// ── Create from Template ────────────────────────────────

	describe("createFromTemplate", () => {
		let templateId: string;

		beforeEach(async () => {
			await service.load();
			const tmpl = await service.saveTemplate({
				name: "Sprint Storming",
				type: "event-storming",
				durationMinutes: 25,
			});
			templateId = tmpl.id;
		});

		it("should create a session from template with template name", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await service.createFromTemplate(templateId);

			expect(handler).toHaveBeenCalled();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.title).toBe("Sprint Storming");
			expect(session.type).toBe("event-storming");
			expect(session.durationMinutes).toBe(25);
			expect(session.status).toBe("prepared");
		});

		it("should use titleOverride when provided", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await service.createFromTemplate(templateId, "Custom Title");

			expect(handler.mock.calls[0][0].payload.session.title).toBe("Custom Title");
		});

		it("should no-op for non-existent template", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await service.createFromTemplate("nonexistent");

			expect(handler).not.toHaveBeenCalled();
		});

		it("should carry focusFile from template", async () => {
			const tmplWithFocus = await service.saveTemplate({
				name: "Focused Template",
				type: "service-design",
				durationMinutes: 50,
				focusFile: "docs/services.md",
			});
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await service.createFromTemplate(tmplWithFocus.id);

			expect(handler).toHaveBeenCalled();
			expect(handler.mock.calls[0][0].payload.session.focusFile).toBe("docs/services.md");
		});
	});

	// ── Backward Compatibility ──────────────────────────────

	describe("backward compatibility", () => {
		it("should initialize savedTemplates when loading old state without templates", async () => {
			// Old state shape: no savedTemplates field
			const oldState = { sessions: [makeSession()], activeSessionId: null } as SessionState;
			const mock = createMockStorage(oldState);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSavedTemplates()).toEqual([]);
		});

		it("should include savedTemplates in session.loaded event", async () => {
			await service.load();
			await service.saveTemplate({ name: "T1", type: "event-storming", durationMinutes: 25 });

			const handler = vi.fn();
			eventBus.on("session.loaded", handler);
			await eventBus.emit("session.refresh", {});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						savedTemplates: expect.arrayContaining([
							expect.objectContaining({ name: "T1" }),
						]),
					}),
				}),
			);
		});

		it("should load state that already has savedTemplates", async () => {
			const stateWithTemplates: SessionState = {
				sessions: [],
				activeSessionId: null,
				savedTemplates: [{
					id: "tmpl_existing",
					name: "Existing",
					type: "event-storming",
					durationMinutes: 25,
					createdAt: Date.now(),
				}],
			};
			const mock = createMockStorage(stateWithTemplates);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getSavedTemplates()).toHaveLength(1);
			expect(service.getSavedTemplates()[0].name).toBe("Existing");
		});
	});

	// ── Timeline Recording ──────────────────────────────────

	describe("timeline recording", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Timeline Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should create a session with empty timeline", () => {
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.timeline).toEqual([]);
		});

		it("should record started entry on start", async () => {
			await eventBus.emit("session.start", { sessionId });
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.timeline).toHaveLength(1);
			expect(session!.timeline[0].action).toBe("started");
			expect(session!.timeline[0].timestamp).toBe(session!.startedAt);
		});

		it("should record paused entry on pause", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5 * 60_000);
			await eventBus.emit("session.pause", { sessionId });

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.timeline).toHaveLength(2);
			expect(session!.timeline[1].action).toBe("paused");
			expect(session!.timeline[1].timestamp).toBe(session!.pausedAt);
		});

		it("should record resumed entry on resume", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5 * 60_000);
			await eventBus.emit("session.pause", { sessionId });
			await eventBus.emit("session.resume", { sessionId });

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.timeline).toHaveLength(3);
			expect(session!.timeline[2].action).toBe("resumed");
			expect(session!.timeline[2].timestamp).toBe(session!.startedAt);
		});

		it("should record completed entry on complete", async () => {
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			const session = service.getSessions().find((s) => s.id === sessionId);
			// v2: timeline includes reviewing + completed (via skipClosure)
			expect(session!.timeline).toHaveLength(3);
			expect(session!.timeline[1].action).toBe("reviewing");
			expect(session!.timeline[2].action).toBe("completed");
			expect(session!.timeline[2].timestamp).toBe(session!.completedAt);
		});

		it("should record full lifecycle in order", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5 * 60_000);
			await eventBus.emit("session.pause", { sessionId });
			await eventBus.emit("session.resume", { sessionId });
			vi.advanceTimersByTime(3 * 60_000);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.timeline).toHaveLength(5);
			expect(session!.timeline.map((e) => e.action)).toEqual([
				"started", "paused", "resumed", "reviewing", "completed",
			]);
		});

		it("should accumulate multiple pause/resume cycles", async () => {
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(3 * 60_000);
			await eventBus.emit("session.pause", { sessionId });
			await eventBus.emit("session.resume", { sessionId });
			vi.advanceTimersByTime(3 * 60_000);
			await eventBus.emit("session.pause", { sessionId });
			await eventBus.emit("session.resume", { sessionId });
			vi.advanceTimersByTime(3 * 60_000);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.timeline).toHaveLength(7); // started, paused, resumed, paused, resumed, reviewing, completed
			expect(session!.timeline.filter((e) => e.action === "paused")).toHaveLength(2);
		});

		it("should initialize timeline for legacy sessions on load", async () => {
			// Save a session without timeline field
			const legacySession = makeSession({ id: "legacy-1" }) as unknown as Record<string, unknown>;
			delete legacySession.timeline;
			await storage.save({
				sessions: [legacySession as unknown as Session],
				activeSessionId: null,
				savedTemplates: [],
			});

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			const loaded = freshService.getSessions().find((s) => s.id === "legacy-1");
			expect(loaded!.timeline).toEqual([]);
		});
	});

	// ── Goal CRUD ───────────────────────────────────────────

	describe("goal CRUD", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Goal Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should add a goal to a session", async () => {
			const handler = vi.fn();
			eventBus.on("session.goal.added", handler);

			await eventBus.emit("session.goal.add", { sessionId, text: "Finish review" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessionId,
						goal: expect.objectContaining({
							text: "Finish review",
							completed: false,
							completedAt: null,
						}),
					}),
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.goals).toHaveLength(1);
		});

		it("should generate a unique goal ID", async () => {
			await eventBus.emit("session.goal.add", { sessionId, text: "Goal A" });
			await eventBus.emit("session.goal.add", { sessionId, text: "Goal B" });

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.goals).toHaveLength(2);
			expect(session!.goals[0].id).not.toBe(session!.goals[1].id);
			expect(session!.goals[0].id).toMatch(/^goal_/);
		});

		it("should toggle a goal to completed", async () => {
			const addHandler = vi.fn();
			eventBus.on("session.goal.added", addHandler);
			await eventBus.emit("session.goal.add", { sessionId, text: "Toggle me" });
			const goalId = addHandler.mock.calls[0][0].payload.goal.id;

			const toggleHandler = vi.fn();
			eventBus.on("session.goal.toggled", toggleHandler);
			await eventBus.emit("session.goal.toggle", { sessionId, goalId });

			expect(toggleHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, goalId, completed: true },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			const goal = session!.goals.find((g) => g.id === goalId);
			expect(goal!.completed).toBe(true);
			expect(goal!.completedAt).not.toBeNull();
		});

		it("should toggle a goal back to incomplete", async () => {
			const addHandler = vi.fn();
			eventBus.on("session.goal.added", addHandler);
			await eventBus.emit("session.goal.add", { sessionId, text: "Toggle twice" });
			const goalId = addHandler.mock.calls[0][0].payload.goal.id;

			// Toggle on
			await eventBus.emit("session.goal.toggle", { sessionId, goalId });
			// Toggle off
			const toggleHandler = vi.fn();
			eventBus.on("session.goal.toggled", toggleHandler);
			await eventBus.emit("session.goal.toggle", { sessionId, goalId });

			expect(toggleHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, goalId, completed: false },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			const goal = session!.goals.find((g) => g.id === goalId);
			expect(goal!.completed).toBe(false);
			expect(goal!.completedAt).toBeNull();
		});

		it("should remove a goal from a session", async () => {
			const addHandler = vi.fn();
			eventBus.on("session.goal.added", addHandler);
			await eventBus.emit("session.goal.add", { sessionId, text: "Remove me" });
			const goalId = addHandler.mock.calls[0][0].payload.goal.id;

			const removeHandler = vi.fn();
			eventBus.on("session.goal.removed", removeHandler);
			await eventBus.emit("session.goal.remove", { sessionId, goalId });

			expect(removeHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, goalId },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.goals).toHaveLength(0);
		});

		it("should ignore goal add for non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.goal.added", handler);
			await eventBus.emit("session.goal.add", { sessionId: "nonexistent", text: "X" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should ignore goal toggle for non-existent goal", async () => {
			const handler = vi.fn();
			eventBus.on("session.goal.toggled", handler);
			await eventBus.emit("session.goal.toggle", { sessionId, goalId: "nonexistent" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should ignore goal remove for non-existent goal", async () => {
			const handler = vi.fn();
			eventBus.on("session.goal.removed", handler);
			await eventBus.emit("session.goal.remove", { sessionId, goalId: "nonexistent" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should save state after goal add", async () => {
			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.goal.add", { sessionId, text: "Persist me" });
			expect(storage.save).toHaveBeenCalled();
		});

		it("should save state after goal toggle", async () => {
			const addHandler = vi.fn();
			eventBus.on("session.goal.added", addHandler);
			await eventBus.emit("session.goal.add", { sessionId, text: "T" });
			const goalId = addHandler.mock.calls[0][0].payload.goal.id;

			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.goal.toggle", { sessionId, goalId });
			expect(storage.save).toHaveBeenCalled();
		});

		it("should save state after goal remove", async () => {
			const addHandler = vi.fn();
			eventBus.on("session.goal.added", addHandler);
			await eventBus.emit("session.goal.add", { sessionId, text: "T" });
			const goalId = addHandler.mock.calls[0][0].payload.goal.id;

			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.goal.remove", { sessionId, goalId });
			expect(storage.save).toHaveBeenCalled();
		});
	});

	// ── Duration ─────────────────────────────────────────────

	describe("duration update", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Duration Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should update duration for a prepared session", async () => {
			const handler = vi.fn();
			eventBus.on("session.duration.updated", handler);

			await eventBus.emit("session.duration.update", { sessionId, durationMinutes: 45 });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, durationMinutes: 45 },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.durationMinutes).toBe(45);
		});

		it("should ignore duration update for non-prepared session", async () => {
			await eventBus.emit("session.start", { sessionId });
			const handler = vi.fn();
			eventBus.on("session.duration.updated", handler);

			await eventBus.emit("session.duration.update", { sessionId, durationMinutes: 60 });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should ignore duration update with value less than 1", async () => {
			const handler = vi.fn();
			eventBus.on("session.duration.updated", handler);

			await eventBus.emit("session.duration.update", { sessionId, durationMinutes: 0 });

			expect(handler).not.toHaveBeenCalled();
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.durationMinutes).toBe(25);
		});

		it("should ignore duration update for non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.duration.updated", handler);

			await eventBus.emit("session.duration.update", { sessionId: "unknown", durationMinutes: 30 });

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── Notes file ──────────────────────────────────────────

	describe("notes file", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Notes File Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should set notes file path", async () => {
			const handler = vi.fn();
			eventBus.on("session.notesFile.updated", handler);

			await eventBus.emit("session.notesFile.set", { sessionId, path: "Sessions/Test.md" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, path: "Sessions/Test.md" },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.notesFile).toBe("Sessions/Test.md");
		});

		it("should ignore set for non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.notesFile.updated", handler);

			await eventBus.emit("session.notesFile.set", { sessionId: "unknown", path: "x.md" });

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── Notes ────────────────────────────────────────────────

	describe("notes update", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Notes Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should update session notes", async () => {
			const handler = vi.fn();
			eventBus.on("session.notes.updated", handler);

			await eventBus.emit("session.notes.update", { sessionId, notes: "My session notes" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, notes: "My session notes" },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.notes).toBe("My session notes");
		});

		it("should overwrite existing notes", async () => {
			await eventBus.emit("session.notes.update", { sessionId, notes: "First" });
			await eventBus.emit("session.notes.update", { sessionId, notes: "Second" });

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.notes).toBe("Second");
		});

		it("should ignore notes update for non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.notes.updated", handler);
			await eventBus.emit("session.notes.update", { sessionId: "nonexistent", notes: "X" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should save state after notes update", async () => {
			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.notes.update", { sessionId, notes: "Persist" });
			expect(storage.save).toHaveBeenCalled();
		});
	});

	// ── Create with Goals ───────────────────────────────────

	describe("create with goals", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should create session with goals from string array", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Goal Session",
				durationMinutes: 25,
				goals: ["Review events", "Update docs"],
			});

			const session = handler.mock.calls[0][0].payload.session;
			expect(session.goals).toHaveLength(2);
			expect(session.goals[0].text).toBe("Review events");
			expect(session.goals[0].completed).toBe(false);
			expect(session.goals[0].id).toMatch(/^goal_/);
			expect(session.goals[1].text).toBe("Update docs");
		});

		it("should create session with empty goals when not provided", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "No Goals",
				durationMinutes: 25,
			});

			expect(handler.mock.calls[0][0].payload.session.goals).toEqual([]);
		});

		it("should create session with empty goals when empty array provided", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Empty Goals",
				durationMinutes: 25,
				goals: [],
			});

			expect(handler.mock.calls[0][0].payload.session.goals).toEqual([]);
		});
	});

	// ── Rerun with Goals ────────────────────────────────────

	describe("rerun with goals", () => {
		let completedSessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Goal Sprint",
				durationMinutes: 25,
				goals: ["Write tests", "Update docs"],
			});
			completedSessionId = handler.mock.calls[0][0].payload.session.id;

			// Complete a goal before completing session
			const session = service.getSessions().find((s) => s.id === completedSessionId);
			const goalId = session!.goals[0].id;
			await eventBus.emit("session.goal.toggle", { sessionId: completedSessionId, goalId });

			await eventBus.emit("session.start", { sessionId: completedSessionId });
			await eventBus.emit("session.complete", { sessionId: completedSessionId });
			await service.skipClosure(completedSessionId);
		});

		it("should carry goal text forward on rerun", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.rerunSession(completedSessionId);

			expect(handler).toHaveBeenCalled();
			const newSession = handler.mock.calls[0][0].payload.session;
			expect(newSession.goals).toHaveLength(2);
			expect(newSession.goals[0].text).toBe("Write tests");
			expect(newSession.goals[1].text).toBe("Update docs");
		});

		it("should reset goal completed state on rerun", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.rerunSession(completedSessionId);

			const newSession = handler.mock.calls[0][0].payload.session;
			expect(newSession.goals[0].completed).toBe(false);
			expect(newSession.goals[0].completedAt).toBeNull();
			expect(newSession.goals[1].completed).toBe(false);
		});

		it("should generate new goal IDs on rerun", async () => {
			const original = service.getSessions().find((s) => s.id === completedSessionId);
			const originalGoalIds = original!.goals.map((g) => g.id);

			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.rerunSession(completedSessionId);

			const newSession = handler.mock.calls[0][0].payload.session;
			const newGoalIds = newSession.goals.map((g: { id: string }) => g.id);

			// New IDs should be different from original
			for (const newId of newGoalIds) {
				expect(originalGoalIds).not.toContain(newId);
			}
		});
	});

	// ── Template with Goals ─────────────────────────────────

	describe("template with goals", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should include goal texts in template saved from session", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Template Sprint",
				durationMinutes: 25,
				goals: ["Goal A", "Goal B"],
			});
			const sessionId = handler.mock.calls[0][0].payload.session.id;
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const tmpl = await service.saveTemplateFromSession(sessionId, "Sprint Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.goals).toEqual(["Goal A", "Goal B"]);
		});

		it("should omit goals from template when session has no goals", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "No Goal Sprint",
				durationMinutes: 25,
			});
			const sessionId = handler.mock.calls[0][0].payload.session.id;
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const tmpl = await service.saveTemplateFromSession(sessionId, "No Goal Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.goals).toBeUndefined();
		});

		it("should create session with goals from template", async () => {
			const tmpl = await service.saveTemplate({
				name: "Goal Template",
				type: "event-storming",
				durationMinutes: 25,
				goals: ["Task 1", "Task 2", "Task 3"],
			});

			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.createFromTemplate(tmpl.id);

			const session = handler.mock.calls[0][0].payload.session;
			expect(session.goals).toHaveLength(3);
			expect(session.goals[0].text).toBe("Task 1");
			expect(session.goals[1].text).toBe("Task 2");
			expect(session.goals[2].text).toBe("Task 3");
			expect(session.goals[0].completed).toBe(false);
		});

		it("should create session without goals from template without goals", async () => {
			const tmpl = await service.saveTemplate({
				name: "No Goal Template",
				type: "event-storming",
				durationMinutes: 25,
			});

			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.createFromTemplate(tmpl.id);

			expect(handler.mock.calls[0][0].payload.session.goals).toEqual([]);
		});
	});

	// ── Context-Aware Templates (Inc 2.5) ────────────────────

	describe("context-aware templates", () => {
		it("saveTemplateFromSession captures context bindings", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "Ctx Session", durationMinutes: 25 });
			const sessionId = handler.mock.calls[0][0].payload.session.id;

			// Add a context binding
			await eventBus.emit("session.context.bind", { sessionId, path: "src/main.ts", type: "file" });
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const tmpl = await service.saveTemplateFromSession(sessionId, "Ctx Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.contextBindings).toEqual([{ path: "src/main.ts", type: "file" }]);
		});

		it("saveTemplateFromSession captures notes", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "Notes Session", durationMinutes: 25 });
			const sessionId = handler.mock.calls[0][0].payload.session.id;

			await eventBus.emit("session.notes.update", { sessionId, notes: "Important context" });
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const tmpl = await service.saveTemplateFromSession(sessionId, "Notes Template");
			expect(tmpl).not.toBeNull();
			expect(tmpl!.notes).toBe("Important context");
		});

		it("saveTemplateFromSession omits empty context bindings and notes", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "Empty Session", durationMinutes: 25 });
			const sessionId = handler.mock.calls[0][0].payload.session.id;
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });

			const tmpl = await service.saveTemplateFromSession(sessionId, "Empty Template");
			expect(tmpl!.contextBindings).toBeUndefined();
			expect(tmpl!.notes).toBeUndefined();
		});

		it("createFromTemplate hydrates context bindings", async () => {
			const tmpl = await service.saveTemplate({
				name: "Ctx Template",
				type: "event-storming",
				durationMinutes: 25,
				contextBindings: [
					{ path: "src/main.ts", type: "file" },
					{ path: "docs/readme.md", type: "domain" },
				],
			});

			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.createFromTemplate(tmpl.id);

			const session = handler.mock.calls[0][0].payload.session;
			expect(session.contextBindings).toHaveLength(2);
			expect(session.contextBindings[0].path).toBe("src/main.ts");
			expect(session.contextBindings[0].type).toBe("file");
			expect(session.contextBindings[1].path).toBe("docs/readme.md");
			expect(session.contextBindings[1].type).toBe("domain");
		});

		it("createFromTemplate hydrates notes", async () => {
			const tmpl = await service.saveTemplate({
				name: "Notes Template",
				type: "event-storming",
				durationMinutes: 25,
				notes: "Template notes",
			});

			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await service.createFromTemplate(tmpl.id);

			expect(handler.mock.calls[0][0].payload.session.notes).toBe("Template notes");
		});

		it("rerunSession carries context bindings and notes", async () => {
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", { type: "event-storming", title: "Rerun Source", durationMinutes: 25 });
			const sessionId = handler.mock.calls[0][0].payload.session.id;

			await eventBus.emit("session.context.bind", { sessionId, path: "src/service.ts", type: "folder" });
			await eventBus.emit("session.notes.update", { sessionId, notes: "Session notes" });
			await eventBus.emit("session.start", { sessionId });
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);

			handler.mockClear();
			await service.rerunSession(sessionId);

			const rerun = handler.mock.calls[0][0].payload.session;
			expect(rerun.contextBindings).toHaveLength(1);
			expect(rerun.contextBindings[0].path).toBe("src/service.ts");
			expect(rerun.contextBindings[0].type).toBe("folder");
			expect(rerun.notes).toBe("Session notes");
		});

		it("exportTemplate includes context bindings and notes", async () => {
			const tmpl = await service.saveTemplate({
				name: "Export Template",
				type: "event-storming",
				durationMinutes: 25,
				contextBindings: [{ path: "src/app.ts", type: "file" }],
				notes: "Export notes",
			});

			const exported = service.exportTemplate(tmpl.id);
			expect(exported).not.toBeNull();
			expect(exported!.template.contextBindings).toEqual([{ path: "src/app.ts", type: "file" }]);
			expect(exported!.template.notes).toBe("Export notes");
		});

		it("importTemplate accepts context bindings and notes", async () => {
			const exportData = {
				version: 1,
				template: {
					name: "Import Template",
					type: "event-storming",
					durationMinutes: 25,
					contextBindings: [{ path: "src/types.ts", type: "domain" }],
					notes: "Import notes",
				},
			};

			const imported = await service.importTemplate(exportData);
			expect(imported).not.toBeNull();
			expect(imported!.contextBindings).toEqual([{ path: "src/types.ts", type: "domain" }]);
			expect(imported!.notes).toBe("Import notes");
		});

		it("isValidTemplateExport rejects non-array contextBindings", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: { name: "Bad", type: "event-storming", durationMinutes: 25, contextBindings: "bad" },
			});
			expect(result).toBeNull();
		});

		it("isValidTemplateExport rejects non-string notes", async () => {
			const result = await service.importTemplate({
				version: 1,
				template: { name: "Bad", type: "event-storming", durationMinutes: 25, notes: 123 },
			});
			expect(result).toBeNull();
		});
	});

	// ── Backward Compatibility — Goals ──────────────────────

	describe("backward compatibility — goals", () => {
		it("should initialize goals array for legacy sessions on load", async () => {
			const legacySession = makeSession({ id: "legacy-goals" }) as unknown as Record<string, unknown>;
			delete legacySession.goals;
			await storage.save({
				sessions: [legacySession as unknown as Session],
				activeSessionId: null,
				savedTemplates: [],
			});

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			const loaded = freshService.getSessions().find((s) => s.id === "legacy-goals");
			expect(loaded!.goals).toEqual([]);
			freshService.dispose();
		});
	});

	// ── Link CRUD ───────────────────────────────────────────

	describe("link CRUD", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Link Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should add a link to a session", async () => {
			const handler = vi.fn();
			eventBus.on("session.link.added", handler);

			await eventBus.emit("session.link.add", { sessionId, path: "docs/events.md" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessionId,
						link: expect.objectContaining({ path: "docs/events.md" }),
					}),
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.links).toHaveLength(1);
			expect(session!.links[0].path).toBe("docs/events.md");
			expect(session!.links[0].addedAt).toBeTruthy();
		});

		it("should deduplicate links by path", async () => {
			const handler = vi.fn();
			eventBus.on("session.link.added", handler);

			await eventBus.emit("session.link.add", { sessionId, path: "docs/events.md" });
			await eventBus.emit("session.link.add", { sessionId, path: "docs/events.md" });

			expect(handler).toHaveBeenCalledTimes(1);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.links).toHaveLength(1);
		});

		it("should allow different paths", async () => {
			await eventBus.emit("session.link.add", { sessionId, path: "docs/a.md" });
			await eventBus.emit("session.link.add", { sessionId, path: "docs/b.md" });

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.links).toHaveLength(2);
		});

		it("should remove a link from a session", async () => {
			await eventBus.emit("session.link.add", { sessionId, path: "docs/events.md" });

			const handler = vi.fn();
			eventBus.on("session.link.removed", handler);
			await eventBus.emit("session.link.remove", { sessionId, path: "docs/events.md" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, path: "docs/events.md" },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.links).toHaveLength(0);
		});

		it("should ignore remove for non-existent link", async () => {
			const handler = vi.fn();
			eventBus.on("session.link.removed", handler);
			await eventBus.emit("session.link.remove", { sessionId, path: "nonexistent.md" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should ignore link add for non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.link.added", handler);
			await eventBus.emit("session.link.add", { sessionId: "nonexistent", path: "test.md" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should save state after link add", async () => {
			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.link.add", { sessionId, path: "docs/test.md" });
			expect(storage.save).toHaveBeenCalled();
		});

		it("should save state after link remove", async () => {
			await eventBus.emit("session.link.add", { sessionId, path: "docs/test.md" });
			(storage.save as ReturnType<typeof vi.fn>).mockClear();
			await eventBus.emit("session.link.remove", { sessionId, path: "docs/test.md" });
			expect(storage.save).toHaveBeenCalled();
		});
	});

	// ── Backward Compatibility — Links ─────────────────────

	describe("backward compatibility — links", () => {
		it("should initialize links array for legacy sessions on load", async () => {
			const legacySession = makeSession({ id: "legacy-links" }) as unknown as Record<string, unknown>;
			delete legacySession.links;
			await storage.save({
				sessions: [legacySession as unknown as Session],
				activeSessionId: null,
				savedTemplates: [],
			});

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			const loaded = freshService.getSessions().find((s) => s.id === "legacy-links");
			expect(loaded!.links).toEqual([]);
			freshService.dispose();
		});
	});

	// ── Link → Context Binding Migration ───────────────────

	describe("link → context binding migration", () => {
		it("should migrate links to context bindings on load", async () => {
			const sessionWithLinks = makeSession({
				id: "migrate-links",
				links: [
					{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" },
					{ path: "docs/services.md", addedAt: "2026-02-16T10:01:00.000Z" },
				],
				contextBindings: [],
			});
			await storage.save({
				sessions: [sessionWithLinks],
				activeSessionId: null,
				savedTemplates: [],
			});

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			const loaded = freshService.getSessions().find((s) => s.id === "migrate-links");
			expect(loaded!.links).toEqual([]);
			expect(loaded!.contextBindings).toHaveLength(2);
			expect(loaded!.contextBindings[0].path).toBe("docs/events.md");
			expect(loaded!.contextBindings[0].type).toBe("file");
			expect(loaded!.contextBindings[0].label).toBe("events");
			expect(loaded!.contextBindings[1].path).toBe("docs/services.md");
			expect(loaded!.contextBindings[1].label).toBe("services");
			freshService.dispose();
		});

		it("should not duplicate when link path already exists as binding", async () => {
			const sessionWithBoth = makeSession({
				id: "dedup-migration",
				links: [{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" }],
				contextBindings: [{
					id: "ctx_existing",
					type: "file",
					label: "events",
					path: "docs/events.md",
					boundAt: "2026-02-16T09:00:00.000Z",
				}],
			});
			await storage.save({
				sessions: [sessionWithBoth],
				activeSessionId: null,
				savedTemplates: [],
			});

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			const loaded = freshService.getSessions().find((s) => s.id === "dedup-migration");
			expect(loaded!.links).toEqual([]);
			expect(loaded!.contextBindings).toHaveLength(1);
			freshService.dispose();
		});

		it("should persist migration via saveState", async () => {
			const sessionWithLinks = makeSession({
				id: "persist-migration",
				links: [{ path: "docs/a.md", addedAt: "2026-02-16T10:00:00.000Z" }],
				contextBindings: [],
			});
			await storage.save({
				sessions: [sessionWithLinks],
				activeSessionId: null,
				savedTemplates: [],
			});
			(storage.save as ReturnType<typeof vi.fn>).mockClear();

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			expect(storage.save).toHaveBeenCalled();
			freshService.dispose();
		});
	});

	// ── Context Bindings ───────────────────────────────────

	describe("context bindings", () => {
		let sessionId: string;

		beforeEach(async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("session.created", handler);
			await eventBus.emit("session.create", {
				type: "event-storming",
				title: "Context Test",
				durationMinutes: 25,
			});
			sessionId = handler.mock.calls[0][0].payload.session.id;
		});

		it("should bind a context to a session", async () => {
			const handler = vi.fn();
			eventBus.on("session.context.bound", handler);

			await eventBus.emit("session.context.bind", { sessionId, path: "docs/domain/orders", type: "domain" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sessionId,
						binding: expect.objectContaining({
							path: "docs/domain/orders",
							type: "domain",
						}),
					}),
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.contextBindings).toHaveLength(1);
		});

		it("should deduplicate bindings by path", async () => {
			const handler = vi.fn();
			eventBus.on("session.context.bound", handler);

			await eventBus.emit("session.context.bind", { sessionId, path: "docs/domain/orders", type: "domain" });
			await eventBus.emit("session.context.bind", { sessionId, path: "docs/domain/orders", type: "feature" });

			expect(handler).toHaveBeenCalledTimes(1);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.contextBindings).toHaveLength(1);
		});

		it("should enforce max 10 bindings", async () => {
			const handler = vi.fn();
			eventBus.on("session.context.bound", handler);

			for (let i = 0; i < MAX_CONTEXT_BINDINGS; i++) {
				await eventBus.emit("session.context.bind", { sessionId, path: `docs/ctx-${i}`, type: "file" });
			}
			expect(handler).toHaveBeenCalledTimes(MAX_CONTEXT_BINDINGS);

			// 11th binding should be rejected
			handler.mockClear();
			await eventBus.emit("session.context.bind", { sessionId, path: "docs/ctx-overflow", type: "file" });
			expect(handler).not.toHaveBeenCalled();

			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.contextBindings).toHaveLength(MAX_CONTEXT_BINDINGS);
		});

		it("should unbind a context", async () => {
			const boundHandler = vi.fn();
			eventBus.on("session.context.bound", boundHandler);
			await eventBus.emit("session.context.bind", { sessionId, path: "docs/domain/orders", type: "domain" });
			const bindingId = boundHandler.mock.calls[0][0].payload.binding.id;

			const unboundHandler = vi.fn();
			eventBus.on("session.context.unbound", unboundHandler);
			await eventBus.emit("session.context.unbind", { sessionId, bindingId });

			expect(unboundHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, bindingId },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			expect(session!.contextBindings).toHaveLength(0);
		});

		it("should ignore unbind for non-existent binding", async () => {
			const handler = vi.fn();
			eventBus.on("session.context.unbound", handler);
			await eventBus.emit("session.context.unbind", { sessionId, bindingId: "nonexistent" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should ignore bind for non-existent session", async () => {
			const handler = vi.fn();
			eventBus.on("session.context.bound", handler);
			await eventBus.emit("session.context.bind", { sessionId: "nonexistent", path: "docs/test", type: "file" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should change binding type", async () => {
			const boundHandler = vi.fn();
			eventBus.on("session.context.bound", boundHandler);
			await eventBus.emit("session.context.bind", { sessionId, path: "docs/domain/orders", type: "domain" });
			const bindingId = boundHandler.mock.calls[0][0].payload.binding.id;

			const changedHandler = vi.fn();
			eventBus.on("session.context.typeChanged", changedHandler);
			await eventBus.emit("session.context.changeType", { sessionId, bindingId, type: "feature" });

			expect(changedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { sessionId, bindingId, type: "feature" },
				}),
			);
			const session = service.getSessions().find((s) => s.id === sessionId);
			const binding = session!.contextBindings.find((b) => b.id === bindingId);
			expect(binding!.type).toBe("feature");
		});
	});

	// ── Backward Compatibility — Context Bindings ──────────

	describe("backward compat — context bindings", () => {
		it("should initialize contextBindings array for legacy sessions", async () => {
			const legacySession = makeSession({ id: "legacy-ctx" }) as unknown as Record<string, unknown>;
			delete legacySession.contextBindings;
			await storage.save({
				sessions: [legacySession as unknown as Session],
				activeSessionId: null,
				savedTemplates: [],
			});

			const freshService = new SessionService({ storage, eventBus });
			await freshService.load();
			const loaded = freshService.getSessions().find((s) => s.id === "legacy-ctx");
			expect(loaded!.contextBindings).toEqual([]);
			freshService.dispose();
		});
	});

	// ── generateRerunTitle ──────────────────────────────────

	describe("generateRerunTitle", () => {
		it("should append (2) to a title without suffix", () => {
			expect(generateRerunTitle("Sprint 12")).toBe("Sprint 12 (2)");
		});

		it("should increment existing suffix", () => {
			expect(generateRerunTitle("Sprint 12 (2)")).toBe("Sprint 12 (3)");
		});

		it("should increment high numbers", () => {
			expect(generateRerunTitle("Sprint 12 (99)")).toBe("Sprint 12 (100)");
		});

		it("should handle title with no spaces before suffix", () => {
			expect(generateRerunTitle("Test(5)")).toBe("Test (6)");
		});

		it("should handle simple single-word title", () => {
			expect(generateRerunTitle("Review")).toBe("Review (2)");
		});
	});

	// ── File/folder rename path reconciliation ──────────────

	describe("file rename path reconciliation", () => {
		it("should update focusFile when file is renamed", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", focusFile: "docs/old.md" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.paths.updated", handler);

			await eventBus.emit("file.renamed", { path: "docs/new.md", oldPath: "docs/old.md", newPath: "docs/new.md", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.focusFile).toBe("docs/new.md");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.sessionIds).toEqual(["s1"]);
		});

		it("should update notesFile when file is renamed", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", notesFile: "03 - Resources/Sessions/Test (abc123).md" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			await eventBus.emit("file.renamed", {
				path: "03 - Resources/Sessions/Renamed (abc123).md",
				oldPath: "03 - Resources/Sessions/Test (abc123).md",
				newPath: "03 - Resources/Sessions/Renamed (abc123).md",
				source: "obsidian" as const,
			});

			expect(service.getSessionById("s1")?.notesFile).toBe("03 - Resources/Sessions/Renamed (abc123).md");
		});

		it("should update canvasFile when file is renamed", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", canvasFile: "canvas/old.canvas" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			await eventBus.emit("file.renamed", { path: "canvas/new.canvas", oldPath: "canvas/old.canvas", newPath: "canvas/new.canvas", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.canvasFile).toBe("canvas/new.canvas");
		});

		it("should update context binding paths when file is renamed", async () => {
			const state: SessionState = {
				sessions: [makeSession({
					id: "s1",
					contextBindings: [{ id: "ctx_1", type: "file", label: "old.md", path: "docs/old.md", boundAt: "2026-02-16T10:00:00.000Z" }],
				})],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			await eventBus.emit("file.renamed", { path: "docs/new.md", oldPath: "docs/old.md", newPath: "docs/new.md", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.contextBindings[0].path).toBe("docs/new.md");
		});

		it("should update artifact paths when file is renamed", async () => {
			const state: SessionState = {
				sessions: [makeSession({
					id: "s1",
					artifacts: [{ path: "docs/old.md", action: "created", timestamp: "2026-02-16T10:00:00.000Z" }],
				})],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			await eventBus.emit("file.renamed", { path: "docs/new.md", oldPath: "docs/old.md", newPath: "docs/new.md", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.artifacts[0].path).toBe("docs/new.md");
		});

		it("should update template focusFile when file is renamed", async () => {
			const state: SessionState = {
				sessions: [],
				activeSessionId: null,
				savedTemplates: [{ id: "tmpl_1", name: "Test", type: "event-storming", durationMinutes: 25, focusFile: "docs/old.md", createdAt: Date.now() }],
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			await eventBus.emit("file.renamed", { path: "docs/new.md", oldPath: "docs/old.md", newPath: "docs/new.md", source: "obsidian" as const });

			expect(service.getSavedTemplates()[0].focusFile).toBe("docs/new.md");
		});

		it("should not update paths that do not match", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", focusFile: "docs/other.md", notesFile: "notes/keep.md" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.paths.updated", handler);

			await eventBus.emit("file.renamed", { path: "docs/new.md", oldPath: "docs/old.md", newPath: "docs/new.md", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.focusFile).toBe("docs/other.md");
			expect(service.getSessionById("s1")?.notesFile).toBe("notes/keep.md");
			expect(handler).not.toHaveBeenCalled();
		});

		it("should update multiple sessions when file is renamed", async () => {
			const state: SessionState = {
				sessions: [
					makeSession({ id: "s1", focusFile: "docs/shared.md" }),
					makeSession({ id: "s2", focusFile: "docs/shared.md" }),
					makeSession({ id: "s3", focusFile: "docs/other.md" }),
				],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.paths.updated", handler);

			await eventBus.emit("file.renamed", { path: "docs/moved.md", oldPath: "docs/shared.md", newPath: "docs/moved.md", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.focusFile).toBe("docs/moved.md");
			expect(service.getSessionById("s2")?.focusFile).toBe("docs/moved.md");
			expect(service.getSessionById("s3")?.focusFile).toBe("docs/other.md");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.sessionIds).toEqual(expect.arrayContaining(["s1", "s2"]));
			expect(handler.mock.calls[0][0].payload.sessionIds).not.toContain("s3");
		});
	});

	describe("folder rename path reconciliation", () => {
		it("should update all paths under renamed folder", async () => {
			const state: SessionState = {
				sessions: [makeSession({
					id: "s1",
					focusFile: "docs/features/plan.md",
					notesFile: "docs/features/notes.md",
					canvasFile: "docs/features/board.canvas",
					contextBindings: [
						{ id: "ctx_1", type: "folder", label: "features/", path: "docs/features/", boundAt: "2026-02-16T10:00:00.000Z" },
						{ id: "ctx_2", type: "file", label: "plan.md", path: "docs/features/plan.md", boundAt: "2026-02-16T10:00:00.000Z" },
					],
					artifacts: [{ path: "docs/features/output.md", action: "created", timestamp: "2026-02-16T10:00:00.000Z" }],
					activityFilter: ["docs/features/drafts"],
				})],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.paths.updated", handler);

			await eventBus.emit("folder.renamed", { oldPath: "docs/features", newPath: "docs/specs", source: "obsidian" as const });

			const session = service.getSessionById("s1");
			expect(session?.focusFile).toBe("docs/specs/plan.md");
			expect(session?.notesFile).toBe("docs/specs/notes.md");
			expect(session?.canvasFile).toBe("docs/specs/board.canvas");
			expect(session?.contextBindings[0].path).toBe("docs/specs/");
			expect(session?.contextBindings[1].path).toBe("docs/specs/plan.md");
			expect(session?.artifacts[0].path).toBe("docs/specs/output.md");
			expect(session?.activityFilter[0]).toBe("docs/specs/drafts");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.sessionIds).toEqual(["s1"]);
		});

		it("should update template focusFile under renamed folder", async () => {
			const state: SessionState = {
				sessions: [],
				activeSessionId: null,
				savedTemplates: [{ id: "tmpl_1", name: "Test", type: "event-storming", durationMinutes: 25, focusFile: "docs/old-folder/focus.md", createdAt: Date.now() }],
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			await eventBus.emit("folder.renamed", { oldPath: "docs/old-folder", newPath: "docs/new-folder", source: "obsidian" as const });

			expect(service.getSavedTemplates()[0].focusFile).toBe("docs/new-folder/focus.md");
		});

		it("should not update paths outside renamed folder", async () => {
			const state: SessionState = {
				sessions: [makeSession({ id: "s1", focusFile: "other/plan.md" })],
				activeSessionId: null,
			};
			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.paths.updated", handler);

			await eventBus.emit("folder.renamed", { oldPath: "docs/features", newPath: "docs/specs", source: "obsidian" as const });

			expect(service.getSessionById("s1")?.focusFile).toBe("other/plan.md");
			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── Type configuration ──────────────────────────────────

	describe("type configuration", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should handle session.type.create for custom types", async () => {
			const handler = vi.fn();
			eventBus.on("session.type.created", handler);

			await eventBus.emit("session.type.create", {
				config: {
					type: "sprint-review" as Session["type"],
					label: "Sprint Review",
					icon: "presentation",
					guidingQuestions: ["What was delivered?", "What blockers remain?"],
					defaultDuration: 30,
					defaultGoals: [],
				},
			});

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						config: expect.objectContaining({ label: "Sprint Review" }),
					}),
				}),
			);
		});

		it("should emit settings.updateCustomSessionTypes on create", async () => {
			const settingsHandler = vi.fn();
			eventBus.on("settings.updateCustomSessionTypes", settingsHandler);

			await eventBus.emit("session.type.create", {
				config: {
					type: "sprint-review" as Session["type"],
					label: "Sprint Review",
					icon: "presentation",
					guidingQuestions: [],
					defaultDuration: 30,
					defaultGoals: [],
				},
			});

			expect(settingsHandler).toHaveBeenCalledOnce();
			const types = settingsHandler.mock.calls[0][0].payload.types;
			expect(types["sprint-review"]).toBeDefined();
			expect(types["sprint-review"].label).toBe("Sprint Review");
		});

		it("should not overwrite built-in types via create", async () => {
			const handler = vi.fn();
			eventBus.on("session.type.created", handler);

			await eventBus.emit("session.type.create", {
				config: {
					type: "event-storming" as Session["type"],
					label: "Overwrite Attempt",
					icon: "x",
					guidingQuestions: [],
					defaultDuration: 1,
					defaultGoals: [],
				},
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it("should reject create with empty type", async () => {
			const handler = vi.fn();
			eventBus.on("session.type.created", handler);

			await eventBus.emit("session.type.create", {
				config: {
					type: "" as Session["type"],
					label: "Empty",
					icon: "x",
					guidingQuestions: [],
					defaultDuration: 25,
					defaultGoals: [],
				},
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it("should handle session.type.configure for overriding a type", async () => {
			const handler = vi.fn();
			eventBus.on("session.type.configured", handler);

			await eventBus.emit("session.type.configure", {
				type: "event-storming" as Session["type"],
				config: {
					defaultDuration: 90,
					guidingQuestions: ["New question?"],
				},
			});

			expect(handler).toHaveBeenCalledOnce();
			const config = handler.mock.calls[0][0].payload.config;
			expect(config.type).toBe("event-storming");
			expect(config.defaultDuration).toBe(90);
			expect(config.guidingQuestions).toEqual(["New question?"]);
			expect(config.label).toBe("Event Storming"); // preserved from built-in
		});

		it("should store configured type in customSessionTypes", async () => {
			await eventBus.emit("session.type.configure", {
				type: "documentation" as Session["type"],
				config: { defaultDuration: 45 },
			});

			expect(service.customSessionTypes["documentation"]).toBeDefined();
			expect(service.customSessionTypes["documentation"].defaultDuration).toBe(45);
		});
	});

	// ── Backward compatibility ──────────────────────────────

	describe("backward compat — type field", () => {
		it("should default missing type field to 'documentation'", async () => {
			const state: SessionState = {
				sessions: [{
					id: "s_legacy",
					title: "Legacy",
					status: "completed",
					durationMinutes: 25,
					createdAt: "2026-01-01T00:00:00.000Z",
					startedAt: null,
					pausedAt: null,
					elapsedBeforePauseMs: 0,
					completedAt: "2026-01-01T00:25:00.000Z",
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
				} as unknown as Session], // type intentionally missing
				activeSessionId: null,
			};

			const mock = createMockStorage(state);
			service.dispose();
			service = new SessionService({ storage: mock.storage, eventBus });
			await service.load();

			const session = service.getSessionById("s_legacy");
			expect(session?.type).toBe("documentation");
		});
	});

	// ── Decisions ─────────────────────────────────────────────

	describe("decisions", () => {
		it("records a decision and emits session.decision.recorded", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Dec Test", durationMinutes: 25 });
			const sessions = service.getSessions();
			const sessionId = sessions[0].id;

			const handler = vi.fn();
			eventBus.on("session.decision.recorded", handler);

			await eventBus.emit("session.decision.record", {
				sessionId,
				title: "Use EventBus",
				description: "For decoupled comms",
				context: "design review",
			});

			expect(handler).toHaveBeenCalledTimes(1);
			const payload = handler.mock.calls[0][0].payload;
			expect(payload.sessionId).toBe(sessionId);
			expect(payload.decision.title).toBe("Use EventBus");
			expect(payload.decision.description).toBe("For decoupled comms");
			expect(payload.decision.context).toBe("design review");
			expect(payload.decision.id).toMatch(/^dec_/);

			const session = service.getSessionById(sessionId);
			expect(session?.decisions.length).toBe(1);
		});

		it("removes a decision and emits session.decision.removed", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Dec Remove", durationMinutes: 25 });
			const sessions = service.getSessions();
			const sessionId = sessions[0].id;

			await eventBus.emit("session.decision.record", {
				sessionId,
				title: "Will be removed",
				description: "Temp",
			});

			const session = service.getSessionById(sessionId)!;
			const decisionId = session.decisions[0].id;

			const handler = vi.fn();
			eventBus.on("session.decision.removed", handler);

			await eventBus.emit("session.decision.remove", { sessionId, decisionId });

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler.mock.calls[0][0].payload.decisionId).toBe(decisionId);

			const updated = service.getSessionById(sessionId);
			expect(updated?.decisions.length).toBe(0);
		});

		it("ignores record with empty title", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Dec Empty", durationMinutes: 25 });
			const sessions = service.getSessions();
			const sessionId = sessions[0].id;

			await eventBus.emit("session.decision.record", {
				sessionId,
				title: "  ",
				description: "Ignored",
			});

			const session = service.getSessionById(sessionId);
			expect(session?.decisions.length).toBe(0);
		});

		it("enforces MAX_SESSION_DECISIONS cap", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Cap Test", durationMinutes: 25 });
			const sessions = service.getSessions();
			const sessionId = sessions[0].id;

			// Fill to cap
			for (let i = 0; i < 100; i++) {
				await eventBus.emit("session.decision.record", {
					sessionId,
					title: `Decision ${i}`,
					description: `Desc ${i}`,
				});
			}

			const session = service.getSessionById(sessionId)!;
			expect(session.decisions.length).toBe(100);

			// One more should be rejected
			await eventBus.emit("session.decision.record", {
				sessionId,
				title: "Overflow",
				description: "Should not be added",
			});

			expect(service.getSessionById(sessionId)?.decisions.length).toBe(100);
		});

		it("ignores remove for non-existent decision", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Dec Ghost", durationMinutes: 25 });
			const sessions = service.getSessions();
			const sessionId = sessions[0].id;

			const handler = vi.fn();
			eventBus.on("session.decision.removed", handler);

			await eventBus.emit("session.decision.remove", { sessionId, decisionId: "nonexistent" });

			expect(handler).not.toHaveBeenCalled();
		});

		it("adds backward-compat decisions array on load", async () => {
			const legacySession = makeSession({ id: "legacy-dec" });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			delete (legacySession as any).decisions;

			await storage.save({
				sessions: [legacySession],
				activeSessionId: null,
				savedTemplates: [],
			});

			service.dispose();
			service = new SessionService({ storage, eventBus });
			await service.load();

			const session = service.getSessionById("legacy-dec");
			expect(session?.decisions).toEqual([]);
		});
	});

	// ── Workspace State Restoration ─────────────────────────

	describe("workspace state", () => {
		it("adds backward-compat workspaceState on load", async () => {
			const legacySession = makeSession({ id: "legacy-ws" });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			delete (legacySession as any).workspaceState;

			await storage.save({
				sessions: [legacySession],
				activeSessionId: null,
				savedTemplates: [],
			});

			service.dispose();
			service = new SessionService({ storage, eventBus });
			await service.load();

			const session = service.getSessionById("legacy-ws");
			expect(session?.workspaceState).toBeNull();
		});

		it("persists workspace state when session.state.saved is emitted", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "WS Test", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;

			const state = { openFiles: ["a.md", "b.md"], activeFile: "a.md", scrollPositions: {} };
			await eventBus.emit("session.state.saved", { sessionId, state });

			const session = service.getSessionById(sessionId);
			expect(session?.workspaceState).toEqual(state);
		});

		it("emits session.state.save after pause", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Pause WS", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.state.save", handler);

			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.pause", { sessionId });
			// Flush microtasks — handler uses `void` so async work is pending
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId },
			}));
		});

		it("emits session.state.save after complete", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Complete WS", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.state.save", handler);

			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId });
			// session.state.save now fires from transitionToCompleted, not completeSession
			await service.skipClosure(sessionId);
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId },
			}));
		});

		it("emits session.state.restore on resume when workspaceState exists", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Resume WS", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.pause", { sessionId });
			await vi.advanceTimersByTimeAsync(0);

			// Simulate view saving workspace state
			const state = { openFiles: ["file.md"], activeFile: "file.md", scrollPositions: {} };
			await eventBus.emit("session.state.saved", { sessionId, state });
			await vi.advanceTimersByTimeAsync(0);

			const handler = vi.fn();
			eventBus.on("session.state.restore", handler);

			await eventBus.emit("session.resume", { sessionId });
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId, state },
			}));
		});

		it("does not emit session.state.restore on resume when no workspaceState", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "No WS", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.pause", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.state.restore", handler);

			await eventBus.emit("session.resume", { sessionId });

			expect(handler).not.toHaveBeenCalled();
		});

		it("ignores session.state.saved for non-existent session", async () => {
			const state = { openFiles: ["x.md"], activeFile: null, scrollPositions: {} };
			await eventBus.emit("session.state.saved", { sessionId: "nonexistent", state });
			// No error thrown — silently ignored
		});
	});

	// ── Output Artifacts ─────────────────────────────────────

	describe("output artifacts", () => {
		it("adds backward-compat outputArtifacts array on load", async () => {
			const legacySession = makeSession({ id: "legacy-out" });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			delete (legacySession as any).outputArtifacts;

			await storage.save({
				sessions: [legacySession],
				activeSessionId: null,
				savedTemplates: [],
			});

			service.dispose();
			service = new SessionService({ storage, eventBus });
			await service.load();

			const session = service.getSessionById("legacy-out");
			expect(session?.outputArtifacts).toEqual([]);
		});

		it("generates output artifact for completed session", async () => {
			const mockFs = {
				createFile: vi.fn().mockResolvedValue(undefined),
				readFile: vi.fn().mockResolvedValue("# Notes"),
				updateFile: vi.fn().mockResolvedValue(undefined),
				fileExists: vi.fn(),
				deleteFile: vi.fn(),
				moveFile: vi.fn(),
				renameFile: vi.fn(),
				getFrontmatter: vi.fn(),
				updateFrontmatter: vi.fn(),
				setFrontmatter: vi.fn(),
			};

			service.dispose();
			service = new SessionService({ storage, eventBus, fileSystem: mockFs });

			await eventBus.emit("session.create", { type: "documentation", title: "Output Test", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);
			await vi.advanceTimersByTimeAsync(0);

			const template = BUILT_IN_OUTPUT_TEMPLATES[0]; // meeting-invite
			const handler = vi.fn();
			eventBus.on("session.output.generated", handler);

			await eventBus.emit("session.output.generate", { sessionId, template });
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).toHaveBeenCalledTimes(1);
			const payload = handler.mock.calls[0][0].payload;
			expect(payload.sessionId).toBe(sessionId);
			expect(payload.artifact.type).toBe("meeting-invite");
			expect(payload.artifact.path).toContain("Output Test - Meeting Invite");

			const session = service.getSessionById(sessionId);
			expect(session?.outputArtifacts).toHaveLength(1);
		});

		it("rejects output generation for active sessions", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Active Test", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });

			const handler = vi.fn();
			eventBus.on("session.output.generated", handler);

			const template = BUILT_IN_OUTPUT_TEMPLATES[0];
			await eventBus.emit("session.output.generate", { sessionId, template });
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).not.toHaveBeenCalled();
		});

		it("rejects output generation for paused sessions", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Paused Test", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.pause", { sessionId });
			await vi.advanceTimersByTimeAsync(0);

			const handler = vi.fn();
			eventBus.on("session.output.generated", handler);

			const template = BUILT_IN_OUTPUT_TEMPLATES[0];
			await eventBus.emit("session.output.generate", { sessionId, template });
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).not.toHaveBeenCalled();
		});

		it("rejects output generation for prepared sessions", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Prepared Test", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			// Session stays in "prepared" status — never started

			const handler = vi.fn();
			eventBus.on("session.output.generated", handler);

			const template = BUILT_IN_OUTPUT_TEMPLATES[0];
			await eventBus.emit("session.output.generate", { sessionId, template });
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).not.toHaveBeenCalled();
		});

		it("enforces MAX_OUTPUT_ARTIFACTS cap", async () => {
			await eventBus.emit("session.create", { type: "documentation", title: "Cap Test", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);
			await vi.advanceTimersByTimeAsync(0);

			// Pre-fill to max
			const session = service.getSessionById(sessionId)!;
			for (let i = 0; i < MAX_OUTPUT_ARTIFACTS; i++) {
				session.outputArtifacts.push({ type: "custom", path: `file-${i}.md`, generatedAt: new Date().toISOString() });
			}

			const handler = vi.fn();
			eventBus.on("session.output.generated", handler);

			const template = BUILT_IN_OUTPUT_TEMPLATES[0];
			await eventBus.emit("session.output.generate", { sessionId, template });
			await vi.advanceTimersByTimeAsync(0);

			expect(handler).not.toHaveBeenCalled();
			expect(service.getSessionById(sessionId)?.outputArtifacts).toHaveLength(MAX_OUTPUT_ARTIFACTS);
		});

		it("appends wikilink to notes file when it exists", async () => {
			const mockFs = {
				createFile: vi.fn().mockResolvedValue(undefined),
				readFile: vi.fn().mockResolvedValue("# Session Notes\nSome content"),
				updateFile: vi.fn().mockResolvedValue(undefined),
				fileExists: vi.fn(),
				deleteFile: vi.fn(),
				moveFile: vi.fn(),
				renameFile: vi.fn(),
				getFrontmatter: vi.fn(),
				updateFrontmatter: vi.fn(),
				setFrontmatter: vi.fn(),
			};

			service.dispose();
			service = new SessionService({ storage, eventBus, fileSystem: mockFs });

			await eventBus.emit("session.create", { type: "documentation", title: "Notes Link", durationMinutes: 25 });
			const sessionId = service.getSessions()[0].id;

			// Set up notes file
			await eventBus.emit("session.notesFile.set", { sessionId, path: "03 - Resources/Sessions/Notes Link.md" });
			await vi.advanceTimersByTimeAsync(0);

			await eventBus.emit("session.start", { sessionId });
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId });
			await service.skipClosure(sessionId);
			await vi.advanceTimersByTimeAsync(0);

			const template = BUILT_IN_OUTPUT_TEMPLATES[0];
			await eventBus.emit("session.output.generate", { sessionId, template });
			await vi.advanceTimersByTimeAsync(0);

			// File created
			expect(mockFs.createFile).toHaveBeenCalled();
			// Wikilink appended to notes
			expect(mockFs.updateFile).toHaveBeenCalledWith(
				"03 - Resources/Sessions/Notes Link.md",
				expect.stringContaining("## Output Artifacts"),
			);
		});
	});
});
