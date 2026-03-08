/**
 * report-archive.ts — Browse past report files in the reports directory.
 *
 * Lists timestamped report subdirectories and lets users view past reports.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, BOLD, CYAN, GREEN } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";

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
export function discoverArchiveCategories(reportsDir: string): ArchiveCategory[] {
	const categories: ArchiveCategory[] = [];

	for (const cat of REPORT_CATEGORIES) {
		const dir = paths.join(reportsDir, cat.subdir);
		if (!disk.existsSync(dir)) continue;

		const files = disk.readdirSync(dir)
			.filter((f) => f.endsWith(".md") && /^\d{4}-/.test(f))
			.sort()
			.reverse(); // most recent first

		if (files.length > 0) {
			categories.push({ subdir: cat.subdir, label: cat.label, files });
		}
	}

	return categories;
}

// ── Interactive archive browser ──────────────────────────────────────

export async function browseArchive(reportsDir: string): Promise<MenuResult> {
	const categories = discoverArchiveCategories(reportsDir);

	if (categories.length === 0) {
		log(`\n  ${DIM}No archived reports found in ${reportsDir}${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = categories.map((cat, i) => ({
		key: String(i + 1),
		label: `${cat.label}  ${DIM}(${cat.files.length} report${cat.files.length === 1 ? "" : "s"})${RESET}`,
		action: () => browseCategory(reportsDir, cat),
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return runMenu("Report Archive", items);
}

async function browseCategory(reportsDir: string, category: ArchiveCategory): Promise<MenuResult> {
	const items: MenuEntry[] = category.files.map((file, i) => ({
		key: String(i + 1),
		label: file.replace(/\.md$/, ""),
		action: () => {
			const filePath = paths.join(reportsDir, category.subdir, file);
			openReport(filePath);
			return "main" as const;
		},
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return runMenu(`Archive: ${category.label}`, items);
}

function openReport(filePath: string): void {
	log(`\n  ${BOLD}Report:${RESET} ${CYAN}${filePath}${RESET}`);

	try {
		const content = disk.readFileSync(filePath, "utf-8");
		const lines = content.split("\n");

		// Show frontmatter summary
		if (lines[0]?.trim() === "---") {
			const endIdx = lines.indexOf("---", 1);
			if (endIdx > 0) {
				log(`  ${DIM}─── Frontmatter ───${RESET}`);
				for (let i = 1; i < endIdx; i++) {
					log(`  ${DIM}${lines[i]}${RESET}`);
				}
			}
		}

		// Show first heading
		const heading = lines.find((l) => l.startsWith("# "));
		if (heading) log(`  ${GREEN}${heading}${RESET}`);

		log();
	} catch {
		log(`  ${DIM}Could not read file.${RESET}\n`);
	}
}
