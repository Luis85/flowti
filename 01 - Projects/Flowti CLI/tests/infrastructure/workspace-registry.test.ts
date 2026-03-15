/**
 * workspace-registry.test.ts — Tests for WorkspaceRegistry (in-memory + flush-on-mutate).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createWorkspaceRegistry, type IWorkspaceRegistry } from "../../src/infrastructure/workspace-registry.js";
import type { AgentWorkspace } from "../../src/domain/agents/agent-workspace.js";
import type { IFileSystem } from "../../src/infrastructure/types.js";

function mockDisk(data: Record<string, string> = {}): IFileSystem {
	const files = new Map(Object.entries(data));
	return {
		existsSync: (p: string) => files.has(p),
		readFileSync: (p: string) => { const c = files.get(p); if (!c) throw new Error("ENOENT"); return c; },
		writeFileSync: (p: string, c: string) => { files.set(p, c); },
		mkdirSync: () => {},
	} as unknown as IFileSystem;
}

const ws1: AgentWorkspace = {
	id: "ws-bob-auth-a3f2",
	agentSlug: "bob",
	branch: "agent/bob/auth",
	baseBranch: "master",
	method: "worktree",
	state: "active",
	path: "/tmp/ws-bob-auth-a3f2",
	pid: 1234,
	processName: "claude.exe",
	retain: false,
	createdAt: "2026-03-15T10:00:00Z",
	collectResult: null,
};

describe("WorkspaceRegistry", () => {
	let registry: IWorkspaceRegistry;
	let disk: IFileSystem;

	beforeEach(() => {
		disk = mockDisk();
		registry = createWorkspaceRegistry({ disk } as never, "/vault/.flowti/var/workspace-registry.json");
	});

	it("starts empty when no file exists", () => {
		expect(registry.list()).toEqual([]);
	});

	it("loads existing data from disk", () => {
		const existingDisk = mockDisk({
			"/vault/.flowti/var/workspace-registry.json": JSON.stringify({ workspaces: [ws1] }),
		});
		const reg = createWorkspaceRegistry({ disk: existingDisk } as never, "/vault/.flowti/var/workspace-registry.json");
		expect(reg.list()).toHaveLength(1);
		expect(reg.list()[0].id).toBe("ws-bob-auth-a3f2");
	});

	it("registers and retrieves a workspace", () => {
		registry.register(ws1);
		expect(registry.get("ws-bob-auth-a3f2")).toEqual(ws1);
	});

	it("updates a workspace", () => {
		registry.register(ws1);
		const updated: AgentWorkspace = { ...ws1, state: "collecting" };
		registry.update(updated);
		expect(registry.get("ws-bob-auth-a3f2")?.state).toBe("collecting");
	});

	it("removes a workspace", () => {
		registry.register(ws1);
		registry.remove("ws-bob-auth-a3f2");
		expect(registry.get("ws-bob-auth-a3f2")).toBeNull();
	});

	it("lists active workspaces", () => {
		registry.register(ws1);
		const disposed: AgentWorkspace = { ...ws1, id: "ws-alice-test-b7c1", state: "disposed" };
		registry.register(disposed);
		const active = registry.listByState("active");
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe("ws-bob-auth-a3f2");
	});

	it("counts active workspaces", () => {
		registry.register(ws1);
		expect(registry.activeCount()).toBe(1);
	});

	it("counts provision and ready states as active", () => {
		const provisioning: AgentWorkspace = { ...ws1, id: "ws-charlie-prov-0001", state: "provision" };
		const ready: AgentWorkspace = { ...ws1, id: "ws-charlie-ready-0002", state: "ready" };
		registry.register(provisioning);
		registry.register(ready);
		expect(registry.activeCount()).toBe(2);
	});

	it("does not count disposed or retained in activeCount", () => {
		const disposed: AgentWorkspace = { ...ws1, id: "ws-d-0001", state: "disposed" };
		const retained: AgentWorkspace = { ...ws1, id: "ws-r-0001", state: "retained" };
		registry.register(disposed);
		registry.register(retained);
		expect(registry.activeCount()).toBe(0);
	});

	it("flushes to disk on register", () => {
		registry.register(ws1);
		const written = (disk as unknown as { readFileSync(p: string): string }).readFileSync("/vault/.flowti/var/workspace-registry.json");
		const parsed = JSON.parse(written);
		expect(parsed.workspaces).toHaveLength(1);
	});

	it("flushes to disk on update", () => {
		registry.register(ws1);
		const updated: AgentWorkspace = { ...ws1, state: "collecting" };
		registry.update(updated);
		const written = (disk as unknown as { readFileSync(p: string): string }).readFileSync("/vault/.flowti/var/workspace-registry.json");
		const parsed = JSON.parse(written);
		expect(parsed.workspaces[0].state).toBe("collecting");
	});

	it("flushes to disk on remove", () => {
		registry.register(ws1);
		registry.remove("ws-bob-auth-a3f2");
		const written = (disk as unknown as { readFileSync(p: string): string }).readFileSync("/vault/.flowti/var/workspace-registry.json");
		const parsed = JSON.parse(written);
		expect(parsed.workspaces).toHaveLength(0);
	});

	it("handles corrupt file gracefully — starts empty", () => {
		const corruptDisk = mockDisk({
			"/vault/.flowti/var/workspace-registry.json": "NOT JSON",
		});
		const reg = createWorkspaceRegistry({ disk: corruptDisk } as never, "/vault/.flowti/var/workspace-registry.json");
		expect(reg.list()).toEqual([]);
	});
});
