/**
 * config-deep-validation.ts — Filesystem-aware config validation.
 *
 * Supplements the pure schema validation (config-schema.ts) with checks
 * that require filesystem access: path existence, directory availability.
 *
 * Returns warnings only — deep checks never block startup.
 */

import type { ProjectConfig, IFileSystem, IPaths } from "../../infrastructure/types.js";

export interface DeepValidationResult {
	warnings: string[];
}

/** Check configured paths exist on disk. Returns non-fatal warnings. */
export function validateConfigDeep(
	config: ProjectConfig,
	projectPath: string,
	fs: IFileSystem,
	p: IPaths,
): DeepValidationResult {
	const warnings: string[] = [];

	checkRelativePath(fs, p, projectPath, config.reports?.dir, "reports.dir", warnings);
	checkPublishEndpoints(fs, p, projectPath, config, warnings);
	checkRelativePath(fs, p, projectPath, config.review?.journeysDir, "review.journeysDir", warnings);
	checkAbsoluteOrRelativePath(fs, p, projectPath, config.review?.testVault, "review.testVault", warnings);
	checkRelativePath(fs, p, projectPath, config.docs?.referenceDir, "docs.referenceDir", warnings);
	checkStorybookDir(fs, p, projectPath, config, warnings);

	return { warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────

function checkRelativePath(
	fs: IFileSystem,
	p: IPaths,
	projectPath: string,
	relPath: string | undefined,
	label: string,
	warnings: string[],
): void {
	if (!relPath) return;
	const fullPath = p.join(projectPath, relPath);
	if (!fs.existsSync(fullPath)) {
		warnings.push(`${label}: directory "${relPath}" does not exist.`);
	}
}

function checkAbsoluteOrRelativePath(
	fs: IFileSystem,
	p: IPaths,
	projectPath: string,
	configPath: string | undefined,
	label: string,
	warnings: string[],
): void {
	if (!configPath) return;
	// Check if absolute path first, then relative
	const fullPath = p.isAbsolute(configPath)
		? configPath
		: p.join(projectPath, configPath);
	if (!fs.existsSync(fullPath)) {
		warnings.push(`${label}: path "${configPath}" does not exist.`);
	}
}

function checkPublishEndpoints(
	fs: IFileSystem,
	p: IPaths,
	projectPath: string,
	config: ProjectConfig,
	warnings: string[],
): void {
	const endpoints = config.publish?.endpoints;
	if (!endpoints) return;
	for (let i = 0; i < endpoints.length; i++) {
		const ep = endpoints[i];
		const fullPath = p.isAbsolute(ep.path)
			? ep.path
			: p.join(projectPath, ep.path);
		if (!fs.existsSync(fullPath)) {
			warnings.push(`publish.endpoints[${i}].path: "${ep.path}" does not exist.`);
		}
	}
}

function checkStorybookDir(
	fs: IFileSystem,
	p: IPaths,
	projectPath: string,
	config: ProjectConfig,
	warnings: string[],
): void {
	if (!config.components?.storybook || !config.components.storybookDir) return;
	const fullPath = p.join(projectPath, config.components.storybookDir);
	if (!fs.existsSync(fullPath)) {
		warnings.push(`components.storybookDir: directory "${config.components.storybookDir}" does not exist.`);
	}
}
