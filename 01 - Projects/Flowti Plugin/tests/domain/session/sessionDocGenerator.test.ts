import { describe, it, expect } from "vitest";
import { getSessionDocPath, generateSessionDoc } from "../../../src/domain/session/sessionDocGenerator";
import type { Session } from "../../../src/domain/session/types";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "sess-abc123",
		type: "documentation",
		title: "Test Session",
		status: "completed",
		durationMinutes: 25,
		createdAt: "2026-03-06T09:00:00Z",
		startedAt: "2026-03-06T09:00:00Z",
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: "2026-03-06T09:25:00Z",
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

describe("getSessionDocPath", () => {
	it("generates path with date prefix and short ID", () => {
		const session = makeSession();
		const path = getSessionDocPath(session);
		expect(path).toContain("2026-03-06");
		expect(path).toContain("c123");
		expect(path).toContain("Test Session");
		expect(path).toContain("Summaries/");
	});

	it("sanitizes unsafe characters in title", () => {
		const session = makeSession({ title: "Test: \"Session\" <1>" });
		const path = getSessionDocPath(session);
		expect(path).not.toContain(":");
		expect(path).not.toContain("\"");
		expect(path).not.toContain("<");
		expect(path).not.toContain(">");
	});
});

describe("generateSessionDoc", () => {
	it("generates frontmatter with sessionId and type", () => {
		const doc = generateSessionDoc(makeSession());
		expect(doc).toContain("type: SessionSummary");
		expect(doc).toContain("sess-abc123");
		expect(doc).toContain("documentation");
	});

	it("includes artifacts section when present", () => {
		const doc = generateSessionDoc(makeSession({
			artifacts: [
				{ path: "notes/new.md", action: "created", timestamp: "2026-03-06T09:05:00Z" },
			],
		}));
		expect(doc).toContain("## Artifacts");
		expect(doc).toContain("[[notes/new.md]]");
		expect(doc).toContain("*(created)*");
	});

	it("omits artifacts section when empty", () => {
		const doc = generateSessionDoc(makeSession());
		expect(doc).not.toContain("## Artifacts");
	});

	it("includes decisions section", () => {
		const doc = generateSessionDoc(makeSession({
			decisions: [
				{ id: "d1", title: "Use Zod", description: "For validation", recordedAt: "2026-03-06T09:10:00Z" },
			],
		}));
		expect(doc).toContain("## Decisions");
		expect(doc).toContain("**Use Zod**");
		expect(doc).toContain("For validation");
	});

	it("includes reflections section", () => {
		const doc = generateSessionDoc(makeSession({
			reflections: [
				{ id: "r1", type: "observation", content: "Works well", timestamp: "2026-03-06T09:15:00Z" },
			],
		}));
		expect(doc).toContain("## Reflections");
		expect(doc).toContain("**[observation]**");
		expect(doc).toContain("Works well");
	});

	it("includes closure response when present", () => {
		const doc = generateSessionDoc(makeSession({
			closureResponse: {
				outcomeAchieved: "yes",
				whatWorked: "Focus",
				whatDidnt: "Nothing",
				nextAction: "Continue",
				answers: {},
			},
		}));
		expect(doc).toContain("## Closure");
		expect(doc).toContain("**Outcome:** yes");
		expect(doc).toContain("**Next action:** Continue");
	});

	it("links back to session notes file", () => {
		const doc = generateSessionDoc(makeSession({ notesFile: "03 - Resources/Sessions/notes.md" }));
		expect(doc).toContain("[[03 - Resources/Sessions/notes.md]]");
	});

	it("handles session with no optional data gracefully", () => {
		const doc = generateSessionDoc(makeSession());
		expect(doc).toContain("# Test Session — Summary");
		expect(doc).toContain("**Duration:** 25 min");
		expect(doc).not.toContain("## Artifacts");
		expect(doc).not.toContain("## Decisions");
		expect(doc).not.toContain("## Reflections");
		expect(doc).not.toContain("## Closure");
	});
});
