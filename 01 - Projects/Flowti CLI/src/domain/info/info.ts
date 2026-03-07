/**
 * info.ts — Project information and diagnostics for the selected project.
 */

import fs from "node:fs";
import path from "node:path";
import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { runSilent } from "../../infrastructure/shell.js";
import { countFiles } from "../../infrastructure/fs.js";
import { getSelectedProject, getProjectSource } from "../../infrastructure/state.js";
import { initializeProject } from "../project/project-config.js";
import { FLOWTI_TOOLS } from "../../types.js";

export function showInfo(): void {
	printHeader("Project Info");

	const projectName = getSelectedProject();
	if (!projectName) {
		console.log(`  ${DIM}No project selected.${RESET}\n`);
		return;
	}

	const source = getProjectSource();
	const ctx = initializeProject(projectName, source);

	// ── Project identity ─────────────────────────────────────────
	console.log(`  ${BOLD}Project${RESET}`);
	console.log(`    Name:           ${ctx.config.name}`);
	if (ctx.pkg?.version) console.log(`    Version:        ${ctx.pkg.version}`);
	console.log(`    Source:         ${source === "development" ? "Development" : "Projects"}`);
	console.log(`    Path:           ${ctx.path}`);
	console.log();

	// ── Source files ─────────────────────────────────────────────
	const srcDir = path.join(ctx.path, "src");
	const testsDir = path.join(ctx.path, "tests");
	const hasSrc = fs.existsSync(srcDir);
	const hasTests = fs.existsSync(testsDir);

	if (hasSrc || hasTests) {
		console.log(`  ${BOLD}Source${RESET}`);
		if (hasSrc) {
			const tsCount = countFiles(srcDir, ".ts");
			const jsCount = countFiles(srcDir, ".js");
			const count = tsCount || jsCount;
			const ext = tsCount ? ".ts" : ".js";
			console.log(`    Source files:    ${count} ${ext} files`);
		}
		if (hasTests) {
			const tsCount = countFiles(testsDir, ".ts");
			const jsCount = countFiles(testsDir, ".js");
			const count = tsCount || jsCount;
			const ext = tsCount ? ".ts" : ".js";
			console.log(`    Test files:      ${count} ${ext} files`);
		}
		console.log();
	}

	// ── Dependencies ─────────────────────────────────────────────
	if (ctx.pkg) {
		const raw = JSON.parse(fs.readFileSync(path.join(ctx.path, "package.json"), "utf-8")) as Record<string, unknown>;
		const devDeps = Object.keys((raw.devDependencies as Record<string, string>) ?? {}).length;
		const prodDeps = Object.keys((raw.dependencies as Record<string, string>) ?? {}).length;
		const scriptCount = Object.keys(ctx.scripts).length;

		console.log(`  ${BOLD}Dependencies${RESET}`);
		console.log(`    Production:      ${prodDeps}`);
		console.log(`    Development:     ${devDeps}`);
		console.log(`    npm scripts:     ${scriptCount}`);
		console.log();
	}

	// ── Flowti tool mappings ─────────────────────────────────────
	const tools = ctx.config.tools ?? {};
	const mapped = FLOWTI_TOOLS.filter((t) => tools[t.id]);

	console.log(`  ${BOLD}Flowti Tools${RESET}`);
	for (const def of FLOWTI_TOOLS) {
		const cmd = tools[def.id];
		if (cmd) {
			console.log(`    ${GREEN}${def.label}${RESET}${DIM} → ${cmd}${RESET}`);
		} else {
			console.log(`    ${DIM}${def.label}  (not mapped)${RESET}`);
		}
	}
	console.log(`    ${DIM}${mapped.length}/${FLOWTI_TOOLS.length} mapped${RESET}`);
	console.log();

	// ── Publish ──────────────────────────────────────────────────
	const pub = ctx.config.publish;
	if (pub) {
		const endpoints = pub.endpoints ?? [];
		console.log(`  ${BOLD}Publish${RESET}`);
		if (pub.build) console.log(`    Build:       ${DIM}${pub.build}${RESET}`);
		if (pub.test) console.log(`    Test:        ${DIM}${pub.test}${RESET}`);
		if (pub.outDir) console.log(`    Output:      ${DIM}${pub.outDir}${RESET}`);
		if (pub.artifacts?.length) console.log(`    Artifacts:   ${DIM}${pub.artifacts.join(", ")}${RESET}`);
		if (endpoints.length > 0) {
			for (const ep of endpoints) {
				console.log(`    ${GREEN}${ep.name}${RESET}${DIM} → ${ep.path}${RESET}`);
			}
		} else {
			console.log(`    ${DIM}No endpoints configured${RESET}`);
		}
		console.log();
	}

	// ── Review ──────────────────────────────────────────────────
	const review = ctx.config.review;
	if (review) {
		const journeysDir = review.journeysDir ?? "tests/e2e/journeys";
		const journeysPath = path.join(ctx.path, journeysDir);
		const journeyCount = fs.existsSync(journeysPath)
			? fs.readdirSync(journeysPath).filter((f) => f.endsWith(".journey") || f.endsWith(".journey.json")).length
			: 0;
		console.log(`  ${BOLD}Review${RESET}`);
		console.log(`    Journeys:        ${journeyCount} in ${journeysDir}`);
		if (review.testVault) console.log(`    Test vault:      ${DIM}${review.testVault}${RESET}`);
		if (review.runner) console.log(`    Runner:          ${DIM}${review.runner}${RESET}`);
		if (review.build) console.log(`    Build:           ${DIM}${review.build}${RESET}`);
		if (review.test) console.log(`    Test:            ${DIM}${review.test}${RESET}`);
		console.log();
	}

	// ── Git ──────────────────────────────────────────────────────
	const branch = runSilent(`git -C "${ctx.path}" rev-parse --abbrev-ref HEAD`);
	const commit = runSilent(`git -C "${ctx.path}" rev-parse --short HEAD`);
	const dirty = runSilent(`git -C "${ctx.path}" status --porcelain`);

	if (branch || commit) {
		console.log(`  ${BOLD}Git${RESET}`);
		console.log(`    Branch:          ${branch ?? "?"}`);
		console.log(`    Commit:          ${commit ?? "?"}`);
		console.log(`    Status:          ${dirty ? `${YELLOW}dirty${RESET}` : `${GREEN}clean${RESET}`}`);
		console.log();
	}
}

export const commands = {
	info: () => { showInfo(); },
};
