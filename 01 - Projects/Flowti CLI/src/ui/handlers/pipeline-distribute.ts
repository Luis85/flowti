/**
 * pipeline-distribute.ts — Distribution helpers for the publish pipeline.
 *
 * Handles copying build artifacts to configured endpoints. Extracted from
 * pipeline-handlers.ts to keep file sizes within lint thresholds.
 */

import type { PublishConfig, PublishEndpoint } from "../../infrastructure/types.js";
import type { CliDeps, DistributeDeps } from "../../infrastructure/deps.js";

import { RESET, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";

function validateDistributeConfig(config: PublishConfig, projectPath: string, deps: DistributeDeps): string | null {
	if ((config.endpoints ?? []).length === 0) {
		return `\n  ${YELLOW}No publish endpoints configured.${RESET}\n  Add "endpoints" to the "publish" section in flowti.config.json.\n`;
	}
	if (!config.outDir) {
		return `\n  ${YELLOW}No outDir configured.${RESET}\n  Add "outDir" to the "publish" section in flowti.config.json.\n`;
	}
	const srcDir = deps.paths.resolve(projectPath, config.outDir);
	if (!deps.disk.existsSync(srcDir)) {
		return `\n  ${RED}Output directory not found: ${srcDir}${RESET}\n  Run build first.\n`;
	}
	return null;
}

function copyDir(src: string, dest: string, deps: Pick<CliDeps, "disk" | "paths">): number {
	let count = 0;
	for (const entry of deps.disk.readdirSync(src, { withFileTypes: true })) {
		const srcPath = deps.paths.join(src, entry.name);
		const destPath = deps.paths.join(dest, entry.name);
		if (entry.isDirectory()) {
			deps.disk.mkdirSync(destPath, { recursive: true });
			count += copyDir(srcPath, destPath, deps);
		} else {
			deps.disk.copyFileSync(srcPath, destPath);
			count++;
		}
	}
	return count;
}

export function distribute(projectPath: string, config: PublishConfig, deps: DistributeDeps): number {
	const error = validateDistributeConfig(config, projectPath, deps);
	if (error) { deps.log(error); return 1; }
	const artifacts = config.artifacts ?? [];
	const endpoints = config.endpoints ?? [];
	const srcDir = deps.paths.resolve(projectPath, config.outDir!);
	for (const ep of endpoints) {
		distributeToEndpoint(ep, srcDir, artifacts, deps);
	}
	deps.log(`\n  ${GREEN}✓${RESET} Distributed to ${endpoints.length} endpoint(s).\n`);
	return 0;
}

function distributeToEndpoint(ep: PublishEndpoint, srcDir: string, artifacts: string[], deps: DistributeDeps): void {
	deps.log(`\n  ${CYAN}▸${RESET} ${ep.name} → ${ep.path}`);
	const targetDir = deps.paths.resolve(ep.path);
	if (ep.clean && deps.disk.existsSync(targetDir)) {
		cleanEndpointArtifacts(targetDir, artifacts, deps);
	}
	deps.disk.mkdirSync(targetDir, { recursive: true });
	if (artifacts.length > 0) {
		copyArtifacts(srcDir, targetDir, artifacts, deps);
	} else {
		deps.log(`    ${GREEN}copy${RESET}  ${copyDir(srcDir, targetDir, deps)} files`);
	}
}

function cleanEndpointArtifacts(targetDir: string, artifacts: string[], deps: Pick<CliDeps, "disk" | "paths">): void {
	for (const a of artifacts) {
		const p = deps.paths.join(targetDir, a);
		if (deps.disk.existsSync(p)) deps.disk.unlinkSync(p);
	}
}

function copyArtifacts(srcDir: string, targetDir: string, artifacts: string[], deps: DistributeDeps): void {
	for (const a of artifacts) {
		const s = deps.paths.join(srcDir, a);
		const d = deps.paths.join(targetDir, a);
		if (!deps.disk.existsSync(s)) { deps.log(`    ${YELLOW}skip${RESET}  ${a} (not found)`); continue; }
		deps.disk.mkdirSync(deps.paths.dirname(d), { recursive: true });
		deps.disk.copyFileSync(s, d);
		deps.log(`    ${GREEN}copy${RESET}  ${a}`);
	}
}
