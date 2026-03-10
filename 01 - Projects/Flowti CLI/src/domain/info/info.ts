/**
 * info.ts — Project information and diagnostics for the selected project.
 *
 * Supports --format=json for machine-readable output.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { shell } from "../../infrastructure/shell.js";
import { countFiles } from "../../infrastructure/fs.js";
import { FLOWTI_TOOLS } from "../../infrastructure/types.js";
import type { ProjectContext } from "../../infrastructure/types.js";

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

function collectSourceInfo(projectPath: string): ProjectInfo["source"] | undefined {
	const srcDir = paths.join(projectPath, "src");
	const testsDir = paths.join(projectPath, "tests");
	if (!disk.existsSync(srcDir) && !disk.existsSync(testsDir)) return undefined;

	const tsCount = disk.existsSync(srcDir) ? countFiles(srcDir, ".ts") : 0;
	const jsCount = disk.existsSync(srcDir) ? countFiles(srcDir, ".js") : 0;
	const ext = tsCount ? ".ts" : ".js";
	const testTs = disk.existsSync(testsDir) ? countFiles(testsDir, ".ts") : 0;
	const testJs = disk.existsSync(testsDir) ? countFiles(testsDir, ".js") : 0;
	return { sourceFiles: tsCount || jsCount, testFiles: testTs || testJs, ext };
}

function collectDependencyInfo(ctx: ProjectContext): ProjectInfo["dependencies"] | undefined {
	if (!ctx.pkg) return undefined;
	const raw = JSON.parse(disk.readFileSync(paths.join(ctx.path, "package.json"), "utf-8")) as Record<string, unknown>;
	return {
		production: Object.keys((raw.dependencies as Record<string, string>) ?? {}).length,
		development: Object.keys((raw.devDependencies as Record<string, string>) ?? {}).length,
		scripts: Object.keys(ctx.scripts).length,
	};
}

function collectGitInfo(projectPath: string): ProjectInfo["git"] | undefined {
	const branch = shell.runSilent(`git -C "${projectPath}" rev-parse --abbrev-ref HEAD`);
	const commit = shell.runSilent(`git -C "${projectPath}" rev-parse --short HEAD`);
	const dirty = shell.runSilent(`git -C "${projectPath}" status --porcelain`);
	if (!branch && !commit) return undefined;
	return { branch: branch ?? "?", commit: commit ?? "?", status: dirty ? "dirty" : "clean" };
}

export function collectProjectInfo(ctx: ProjectContext): ProjectInfo {
	return {
		name: ctx.config.name,
		version: ctx.pkg?.version,
		path: ctx.path,
		tools: FLOWTI_TOOLS.map((t) => ({
			id: t.id,
			label: t.label,
			command: ctx.config.tools?.[t.id] ?? null,
		})),
		source: collectSourceInfo(ctx.path),
		dependencies: collectDependencyInfo(ctx),
		git: collectGitInfo(ctx.path),
	};
}

