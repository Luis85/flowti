/**
 * export-submenu.ts — Marketplace and scaffold submenu builders.
 *
 * Extracted from menu-builders.ts to keep file sizes under the max-lines limit.
 */

import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { log } from "../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, CYAN } from "../infrastructure/ui.js";
import type { MenuEntry, ProjectConfig } from "../infrastructure/types.js";
import { listDefinitions, buildMarketplaceListing, resolveDefinitionsDir, BUNDLED_DEFINITIONS, getKnownTemplateIds } from "../domain/scaffold/scaffold.js";

function marketplaceDeps() { return { disk, paths } as const; }
import { displayMarketplace } from "./menus/marketplace-menu.js";
import { checkFreshness, resolveBuildPaths } from "../domain/build/build-freshness.js";

export function buildExportSubmenu(
	projectPath: string,
	_config: ProjectConfig,
): MenuEntry[] {
	return [
		{
			key: "1",
			label: "Export Marketplace Bundle",
			action: async () => {
				const { exportBundle, saveBundle } = await import("../domain/scaffold/marketplace-export.js");
				const { VAULT_ROOT } = await import("../infrastructure/config.js");
				const { clock } = await import("../infrastructure/clock.js");
				const deps = { disk, paths, clock };
				const bundle = exportBundle(deps, VAULT_ROOT, projectPath);
				const total = bundle.aiTools.length + bundle.plugins.length + bundle.scaffolds.length;
				const outputPath = paths.join(projectPath, "exports", `flowti-bundle-${clock.iso().split("T")[0]}.json`);
				saveBundle(deps, bundle, outputPath);
				log(`\n  ${GREEN}✓${RESET} Exported ${total} definitions → ${DIM}${outputPath}${RESET}\n`);
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	];
}

export function buildScaffoldSubmenu(projectPath: string): MenuEntry[] {
	return [
		{
			key: "1",
			label: "List Scaffold Definitions",
			action: () => {
				const defs = listDefinitions();
				if (defs.length === 0) {
					log(`\n  ${DIM}No scaffold definitions available.${RESET}\n`);
				} else {
					log(`\n  ${CYAN}Available scaffold definitions:${RESET}\n`);
					for (const def of defs) {
						log(`    ${GREEN}${def.id}${RESET}  ${def.label}`);
						log(`    ${DIM}${def.description}${RESET}\n`);
					}
				}
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Browse Marketplace",
			action: () => {
				const knownIds = getKnownTemplateIds();
				const deps = marketplaceDeps();
				const defsDir = resolveDefinitionsDir(deps, projectPath);
				const listing = buildMarketplaceListing(deps, BUNDLED_DEFINITIONS, defsDir, knownIds);
				displayMarketplace(listing);
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Check Build Freshness",
			action: () => {
				const { srcDir, binDir } = resolveBuildPaths(projectPath, { paths });
				const check = checkFreshness(srcDir, binDir, { disk, paths });
				if (check.needsRebuild) {
					log(`\n  ${RED}●${RESET} Rebuild needed: ${check.reason}`);
					if (check.added.length > 0) log(`    ${GREEN}+ ${check.added.length} added${RESET}`);
					if (check.modified.length > 0) log(`    ${CYAN}~ ${check.modified.length} modified${RESET}`);
					if (check.removed.length > 0) log(`    ${RED}- ${check.removed.length} removed${RESET}`);
				} else {
					log(`\n  ${GREEN}●${RESET} ${check.reason}`);
				}
				log();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	];
}
