/**
 * scaffold-display.ts — Console renderers for scaffold controller responses.
 *
 * Pure display functions that render scaffold data models with ANSI colors.
 */

import { RESET, DIM, GREEN, RED, CYAN, YELLOW, BOLD } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { DryRunResult } from "../../domain/scaffold/scaffold-service.js";
import type { ExportBundle } from "../../domain/scaffold/marketplace-export.js";
import type { MarketplaceEntry } from "../../domain/scaffold/marketplace.js";
import type { ImportResult } from "../../domain/scaffold/marketplace.js";
import type { Suggestion } from "../../infrastructure/suggestions.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ScaffoldResultModel {
	created: number;
	outputPath: string;
	suggestions: Suggestion[];
}

export interface DefinitionListModel {
	definitions: { id: string; label: string; description: string }[];
}

export interface ExportSavedModel {
	total: number;
	outputPath: string;
}

export interface BundleImportedModel {
	imported: number;
	vault: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderDryRunPreview(data: DryRunResult): void {
	log(`\n  ${CYAN}Dry run — scaffold preview${RESET}\n`);
	log(`  ${DIM}Definition:${RESET}  ${data.definition}`);
	log(`  ${DIM}Output:${RESET}      ${data.outputPath}`);
	log(`  ${DIM}Files (${data.files.length}):${RESET}\n`);
	for (const file of data.files) log(`    ${GREEN}+${RESET} ${file}`);
	log();
}

export function renderScaffoldResult(data: ScaffoldResultModel): void {
	log(`\n  ${GREEN}✓${RESET} Scaffolded ${data.created} files → ${data.outputPath}\n`);
	if (data.suggestions.length > 0) {
		log(`  ${DIM}Next:${RESET}`);
		for (const s of data.suggestions) {
			log(`    ${CYAN}▸${RESET} ${DIM}${s.command}${RESET}  ${s.description}`);
		}
		log();
	}
}

export function renderDefinitionList(data: DefinitionListModel): void {
	if (data.definitions.length === 0) {
		log(`\n  ${DIM}No scaffold definitions available.${RESET}\n`);
		return;
	}
	log(`\n  ${CYAN}Available scaffold definitions:${RESET}\n`);
	for (const def of data.definitions) {
		log(`    ${GREEN}${def.id}${RESET}  ${def.label}`);
		log(`    ${DIM}${def.description}${RESET}\n`);
	}
}

export function renderExportPreview(data: ExportBundle): void {
	log(`\n  ${CYAN}Marketplace Export Preview${RESET}\n`);
	log(`  ${DIM}Vault:${RESET} ${data.vault}`);
	log(`  ${DIM}AI Tools:${RESET} ${data.aiTools.length}`);
	log(`  ${DIM}Plugins:${RESET} ${data.plugins.length}`);
	log(`  ${DIM}Scaffolds:${RESET} ${data.scaffolds.length}`);
	for (const t of data.aiTools) log(`    ${GREEN}▸${RESET} ${t.name}  ${DIM}${t.description}${RESET}`);
	for (const p of data.plugins) log(`    ${GREEN}▸${RESET} ${p.name}  ${DIM}${p.description}${RESET}`);
	for (const s of data.scaffolds) log(`    ${GREEN}▸${RESET} ${s.name}  ${DIM}${s.description}${RESET}`);
	log(`\n  ${DIM}Use --output=<path> to save the bundle.${RESET}\n`);
}

export function renderExportSaved(data: ExportSavedModel): void {
	log(`\n  ${GREEN}✓${RESET} Exported ${data.total} definitions → ${data.outputPath}\n`);
}

export function renderBundleImported(data: BundleImportedModel): void {
	log(`\n  ${GREEN}✓${RESET} Imported ${data.imported} AI tool${data.imported !== 1 ? "s" : ""} from ${data.vault}\n`);
}

// ── Marketplace models & renderers ───────────────────────────────────

export interface MarketplaceModel {
	entries: MarketplaceEntry[];
}

export function renderMarketplace(data: MarketplaceModel): void {
	const { entries } = data;
	if (entries.length === 0) {
		log(`\n  ${DIM}No scaffold definitions found.${RESET}\n`);
		return;
	}

	const bundled = entries.filter(e => e.source === "bundled");
	const local = entries.filter(e => e.source === "local");

	log(`\n  ${CYAN}${BOLD}Scaffold Definition Marketplace${RESET}\n`);

	if (bundled.length > 0) {
		log(`  ${DIM}── Bundled ──${RESET}\n`);
		for (const entry of bundled) renderMarketplaceEntry(entry);
	}

	if (local.length > 0) {
		log(`  ${DIM}── Local (configs/definitions/) ──${RESET}\n`);
		for (const entry of local) renderMarketplaceEntry(entry);
	}

	const validCount = entries.filter(e => e.valid).length;
	const invalidCount = entries.length - validCount;
	log(`  ${DIM}Total: ${validCount} valid${invalidCount > 0 ? `, ${invalidCount} invalid` : ""}${RESET}\n`);
}

function renderMarketplaceEntry(entry: MarketplaceEntry): void {
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

// ── Import result model & renderer ───────────────────────────────────

export interface ImportResultModel {
	result: ImportResult;
}

export function renderImportResult(data: ImportResultModel): void {
	const { result } = data;
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
