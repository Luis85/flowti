/**
 * state-collector.test.ts — Tests for StateCollector merge, conversation append, and git scan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "" }));

import { createStateCollector, type IStateCollector, type CollectorDeps } from "../../src/infrastructure/state-collector.js";
import type { AgentWorkspace } from "../../src/domain/agents/agent-workspace.js";

function asDeps(deps: ReturnType<typeof createMockDeps>): CollectorDeps {
	return deps as unknown as CollectorDeps;
}

function createMockDeps(filesData: Record<string, string> = {}) {
	const files = new Map(Object.entries(filesData));
	return {
		disk: {
			existsSync: (p: string) => files.has(p),
			readFileSync: (p: string) => files.get(p) ?? "",
			writeFileSync: (p: string, c: string) => files.set(p, c),
			mkdirSync: () => {},
		},
		paths: {
			join: (...parts: string[]) => parts.join("/"),
		},
		shell: {
			runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
		},
		files,
	};
}

const baseWs: AgentWorkspace = {
	id: "ws-bob-auth-a3f2",
	agentSlug: "bob",
	branch: "agent/bob/auth",
	baseBranch: "master",
	method: "worktree",
	state: "collecting",
	path: "/workspace",
	retain: false,
	createdAt: "2026-03-15T10:00:00Z",
	collectResult: null,
};

describe("StateCollector", () => {
	it("merges workspace runtime state into central state", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"active","tasks":[{"name":"auth"}]}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle","tasks":[]}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/data-bob.json")!);
		expect(central.status).toBe("active");
	});

	it("preserves central fields not present in workspace state", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"active"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle","xp":42}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/data-bob.json")!);
		expect(central.xp).toBe(42);
		expect(central.status).toBe("active");
	});

	it("creates central state when it does not exist", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"done"}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/data-bob.json")!);
		expect(central.status).toBe("done");
	});

	it("returns empty runtime state when workspace state file is missing", async () => {
		const deps = createMockDeps({
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		expect(result.runtimeState).toEqual({});
	});

	it("scans git log for new commits", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		(deps.shell.runCaptureDetailed as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
			if (cmd.includes("git log")) {
				return { stdout: "abc1234\ndef5678\n", stderr: "", exitCode: 0 };
			}
			if (cmd.includes("git diff --stat")) {
				return { stdout: " 3 files changed\n", stderr: "", exitCode: 0 };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		expect(result.commits).toEqual(["abc1234", "def5678"]);
	});

	it("scans git diff for files changed count", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		(deps.shell.runCaptureDetailed as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
			if (cmd.includes("git log")) {
				return { stdout: "abc1234\n", stderr: "", exitCode: 0 };
			}
			if (cmd.includes("git diff --stat")) {
				return { stdout: " 5 files changed, 100 insertions(+)\n", stderr: "", exitCode: 0 };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		expect(result.filesChanged).toBe(5);
	});

	it("returns zero commits when git scan fails", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		(deps.shell.runCaptureDetailed as ReturnType<typeof vi.fn>).mockReturnValue({ stdout: "", stderr: "error", exitCode: 1 });
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		expect(result.commits).toEqual([]);
		expect(result.errors).toContain("git scan failed");
	});

	it("appends conversation threads", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/workspace/.flowti/var/conversations/bob.json": '{"threads":[{"role":"user","content":"hello"}]}',
			"/vault/.flowti/var/conversations/bob.json": '{"threads":[]}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/conversations/bob.json")!);
		expect(central.threads).toHaveLength(1);
		expect(result.conversationTurns).toBe(1);
	});

	it("creates central conversation when it does not exist", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/workspace/.flowti/var/conversations/bob.json": '{"threads":[{"role":"user","content":"hi"},{"role":"assistant","content":"hey"}]}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/conversations/bob.json")!);
		expect(central.threads).toHaveLength(2);
		expect(result.conversationTurns).toBe(2);
	});

	it("returns zero conversation turns when workspace has no conversations", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		expect(result.conversationTurns).toBe(0);
	});

	it("returns zero files changed and empty commits on empty git output", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		const collector = createStateCollector(asDeps(deps), "/vault");
		const result = await collector.collect(baseWs);
		expect(result.commits).toEqual([]);
		expect(result.filesChanged).toBe(0);
		expect(result.errors).toEqual([]);
	});
});
