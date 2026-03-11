/**
 * report-archive-menu.ts — Interactive report archive browser.
 *
 * Moved from domain/reports/report-archive.ts to separate display
 * concerns from pure domain logic.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, BOLD, CYAN, GREEN } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { discoverArchiveCategories } from "../../domain/reports/export/report-archive.js";
import type { ArchiveCategory } from "../../domain/reports/export/report-archive.js";

export async function browseArchive(reportsDir: string): Promise<MenuResult> {
	const categories = discoverArchiveCategories(reportsDir, { disk, paths });

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
