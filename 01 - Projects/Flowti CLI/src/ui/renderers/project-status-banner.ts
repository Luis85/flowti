/**
 * project-status-banner.ts — Lightweight project status for the detail menu banner.
 *
 * Renders project status data with ANSI colors. Business logic
 * (data collection, type coercion) lives in domain/project/project-status.ts.
 */

import { RESET, DIM, GREEN, RED, YELLOW } from "../../infrastructure/ui.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { collectProjectStatus } from "../../domain/project/project-status.js";
import type { BuildStatus, TestStatus } from "../../domain/project/project-status.js";
import type { CliDeps } from "../../infrastructure/deps.js";

// ── Formatters ───────────────────────────────────────────────────────

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

function formatBuild(build: BuildStatus): string {
	const icon = build.success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
	const age = build.date ? formatAge(build.date) : "";
	return `Build: ${icon}${age ? ` ${DIM}${age}${RESET}` : ""}`;
}

function formatTests(tests: TestStatus): string {
	const icon = tests.failed === 0 ? `${GREEN}✓${RESET}` : `${RED}${tests.failed} failed${RESET}`;
	return `Tests: ${icon} ${DIM}${tests.total}${RESET}`;
}

// ── Banner renderer ──────────────────────────────────────────────────

export function printProjectStatusBanner(deps: Pick<CliDeps, "disk" | "paths" | "log">, ctx: ProjectContext): void {
	const status = collectProjectStatus({ disk: deps.disk, paths: deps.paths }, ctx.path, ctx.config);

	const parts: string[] = [];
	if (status.build) parts.push(formatBuild(status.build));
	if (status.tests) parts.push(formatTests(status.tests));
	if (status.needsRebuild) parts.push(`${YELLOW}Rebuild needed${RESET}`);

	if (parts.length > 0) {
		const sep = `  ${DIM}│${RESET}  `;
		deps.log(`  ${parts.join(sep)}`);
	}
}
