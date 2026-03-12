/**
 * build-display.ts — Console renderers for build controller responses.
 *
 * Pure display functions that render build data models with ANSI colors.
 */

import { RESET, DIM, GREEN, YELLOW, CYAN } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { FreshnessCheck, BuildManifest } from "../domain/build/build-freshness.js";
import type { CiResult } from "../domain/build/ci-generator.js";

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

// ── CI workflow renderers ───────────────────────────────────────────

export function renderWorkflowPreview(yaml: string): void {
	log(`\n  ${CYAN}Generated CI workflow:${RESET}\n`);
	for (const line of yaml.split("\n")) {
		log(`  ${DIM}│${RESET} ${line}`);
	}
	log();
}

export function renderCiDryRun(yaml: string): void {
	renderWorkflowPreview(yaml);
	log(`  ${YELLOW}Dry run — no files written.${RESET}\n`);
}

export function renderCiWritten(yaml: string, outputPath: string): void {
	renderWorkflowPreview(yaml);
	log(`  ${GREEN}Wrote${RESET} ${DIM}${outputPath}${RESET}\n`);
}

export function renderCiResult(data: CiResult): void {
	if (data.dryRun) {
		renderCiDryRun(data.yaml);
	} else if (data.outputPath) {
		renderCiWritten(data.yaml, data.outputPath);
	}
}
