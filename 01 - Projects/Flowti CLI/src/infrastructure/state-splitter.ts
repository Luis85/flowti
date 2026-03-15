/**
 * state-splitter.ts — Copies identity files and runtime state into an isolated workspace.
 *
 * Injects CLAUDE.md, .claude/ rules/skills, .flowti/config.json, agent data,
 * world state, and a fresh conversation stub into the target workspace path.
 * Part of the Agent Workspace Isolation feature.
 */

import type { CliDeps } from "./deps.js";

export type SplitterDeps = Pick<CliDeps, "disk" | "paths" | "shell">;

export interface IStateSplitter {
	inject(agentSlug: string, workspacePath: string): void;
}

export function createStateSplitter(deps: SplitterDeps, vaultRoot: string): IStateSplitter {
	function copyIfExists(src: string, dest: string): void {
		if (deps.disk.existsSync(src)) {
			deps.disk.mkdirSync(deps.paths.dirname(dest), { recursive: true });
			deps.disk.copyFileSync(src, dest);
		}
	}

	function copyDirRecursive(src: string, dest: string): void {
		if (!deps.disk.existsSync(src)) return;
		deps.shell.runCaptureDetailed(`cp -r "${src}" "${dest}"`);
	}

	return {
		inject(agentSlug, workspacePath) {
			// 1. CLAUDE.md
			copyIfExists(
				deps.paths.join(vaultRoot, "CLAUDE.md"),
				deps.paths.join(workspacePath, "CLAUDE.md"),
			);

			// 2. .claude/ directory (rules, skills)
			copyDirRecursive(
				deps.paths.join(vaultRoot, ".claude"),
				deps.paths.join(workspacePath, ".claude"),
			);

			// 3. .flowti/config.json (copy, not symlink)
			copyIfExists(
				deps.paths.join(vaultRoot, ".flowti", "config.json"),
				deps.paths.join(workspacePath, ".flowti", "config.json"),
			);

			// 4. Agent runtime state snapshot
			const varDir = deps.paths.join(workspacePath, ".flowti", "var");
			deps.disk.mkdirSync(varDir, { recursive: true });

			copyIfExists(
				deps.paths.join(vaultRoot, ".flowti", "var", `data-${agentSlug}.json`),
				deps.paths.join(varDir, `data-${agentSlug}.json`),
			);

			// 5. World state snapshot
			copyIfExists(
				deps.paths.join(vaultRoot, ".flowti", "var", "world-state.json"),
				deps.paths.join(varDir, "world-state.json"),
			);

			// 6. Empty conversation stub
			const convDir = deps.paths.join(varDir, "conversations");
			deps.disk.mkdirSync(convDir, { recursive: true });
			deps.disk.writeFileSync(
				deps.paths.join(convDir, `${agentSlug}.json`),
				JSON.stringify({ threads: [] }, null, "\t"),
				"utf-8",
			);
		},
	};
}
