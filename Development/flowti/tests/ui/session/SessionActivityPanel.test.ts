// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionActivityPanel, groupActivityByFile } from "../../../src/ui/session/SessionActivityPanel";
import type { GroupedActivity } from "../../../src/ui/session/SessionActivityPanel";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session, SessionActivity } from "../../../src/domain/session/types";
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
		featureName: null,
		...overrides,
	};
}

function makeDeps(session: Session, globalFilter: string[] = []): SessionPanelDeps {
	return {
		eventBus: new EventBus(),
		getSession: () => session,
		app: {} as never,
		openFile: vi.fn(),
		revealFolder: vi.fn(),
		updateActivityFilter: vi.fn(),
		getGlobalActivityFilter: () => globalFilter,
	};
}

// ── groupActivityByFile() pure function ──────────────────

describe("groupActivityByFile", () => {
	it("returns empty array for empty input", () => {
		expect(groupActivityByFile([])).toEqual([]);
	});

	it("groups multiple events for same file into one entry", () => {
		const entries: SessionActivity[] = [
			{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "src/types.ts" },
			{ timestamp: "2026-02-17T10:05:00.000Z", action: "modified", path: "src/types.ts" },
			{ timestamp: "2026-02-17T10:10:00.000Z", action: "modified", path: "src/types.ts" },
		];
		const result = groupActivityByFile(entries);

		expect(result).toHaveLength(1);
		expect(result[0].path).toBe("src/types.ts");
		expect(result[0].latestAction).toBe("modified");
		expect(result[0].latestTimestamp).toBe("2026-02-17T10:10:00.000Z");
		expect(result[0].count).toBe(3);
	});

	it("produces one entry per unique file path", () => {
		const entries: SessionActivity[] = [
			{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "a.md" },
			{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "b.md" },
			{ timestamp: "2026-02-17T10:02:00.000Z", action: "opened", path: "c.md" },
		];
		const result = groupActivityByFile(entries);

		expect(result).toHaveLength(3);
		const paths = result.map((g) => g.path);
		expect(paths).toContain("a.md");
		expect(paths).toContain("b.md");
		expect(paths).toContain("c.md");
	});

	it("sorts groups newest-first by latest timestamp", () => {
		const entries: SessionActivity[] = [
			{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "old.md" },
			{ timestamp: "2026-02-17T11:00:00.000Z", action: "modified", path: "mid.md" },
			{ timestamp: "2026-02-17T12:00:00.000Z", action: "opened", path: "new.md" },
		];
		const result = groupActivityByFile(entries);

		expect(result[0].path).toBe("new.md");
		expect(result[1].path).toBe("mid.md");
		expect(result[2].path).toBe("old.md");
	});

	it("uses latest action from the most recent event", () => {
		const entries: SessionActivity[] = [
			{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "file.ts" },
			{ timestamp: "2026-02-17T10:05:00.000Z", action: "modified", path: "file.ts" },
			{ timestamp: "2026-02-17T10:10:00.000Z", action: "deleted", path: "file.ts" },
		];
		const result = groupActivityByFile(entries);

		expect(result[0].latestAction).toBe("deleted");
	});

	it("handles mixed files with different event counts", () => {
		const entries: SessionActivity[] = [
			{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "a.md" },
			{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "a.md" },
			{ timestamp: "2026-02-17T10:02:00.000Z", action: "modified", path: "a.md" },
			{ timestamp: "2026-02-17T10:03:00.000Z", action: "created", path: "b.md" },
		];
		const result = groupActivityByFile(entries);

		expect(result).toHaveLength(2);
		const aGroup = result.find((g) => g.path === "a.md")!;
		const bGroup = result.find((g) => g.path === "b.md")!;
		expect(aGroup.count).toBe(3);
		expect(bGroup.count).toBe(1);
	});

	it("single event per file has count of 1", () => {
		const entries: SessionActivity[] = [
			{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "solo.md" },
		];
		const result = groupActivityByFile(entries);

		expect(result).toHaveLength(1);
		expect(result[0].count).toBe(1);
	});
});

// ── SessionActivityPanel rendering ───────────────────────

describe("SessionActivityPanel", () => {
	it("renders grouped activity rows (one per file)", () => {
		const session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "src/types.ts" },
				{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "src/types.ts" },
				{ timestamp: "2026-02-17T10:02:00.000Z", action: "created", path: "src/helpers.ts" },
			],
		});
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(2);
	});

	it("shows count badge when file has multiple events", () => {
		const session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "src/types.ts" },
				{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "src/types.ts" },
				{ timestamp: "2026-02-17T10:02:00.000Z", action: "modified", path: "src/types.ts" },
			],
		});
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		const countBadge = container.querySelector(".ft-activity-count");
		expect(countBadge).not.toBeNull();
		expect(countBadge!.textContent).toBe("×3");
	});

	it("does not show count badge for single-event files", () => {
		const session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "solo.md" },
			],
		});
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		expect(container.querySelector(".ft-activity-count")).toBeNull();
	});

	it("shows latest action badge for grouped files", () => {
		const session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "file.ts" },
				{ timestamp: "2026-02-17T10:05:00.000Z", action: "modified", path: "file.ts" },
			],
		});
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		const row = container.querySelector(".ft-activity-row")!;
		expect(row.textContent).toContain("modified");
	});

	it("renders empty state when no activity", () => {
		const session = makeSession({ activity: [] });
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		expect(container.textContent).toContain("No activity yet");
		expect(container.querySelectorAll(".ft-activity-row")).toHaveLength(0);
	});

	it("header shows total event count", () => {
		const session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "a.md" },
				{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "a.md" },
				{ timestamp: "2026-02-17T10:02:00.000Z", action: "created", path: "b.md" },
			],
		});
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		expect(container.textContent).toContain("(3)");
	});

	it("refreshList re-renders grouped rows", () => {
		let session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "a.md" },
			],
		});
		const deps = makeDeps(session);
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, deps);
		panel.render();

		expect(container.querySelectorAll(".ft-activity-row")).toHaveLength(1);

		// Simulate adding more activity (same file)
		session = makeSession({
			activity: [
				{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "a.md" },
				{ timestamp: "2026-02-17T10:05:00.000Z", action: "modified", path: "a.md" },
			],
		});
		deps.getSession = () => session;
		panel.refreshList();

		// Still 1 grouped row, but now with count badge
		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(1);
		expect(container.querySelector(".ft-activity-count")!.textContent).toBe("×2");
	});
});

// ── Display-time activity filtering ─────────────────────

describe("SessionActivityPanel — display-time filtering", () => {
	const activity: SessionActivity[] = [
		{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "src/types.ts" },
		{ timestamp: "2026-02-17T10:01:00.000Z", action: "modified", path: "docs/readme.md" },
		{ timestamp: "2026-02-17T10:02:00.000Z", action: "created", path: "src/helpers.ts" },
		{ timestamp: "2026-02-17T10:03:00.000Z", action: "modified", path: "tests/test.ts" },
	];

	it("global filter excludes matching entries from render", () => {
		const session = makeSession({ status: "running", activity });
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session, ["docs/"]));
		panel.render();

		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(3);
		expect(container.textContent).toContain("(3)");
		expect(container.textContent).not.toContain("readme.md");
	});

	it("per-session filter excludes matching entries from render", () => {
		const session = makeSession({ status: "running", activity, activityFilter: ["tests/"] });
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session));
		panel.render();

		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(3);
		expect(container.textContent).not.toContain("test.ts");
	});

	it("combines global and per-session filters", () => {
		const session = makeSession({ status: "running", activity, activityFilter: ["tests/"] });
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session, ["docs/"]));
		panel.render();

		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(2);
		expect(container.textContent).toContain("(2)");
	});

	it("filters work retroactively on stored entries", () => {
		// Activity was recorded without filter, then filter applied at display time
		const session = makeSession({ status: "running", activity });
		const globalFilter = ["src/"];
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session, globalFilter));
		panel.render();

		// Only docs/readme.md and tests/test.ts survive — src/ entries excluded
		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(2);
		expect(container.textContent).toContain("(2)");
	});

	it("completed session shows all activity (filters not applied)", () => {
		const session = makeSession({ status: "completed", activity, activityFilter: ["tests/"] });
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session, ["docs/"]));
		panel.render();

		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(4);
		expect(container.textContent).toContain("(4)");
	});

	it("archived session shows all activity (filters not applied)", () => {
		const session = makeSession({ status: "archived", activity, activityFilter: ["src/"] });
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session, ["docs/"]));
		panel.render();

		const rows = container.querySelectorAll(".ft-activity-row");
		expect(rows).toHaveLength(4);
		expect(container.textContent).toContain("(4)");
	});

	it("header count updates after refreshList with filter", () => {
		let session = makeSession({ status: "running", activity });
		const deps = makeDeps(session, ["docs/"]);
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, deps);
		panel.render();

		expect(container.textContent).toContain("(3)");

		// Simulate filter change — per-session filter added
		session = makeSession({ status: "running", activity, activityFilter: ["tests/"] });
		deps.getSession = () => session;
		panel.refreshList();

		expect(container.textContent).toContain("(2)");
	});

	it("shows empty state when all entries are filtered out", () => {
		const session = makeSession({
			status: "running",
			activity: [{ timestamp: "2026-02-17T10:00:00.000Z", action: "created", path: "src/a.ts" }],
		});
		const container = document.createElement("div");
		const panel = new SessionActivityPanel(container, makeDeps(session, ["src/"]));
		panel.render();

		expect(container.querySelectorAll(".ft-activity-row")).toHaveLength(0);
		expect(container.textContent).toContain("No activity yet");
		expect(container.textContent).toContain("(0)");
	});
});
