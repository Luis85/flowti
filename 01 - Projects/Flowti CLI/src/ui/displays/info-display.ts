/**
 * info-display.ts — Console display helpers for project info.
 *
 * Extracted from domain/info/info.ts to separate view from model.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { countFiles } from "../../infrastructure/fs.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { getSelectedProject } from "../../infrastructure/state.js";
import { initializeProject } from "../../domain/project/project-config.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { detectTools } from "../../domain/project/tool-availability.js";
import type { ProjectInfo } from "../../domain/info/info.js";
import { log } from "../../infrastructure/logger.js";

// ── Display helpers ─────────────────────────────────────────────────

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
	const tools = detectTools(ctx.path, { disk, paths });
	const available = tools.filter((t) => t.available);

	log(`  ${BOLD}Dev Tools${RESET}`);
	for (const tool of tools) {
		if (tool.available) {
			log(`    ${GREEN}${tool.id}${RESET}${DIM} ${tool.version ?? ""}${RESET}`);
		} else {
			log(`    ${DIM}${tool.id}  (not installed)${RESET}`);
		}
	}
	log(`    ${DIM}${available.length}/${tools.length} available${RESET}`);
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

// ── Public display function ─────────────────────────────────────────

export function displayInfo(data: ProjectInfo): void {
	log(`  ${BOLD}Project${RESET}`);
	log(`    Name:           ${data.name}`);
	if (data.version) log(`    Version:        ${data.version}`);
	log(`    Path:           ${data.path}`);
	log();

	if (data.source) {
		log(`  ${BOLD}Source${RESET}`);
		log(`    Source files:    ${data.source.sourceFiles} ${data.source.ext} files`);
		log(`    Test files:      ${data.source.testFiles} ${data.source.ext} files`);
		log();
	}

	if (data.dependencies) {
		log(`  ${BOLD}Dependencies${RESET}`);
		log(`    Production:      ${data.dependencies.production}`);
		log(`    Development:     ${data.dependencies.development}`);
		log(`    npm scripts:     ${data.dependencies.scripts}`);
		log();
	}

	const available = data.tools.filter((t) => t.available);
	log(`  ${BOLD}Dev Tools${RESET}`);
	for (const tool of data.tools) {
		if (tool.available) {
			log(`    ${GREEN}${tool.id}${RESET}${DIM} ${tool.version ?? ""}${RESET}`);
		} else {
			log(`    ${DIM}${tool.id}  (not installed)${RESET}`);
		}
	}
	log(`    ${DIM}${available.length}/${data.tools.length} available${RESET}`);
	log();

	if (data.git) {
		log(`  ${BOLD}Git${RESET}`);
		log(`    Branch:          ${data.git.branch}`);
		log(`    Commit:          ${data.git.commit}`);
		log(`    Status:          ${data.git.status === "clean" ? `${GREEN}clean${RESET}` : `${YELLOW}dirty${RESET}`}`);
		log();
	}
}

/**
 * @deprecated Use displayInfo(ProjectInfo) instead. Kept for backward compatibility.
 */
export function displayInfoFromContext(ctx: ProjectContext): void {
	printIdentity(ctx);
	printSourceFiles(ctx);
	printDependencies(ctx);
	printTools(ctx);
	printPublish(ctx);
	printReview(ctx);
	printGit(ctx);
}

// ── Interactive entry point ─────────────────────────────────────────

export function showInfo(): void {
	printHeader("Project Info");

	const projectName = getSelectedProject();
	if (!projectName) {
		log(`  ${DIM}No project selected.${RESET}\n`);
		return;
	}

	const ctx = initializeProject(projectName, PROJECTS_DIR, { disk, paths });
	displayInfoFromContext(ctx);
}
