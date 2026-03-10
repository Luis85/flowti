/**
 * scaffold-display.ts — Console renderers for scaffold controller responses.
 *
 * Pure display functions that render scaffold data models with ANSI colors.
 */

import { RESET, DIM, GREEN, CYAN } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { DryRunResult } from "../domain/scaffold/scaffold-service.js";
import type { ExportBundle } from "../domain/scaffold/marketplace-export.js";
import type { Suggestion } from "../infrastructure/suggestions.js";

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
