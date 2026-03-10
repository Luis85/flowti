/**
 * marketplace-menu.ts — Display and command wrappers for marketplace.
 *
 * Moved from domain/scaffold/marketplace.ts to separate display
 * concerns from pure domain logic.
 */

import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW, BOLD } from "../../infrastructure/ui.js";
import type { MarketplaceEntry } from "../../domain/scaffold/marketplace.js";
import { buildMarketplaceListing, resolveDefinitionsDir, importDefinition } from "../../domain/scaffold/marketplace.js";

// ── Display ──────────────────────────────────────────────────────────

/** Render the marketplace listing to the console. */
export function displayMarketplace(entries: MarketplaceEntry[]): void {
	if (entries.length === 0) {
		log(`\n  ${DIM}No scaffold definitions found.${RESET}\n`);
		return;
	}

	const bundled = entries.filter(e => e.source === "bundled");
	const local = entries.filter(e => e.source === "local");

	log(`\n  ${CYAN}${BOLD}Scaffold Definition Marketplace${RESET}\n`);

	if (bundled.length > 0) {
		log(`  ${DIM}── Bundled ──${RESET}\n`);
		for (const entry of bundled) {
			renderEntry(entry);
		}
	}

	if (local.length > 0) {
		log(`  ${DIM}── Local (configs/definitions/) ──${RESET}\n`);
		for (const entry of local) {
			renderEntry(entry);
		}
	}

	const validCount = entries.filter(e => e.valid).length;
	const invalidCount = entries.length - validCount;
	log(`  ${DIM}Total: ${validCount} valid${invalidCount > 0 ? `, ${invalidCount} invalid` : ""}${RESET}\n`);
}

function renderEntry(entry: MarketplaceEntry): void {
	const status = entry.valid ? `${GREEN}valid${RESET}` : `${RED}invalid${RESET}`;
	const source = entry.source === "bundled" ? `${DIM}bundled${RESET}` : `${DIM}local${RESET}`;

	log(`    ${GREEN}${entry.id}${RESET}  ${entry.label}  [${source}] [${status}]`);
	log(`    ${DIM}${entry.description}${RESET}`);

	if (entry.templateIds.length > 0) {
		log(`    ${DIM}Templates: ${entry.templateIds.join(", ")}${RESET}`);
	}

	if (!entry.valid) {
		for (const err of entry.errors) {
			log(`    ${RED}  - ${err}${RESET}`);
		}
	}

	log();
}

// ── Command: scaffold:marketplace ────────────────────────────────────

export function displayMarketplaceCommand(
	bundled: unknown[],
	projectRoot: string | undefined,
	knownTemplateIds: string[],
): void {
	const localDir = projectRoot ? resolveDefinitionsDir(projectRoot) : "";
	const entries = buildMarketplaceListing(bundled, localDir, knownTemplateIds);
	displayMarketplace(entries);
}

// ── Command: scaffold:import ─────────────────────────────────────────

export function importDefinitionCommand(
	sourcePath: string,
	projectRoot: string,
	knownTemplateIds: string[],
): void {
	const result = importDefinition(sourcePath, projectRoot, knownTemplateIds);

	if (result.success) {
		log(`\n  ${GREEN}✓${RESET} Imported definition → ${result.targetPath}\n`);
	} else {
		log(`\n  ${RED}Import failed:${RESET}`);
		for (const err of result.errors) {
			log(`    ${YELLOW}- ${err}${RESET}`);
		}
		log();
	}
}
