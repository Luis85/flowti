/**
 * config-deep-validation.ts — Filesystem-aware config validation.
 *
 * Supplements the pure schema validation (config-schema.ts) with checks
 * that require filesystem access: path existence, directory availability.
 *
 * Returns warnings only — deep checks never block startup.
 */

import type { ProjectConfig, IFileSystem } from "../../infrastructure/types.js";
import { paths } from "../../infrastructure/paths.js";

export interface DeepValidationResult {
	warnings: string[];
}

/** Check configured paths exist on disk. Returns non-fatal warnings. */
export function validateConfigDeep(
	config: ProjectConfig,
	projectPath: string,
	fs: IFileSystem,
): DeepValidationResult {
	const warnings: string[] = [];

	checkRelativePath(fs, projectPath, config.reports?.dir, "reports.dir", warnings);
	checkPublishEndpoints(fs, projectPath, config, warnings);
	checkRelativePath(fs, projectPath, config.review?.journeysDir, "review.journeysDir", warnings);
	checkAbsoluteOrRelativePath(fs, projectPath, config.review?.testVault, "review.testVault", warnings);
	checkRelativePath(fs, projectPath, config.docs?.referenceDir, "docs.referenceDir", warnings);
	checkStorybookDir(fs, projectPath, config, warnings);

	return { warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────

function checkRelativePath(
	fs: IFileSystem,
	projectPath: string,
	relPath: string | undefined,
	label: string,
	warnings: string[],
): void {
	if (!relPath) return;
	const fullPath = paths.join(projectPath, relPath);
	if (!fs.existsSync(fullPath)) {
		warnings.push(`${label}: directory "${relPath}" does not exist.`);
	}
}

function checkAbsoluteOrRelativePath(
	fs: IFileSystem,
	projectPath: string,
	configPath: string | undefined,
	label: string,
	warnings: string[],
): void {
	if (!configPath) return;
	// Check if absolute path first, then relative
	const fullPath = paths.isAbsolute(configPath)
		? configPath
		: paths.join(projectPath, configPath);
	if (!fs.existsSync(fullPath)) {
		warnings.push(`${label}: path "${configPath}" does not exist.`);
	}
}

function checkPublishEndpoints(
	fs: IFileSystem,
	projectPath: string,
	config: ProjectConfig,
	warnings: string[],
): void {
	const endpoints = config.publish?.endpoints;
	if (!endpoints) return;
	for (let i = 0; i < endpoints.length; i++) {
		const ep = endpoints[i];
		const fullPath = paths.isAbsolute(ep.path)
			? ep.path
			: paths.join(projectPath, ep.path);
		if (!fs.existsSync(fullPath)) {
			warnings.push(`publish.endpoints[${i}].path: "${ep.path}" does not exist.`);
		}
	}
}

function checkStorybookDir(
	fs: IFileSystem,
	projectPath: string,
	config: ProjectConfig,
	warnings: string[],
): void {
	if (!config.components?.storybook || !config.components.storybookDir) return;
	const fullPath = paths.join(projectPath, config.components.storybookDir);
	if (!fs.existsSync(fullPath)) {
		warnings.push(`components.storybookDir: directory "${config.components.storybookDir}" does not exist.`);
	}
}
