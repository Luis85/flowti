// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { UserHubSessions } from "../../../src/ui/userHub/UserHubSessions";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { Session } from "../../../src/domain/session/types";
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

function makeDeps(state: UserHubState, eventBus?: IEventBus): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus: eventBus ?? new EventBus(),
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
			rerunSession: vi.fn(async () => makeSession({ id: "rerun-1", title: "Rerun Session", status: "prepared" })),
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
	};
}

describe("UserHubSessions", () => {
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	// ── renderMaster ────────────────────────────────────────

	describe("renderMaster", () => {
		it("should render empty state when no sessions", () => {
			const state = makeState();
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			expect(masterEl.textContent).toContain("No sessions yet");
		});

		it("should render session rows", () => {
			const sessions = [
				makeSession({ id: "s1", title: "Session A" }),
				makeSession({ id: "s2", title: "Session B" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(2);
			expect(masterEl.textContent).toContain("Session A");
			expect(masterEl.textContent).toContain("Session B");
		});

		it("should filter sessions by title", () => {
			const sessions = [
				makeSession({ id: "s1", title: "Event Storming Sprint" }),
				makeSession({ id: "s2", title: "Service Design Review" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("event");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(1);
			expect(masterEl.textContent).toContain("Event Storming Sprint");
			expect(masterEl.textContent).not.toContain("Service Design Review");
		});

		it("should show empty state when filter matches nothing", () => {
			const sessions = [makeSession({ title: "Hello" })];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("zzz-no-match");

			expect(masterEl.textContent).toContain("No sessions yet");
		});

		it("should highlight active session with accent border", () => {
			const sessions = [
				makeSession({ id: "s1", status: "active", startedAt: new Date().toISOString() }),
				makeSession({ id: "s2", status: "prepared" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			// Active session is in its own category first
			expect((rows[0] as HTMLElement).style.borderLeft).toContain("var(--interactive-accent)");
			expect((rows[1] as HTMLElement).style.borderLeft).not.toContain("var(--interactive-accent)");
		});

		it("should add margin-bottom to list rows to prevent border clipping", () => {
			const sessions = [makeSession({ id: "s1" })];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			expect(row.style.marginBottom).toBe("2px");
		});

		it("should render active category before prepared category", () => {
			const sessions = [
				makeSession({ id: "s1", title: "Prepared One", status: "prepared" }),
				makeSession({ id: "s2", title: "Active One", status: "active", startedAt: new Date().toISOString() }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows[0].textContent).toContain("Active One");
			expect(rows[1].textContent).toContain("Prepared One");
		});

		it("should highlight selected session row", () => {
			const session = makeSession({ id: "s1", title: "Selected" });
			const sessions = [session, makeSession({ id: "s2", title: "Other" })];
			const state = makeState(sessions, session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect((rows[0] as HTMLElement).classList.contains("ft-catalog-row-active")).toBe(true);
			expect((rows[1] as HTMLElement).classList.contains("ft-catalog-row-active")).toBe(false);
		});

		it("should set selectedSession and scheduleRender on click", () => {
			const session = makeSession();
			const state = makeState([session]);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			row.click();

			expect(state.selectedSession).toBe(session);
			expect(deps.scheduleRender).toHaveBeenCalled();
		});

		it("should deselect session when clicking already-selected row", () => {
			const session = makeSession();
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			row.click();

			expect(state.selectedSession).toBeNull();
			expect(deps.scheduleRender).toHaveBeenCalled();
		});

		it("should show session count in header", () => {
			const sessions = [
				makeSession({ id: "s1" }),
				makeSession({ id: "s2" }),
				makeSession({ id: "s3" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			expect(masterEl.textContent).toContain("3 sessions");
		});

		it("should show active count in header when active sessions exist", () => {
			const sessions = [
				makeSession({ id: "s1", status: "active", startedAt: new Date().toISOString() }),
				makeSession({ id: "s2", status: "prepared" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			expect(masterEl.textContent).toContain("1 active");
		});

		it("should show type badge on rows", () => {
			const sessions = [makeSession({ type: "service-design" })];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			expect(masterEl.textContent).toContain("Service Design");
		});

		it("should disambiguate same-titled sessions with creation date", () => {
			const sessions = [
				makeSession({ id: "s1", title: "Design Session", createdAt: new Date("2026-02-16T09:00:00").toISOString() }),
				makeSession({ id: "s2", title: "Design Session", createdAt: new Date("2026-02-16T14:30:00").toISOString() }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			// Both rows rendered with date hints for disambiguation
			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(2);
			expect(rows[0].textContent).toContain("09:00");
			expect(rows[1].textContent).toContain("14:30");
		});
	});

	// ── Collapsible categories ────────────────────────────────

	describe("collapsible categories", () => {
		it("should render category headers for each status group", () => {
			const sessions = [
				makeSession({ id: "s1", status: "active", startedAt: new Date().toISOString() }),
				makeSession({ id: "s2", status: "prepared" }),
				makeSession({ id: "s3", status: "completed", completedAt: new Date().toISOString() }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const headers = masterEl.querySelectorAll(".ft-session-category-header");
			expect(headers).toHaveLength(3);
			expect(headers[0].textContent).toContain("Active (1)");
			expect(headers[1].textContent).toContain("Ready (1)");
			expect(headers[2].textContent).toContain("Completed (1)");
		});

		it("should not render categories for statuses with no sessions", () => {
			const sessions = [makeSession({ id: "s1", status: "prepared" })];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const headers = masterEl.querySelectorAll(".ft-session-category-header");
			expect(headers).toHaveLength(1);
			expect(headers[0].textContent).toContain("Ready (1)");
		});

		it("should collapse completed and archived categories by default", () => {
			const sessions = [
				makeSession({ id: "s1", status: "prepared" }),
				makeSession({ id: "s2", status: "completed", completedAt: new Date().toISOString() }),
				makeSession({ id: "s3", status: "archived" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const categories = masterEl.querySelectorAll(".ft-session-category");
			// prepared (expanded), completed (collapsed), archived (collapsed)
			const preparedContent = categories[0].querySelector(".ft-session-category-content") as HTMLElement;
			const completedContent = categories[1].querySelector(".ft-session-category-content") as HTMLElement;
			const archivedContent = categories[2].querySelector(".ft-session-category-content") as HTMLElement;
			expect(preparedContent.style.display).not.toBe("none");
			expect(completedContent.style.display).toBe("none");
			expect(archivedContent.style.display).toBe("none");
		});

		it("should hide rows in collapsed archived category", () => {
			const sessions = [
				makeSession({ id: "s1", title: "Active Session", status: "active", startedAt: new Date().toISOString() }),
				makeSession({ id: "s2", title: "Archived Session", status: "archived" }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			// Active row is visible
			const activeContent = masterEl.querySelectorAll(".ft-session-category-content")[0] as HTMLElement;
			expect(activeContent.style.display).not.toBe("none");
			expect(activeContent.textContent).toContain("Active Session");

			// Archived rows exist but are hidden
			const archivedContent = masterEl.querySelectorAll(".ft-session-category-content")[1] as HTMLElement;
			expect(archivedContent.style.display).toBe("none");
			expect(archivedContent.textContent).toContain("Archived Session");
		});

		it("should toggle category collapse on header click", () => {
			const sessions = [makeSession({ id: "s1", status: "prepared" })];
			const state = makeState(sessions);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			// Initially expanded
			let content = masterEl.querySelector(".ft-session-category-content") as HTMLElement;
			expect(content.style.display).not.toBe("none");

			// Click header to collapse
			const header = masterEl.querySelector(".ft-session-category-header") as HTMLElement;
			header.click();

			expect(deps.scheduleRender).toHaveBeenCalled();

			// Re-render to apply collapse
			comp.renderMaster("");
			content = masterEl.querySelector(".ft-session-category-content") as HTMLElement;
			expect(content.style.display).toBe("none");
		});

		it("should expand collapsed category on header click", () => {
			const sessions = [makeSession({ id: "s1", status: "archived" })];
			const state = makeState(sessions);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			// Initially collapsed (archived)
			let content = masterEl.querySelector(".ft-session-category-content") as HTMLElement;
			expect(content.style.display).toBe("none");

			// Click header to expand
			const header = masterEl.querySelector(".ft-session-category-header") as HTMLElement;
			header.click();

			// Re-render
			comp.renderMaster("");
			content = masterEl.querySelector(".ft-session-category-content") as HTMLElement;
			expect(content.style.display).not.toBe("none");
		});

		it("should show correct count per category", () => {
			const sessions = [
				makeSession({ id: "s1", status: "prepared" }),
				makeSession({ id: "s2", status: "prepared" }),
				makeSession({ id: "s3", status: "completed", completedAt: new Date().toISOString() }),
			];
			const state = makeState(sessions);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderMaster("");

			const headers = masterEl.querySelectorAll(".ft-session-category-header");
			expect(headers[0].textContent).toContain("Ready (2)");
			expect(headers[1].textContent).toContain("Completed (1)");
		});

		it("should preserve collapse state across re-renders", () => {
			const sessions = [
				makeSession({ id: "s1", status: "active", startedAt: new Date().toISOString() }),
				makeSession({ id: "s2", status: "prepared" }),
			];
			const state = makeState(sessions);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			// Collapse "active"
			const activeHeader = masterEl.querySelectorAll(".ft-session-category-header")[0] as HTMLElement;
			activeHeader.click();

			// Re-render
			comp.renderMaster("");

			// Active is now collapsed, prepared still expanded
			const contents = masterEl.querySelectorAll(".ft-session-category-content");
			expect((contents[0] as HTMLElement).style.display).toBe("none");
			expect((contents[1] as HTMLElement).style.display).not.toBe("none");
		});
	});

	// ── renderDetail ────────────────────────────────────────

	describe("renderDetail", () => {
		it("should render placeholder when no session selected", () => {
			const state = makeState();
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Select a session to view details");
		});

		it("should show session title and status in header", () => {
			const session = makeSession({ title: "My Sprint", status: "prepared" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("My Sprint");
			expect(detailEl.textContent).toContain("Ready");
		});

		it("should show session type badge", () => {
			const session = makeSession({ type: "knowledge-cleanup" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Cleanup");
		});

		it("should show timer section for active sessions", () => {
			const session = makeSession({
				status: "active",
				startedAt: new Date().toISOString(),
				durationMinutes: 25,
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.querySelector(".ft-session-timer")).toBeTruthy();
			expect(detailEl.textContent).toContain("Time Remaining");
		});

		it("should show timer section for paused sessions", () => {
			const session = makeSession({
				status: "paused",
				pausedAt: new Date().toISOString(),
				elapsedBeforePauseMs: 60_000,
				durationMinutes: 25,
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.querySelector(".ft-session-timer")).toBeTruthy();
			expect(detailEl.textContent).toContain("Paused");
		});

		it("should not show timer section for completed sessions", () => {
			const session = makeSession({ status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.querySelector(".ft-session-timer")).toBeNull();
		});

		it("should show info section with duration and elapsed", () => {
			const session = makeSession({ durationMinutes: 50 });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("50 min");
			expect(detailEl.textContent).toContain("Duration");
			expect(detailEl.textContent).toContain("Elapsed");
		});

		it("should show completed date when session is completed", () => {
			const completedAt = new Date("2026-02-16T12:00:00").toISOString();
			const session = makeSession({ status: "completed", completedAt });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Completed");
		});

		it("should show artifacts when present", () => {
			const session = makeSession({
				artifacts: [
					{ path: "docs/Events/user.created.md", action: "created", timestamp: new Date().toISOString() },
					{ path: "docs/Services/AuthService.md", action: "modified", timestamp: new Date().toISOString() },
				],
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Artifacts (2)");
			expect(detailEl.textContent).toContain("user.created.md");
			expect(detailEl.textContent).toContain("AuthService.md");
		});

		it("should render artifact names as clickable links", () => {
			const session = makeSession({
				artifacts: [
					{ path: "docs/Events/user.created.md", action: "created", timestamp: new Date().toISOString() },
				],
			});
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const link = detailEl.querySelector(".ft-artifact-link") as HTMLAnchorElement;
			expect(link).not.toBeNull();
			expect(link.textContent).toBe("user.created.md");
			link.click();
			expect(deps.openFile).toHaveBeenCalledWith("docs/Events/user.created.md");
		});

		it("should not show artifacts section when empty", () => {
			const session = makeSession({ artifacts: [] });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).not.toContain("Artifacts");
		});

		// ── Action buttons per status ─────────────────────────

		it("should show Workspace, Start and Delete buttons for prepared sessions when no active session", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Workspace");
			expect(labels).toContain("Start");
			expect(labels).toContain("Delete");
			expect(labels).not.toContain("Pause");
		});

		it("should hide Start button for prepared sessions when another session is active", () => {
			const active = makeSession({ id: "active-1", status: "active", startedAt: new Date().toISOString() });
			const prepared = makeSession({ id: "prep-1", status: "prepared" });
			const state = makeState([active, prepared], prepared);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).not.toContain("Start");
			expect(labels).toContain("Delete");
		});

		it("should show Workspace, Pause and Complete buttons for active sessions", () => {
			const session = makeSession({ status: "active", startedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Workspace");
			expect(labels).toContain("Pause");
			expect(labels).toContain("Complete");
			expect(labels).not.toContain("Start");
		});

		it("should show Workspace, Resume and Complete buttons for paused sessions", () => {
			const session = makeSession({ status: "paused", pausedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Workspace");
			expect(labels).toContain("Resume");
			expect(labels).toContain("Complete");
		});

		it("should call openSessionWorkspace with session ID when Workspace is clicked on active session", () => {
			const session = makeSession({ status: "active", startedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const wsBtn = buttons.find((b) => b.textContent?.includes("Workspace"));
			wsBtn!.click();

			expect(deps.openSessionWorkspace).toHaveBeenCalledWith(session.id);
		});

		it("should call openSessionWorkspace with session ID when Workspace is clicked on paused session", () => {
			const session = makeSession({ status: "paused", pausedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const wsBtn = buttons.find((b) => b.textContent?.includes("Workspace"));
			wsBtn!.click();

			expect(deps.openSessionWorkspace).toHaveBeenCalledWith(session.id);
		});

		it("should call openSessionWorkspace with session ID when Workspace is clicked on prepared session", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const wsBtn = buttons.find((b) => b.textContent?.includes("Workspace"));
			wsBtn!.click();

			expect(deps.openSessionWorkspace).toHaveBeenCalledWith(session.id);
		});

		it("should show Workspace button for prepared sessions", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Workspace");
		});

		it("should not show Workspace button for completed sessions", () => {
			const session = makeSession({ status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).not.toContain("Workspace");
		});

		it("should show Rerun, Save as Template, Archive, and Delete buttons for completed sessions", () => {
			const session = makeSession({ status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Rerun");
			expect(labels).toContain("Save as Template");
			expect(labels).toContain("Archive");
			expect(labels).toContain("Delete");
		});

		it("should show Rerun, Save as Template, and Delete buttons for archived sessions", () => {
			const session = makeSession({ status: "archived" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Rerun");
			expect(labels).toContain("Save as Template");
			expect(labels).toContain("Delete");
		});

		it("should emit session.start and open workspace when Start is clicked", async () => {
			const eventBus = new EventBus();
			const spy = vi.fn();
			eventBus.on("session.start", spy);

			const session = makeSession({ id: "s1", status: "prepared" });
			const state = makeState([session], session);
			const deps = makeDeps(state, eventBus);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const startBtn = buttons.find((b) => b.textContent?.includes("Start"));
			startBtn!.click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s1" },
			}));
			expect(deps.openSessionWorkspace).toHaveBeenCalledWith("s1");
		});

		it("should emit session.pause when Pause is clicked", async () => {
			const eventBus = new EventBus();
			const spy = vi.fn();
			eventBus.on("session.pause", spy);

			const session = makeSession({ id: "s2", status: "active", startedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, eventBus));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const pauseBtn = buttons.find((b) => b.textContent?.includes("Pause"));
			pauseBtn!.click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s2" },
			}));
		});

		it("should emit session.delete when Delete is clicked", async () => {
			const eventBus = new EventBus();
			const spy = vi.fn();
			eventBus.on("session.delete", spy);

			const session = makeSession({ id: "s3", status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, eventBus));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const deleteBtn = buttons.find((b) => b.textContent?.includes("Delete"));
			deleteBtn!.click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s3" },
			}));
		});
	});

	// ── New Session button ──────────────────────────────────

	describe("new session button", () => {
		it("should show New Session button in empty state", () => {
			const state = makeState();
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const newBtn = buttons.find((b) => b.textContent?.includes("New Session"));
			expect(newBtn).toBeTruthy();
		});

		it("should call openNewSessionModal when empty state button is clicked", () => {
			const state = makeState();
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const newBtn = buttons.find((b) => b.textContent?.includes("New Session"));
			newBtn!.click();

			expect(deps.openNewSessionModal).toHaveBeenCalled();
		});

		it("should show New button in header when sessions exist", () => {
			const sessions = [makeSession({ id: "s1" })];
			const state = makeState(sessions);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const newBtn = buttons.find((b) => b.textContent?.includes("New"));
			expect(newBtn).toBeTruthy();
		});

		it("should call openNewSessionModal when header New button is clicked", () => {
			const sessions = [makeSession({ id: "s1" })];
			const state = makeState(sessions);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const newBtn = buttons.find((b) => b.textContent?.includes("New"));
			newBtn!.click();

			expect(deps.openNewSessionModal).toHaveBeenCalled();
		});
	});

	// ── Rerun & Save as Template ────────────────────────────

	describe("rerun and save as template", () => {
		it("should call rerunSession when Rerun is clicked on completed session", () => {
			const session = makeSession({ id: "s1", status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const rerunBtn = buttons.find((b) => b.textContent?.includes("Rerun"));
			rerunBtn!.click();

			expect(deps.sessionService.rerunSession).toHaveBeenCalledWith("s1");
		});

		it("should select the new session after Rerun", async () => {
			const session = makeSession({ id: "s1", status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const rerunBtn = buttons.find((b) => b.textContent?.includes("Rerun"));
			rerunBtn!.click();

			// Wait for the async .then() to resolve
			await new Promise((r) => setTimeout(r, 10));

			expect(state.selectedSession).toEqual(
				expect.objectContaining({ id: "rerun-1", title: "Rerun Session" }),
			);
			expect(deps.scheduleRender).toHaveBeenCalled();
		});

		it("should call openSaveTemplateModal when Save as Template is clicked", () => {
			const session = makeSession({ id: "s2", status: "completed", completedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const saveBtn = buttons.find((b) => b.textContent?.includes("Save as Template"));
			saveBtn!.click();

			expect(deps.openSaveTemplateModal).toHaveBeenCalledWith(session);
		});

		it("should show Rerun button for archived sessions", () => {
			const session = makeSession({ id: "s3", status: "archived" });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const rerunBtn = buttons.find((b) => b.textContent?.includes("Rerun"));
			expect(rerunBtn).toBeTruthy();
			rerunBtn!.click();
			expect(deps.sessionService.rerunSession).toHaveBeenCalledWith("s3");
		});

		it("should not show Rerun for prepared sessions", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).not.toContain("Rerun");
			expect(labels).toContain("Save as Template");
		});

		it("should not show Rerun for active sessions", () => {
			const session = makeSession({ status: "active", startedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).not.toContain("Rerun");
			expect(labels).toContain("Save as Template");
		});
	});

	// ── Template list in detail ─────────────────────────────

	describe("template list in detail panel", () => {
		it("should show template list when no session selected and templates exist", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "Sprint Storming", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
				{ id: "t2", name: "Design Review", type: "service-design", durationMinutes: 50, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Saved Templates");
			expect(detailEl.textContent).toContain("Sprint Storming");
			expect(detailEl.textContent).toContain("Design Review");
		});

		it("should show placeholder when no session selected and no templates", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Select a session to view details");
		});

		it("should show type badge and duration on template rows", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "service-design", durationMinutes: 50, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Service Design");
			expect(detailEl.textContent).toContain("50 min");
		});

		it("should have export and delete buttons on template rows", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			// Import button in header + export + delete per row
			const rowButtons = Array.from(detailEl.querySelectorAll(".ft-catalog-row button"));
			expect(rowButtons).toHaveLength(2); // export + delete
		});

		it("should create session from template when template row is clicked", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "Sprint Storming", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const rows = Array.from(detailEl.querySelectorAll(".ft-catalog-row"));
			expect(rows).toHaveLength(1);
			(rows[0] as HTMLElement).click();

			expect(deps.sessionService.createFromTemplate).toHaveBeenCalledWith("t1");
		});

		it("should show hint text about clicking templates", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Click a template to start a new session");
		});

		it("should not trigger createFromTemplate when delete button is clicked", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const rowButtons = Array.from(detailEl.querySelectorAll(".ft-catalog-row button"));
			const deleteBtn = rowButtons[rowButtons.length - 1] as HTMLElement; // last button is delete
			deleteBtn.click();

			expect(deps.sessionService.createFromTemplate).not.toHaveBeenCalled();
		});

		it("should show Import button in template list header", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const importBtn = buttons.find((b) => b.textContent?.includes("Import"));
			expect(importBtn).toBeTruthy();
		});

		it("should call importTemplateFromFile when Import button is clicked", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const importBtn = buttons.find((b) => b.textContent?.includes("Import"));
			importBtn!.click();

			expect(deps.importTemplateFromFile).toHaveBeenCalled();
		});

		it("should call exportTemplateAsFile when export button is clicked on template row", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const rowButtons = Array.from(detailEl.querySelectorAll(".ft-catalog-row button"));
			const exportBtn = rowButtons[0] as HTMLElement; // first button in row is export
			exportBtn.click();

			expect(deps.exportTemplateAsFile).toHaveBeenCalledWith("t1");
			expect(deps.sessionService.createFromTemplate).not.toHaveBeenCalled();
		});

		it("should show Import Template button in empty state", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const importBtn = buttons.find((b) => b.textContent?.includes("Import Template"));
			expect(importBtn).toBeTruthy();
		});

		it("should call importTemplateFromFile when empty state Import button is clicked", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const importBtn = buttons.find((b) => b.textContent?.includes("Import Template"));
			importBtn!.click();

			expect(deps.importTemplateFromFile).toHaveBeenCalled();
		});
	});

	// ── updateTimerDisplay ──────────────────────────────────

	describe("updateTimerDisplay", () => {
		it("should update the timer element directly", () => {
			const session = makeSession({
				status: "active",
				startedAt: new Date().toISOString(),
				durationMinutes: 25,
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			// Render detail to create the timer element
			comp.renderDetail();

			const timerEl = detailEl.querySelector(".ft-session-timer");
			expect(timerEl).toBeTruthy();

			// Update timer display
			comp.updateTimerDisplay(5 * 60 * 1000); // 5 minutes

			expect(timerEl!.textContent).toBe("05:00");
		});

		it("should be a no-op when no timer element exists", () => {
			const state = makeState();
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			// Should not throw
			comp.updateTimerDisplay(1000);
		});
	});

	// ── Focus file display ─────────────────────────────────

	describe("focus file display", () => {
		it("should show focus file link in detail panel when set", () => {
			const session = makeSession({ focusFile: "docs/features/Hubs PRD.md" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Focus");
			expect(detailEl.textContent).toContain("Hubs PRD.md");
		});

		it("should not show focus file when null", () => {
			const session = makeSession({ focusFile: null });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			// "Focus" appears nowhere in detail (except header if it had "Focus" in title)
			const focusLinks = detailEl.querySelectorAll("a.ft-link");
			expect(focusLinks).toHaveLength(0);
		});

		it("should call openFile when focus file link is clicked", () => {
			const session = makeSession({ focusFile: "docs/services.md" });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const link = detailEl.querySelector("a.ft-link") as HTMLElement;
			expect(link).toBeTruthy();
			link.click();

			expect(deps.openFile).toHaveBeenCalledWith("docs/services.md");
		});
	});

	// ── Timeline & Time Breakdown ─────────────────────────────

	describe("timeline and time breakdown display", () => {
		it("should not show Time Breakdown when timeline is empty", () => {
			const session = makeSession({ status: "completed", timeline: [] });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.querySelector(".ft-time-breakdown")).toBeNull();
		});

		it("should show Time Breakdown when timeline has entries", () => {
			const session = makeSession({
				status: "completed",
				completedAt: "2026-02-16T10:30:00.000Z",
				timeline: [
					{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
					{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
					{ action: "resumed", timestamp: "2026-02-16T10:15:00.000Z" },
					{ action: "completed", timestamp: "2026-02-16T10:30:00.000Z" },
				],
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const section = detailEl.querySelector(".ft-time-breakdown");
			expect(section).toBeTruthy();
			expect(section!.textContent).toContain("Wall Clock");
			expect(section!.textContent).toContain("Active");
			expect(section!.textContent).toContain("Paused");
			expect(section!.textContent).toContain("Pauses");
		});

		it("should not show Pauses count when zero pauses", () => {
			const session = makeSession({
				status: "completed",
				completedAt: "2026-02-16T10:25:00.000Z",
				timeline: [
					{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
					{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
				],
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const section = detailEl.querySelector(".ft-time-breakdown");
			expect(section).toBeTruthy();
			expect(section!.textContent).not.toContain("Pauses");
		});

		it("should not show Timeline section when timeline is empty", () => {
			const session = makeSession({ status: "completed", timeline: [] });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.querySelector(".ft-session-timeline")).toBeNull();
		});

		it("should show Timeline section with correct entry count", () => {
			const session = makeSession({
				status: "completed",
				completedAt: "2026-02-16T10:30:00.000Z",
				timeline: [
					{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
					{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
					{ action: "resumed", timestamp: "2026-02-16T10:15:00.000Z" },
					{ action: "completed", timestamp: "2026-02-16T10:30:00.000Z" },
				],
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const section = detailEl.querySelector(".ft-session-timeline");
			expect(section).toBeTruthy();
			expect(section!.textContent).toContain("Timeline (4)");
		});

		it("should render timeline after artifacts (last section)", () => {
			const session = makeSession({
				status: "completed",
				completedAt: "2026-02-16T10:30:00.000Z",
				artifacts: [{ path: "docs/test.md", action: "created", timestamp: "2026-02-16T10:05:00.000Z" }],
				timeline: [
					{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
					{ action: "completed", timestamp: "2026-02-16T10:30:00.000Z" },
				],
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const sections = Array.from(detailEl.querySelectorAll(".ft-detail-section"));
			const timelineIdx = sections.findIndex((s) => s.classList.contains("ft-session-timeline"));
			expect(timelineIdx).toBe(sections.length - 1);
		});

		it("should render timeline action labels", () => {
			const session = makeSession({
				status: "completed",
				completedAt: "2026-02-16T10:25:00.000Z",
				timeline: [
					{ action: "started", timestamp: "2026-02-16T10:00:00.000Z" },
					{ action: "paused", timestamp: "2026-02-16T10:10:00.000Z" },
					{ action: "resumed", timestamp: "2026-02-16T10:12:00.000Z" },
					{ action: "completed", timestamp: "2026-02-16T10:25:00.000Z" },
				],
			});
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const section = detailEl.querySelector(".ft-session-timeline");
			expect(section!.textContent).toContain("Started");
			expect(section!.textContent).toContain("Paused");
			expect(section!.textContent).toContain("Resumed");
			expect(section!.textContent).toContain("Completed");
		});
	});

	// ── Save as Template for all statuses ────────────────

	describe("save as template", () => {
		it("should show Save as Template button for prepared sessions", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			expect(buttons.some((b) => b.textContent?.includes("Save as Template"))).toBe(true);
		});

		it("should show Save as Template button for active sessions", () => {
			const session = makeSession({
				id: "active-1",
				status: "active",
				startedAt: new Date().toISOString(),
			});
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			expect(buttons.some((b) => b.textContent?.includes("Save as Template"))).toBe(true);
		});

		it("should show Save as Template button for paused sessions", () => {
			const session = makeSession({
				id: "paused-1",
				status: "paused",
				pausedAt: new Date().toISOString(),
				elapsedBeforePauseMs: 60000,
			});
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			expect(buttons.some((b) => b.textContent?.includes("Save as Template"))).toBe(true);
		});
	});

	// ── Links section ────────────────────────────────────

	describe("links section", () => {
		it("should render links section when session has links", () => {
			const session = makeSession({
				links: [
					{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" },
					{ path: "docs/services.md", addedAt: "2026-02-16T10:01:00.000Z" },
				],
			});
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			expect(detailEl.textContent).toContain("Links (2)");
			expect(detailEl.textContent).toContain("events.md");
			expect(detailEl.textContent).toContain("services.md");
		});

		it("should not render links section when session has no links", () => {
			const session = makeSession({ links: [] });
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			expect(detailEl.textContent).not.toContain("Links (");
		});

		it("should open file when clicking a link", () => {
			const session = makeSession({
				links: [{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" }],
			});
			const state = makeState([session], session);
			const deps = makeDeps(state);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const linkEl = detailEl.querySelector("a.ft-link") as HTMLAnchorElement;
			expect(linkEl).not.toBeNull();
			linkEl!.click();
			expect(deps.openFile).toHaveBeenCalledWith("docs/events.md");
		});
	});
});
