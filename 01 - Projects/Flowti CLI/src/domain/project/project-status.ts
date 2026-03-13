/**
 * project-status.ts — Lightweight project status aggregation.
 *
 * Pure domain functions that collect typed status data from report
 * frontmatter. Used by the UI banner — keeps business logic out of
 * the presentation layer.
 */

import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { ProjectConfig } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import { getReportsDir } from "./project-config.js";
import { checkFreshness, resolveBuildPaths } from "../build/build-freshness.js";

export type StatusDeps = Pick<CliDeps, "disk" | "paths">;

// ── Data types ───────────────────────────────────────────────────────

export interface BuildStatus {
	success: boolean;
	date: string | null;
}

export interface TestStatus {
	total: number;
	failed: number;
}

export interface ProjectStatusSnapshot {
	build: BuildStatus | null;
	tests: TestStatus | null;
	needsRebuild: boolean;
}

// ── Collection ───────────────────────────────────────────────────────

function readReportFrontmatter(deps: StatusDeps, reportPath: string): Record<string, unknown> | null {
	if (!deps.disk.existsSync(reportPath)) return null;
	try {
		return parseFrontmatterContent(deps.disk.readFileSync(reportPath, "utf-8"));
	} catch { return null; }
}

export function collectBuildStatus(deps: StatusDeps, reportsDir: string): BuildStatus | null {
	const fm = readReportFrontmatter(deps, deps.paths.join(reportsDir, "Build Report.md"));
	if (!fm) return null;
	return {
		success: fm.success === true || fm.success === "true",
		date: fm.date ? String(fm.date) : null,
	};
}

export function collectTestStatus(deps: StatusDeps, reportsDir: string): TestStatus | null {
	const fm = readReportFrontmatter(deps, deps.paths.join(reportsDir, "Test Report.md"));
	if (!fm) return null;
	const total = Number(fm.total ?? fm.total_tests ?? 0);
	if (total === 0) return null;
	return { total, failed: Number(fm.failed ?? 0) };
}

export function collectFreshness(deps: StatusDeps, projectPath: string): boolean {
	try {
		const { srcDir, binDir } = resolveBuildPaths(projectPath, deps);
		return checkFreshness(srcDir, binDir, deps).needsRebuild;
	} catch { return false; }
}

/** Collect all status metrics for a project. */
export function collectProjectStatus(
	deps: StatusDeps,
	projectPath: string,
	config: ProjectConfig,
): ProjectStatusSnapshot {
	const reportsDir = getReportsDir(projectPath, config, deps);
	return {
		build: collectBuildStatus(deps, reportsDir),
		tests: collectTestStatus(deps, reportsDir),
		needsRebuild: collectFreshness(deps, projectPath),
	};
}
