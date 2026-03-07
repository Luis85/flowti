/**
 * info.ts — Project information and diagnostics for the selected project.
 */

import path from "node:path";
import { disk } from "../../infrastructure/filesystem.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { countFiles } from "../../infrastructure/fs.js";
import { getSelectedProject, getProjectSource } from "../../infrastructure/state.js";
import { initializeProject } from "../project/project-config.js";
import type { ProjectContext } from "../project/project-config.js";
import { FLOWTI_TOOLS } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

function printFileCount(dir: string, label: string): void {
	const tsCount = countFiles(dir, ".ts");
	const jsCount = countFiles(dir, ".js");
	const count = tsCount || jsCount;
	const ext = tsCount ? ".ts" : ".js";
	log(`    ${label}${count} ${ext} files`);
}

function printIdentity(ctx: ProjectContext, source: string): void {
	log(`  ${BOLD}Project${RESET}`);
	log(`    Name:           ${ctx.config.name}`);
	if (ctx.pkg?.version) log(`    Version:        ${ctx.pkg.version}`);
	log(`    Source:         ${source === "development" ? "Development" : "Projects"}`);
	log(`    Path:           ${ctx.path}`);
	log();
}

function printSourceFiles(ctx: ProjectContext): void {
	const srcDir = path.join(ctx.path, "src");
	const testsDir = path.join(ctx.path, "tests");
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
	const raw = JSON.parse(disk.readFileSync(path.join(ctx.path, "package.json"), "utf-8")) as Record<string, unknown>;
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

function printPublish(ctx: ProjectContext): void {
	const pub = ctx.config.publish;
	if (!pub) return;
	const endpoints = pub.endpoints ?? [];
	log(`  ${BOLD}Publish${RESET}`);
	if (pub.build) log(`    Build:       ${DIM}${pub.build}${RESET}`);
	if (pub.test) log(`    Test:        ${DIM}${pub.test}${RESET}`);
	if (pub.outDir) log(`    Output:      ${DIM}${pub.outDir}${RESET}`);
	if (pub.artifacts?.length) log(`    Artifacts:   ${DIM}${pub.artifacts.join(", ")}${RESET}`);
	if (endpoints.length > 0) {
		for (const ep of endpoints) {
			log(`    ${GREEN}${ep.name}${RESET}${DIM} → ${ep.path}${RESET}`);
		}
	} else {
		log(`    ${DIM}No endpoints configured${RESET}`);
	}
	log();
}

function printReview(ctx: ProjectContext): void {
	const review = ctx.config.review;
	if (!review) return;
	const journeysDir = review.journeysDir ?? "tests/e2e/journeys";
	const journeysPath = path.join(ctx.path, journeysDir);
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

export function showInfo(): void {
	printHeader("Project Info");

	const projectName = getSelectedProject();
	if (!projectName) {
		log(`  ${DIM}No project selected.${RESET}\n`);
		return;
	}

	const source = getProjectSource();
	const ctx = initializeProject(projectName, source);

	printIdentity(ctx, source);
	printSourceFiles(ctx);
	printDependencies(ctx);
	printTools(ctx);
	printPublish(ctx);
	printReview(ctx);
	printGit(ctx);
}

export const commands = {
	info: () => { showInfo(); },
};
