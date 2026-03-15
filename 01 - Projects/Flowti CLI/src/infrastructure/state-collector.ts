/**
 * state-collector.ts — Merges runtime state from isolated workspace back to central vault.
 *
 * Collects agent data (last-writer-wins merge), conversation threads (append),
 * and git commit history from the workspace branch. Part of the Agent Workspace
 * Isolation feature.
 */

import type { CliDeps } from "./deps.js";
import type { AgentWorkspace } from "../domain/agents/agent-workspace.js";
import type { CollectResult } from "../domain/agents/agent-shell.js";

export type CollectorDeps = Pick<CliDeps, "disk" | "paths" | "shell">;

export interface IStateCollector {
	collect(workspace: AgentWorkspace): Promise<CollectResult>;
}

export function createStateCollector(deps: CollectorDeps, vaultRoot: string): IStateCollector {
	function mergeRuntimeState(agentSlug: string, workspacePath: string): Record<string, unknown> {
		const wsPath = deps.paths.join(workspacePath, ".flowti", "var", `data-${agentSlug}.json`);
		const centralPath = deps.paths.join(vaultRoot, ".flowti", "var", `data-${agentSlug}.json`);

		if (!deps.disk.existsSync(wsPath)) return {};

		const wsState: Record<string, unknown> = JSON.parse(deps.disk.readFileSync(wsPath, "utf-8"));
		const centralState: Record<string, unknown> = deps.disk.existsSync(centralPath)
			? JSON.parse(deps.disk.readFileSync(centralPath, "utf-8"))
			: {};

		// Field-level last-writer-wins: workspace overrides central
		const merged = { ...centralState, ...wsState };
		deps.disk.writeFileSync(centralPath, JSON.stringify(merged, null, "\t"), "utf-8");
		return wsState;
	}

	function appendConversations(agentSlug: string, workspacePath: string): number {
		const wsConvPath = deps.paths.join(workspacePath, ".flowti", "var", "conversations", `${agentSlug}.json`);
		const centralConvPath = deps.paths.join(vaultRoot, ".flowti", "var", "conversations", `${agentSlug}.json`);

		if (!deps.disk.existsSync(wsConvPath)) return 0;

		const wsConv: { threads: unknown[] } = JSON.parse(deps.disk.readFileSync(wsConvPath, "utf-8"));
		const centralConv: { threads: unknown[] } = deps.disk.existsSync(centralConvPath)
			? JSON.parse(deps.disk.readFileSync(centralConvPath, "utf-8"))
			: { threads: [] };

		const newThreads = wsConv.threads ?? [];
		centralConv.threads = [...(centralConv.threads ?? []), ...newThreads];
		deps.disk.writeFileSync(centralConvPath, JSON.stringify(centralConv, null, "\t"), "utf-8");
		return newThreads.length;
	}

	function scanGitCommits(workspace: AgentWorkspace): { commits: string[]; filesChanged: number; error?: string } {
		const logCmd = `git log ${workspace.baseBranch}..${workspace.branch} --format=%H`;
		const logResult = deps.shell.runCaptureDetailed(logCmd, { cwd: workspace.path });

		if (logResult.exitCode !== 0) {
			return { commits: [], filesChanged: 0, error: "git scan failed" };
		}

		const commits = logResult.stdout.trim().split("\n").filter(Boolean);

		const diffCmd = `git diff --stat ${workspace.baseBranch}..${workspace.branch}`;
		const diffResult = deps.shell.runCaptureDetailed(diffCmd, { cwd: workspace.path });
		const match = diffResult.stdout.match(/(\d+) files? changed/);
		const filesChanged = match ? parseInt(match[1], 10) : 0;

		return { commits, filesChanged };
	}

	return {
		async collect(workspace) {
			const runtimeState = mergeRuntimeState(workspace.agentSlug, workspace.path);
			const conversationTurns = appendConversations(workspace.agentSlug, workspace.path);
			const gitResult = scanGitCommits(workspace);

			const errors: string[] = [];
			if (gitResult.error) errors.push(gitResult.error);

			return {
				commits: gitResult.commits,
				filesChanged: gitResult.filesChanged,
				conversationTurns,
				runtimeState,
				errors,
			};
		},
	};
}
