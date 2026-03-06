/**
 * Tests for session field update handlers — intent, energy, duration,
 * links, context bindings, decisions, reflections, output artifacts,
 * and type configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState, SessionOutputTemplate } from "../../../../src/domain/session/types";
import { MAX_REFLECTIONS, MAX_CONTEXT_BINDINGS } from "../../../../src/domain/session/types";
import {
	handleSetIntent,
	handleEnergyChange,
	handleDurationUpdate,
	handleLinkAdd,
	handleLinkRemove,
	handleContextBind,
	handleContextUnbind,
	handleDecisionRecord,
	handleDecisionRemove,
	handleReflectionAdd,
	handleReflectionRemove,
	handleOutputGenerate,
	handleTypeCreate,
	handleTypeConfigure,
	handleNotesUpdate,
	handleNotesFileSet,
	handleCanvasFileSet,
	handleStateSaved,
	handleContextChangeType,
} from "../../../../src/domain/session/handlers/fieldHandlers";

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

// ── handleSetIntent ──────────────────────────────────────

describe("handleSetIntent", () => {
	it("sets intent on a prepared session", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);
		const intent = { primaryOutcome: "Ship feature X", mode: "deep-work" as const };

		await handleSetIntent(ctx, "session-1", intent);

		expect(session.intent).toEqual(intent);
		expect(ctx.emitted.some(([e]) => e === "session.intent.updated")).toBe(true);
		expect(ctx.emitted.some(([e]) => e === "session.mode.set")).toBe(true);
	});

	it("ignores running sessions", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleSetIntent(ctx, "session-1", { primaryOutcome: "X", mode: "planning" });

		expect(session.intent).toBeNull();
	});
});

// ── handleEnergyChange ───────────────────────────────────

describe("handleEnergyChange", () => {
	it("sets energy on a running session and triggers overload check", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleEnergyChange(ctx, "session-1", 3);

		expect(session.energy).toBe(3);
		expect(ctx.checkCognitiveOverload).toHaveBeenCalledWith("session-1");
		expect(ctx.emitted.some(([e]) => e === "session.energy.changed")).toBe(true);
	});

	it("ignores prepared sessions", async () => {
		const session = makeSession({ status: "prepared" });
		const ctx = createMockContext([session]);

		await handleEnergyChange(ctx, "session-1", 4);

		expect(session.energy).toBeNull();
	});
});

// ── handleDurationUpdate ─────────────────────────────────

describe("handleDurationUpdate", () => {
	it("updates duration on a prepared session", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleDurationUpdate(ctx, "session-1", 50);

		expect(session.durationMinutes).toBe(50);
		expect(ctx.emitted.some(([e]) => e === "session.duration.updated")).toBe(true);
	});

	it("rejects duration less than 1 minute", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleDurationUpdate(ctx, "session-1", 0);

		expect(session.durationMinutes).toBe(25);
		expect(ctx.emitted).toHaveLength(0);
	});

	it("ignores non-prepared sessions", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleDurationUpdate(ctx, "session-1", 50);

		expect(session.durationMinutes).toBe(25);
	});
});

// ── handleLinkAdd ────────────────────────────────────────

describe("handleLinkAdd", () => {
	it("adds a link to a session", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleLinkAdd(ctx, "session-1", "docs/readme.md");

		expect(session.links).toHaveLength(1);
		expect(session.links[0].path).toBe("docs/readme.md");
		expect(ctx.emitted.some(([e]) => e === "session.link.added")).toBe(true);
	});

	it("rejects duplicate link path", async () => {
		const session = makeSession({
			links: [{ path: "docs/readme.md", addedAt: "2026-02-16T09:00:00.000Z" }],
		});
		const ctx = createMockContext([session]);

		await handleLinkAdd(ctx, "session-1", "docs/readme.md");

		expect(session.links).toHaveLength(1);
		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleLinkRemove ─────────────────────────────────────

describe("handleLinkRemove", () => {
	it("removes an existing link", async () => {
		const session = makeSession({
			links: [{ path: "docs/readme.md", addedAt: "2026-02-16T09:00:00.000Z" }],
		});
		const ctx = createMockContext([session]);

		await handleLinkRemove(ctx, "session-1", "docs/readme.md");

		expect(session.links).toHaveLength(0);
		expect(ctx.emitted.some(([e]) => e === "session.link.removed")).toBe(true);
	});
});

// ── handleContextBind ────────────────────────────────────

describe("handleContextBind", () => {
	it("adds a context binding", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleContextBind(ctx, "session-1", "src/domain/session/", "folder");

		expect(session.contextBindings).toHaveLength(1);
		expect(session.contextBindings[0].path).toBe("src/domain/session/");
		expect(session.contextBindings[0].type).toBe("folder");
		expect(ctx.checkCognitiveOverload).toHaveBeenCalledWith("session-1");
	});

	it("rejects duplicate binding path", async () => {
		const session = makeSession({
			contextBindings: [{
				id: "ctx-1", type: "folder", label: "session",
				path: "src/domain/session/", boundAt: "2026-02-16T09:00:00.000Z",
			}],
		});
		const ctx = createMockContext([session]);

		await handleContextBind(ctx, "session-1", "src/domain/session/", "folder");

		expect(session.contextBindings).toHaveLength(1);
		expect(ctx.emitted).toHaveLength(0);
	});

	it("rejects when at maximum bindings capacity", async () => {
		const bindings = Array.from({ length: MAX_CONTEXT_BINDINGS }, (_, i) => ({
			id: `ctx-${i}`, type: "folder" as const, label: `b${i}`,
			path: `path/${i}/`, boundAt: "2026-02-16T09:00:00.000Z",
		}));
		const session = makeSession({ contextBindings: bindings });
		const ctx = createMockContext([session]);

		await handleContextBind(ctx, "session-1", "new/path/", "folder");

		expect(session.contextBindings).toHaveLength(MAX_CONTEXT_BINDINGS);
	});
});

// ── handleContextUnbind ──────────────────────────────────

describe("handleContextUnbind", () => {
	it("removes a binding by ID", async () => {
		const session = makeSession({
			contextBindings: [{
				id: "ctx-1", type: "folder", label: "session",
				path: "src/domain/session/", boundAt: "2026-02-16T09:00:00.000Z",
			}],
		});
		const ctx = createMockContext([session]);

		await handleContextUnbind(ctx, "session-1", "ctx-1");

		expect(session.contextBindings).toHaveLength(0);
		expect(ctx.emitted.some(([e]) => e === "session.context.unbound")).toBe(true);
	});
});

// ── handleDecisionRecord ─────────────────────────────────

describe("handleDecisionRecord", () => {
	it("records a decision", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleDecisionRecord(ctx, "session-1", "Use DDD", "For better separation");

		expect(session.decisions).toHaveLength(1);
		expect(session.decisions[0].title).toBe("Use DDD");
		expect(session.decisions[0].description).toBe("For better separation");
		expect(ctx.emitted.some(([e]) => e === "session.decision.recorded")).toBe(true);
	});

	it("rejects empty title (whitespace only)", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleDecisionRecord(ctx, "session-1", "   ");

		expect(session.decisions).toHaveLength(0);
		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleReflectionAdd ──────────────────────────────────

describe("handleReflectionAdd", () => {
	it("adds a reflection on a running session", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleReflectionAdd(ctx, "session-1", "observation", "The API is clean");

		expect(session.reflections).toHaveLength(1);
		expect(session.reflections[0].type).toBe("observation");
		expect(session.reflections[0].content).toBe("The API is clean");
		expect(ctx.emitted.some(([e]) => e === "session.reflection.added")).toBe(true);
	});

	it("rejects reflections on prepared sessions", async () => {
		const session = makeSession({ status: "prepared" });
		const ctx = createMockContext([session]);

		await handleReflectionAdd(ctx, "session-1", "idea", "Something");

		expect(session.reflections).toHaveLength(0);
	});

	it("emits capacity reached when at limit", async () => {
		const reflections = Array.from({ length: MAX_REFLECTIONS }, (_, i) => ({
			id: `ref-${i}`, type: "observation" as const,
			content: `Reflection ${i}`, timestamp: "2026-02-16T09:00:00.000Z",
		}));
		const session = makeSession({ status: "running", reflections });
		const ctx = createMockContext([session]);

		await handleReflectionAdd(ctx, "session-1", "idea", "One more");

		expect(session.reflections).toHaveLength(MAX_REFLECTIONS);
		expect(ctx.emitted.some(([e]) => e === "session.reflection.capReached")).toBe(true);
	});

	it("rejects empty content", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleReflectionAdd(ctx, "session-1", "blocker", "  ");

		expect(session.reflections).toHaveLength(0);
	});
});

// ── handleOutputGenerate ─────────────────────────────────

describe("handleOutputGenerate", () => {
	const template: SessionOutputTemplate = {
		type: "action-items",
		title: "Action Items",
		description: "Extract action items",
		sections: [{ heading: "Items", placeholder: "{{tasks}}" }],
	};

	it("generates output on a completed session", async () => {
		const session = makeSession({
			status: "completed",
			notesFile: "03 - Resources/Sessions/notes.md",
		});
		const ctx = createMockContext([session]);

		await handleOutputGenerate(ctx, "session-1", template);

		expect(session.outputArtifacts).toHaveLength(1);
		expect(session.outputArtifacts[0].type).toBe("action-items");
		expect(ctx.fileSystem!.createFile).toHaveBeenCalled();
		expect(ctx.emitted.some(([e]) => e === "session.output.generated")).toBe(true);
	});

	it("handles file-already-exists error gracefully", async () => {
		const session = makeSession({ status: "completed" });
		const ctx = createMockContext([session]);
		(ctx.fileSystem!.createFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("File already exists"),
		);

		await handleOutputGenerate(ctx, "session-1", template);

		// Should still add artifact and emit event even if file creation failed with "already exists"
		expect(session.outputArtifacts).toHaveLength(1);
	});

	it("ignores running sessions", async () => {
		const session = makeSession({ status: "running" });
		const ctx = createMockContext([session]);

		await handleOutputGenerate(ctx, "session-1", template);

		expect(session.outputArtifacts).toHaveLength(0);
	});
});

// ── handleTypeCreate ─────────────────────────────────────

describe("handleTypeCreate", () => {
	it("creates a custom session type", async () => {
		const ctx = createMockContext();
		const config = {
			type: "custom-type" as any,
			label: "Custom Type",
			icon: "star",
			guidingQuestions: [],
			defaultDuration: 30,
			defaultGoals: [],
		};

		await handleTypeCreate(ctx, config);

		expect(ctx.customSessionTypes["custom-type"]).toBeDefined();
		expect(ctx.emitted.some(([e]) => e === "session.type.created")).toBe(true);
	});

	it("rejects builtin type duplicate", async () => {
		const ctx = createMockContext();
		const config = {
			type: "documentation" as any,
			label: "Documentation Override",
			icon: "file",
			guidingQuestions: [],
			defaultDuration: 25,
			defaultGoals: [],
		};

		await handleTypeCreate(ctx, config);

		expect(ctx.customSessionTypes["documentation"]).toBeUndefined();
		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleNotesUpdate ────────────────────────────────────

describe("handleNotesUpdate", () => {
	it("updates session notes", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleNotesUpdate(ctx, "session-1", "Updated notes");

		expect(session.notes).toBe("Updated notes");
		expect(ctx.scheduleSyncNotesFile).toHaveBeenCalledWith("session-1");
	});
});

// ── handleContextChangeType ──────────────────────────────

describe("handleContextChangeType", () => {
	it("changes binding type", async () => {
		const session = makeSession({
			contextBindings: [{
				id: "ctx-1", type: "folder", label: "session",
				path: "src/domain/session/", boundAt: "2026-02-16T09:00:00.000Z",
			}],
		});
		const ctx = createMockContext([session]);

		await handleContextChangeType(ctx, "session-1", "ctx-1", "domain");

		expect(session.contextBindings[0].type).toBe("domain");
		expect(ctx.emitted.some(([e]) => e === "session.context.typeChanged")).toBe(true);
	});
});

// ── handleTypeConfigure ──────────────────────────────────

describe("handleTypeConfigure", () => {
	it("merges updates into type config", async () => {
		const ctx = createMockContext();

		await handleTypeConfigure(ctx, "documentation", { defaultDuration: 45 });

		expect(ctx.customSessionTypes["documentation"]!.defaultDuration).toBe(45);
		expect(ctx.emitted.some(([e]) => e === "session.type.configured")).toBe(true);
	});
});
