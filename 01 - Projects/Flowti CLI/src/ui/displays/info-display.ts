/**
 * info-display.ts — Console display helpers for project info.
 *
 * Extracted from domain/info/info.ts to separate view from model.
 */

import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { countFiles } from "../../infrastructure/fs.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { getSelectedProject } from "../../infrastructure/state.js";
import { initializeProject } from "../../domain/project/project-config.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { detectTools } from "../../domain/project/tool-availability.js";
import type { ProjectInfo } from "../../domain/info/info.js";
import type { InfoDeps, Log } from "../../infrastructure/deps.js";

// ── Display helpers ─────────────────────────────────────────────────

function printFileCount(log: Log, dir: string, label: string): void {
	const tsCount = countFiles(dir, ".ts");
	const jsCount = countFiles(dir, ".js");
	const count = tsCount || jsCount;
	const ext = tsCount ? ".ts" : ".js";
	log(`    ${label}${count} ${ext} files`);
}

function printIdentity(log: Log, ctx: ProjectContext): void {
	log(`  ${BOLD}Project${RESET}`);
	log(`    Name:           ${ctx.config.name}`);
	if (ctx.pkg?.version) log(`    Version:        ${ctx.pkg.version}`);
	log(`    Path:           ${ctx.path}`);
	log();
}

function printSourceFiles(deps: InfoDeps, ctx: ProjectContext): void {
	const srcDir = deps.paths.join(ctx.path, "src");
	const testsDir = deps.paths.join(ctx.path, "tests");
	const hasSrc = deps.disk.existsSync(srcDir);
	const hasTests = deps.disk.existsSync(testsDir);

	if (!hasSrc && !hasTests) return;
	deps.log(`  ${BOLD}Source${RESET}`);
	if (hasSrc) printFileCount(deps.log, srcDir, "Source files:    ");
	if (hasTests) printFileCount(deps.log, testsDir, "Test files:      ");
	deps.log();
}

function printDependencies(deps: InfoDeps, ctx: ProjectContext): void {
	if (!ctx.pkg) return;
	const raw = JSON.parse(deps.disk.readFileSync(deps.paths.join(ctx.path, "package.json"), "utf-8")) as Record<string, unknown>;
	const devDeps = Object.keys((raw.devDependencies as Record<string, string>) ?? {}).length;
	const prodDeps = Object.keys((raw.dependencies as Record<string, string>) ?? {}).length;
	const scriptCount = Object.keys(ctx.scripts).length;

	deps.log(`  ${BOLD}Dependencies${RESET}`);
	deps.log(`    Production:      ${prodDeps}`);
	deps.log(`    Development:     ${devDeps}`);
	deps.log(`    npm scripts:     ${scriptCount}`);
	deps.log();
}

function printTools(deps: InfoDeps, ctx: ProjectContext): void {
	const tools = detectTools(ctx.path, { disk: deps.disk, paths: deps.paths });
	const available = tools.filter((t) => t.available);

	deps.log(`  ${BOLD}Dev Tools${RESET}`);
	for (const tool of tools) {
		if (tool.available) {
			deps.log(`    ${GREEN}${tool.id}${RESET}${DIM} ${tool.version ?? ""}${RESET}`);
		} else {
			deps.log(`    ${DIM}${tool.id}  (not installed)${RESET}`);
		}
	}
	deps.log(`    ${DIM}${available.length}/${tools.length} available${RESET}`);
	deps.log();
}

function printEndpoints(log: Log, endpoints: Array<{ name: string; path: string }>): void {
	if (endpoints.length > 0) {
		for (const ep of endpoints) {
			log(`    ${GREEN}${ep.name}${RESET}${DIM} → ${ep.path}${RESET}`);
		}
	} else {
		log(`    ${DIM}No endpoints configured${RESET}`);
	}
}

function printPublish(log: Log, ctx: ProjectContext): void {
	const pub = ctx.config.publish;
	if (!pub) return;
	log(`  ${BOLD}Publish${RESET}`);
	if (pub.build) log(`    Build:       ${DIM}${pub.build}${RESET}`);
	if (pub.test) log(`    Test:        ${DIM}${pub.test}${RESET}`);
	if (pub.outDir) log(`    Output:      ${DIM}${pub.outDir}${RESET}`);
	if (pub.artifacts?.length) log(`    Artifacts:   ${DIM}${pub.artifacts.join(", ")}${RESET}`);
	printEndpoints(log, pub.endpoints ?? []);
	log();
}

function printReview(deps: InfoDeps, ctx: ProjectContext): void {
	const review = ctx.config.review;
	if (!review) return;
	const journeysDir = review.journeysDir ?? "tests/e2e/journeys";
	const journeysPath = deps.paths.join(ctx.path, journeysDir);
	const journeyCount = deps.disk.existsSync(journeysPath)
		? deps.disk.readdirSync(journeysPath).filter((f) => f.endsWith(".journey") || f.endsWith(".journey.json")).length
		: 0;
	deps.log(`  ${BOLD}Review${RESET}`);
	deps.log(`    Journeys:        ${journeyCount} in ${journeysDir}`);
	if (review.testVault) deps.log(`    Test vault:      ${DIM}${review.testVault}${RESET}`);
	if (review.runner) deps.log(`    Runner:          ${DIM}${review.runner}${RESET}`);
	if (review.build) deps.log(`    Build:           ${DIM}${review.build}${RESET}`);
	if (review.test) deps.log(`    Test:            ${DIM}${review.test}${RESET}`);
	deps.log();
}

function printGit(deps: InfoDeps, ctx: ProjectContext): void {
	const branch = deps.shell.runSilent(`git -C "${ctx.path}" rev-parse --abbrev-ref HEAD`);
	const commit = deps.shell.runSilent(`git -C "${ctx.path}" rev-parse --short HEAD`);
	const dirty = deps.shell.runSilent(`git -C "${ctx.path}" status --porcelain`);

	if (!branch && !commit) return;
	deps.log(`  ${BOLD}Git${RESET}`);
	deps.log(`    Branch:          ${branch ?? "?"}`);
	deps.log(`    Commit:          ${commit ?? "?"}`);
	deps.log(`    Status:          ${dirty ? `${YELLOW}dirty${RESET}` : `${GREEN}clean${RESET}`}`);
	deps.log();
}

// ── Public display function ─────────────────────────────────────────

export function displayInfo(log: Log, data: ProjectInfo): void {
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
export function displayInfoFromContext(deps: InfoDeps, ctx: ProjectContext): void {
	printIdentity(deps.log, ctx);
	printSourceFiles(deps, ctx);
	printDependencies(deps, ctx);
	printTools(deps, ctx);
	printPublish(deps.log, ctx);
	printReview(deps, ctx);
	printGit(deps, ctx);
}

// ── Interactive entry point ─────────────────────────────────────────

export function showInfo(deps: InfoDeps): void {
	printHeader("Project Info");

	const projectName = getSelectedProject();
	if (!projectName) {
		deps.log(`  ${DIM}No project selected.${RESET}\n`);
		return;
	}

	const ctx = initializeProject(projectName, PROJECTS_DIR, { disk: deps.disk, paths: deps.paths });
	displayInfoFromContext(deps, ctx);
}
