/**
 * info.ts — Project information and diagnostics for the selected project.
 *
 * Supports --format=json for machine-readable output.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { countFiles } from "../../infrastructure/fs.js";
import { getSelectedProject } from "../../infrastructure/state.js";
import { initializeProject } from "../project/project-config.js";
import { FLOWTI_TOOLS } from "../../infrastructure/types.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";
import { resolveFormat, printOutput } from "../../infrastructure/output.js";

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

// ── Human-readable display ───────────────────────────────────────────

function printFileCount(dir: string, label: string): void {
	const tsCount = countFiles(dir, ".ts");
	const jsCount = countFiles(dir, ".js");
	const count = tsCount || jsCount;
	const ext = tsCount ? ".ts" : ".js";
	log(`    ${label}${count} ${ext} files`);
}

function printIdentity(ctx: ProjectContext): void {
	log(`  ${BOLD}Project${RESET}`);
	log(`    Name:           ${ctx.config.name}`);
	if (ctx.pkg?.version) log(`    Version:        ${ctx.pkg.version}`);
	log(`    Path:           ${ctx.path}`);
	log();
}

function printSourceFiles(ctx: ProjectContext): void {
	const srcDir = paths.join(ctx.path, "src");
	const testsDir = paths.join(ctx.path, "tests");
	const hasSrc = disk.existsSync(srcDir);
	const hasTests = disk.existsSync(testsDir);

	if (!hasSrc && !hasTests) return;
	log(`  ${BOLD}Source${RESET}`);
	if (hasSrc) printFileCount(srcDir, "Source files:    ");
	if (hasTests) printFileCount(testsDir, "Test files:      ");
	log();
}

function printDependencies(ctx: ProjectContext): void {
	if (!ctx.pkg) return;
	const raw = JSON.parse(disk.readFileSync(paths.join(ctx.path, "package.json"), "utf-8")) as Record<string, unknown>;
	const devDeps = Object.keys((raw.devDependencies as Record<string, string>) ?? {}).length;
	const prodDeps = Object.keys((raw.dependencies as Record<string, string>) ?? {}).length;
	const scriptCount = Object.keys(ctx.scripts).length;

	log(`  ${BOLD}Dependencies${RESET}`);
	log(`    Production:      ${prodDeps}`);
	log(`    Development:     ${devDeps}`);
	log(`    npm scripts:     ${scriptCount}`);
	log();
}

function printTools(ctx: ProjectContext): void {
	const tools = ctx.config.tools ?? {};
	const mapped = FLOWTI_TOOLS.filter((t) => tools[t.id]);

	log(`  ${BOLD}Flowti Tools${RESET}`);
	for (const def of FLOWTI_TOOLS) {
		const cmd = tools[def.id];
		if (cmd) {
			log(`    ${GREEN}${def.label}${RESET}${DIM} → ${cmd}${RESET}`);
		} else {
			log(`    ${DIM}${def.label}  (not mapped)${RESET}`);
		}
	}
	log(`    ${DIM}${mapped.length}/${FLOWTI_TOOLS.length} mapped${RESET}`);
	log();
}

function printEndpoints(endpoints: Array<{ name: string; path: string }>): void {
	if (endpoints.length > 0) {
		for (const ep of endpoints) {
			log(`    ${GREEN}${ep.name}${RESET}${DIM} → ${ep.path}${RESET}`);
		}
	} else {
		log(`    ${DIM}No endpoints configured${RESET}`);
	}
}

function printPublish(ctx: ProjectContext): void {
	const pub = ctx.config.publish;
	if (!pub) return;
	log(`  ${BOLD}Publish${RESET}`);
	if (pub.build) log(`    Build:       ${DIM}${pub.build}${RESET}`);
	if (pub.test) log(`    Test:        ${DIM}${pub.test}${RESET}`);
	if (pub.outDir) log(`    Output:      ${DIM}${pub.outDir}${RESET}`);
	if (pub.artifacts?.length) log(`    Artifacts:   ${DIM}${pub.artifacts.join(", ")}${RESET}`);
	printEndpoints(pub.endpoints ?? []);
	log();
}

function printReview(ctx: ProjectContext): void {
	const review = ctx.config.review;
	if (!review) return;
	const journeysDir = review.journeysDir ?? "tests/e2e/journeys";
	const journeysPath = paths.join(ctx.path, journeysDir);
	const journeyCount = disk.existsSync(journeysPath)
		? disk.readdirSync(journeysPath).filter((f) => f.endsWith(".journey") || f.endsWith(".journey.json")).length
		: 0;
	log(`  ${BOLD}Review${RESET}`);
	log(`    Journeys:        ${journeyCount} in ${journeysDir}`);
	if (review.testVault) log(`    Test vault:      ${DIM}${review.testVault}${RESET}`);
	if (review.runner) log(`    Runner:          ${DIM}${review.runner}${RESET}`);
	if (review.build) log(`    Build:           ${DIM}${review.build}${RESET}`);
	if (review.test) log(`    Test:            ${DIM}${review.test}${RESET}`);
	log();
}

function printGit(ctx: ProjectContext): void {
	const branch = shell.runSilent(`git -C "${ctx.path}" rev-parse --abbrev-ref HEAD`);
	const commit = shell.runSilent(`git -C "${ctx.path}" rev-parse --short HEAD`);
	const dirty = shell.runSilent(`git -C "${ctx.path}" status --porcelain`);

	if (!branch && !commit) return;
	log(`  ${BOLD}Git${RESET}`);
	log(`    Branch:          ${branch ?? "?"}`);
	log(`    Commit:          ${commit ?? "?"}`);
	log(`    Status:          ${dirty ? `${YELLOW}dirty${RESET}` : `${GREEN}clean${RESET}`}`);
	log();
}

function displayInfo(ctx: ProjectContext): void {
	printIdentity(ctx);
	printSourceFiles(ctx);
	printDependencies(ctx);
	printTools(ctx);
	printPublish(ctx);
	printReview(ctx);
	printGit(ctx);
}

// ── Public API ───────────────────────────────────────────────────────

export function showInfo(): void {
	printHeader("Project Info");

	const projectName = getSelectedProject();
	if (!projectName) {
		log(`  ${DIM}No project selected.${RESET}\n`);
		return;
	}

	const ctx = initializeProject(projectName);
	displayInfo(ctx);
}

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	info: (flags, _rawArgs, _command, project) => {
		const format = resolveFormat(flags);
		if (format === "json") {
			if (!project) return;
			printOutput(format, collectProjectInfo(project), () => {});
		} else {
			showInfo();
		}
	},
};
