/**
 * project-publish.ts — Gated publish pipeline for the selected project.
 *
 * Pipeline: Build → Test → Distribute to endpoints.
 * Configured via flowti.config.json "publish" section.
 */

import fs from "node:fs";
import path from "node:path";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { runIn } from "../../infrastructure/shell.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuResult, PublishConfig, PublishEndpoint } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

// ── Distribute artifacts to endpoints ───────────────────────────────

function validateDistributeConfig(config: PublishConfig, projectPath: string): string | null {
	if ((config.endpoints ?? []).length === 0) {
		return `\n  ${YELLOW}No publish endpoints configured.${RESET}\n  ${DIM}Add "endpoints" to the "publish" section in flowti.config.json.${RESET}\n`;
	}
	if (!config.outDir) {
		return `\n  ${YELLOW}No outDir configured.${RESET}\n  ${DIM}Add "outDir" to the "publish" section in flowti.config.json.${RESET}\n`;
	}
	const srcDir = path.resolve(projectPath, config.outDir);
	if (!fs.existsSync(srcDir)) {
		return `\n  ${RED}Output directory not found: ${srcDir}${RESET}\n  ${DIM}Run build first.${RESET}\n`;
	}
	return null;
}

function copyArtifacts(srcDir: string, targetDir: string, artifacts: string[]): void {
	for (const artifact of artifacts) {
		const src = path.join(srcDir, artifact);
		const dest = path.join(targetDir, artifact);
		if (!fs.existsSync(src)) {
			log(`    ${YELLOW}skip${RESET}  ${artifact} (not found)`);
			continue;
		}
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(src, dest);
		log(`    ${GREEN}copy${RESET}  ${artifact}`);
	}
}

function distributeToEndpoint(ep: PublishEndpoint, srcDir: string, artifacts: string[]): void {
	log(`\n  ${CYAN}▸${RESET} ${ep.name} → ${ep.path}`);
	const targetDir = path.resolve(ep.path);

	if (ep.clean && fs.existsSync(targetDir)) cleanEndpoint(targetDir, artifacts);
	fs.mkdirSync(targetDir, { recursive: true });

	if (artifacts.length > 0) {
		copyArtifacts(srcDir, targetDir, artifacts);
	} else {
		const copied = copyDir(srcDir, targetDir);
		log(`    ${GREEN}copy${RESET}  ${copied} files`);
	}
}

function distribute(projectPath: string, config: PublishConfig): number {
	const error = validateDistributeConfig(config, projectPath);
	if (error) { log(error); return 1; }

	const artifacts = config.artifacts ?? [];
	const endpoints = config.endpoints ?? [];
	const srcDir = path.resolve(projectPath, config.outDir!);

	for (const ep of endpoints) distributeToEndpoint(ep, srcDir, artifacts);

	log(`\n  ${GREEN}✓${RESET} Distributed to ${endpoints.length} endpoint(s).\n`);
	return 0;
}

function cleanEndpoint(targetDir: string, artifacts: string[]): void {
	if (artifacts.length > 0) {
		for (const artifact of artifacts) {
			const p = path.join(targetDir, artifact);
			if (fs.existsSync(p)) fs.unlinkSync(p);
		}
	}
}

function copyDir(src: string, dest: string): number {
	let count = 0;
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true });
			count += copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
			count++;
		}
	}
	return count;
}

// ── Interactive publish menu ────────────────────────────────────────

export async function publishMenu(projectPath: string, config: PublishConfig): Promise<MenuResult> {
	let buildPassed = false;
	let testPassed = false;

	const buildCmd = config.build ?? "npm run build";
	const testCmd = config.test ?? "npm test";
	const endpoints = config.endpoints ?? [];

	const beforeMenu = (): void => {
		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const distIcon = `${DIM}○${RESET}`;
		log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${distIcon} Distribute`);
		if (endpoints.length > 0) {
			log(`    ${DIM}Endpoints:${RESET} ${endpoints.map((e: PublishEndpoint) => e.name).join(", ")}`);
		} else {
			log(`    ${YELLOW}No endpoints configured${RESET}`);
		}
		log();
	};

	return runMenu("Publish", [
		{ key: "1", label: "Build", action: () => {
			const code = runIn(buildCmd, projectPath, "Build");
			buildPassed = code === 0;
			if (!buildPassed) testPassed = false;
		}},
		{ key: "2", label: "Test",
			disabled: () => !buildPassed,
			disabledMessage: `\n  ${YELLOW}Build first (option 1).${RESET}\n`,
			action: () => { testPassed = runIn(testCmd, projectPath, "Test") === 0; },
		},
		{ key: "3", label: "Distribute to endpoints",
			disabled: () => !testPassed,
			disabledMessage: `\n  ${YELLOW}Build and test first.${RESET}\n`,
			action: () => { distribute(projectPath, config); },
		},
		{ key: "a", label: "Run all (build → test → distribute)", action: () => {
			log(`\n  ${CYAN}▸${RESET} Running full publish pipeline...\n`);
			const buildCode = runIn(buildCmd, projectPath, "Step 1/3: Build");
			buildPassed = buildCode === 0;
			if (!buildPassed) {
				log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`);
				testPassed = false;
				return;
			}
			const testCode = runIn(testCmd, projectPath, "Step 2/3: Test");
			testPassed = testCode === 0;
			if (!testPassed) {
				log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`);
				return;
			}
			log(`\n  ${CYAN}▸${RESET} Step 3/3: Distribute\n`);
			distribute(projectPath, config);
		}},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	], { beforeMenu });
}
