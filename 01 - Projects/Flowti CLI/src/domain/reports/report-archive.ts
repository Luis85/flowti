/**
 * report-archive.ts — Discover archived report files.
 *
 * Pure domain logic only. Interactive browsing is in ui/menus/report-archive-menu.ts.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

// ── Archive entry types ──────────────────────────────────────────────

export interface ArchiveCategory {
	subdir: string;
	label: string;
	files: string[];
}

// ── Pure logic ───────────────────────────────────────────────────────

const REPORT_CATEGORIES = [
	{ subdir: "tests", label: "Test" },
	{ subdir: "coverage", label: "Coverage" },
	{ subdir: "builds", label: "Build" },
	{ subdir: "codebase", label: "Codebase" },
	{ subdir: "complexity", label: "Complexity" },
	{ subdir: "cycles", label: "Cycles" },
	{ subdir: "performance", label: "Performance" },
	{ subdir: "traceability", label: "Traceability" },
	{ subdir: "e2e", label: "E2E" },
];

/** Discover report categories that contain at least one timestamped .md file. */
export function discoverArchiveCategories(reportsDir: string, deps: Pick<CliDeps, "disk" | "paths">): ArchiveCategory[] {
	const categories: ArchiveCategory[] = [];

	for (const cat of REPORT_CATEGORIES) {
		const dir = deps.paths.join(reportsDir, cat.subdir);
		if (!deps.disk.existsSync(dir)) continue;

		const files = deps.disk.readdirSync(dir)
			.filter((f) => f.endsWith(".md") && /^\d{4}-/.test(f))
			.sort()
			.reverse(); // most recent first

		if (files.length > 0) {
			categories.push({ subdir: cat.subdir, label: cat.label, files });
		}
	}

	return categories;
}
