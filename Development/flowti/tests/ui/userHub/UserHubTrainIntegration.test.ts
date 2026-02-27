// @vitest-environment happy-dom
/**
 * Inc 7 Tests — User Hub Train-Aware Session Panels.
 *
 * Validates:
 * - SESSION_TYPE_LABELS includes train-of-thought
 * - Master list shows train icon + thought count badge
 * - Detail panel shows train section (thoughts, branches, thought list)
 * - Action buttons relabeled for train sessions (Open Train, Timeline)
 * - Dashboard active session card shows train icon + thought badge
 */

import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { UserHubSessions } from "../../../src/ui/userHub/UserHubSessions";
import { UserHubDashboard } from "../../../src/ui/userHub/UserHubDashboard";
import {
	SESSION_TYPE_LABELS,
	type UserHubState,
	type UserHubComponentDeps,
} from "../../../src/ui/userHub/types";
import type { Session } from "../../../src/domain/session/types";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../src/domain/train/types";
import type { UUID } from "../../../src/utils/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

// ── Helpers ──────────────────────────────────────────────────

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "prepared",
		durationMinutes: 25,
		createdAt: new Date("2026-02-16T10:00:00").toISOString(),
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

function makeTrainSession(overrides?: Partial<Session>): Session {
	return makeSession({
		id: "train-session-1",
		type: "train-of-thought",
		title: "Morning Train",
		status: "running",
		startedAt: new Date("2026-02-21T10:00:00").toISOString(),
		...overrides,
	});
}

function makeThought(overrides?: Partial<ThoughtNode>): ThoughtNode {
	return {
		id: `thought_${Math.random().toString(36).slice(2, 8)}`,
		trainId: "train_1",
		title: "Test Thought",
		path: "00 - Connectivity/inbox/Test Thought.md",
		createdAt: "2026-02-21T10:05:00.000Z",
		order: 0,
		...overrides,
	};
}

function makeTrain(overrides?: Partial<TrainState>): TrainState {
	return {
		id: "train_1",
		sessionId: "train-session-1",
		title: "Morning Train",
		status: "running",
		thoughts: [],
		relations: [],
		durationMinutes: 0,
		createdAt: "2026-02-21T10:00:00.000Z",
		pausedAt: null,
		completedAt: null,
		...overrides,
	};
}

function makeState(sessions: Session[] = [], selectedSession: Session | null = null): UserHubState {
	const active = sessions.find((s) => s.status === "active" || s.status === "running") ?? null;
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: [],
		sessions,
		activeSession: active,
		selectedSession,
		settings: { ...DEFAULT_SETTINGS },
		selectedPreferencesCategory: null,
	};
}

function makeTrainService(trains: TrainState[] = []) {
	return {
		getAllTrains: vi.fn(() => trains),
		getActiveTrain: vi.fn(() => trains.find((t) => t.status === "running" || t.status === "paused")),
		getTimeline: vi.fn(() => []),
		getBranches: vi.fn(() => []),
	} as never;
}

function makeDeps(state: UserHubState, opts?: { eventBus?: EventBus; trainService?: ReturnType<typeof makeTrainService> }): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus: opts?.eventBus ?? new EventBus(),
		app: {} as never,
		inboxService: {
			markRead: vi.fn(async () => {}),
			dismiss: vi.fn(async () => {}),
			clearAll: vi.fn(async () => {}),
			getItems: vi.fn(() => []),
			getUnreadCount: vi.fn(() => 0),
		} as never,
		sessionService: {
			getSessions: vi.fn(() => state.sessions),
			getActiveSession: vi.fn(() => state.activeSession),
			getSavedTemplates: vi.fn(() => []),
			rerunSession: vi.fn(async () => makeSession({ id: "rerun-1", title: "Rerun", status: "prepared" })),
			deleteTemplate: vi.fn(async () => {}),
			createFromTemplate: vi.fn(async () => {}),
			saveTemplateFromSession: vi.fn(async () => null),
		} as never,
		userService: {
			load: vi.fn(async () => {}),
			hasUser: vi.fn(() => false),
			getUser: vi.fn(() => null),
			createUser: vi.fn(async (name: string) => ({ id: "user_1" as UUID, name, createdAt: new Date().toISOString() })),
			updateUserName: vi.fn(async () => {}),
		},
		scheduleRender: vi.fn(),
		navigateToEvent: vi.fn(),
		openNewSessionModal: vi.fn(),
		openFile: vi.fn(),
		openSaveTemplateModal: vi.fn(),
		openSessionWorkspace: vi.fn(),
		exportTemplateAsFile: vi.fn(),
		importTemplateFromFile: vi.fn(),
		getSettings: () => state.settings,
		trainService: opts?.trainService,
	};
}

// ── SESSION_TYPE_LABELS ──────────────────────────────────────

describe("SESSION_TYPE_LABELS includes train-of-thought", () => {
	it("has train-of-thought label", () => {
		expect(SESSION_TYPE_LABELS["train-of-thought"]).toBe("Train of Thought");
	});

	it("retains all existing labels", () => {
		expect(SESSION_TYPE_LABELS["documentation"]).toBe("Documentation");
		expect(SESSION_TYPE_LABELS["event-storming"]).toBe("Event Storming");
		expect(SESSION_TYPE_LABELS["service-design"]).toBe("Service Design");
	});
});

// ── Master List Train Icon & Badge ───────────────────────────

describe("UserHubSessions master list — train awareness", () => {
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	it("shows train-of-thought type badge on train session rows", () => {
		const session = makeTrainSession();
		const state = makeState([session]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

		comp.renderMaster("");

		expect(masterEl.textContent).toContain("Train of Thought");
	});

	it("shows thought count badge when trainService is available", () => {
		const session = makeTrainSession();
		const train = makeTrain({
			thoughts: [
				makeThought({ id: "t1", title: "First" }),
				makeThought({ id: "t2", title: "Second" }),
				makeThought({ id: "t3", title: "Third" }),
			],
		});
		const state = makeState([session]);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderMaster("");

		const badge = masterEl.querySelector(".ft-train-thought-badge");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toBe("3 thoughts");
	});

	it("shows singular 'thought' for 1 thought", () => {
		const session = makeTrainSession();
		const train = makeTrain({ thoughts: [makeThought({ id: "t1" })] });
		const state = makeState([session]);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderMaster("");

		const badge = masterEl.querySelector(".ft-train-thought-badge");
		expect(badge!.textContent).toBe("1 thought");
	});

	it("does not show thought badge for non-train sessions", () => {
		const session = makeSession({ type: "event-storming" });
		const state = makeState([session]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

		comp.renderMaster("");

		const badge = masterEl.querySelector(".ft-train-thought-badge");
		expect(badge).toBeNull();
	});

	it("does not show thought badge when no trainService", () => {
		const session = makeTrainSession();
		const state = makeState([session]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

		comp.renderMaster("");

		const badge = masterEl.querySelector(".ft-train-thought-badge");
		expect(badge).toBeNull();
	});
});

// ── Detail Panel Train Section ───────────────────────────────

describe("SessionDetailPanel — train section", () => {
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	it("shows train section with thought count for train sessions", () => {
		const session = makeTrainSession();
		const train = makeTrain({
			thoughts: [
				makeThought({ id: "t1", title: "Idea A" }),
				makeThought({ id: "t2", title: "Idea B" }),
			],
		});
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderDetail();

		const trainSection = detailEl.querySelector(".ft-train-section");
		expect(trainSection).not.toBeNull();
		expect(trainSection!.textContent).toContain("Train of thought");
		expect(trainSection!.textContent).toContain("2 thoughts");
	});

	it("shows branch count when branches exist", () => {
		const session = makeTrainSession();
		const relations: ThoughtRelation[] = [
			{ fromId: "t1", toId: "t2", direction: "next" },
			{ fromId: "t1", toId: "t3", direction: "branch" },
		];
		const train = makeTrain({
			thoughts: [
				makeThought({ id: "t1" }),
				makeThought({ id: "t2" }),
				makeThought({ id: "t3" }),
			],
			relations,
		});
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderDetail();

		const trainSection = detailEl.querySelector(".ft-train-section");
		expect(trainSection!.textContent).toContain("1 branch");
	});

	it("shows clickable thought list (max 5)", () => {
		const session = makeTrainSession();
		const thoughts = Array.from({ length: 7 }, (_, i) =>
			makeThought({ id: `t${i}`, title: `Thought ${i}`, path: `inbox/thought-${i}.md` }),
		);
		const train = makeTrain({ thoughts });
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const deps = makeDeps(state, { trainService });
		const comp = new UserHubSessions(masterEl, detailEl, deps);

		comp.renderDetail();

		const thoughtList = detailEl.querySelector(".ft-train-thought-list");
		expect(thoughtList).not.toBeNull();
		const links = thoughtList!.querySelectorAll("a.ft-link");
		expect(links).toHaveLength(5);
		expect(links[0].textContent).toBe("Thought 0");

		// "+N more" indicator
		expect(thoughtList!.textContent).toContain("+ 2 more");
	});

	it("opens thought file when clicking thought link", () => {
		const session = makeTrainSession();
		const train = makeTrain({
			thoughts: [makeThought({ id: "t1", title: "My Idea", path: "inbox/my-idea.md" })],
		});
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const deps = makeDeps(state, { trainService });
		const comp = new UserHubSessions(masterEl, detailEl, deps);

		comp.renderDetail();

		const link = detailEl.querySelector(".ft-train-thought-list a.ft-link") as HTMLElement;
		link.click();
		expect(deps.openFile).toHaveBeenCalledWith("inbox/my-idea.md");
	});

	it("does not show train section for non-train sessions", () => {
		const session = makeSession({ type: "event-storming" });
		const state = makeState([session], session);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

		comp.renderDetail();

		expect(detailEl.querySelector(".ft-train-section")).toBeNull();
	});

	it("does not show train section when no trainService", () => {
		const session = makeTrainSession();
		const state = makeState([session], session);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

		comp.renderDetail();

		expect(detailEl.querySelector(".ft-train-section")).toBeNull();
	});
});

// ── Action Button Relabeling ─────────────────────────────────

describe("SessionDetailPanel — action button relabeling for train sessions", () => {
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	it("shows 'Open Train' and 'Timeline' for active train sessions", () => {
		const session = makeTrainSession({ status: "running", startedAt: new Date().toISOString() });
		const train = makeTrain();
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderDetail();

		const buttons = Array.from(detailEl.querySelectorAll("button"));
		const labels = buttons.map((b) => b.textContent?.trim());
		expect(labels).toContain("Open Train");
		expect(labels).toContain("Timeline");
		expect(labels).not.toContain("Workspace");
		expect(labels).not.toContain("Sidebar");
	});

	it("shows 'Open Train' and 'Timeline' for prepared train sessions", () => {
		const session = makeTrainSession({ status: "prepared", startedAt: null });
		const train = makeTrain({ sessionId: session.id });
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderDetail();

		const buttons = Array.from(detailEl.querySelectorAll("button"));
		const labels = buttons.map((b) => b.textContent?.trim());
		expect(labels).toContain("Open Train");
		expect(labels).toContain("Timeline");
	});

	it("shows 'Open Train' and 'Timeline' for paused train sessions", () => {
		const session = makeTrainSession({ status: "paused", pausedAt: new Date().toISOString() });
		const train = makeTrain({ sessionId: session.id });
		const state = makeState([session], session);
		const trainService = makeTrainService([train]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderDetail();

		const buttons = Array.from(detailEl.querySelectorAll("button"));
		const labels = buttons.map((b) => b.textContent?.trim());
		expect(labels).toContain("Open Train");
		expect(labels).toContain("Timeline");
	});

	it("falls back to Workspace/Sidebar for train sessions without TrainState", () => {
		const session = makeTrainSession({ status: "running", startedAt: new Date().toISOString() });
		const state = makeState([session], session);
		// trainService returns no trains for this session
		const trainService = makeTrainService([]);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, { trainService }));

		comp.renderDetail();

		const buttons = Array.from(detailEl.querySelectorAll("button"));
		const labels = buttons.map((b) => b.textContent?.trim());
		expect(labels).toContain("Workspace");
		expect(labels).toContain("Sidebar");
		expect(labels).not.toContain("Open Train");
	});

	it("shows Workspace/Sidebar for non-train sessions", () => {
		const session = makeSession({ status: "active", startedAt: new Date().toISOString() });
		const state = makeState([session], session);
		const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

		comp.renderDetail();

		const buttons = Array.from(detailEl.querySelectorAll("button"));
		const labels = buttons.map((b) => b.textContent?.trim());
		expect(labels).toContain("Workspace");
		expect(labels).toContain("Sidebar");
		expect(labels).not.toContain("Open Train");
	});
});

// ── Dashboard Active Train Card ──────────────────────────────

describe("UserHubDashboard — train-aware active session", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	function makeDashboardDeps(opts: {
		activeSession: Session | null;
		trains?: TrainState[];
	}) {
		return {
			userService: { getUser: vi.fn(() => ({ name: "Test" })) } as never,
			hubRegistry: { getAll: vi.fn(() => []) } as never,
			eventBus: new EventBus() as never,
			inboxService: {
				getItems: vi.fn(() => []),
				getUnreadCount: vi.fn(() => 0),
				clearAll: vi.fn(async () => {}),
			} as never,
			sessionService: {
				getActiveSession: vi.fn(() => opts.activeSession),
				getSessionById: vi.fn((id: string) => opts.activeSession?.id === id ? opts.activeSession : null),
				getSessions: vi.fn(() => opts.activeSession ? [opts.activeSession] : []),
			} as never,
			nudgeService: { getConfigs: vi.fn(() => []), isDismissedToday: vi.fn(() => false) } as never,
			trainService: opts.trains ? makeTrainService(opts.trains) : undefined,
			navigateToTab: vi.fn(),
			onInboxItemClick: vi.fn(),
			openSessionWorkspace: vi.fn(),
			onCreateSession: vi.fn(),
		};
	}

	it("shows thought count badge on active train session card", () => {
		const session = makeTrainSession();
		const train = makeTrain({
			thoughts: [
				makeThought({ id: "t1" }),
				makeThought({ id: "t2" }),
			],
		});
		const deps = makeDashboardDeps({ activeSession: session, trains: [train] });
		const dashboard = new UserHubDashboard(container, deps);

		dashboard.render();

		const card = container.querySelector(".ft-active-session");
		expect(card).not.toBeNull();
		expect(card!.textContent).toContain("2 thoughts");
	});

	it("does not show thought badge for non-train active sessions", () => {
		const session = makeSession({
			status: "running",
			startedAt: new Date().toISOString(),
		});
		const deps = makeDashboardDeps({ activeSession: session });
		const dashboard = new UserHubDashboard(container, deps);

		dashboard.render();

		const card = container.querySelector(".ft-active-session");
		expect(card).not.toBeNull();
		expect(card!.textContent).not.toContain("thought");
	});

	it("does not show thought badge when no trainService", () => {
		const session = makeTrainSession();
		const deps = makeDashboardDeps({ activeSession: session });
		const dashboard = new UserHubDashboard(container, deps);

		dashboard.render();

		const card = container.querySelector(".ft-active-session");
		expect(card!.textContent).not.toContain("thought");
	});
});
