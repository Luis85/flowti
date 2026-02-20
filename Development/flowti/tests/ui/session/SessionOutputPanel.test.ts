// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionOutputPanel } from "../../../src/ui/session/SessionOutputPanel";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session, SessionOutputArtifact } from "../../../src/domain/session/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "completed",
		durationMinutes: 25,
		createdAt: new Date().toISOString(),
		startedAt: new Date().toISOString(),
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: new Date().toISOString(),
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

function makeArtifact(overrides?: Partial<SessionOutputArtifact>): SessionOutputArtifact {
	return {
		type: "review-summary",
		path: "03 - Resources/Sessions/Test Session - Review Summary (abc123).md",
		generatedAt: "2026-02-18T10:00:00.000Z",
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
			getGlobalActivityFilter: () => [],
		},
		eventBus,
	};
}

describe("SessionOutputPanel", () => {
	it("renders output section with header and count", () => {
		const session = makeSession({ outputArtifacts: [makeArtifact()] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionOutputPanel(container, deps, vi.fn());
		panel.render();

		const section = container.querySelector(".ft-session-workspace-outputs");
		expect(section).toBeTruthy();
		expect(section!.textContent).toContain("Output Artifacts");
		expect(section!.textContent).toContain("(1)");
	});

	it("renders empty state when no artifacts", () => {
		const session = makeSession({ outputArtifacts: [] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionOutputPanel(container, deps, vi.fn());
		panel.render();

		const empty = container.querySelector(".ft-outputs-empty");
		expect(empty).toBeTruthy();
		expect(empty!.textContent).toContain("No output artifacts generated yet.");
	});

	it("renders artifact rows with links", () => {
		const artifacts = [
			makeArtifact({ path: "Sessions/Meeting Invite (abc).md" }),
			makeArtifact({ type: "action-items", path: "Sessions/Action Items (def).md" }),
		];
		const session = makeSession({ outputArtifacts: artifacts });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionOutputPanel(container, deps, vi.fn());
		panel.render();

		const rows = container.querySelectorAll(".ft-output-row");
		expect(rows.length).toBe(2);

		const links = container.querySelectorAll(".ft-output-link");
		expect(links[0].textContent).toBe("Meeting Invite (abc).md");
		expect(links[1].textContent).toBe("Action Items (def).md");
	});

	it("calls openFile when artifact link is clicked", () => {
		const artifact = makeArtifact({ path: "Sessions/Review (abc).md" });
		const session = makeSession({ outputArtifacts: [artifact] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionOutputPanel(container, deps, vi.fn());
		panel.render();

		const link = container.querySelector(".ft-output-link") as HTMLAnchorElement;
		link.click();

		expect(deps.openFile).toHaveBeenCalledWith("Sessions/Review (abc).md");
	});

	it("calls onGenerate when Generate Output button is clicked", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");
		const onGenerate = vi.fn();

		const panel = new SessionOutputPanel(container, deps, onGenerate);
		panel.render();

		const btn = container.querySelector(".ft-output-generate-btn") as HTMLButtonElement;
		btn.click();

		expect(onGenerate).toHaveBeenCalled();
	});

	it("refreshList updates the displayed artifacts and count", () => {
		const session = makeSession({ outputArtifacts: [] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionOutputPanel(container, deps, vi.fn());
		panel.render();

		expect(container.querySelectorAll(".ft-output-row").length).toBe(0);
		expect(container.textContent).toContain("(0)");

		// Simulate artifact added
		session.outputArtifacts.push(makeArtifact());
		panel.refreshList();

		expect(container.querySelectorAll(".ft-output-row").length).toBe(1);
		expect(container.textContent).toContain("(1)");
	});

	it("renders date for each artifact", () => {
		const artifact = makeArtifact({ generatedAt: "2026-02-18T10:00:00.000Z" });
		const session = makeSession({ outputArtifacts: [artifact] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionOutputPanel(container, deps, vi.fn());
		panel.render();

		const dateEl = container.querySelector(".ft-output-date");
		expect(dateEl).toBeTruthy();
		expect(dateEl!.textContent).toBe("2026-02-18");
	});
});
