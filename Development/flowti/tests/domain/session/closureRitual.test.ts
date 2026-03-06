import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { ClosureResponse, ClosureTemplate, Session, SessionState } from "../../../src/domain/session/types";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import {
	DEFAULT_CLOSURE_TEMPLATE,
	resolveClosureTemplate,
} from "../../../src/domain/session/helpers";
import { SESSION_TYPE_CONFIGS } from "../../../src/domain/session/types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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
		notesFile: "03 - Resources/Sessions/Test Session (abc123).md",
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

function makeClosureResponse(overrides: Partial<ClosureResponse> = {}): ClosureResponse {
	return {
		outcomeAchieved: "yes",
		whatWorked: "Good focus",
		whatDidnt: "Too long",
		nextAction: "Write summary",
		answers: {
			"outcome": "yes",
			"what-worked": "Good focus",
			"what-didnt": "Too long",
			"next-action": "Write summary",
		},
		...overrides,
	};
}

// ─────────────────────────────────────────────────────────────
// Pure helper tests
// ─────────────────────────────────────────────────────────────

describe("DEFAULT_CLOSURE_TEMPLATE", () => {
	it("has 4 standard questions", () => {
		expect(DEFAULT_CLOSURE_TEMPLATE.questions).toHaveLength(4);
	});

	it("has outcome (select) and next-action (text) as required", () => {
		const required = DEFAULT_CLOSURE_TEMPLATE.questions.filter(q => q.required);
		expect(required).toHaveLength(2);
		expect(required.map(q => q.id)).toEqual(["outcome", "next-action"]);
	});

	it("outcome question has select type with 3 options", () => {
		const outcome = DEFAULT_CLOSURE_TEMPLATE.questions.find(q => q.id === "outcome")!;
		expect(outcome.type).toBe("select");
		expect(outcome.options).toEqual(["yes", "partial", "no"]);
	});

	it("requiredFields matches required question IDs", () => {
		expect(DEFAULT_CLOSURE_TEMPLATE.requiredFields).toEqual(["outcome", "next-action"]);
	});
});

describe("SESSION_TYPE_CONFIGS — train-of-thought closure template", () => {
	const trainConfig = SESSION_TYPE_CONFIGS["train-of-thought"];

	it("has a closureTemplate defined", () => {
		expect(trainConfig.closureTemplate).toBeDefined();
	});

	it("has 4 questions", () => {
		expect(trainConfig.closureTemplate!.questions).toHaveLength(4);
	});

	it("requires key-insight and outcome", () => {
		expect(trainConfig.closureTemplate!.requiredFields).toEqual(["key-insight", "outcome"]);
	});

	it("key-insight is text type", () => {
		const question = trainConfig.closureTemplate!.questions.find(q => q.id === "key-insight");
		expect(question).toBeDefined();
		expect(question!.type).toBe("text");
		expect(question!.required).toBe(true);
	});

	it("outcome is select type with 3 options", () => {
		const question = trainConfig.closureTemplate!.questions.find(q => q.id === "outcome");
		expect(question).toBeDefined();
		expect(question!.type).toBe("select");
		expect(question!.options).toHaveLength(3);
	});
});

describe("resolveClosureTemplate", () => {
	it("returns default template when no overrides", () => {
		const session = makeSession();
		expect(resolveClosureTemplate(session)).toBe(DEFAULT_CLOSURE_TEMPLATE);
	});

	it("returns global override when provided", () => {
		const session = makeSession();
		const global: ClosureTemplate = {
			questions: [{ id: "custom", question: "Custom?", type: "text", required: true }],
			requiredFields: ["custom"],
		};
		expect(resolveClosureTemplate(session, global)).toBe(global);
	});

	it("returns type override over global override", () => {
		const session = makeSession({ type: "event-storming" });
		const global: ClosureTemplate = {
			questions: [{ id: "global", question: "Global?", type: "text", required: false }],
			requiredFields: [],
		};
		const typeOverride: ClosureTemplate = {
			questions: [{ id: "type", question: "Type?", type: "text", required: true }],
			requiredFields: ["type"],
		};
		const result = resolveClosureTemplate(session, global, { "event-storming": typeOverride });
		expect(result).toBe(typeOverride);
	});

	it("falls back to global when no type-level override exists", () => {
		const session = makeSession({ type: "documentation" });
		const global: ClosureTemplate = {
			questions: [{ id: "global", question: "Global?", type: "text", required: false }],
			requiredFields: [],
		};
		const result = resolveClosureTemplate(session, global, { "event-storming": DEFAULT_CLOSURE_TEMPLATE });
		expect(result).toBe(global);
	});

	it("falls back to default when type-level map is empty", () => {
		const session = makeSession();
		expect(resolveClosureTemplate(session, undefined, {})).toBe(DEFAULT_CLOSURE_TEMPLATE);
	});

	it("resolves train-of-thought closure template from type map", () => {
		const session = makeSession({ type: "train-of-thought" });
		const trainTemplate: ClosureTemplate = {
			questions: [
				{ id: "key-insight", question: "What was the key insight?", type: "text", required: true },
				{ id: "outcome", question: "How productive?", type: "select", required: true, options: ["very", "somewhat", "not"] },
			],
			requiredFields: ["key-insight", "outcome"],
		};
		const result = resolveClosureTemplate(session, undefined, { "train-of-thought": trainTemplate });
		expect(result).toBe(trainTemplate);
		expect(result.questions).toHaveLength(2);
	});
});

// ─────────────────────────────────────────────────────────────
// Service-level closure ritual tests
// ─────────────────────────────────────────────────────────────

describe("SessionService — closure ritual", () => {
	let service: SessionService;
	let storage: ITypedStorage<SessionState>;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const mock = createMockStorage<SessionState>();
		storage = mock.storage;
		eventBus = new EventBus();
		fileSystem = createMockFileSystem({
			"03 - Resources/Sessions/Test Session (abc123).md": "# Test\n\n## Session Summary\n",
		});
		service = new SessionService({ storage, eventBus, fileSystem });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	async function seedRunningSession(): Promise<string> {
		await eventBus.emit("session.create", { type: "event-storming", title: "Test Session", durationMinutes: 25 });
		const session = service.getSessions()[0];
		session.notesFile = "03 - Resources/Sessions/Test Session (abc123).md";
		session.status = "running";
		session.startedAt = "2026-02-16T10:00:00.000Z";
		return session.id;
	}

	// ── completeSession stops at reviewing ──────────────────

	it("session.complete transitions to reviewing (not completed)", async () => {
		const sessionId = await seedRunningSession();

		await eventBus.emit("session.complete", { sessionId });

		const session = service.getSessions()[0];
		expect(session.status).toBe("reviewing");
		expect(session.completedAt).toBeNull();
	});

	it("completeSession records reviewing in timeline", async () => {
		const sessionId = await seedRunningSession();

		await eventBus.emit("session.complete", { sessionId });

		const session = service.getSessions()[0];
		const reviewEntry = session.timeline.find(e => e.action === "reviewing");
		expect(reviewEntry).toBeDefined();
		// No "completed" entry yet
		expect(session.timeline.find(e => e.action === "completed")).toBeUndefined();
	});

	it("completeSession emits session.closure.started", async () => {
		const sessionId = await seedRunningSession();
		const spy = vi.fn();
		eventBus.on("session.closure.started", spy);

		await eventBus.emit("session.complete", { sessionId });

		expect(spy).toHaveBeenCalledWith(expect.objectContaining({
			payload: { sessionId },
		}));
	});

	it("completeSession stops the timer", async () => {
		const sessionId = await seedRunningSession();

		await eventBus.emit("session.complete", { sessionId });

		const session = service.getSessions()[0];
		expect(session.startedAt).toBeNull();
	});

	it("handleComplete ignores sessions already in reviewing", async () => {
		const sessionId = await seedRunningSession();
		// First complete → reviewing
		await eventBus.emit("session.complete", { sessionId });
		expect(service.getSessions()[0].status).toBe("reviewing");

		// Second complete should be a no-op
		const spy = vi.fn();
		eventBus.on("session.closure.started", spy);
		await eventBus.emit("session.complete", { sessionId });

		// Should not have fired again
		expect(spy).not.toHaveBeenCalled();
	});

	// ── completeClosure ────────────────────────────────────

	it("completeClosure saves response and transitions to completed", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const response = makeClosureResponse();
		await service.completeClosure(sessionId, response);

		const session = service.getSessions()[0];
		expect(session.status).toBe("completed");
		expect(session.closureResponse).toEqual(response);
		expect(session.completedAt).not.toBeNull();
	});

	it("completeClosure records completed in timeline", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		await service.completeClosure(sessionId, makeClosureResponse());

		const session = service.getSessions()[0];
		const completedEntry = session.timeline.find(e => e.action === "completed");
		expect(completedEntry).toBeDefined();
	});

	it("completeClosure emits session.closure.completed", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const spy = vi.fn();
		eventBus.on("session.closure.completed", spy);
		const response = makeClosureResponse();
		await service.completeClosure(sessionId, response);

		expect(spy).toHaveBeenCalledWith(expect.objectContaining({
			payload: { sessionId, response },
		}));
	});

	it("completeClosure emits session.completed", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const spy = vi.fn();
		eventBus.on("session.completed", spy);
		await service.completeClosure(sessionId, makeClosureResponse());

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("completeClosure is a no-op for non-reviewing sessions", async () => {
		const sessionId = await seedRunningSession();

		const spy = vi.fn();
		eventBus.on("session.closure.completed", spy);
		await service.completeClosure(sessionId, makeClosureResponse());

		expect(spy).not.toHaveBeenCalled();
		expect(service.getSessions()[0].status).toBe("running");
	});

	// ── skipClosure ─────────────────────────────────────────

	it("skipClosure transitions to completed without closureResponse", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		await service.skipClosure(sessionId);

		const session = service.getSessions()[0];
		expect(session.status).toBe("completed");
		expect(session.closureResponse).toBeNull();
		expect(session.completedAt).not.toBeNull();
	});

	it("skipClosure emits session.completed", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const spy = vi.fn();
		eventBus.on("session.completed", spy);
		await service.skipClosure(sessionId);

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("skipClosure does not emit session.closure.completed", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const spy = vi.fn();
		eventBus.on("session.closure.completed", spy);
		await service.skipClosure(sessionId);

		expect(spy).not.toHaveBeenCalled();
	});

	it("skipClosure is a no-op for non-reviewing sessions", async () => {
		const sessionId = await seedRunningSession();

		await service.skipClosure(sessionId);

		expect(service.getSessions()[0].status).toBe("running");
	});

	// ── finishReview gate ───────────────────────────────────

	it("finishReview is blocked when closureResponse is null", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const session = service.getSessions()[0];
		expect(session.status).toBe("reviewing");
		expect(session.closureResponse).toBeNull();

		await service.finishReview(session);

		// Still reviewing — gate blocked it
		expect(session.status).toBe("reviewing");
	});

	it("finishReview passes when closureResponse is set", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.complete", { sessionId });

		const session = service.getSessions()[0];
		session.closureResponse = makeClosureResponse();

		await service.finishReview(session);

		expect(session.status).toBe("completed");
	});

	// ── Timer-triggered completion ──────────────────────────

	it("timer expiry transitions to reviewing (not completed)", async () => {
		await eventBus.emit("session.create", { type: "event-storming", title: "Timer Test", durationMinutes: 1 });
		const sessionId = service.getSessions()[0].id;
		await eventBus.emit("session.start", { sessionId });

		// Advance past the 1-minute timer
		await vi.advanceTimersByTimeAsync(61_000);

		const session = service.getSessions()[0];
		expect(session.status).toBe("reviewing");
	});

	// ── Paused session completion ────────────────────────────

	it("completing a paused session transitions to reviewing", async () => {
		const sessionId = await seedRunningSession();
		await eventBus.emit("session.pause", { sessionId });
		expect(service.getSessions()[0].status).toBe("paused");

		await eventBus.emit("session.complete", { sessionId });

		expect(service.getSessions()[0].status).toBe("reviewing");
	});
});
