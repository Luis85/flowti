/**
 * Command Palette Integration Tests
 *
 * Tests the behavior logic behind the `flowti:create-session` and
 * `flowti:resume-session` commands. These commands are registered via
 * `addCommand()` in main.ts — we test the underlying service behavior here.
 *
 * Covers: Three Amigos OBS-6 (FR-08e command palette integration tests).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { Session, SessionState, SessionType } from "../../../src/domain/session/types";
import { createMockStorage } from "../../mocks/storage";

async function flush(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("command palette integration", () => {
	let eventBus: IEventBus;
	let service: SessionService;
	let storage: ReturnType<typeof createMockStorage<SessionState>>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-18T10:00:00.000Z"));
		eventBus = new EventBus();
		storage = createMockStorage<SessionState>();
		service = new SessionService({ storage: storage.storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	// ── flowti:create-session behavior ──────────────────────

	describe("create-session command behavior", () => {
		it("creates a session via session.create event (command palette path)", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.created", handler);

			// Simulates what the command callback does
			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "From Command Palette",
				durationMinutes: 25,
			});
			await flush();

			expect(handler).toHaveBeenCalledOnce();
			const session = handler.mock.calls[0][0].payload.session;
			expect(session.title).toBe("From Command Palette");
			expect(session.type).toBe("documentation");
			expect(session.durationMinutes).toBe(25);
			expect(session.status).toBe("prepared");
		});

		it("creates a session with goals from command palette", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.created", handler);

			await eventBus.emit("session.create", {
				type: "event-storming" as SessionType,
				title: "Storming Session",
				durationMinutes: 50,
				goals: ["Map domain events", "Identify aggregates"],
			});
			await flush();

			const session: Session = handler.mock.calls[0][0].payload.session;
			expect(session.goals).toHaveLength(2);
			expect(session.goals[0].text).toBe("Map domain events");
			expect(session.goals[1].text).toBe("Identify aggregates");
		});
	});

	// ── flowti:resume-session behavior ─────────────────────

	describe("resume-session command behavior", () => {
		it("resumes a paused session via session.resume event", async () => {
			await service.load();

			// Create, start, and pause a session
			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Paused Work",
				durationMinutes: 25,
			});
			await flush();
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			await flush();
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.pause", { sessionId });
			await flush();

			// Verify session is paused
			const paused = service.getActiveSession();
			expect(paused).not.toBeNull();
			expect(paused!.status).toBe("paused");

			// Simulate resume command behavior
			const handler = vi.fn();
			eventBus.on("session.resumed", handler);

			await eventBus.emit("session.resume", { sessionId: paused!.id });
			await flush();

			expect(handler).toHaveBeenCalledOnce();
			expect(service.getActiveSession()?.status).toBe("running");
		});

		it("returns null from getActiveSession when no paused session exists", async () => {
			await service.load();

			// No sessions at all — simulates "No paused session to resume" path
			const session = service.getActiveSession();
			expect(session).toBeNull();
		});

		it("getActiveSession returns session but status is not paused when session is active", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Active Work",
				durationMinutes: 25,
			});
			await flush();
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			await flush();

			// Session is active, not paused — resume command would show Notice
			const session = service.getActiveSession();
			expect(session).not.toBeNull();
			expect(session!.status).toBe("running");
			// The command checks: if (session && session.status === "paused")
			// This would fail — user sees "No paused session to resume"
			expect(session!.status !== "paused").toBe(true);
		});

		it("getActiveSession returns null after session is completed", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Done Work",
				durationMinutes: 25,
			});
			await flush();
			const sessionId = service.getSessions()[0].id;
			await eventBus.emit("session.start", { sessionId });
			await flush();
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId });
			await flush();

			// No active session → resume command shows Notice
			expect(service.getActiveSession()).toBeNull();
		});
	});
});
