// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionReflectionPanel } from "../../../src/ui/session/SessionReflectionPanel";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session, ReflectionEntry } from "../../../src/domain/session/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "running",
		durationMinutes: 25,
		createdAt: new Date().toISOString(),
		startedAt: new Date().toISOString(),
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

function makeReflection(type: ReflectionEntry["type"], content: string, id?: string): ReflectionEntry {
	return {
		id: id ?? `ref_${type}_${Math.random().toString(36).slice(2, 8)}`,
		type,
		content,
		timestamp: new Date().toISOString(),
	};
}

function makeDeps(session: Session): { deps: SessionPanelDeps; eventBus: EventBus } {
	const eventBus = new EventBus();
	return {
		deps: {
			eventBus,
			getSession: () => session,
			app: {} as never,
			openFile: vi.fn(),
			revealFolder: vi.fn(),
			updateActivityFilter: vi.fn(),
			getGlobalActivityFilter: () => [],
		},
		eventBus,
	};
}

describe("SessionReflectionPanel", () => {
	it("renders section with header and count", () => {
		const session = makeSession({
			reflections: [makeReflection("observation", "Good code")],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-session-workspace-reflections")).toBeTruthy();
		expect(container.textContent).toContain("Reflections");
		expect(container.textContent).toContain("(1)");
	});

	it("renders entries grouped by category", () => {
		const session = makeSession({
			reflections: [
				makeReflection("observation", "Code is clean"),
				makeReflection("observation", "Good tests"),
				makeReflection("blocker", "API not ready"),
				makeReflection("idea", "Use caching"),
			],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		// Should have category headers for observation, blocker, idea (not decision — empty)
		const catHeaders = container.querySelectorAll(".ft-reflection-category");
		expect(catHeaders.length).toBe(3);

		expect(container.textContent).toContain("Observations (2)");
		expect(container.textContent).toContain("Blockers (1)");
		expect(container.textContent).toContain("Ideas (1)");
	});

	it("does not render empty categories", () => {
		const session = makeSession({
			reflections: [makeReflection("idea", "Try new approach")],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.textContent).not.toContain("Observations");
		expect(container.textContent).not.toContain("Blockers");
		expect(container.textContent).not.toContain("Decisions");
		expect(container.textContent).toContain("Ideas (1)");
	});

	it("renders entry content text", () => {
		const session = makeSession({
			reflections: [makeReflection("blocker", "API rate limit prevents bulk import")],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.textContent).toContain("API rate limit prevents bulk import");
	});

	it("renders remove button for running sessions", () => {
		const session = makeSession({
			reflections: [makeReflection("observation", "Clean code", "ref-1")],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const removeBtn = container.querySelector(".ft-reflection-remove");
		expect(removeBtn).toBeTruthy();
	});

	it("remove button emits session.reflection.remove", () => {
		const session = makeSession({
			reflections: [makeReflection("observation", "Clean code", "ref-1")],
		});
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const handler = vi.fn();
		eventBus.on("session.reflection.remove", handler);

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const removeBtn = container.querySelector(".ft-reflection-remove") as HTMLButtonElement;
		removeBtn.click();

		// Fire-and-forget — event bus emit is async
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does not render remove button for completed sessions", () => {
		const session = makeSession({
			status: "completed",
			reflections: [makeReflection("observation", "Clean code")],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-reflection-remove")).toBeNull();
	});

	it("does not render remove button for archived sessions", () => {
		const session = makeSession({
			status: "archived",
			reflections: [makeReflection("observation", "Clean code")],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-reflection-remove")).toBeNull();
	});

	it("renders add form for running sessions", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-reflection-add-form")).toBeTruthy();
		expect(container.querySelector(".ft-reflection-type-select")).toBeTruthy();
		expect(container.querySelector(".ft-reflection-input")).toBeTruthy();
	});

	it("does not render add form for completed sessions", () => {
		const session = makeSession({ status: "completed" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-reflection-add-form")).toBeNull();
	});

	it("category dropdown has all 4 options", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const select = container.querySelector(".ft-reflection-type-select") as HTMLSelectElement;
		expect(select.options.length).toBe(4);
		expect(select.options[0].value).toBe("observation");
		expect(select.options[1].value).toBe("blocker");
		expect(select.options[2].value).toBe("idea");
		expect(select.options[3].value).toBe("decision");
	});

	it("enter key in input emits session.reflection.add", () => {
		const session = makeSession();
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const handler = vi.fn();
		eventBus.on("session.reflection.add", handler);

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const input = container.querySelector(".ft-reflection-input") as HTMLInputElement;
		const select = container.querySelector(".ft-reflection-type-select") as HTMLSelectElement;
		select.value = "blocker";
		input.value = "API not ready";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(handler).toHaveBeenCalledTimes(1);
		const payload = handler.mock.calls[0][0].payload;
		expect(payload.type).toBe("blocker");
		expect(payload.content).toBe("API not ready");
	});

	it("enter key clears input after emit", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const input = container.querySelector(".ft-reflection-input") as HTMLInputElement;
		input.value = "Some reflection";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(input.value).toBe("");
	});

	it("enter key does not emit for empty input", () => {
		const session = makeSession();
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const handler = vi.fn();
		eventBus.on("session.reflection.add", handler);

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const input = container.querySelector(".ft-reflection-input") as HTMLInputElement;
		input.value = "  ";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(handler).not.toHaveBeenCalled();
	});

	it("refreshList updates the displayed entries", () => {
		const reflections = [makeReflection("observation", "First")];
		const session = makeSession({ reflections });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.textContent).toContain("(1)");

		// Add a reflection to the session data
		reflections.push(makeReflection("idea", "Second"));
		panel.refreshList();

		expect(container.textContent).toContain("(2)");
		expect(container.textContent).toContain("Second");
	});

	it("renders for paused sessions with add form", () => {
		const session = makeSession({ status: "paused" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-reflection-add-form")).toBeTruthy();
	});

	it("renders all four category types when present", () => {
		const session = makeSession({
			reflections: [
				makeReflection("observation", "Obs"),
				makeReflection("blocker", "Block"),
				makeReflection("idea", "Idea"),
				makeReflection("decision", "Dec"),
			],
		});
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionReflectionPanel(container, deps);
		panel.render();

		const catHeaders = container.querySelectorAll(".ft-reflection-category");
		expect(catHeaders.length).toBe(4);
		expect(container.textContent).toContain("Observations (1)");
		expect(container.textContent).toContain("Blockers (1)");
		expect(container.textContent).toContain("Ideas (1)");
		expect(container.textContent).toContain("Decisions (1)");
	});
});
