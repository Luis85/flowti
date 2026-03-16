// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSessionWorkspaceHandler } from "../../../../src/infrastructure/handlers/leaf-handlers/session-workspace-handler";
import type { SessionWorkspaceHandlerDeps } from "../../../../src/infrastructure/handlers/leaf-handlers/session-workspace-handler";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import type { Session } from "../../../../src/domain/session/types";

// ── Mock all panel components (render stubs) ──────────────────

const panelMocks = {
	timerPanel: { render: vi.fn(), destroy: vi.fn() },
	goalsPanel: { render: vi.fn(), refreshGoals: vi.fn() },
	executionPanel: { render: vi.fn(), refreshTasks: vi.fn() },
	notesPanel: { render: vi.fn(), updateNotes: vi.fn(), destroy: vi.fn() },
	contextPanel: { render: vi.fn() },
	activityPanel: { render: vi.fn(), refreshList: vi.fn() },
	guidingPanel: { render: vi.fn() },
	decisionPanel: { render: vi.fn(), refreshList: vi.fn() },
	reflectionPanel: { render: vi.fn(), refreshList: vi.fn() },
	outputPanel: { render: vi.fn(), refreshList: vi.fn() },
	energyPanel: { render: vi.fn(), refreshEnergy: vi.fn() },
	overloadAlert: { render: vi.fn(), refreshAlert: vi.fn() },
	intelligencePanel: { render: vi.fn(), refreshStats: vi.fn() },
	closureOverlay: { render: vi.fn() },
	trainClosurePanel: { render: vi.fn() },
};

vi.mock("../../../../src/ui/session/SessionTimerPanel", () => ({
	SessionTimerPanel: class { render = panelMocks.timerPanel.render; destroy = panelMocks.timerPanel.destroy; },
}));
vi.mock("../../../../src/ui/session/SessionGoalsPanel", () => ({
	SessionGoalsPanel: class { render = panelMocks.goalsPanel.render; refreshGoals = panelMocks.goalsPanel.refreshGoals; },
}));
vi.mock("../../../../src/ui/session/SessionExecutionPanel", () => ({
	SessionExecutionPanel: class { render = panelMocks.executionPanel.render; refreshTasks = panelMocks.executionPanel.refreshTasks; },
}));
vi.mock("../../../../src/ui/session/SessionNotesPanel", () => ({
	SessionNotesPanel: class { render = panelMocks.notesPanel.render; updateNotes = panelMocks.notesPanel.updateNotes; destroy = panelMocks.notesPanel.destroy; },
}));
vi.mock("../../../../src/ui/session/SessionContextPanel", () => ({
	SessionContextPanel: class { render = panelMocks.contextPanel.render; },
}));
vi.mock("../../../../src/ui/session/SessionActivityPanel", () => ({
	SessionActivityPanel: class { render = panelMocks.activityPanel.render; refreshList = panelMocks.activityPanel.refreshList; },
}));
vi.mock("../../../../src/ui/session/SessionGuidingQuestions", () => ({
	SessionGuidingQuestions: class { render = panelMocks.guidingPanel.render; },
}));
vi.mock("../../../../src/ui/session/SessionDecisionPanel", () => ({
	SessionDecisionPanel: class { render = panelMocks.decisionPanel.render; refreshList = panelMocks.decisionPanel.refreshList; },
}));
vi.mock("../../../../src/ui/session/SessionReflectionPanel", () => ({
	SessionReflectionPanel: class { render = panelMocks.reflectionPanel.render; refreshList = panelMocks.reflectionPanel.refreshList; },
}));
vi.mock("../../../../src/ui/session/SessionOutputPanel", () => ({
	SessionOutputPanel: class { render = panelMocks.outputPanel.render; refreshList = panelMocks.outputPanel.refreshList; },
}));
vi.mock("../../../../src/ui/session/SessionEnergyIndicator", () => ({
	SessionEnergyIndicator: class { render = panelMocks.energyPanel.render; refreshEnergy = panelMocks.energyPanel.refreshEnergy; },
}));
vi.mock("../../../../src/ui/session/CognitiveLoadAlert", () => ({
	CognitiveLoadAlert: class { render = panelMocks.overloadAlert.render; refreshAlert = panelMocks.overloadAlert.refreshAlert; },
}));
vi.mock("../../../../src/ui/session/SessionActivityIntelligencePanel", () => ({
	SessionActivityIntelligencePanel: class { render = panelMocks.intelligencePanel.render; refreshStats = panelMocks.intelligencePanel.refreshStats; },
}));
vi.mock("../../../../src/ui/session/SessionClosureOverlay", () => ({
	SessionClosureOverlay: class { render = panelMocks.closureOverlay.render; },
}));
vi.mock("../../../../src/ui/session/TrainClosurePanel", () => ({
	TrainClosurePanel: class { render = panelMocks.trainClosurePanel.render; },
}));
vi.mock("../../../../src/ui/session/SessionWorkspaceSubscriptions", () => ({
	setupEventSubscriptions: vi.fn(() => [vi.fn()]),
}));
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
		tasks: [],
		notes: "",
		activities: [],
		decisions: [],
		reflections: [],
		outputs: [],
		focusFile: null,
		notesFile: null,
		canvasFile: null,
		closureResponse: null,
		energyStart: null,
		energyEnd: null,
		activityFilter: { types: [], minDuration: 0 },
		tags: [],
		pausedAt: null,
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
		globalActivityFilter: { types: [], minDuration: 0 },
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
		it("renders empty state when no active session", () => {
			const deps = createDeps({
				sessionService: createMockSessionService(null) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const empty = container.querySelector(".ft-session-workspace-empty");
			expect(empty).not.toBeNull();
			expect(empty!.querySelector(".ft-text-lg")?.textContent).toBe("No session selected");
		});

		it("does not render any panels when no session", () => {
			const deps = createDeps({
				sessionService: createMockSessionService(null) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.goalsPanel.render).not.toHaveBeenCalled();
			expect(panelMocks.executionPanel.render).not.toHaveBeenCalled();
			expect(panelMocks.notesPanel.render).not.toHaveBeenCalled();
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

		it("renders header with session title and type badge", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const header = container.querySelector(".ft-session-workspace-header");
			expect(header).not.toBeNull();
			expect(header!.querySelector("h4")?.textContent).toBe("Test Session");
			expect(header!.querySelector(".ft-session-type-badge")).not.toBeNull();
		});

		it("renders status badge in header", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const statusBadge = container.querySelector(".ft-session-status-badge");
			expect(statusBadge).not.toBeNull();
		});

		it("renders core panels for active session", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.energyPanel.render).toHaveBeenCalled();
			expect(panelMocks.intelligencePanel.render).toHaveBeenCalled();
			expect(panelMocks.goalsPanel.render).toHaveBeenCalled();
			expect(panelMocks.executionPanel.render).toHaveBeenCalled();
			expect(panelMocks.overloadAlert.render).toHaveBeenCalled();
			expect(panelMocks.notesPanel.render).toHaveBeenCalled();
			expect(panelMocks.contextPanel.render).toHaveBeenCalled();
			expect(panelMocks.decisionPanel.render).toHaveBeenCalled();
			expect(panelMocks.reflectionPanel.render).toHaveBeenCalled();
			expect(panelMocks.activityPanel.render).toHaveBeenCalled();
		});

		it("renders timer panel when session has duration", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.timerPanel.render).toHaveBeenCalled();
		});

		it("skips timer panel for untimed sessions", () => {
			const session = createSession({ durationMinutes: 0 });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.timerPanel.render).not.toHaveBeenCalled();
		});

		it("renders guiding questions for active sessions", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.guidingPanel.render).toHaveBeenCalled();
		});

		it("does not render guiding questions for completed sessions", () => {
			const session = createSession({ status: "completed" });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.guidingPanel.render).not.toHaveBeenCalled();
		});
	});

	describe("action buttons", () => {
		it("renders Pause and Complete for active sessions", () => {
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const actions = container.querySelector(".ft-session-workspace-actions");
			expect(actions).not.toBeNull();
			const buttons = actions!.querySelectorAll("button");
			const labels = Array.from(buttons).map((b) => b.textContent?.trim());
			expect(labels).toContain("Pause");
			expect(labels).toContain("Complete");
		});

		it("renders Resume and Complete for paused sessions", () => {
			const session = createSession({ status: "paused" });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			const actions = container.querySelector(".ft-session-workspace-actions");
			const buttons = actions!.querySelectorAll("button");
			const labels = Array.from(buttons).map((b) => b.textContent?.trim());
			expect(labels).toContain("Resume");
			expect(labels).toContain("Complete");
		});

		it("renders output panel for completed sessions", () => {
			const session = createSession({ status: "completed" });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.outputPanel.render).toHaveBeenCalled();
		});
	});

	describe("closure overlay", () => {
		it("renders closure overlay for reviewing sessions", () => {
			const session = createSession({ status: "reviewing" as Session["status"] });
			const deps = createDeps({
				sessionService: createMockSessionService(session) as unknown as SessionWorkspaceHandlerDeps["sessionService"],
			});
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(panelMocks.closureOverlay.render).toHaveBeenCalled();
			// Normal panels should NOT render when reviewing
			expect(panelMocks.goalsPanel.render).not.toHaveBeenCalled();
		});
	});

	describe("event subscriptions", () => {
		it("sets up event subscriptions on init", async () => {
			const { setupEventSubscriptions } = await import("../../../../src/ui/session/SessionWorkspaceSubscriptions");
			const deps = createDeps();
			registerSessionWorkspaceHandler(registry, deps);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:session-workspace")!(container, createCtx(deps.eventBus));

			expect(setupEventSubscriptions).toHaveBeenCalled();
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
