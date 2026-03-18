// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSessionWorkspaceHandler } from "../../../../src/infrastructure/handlers/leaf-handlers/session-workspace-handler";
import type { SessionWorkspaceHandlerDeps } from "../../../../src/infrastructure/handlers/leaf-handlers/session-workspace-handler";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import type { Session } from "../../../../src/domain/session/types";

// ── Mock Lit component side-effect import ────────────────────
// The handler imports flowti-session-workspace.js as side-effect;
// in happy-dom custom elements from Lit don't register, so
// document.createElement returns a plain HTMLElement — which is
// fine for our property-based assertions.

vi.mock("../../../../src/ui/session/SessionWorkspaceHelpers", () => ({
	getStatusClass: vi.fn((s: string) => s),
	captureWorkspaceState: vi.fn(),
	restoreWorkspaceState: vi.fn(),
	openOutputPicker: vi.fn(),
	openSaveTemplateModal: vi.fn(),
	openInTab: vi.fn(),
	openInSidebar: vi.fn(),
	openInAdjacentLeaf: vi.fn(),
	revealInFileExplorer: vi.fn(),
}));

// ── Factories ─────────────────────────────────────────────────

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session-1",
		title: "Test Session",
		type: "focused",
		status: "active",
		createdAt: new Date().toISOString(),
		startedAt: new Date().toISOString(),
		completedAt: null,
		durationMinutes: 25,
		goals: [],
		executionTasks: [],
		notes: "",
		activity: [],
		decisions: [],
		reflections: [],
		outputArtifacts: [],
		focusFile: null,
		notesFile: null,
		canvasFile: null,
		closureResponse: null,
		energy: null,
		activityFilter: [],
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		artifacts: [],
		timeline: [],
		links: [],
		contextBindings: [],
		workspaceState: null,
		featureName: null,
		intent: null,
		...overrides,
	} as Session;
}

function createMockSessionService(session: Session | null = null) {
	return {
		getActiveSession: vi.fn(() => session),
		getSessionById: vi.fn((id: string) => id === session?.id ? session : null),
		workspaceSessionId: session?.id ?? null,
		completeClosure: vi.fn().mockResolvedValue(undefined),
		skipClosure: vi.fn().mockResolvedValue(undefined),
		updateActivityFilter: vi.fn(),
		globalActivityFilter: [] as string[],
	};
}

function createMockApp() {
	return {
		workspace: {
			rightSplit: {},
		},
	};
}

function createMockLeaf() {
	return {
		getRoot: vi.fn(() => ({})),
	};
}

function createDeps(overrides: Partial<SessionWorkspaceHandlerDeps> = {}): SessionWorkspaceHandlerDeps {
	const session = createSession();
	return {
		sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
		eventBus: createMockEventBus(),
		app: createMockApp() as unknown as SessionWorkspaceHandlerDeps["app"],
		...overrides,
	};
}

function createCtx(eventBus: IEventBus) {
	return {
		tabId: "main",
		viewId: "test",
		eventBus,
		leaf: createMockLeaf(),
	};
}

/** Helper to get the Lit workspace element from the container. */
function getWorkspaceEl(container: HTMLElement): HTMLElement & Record<string, unknown> {
	return container.querySelector("flowti-session-workspace") as HTMLElement & Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────

describe("registerSessionWorkspaceHandler", () => {
	let registry: PluginHandlerRegistry;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		vi.clearAllMocks();
	});

	it("registers the leaf:session-workspace tab handler", () => {
		registerSessionWorkspaceHandler(registry, createDeps());
		expect(registry.getTabHandler("leaf:session-workspace")).toBeDefined();
	});

	describe("empty state (no session)", () => {
		it("creates workspace element with empty sessionId when no active session", () => {
			const deps = createDeps({
				sessionService: createMockSessionService(null) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace).not.toBeNull();
			expect(workspace.sessionId).toBe("");
		});

		it("creates workspace element even when no session", () => {
			const deps = createDeps({
				sessionService: createMockSessionService(null) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			// The Lit component is always appended — it handles empty state internally
			expect(getWorkspaceEl(container)).not.toBeNull();
		});
	});

	describe("session rendering", () => {
		it("adds ft-session-workspace class to container", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(container.classList.contains("ft-session-workspace")).toBe(true);
		});

		it("sets session title on workspace element", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.sessionTitle).toBe("Test Session");
		});

		it("sets session type on workspace element", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.sessionType).toBe("focused");
		});

		it("sets session status on workspace element", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.sessionStatus).toBe("active");
		});

		it("sets duration on workspace element", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.durationMinutes).toBe(25);
		});

		it("sets zero duration for untimed sessions", () => {
			const session = createSession({ durationMinutes: 0 });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.durationMinutes).toBe(0);
		});

		it("sets guiding questions for active sessions", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			// Active sessions receive guiding questions from type config
			expect(Array.isArray(workspace.guidingQuestions)).toBe(true);
		});

		it("sets empty guiding questions for completed sessions", () => {
			const session = createSession({ status: "completed" });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.guidingQuestions).toEqual([]);
		});
	});

	describe("session status properties", () => {
		it("sets isEditable true for active sessions", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.isEditable).toBe(true);
		});

		it("sets isEditable false for completed sessions", () => {
			const session = createSession({ status: "completed" });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.isEditable).toBe(false);
		});

		it("sets showOutputs true for completed sessions", () => {
			const session = createSession({ status: "completed" });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(workspace.showOutputs).toBe(true);
		});
	});

	describe("closure overlay", () => {
		it("sets closure questions for reviewing sessions", () => {
			const session = createSession({ status: "reviewing" as Session["status"] });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const workspace = getWorkspaceEl(container);
			expect(Array.isArray(workspace.closureQuestions)).toBe(true);
			expect((workspace.closureQuestions as unknown[]).length).toBeGreaterThan(0);
		});
	});

	describe("event subscriptions", () => {
		it("sets up event subscriptions on init", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			// The handler registers EventBus listeners internally
			expect(deps.eventBus.on).toHaveBeenCalled();
		});
	});

	describe("session service integration", () => {
		it("sets workspaceSessionId when session is found", () => {
			const session = createSession();
			const service = createMockSessionService(session);
			const deps = createDeps({
				sessionService: service as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(service.workspaceSessionId).toBe("session-1");
		});

		it("uses workspaceSessionId to look up session by id", () => {
			const session = createSession({ id: "specific-id" });
			const service = createMockSessionService(session);
			service.workspaceSessionId = "specific-id";
			const deps = createDeps({
				sessionService: service as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(service.getSessionById).toHaveBeenCalledWith("specific-id");
		});
	});
});
