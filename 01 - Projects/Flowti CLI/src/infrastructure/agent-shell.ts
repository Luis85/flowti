/**
 * agent-shell.ts — Composition layer for workspace-based agent dispatch.
 *
 * AgentShell orchestrates the full workspace lifecycle by composing:
 * - WorkspaceRegistry — tracks all workspaces (in-memory + persistent)
 * - WorkspaceProvisioner — creates/destroys git worktrees or clones
 * - StateSplitter — injects identity files + runtime state into workspace
 * - StateCollector — merges results back to central vault after completion
 * - IAgentProcessRunner — spawns the agent CLI process in the workspace
 *
 * Implements IAgentShell (domain contract) in the infrastructure layer.
 */

import type { IAgentShell, DispatchRequest, DispatchResult, CollectResult, PruneOptions, PruneSummary } from "../domain/agents/agent-shell.js";
import type { AgentProcess, IAgentProcessRunner } from "../domain/agents/worker-types.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { IWorkspaceRegistry } from "./workspace-registry.js";
import type { IWorkspaceProvisioner } from "./workspace-provisioner.js";
import type { IStateSplitter } from "./state-splitter.js";
import type { IStateCollector } from "./state-collector.js";
import type { ICliBus } from "./event-bus.js";
import type { IClock } from "./types.js";
import type { WorkspacesConfig } from "./types-config.js";
import { createWorkspace, generateBranchName, transitionState, COLLECT_SKIPPED_SENTINEL } from "../domain/agents/agent-workspace.js";

// ── Dependencies ────────────────────────────────────────────────────

interface AgentShellDeps {
	readonly registry: IWorkspaceRegistry;
	readonly provisioner: IWorkspaceProvisioner;
	readonly splitter: IStateSplitter;
	readonly collector: IStateCollector;
	readonly processRunner: IAgentProcessRunner;
	readonly agentFinder: (slug: string) => AgentSummary | null;
	readonly config: WorkspacesConfig;
	readonly clock: IClock;
	readonly bus: ICliBus;
}

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WorkspacesConfig = {
	baseDir: "../flowti-agents",
	defaultRetain: false,
	retentionMaxAge: 604_800_000,
	maxConcurrent: 5,
	branchPrefix: "agent/",
};

// ── Factory ─────────────────────────────────────────────────────────

export function createAgentShell(deps: AgentShellDeps): IAgentShell {
	const config = { ...DEFAULT_CONFIG, ...deps.config };

	function tryPruneOne(ws: import("../domain/agents/agent-workspace.js").AgentWorkspace): string | null {
		try {
			deps.provisioner.dispose(ws.path, ws.method);
			deps.registry.remove(ws.id);
			return null;
		} catch (e) {
			return `${ws.id}: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	function pruneCandidates(
		candidates: import("../domain/agents/agent-workspace.js").AgentWorkspace[],
		now: number, threshold: number, dryRun: boolean,
	): PruneSummary {
		const errors: string[] = [];
		let removed = 0;
		let skipped = 0;

		for (const ws of candidates) {
			const age = now - new Date(ws.createdAt).getTime();
			if (age < threshold) { skipped++; continue; }
			if (dryRun) { removed++; continue; }
			const err = tryPruneOne(ws);
			if (err) { errors.push(err); skipped++; } else { removed++; }
		}
		return { removed, freed: "0B", skipped, errors };
	}

	return {
		async dispatch(request: DispatchRequest): Promise<DispatchResult> {
			// 1. Check concurrency limit
			const active = deps.registry.activeCount();
			if (active >= config.maxConcurrent) {
				throw new Error(`${active}/${config.maxConcurrent} workspaces active — dispose or increase limit`);
			}

			// 2. Resolve agent
			const agent = deps.agentFinder(request.agent);
			if (!agent && request.agent !== "adhoc") {
				throw new Error(`Agent "${request.agent}" not found`);
			}

			// 3. Generate branch name
			const branch = request.branch ?? generateBranchName(
				request.agent,
				request.task,
				config.branchPrefix,
			);
			const baseBranch = request.baseBranch ?? "master";

			// 4. Provision workspace (worktree or clone)
			const provisionResult = deps.provisioner.provision(
				request.agent,
				branch,
				baseBranch,
				`${config.baseDir}/ws-${request.agent}-${deps.clock.ms()}`,
			);

			// 5. Create workspace entity and register
			let workspace = createWorkspace({
				agentSlug: request.agent,
				branch,
				baseBranch,
				method: provisionResult.method,
				path: provisionResult.path,
				retain: request.retain ?? config.defaultRetain,
				createdAt: deps.clock.iso(),
			});

			deps.registry.register(workspace);
			deps.bus.emit("workspace:provisioned", { workspace, method: provisionResult.method });

			// 6. Inject state into workspace
			deps.splitter.inject(request.agent, workspace.path);
			workspace = transitionState(workspace, "ready");
			deps.registry.update(workspace);
			deps.bus.emit("workspace:ready", { workspace });

			// 7. Spawn agent process
			const agentForSpawn: AgentSummary = agent ?? {
				name: "adhoc", agentType: "ai" as const, description: "Ad-hoc session",
				skills: [], tools: [], roles: [], file: "",
			};

			const tools = request.allowedTools ? [...request.allowedTools] : undefined;
			const process: AgentProcess = deps.processRunner.spawn(
				agentForSpawn,
				request.task,
				tools,
				{ cwd: workspace.path },
			);

			workspace = transitionState(workspace, "active", { pid: 0, processName: "claude" });
			deps.registry.update(workspace);
			deps.bus.emit("workspace:active", { workspace, pid: 0 });

			// 8. Wire completion handler (collect + dispose/retain)
			const output = process.result.then(async (result) => {
				workspace = transitionState(workspace, "collecting");
				deps.registry.update(workspace);

				const collectResult = await deps.collector.collect(workspace);
				deps.bus.emit("workspace:collecting", { workspace, collectResult });

				const finalState = workspace.retain ? "retained" : "disposed";
				workspace = transitionState(workspace, finalState, {
					completedAt: deps.clock.iso(),
					collectResult,
				});
				deps.registry.update(workspace);

				if (finalState === "disposed") {
					deps.provisioner.dispose(workspace.path, workspace.method);
					deps.bus.emit("workspace:disposed", { workspace });
				} else {
					deps.bus.emit("workspace:retained", { workspace });
				}

				// Signal completion for auto-dequeue consumers
				deps.bus.emit("workspace:completed", {
					workspace,
					agentSlug: workspace.agentSlug,
					task: request.task,
					exitCode: result.exitCode,
				});

				return result;
			});

			return { workspace, process, branch, output };
		},

		list() {
			return deps.registry.list();
		},

		async collect(workspaceId: string): Promise<CollectResult> {
			const ws = deps.registry.get(workspaceId);
			if (!ws) throw new Error(`Workspace "${workspaceId}" not found`);

			if (ws.state === "disposed" || ws.state === "retained") {
				return ws.collectResult ?? COLLECT_SKIPPED_SENTINEL;
			}

			if (ws.state !== "collecting") {
				throw new Error(`Cannot collect workspace in "${ws.state}" state`);
			}

			return deps.collector.collect(ws);
		},

		async dispose(workspaceId: string): Promise<void> {
			const ws = deps.registry.get(workspaceId);
			if (!ws) throw new Error(`Workspace "${workspaceId}" not found`);

			if (ws.state !== "disposed") {
				const disposed = { ...ws, state: "disposed" as const, completedAt: deps.clock.iso() };
				deps.registry.update(disposed);
				deps.bus.emit("workspace:disposed", { workspace: disposed });
			}

			deps.provisioner.dispose(ws.path, ws.method);
			deps.registry.remove(workspaceId);
		},

		async prune(options?: PruneOptions): Promise<PruneSummary> {
			const now = deps.clock.ms();
			const threshold = options?.olderThan ?? config.retentionMaxAge;
			const candidates = options?.state
				? deps.registry.listByState(options.state)
				: [...deps.registry.listByState("retained"), ...deps.registry.listByState("disposed")];

			return pruneCandidates(candidates, now, threshold, options?.dryRun ?? false);
		},

		reconcileStaleAgents(): import("../domain/agents/agent-shell.js").ReconcileResult {
			const recovered: string[] = [];
			const active = deps.registry.listByState("active");
			for (const ws of active) {
				const age = deps.clock.ms() - new Date(ws.createdAt).getTime();
				if (age < 86_400_000) continue;

				// Transition through valid state machine: active → collecting → disposed
				const collecting = transitionState(ws, "collecting");
				const disposed = transitionState(collecting, "disposed", { completedAt: deps.clock.iso() });
				deps.registry.update(disposed);
				deps.provisioner.dispose(ws.path, ws.method);
				deps.bus.emit("workspace:disposed", { workspace: disposed });
				recovered.push(ws.agentSlug);
			}
			return { recovered };
		},
	};
}
