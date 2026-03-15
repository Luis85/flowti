import { describe, it, expect, vi } from "vitest";
import {
	createSession, updateSessionStatus, appendOutput,
	getSession, listSessions,
} from "../../../src/domain/agents/agent-session.js";
import type { SessionStoreDeps } from "../../../src/domain/agents/agent-session.js";

function makeDeps(): SessionStoreDeps & { files: Record<string, string>; dirs: Set<string> } {
	const files: Record<string, string> = {};
	const dirs = new Set<string>();
	return {
		files, dirs,
		disk: {
			readFileSync: vi.fn((p: string) => {
				if (files[p] === undefined) throw new Error(`File not found: ${p}`);
				return files[p];
			}),
			writeFileSync: vi.fn((p: string, c: string) => { files[p] = c; }),
			existsSync: vi.fn((p: string) => files[p] !== undefined || dirs.has(p)),
			mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
			readdirSync: vi.fn((dir: string) => {
				return Object.keys(files)
					.filter((f) => f.startsWith(dir + "/"))
					.map((f) => f.slice(dir.length + 1))
					.filter((f) => !f.includes("/"));
			}),
		} as unknown as SessionStoreDeps["disk"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		} as unknown as SessionStoreDeps["paths"],
		clock: {
			iso: vi.fn(() => "2026-03-15T10:00:00.000Z"),
			safeIso: vi.fn(() => `2026-03-15T10-00-00-${String(Math.random()).slice(2, 5)}Z`),
			now: vi.fn(() => new Date("2026-03-15T10:00:00.000Z")),
			ms: vi.fn(() => Date.now()),
		} as unknown as SessionStoreDeps["clock"],
	};
}

describe("createSession", () => {
	it("writes markdown with frontmatter and returns session object", () => {
		const deps = makeDeps();
		const session = createSession(deps, "/iter", "Architect", 5, "brief.md");
		expect(session.agentName).toBe("Architect");
		expect(session.iterationNumber).toBe(5);
		expect(session.status).toBe("spawning");
		expect(session.briefRef).toBe("brief.md");
		expect(session.id).toBeTruthy();
		const filePath = `/iter/sessions/session-${session.id}.md`;
		expect(deps.files[filePath]).toContain("agent: Architect");
		expect(deps.files[filePath]).toContain("status: spawning");
	});

	it("creates sessions directory if missing", () => {
		const deps = makeDeps();
		createSession(deps, "/iter", "Dev", 3, "ref.md");
		expect(deps.dirs.has("/iter/sessions")).toBe(true);
	});
});

describe("updateSessionStatus", () => {
	it("transitions status in frontmatter", () => {
		const deps = makeDeps();
		const session = createSession(deps, "/iter", "Dev", 3, "ref.md");
		const ok = updateSessionStatus(deps, "/iter", session.id, "running");
		expect(ok).toBe(true);
		const filePath = `/iter/sessions/session-${session.id}.md`;
		expect(deps.files[filePath]).toContain("status: running");
	});

	it("adds completedAt on completed status", () => {
		const deps = makeDeps();
		const session = createSession(deps, "/iter", "Dev", 3, "ref.md");
		updateSessionStatus(deps, "/iter", session.id, "completed");
		const filePath = `/iter/sessions/session-${session.id}.md`;
		expect(deps.files[filePath]).toContain("completedAt:");
	});

	it("returns false when session not found", () => {
		const deps = makeDeps();
		expect(updateSessionStatus(deps, "/iter", "missing", "running")).toBe(false);
	});
});

describe("appendOutput", () => {
	it("appends lines to session file", () => {
		const deps = makeDeps();
		const session = createSession(deps, "/iter", "Dev", 3, "ref.md");
		appendOutput(deps, "/iter", session.id, ["line 1", "line 2"]);
		const filePath = `/iter/sessions/session-${session.id}.md`;
		expect(deps.files[filePath]).toContain("line 1");
		expect(deps.files[filePath]).toContain("line 2");
	});

	it("returns false when session not found", () => {
		const deps = makeDeps();
		expect(appendOutput(deps, "/iter", "missing", ["line"])).toBe(false);
	});
});

describe("getSession", () => {
	it("parses frontmatter and output lines from markdown", () => {
		const deps = makeDeps();
		const session = createSession(deps, "/iter", "QA", 5, "qa-brief.md");
		updateSessionStatus(deps, "/iter", session.id, "running");
		appendOutput(deps, "/iter", session.id, ["test output"]);
		const loaded = getSession(deps, "/iter", session.id);
		expect(loaded).not.toBeNull();
		expect(loaded!.agentName).toBe("QA");
		expect(loaded!.status).toBe("running");
		expect(loaded!.outputLines).toContain("test output");
	});

	it("returns null when session not found", () => {
		const deps = makeDeps();
		expect(getSession(deps, "/iter", "nope")).toBeNull();
	});
});

describe("listSessions", () => {
	it("returns empty array when sessions dir missing", () => {
		const deps = makeDeps();
		expect(listSessions(deps, "/iter")).toEqual([]);
	});

	it("lists all sessions when no filter", () => {
		const deps = makeDeps();
		createSession(deps, "/iter", "Dev", 3, "d.md");
		createSession(deps, "/iter", "QA", 5, "q.md");
		const sessions = listSessions(deps, "/iter");
		expect(sessions).toHaveLength(2);
	});

	it("filters by iteration number", () => {
		const deps = makeDeps();
		createSession(deps, "/iter", "Dev", 3, "d.md");
		createSession(deps, "/iter", "QA", 5, "q.md");
		expect(listSessions(deps, "/iter", 3)).toHaveLength(1);
		expect(listSessions(deps, "/iter", 5)).toHaveLength(1);
		expect(listSessions(deps, "/iter", 99)).toHaveLength(0);
	});
});
