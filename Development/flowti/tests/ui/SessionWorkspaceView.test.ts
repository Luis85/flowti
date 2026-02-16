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

function createMockSessionService(activeSession: Session | null) {
	return {
		getActiveSession: vi.fn(() => activeSession),
		getSessionById: vi.fn((id: string) => activeSession?.id === id ? activeSession : null),
		getSessions: vi.fn(() => activeSession ? [activeSession] : []),
		getSavedTemplates: vi.fn(() => []),
		workspaceSessionId: activeSession?.id ?? null,
	};
}

type MockSessionService = ReturnType<typeof createMockSessionService>;

function createView(eventBus: IEventBus, activeSession: Session | null): { view: SessionWorkspaceView; service: MockSessionService } {
	const service = createMockSessionService(activeSession);
	const leaf = {} as never;
	const view = new SessionWorkspaceView(leaf, eventBus, service as never);

	// Set up containerEl with Obsidian's expected children structure:
	// children[0] = header bar, children[1] = content area
	const containerEl = document.createElement("div");
	containerEl.appendChild(document.createElement("div")); // header
	containerEl.appendChild(document.createElement("div")); // content
	(view as unknown as { containerEl: HTMLElement }).containerEl = containerEl;

	// Mock app for focus file openLinkText
	(view as unknown as { app: { workspace: { openLinkText: ReturnType<typeof vi.fn> } } }).app = {
		workspace: { openLinkText: vi.fn() },
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

		it("hides the Obsidian view title bar on open", async () => {
			const { view } = createView(eventBus, makeSession());
			await view.onOpen();
			const header = (view as unknown as { containerEl: HTMLElement }).containerEl.children[0] as HTMLElement;
			expect(header.style.display).toBe("none");
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

			const app = (view as unknown as { app: { workspace: { openLinkText: ReturnType<typeof vi.fn> } } }).app;
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("src/types.ts", "", "split");
		});
	});

	describe("artifacts", () => {
		it("renders artifacts list with file names and action badges", async () => {
			const session = makeSession({
				artifacts: [
					{ path: "src/types.ts", action: "modified", timestamp: new Date().toISOString() },
					{ path: "src/helpers.ts", action: "created", timestamp: new Date().toISOString() },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const artifacts = content.querySelectorAll(".ft-artifact-row");
			expect(artifacts).toHaveLength(2);
			expect(content.textContent).toContain("types.ts");
			expect(content.textContent).toContain("modified");
			expect(content.textContent).toContain("helpers.ts");
			expect(content.textContent).toContain("created");
		});

		it("renders empty artifacts message when no artifacts", async () => {
			const session = makeSession({ artifacts: [] });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.textContent).toContain("No artifacts yet");
		});

		it("session.artifact.added appends to artifact list", async () => {
			const session = makeSession({ artifacts: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			// Service returns session with new artifact
			const newArtifact = { path: "src/new-file.ts", action: "created" as const, timestamp: new Date().toISOString() };
			const updatedSession = makeSession({ artifacts: [newArtifact] });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.artifact.added", {
				sessionId: "session-1",
				artifact: newArtifact,
			});

			const content = getContentEl(view);
			const artifacts = content.querySelectorAll(".ft-artifact-row");
			expect(artifacts).toHaveLength(1);
			expect(content.textContent).toContain("new-file.ts");
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

	describe("links", () => {
		it("renders links section when session has links", async () => {
			const session = makeSession({
				links: [
					{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" },
					{ path: "docs/services.md", addedAt: "2026-02-16T10:01:00.000Z" },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const linksSection = content.querySelector(".ft-session-workspace-links");
			expect(linksSection).not.toBeNull();
			expect(content.textContent).toContain("Links");
			expect(content.textContent).toContain("events.md");
			expect(content.textContent).toContain("services.md");
		});

		it("does not render links section when no links", async () => {
			const session = makeSession({ links: [] });
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-links")).toBeNull();
		});

		it("remove button emits session.link.remove", async () => {
			const session = makeSession({
				links: [{ path: "docs/events.md", addedAt: "2026-02-16T10:00:00.000Z" }],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const handler = vi.fn();
			eventBus.on("session.link.remove", handler);

			const content = getContentEl(view);
			const removeBtn = content.querySelector(".ft-link-remove") as HTMLElement;
			removeBtn.click();

			await vi.advanceTimersByTimeAsync(0);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "session-1", path: "docs/events.md" },
			}));
		});

		it("session.link.added triggers re-render with new link", async () => {
			const session = makeSession({ links: [] });
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({
				links: [{ path: "docs/new.md", addedAt: "2026-02-16T10:05:00.000Z" }],
			});
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.link.added", {
				sessionId: "session-1",
				link: { path: "docs/new.md", addedAt: "2026-02-16T10:05:00.000Z" },
			});

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-links")).not.toBeNull();
			expect(content.textContent).toContain("new.md");
		});

		it("session.link.removed triggers re-render without link", async () => {
			const session = makeSession({
				links: [{ path: "docs/remove.md", addedAt: "2026-02-16T10:00:00.000Z" }],
			});
			const { view, service } = createView(eventBus, session);
			await view.onOpen();

			const updatedSession = makeSession({ links: [] });
			service.getSessionById.mockReturnValue(updatedSession);

			await eventBus.emit("session.link.removed", {
				sessionId: "session-1",
				path: "docs/remove.md",
			});

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

	describe("clickable artifacts", () => {
		it("renders artifact names as clickable links", async () => {
			const session = makeSession({
				artifacts: [
					{ path: "src/types.ts", action: "created", timestamp: new Date().toISOString() },
				],
			});
			const { view } = createView(eventBus, session);
			await view.onOpen();

			const content = getContentEl(view);
			const link = content.querySelector(".ft-artifact-link") as HTMLAnchorElement;
			expect(link).not.toBeNull();
			expect(link.textContent).toBe("types.ts");
			expect(link.title).toBe("src/types.ts");
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

		it("session.deleted shows empty state", async () => {
			const session = makeSession();
			const { view } = createView(eventBus, session);
			await view.onOpen();

			await eventBus.emit("session.deleted", { sessionId: "session-1" });

			const content = getContentEl(view);
			expect(content.querySelector(".ft-session-workspace-empty")).not.toBeNull();
		});
	});
});
