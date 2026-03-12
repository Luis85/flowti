/**
 * project-status-banner.ts — Lightweight project status for the detail menu banner.
 *
 * Reads frontmatter from existing report files (no commands executed).
 * Shows last build result, test summary, and build freshness at a glance.
 */

import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { parseFrontmatterContent } from "../infrastructure/frontmatter.js";
import { RESET, DIM, GREEN, RED, YELLOW } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import { getReportsDir } from "../domain/project/project-config.js";
import { checkFreshness, resolveBuildPaths } from "../domain/build/build-freshness.js";
import type { ProjectContext } from "../infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function readFrontmatter(filePath: string): Record<string, unknown> | null {
	if (!disk.existsSync(filePath)) return null;
	try {
		return parseFrontmatterContent(disk.readFileSync(filePath, "utf-8"));
	} catch { return null; }
}

function formatAge(isoDate: string): string {
	try {
		const then = new Date(isoDate).getTime();
		const now = Date.now();
		const diffMs = now - then;
		const mins = Math.floor(diffMs / 60_000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	} catch { return ""; }
}

// ── Status collectors ───────────────────────────────────────────────

function collectBuildStatus(reportsDir: string): string | null {
	const fm = readFrontmatter(paths.join(reportsDir, "Build Report.md"));
	if (!fm) return null;
	const ok = fm.success === true || fm.success === "true";
	const icon = ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
	const age = fm.date ? formatAge(String(fm.date)) : "";
	return `Build: ${icon}${age ? ` ${DIM}${age}${RESET}` : ""}`;
}

function collectTestStatus(reportsDir: string): string | null {
	const fm = readFrontmatter(paths.join(reportsDir, "Test Report.md"));
	if (!fm) return null;
	const total = Number(fm.total ?? fm.total_tests ?? 0);
	if (total === 0) return null;
	const failed = Number(fm.failed ?? 0);
	const icon = failed === 0 ? `${GREEN}✓${RESET}` : `${RED}${failed} failed${RESET}`;
	return `Tests: ${icon} ${DIM}${total}${RESET}`;
}

function collectFreshness(projectPath: string): string | null {
	try {
		const { srcDir, binDir } = resolveBuildPaths(projectPath, { paths });
		const freshness = checkFreshness(srcDir, binDir, { disk, paths });
		return freshness.needsRebuild ? `${YELLOW}Rebuild needed${RESET}` : null;
	} catch { return null; }
}

// ── Banner renderer ──────────────────────────────────────────────────

export function printProjectStatusBanner(ctx: ProjectContext): void {
	const reportsDir = getReportsDir(ctx.path, ctx.config, { paths });

	const parts = [
		collectBuildStatus(reportsDir),
		collectTestStatus(reportsDir),
		collectFreshness(ctx.path),
	].filter((p): p is string => p !== null);

	if (parts.length > 0) {
		const sep = `  ${DIM}│${RESET}  `;
		log(`  ${parts.join(sep)}`);
	}
}
