import { describe, it, expect } from "vitest";
import {
	createWorkspace,
	transitionState,
	generateWorkspaceId,
	generateBranchName,
	COLLECT_SKIPPED_SENTINEL,
	type AgentWorkspace,
} from "../../../src/domain/agents/agent-workspace.js";

describe("generateWorkspaceId", () => {
	it("produces ws-{slug}-{suffix}-{hex} format", () => {
		const id = generateWorkspaceId("bob", "feat/auth");
		expect(id).toMatch(/^ws-bob-auth-[0-9a-f]{4}$/);
	});

	it("sanitizes branch slashes to last segment", () => {
		const id = generateWorkspaceId("alice", "agent/alice/fix-tests");
		expect(id).toMatch(/^ws-alice-fix-tests-[0-9a-f]{4}$/);
	});

	it("truncates long branch suffixes", () => {
		const id = generateWorkspaceId("bob", "feat/very-long-branch-name-that-exceeds-limit");
		const parts = id.split("-");
		const suffix = parts.slice(2, -1).join("-");
		expect(suffix.length).toBeLessThanOrEqual(20);
	});
});

describe("generateBranchName", () => {
	it("creates agent/{slug}/{task-slug} format", () => {
		const branch = generateBranchName("bob", "Add auth middleware", "agent/");
		expect(branch).toBe("agent/bob/add-auth");
	});

	it("uses custom prefix", () => {
		const branch = generateBranchName("alice", "Fix tests", "feature/");
		expect(branch).toBe("feature/alice/fix-test");
	});

	it("truncates task slug to 8 chars", () => {
		const branch = generateBranchName("bob", "Implement the full authentication system", "agent/");
		const taskSlug = branch.split("/")[2];
		expect(taskSlug.length).toBeLessThanOrEqual(8);
	});
});

describe("createWorkspace", () => {
	it("initializes with provision state", () => {
		const ws = createWorkspace({
			agentSlug: "bob",
			branch: "agent/bob/auth",
			baseBranch: "master",
			method: "worktree",
			path: "/tmp/ws-bob-auth-a3f2",
			retain: false,
			createdAt: "2026-03-15T10:00:00Z",
		});
		expect(ws.state).toBe("provision");
		expect(ws.collectResult).toBeNull();
		expect(ws.pid).toBeUndefined();
	});
});

describe("transitionState", () => {
	const base: AgentWorkspace = {
		id: "ws-bob-auth-a3f2",
		agentSlug: "bob",
		branch: "agent/bob/auth",
		baseBranch: "master",
		method: "worktree",
		state: "provision",
		path: "/tmp/ws-bob-auth-a3f2",
		retain: false,
		createdAt: "2026-03-15T10:00:00Z",
		collectResult: null,
	};

	it("transitions provision -> ready", () => {
		const next = transitionState(base, "ready");
		expect(next.state).toBe("ready");
	});

	it("transitions ready -> active with pid", () => {
		const ready = { ...base, state: "ready" as const };
		const next = transitionState(ready, "active", { pid: 1234, processName: "claude.exe" });
		expect(next.state).toBe("active");
		expect(next.pid).toBe(1234);
		expect(next.processName).toBe("claude.exe");
	});

	it("transitions active -> collecting", () => {
		const active = { ...base, state: "active" as const, pid: 1234 };
		const next = transitionState(active, "collecting");
		expect(next.state).toBe("collecting");
	});

	it("transitions collecting -> disposed", () => {
		const collecting = { ...base, state: "collecting" as const };
		const next = transitionState(collecting, "disposed", { completedAt: "2026-03-15T11:00:00Z" });
		expect(next.state).toBe("disposed");
		expect(next.completedAt).toBe("2026-03-15T11:00:00Z");
	});

	it("transitions collecting -> retained", () => {
		const collecting = { ...base, state: "collecting" as const, retain: true };
		const next = transitionState(collecting, "retained", { completedAt: "2026-03-15T11:00:00Z" });
		expect(next.state).toBe("retained");
	});

	it("throws on invalid transition provision -> active", () => {
		expect(() => transitionState(base, "active")).toThrow("Invalid transition");
	});

	it("throws on invalid transition disposed -> ready", () => {
		const disposed = { ...base, state: "disposed" as const };
		expect(() => transitionState(disposed, "ready")).toThrow("Invalid transition");
	});
});

describe("COLLECT_SKIPPED_SENTINEL", () => {
	it("has empty arrays and collectSkipped error", () => {
		expect(COLLECT_SKIPPED_SENTINEL.commits).toEqual([]);
		expect(COLLECT_SKIPPED_SENTINEL.errors).toContain("collectSkipped");
	});
});
