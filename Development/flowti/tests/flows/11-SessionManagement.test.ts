/**
 * Flow 11: Create and Manage Sessions
 *
 * Tests the full session lifecycle end-to-end:
 * Create session with type → start → track activity → record decisions →
 * pause/resume → complete → save template → create from template → archive → delete.
 *
 * Covers: PBI-SW-003 (Session Types), PBI-SW-004 (Decision Log),
 *         PBI-SW-005 (Session Summary), TD-94 (missing flow test).
 *
 * Event sequence (happy path):
 *   session.create → session.created → session.start → session.started →
 *   session.activity.tracked → session.decision.record → session.decision.recorded →
 *   session.pause → session.paused → session.resume → session.resumed →
 *   session.complete → session.completed → session.archive → session.archived →
 *   session.delete → session.deleted
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SessionService } from "../../src/domain/session/SessionService";
import type { SessionState } from "../../src/domain/session/types";
import { SESSION_TYPE_CONFIGS } from "../../src/domain/session/types";
import { resolveTypeConfig, generateSessionSummaryBody } from "../../src/domain/session/helpers";
import { createMockStorage, collectEvents } from "./testHelpers";

describe("Flow 11: Session Management", () => {
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

	// ── Step 1: Session Type Configs ─────────────────────────

	it("resolves built-in session type configs", () => {
		const config = resolveTypeConfig("domain-design");
		expect(config.label).toBe("Domain Design");
		expect(config.defaultDuration).toBe(50);
		expect(config.guidingQuestions.length).toBeGreaterThan(0);
	});

	it("resolves custom type config when injected", () => {
		const custom = {
			"my-type": {
				type: "my-type" as never,
				label: "My Type",
				icon: "star",
				guidingQuestions: ["Q1?"],
				defaultDuration: 30,
				defaultGoals: ["G1"],
			},
		};
		const config = resolveTypeConfig("my-type" as never, custom);
		expect(config.label).toBe("My Type");
		expect(config.defaultDuration).toBe(30);
	});

	// ── Step 2: Full Session Lifecycle ───────────────────────

	it("executes the full session lifecycle: create → start → decide → pause → resume → complete → template → archive → delete", async () => {
		const events = collectEvents(eventBus, "*");

		// 2a. Create session with Domain Design type
		await eventBus.emit("session.create", {
			type: "domain-design",
			title: "Design Bounded Contexts",
			durationMinutes: 50,
			goals: ["Map aggregates", "Identify events"],
		});

		let sessions = service.getSessions();
		expect(sessions.length).toBe(1);
		const sessionId = sessions[0].id;

		let session = service.getSessionById(sessionId)!;
		expect(session.type).toBe("domain-design");
		expect(session.title).toBe("Design Bounded Contexts");
		expect(session.status).toBe("prepared");
		expect(session.durationMinutes).toBe(50);
		expect(session.goals.length).toBe(2);
		expect(session.decisions).toEqual([]);
		expect(events).toContain("session.created");

		// 2b. Verify type config is accessible
		const typeConfig = SESSION_TYPE_CONFIGS["domain-design"];
		expect(typeConfig.guidingQuestions.length).toBeGreaterThan(0);

		// 2c. Start session
		await eventBus.emit("session.start", { sessionId });
		session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("active");
		expect(session.startedAt).not.toBeNull();
		expect(events).toContain("session.started");

		// 2d. Record decisions during active session
		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Use EventBus for domain events",
			description: "Decoupled communication between bounded contexts",
			context: "architecture review",
		});

		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Separate read and write models",
			description: "CQRS pattern for the order domain",
		});

		session = service.getSessionById(sessionId)!;
		expect(session.decisions.length).toBe(2);
		expect(session.decisions[0].title).toBe("Use EventBus for domain events");
		expect(session.decisions[0].context).toBe("architecture review");
		expect(session.decisions[1].title).toBe("Separate read and write models");
		expect(events).toContain("session.decision.recorded");

		// 2e. Toggle a goal
		await eventBus.emit("session.goal.toggle", {
			sessionId,
			goalId: session.goals[0].id,
		});
		session = service.getSessionById(sessionId)!;
		expect(session.goals[0].completed).toBe(true);

		// 2f. Pause session
		vi.setSystemTime(new Date("2026-02-18T10:15:00.000Z"));
		await eventBus.emit("session.pause", { sessionId });
		session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("paused");
		expect(events).toContain("session.paused");

		// Verify decisions survive pause
		expect(session.decisions.length).toBe(2);

		// 2g. Resume session
		vi.setSystemTime(new Date("2026-02-18T10:18:00.000Z"));
		await eventBus.emit("session.resume", { sessionId });
		session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("active");
		expect(events).toContain("session.resumed");

		// Verify decisions survive resume
		expect(session.decisions.length).toBe(2);

		// 2h. Complete session
		vi.setSystemTime(new Date("2026-02-18T10:50:00.000Z"));
		await eventBus.emit("session.complete", { sessionId });
		session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("completed");
		expect(session.completedAt).not.toBeNull();
		expect(events).toContain("session.completed");

		// 2i. Verify summary includes decisions
		const summary = generateSessionSummaryBody(session);
		expect(summary).toContain("### Decisions");
		expect(summary).toContain("Use EventBus for domain events");
		expect(summary).toContain("Decoupled communication between bounded contexts");
		expect(summary).toContain("*(architecture review)*");
		expect(summary).toContain("Separate read and write models");

		// 2j. Save template from completed session
		await service.saveTemplateFromSession(sessionId, "Domain Design Template");
		const templates = service.getSavedTemplates();
		expect(templates.length).toBe(1);
		expect(templates[0].name).toBe("Domain Design Template");
		expect(templates[0].type).toBe("domain-design");
		expect(templates[0].durationMinutes).toBe(50);
		expect(templates[0].decisions?.length).toBe(2);
		expect(templates[0].decisions?.[0]).toBe("Use EventBus for domain events");

		// 2k. Create new session from template
		await service.createFromTemplate(templates[0].id);
		sessions = service.getSessions();
		const templateSession = sessions.find((s) => s.id !== sessionId)!;
		expect(templateSession.type).toBe("domain-design");
		expect(templateSession.durationMinutes).toBe(50);
		// Template decisions are seeded as decision objects
		expect(templateSession.decisions.length).toBe(2);
		expect(templateSession.decisions[0].title).toBe("Use EventBus for domain events");

		// 2l. Archive the completed session
		await eventBus.emit("session.archive", { sessionId });
		session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("archived");
		expect(events).toContain("session.archived");

		// Decisions preserved in archived session
		expect(session.decisions.length).toBe(2);

		// 2m. Delete the session
		await eventBus.emit("session.delete", { sessionId });
		expect(service.getSessionById(sessionId)).toBeNull();
		expect(events).toContain("session.deleted");
	});

	// ── Step 3: Decision Edge Cases ─────────────────────────

	it("ignores decisions on non-existent session", async () => {
		const handler = vi.fn();
		eventBus.on("session.decision.recorded", handler);

		await eventBus.emit("session.decision.record", {
			sessionId: "nonexistent",
			title: "Ghost",
			description: "Should be ignored",
		});

		expect(handler).not.toHaveBeenCalled();
	});

	it("enforces MAX_SESSION_DECISIONS cap in lifecycle", async () => {
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Cap Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;

		for (let i = 0; i < 100; i++) {
			await eventBus.emit("session.decision.record", {
				sessionId,
				title: `Decision ${i}`,
				description: `Desc ${i}`,
			});
		}

		const session = service.getSessionById(sessionId)!;
		expect(session.decisions.length).toBe(100);

		// 101st should be rejected
		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Overflow",
			description: "Rejected",
		});
		expect(service.getSessionById(sessionId)!.decisions.length).toBe(100);
	});

	it("removes a decision during an active session", async () => {
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Remove Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "To Remove",
			description: "Temporary",
		});

		const decisionId = service.getSessionById(sessionId)!.decisions[0].id;

		await eventBus.emit("session.decision.remove", { sessionId, decisionId });

		expect(service.getSessionById(sessionId)!.decisions.length).toBe(0);
	});

	// ── Step 4: Backward Compatibility ──────────────────────

	it("loads legacy sessions without decisions field", async () => {
		await storage.storage.save({
			sessions: [{
				id: "legacy-1",
				type: "documentation",
				title: "Legacy Session",
				status: "completed",
				durationMinutes: 25,
				createdAt: "2026-02-01T10:00:00.000Z",
				startedAt: "2026-02-01T10:00:00.000Z",
				pausedAt: null,
				elapsedBeforePauseMs: 0,
				completedAt: "2026-02-01T10:25:00.000Z",
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
				// deliberately missing `decisions` field
			} as never],
			activeSessionId: null,
			savedTemplates: [],
		});

		service.dispose();
		service = new SessionService({ storage: storage.storage, eventBus });
		await service.load();

		const session = service.getSessionById("legacy-1");
		expect(session).toBeDefined();
		expect(session!.decisions).toEqual([]);
	});

	// ── Step 5: Session Type Persistence ─────────────────────

	it("creates sessions with all 8 built-in types", async () => {
		const types = ["documentation", "vault-hygiene", "event-storming", "service-design",
			"domain-design", "requirements-refinement", "backlog-structuring", "knowledge-cleanup"] as const;

		for (const type of types) {
			await eventBus.emit("session.create", {
				type,
				title: `${type} session`,
				durationMinutes: SESSION_TYPE_CONFIGS[type].defaultDuration,
			});
		}

		const sessions = service.getSessions();
		expect(sessions.length).toBe(8);

		for (const type of types) {
			const s = sessions.find((s) => s.type === type);
			expect(s).toBeDefined();
			expect(s!.durationMinutes).toBe(SESSION_TYPE_CONFIGS[type].defaultDuration);
		}
	});

	// ── Step 6: Rerun with Decisions ────────────────────────

	it("reruns a session carrying decisions forward", async () => {
		await eventBus.emit("session.create", {
			type: "event-storming",
			title: "Rerun Source",
			durationMinutes: 50,
		});
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Important Decision",
			description: "Carries forward",
		});

		await eventBus.emit("session.complete", { sessionId });

		await service.rerunSession(sessionId);

		const sessions = service.getSessions();
		const rerun = sessions.find((s) => s.id !== sessionId && s.status === "prepared");
		expect(rerun).toBeDefined();
		expect(rerun!.decisions.length).toBe(1);
		expect(rerun!.decisions[0].title).toBe("Important Decision");
	});

	// ── Step 7: Event Sequence Verification ──────────────────

	it("emits events in correct lifecycle order", async () => {
		const events: string[] = [];
		const lifecycle = [
			"session.created", "session.started", "session.decision.recorded",
			"session.paused", "session.resumed", "session.completed",
			"session.archived", "session.deleted",
		] as const;
		for (const type of lifecycle) {
			eventBus.on(type, () => { events.push(type); });
		}

		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Event Order Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.start", { sessionId });
		await eventBus.emit("session.decision.record", {
			sessionId, title: "D1", description: "Desc",
		});
		await eventBus.emit("session.pause", { sessionId });
		await eventBus.emit("session.resume", { sessionId });
		await eventBus.emit("session.complete", { sessionId });
		await eventBus.emit("session.archive", { sessionId });
		await eventBus.emit("session.delete", { sessionId });

		expect(events).toEqual(lifecycle);
	});
});
