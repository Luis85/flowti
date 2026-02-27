// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionGuidingQuestions } from "../../../src/ui/session/SessionGuidingQuestions";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session } from "../../../src/domain/session/types";
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

function makeDeps(session: Session): SessionPanelDeps {
	return {
		eventBus: new EventBus(),
		getSession: () => session,
		app: {} as never,
		openFile: vi.fn(),
		revealFolder: vi.fn(),
		updateActivityFilter: vi.fn(),
		getGlobalActivityFilter: () => [],
	};
}

describe("SessionGuidingQuestions", () => {
	it("renders guiding questions for built-in type", () => {
		const session = makeSession({ type: "event-storming" });
		const container = document.createElement("div");
		const panel = new SessionGuidingQuestions(container, makeDeps(session));
		panel.render();

		const section = container.querySelector(".ft-session-workspace-guiding");
		expect(section).not.toBeNull();
		expect(section!.textContent).toContain("Guiding questions");
		expect(section!.textContent).toContain("What events does this domain produce?");
		expect(section!.textContent).toContain("What triggers each event?");
	});

	it("renders all questions as list items", () => {
		const session = makeSession({ type: "domain-design" });
		const container = document.createElement("div");
		const panel = new SessionGuidingQuestions(container, makeDeps(session));
		panel.render();

		const items = container.querySelectorAll(".ft-guiding-item");
		expect(items).toHaveLength(3); // domain-design has 3 questions
	});

	it("renders custom type questions when customConfigs provided", () => {
		const session = makeSession({ type: "sprint-review" as never });
		const container = document.createElement("div");
		const customConfigs = {
			"sprint-review": {
				type: "sprint-review" as never,
				label: "Sprint Review",
				icon: "star",
				guidingQuestions: ["What was delivered?", "What was deferred?"],
				defaultDuration: 30,
				defaultGoals: [],
			},
		};
		const panel = new SessionGuidingQuestions(container, makeDeps(session), customConfigs);
		panel.render();

		const section = container.querySelector(".ft-session-workspace-guiding");
		expect(section).not.toBeNull();
		expect(section!.textContent).toContain("What was delivered?");
		expect(section!.textContent).toContain("What was deferred?");
	});

	it("does not render when type has no guiding questions", () => {
		const session = makeSession({ type: "event-storming" });
		const container = document.createElement("div");
		const customConfigs = {
			"event-storming": {
				type: "event-storming" as never,
				label: "Event Storming",
				icon: "zap",
				guidingQuestions: [], // empty
				defaultDuration: 50,
				defaultGoals: [],
			},
		};
		const panel = new SessionGuidingQuestions(container, makeDeps(session), customConfigs);
		panel.render();

		const section = container.querySelector(".ft-session-workspace-guiding");
		expect(section).toBeNull();
	});

	it("renders documentation type questions", () => {
		const session = makeSession({ type: "documentation" });
		const container = document.createElement("div");
		const panel = new SessionGuidingQuestions(container, makeDeps(session));
		panel.render();

		const section = container.querySelector(".ft-session-workspace-guiding");
		expect(section).not.toBeNull();
		expect(section!.textContent).toContain("What needs to be documented?");
	});
});
