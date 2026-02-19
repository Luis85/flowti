/**
 * Session v2 Lifecycle, Intent & Energy Tests (ADR-031, PBI-SW-010)
 *
 * Tests the v2 domain extensions:
 * - State machine: prepared → running → paused → reviewing → completed → archived
 * - Intent CRUD: set/update with state guards
 * - Energy tracking: change with state guards
 * - Backward compat: load() migrates "active" → "running", initializes v2 fields
 * - Event assertions: intent.updated, energy.changed, review.started
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { Session, SessionState, SessionType, SessionIntent, EnergyLevel } from "../../../src/domain/session/types";
import { createMockStorage } from "../../mocks/storage";

async function flush(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("Session v2 Lifecycle & Intent (ADR-031)", () => {
	let eventBus: IEventBus;
	let service: SessionService;
	let storage: ReturnType<typeof createMockStorage<SessionState>>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-19T10:00:00.000Z"));
		eventBus = new EventBus();
		storage = createMockStorage<SessionState>();
		service = new SessionService({ storage: storage.storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	// ── State Machine: prepared → running ────────────────────

	describe("state machine transitions", () => {
		it("start transitions session from prepared to running", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "v2 Test",
				durationMinutes: 25,
			});
			await flush();

			const session = service.getSessions()[0];
			expect(session.status).toBe("prepared");

			await eventBus.emit("session.start", { sessionId: session.id });
			await flush();

			const started = service.getActiveSession();
			expect(started).not.toBeNull();
			expect(started!.status).toBe("running");
		});

		it("pause transitions session from running to paused", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Pause Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(5000);

			await eventBus.emit("session.pause", { sessionId: id });
			await flush();

			const session = service.getActiveSession();
			expect(session).not.toBeNull();
			expect(session!.status).toBe("paused");
		});

		it("resume transitions session from paused to running", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Resume Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(3000);
			await eventBus.emit("session.pause", { sessionId: id });
			await flush();

			await eventBus.emit("session.resume", { sessionId: id });
			await flush();

			expect(service.getActiveSession()!.status).toBe("running");
		});

		it("complete transitions to reviewing, skipClosure reaches completed", async () => {
			await service.load();

			const completedHandler = vi.fn();
			eventBus.on("session.completed", completedHandler);

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Complete Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(5000);

			await eventBus.emit("session.complete", { sessionId: id });
			await flush();

			// After complete, session is in reviewing (closure ritual gate)
			expect(service.getSessionById(id)!.status).toBe("reviewing");

			await service.skipClosure(id);
			await flush();

			// After skipClosure, session reaches completed
			const session = service.getSessionById(id);
			expect(session!.status).toBe("completed");
			expect(completedHandler).toHaveBeenCalled();

			// Timeline should contain both reviewing and completed entries
			const actions = session!.timeline.map((t) => t.action);
			expect(actions).toContain("reviewing");
			expect(actions).toContain("completed");
		});

		it("archive transitions from completed to archived", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Archive Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();
			await service.skipClosure(id);
			await flush();

			await eventBus.emit("session.archive", { sessionId: id });
			await flush();

			expect(service.getSessionById(id)!.status).toBe("archived");
		});

		it("timer expiry transitions to reviewing, skipClosure reaches completed", async () => {
			await service.load();

			const closureHandler = vi.fn();
			eventBus.on("session.closure.started", closureHandler);

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Timer Expiry",
				durationMinutes: 1, // 1 minute = 60,000ms
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();

			// Advance past the 1-minute timer
			vi.advanceTimersByTime(61000);
			await flush();

			expect(closureHandler).toHaveBeenCalled();
			expect(service.getSessionById(id)!.status).toBe("reviewing");

			await service.skipClosure(id);
			await flush();

			const session = service.getSessionById(id)!;
			expect(session.status).toBe("completed");
			// Timeline records both reviewing and completed
			const actions = session.timeline.map((t) => t.action);
			expect(actions).toContain("reviewing");
			expect(actions).toContain("completed");
		});
	});

	// ── handleStateTransition ────────────────────────────────

	describe("handleStateTransition", () => {
		it("validates and delegates prepared → running", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Transition Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await service.handleStateTransition(id, "running");
			await flush();

			expect(service.getActiveSession()!.status).toBe("running");
		});

		it("rejects invalid transition prepared → paused", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Invalid Transition",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await service.handleStateTransition(id, "paused");
			await flush();

			// Status should remain prepared
			expect(service.getSessions()[0].status).toBe("prepared");
		});

		it("rejects invalid transition running → completed (must go through reviewing)", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Skip Review",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();

			await service.handleStateTransition(id, "completed");
			await flush();

			// Status should remain running (completed is not a valid target from running)
			expect(service.getActiveSession()!.status).toBe("running");
		});
	});

	// ── Intent ──────────────────────────────────────────────

	describe("intent handlers", () => {
		it("sets intent on a prepared session", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.intent.updated", handler);

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Intent Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			const intent: SessionIntent = {
				primaryOutcome: "Document the v2 architecture",
				whyItMatters: "Foundation for all v2 work",
				mode: "deep-work",
			};
			await eventBus.emit("session.intent.set", { sessionId: id, intent });
			await flush();

			expect(handler).toHaveBeenCalledOnce();
			const session = service.getSessionById(id);
			expect(session!.intent).toEqual(intent);
		});

		it("updates intent on a paused session", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Intent Update",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			// Set initial intent
			const initial: SessionIntent = { primaryOutcome: "First outcome", mode: "planning" };
			await eventBus.emit("session.intent.set", { sessionId: id, intent: initial });
			await flush();

			// Start, pause
			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(3000);
			await eventBus.emit("session.pause", { sessionId: id });
			await flush();

			// Update intent while paused
			const updated: SessionIntent = { primaryOutcome: "Revised outcome", mode: "deep-work" };
			await eventBus.emit("session.intent.set", { sessionId: id, intent: updated });
			await flush();

			expect(service.getSessionById(id)!.intent).toEqual(updated);
		});

		it("rejects intent change on a running session (locked)", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Intent Locked",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			const initial: SessionIntent = { primaryOutcome: "Original", mode: "deep-work" };
			await eventBus.emit("session.intent.set", { sessionId: id, intent: initial });
			await flush();

			await eventBus.emit("session.start", { sessionId: id });
			await flush();

			// Try to change intent while running — should be rejected
			const attempt: SessionIntent = { primaryOutcome: "Changed", mode: "planning" };
			await eventBus.emit("session.intent.set", { sessionId: id, intent: attempt });
			await flush();

			// Intent should remain unchanged
			expect(service.getSessionById(id)!.intent!.primaryOutcome).toBe("Original");
		});

		it("emits session.mode.set when mode changes", async () => {
			await service.load();

			const modeHandler = vi.fn();
			eventBus.on("session.mode.set", modeHandler);

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Mode Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.intent.set", {
				sessionId: id,
				intent: { primaryOutcome: "Test", mode: "workshop" },
			});
			await flush();

			expect(modeHandler).toHaveBeenCalledOnce();
			expect(modeHandler.mock.calls[0][0].payload.mode).toBe("workshop");
		});
	});

	// ── Energy ──────────────────────────────────────────────

	describe("energy handlers", () => {
		it("changes energy on a running session", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.energy.changed", handler);

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Energy Test",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();

			await service.handleEnergyChange(id, 4 as EnergyLevel);
			await flush();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.before).toBeNull();
			expect(handler.mock.calls[0][0].payload.after).toBe(4);

			expect(service.getSessionById(id)!.energy).toBe(4);
		});

		it("changes energy on a paused session", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Energy Paused",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(3000);
			await eventBus.emit("session.pause", { sessionId: id });
			await flush();

			await service.handleEnergyChange(id, 2 as EnergyLevel);
			await flush();

			expect(service.getSessionById(id)!.energy).toBe(2);
		});

		it("rejects energy change on a prepared session", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Energy Prepared",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await service.handleEnergyChange(id, 3 as EnergyLevel);
			await flush();

			expect(service.getSessionById(id)!.energy).toBeNull();
		});

		it("tracks energy changes with before/after", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("session.energy.changed", handler);

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "Energy History",
				durationMinutes: 25,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();

			await service.handleEnergyChange(id, 5 as EnergyLevel);
			await flush();
			await service.handleEnergyChange(id, 3 as EnergyLevel);
			await flush();

			expect(handler).toHaveBeenCalledTimes(2);
			expect(handler.mock.calls[1][0].payload.before).toBe(5);
			expect(handler.mock.calls[1][0].payload.after).toBe(3);
		});
	});

	// ── Backward Compatibility ──────────────────────────────

	describe("backward compatibility", () => {
		it("migrates status: active → running on load()", async () => {
			// Simulate v1 persisted state with status: "active"
			// startedAt must be recent enough to not be expired (within 25 min of fake "now")
			const legacyStorage = createMockStorage<SessionState>({
				sessions: [{
					id: "legacy-1",
					type: "documentation",
					title: "Legacy Active",
					status: "active",
					durationMinutes: 25,
					createdAt: "2026-02-19T09:50:00.000Z",
					startedAt: "2026-02-19T09:55:00.000Z",
					pausedAt: null,
					elapsedBeforePauseMs: 0,
					completedAt: null,
					artifacts: [],
					notes: "",
					focusFile: null,
					timeline: [{ action: "started", timestamp: "2026-02-19T09:55:00.000Z" }],
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
				}] as unknown as Session[],
				activeSessionId: "legacy-1",
				savedTemplates: [],
			});
			service.dispose();
			const legacyService = new SessionService({ storage: legacyStorage.storage, eventBus });

			await legacyService.load();

			const session = legacyService.getSessionById("legacy-1");
			expect(session).not.toBeNull();
			expect(session!.status).toBe("running");
			legacyService.dispose();
		});

		it("initializes v2 fields to defaults on load() for legacy sessions", async () => {
			const legacyStorage = createMockStorage<SessionState>({
				sessions: [{
					id: "legacy-2",
					type: "documentation",
					title: "Legacy No v2",
					status: "completed",
					durationMinutes: 25,
					createdAt: "2026-02-18T10:00:00.000Z",
					startedAt: null,
					pausedAt: null,
					elapsedBeforePauseMs: 0,
					completedAt: "2026-02-18T10:30:00.000Z",
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
				}] as unknown as Session[],
				activeSessionId: null,
				savedTemplates: [],
			});
			service.dispose();
			const legacyService = new SessionService({ storage: legacyStorage.storage, eventBus });

			await legacyService.load();

			const session = legacyService.getSessionById("legacy-2");
			expect(session!.intent).toBeNull();
			expect(session!.energy).toBeNull();
			expect(session!.executionTasks).toEqual([]);
			expect(session!.reflections).toEqual([]);
			expect(session!.closureResponse).toBeNull();
			legacyService.dispose();
		});

		it("newly created sessions have v2 fields initialized", async () => {
			await service.load();

			await eventBus.emit("session.create", {
				type: "documentation" as SessionType,
				title: "New Session",
				durationMinutes: 25,
			});
			await flush();

			const session = service.getSessions()[0];
			expect(session.intent).toBeNull();
			expect(session.energy).toBeNull();
			expect(session.executionTasks).toEqual([]);
			expect(session.reflections).toEqual([]);
			expect(session.closureResponse).toBeNull();
		});
	});

	// ── Creation path threading ──────────────────────────────

	describe("intent/energy threading through creation paths", () => {
		it("rerunSession preserves session structure with v2 fields", async () => {
			await service.load();

			// Create, start, complete a session
			await eventBus.emit("session.create", {
				type: "event-storming" as SessionType,
				title: "Original Session",
				durationMinutes: 50,
			});
			await flush();
			const id = service.getSessions()[0].id;

			await eventBus.emit("session.start", { sessionId: id });
			await flush();
			vi.advanceTimersByTime(5000);
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();
			await service.skipClosure(id);
			await flush();

			// Rerun
			const rerun = await service.rerunSession(id);
			expect(rerun).not.toBeNull();
			expect(rerun!.title).toBe("Original Session (2)");
			expect(rerun!.intent).toBeNull();
			expect(rerun!.energy).toBeNull();
			expect(rerun!.executionTasks).toEqual([]);
			expect(rerun!.reflections).toEqual([]);
			expect(rerun!.closureResponse).toBeNull();
		});

		it("createFromTemplate creates session with v2 fields", async () => {
			await service.load();

			// Save a template
			await service.saveTemplate({
				name: "Sprint Review",
				type: "event-storming",
				durationMinutes: 50,
			});

			const templates = service.getSavedTemplates();
			const tmplId = templates[0].id;

			await service.createFromTemplate(tmplId);
			await flush();

			const session = service.getSessions()[0];
			expect(session.title).toBe("Sprint Review");
			expect(session.intent).toBeNull();
			expect(session.energy).toBeNull();
			expect(session.executionTasks).toEqual([]);
		});
	});
});
