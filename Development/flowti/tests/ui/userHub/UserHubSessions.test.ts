// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { UserHubSessions } from "../../../src/ui/userHub/UserHubSessions";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { Session } from "../../../src/domain/session/types";
import type { UUID } from "../../../src/utils/types";

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
		...overrides,
	};
}

function makeState(sessions: Session[] = [], selectedSession: Session | null = null): UserHubState {
	const active = sessions.find((s) => s.status === "active") ?? null;
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: [],
		sessions,
		activeSession: active,
		selectedSession,
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
		openSaveTemplateModal: vi.fn(),
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
			// Active session is sorted first
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

		it("should sort active sessions first", () => {
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
			// Both sorted as "prepared", so same order
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

		it("should not show artifacts section when empty", () => {
			const session = makeSession({ artifacts: [] });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			expect(detailEl.textContent).not.toContain("Artifacts");
		});

		// ── Action buttons per status ─────────────────────────

		it("should show Start and Delete buttons for prepared sessions when no active session", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
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

		it("should show Pause and Complete buttons for active sessions", () => {
			const session = makeSession({ status: "active", startedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Pause");
			expect(labels).toContain("Complete");
			expect(labels).not.toContain("Start");
		});

		it("should show Resume and Complete buttons for paused sessions", () => {
			const session = makeSession({ status: "paused", pausedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).toContain("Resume");
			expect(labels).toContain("Complete");
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

		it("should emit session.start when Start is clicked", async () => {
			const eventBus = new EventBus();
			const spy = vi.fn();
			eventBus.on("session.start", spy);

			const session = makeSession({ id: "s1", status: "prepared" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state, eventBus));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const startBtn = buttons.find((b) => b.textContent?.includes("Start"));
			startBtn!.click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s1" },
			}));
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

		it("should not show Rerun/Save for prepared sessions", () => {
			const session = makeSession({ status: "prepared" });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).not.toContain("Rerun");
			expect(labels).not.toContain("Save as Template");
		});

		it("should not show Rerun/Save for active sessions", () => {
			const session = makeSession({ status: "active", startedAt: new Date().toISOString() });
			const state = makeState([session], session);
			const comp = new UserHubSessions(masterEl, detailEl, makeDeps(state));

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const labels = buttons.map((b) => b.textContent?.trim());
			expect(labels).not.toContain("Rerun");
			expect(labels).not.toContain("Save as Template");
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

		it("should have delete button on template rows", () => {
			const state = makeState();
			const deps = makeDeps(state);
			(deps.sessionService.getSavedTemplates as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", name: "T1", type: "event-storming", durationMinutes: 25, createdAt: Date.now() },
			]);
			const comp = new UserHubSessions(masterEl, detailEl, deps);

			comp.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			expect(buttons).toHaveLength(1); // delete button
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
});
