/**
 * info.ts — Project information and diagnostics for the selected project.
 *
 * Supports --format=json for machine-readable output.
 */

import { countFiles } from "../../infrastructure/fs.js";
import { FLOWTI_TOOLS } from "../../infrastructure/types.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";

// ── Data types ───────────────────────────────────────────────────────

export interface ProjectInfo {
	name: string;
	version?: string;
	path: string;
	source?: { sourceFiles: number; testFiles: number; ext: string };
	dependencies?: { production: number; development: number; scripts: number };
	tools: Array<{ id: string; label: string; command: string | null }>;
	git?: { branch: string; commit: string; status: string };
}

// ── Data collection (pure-ish — reads filesystem + git) ──────────────

function collectSourceInfo(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): ProjectInfo["source"] | undefined {
	const srcDir = deps.paths.join(projectPath, "src");
	const testsDir = deps.paths.join(projectPath, "tests");
	if (!deps.disk.existsSync(srcDir) && !deps.disk.existsSync(testsDir)) return undefined;

	const tsCount = deps.disk.existsSync(srcDir) ? countFiles(srcDir, ".ts", deps.disk) : 0;
	const jsCount = deps.disk.existsSync(srcDir) ? countFiles(srcDir, ".js", deps.disk) : 0;
	const ext = tsCount ? ".ts" : ".js";
	const testTs = deps.disk.existsSync(testsDir) ? countFiles(testsDir, ".ts", deps.disk) : 0;
	const testJs = deps.disk.existsSync(testsDir) ? countFiles(testsDir, ".js", deps.disk) : 0;
	return { sourceFiles: tsCount || jsCount, testFiles: testTs || testJs, ext };
}

function collectDependencyInfo(ctx: ProjectContext, deps: Pick<CliDeps, "disk" | "paths">): ProjectInfo["dependencies"] | undefined {
	if (!ctx.pkg) return undefined;
	const raw = JSON.parse(deps.disk.readFileSync(deps.paths.join(ctx.path, "package.json"), "utf-8")) as Record<string, unknown>;
	return {
		production: Object.keys((raw.dependencies as Record<string, string>) ?? {}).length,
		development: Object.keys((raw.devDependencies as Record<string, string>) ?? {}).length,
		scripts: Object.keys(ctx.scripts).length,
	};
}

function collectGitInfo(projectPath: string, deps: Pick<CliDeps, "shell">): ProjectInfo["git"] | undefined {
	const branch = deps.shell.runSilent(`git -C "${projectPath}" rev-parse --abbrev-ref HEAD`);
	const commit = deps.shell.runSilent(`git -C "${projectPath}" rev-parse --short HEAD`);
	const dirty = deps.shell.runSilent(`git -C "${projectPath}" status --porcelain`);
	if (!branch && !commit) return undefined;
	return { branch: branch ?? "?", commit: commit ?? "?", status: dirty ? "dirty" : "clean" };
}

export function collectProjectInfo(ctx: ProjectContext, deps: Pick<CliDeps, "disk" | "paths" | "shell">): ProjectInfo {
	return {
		name: ctx.config.name,
		version: ctx.pkg?.version,
		path: ctx.path,
		tools: FLOWTI_TOOLS.map((t) => ({
			id: t.id,
			label: t.label,
			command: ctx.config.tools?.[t.id] ?? null,
		})),
		source: collectSourceInfo(ctx.path, deps),
		dependencies: collectDependencyInfo(ctx, deps),
		git: collectGitInfo(ctx.path, deps),
	};
}

