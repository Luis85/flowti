/**
 * workspace-provisioner.ts — Git worktree/clone provisioner for agent workspaces.
 *
 * Tries to create an isolated workspace via `git worktree add` first. If the
 * target branch is already checked out in another worktree, or the worktree add
 * command fails for any reason, falls back to a local `git clone`.
 */

import type { CliDeps } from "./deps.js";

export type ProvisionerDeps = Pick<CliDeps, "shell" | "disk" | "paths">;

export interface ProvisionResult {
	readonly path: string;
	readonly method: "worktree" | "clone";
	readonly branch: string;
}

export interface IWorkspaceProvisioner {
	provision(agentSlug: string, branch: string, baseBranch: string, workspacePath: string): ProvisionResult;
	dispose(workspacePath: string, method: "worktree" | "clone"): void;
}

function quote(p: string): string {
	return `"${p}"`;
}

export function createWorkspaceProvisioner(deps: ProvisionerDeps, vaultRoot: string): IWorkspaceProvisioner {
	function isBranchCheckedOut(branch: string): boolean {
		const { stdout } = deps.shell.runCaptureDetailed("git worktree list", { cwd: vaultRoot });
		return stdout.split("\n").some((line) => line.includes(`[${branch}]`));
	}

	function provisionWorktree(branch: string, baseBranch: string, wsPath: string): boolean {
		deps.disk.mkdirSync(deps.paths.dirname(wsPath), { recursive: true });
		const cmd = `git worktree add ${quote(wsPath)} -b ${branch} ${baseBranch}`;
		const { exitCode } = deps.shell.runCaptureDetailed(cmd, { cwd: vaultRoot });
		return exitCode === 0;
	}

	function provisionClone(branch: string, baseBranch: string, wsPath: string): void {
		deps.disk.mkdirSync(deps.paths.dirname(wsPath), { recursive: true });
		const { stdout: sha } = deps.shell.runCaptureDetailed(`git rev-parse ${baseBranch}`, { cwd: vaultRoot });
		const cloneCmd = `git clone ${quote(vaultRoot)} ${quote(wsPath)}`;
		const cloneResult = deps.shell.runCaptureDetailed(cloneCmd);
		if (cloneResult.exitCode !== 0) {
			throw new Error(`Clone failed: ${cloneResult.stderr}`);
		}
		const checkoutCmd = `git checkout -b ${branch} ${sha.trim()}`;
		deps.shell.runCaptureDetailed(checkoutCmd, { cwd: wsPath });
	}

	return {
		provision(agentSlug, branch, baseBranch, workspacePath) {
			if (!isBranchCheckedOut(branch)) {
				if (provisionWorktree(branch, baseBranch, workspacePath)) {
					return { path: workspacePath, method: "worktree", branch };
				}
			}
			// Fallback to clone
			provisionClone(branch, baseBranch, workspacePath);
			return { path: workspacePath, method: "clone", branch };
		},

		dispose(workspacePath, method) {
			if (method === "worktree") {
				deps.shell.runCaptureDetailed(`git worktree remove ${quote(workspacePath)} --force`, { cwd: vaultRoot });
			} else {
				// For clones, just remove the directory
				deps.shell.runCaptureDetailed(`rm -rf ${quote(workspacePath)}`);
			}
		},
	};
}
