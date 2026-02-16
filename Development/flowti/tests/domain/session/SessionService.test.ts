import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { Session, SessionState } from "../../../src/domain/session/types";
import { MAX_SESSIONS } from "../../../src/domain/session/types";
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

			const completeHandler = vi.fn();
			eventBus.on("session.completed", completeHandler);
			await service.load();

			expect(completeHandler).toHaveBeenCalled();
			expect(service.getActiveSession()).toBeNull();
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
			expect(session.status).toBe("active");
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
			expect(session.status).toBe("active");
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
});
