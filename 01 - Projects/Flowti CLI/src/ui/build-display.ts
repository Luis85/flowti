/**
 * build-display.ts — Console renderers for build controller responses.
 *
 * Pure display functions that render build data models with ANSI colors.
 */

import { RESET, DIM, GREEN, YELLOW, CYAN } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { FreshnessCheck, BuildManifest } from "../domain/build/build-freshness.js";

// ── Data models ──────────────────────────────────────────────────────

export interface BuildAutoModel {
	check: FreshnessCheck;
	buildRan: boolean;
	manifest: BuildManifest | null;
}

export interface BuildRecordedModel {
	fileCount: number;
	hashPrefix: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderFreshnessCheck(data: FreshnessCheck): void {
	if (!data.needsRebuild) {
		log(`  ${GREEN}✓${RESET} ${data.reason}\n`);
		return;
	}
	log(`  ${YELLOW}⚠${RESET} ${data.reason}\n`);
	if (data.added.length) log(`  ${DIM}Added:${RESET}    ${data.added.join(", ")}\n`);
	if (data.modified.length) log(`  ${DIM}Modified:${RESET} ${data.modified.join(", ")}\n`);
	if (data.removed.length) log(`  ${DIM}Removed:${RESET}  ${data.removed.join(", ")}\n`);
}

export function renderBuildAuto(data: BuildAutoModel): void {
	if (!data.check.needsRebuild) {
		log(`  ${GREEN}✓${RESET} Build is up to date — skipping.\n`);
		return;
	}
	log(`  ${CYAN}▸${RESET} ${data.check.reason}\n`);
	if (data.buildRan && data.manifest) {
		log(`  ${GREEN}✓${RESET} Build manifest saved (${data.manifest.fileCount} files hashed).\n`);
	}
}

export function renderBuildRecorded(data: BuildRecordedModel): void {
	log(`  ${GREEN}✓${RESET} Build manifest recorded: ${data.fileCount} files, hash ${data.hashPrefix}…\n`);
}
