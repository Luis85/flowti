/**
 * agent-shell.test.ts — Tests for AgentShell composition layer.
 *
 * AgentShell orchestrates workspace lifecycle: provision, inject state,
 * spawn agent process, collect results, dispose/retain workspace.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createAgentShell } from "../../src/infrastructure/agent-shell.js";
import type { IWorkspaceRegistry } from "../../src/infrastructure/workspace-registry.js";
import type { IWorkspaceProvisioner } from "../../src/infrastructure/workspace-provisioner.js";
import type { IStateSplitter } from "../../src/infrastructure/state-splitter.js";
import type { IStateCollector } from "../../src/infrastructure/state-collector.js";
import type { IAgentProcessRunner, AgentProcess } from "../../src/domain/agents/worker-types.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";
import type { WorkspacesConfig } from "../../src/infrastructure/types-config.js";
import type { IClock } from "../../src/infrastructure/types.js";
import type { ICliBus } from "../../src/infrastructure/event-bus.js";
import type { AgentWorkspace } from "../../src/domain/agents/agent-workspace.js";

// ── Mock factories ──────────────────────────────────────────────────

function createMockRegistry(): IWorkspaceRegistry {
	const store = new Map<string, AgentWorkspace>();
	return {
		list: () => [...store.values()],
		listByState: (s: string) => [...store.values()].filter((ws) => ws.state === s),
		get: (id: string) => store.get(id) ?? null,
		register: (ws: AgentWorkspace) => store.set(ws.id, ws),
		update: (ws: AgentWorkspace) => store.set(ws.id, ws),
		remove: (id: string) => { store.delete(id); },
		activeCount: () => [...store.values()].filter((ws) => ["active", "provision", "ready"].includes(ws.state)).length,
	};
}

function createMockProvisioner(): IWorkspaceProvisioner {
	return {
		provision: vi.fn(() => ({ path: "/agents/ws-bob-auth-a3f2", method: "worktree" as const, branch: "agent/bob/auth" })),
		dispose: vi.fn(),
	};
}

function createMockSplitter(): IStateSplitter {
	return { inject: vi.fn() };
}

function createMockCollector(): IStateCollector {
	return {
		collect: vi.fn(async () => ({
			commits: ["abc1234"],
			filesChanged: 3,
			conversationTurns: 2,
			runtimeState: { status: "idle" },
			errors: [],
		})),
	};
}

function createMockProcessRunner(): IAgentProcessRunner {
	return {
		spawn: vi.fn((): AgentProcess => ({
			onEvent: () => () => {},
			result: Promise.resolve({ text: "done", thinking: "", exitCode: 0 }),
			kill: () => {},
		})),
	};
}

function createMockAgentFinder(): (slug: string) => AgentSummary | null {
	return (slug: string) => ({
		name: slug,
		agentType: "ai" as const,
		description: "test agent",
		skills: [],
		tools: [],
		roles: [],
		file: `${slug}.md`,
	});
}

function createMockClock(): IClock {
	return {
		iso: () => "2026-03-15T10:00:00Z",
		ms: () => new Date("2026-03-15T10:00:00Z").getTime(),
		now: () => new Date("2026-03-15T10:00:00Z"),
		safeIso: () => "2026-03-15",
	};
}

function createMockBus(): ICliBus {
	return {
		emit: vi.fn(),
		on: () => () => {},
		once: () => () => {},
		clear: () => {},
	} as unknown as ICliBus;
}

const defaultConfig: WorkspacesConfig = {
	baseDir: "/agents",
	defaultRetain: false,
	retentionMaxAge: 604800000,
	maxConcurrent: 5,
	branchPrefix: "agent/",
};

interface ShellDeps {
	registry: IWorkspaceRegistry;
	provisioner: IWorkspaceProvisioner;
	splitter: IStateSplitter;
	collector: IStateCollector;
	processRunner: IAgentProcessRunner;
	agentFinder: (slug: string) => AgentSummary | null;
	config: WorkspacesConfig;
	clock: IClock;
	bus: ICliBus;
}

function createShellDeps(overrides?: Partial<ShellDeps>): ShellDeps {
	return {
		registry: createMockRegistry(),
		provisioner: createMockProvisioner(),
		splitter: createMockSplitter(),
		collector: createMockCollector(),
		processRunner: createMockProcessRunner(),
		agentFinder: createMockAgentFinder(),
		config: defaultConfig,
		clock: createMockClock(),
		bus: createMockBus(),
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("AgentShell", () => {
	describe("dispatch", () => {
		it("provisions workspace, injects state, and spawns process", async () => {
			const deps = createShellDeps();
			const shell = createAgentShell(deps);

			const result = await shell.dispatch({ agent: "bob", task: "Add auth" });

			expect(result.workspace.agentSlug).toBe("bob");
			expect(result.workspace.state).toBe("active");
			expect(result.branch).toBe("agent/bob/add-auth");
			expect(deps.provisioner.provision).toHaveBeenCalled();
			expect(deps.splitter.inject).toHaveBeenCalledWith("bob", "/agents/ws-bob-auth-a3f2");
		});

		it("emits provisioned, ready, and active events", async () => {
			const deps = createShellDeps();
			const shell = createAgentShell(deps);

			await shell.dispatch({ agent: "bob", task: "Add auth" });

			expect(deps.bus.emit).toHaveBeenCalledWith("workspace:provisioned", expect.objectContaining({ method: "worktree" }));
			expect(deps.bus.emit).toHaveBeenCalledWith("workspace:ready", expect.objectContaining({ workspace: expect.objectContaining({ state: "ready" }) }));
			expect(deps.bus.emit).toHaveBeenCalledWith("workspace:active", expect.objectContaining({ workspace: expect.objectContaining({ state: "active" }) }));
		});

		it("passes allowedTools to process runner", async () => {
			const deps = createShellDeps();
			const shell = createAgentShell(deps);

			await shell.dispatch({ agent: "bob", task: "lint", allowedTools: ["Read", "Write"] });

			expect(deps.processRunner.spawn).toHaveBeenCalledWith(
				expect.objectContaining({ name: "bob" }),
				"lint",
				["Read", "Write"],
				expect.objectContaining({ cwd: "/agents/ws-bob-auth-a3f2" }),
			);
		});

		it("uses custom branch when provided", async () => {
			const deps = createShellDeps();
			const shell = createAgentShell(deps);

			const result = await shell.dispatch({ agent: "bob", task: "test", branch: "custom/branch" });

			expect(result.branch).toBe("custom/branch");
		});

		it("rejects when maxConcurrent is reached", async () => {
			const registry = createMockRegistry();
			for (let i = 0; i < 5; i++) {
				registry.register({
					id: `ws-${i}`, state: "active", agentSlug: "x",
					branch: "b", baseBranch: "m", method: "worktree",
					path: "/p", retain: false, createdAt: "", collectResult: null,
				});
			}

			const shell = createAgentShell(createShellDeps({ registry }));

			await expect(shell.dispatch({ agent: "bob", task: "test" })).rejects.toThrow("5/5 workspaces active");
		});

		it("rejects when agent is not found and not adhoc", async () => {
			const deps = createShellDeps({ agentFinder: () => null });
			const shell = createAgentShell(deps);

			await expect(shell.dispatch({ agent: "unknown", task: "test" })).rejects.toThrow('Agent "unknown" not found');
		});

		it("allows dispatch for adhoc agent even when agentFinder returns null", async () => {
			const deps = createShellDeps({ agentFinder: () => null });
			const shell = createAgentShell(deps);

			const result = await shell.dispatch({ agent: "adhoc", task: "quick fix" });

			expect(result.workspace.agentSlug).toBe("adhoc");
		});

		it("collects and disposes when process completes (retain=false)", async () => {
			const deps = createShellDeps();
			const shell = createAgentShell(deps);

			const result = await shell.dispatch({ agent: "bob", task: "test" });
			await result.output;

			expect(deps.collector.collect).toHaveBeenCalled();
			expect(deps.provisioner.dispose).toHaveBeenCalled();
			expect(deps.bus.emit).toHaveBeenCalledWith("workspace:disposed", expect.any(Object));
		});

		it("retains workspace when retain=true", async () => {
			const deps = createShellDeps();
			const shell = createAgentShell(deps);

			const result = await shell.dispatch({ agent: "bob", task: "test", retain: true });
			await result.output;

			expect(deps.provisioner.dispose).not.toHaveBeenCalled();
			expect(deps.bus.emit).toHaveBeenCalledWith("workspace:retained", expect.any(Object));
		});

		it("uses defaultRetain from config when retain not specified", async () => {
			const deps = createShellDeps({ config: { ...defaultConfig, defaultRetain: true } });
			const shell = createAgentShell(deps);

			const result = await shell.dispatch({ agent: "bob", task: "test" });
			await result.output;

			expect(deps.provisioner.dispose).not.toHaveBeenCalled();
			expect(deps.bus.emit).toHaveBeenCalledWith("workspace:retained", expect.any(Object));
		});
	});

	describe("list", () => {
		it("returns all registered workspaces", () => {
			const registry = createMockRegistry();
			registry.register({
				id: "ws-1", state: "active", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: false, createdAt: "", collectResult: null,
			});
			registry.register({
				id: "ws-2", state: "retained", agentSlug: "alice",
				branch: "b2", baseBranch: "m", method: "clone",
				path: "/p2", retain: true, createdAt: "", collectResult: null,
			});

			const shell = createAgentShell(createShellDeps({ registry }));

			expect(shell.list()).toHaveLength(2);
		});

		it("returns empty array when no workspaces exist", () => {
			const shell = createAgentShell(createShellDeps());
			expect(shell.list()).toHaveLength(0);
		});
	});

	describe("collect", () => {
		it("collects results from workspace in collecting state", async () => {
			const registry = createMockRegistry();
			registry.register({
				id: "ws-1", state: "collecting", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: false, createdAt: "", collectResult: null,
			});

			const shell = createAgentShell(createShellDeps({ registry }));
			const result = await shell.collect("ws-1");

			expect(result.commits).toEqual(["abc1234"]);
			expect(result.filesChanged).toBe(3);
		});

		it("throws for unknown workspace", async () => {
			const shell = createAgentShell(createShellDeps());
			await expect(shell.collect("nonexistent")).rejects.toThrow('Workspace "nonexistent" not found');
		});

		it("returns existing collectResult for disposed workspace", async () => {
			const registry = createMockRegistry();
			registry.register({
				id: "ws-1", state: "disposed", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: false, createdAt: "",
				collectResult: { commits: ["x"], filesChanged: 1, conversationTurns: 0, runtimeState: {}, errors: [] },
			});

			const shell = createAgentShell(createShellDeps({ registry }));
			const result = await shell.collect("ws-1");

			expect(result.commits).toEqual(["x"]);
		});

		it("throws when workspace is in active state", async () => {
			const registry = createMockRegistry();
			registry.register({
				id: "ws-1", state: "active", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: false, createdAt: "", collectResult: null,
			});

			const shell = createAgentShell(createShellDeps({ registry }));
			await expect(shell.collect("ws-1")).rejects.toThrow('Cannot collect workspace in "active" state');
		});
	});

	describe("dispose", () => {
		it("disposes workspace and removes from registry", async () => {
			const registry = createMockRegistry();
			registry.register({
				id: "ws-1", state: "retained", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: true, createdAt: "", collectResult: null,
			});

			const deps = createShellDeps({ registry });
			const shell = createAgentShell(deps);

			await shell.dispose("ws-1");

			expect(deps.provisioner.dispose).toHaveBeenCalledWith("/p", "worktree");
			expect(registry.get("ws-1")).toBeNull();
		});

		it("throws for unknown workspace", async () => {
			const shell = createAgentShell(createShellDeps());
			await expect(shell.dispose("nonexistent")).rejects.toThrow('Workspace "nonexistent" not found');
		});
	});

	describe("prune", () => {
		it("removes old retained workspaces", async () => {
			const registry = createMockRegistry();
			const oldDate = new Date(Date.now() - 999999999).toISOString();
			registry.register({
				id: "ws-old", state: "retained", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: true, createdAt: oldDate, collectResult: null,
			});

			const deps = createShellDeps({ registry });
			const shell = createAgentShell(deps);

			const summary = await shell.prune();

			expect(summary.removed).toBe(1);
			expect(deps.provisioner.dispose).toHaveBeenCalled();
		});

		it("skips recent workspaces", async () => {
			const registry = createMockRegistry();
			registry.register({
				id: "ws-new", state: "retained", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: true, createdAt: new Date().toISOString(), collectResult: null,
			});

			const shell = createAgentShell(createShellDeps({ registry }));
			const summary = await shell.prune();

			expect(summary.removed).toBe(0);
			expect(summary.skipped).toBe(1);
		});

		it("supports dryRun mode", async () => {
			const registry = createMockRegistry();
			const oldDate = new Date(Date.now() - 999999999).toISOString();
			registry.register({
				id: "ws-old", state: "retained", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: true, createdAt: oldDate, collectResult: null,
			});

			const deps = createShellDeps({ registry });
			const shell = createAgentShell(deps);

			const summary = await shell.prune({ dryRun: true });

			expect(summary.removed).toBe(1);
			expect(deps.provisioner.dispose).not.toHaveBeenCalled();
			expect(registry.get("ws-old")).not.toBeNull();
		});

		it("filters by state when specified", async () => {
			const registry = createMockRegistry();
			const oldDate = new Date(Date.now() - 999999999).toISOString();
			registry.register({
				id: "ws-ret", state: "retained", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: true, createdAt: oldDate, collectResult: null,
			});
			registry.register({
				id: "ws-disp", state: "disposed", agentSlug: "alice",
				branch: "b2", baseBranch: "m", method: "clone",
				path: "/p2", retain: false, createdAt: oldDate, collectResult: null,
			});

			const shell = createAgentShell(createShellDeps({ registry }));
			const summary = await shell.prune({ state: "disposed" });

			expect(summary.removed).toBe(1);
		});

		it("captures errors and continues", async () => {
			const registry = createMockRegistry();
			const oldDate = new Date(Date.now() - 999999999).toISOString();
			registry.register({
				id: "ws-fail", state: "retained", agentSlug: "bob",
				branch: "b", baseBranch: "m", method: "worktree",
				path: "/p", retain: true, createdAt: oldDate, collectResult: null,
			});

			const provisioner = createMockProvisioner();
			(provisioner.dispose as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("rm failed"); });

			const shell = createAgentShell(createShellDeps({ registry, provisioner }));
			const summary = await shell.prune();

			expect(summary.errors).toHaveLength(1);
			expect(summary.errors[0]).toContain("rm failed");
			expect(summary.skipped).toBe(1);
		});
	});
});
