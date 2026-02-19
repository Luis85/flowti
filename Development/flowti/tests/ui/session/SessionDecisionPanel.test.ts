// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionDecisionPanel } from "../../../src/ui/session/SessionDecisionPanel";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session, SessionDecision } from "../../../src/domain/session/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "active",
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

function makeDecision(overrides?: Partial<SessionDecision>): SessionDecision {
	return {
		id: "dec-1",
		title: "Use EventBus",
		description: "For decoupled communication",
		recordedAt: new Date().toISOString(),
		...overrides,
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
		},
		eventBus,
	};
}

describe("SessionDecisionPanel", () => {
	it("renders decisions section with header and count", () => {
		const session = makeSession({ decisions: [makeDecision()] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		const section = container.querySelector(".ft-session-workspace-decisions");
		expect(section).toBeTruthy();
		expect(section!.textContent).toContain("Decisions");
		expect(section!.textContent).toContain("(1)");
	});

	it("renders each decision with title and description", () => {
		const decisions = [
			makeDecision({ id: "d1", title: "Use DDD", description: "Domain-driven design" }),
			makeDecision({ id: "d2", title: "Use Redis", description: "For caching" }),
		];
		const session = makeSession({ decisions });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		const rows = container.querySelectorAll(".ft-decision-row");
		expect(rows.length).toBe(2);
		expect(rows[0].textContent).toContain("Use DDD");
		expect(rows[0].textContent).toContain("Domain-driven design");
		expect(rows[1].textContent).toContain("Use Redis");
	});

	it("renders context when present", () => {
		const decisions = [makeDecision({ context: "architecture review" })];
		const session = makeSession({ decisions });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		const ctx = container.querySelector(".ft-decision-context");
		expect(ctx).toBeTruthy();
		expect(ctx!.textContent).toContain("architecture review");
	});

	it("does not render context element when absent", () => {
		const decisions = [makeDecision({ context: undefined })];
		const session = makeSession({ decisions });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-decision-context")).toBeNull();
	});

	it("renders add form for active sessions", () => {
		const session = makeSession({ status: "active" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-decision-title-input")).toBeTruthy();
	});

	it("does not render add form for completed sessions", () => {
		const session = makeSession({ status: "completed" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-decision-add-form")).toBeNull();
	});

	it("emits session.decision.record on Enter in title input", async () => {
		const session = makeSession({ status: "active" });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		const titleInput = container.querySelector(".ft-decision-title-input") as HTMLInputElement;
		titleInput.value = "Use EventBus";

		titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(emitSpy).toHaveBeenCalledWith("session.decision.record", {
			sessionId: "session-1",
			title: "Use EventBus",
		});
	});

	it("does not emit when title is empty", () => {
		const session = makeSession({ status: "active" });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		const titleInput = container.querySelector(".ft-decision-title-input") as HTMLInputElement;
		titleInput.value = "  ";
		titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(emitSpy).not.toHaveBeenCalled();
	});

	it("renders remove button for active sessions", () => {
		const decisions = [makeDecision()];
		const session = makeSession({ status: "active", decisions });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-decision-remove")).toBeTruthy();
	});

	it("does not render remove button for completed sessions", () => {
		const decisions = [makeDecision()];
		const session = makeSession({ status: "completed", decisions });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-decision-remove")).toBeNull();
	});

	it("emits session.decision.remove on remove button click", () => {
		const decisions = [makeDecision({ id: "dec-42" })];
		const session = makeSession({ status: "active", decisions });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		const removeBtn = container.querySelector(".ft-decision-remove") as HTMLButtonElement;
		removeBtn.click();

		expect(emitSpy).toHaveBeenCalledWith("session.decision.remove", {
			sessionId: "session-1",
			decisionId: "dec-42",
		});
	});

	it("refreshList updates the displayed decisions", () => {
		const decisions = [makeDecision()];
		const session = makeSession({ decisions });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelectorAll(".ft-decision-row").length).toBe(1);

		// Simulate adding a decision
		session.decisions.push(makeDecision({ id: "d2", title: "Second Decision" }));
		panel.refreshList();

		expect(container.querySelectorAll(".ft-decision-row").length).toBe(2);
		expect(container.textContent).toContain("(2)");
	});

	it("renders empty list when no decisions", () => {
		const session = makeSession({ decisions: [] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionDecisionPanel(container, deps);
		panel.render();

		expect(container.querySelectorAll(".ft-decision-row").length).toBe(0);
		expect(container.textContent).toContain("(0)");
	});
});
