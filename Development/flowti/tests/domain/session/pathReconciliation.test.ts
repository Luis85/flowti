/**
 * Path Reconciliation Helper Tests
 *
 * Tests the pure helper functions for updating session and template paths
 * when files or folders are renamed/moved.
 *
 * Covers: Three Amigos OBS-3 — all 7 session path fields + template paths.
 */

import { describe, it, expect } from "vitest";
import type { Session, SessionTemplate } from "../../../src/domain/session/types";
import {
	updateSessionPathsForFileMove,
	updateSessionPathsForFolderMove,
	updateTemplatePathForFileMove,
	updateTemplatePathForFolderMove,
} from "../../../src/domain/session/helpers";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session_test-1",
		type: "event-storming",
		title: "Test Session",
		status: "prepared",
		durationMinutes: 25,
		createdAt: "2026-02-16T10:00:00.000Z",
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
		featureName: null,
		...overrides,
	};
}

function makeTemplate(overrides: Partial<SessionTemplate> = {}): SessionTemplate {
	return {
		id: "tmpl_test-1",
		name: "Test Template",
		type: "event-storming",
		durationMinutes: 25,
		createdAt: Date.now(),
		...overrides,
	};
}

// ── File Move ──────────────────────────────────────────────

describe("updateSessionPathsForFileMove", () => {
	it("updates focusFile when it matches oldPath", () => {
		const session = makeSession({ focusFile: "docs/old.md" });
		const result = updateSessionPathsForFileMove(session, "docs/old.md", "docs/new.md");
		expect(result).toBe(true);
		expect(session.focusFile).toBe("docs/new.md");
	});

	it("updates notesFile when it matches oldPath", () => {
		const session = makeSession({ notesFile: "notes/old.md" });
		const result = updateSessionPathsForFileMove(session, "notes/old.md", "notes/new.md");
		expect(result).toBe(true);
		expect(session.notesFile).toBe("notes/new.md");
	});

	it("updates canvasFile when it matches oldPath", () => {
		const session = makeSession({ canvasFile: "canvas/old.canvas" });
		const result = updateSessionPathsForFileMove(session, "canvas/old.canvas", "canvas/new.canvas");
		expect(result).toBe(true);
		expect(session.canvasFile).toBe("canvas/new.canvas");
	});

	it("updates contextBindings paths when they match oldPath", () => {
		const session = makeSession({
			contextBindings: [
				{ id: "ctx_1", type: "file", label: "old", path: "docs/old.md", boundAt: "2026-02-16T10:00:00.000Z" },
				{ id: "ctx_2", type: "file", label: "keep", path: "docs/keep.md", boundAt: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFileMove(session, "docs/old.md", "docs/new.md");
		expect(result).toBe(true);
		expect(session.contextBindings[0].path).toBe("docs/new.md");
		expect(session.contextBindings[1].path).toBe("docs/keep.md");
	});

	it("updates artifact paths when they match oldPath", () => {
		const session = makeSession({
			artifacts: [
				{ path: "docs/old.md", action: "created", timestamp: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFileMove(session, "docs/old.md", "docs/new.md");
		expect(result).toBe(true);
		expect(session.artifacts[0].path).toBe("docs/new.md");
	});

	it("updates link paths when they match oldPath", () => {
		const session = makeSession({
			links: [
				{ path: "docs/old.md", addedAt: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFileMove(session, "docs/old.md", "docs/new.md");
		expect(result).toBe(true);
		expect(session.links[0].path).toBe("docs/new.md");
	});

	it("returns false when no paths match", () => {
		const session = makeSession({ focusFile: "docs/other.md", notesFile: "notes/keep.md" });
		const result = updateSessionPathsForFileMove(session, "docs/old.md", "docs/new.md");
		expect(result).toBe(false);
		expect(session.focusFile).toBe("docs/other.md");
		expect(session.notesFile).toBe("notes/keep.md");
	});

	it("updates multiple fields in the same session", () => {
		const session = makeSession({
			focusFile: "docs/target.md",
			contextBindings: [
				{ id: "ctx_1", type: "file", label: "target", path: "docs/target.md", boundAt: "2026-02-16T10:00:00.000Z" },
			],
			artifacts: [
				{ path: "docs/target.md", action: "modified", timestamp: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFileMove(session, "docs/target.md", "docs/moved.md");
		expect(result).toBe(true);
		expect(session.focusFile).toBe("docs/moved.md");
		expect(session.contextBindings[0].path).toBe("docs/moved.md");
		expect(session.artifacts[0].path).toBe("docs/moved.md");
	});
});

// ── Folder Move ────────────────────────────────────────────

describe("updateSessionPathsForFolderMove", () => {
	it("updates focusFile under renamed folder", () => {
		const session = makeSession({ focusFile: "docs/features/plan.md" });
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.focusFile).toBe("docs/specs/plan.md");
	});

	it("updates notesFile under renamed folder", () => {
		const session = makeSession({ notesFile: "docs/features/notes.md" });
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.notesFile).toBe("docs/specs/notes.md");
	});

	it("updates canvasFile under renamed folder", () => {
		const session = makeSession({ canvasFile: "docs/features/board.canvas" });
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.canvasFile).toBe("docs/specs/board.canvas");
	});

	it("updates contextBindings paths under renamed folder", () => {
		const session = makeSession({
			contextBindings: [
				{ id: "ctx_1", type: "folder", label: "features/", path: "docs/features/", boundAt: "2026-02-16T10:00:00.000Z" },
				{ id: "ctx_2", type: "file", label: "plan", path: "docs/features/plan.md", boundAt: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.contextBindings[0].path).toBe("docs/specs/");
		expect(session.contextBindings[1].path).toBe("docs/specs/plan.md");
	});

	it("updates artifact paths under renamed folder", () => {
		const session = makeSession({
			artifacts: [
				{ path: "docs/features/output.md", action: "created", timestamp: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.artifacts[0].path).toBe("docs/specs/output.md");
	});

	it("updates link paths under renamed folder", () => {
		const session = makeSession({
			links: [
				{ path: "docs/features/ref.md", addedAt: "2026-02-16T10:00:00.000Z" },
			],
		});
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.links[0].path).toBe("docs/specs/ref.md");
	});

	it("updates activityFilter entries under renamed folder", () => {
		const session = makeSession({
			activityFilter: ["docs/features/drafts", "docs/features"],
		});
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.activityFilter[0]).toBe("docs/specs/drafts");
		expect(session.activityFilter[1]).toBe("docs/specs");
	});

	it("does not update paths outside renamed folder", () => {
		const session = makeSession({ focusFile: "other/plan.md", notesFile: "other/notes.md" });
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(false);
		expect(session.focusFile).toBe("other/plan.md");
		expect(session.notesFile).toBe("other/notes.md");
	});

	it("updates all 7 fields in a single session", () => {
		const session = makeSession({
			focusFile: "docs/features/plan.md",
			notesFile: "docs/features/notes.md",
			canvasFile: "docs/features/board.canvas",
			contextBindings: [
				{ id: "ctx_1", type: "folder", label: "features/", path: "docs/features/", boundAt: "2026-02-16T10:00:00.000Z" },
			],
			artifacts: [
				{ path: "docs/features/output.md", action: "created", timestamp: "2026-02-16T10:00:00.000Z" },
			],
			links: [
				{ path: "docs/features/ref.md", addedAt: "2026-02-16T10:00:00.000Z" },
			],
			activityFilter: ["docs/features/drafts"],
		});
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(true);
		expect(session.focusFile).toBe("docs/specs/plan.md");
		expect(session.notesFile).toBe("docs/specs/notes.md");
		expect(session.canvasFile).toBe("docs/specs/board.canvas");
		expect(session.contextBindings[0].path).toBe("docs/specs/");
		expect(session.artifacts[0].path).toBe("docs/specs/output.md");
		expect(session.links[0].path).toBe("docs/specs/ref.md");
		expect(session.activityFilter[0]).toBe("docs/specs/drafts");
	});

	it("does not match the folder name as a prefix of a sibling", () => {
		const session = makeSession({ focusFile: "docs/features-v2/plan.md" });
		const result = updateSessionPathsForFolderMove(session, "docs/features", "docs/specs");
		expect(result).toBe(false);
		expect(session.focusFile).toBe("docs/features-v2/plan.md");
	});
});

// ── Template File Move ─────────────────────────────────────

describe("updateTemplatePathForFileMove", () => {
	it("updates focusFile when it matches oldPath", () => {
		const tmpl = makeTemplate({ focusFile: "docs/old.md" });
		const result = updateTemplatePathForFileMove(tmpl, "docs/old.md", "docs/new.md");
		expect(result).toBe(true);
		expect(tmpl.focusFile).toBe("docs/new.md");
	});

	it("returns false when focusFile does not match", () => {
		const tmpl = makeTemplate({ focusFile: "docs/other.md" });
		const result = updateTemplatePathForFileMove(tmpl, "docs/old.md", "docs/new.md");
		expect(result).toBe(false);
		expect(tmpl.focusFile).toBe("docs/other.md");
	});

	it("returns false when focusFile is undefined", () => {
		const tmpl = makeTemplate();
		const result = updateTemplatePathForFileMove(tmpl, "docs/old.md", "docs/new.md");
		expect(result).toBe(false);
	});
});

// ── Template Folder Move ───────────────────────────────────

describe("updateTemplatePathForFolderMove", () => {
	it("updates focusFile under renamed folder", () => {
		const tmpl = makeTemplate({ focusFile: "docs/old-folder/focus.md" });
		const result = updateTemplatePathForFolderMove(tmpl, "docs/old-folder", "docs/new-folder");
		expect(result).toBe(true);
		expect(tmpl.focusFile).toBe("docs/new-folder/focus.md");
	});

	it("returns false when focusFile is outside renamed folder", () => {
		const tmpl = makeTemplate({ focusFile: "other/focus.md" });
		const result = updateTemplatePathForFolderMove(tmpl, "docs/old-folder", "docs/new-folder");
		expect(result).toBe(false);
		expect(tmpl.focusFile).toBe("other/focus.md");
	});

	it("returns false when focusFile is undefined", () => {
		const tmpl = makeTemplate();
		const result = updateTemplatePathForFolderMove(tmpl, "docs/old-folder", "docs/new-folder");
		expect(result).toBe(false);
	});
});
