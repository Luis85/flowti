/**
 * capture-display.ts — Console renderers for capture controller responses.
 *
 * Pure display functions that render capture data models with ANSI colors.
 */

import { RESET, DIM, GREEN } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { CaptureSearchResult } from "../domain/capture/capture.js";

// ── Data models ──────────────────────────────────────────────────────

export interface SearchResultsModel {
	query: string;
	results: CaptureSearchResult[];
}

export interface ImportResultModel {
	created: number;
	skipped: number;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderSearchResults(data: SearchResultsModel): void {
	if (data.results.length === 0) {
		log(`\n  ${DIM}No captures matching "${data.query}".${RESET}\n`);
		return;
	}
	log(`\n  ${GREEN}Found ${data.results.length} capture${data.results.length === 1 ? "" : "s"}:${RESET}\n`);
	for (const r of data.results) {
		const tagsStr = r.tags.length > 0 ? ` ${DIM}[${r.tags.join(", ")}]${RESET}` : "";
		log(`  ${DIM}${r.type}${RESET}  ${r.title}${tagsStr}`);
	}
	log();
}

export function renderImportResult(data: ImportResultModel): void {
	log(`\n  ${GREEN}✓${RESET} Imported ${data.created} item${data.created === 1 ? "" : "s"}${data.skipped > 0 ? `, ${data.skipped} skipped` : ""}\n`);
}
