/**
 * pipeline-distribute.ts — Distribution helpers for the publish pipeline.
 *
 * Handles copying build artifacts to configured endpoints. Extracted from
 * pipeline-handlers.ts to keep file sizes within lint thresholds.
 */

import type { PublishConfig, PublishEndpoint } from "../../infrastructure/types.js";

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";

function validateDistributeConfig(config: PublishConfig, projectPath: string): string | null {
	if ((config.endpoints ?? []).length === 0) {
		return `\n  ${YELLOW}No publish endpoints configured.${RESET}\n  Add "endpoints" to the "publish" section in flowti.config.json.\n`;
	}
	if (!config.outDir) {
		return `\n  ${YELLOW}No outDir configured.${RESET}\n  Add "outDir" to the "publish" section in flowti.config.json.\n`;
	}
	const srcDir = paths.resolve(projectPath, config.outDir);
	if (!disk.existsSync(srcDir)) {
		return `\n  ${RED}Output directory not found: ${srcDir}${RESET}\n  Run build first.\n`;
	}
	return null;
}

function copyDir(src: string, dest: string): number {
	let count = 0;
	for (const entry of disk.readdirSync(src, { withFileTypes: true })) {
		const srcPath = paths.join(src, entry.name);
		const destPath = paths.join(dest, entry.name);
		if (entry.isDirectory()) {
			disk.mkdirSync(destPath, { recursive: true });
			count += copyDir(srcPath, destPath);
		} else {
			disk.copyFileSync(srcPath, destPath);
			count++;
		}
	}
	return count;
}

export function distribute(projectPath: string, config: PublishConfig): number {
	const error = validateDistributeConfig(config, projectPath);
	if (error) { log(error); return 1; }
	const artifacts = config.artifacts ?? [];
	const endpoints = config.endpoints ?? [];
	const srcDir = paths.resolve(projectPath, config.outDir!);
	for (const ep of endpoints) {
		distributeToEndpoint(ep, srcDir, artifacts);
	}
	log(`\n  ${GREEN}✓${RESET} Distributed to ${endpoints.length} endpoint(s).\n`);
	return 0;
}

function distributeToEndpoint(ep: PublishEndpoint, srcDir: string, artifacts: string[]): void {
	log(`\n  ${CYAN}▸${RESET} ${ep.name} → ${ep.path}`);
	const targetDir = paths.resolve(ep.path);
	if (ep.clean && disk.existsSync(targetDir)) {
		cleanEndpointArtifacts(targetDir, artifacts);
	}
	disk.mkdirSync(targetDir, { recursive: true });
	if (artifacts.length > 0) {
		copyArtifacts(srcDir, targetDir, artifacts);
	} else {
		log(`    ${GREEN}copy${RESET}  ${copyDir(srcDir, targetDir)} files`);
	}
}

function cleanEndpointArtifacts(targetDir: string, artifacts: string[]): void {
	for (const a of artifacts) {
		const p = paths.join(targetDir, a);
		if (disk.existsSync(p)) disk.unlinkSync(p);
	}
}

function copyArtifacts(srcDir: string, targetDir: string, artifacts: string[]): void {
	for (const a of artifacts) {
		const s = paths.join(srcDir, a);
		const d = paths.join(targetDir, a);
		if (!disk.existsSync(s)) { log(`    ${YELLOW}skip${RESET}  ${a} (not found)`); continue; }
		disk.mkdirSync(paths.dirname(d), { recursive: true });
		disk.copyFileSync(s, d);
		log(`    ${GREEN}copy${RESET}  ${a}`);
	}
}
