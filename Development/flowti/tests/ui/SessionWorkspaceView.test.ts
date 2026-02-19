// @vitest-environment happy-dom
import "../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import { SessionWorkspaceView, VIEW_TYPE_SESSION_WORKSPACE } from "../../src/ui/SessionWorkspaceView";
import type { IEventBus } from "../../src/infrastructure/events/types";
import type { Session, SessionGoal } from "../../src/domain/session/types";

// ── Helpers ──────────────────────────────────────────────────

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "active",
		durationMinutes: 25,
		createdAt: new Date("2026-02-16T10:00:00").toISOString(),
		startedAt: new Date("2026-02-16T10:00:00").toISOString(),
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: null,
		timeline: [{ action: "started", timestamp: new Date("2026-02-16T10:00:00").toISOString() }],
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

function makeGoal(overrides?: Partial<SessionGoal>): SessionGoal {
	return {
		id: "goal-1",
		text: "Review types.ts",
		completed: false,
		completedAt: null,
		...overrides,
	};
}

function createMockSessionService(session: Session | null) {
	return {
		getActiveSession: vi.fn(() => (session?.status === "active" || session?.status === "running") ? session : null),
		getSessionById: vi.fn((id: string) => session?.id === id ? session : null),
		getSessions: vi.fn(() => session ? [session] : []),
		getSavedTemplates: vi.fn(() => []),
		workspaceSessionId: session?.id ?? null,
		updateActivityFilter: vi.fn(),
	};
}

type MockSessionService = ReturnType<typeof createMockSessionService>;

function createView(eventBus: IEventBus, activeSession: Session | null): { view: SessionWorkspaceView; service: MockSessionService } {
	const service = createMockSessionService(activeSession);
	const mainRoot = {};
	const leaf = { parent: { children: [] as unknown[] }, getRoot: () => mainRoot } as never;
	const view = new SessionWorkspaceView(leaf, eventBus, service as never);
	// Stub ItemView doesn't store leaf — set it manually so openInAdjacentLeaf works
	(view as unknown as { leaf: unknown }).leaf = leaf;

	// Set up containerEl with Obsidian's expected children structure:
	// children[0] = header bar, children[1] = content area
	const containerEl = document.createElement("div");
	containerEl.appendChild(document.createElement("div")); // header
	containerEl.appendChild(document.createElement("div")); // content
	(view as unknown as { containerEl: HTMLElement }).containerEl = containerEl;

	// Mock split leaf returned by getLeaf("split")
	const splitLeaf = { parent: {} } as never;

	// Mock app for workspace interactions
	const rightSplit = {};
	(view as unknown as { app: Record<string, unknown> }).app = {
		workspace: {
			openLinkText: vi.fn().mockResolvedValue(undefined),
			setActiveLeaf: vi.fn(),
			getLeaf: vi.fn(() => splitLeaf),
			getLeavesOfType: vi.fn(() => []),
			getRightLeaf: vi.fn(() => splitLeaf),
			revealLeaf: vi.fn(),
			rightSplit,
		},
	};

	return { view, service };
}

function getContentEl(view: SessionWorkspaceView): HTMLElement {
	return (view as unknown as { containerEl: HTMLElement }).containerEl.children[1] as HTMLElement;
}

// ── Tests ─────────────────────────────────────────────────────

describe("SessionWorkspaceView", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("view metadata", () => {
		it("returns correct view type", () => {
			const { view } = createView(eventBus, null);
			expect(view.getViewType()).toBe(VIEW_TYPE_SESSION_WORKSPACE);
			expect(view.getViewType()).toBe("flowti-session-workspace");
		});

		it("returns session title as display text when active", async () => {
			const session = makeSession({ title: "Sprint Review" });
			const { view } = createView(eventBus, session);
			await view.onOpen();
			expect(view.getDisplayText()).toBe("Session: Sprint Review");
		});

		it("returns default display text when no session", () => {
			const { view } = createView(eventBus, null);
			expect(view.getDisplayText()).toBe("Session Workspace");
		});

		it("returns timer icon", () => {
			const { view } = createView(eventBus, null);
			expect(view.getIcon()).toBe("timer");
		});

	});

	describe("empty state", () => {
		it("renders empty state when no active session", async () => {
			const { view } = createView(eventBus, null);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-empty")).not.toBeNull();
			expect(content.textContent).toContain("No session selected");
		});
	});

	describe("header rendering", () => {
		it("renders header with title, type badge, and status badge", async () => {
			const session = makeSession({ title: "Sprint Planning", type: "event-storming" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const header = content.querySelector(".ft-session-workspace-header");
			expect(header).not.toBeNull();
			expect(header!.textContent).toContain("Sprint Planning");
			expect(header!.textContent).toContain("Event Storming");
			expect(header!.textContent).toContain("Active");
		});

		it("renders Pause and Complete buttons for active session", async () => {
			const session = makeSession({ status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).toContain("Pause");
			expect(labels).toContain("Complete");
		});

		it("renders Resume and Complete buttons for paused session", async () => {
			const session = makeSession({ status: "paused", startedAt: null, pausedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).toContain("Resume");
			expect(labels).toContain("Complete");
		});

		it("renders Start button for prepared session", async () => {
			const session = makeSession({ status: "prepared", startedAt: null });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).toContain("Start");
		});

		it("Pause button emits session.pause", async () => {
			const session = makeSession({ status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.pause", handler);

			const content = getContentEl(view);
			const pauseBtn = Array.from(content.querySelectorAll("button"))
				.find((b) => b.textContent?.includes("Pause"));
			pauseBtn?.click();

			// Allow promise to settle
			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1" },
			}));
		});

		it("Complete button emits session.complete", async () => {
			const session = makeSession({ status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.complete", handler);

			const content = getContentEl(view);
			const completeBtn = Array.from(content.querySelectorAll("button"))
				.find((b) => b.textContent?.includes("Complete"));
			completeBtn?.click();

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1" },
			}));
		});
	});

	describe("timer", () => {
		it("renders timer with computed remaining time", async () => {
			// startedAt = now so elapsed ≈ 0, remaining ≈ 25:00
			const session = makeSession({ durationMinutes: 25, startedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const timer = content.querySelector(".ft-timer-display");
			expect(timer).not.toBeNull();
			expect(timer!.textContent).toBe("25:00");
		});

		it("timer tick updates display without full re-render", async () => {
			const session = makeSession({ durationMinutes: 25, startedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const timer = content.querySelector(".ft-timer-display")!;

			// Emit tick with 24:30 remaining
			await eventBus.emit("session.timer.tick", {
				sessionId: "session-1",
				remainingMs: 24 * 60_000 + 30_000,
				elapsedMs: 30_000,
			});

			expect(timer.textContent).toBe("24:30");
			// Verify the header still exists (wasn't re-rendered)
			expect(content.querySelector(".ft-session-workspace-header")).not.toBeNull();
		});

		it("ignores timer tick for different session", async () => {
			const session = makeSession({ durationMinutes: 25, startedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const timer = content.querySelector(".ft-timer-display")!;
			const originalText = timer.textContent;

			await eventBus.emit("session.timer.tick", {
				sessionId: "other-session",
				remainingMs: 10_000,
				elapsedMs: 0,
			});

			expect(timer.textContent).toBe(originalText); // unchanged
		});

		it("shows editable duration input for prepared session", async () => {
			const session = makeSession({ status: "prepared", startedAt: null, durationMinutes: 25 });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const input = content.querySelector(".ft-duration-input") as HTMLInputElement;
			expect(input).not.toBeNull();
			expect(input.value).toBe("25");
		});

		it("does not show duration input for active session", async () => {
			const session = makeSession({ status: "active", durationMinutes: 25, startedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-duration-input")).toBeNull();
		});

		it("emits session.duration.update on input change", async () => {
			const session = makeSession({ status: "prepared", startedAt: null, durationMinutes: 25 });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.duration.update", handler);

			const content = getContentEl(view);
			const input = content.querySelector(".ft-duration-input") as HTMLInputElement;
			input.value = "45";
			input.dispatchEvent(new Event("change"));

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", durationMinutes: 45 },
			}));
		});

		it("re-renders on session.duration.updated", async () => {
			const session = makeSession({ status: "prepared", startedAt: null, durationMinutes: 25 });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({ status: "prepared", startedAt: null, durationMinutes: 45 });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.duration.updated", {
				sessionId: "session-1",
				durationMinutes: 45,
			});

			const content = getContentEl(view);
			const timer = content.querySelector(".ft-timer-display");
			expect(timer!.textContent).toBe("45:00");
		});
	});

	describe("goals", () => {
		it("renders goals checklist with checkboxes", async () => {
			const session = makeSession({
				goals: [
					makeGoal({ id: "g1", text: "Review types.ts" }),
					makeGoal({ id: "g2", text: "Update events.ts", completed: true }),
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const goals = content.querySelectorAll(".ft-goal-row");
			expect(goals).toHaveLength(2);

			const checkboxes = content.querySelectorAll(".ft-goal-row input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			expect(checkboxes[0].checked).toBe(false);
			expect(checkboxes[1].checked).toBe(true);
		});

		it("renders goal count", async () => {
			const session = makeSession({
				goals: [
					makeGoal({ id: "g1", completed: false }),
					makeGoal({ id: "g2", completed: true }),
					makeGoal({ id: "g3", completed: true }),
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.textContent).toContain("(2/3)");
		});

		it("checkbox toggle emits session.goal.toggle", async () => {
			const session = makeSession({
				goals: [makeGoal({ id: "g1", text: "Test goal" })],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.goal.toggle", handler);

			const content = getContentEl(view);
			const checkbox = content.querySelector(".ft-goal-row input[type='checkbox']") as HTMLInputElement;
			checkbox.dispatchEvent(new Event("change"));

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", goalId: "g1" },
			}));
		});

		it("add goal input emits session.goal.add on Enter", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.goal.add", handler);

			const content = getContentEl(view);
			const input = content.querySelector("input[type='text']") as HTMLInputElement;
			input.value = "New goal";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", text: "New goal" },
			}));
		});

		it("add goal input clears after submission", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const input = content.querySelector("input[type='text']") as HTMLInputElement;
			input.value = "New goal";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(input.value).toBe("");
		});

		it("remove goal button emits session.goal.remove", async () => {
			const session = makeSession({
				goals: [makeGoal({ id: "g1", text: "Remove me" })],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.goal.remove", handler);

			const content = getContentEl(view);
			const removeBtn = content.querySelector(".ft-goal-remove") as HTMLElement;
			removeBtn.click();

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", goalId: "g1" },
			}));
		});

		it("session.goal.added appends goal to list", async () => {
			const session = makeSession({ goals: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			// Simulate what SessionService does: mutate session then emit
			const newGoal = makeGoal({ id: "g-new", text: "New goal from event" });
			const updatedSession = makeSession({ goals: [newGoal] });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.goal.added", {
				sessionId: "session-1",
				goal: newGoal,
			});

			const content = getContentEl(view);
			const goals = content.querySelectorAll(".ft-goal-row");
			expect(goals).toHaveLength(1);
			expect(content.textContent).toContain("New goal from event");
		});

		it("session.goal.toggled updates checkbox state", async () => {
			const session = makeSession({
				goals: [makeGoal({ id: "g1", text: "Toggle me", completed: false })],
			});
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			// Service returns session with toggled goal
			const updatedSession = makeSession({
				goals: [makeGoal({ id: "g1", text: "Toggle me", completed: true })],
			});
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.goal.toggled", {
				sessionId: "session-1",
				goalId: "g1",
				completed: true,
			});

			const content = getContentEl(view);
			const checkbox = content.querySelector(".ft-goal-row input[type='checkbox']") as HTMLInputElement;
			expect(checkbox.checked).toBe(true);
		});

		it("session.goal.removed removes goal from list", async () => {
			const session = makeSession({
				goals: [
					makeGoal({ id: "g1", text: "Keep" }),
					makeGoal({ id: "g2", text: "Remove" }),
				],
			});
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			// Service returns session with goal removed
			const updatedSession = makeSession({
				goals: [makeGoal({ id: "g1", text: "Keep" })],
			});
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.goal.removed", {
				sessionId: "session-1",
				goalId: "g2",
			});

			const content = getContentEl(view);
			const goals = content.querySelectorAll(".ft-goal-row");
			expect(goals).toHaveLength(1);
			expect(content.textContent).toContain("Keep");
			expect(content.textContent).not.toContain("Remove");
		});
	});

	describe("notes", () => {
		it("renders notes textarea with current notes", async () => {
			const session = makeSession({ notes: "Existing notes" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const textarea = content.querySelector("textarea") as HTMLTextAreaElement;
			expect(textarea).not.toBeNull();
			expect(textarea.value).toBe("Existing notes");
		});

		it("notes textarea change emits session.notes.update debounced", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.notes.update", handler);

			const content = getContentEl(view);
			const textarea = content.querySelector("textarea") as HTMLTextAreaElement;
			textarea.value = "Updated notes";
			textarea.dispatchEvent(new Event("input"));

			// Should not fire immediately
			expect(handler).not.toHaveBeenCalled();

			// Should fire after 500ms debounce
			await vi.advanceTimersByTimeAsync(500);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", notes: "Updated notes" },
			}));
		});

		it("session.notes.updated updates textarea when not focused", async () => {
			const session = makeSession({ notes: "old" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			await eventBus.emit("session.notes.updated", {
				sessionId: "session-1",
				notes: "updated from elsewhere",
			});

			const content = getContentEl(view);
			const textarea = content.querySelector("textarea") as HTMLTextAreaElement;
			expect(textarea.value).toBe("updated from elsewhere");
		});
	});

	describe("focus file", () => {
		it("renders focus file link when focusFile is set", async () => {
			const session = makeSession({ focusFile: "src/domain/session/types.ts" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const focusSection = content.querySelector(".ft-session-workspace-focus");
			expect(focusSection).not.toBeNull();
			expect(focusSection!.textContent).toContain("src/domain/session/types.ts");
		});

		it("does not render focus file section when focusFile is null", async () => {
			const session = makeSession({ focusFile: null });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-focus")).toBeNull();
		});

		it("focus file click calls openLinkText", async () => {
			const session = makeSession({ focusFile: "src/types.ts" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const link = content.querySelector(".ft-focus-link") as HTMLElement;
			link.click();

			const app = (view as unknown as { app: { workspace: { openLinkText: ReturnType<typeof vi.fn>; getLeaf: ReturnType<typeof vi.fn>; setActiveLeaf: ReturnType<typeof vi.fn> } } }).app;
			expect(app.workspace.getLeaf).toHaveBeenCalledWith("split");
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("src/types.ts", "", false);
		});
	});

	describe("artifacts section removed (merged into activity)", () => {
		it("does not render a separate artifacts section", async () => {
			const session = makeSession({
				artifacts: [
					{ path: "src/types.ts", action: "modified", timestamp: new Date().toISOString() },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-artifacts")).toBeNull();
		});

		it("session.artifact.added refreshes the activity list", async () => {
			const session = makeSession({
				activity: [{ timestamp: new Date().toISOString(), action: "created", path: "src/new-file.ts" }],
			});
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({
				activity: [
					{ timestamp: new Date().toISOString(), action: "created", path: "src/new-file.ts" },
					{ timestamp: new Date().toISOString(), action: "modified", path: "src/new-file.ts" },
				],
			});
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.artifact.added", {
				sessionId: "session-1",
				artifact: { path: "src/new-file.ts", action: "modified" as const, timestamp: new Date().toISOString() },
			});

			const content = getContentEl(view);
			// Grouped: 2 events for same file → 1 row with ×2 count badge
			const rows = content.querySelectorAll(".ft-activity-row");
			expect(rows).toHaveLength(1);
			expect(rows[0].textContent).toContain("new-file.ts");
			expect(rows[0].querySelector(".ft-activity-count")).not.toBeNull();
		});
	});

	describe("cleanup", () => {
		it("unsubscribes from all events on close", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			// Close the view
			await view.onClose();

			// Emit a tick — should NOT update the timer (unsubscribed)
			const content = getContentEl(view);
			const timer = content.querySelector(".ft-timer-display")!;
			const originalText = timer.textContent;

			await eventBus.emit("session.timer.tick", {
				sessionId: "session-1",
				remainingMs: 1_000,
				elapsedMs: 0,
			});

			expect(timer.textContent).toBe(originalText);
		});

		it("clears debounce timer on close", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.notes.update", handler);

			// Start a debounced update
			const content = getContentEl(view);
			const textarea = content.querySelector("textarea") as HTMLTextAreaElement;
			textarea.value = "test";
			textarea.dispatchEvent(new Event("input"));

			// Close before debounce fires
			await view.onClose();
			await vi.advanceTimersByTimeAsync(1000);

			// Should NOT have fired
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("links section removed", () => {
		it("does not render links section even when session has links", async () => {
			const session = makeSession({
				links: [
					{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-links")).toBeNull();
		});
	});

	describe("notes file", () => {
		it("does not render notes file section when notesFile is null", async () => {
			const session = makeSession({ notesFile: null });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-notesfile")).toBeNull();
		});

		it("shows clickable link when notes file is set", async () => {
			const session = makeSession({ notesFile: "03 - Resources/Sessions/Test.md" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const link = content.querySelector(".ft-notesfile-link") as HTMLElement;
			expect(link).not.toBeNull();
			expect(link.textContent).toBe("Test.md");
		});

		it("re-renders on session.notesFile.updated", async () => {
			const session = makeSession({ notesFile: null });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({ notesFile: "03 - Resources/Sessions/New.md" });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.notesFile.updated", {
				sessionId: "session-1",
				path: "03 - Resources/Sessions/New.md",
			});

			const content = getContentEl(view);
			expect(content.querySelector(".ft-notesfile-link")).not.toBeNull();
		});
	});

	describe("save as template button", () => {
		it("renders Save as Template button for active session", async () => {
			const session = makeSession({ status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).toContain("Save as Template");
		});

		it("renders Save as Template button for paused session", async () => {
			const session = makeSession({ status: "paused", startedAt: null, pausedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).toContain("Save as Template");
		});

		it("renders Save as Template button for prepared session", async () => {
			const session = makeSession({ status: "prepared", startedAt: null });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).toContain("Save as Template");
		});
	});

	describe("auto-open on session start", () => {
		it("should set workspaceSessionId when session.started fires", async () => {
			const session = makeSession({ id: "auto-open-1", focusFile: null });
			const mockService = createMockSessionService(session);
			const bus = new EventBus();

			// Simulate the auto-open listener pattern from main.ts
			bus.on("session.started", (event) => {
				mockService.workspaceSessionId = event.payload.session.id;
			});

			await bus.emit("session.started", { session });

			expect(mockService.workspaceSessionId).toBe("auto-open-1");
		});

		it("should open focus file after workspace opens when focusFile exists", async () => {
			const session = makeSession({ id: "auto-open-2", focusFile: "src/types.ts" });
			const bus = new EventBus();
			const openLinkText = vi.fn().mockResolvedValue(undefined);
			let workspaceOpened = false;

			// Simulate the auto-open listener pattern
			bus.on("session.started", (event) => {
				workspaceOpened = true;
				if (event.payload.session.focusFile) {
					openLinkText(event.payload.session.focusFile, "", "split");
				}
			});

			await bus.emit("session.started", { session });

			expect(workspaceOpened).toBe(true);
			expect(openLinkText).toHaveBeenCalledWith("src/types.ts", "", "split");
		});

		it("should not open focus file when focusFile is null", async () => {
			const session = makeSession({ id: "auto-open-3", focusFile: null });
			const bus = new EventBus();
			const openLinkText = vi.fn();

			bus.on("session.started", (event) => {
				if (event.payload.session.focusFile) {
					openLinkText(event.payload.session.focusFile, "", "split");
				}
			});

			await bus.emit("session.started", { session });

			expect(openLinkText).not.toHaveBeenCalled();
		});
	});

	describe("session lifecycle events", () => {
		it("re-renders on session.completed", async () => {
			const session = makeSession({ status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const completedSession = { ...session, status: "completed" as const, completedAt: new Date().toISOString() };
			await eventBus.emit("session.completed", { session: completedSession });

			const content = getContentEl(view);
			// After completion, only "Save as Template" remains (no lifecycle buttons)
			const buttons = content.querySelectorAll(".ft-session-workspace-actions button");
			const labels = Array.from(buttons).map((b) => b.textContent);
			expect(labels).not.toContain("Pause");
			expect(labels).not.toContain("Resume");
			expect(labels).not.toContain("Complete");
		});

		it("session.paths.updated re-renders with new file paths", async () => {
			const session = makeSession({ focusFile: "docs/old.md" });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({ focusFile: "docs/new.md" });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.paths.updated", { sessionIds: ["session-1"] });

			const content = getContentEl(view);
			const focusSection = content.querySelector(".ft-session-workspace-focus");
			expect(focusSection).not.toBeNull();
			expect(focusSection!.textContent).toContain("docs/new.md");
		});

		it("session.paths.updated ignores other sessions", async () => {
			const session = makeSession({ focusFile: "docs/old.md" });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const callsBefore = service.getSessionById.mock.calls.length;
			await eventBus.emit("session.paths.updated", { sessionIds: ["other-session"] });

			// Should not have called refreshSession for a different session
			expect(service.getSessionById).toHaveBeenCalledTimes(callsBefore);
		});

		it("session.deleted shows empty state", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			await eventBus.emit("session.deleted", { sessionId: "session-1" });

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-empty")).not.toBeNull();
		});
	});

	describe("activity", () => {
		it("renders activity list with entries in reverse chronological order", async () => {
			const session = makeSession({
				activity: [
					{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "src/types.ts" },
					{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "src/helpers.ts" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const rows = content.querySelectorAll(".ft-activity-row");
			expect(rows).toHaveLength(2);
			// Newest first
			expect(rows[0].textContent).toContain("helpers.ts");
			expect(rows[0].textContent).toContain("modified");
			expect(rows[1].textContent).toContain("types.ts");
			expect(rows[1].textContent).toContain("created");
		});

		it("renders empty activity message when no activity", async () => {
			const session = makeSession({ activity: [] });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.textContent).toContain("No activity yet");
		});

		it("renders activity count", async () => {
			const session = makeSession({
				activity: [
					{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "a.md" },
					{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "b.md" },
					{ timestamp: "2026-02-17T10:02:00.000Z", action: "deleted", path: "c.md" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const actSection = content.querySelector(".ft-session-workspace-activity");
			expect(actSection!.textContent).toContain("(3)");
		});

		it("session.activity.tracked appends to activity list", async () => {
			const session = makeSession({ activity: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const newActivity = { timestamp: "2026-02-17T10:05:00.000Z", action: "created" as const, path: "src/new.ts" };
			const updatedSession = makeSession({ activity: [newActivity] });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.activity.tracked", {
				sessionId: "session-1",
				activity: newActivity,
			});

			const content = getContentEl(view);
			const rows = content.querySelectorAll(".ft-activity-row");
			expect(rows).toHaveLength(1);
			expect(content.textContent).toContain("new.ts");
		});

		it("renders per-session filter tags", async () => {
			const session = makeSession({
				activityFilter: [".obsidian/", "node_modules/"],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const tags = content.querySelectorAll(".ft-activity-filter-tag");
			expect(tags).toHaveLength(2);
			expect(tags[0].textContent).toContain(".obsidian/");
			expect(tags[1].textContent).toContain("node_modules/");
		});

		it("filter input adds folder and calls updateActivityFilter", async () => {
			const session = makeSession({ activityFilter: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const input = content.querySelector(".ft-activity-filter-input") as HTMLInputElement;
			input.value = ".obsidian/";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			await vi.advanceTimersByTimeAsync(0);
			expect(service.updateActivityFilter).toHaveBeenCalledWith("session-1", [".obsidian/"]);
		});

		it("filter remove button calls updateActivityFilter without removed folder", async () => {
			const session = makeSession({ activityFilter: [".obsidian/", "node_modules/"] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const removeBtns = content.querySelectorAll(".ft-activity-filter-remove");
			(removeBtns[0] as HTMLElement).click();

			await vi.advanceTimersByTimeAsync(0);
			expect(service.updateActivityFilter).toHaveBeenCalledWith("session-1", ["node_modules/"]);
		});

		it("activity file link opens in adjacent leaf", async () => {
			const session = makeSession({
				activity: [
					{ timestamp: "2026-02-17T10:00:00.000Z", action: "modified", path: "src/types.ts" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const link = content.querySelector(".ft-activity-link") as HTMLElement;
			link.click();

			const app = (view as unknown as { app: { workspace: { openLinkText: ReturnType<typeof vi.fn> } } }).app;
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("src/types.ts", "", false);
		});
	});

	describe("context bindings", () => {
		it("renders context section with count badge", async () => {
			const session = makeSession({
				contextBindings: [
					{ id: "ctx-1", type: "domain" as const, label: "session", path: "src/domain/session/", boundAt: "2026-02-17T10:00:00.000Z" },
					{ id: "ctx-2", type: "file" as const, label: "types.ts", path: "src/domain/session/types.ts", boundAt: "2026-02-17T10:01:00.000Z" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const section = content.querySelector(".ft-session-workspace-context");
			expect(section).not.toBeNull();
			expect(section!.textContent).toContain("(2/10)");
		});

		it("renders empty context message", async () => {
			const session = makeSession({ contextBindings: [] });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.textContent).toContain("No context bindings");
		});

		it("renders binding rows with type badge and label", async () => {
			const session = makeSession({
				contextBindings: [
					{ id: "ctx-1", type: "domain" as const, label: "session", path: "src/domain/session/", boundAt: "2026-02-17T10:00:00.000Z" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const row = content.querySelector(".ft-context-row");
			expect(row).not.toBeNull();
			expect(row!.textContent).toContain("domain");
			expect(row!.textContent).toContain("session");
		});

		it("remove button emits session.context.unbind", async () => {
			const session = makeSession({
				contextBindings: [
					{ id: "ctx-1", type: "domain" as const, label: "session", path: "src/domain/session/", boundAt: "2026-02-17T10:00:00.000Z" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.context.unbind", handler);

			const content = getContentEl(view);
			const removeBtn = content.querySelector(".ft-context-remove") as HTMLElement;
			removeBtn.click();

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", bindingId: "ctx-1" },
			}));
		});

		it("session.context.bound triggers re-render", async () => {
			const session = makeSession({ contextBindings: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const binding = { id: "ctx-1", type: "domain" as const, label: "session", path: "src/domain/session/", boundAt: "2026-02-17T10:00:00.000Z" };
			const updatedSession = makeSession({ contextBindings: [binding] });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.context.bound", {
				sessionId: "session-1",
				binding,
			});

			const content = getContentEl(view);
			const rows = content.querySelectorAll(".ft-context-row");
			expect(rows).toHaveLength(1);
			expect(content.textContent).toContain("session");
		});

		it("session.context.unbound triggers re-render", async () => {
			const session = makeSession({
				contextBindings: [
					{ id: "ctx-1", type: "domain" as const, label: "session", path: "src/domain/session/", boundAt: "2026-02-17T10:00:00.000Z" },
				],
			});
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({ contextBindings: [] });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.context.unbound", {
				sessionId: "session-1",
				bindingId: "ctx-1",
			});

			const content = getContentEl(view);
			const rows = content.querySelectorAll(".ft-context-row");
			expect(rows).toHaveLength(0);
			expect(content.textContent).toContain("No context bindings");
		});

		it("shows Add Context button when under max", async () => {
			const session = makeSession({ contextBindings: [] });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const addBtn = content.querySelector(".ft-context-add") as HTMLElement;
			expect(addBtn).not.toBeNull();
			expect(addBtn.textContent).toContain("Add Context");
		});
	});

	describe("guiding questions", () => {
		it("renders guiding questions for active session", async () => {
			const session = makeSession({ status: "active", type: "event-storming" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const section = content.querySelector(".ft-session-workspace-guiding");
			expect(section).not.toBeNull();
			expect(section!.textContent).toContain("Guiding Questions");
			expect(section!.textContent).toContain("What events does this domain produce?");
		});

		it("renders guiding questions for paused session", async () => {
			const session = makeSession({ status: "paused", startedAt: null, pausedAt: new Date().toISOString(), type: "domain-design" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const section = content.querySelector(".ft-session-workspace-guiding");
			expect(section).not.toBeNull();
			expect(section!.textContent).toContain("What are the bounded contexts?");
		});

		it("does not render guiding questions for prepared session", async () => {
			const session = makeSession({ status: "prepared", startedAt: null });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-guiding")).toBeNull();
		});

		it("does not render guiding questions for completed session", async () => {
			const session = makeSession({ status: "completed", completedAt: new Date().toISOString() });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-guiding")).toBeNull();
		});

		it("uses custom session type configs when available", async () => {
			const session = makeSession({ status: "active", type: "event-storming" });
			const { view } = createView(eventBus, session);
			view.customSessionTypes = {
				"event-storming": {
					type: "event-storming",
					label: "Custom ES",
					icon: "zap",
					guidingQuestions: ["Custom question 1"],
					defaultDuration: 50,
					defaultGoals: [],
				},
			};
			await view.onOpen();

			const content = getContentEl(view);
			const section = content.querySelector(".ft-session-workspace-guiding");
			expect(section).not.toBeNull();
			expect(section!.textContent).toContain("Custom question 1");
		});
	});

	// ── Decision Panel integration ──────────────────────────

	describe("decisions panel", () => {
		it("renders decisions section in workspace", async () => {
			const session = makeSession({
				status: "active",
				decisions: [
					{ id: "d1", title: "Use EventBus", description: "Decoupled comms", recordedAt: "2026-02-18T10:00:00.000Z" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();
			const content = getContentEl(view);

			const section = content.querySelector(".ft-session-workspace-decisions");
			expect(section).not.toBeNull();
			expect(section!.textContent).toContain("Decisions");
			expect(section!.textContent).toContain("Use EventBus");
		});

		it("refreshes decisions on session.decision.recorded", async () => {
			const session = makeSession({ status: "active", decisions: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			// Simulate decision being recorded — service returns updated session
			const updatedSession = makeSession({
				status: "active",
				decisions: [{ id: "d1", title: "New Decision", description: "desc", recordedAt: "2026-02-18T10:00:00.000Z" }],
			});
			(service.getSessionById as ReturnType<typeof vi.fn>).mockReturnValue(updatedSession);

			await eventBus.emit("session.decision.recorded", {
				sessionId: "session-1",
				decision: updatedSession.decisions[0],
			});

			const content = getContentEl(view);
			expect(content.textContent).toContain("New Decision");
		});

		it("refreshes decisions on session.decision.removed", async () => {
			const dec = { id: "d1", title: "Old Decision", description: "desc", recordedAt: "2026-02-18T10:00:00.000Z" };
			const session = makeSession({ status: "active", decisions: [dec] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			// Simulate decision being removed — service returns updated session
			const updatedSession = makeSession({ status: "active", decisions: [] });
			(service.getSessionById as ReturnType<typeof vi.fn>).mockReturnValue(updatedSession);

			await eventBus.emit("session.decision.removed", {
				sessionId: "session-1",
				decisionId: "d1",
			});

			const content = getContentEl(view);
			expect(content.textContent).not.toContain("Old Decision");
		});
	});

	// ── Workspace state capture/restore ────────────────────

	describe("workspace state", () => {
		it("captures workspace state on session.state.save", async () => {
			const session = makeSession({ id: "ws-1", status: "paused" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			// Extend mock app with iterateAllLeaves and getActiveFile
			const app = (view as unknown as { app: Record<string, unknown> }).app as Record<string, Record<string, unknown>>;
			app.workspace.iterateAllLeaves = vi.fn((cb: (leaf: unknown) => void) => {
				cb({ getViewState: () => ({ state: { file: "notes/a.md" } }) });
				cb({ getViewState: () => ({ state: { file: "notes/b.md" } }) });
				cb({ getViewState: () => ({ state: {} }) }); // leaf without file
			});
			app.workspace.getActiveFile = vi.fn(() => ({ path: "notes/a.md" }));

			const handler = vi.fn();
			eventBus.on("session.state.saved", handler);

			await eventBus.emit("session.state.save", { sessionId: "ws-1" });

			expect(handler).toHaveBeenCalledTimes(1);
			const payload = handler.mock.calls[0][0].payload;
			expect(payload.sessionId).toBe("ws-1");
			expect(payload.state.openFiles).toEqual(["notes/a.md", "notes/b.md"]);
			expect(payload.state.activeFile).toBe("notes/a.md");
		});

		it("restores open files on session.state.restore", async () => {
			const session = makeSession({ id: "ws-2", status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			// Add vault.getAbstractFileByPath to mock
			const app = (view as unknown as { app: Record<string, unknown> }).app as Record<string, Record<string, unknown>>;
			app.vault = {
				getAbstractFileByPath: vi.fn((path: string) => {
					if (path === "notes/a.md" || path === "notes/b.md") return { path };
					return null;
				}),
			};

			const handler = vi.fn();
			eventBus.on("session.state.restored", handler);

			const state = { openFiles: ["notes/a.md", "notes/b.md"], activeFile: "notes/a.md", scrollPositions: {} };
			await eventBus.emit("session.state.restore", { sessionId: "ws-2", state });
			// Flush microtasks — handler uses `void` so async work is pending
			await vi.advanceTimersByTimeAsync(0);

			// openLinkText called for each open file + active file
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("notes/a.md", "", false);
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("notes/b.md", "", false);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("skips missing files during restore", async () => {
			const session = makeSession({ id: "ws-3", status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const app = (view as unknown as { app: Record<string, unknown> }).app as Record<string, Record<string, unknown>>;
			app.vault = {
				getAbstractFileByPath: vi.fn((path: string) => {
					if (path === "exists.md") return { path };
					return null; // missing.md doesn't exist
				}),
			};

			const state = { openFiles: ["exists.md", "missing.md"], activeFile: "missing.md", scrollPositions: {} };
			await eventBus.emit("session.state.restore", { sessionId: "ws-3", state });

			// Only existing file opened
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("exists.md", "", false);
			expect(app.workspace.openLinkText).toHaveBeenCalledTimes(1);
		});

		it("ignores state.save for a different session", async () => {
			const session = makeSession({ id: "ws-4", status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.state.saved", handler);

			await eventBus.emit("session.state.save", { sessionId: "other-session" });

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("output panel", () => {
		it("renders output panel for completed sessions", async () => {
			const session = makeSession({ status: "completed" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-outputs")).toBeTruthy();
		});

		it("does not render output panel for active sessions", async () => {
			const session = makeSession({ status: "active" });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-outputs")).toBeNull();
		});

		it("refreshes output panel on session.output.generated", async () => {
			const session = makeSession({ status: "completed", outputArtifacts: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelectorAll(".ft-output-row").length).toBe(0);

			// Simulate artifact being added to session state
			session.outputArtifacts.push({
				type: "review-summary",
				path: "Sessions/Review (abc).md",
				generatedAt: new Date().toISOString(),
			});
			service.getSessionById.mockReturnValue(session);

			await eventBus.emit("session.output.generated", {
				sessionId: "session-1",
				artifact: session.outputArtifacts[0],
			});

			expect(content.querySelectorAll(".ft-output-row").length).toBe(1);
		});

		it("renders output panel for archived sessions", async () => {
			const session = makeSession({ status: "archived" as Session["status"] });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-outputs")).toBeTruthy();
		});
	});
});
