/**
 * build-display.ts — Console renderers for build controller responses.
 *
 * Pure display functions that render build data models with ANSI colors.
 */

import { RESET, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { FreshnessCheck, BuildManifest } from "../../domain/build/build-freshness.js";
import type { CiResult } from "../../domain/build/ci-generator.js";

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

export function renderFreshnessCheck(data: FreshnessCheck, log: (msg?: string) => void): void {
	if (!data.needsRebuild) {
		log(`  ${GREEN}✓${RESET} ${data.reason}\n`);
		return;
	}
	log(`  ${YELLOW}⚠${RESET} ${data.reason}\n`);
	if (data.added.length) log(`  ${DIM}Added:${RESET}    ${data.added.join(", ")}\n`);
	if (data.modified.length) log(`  ${DIM}Modified:${RESET} ${data.modified.join(", ")}\n`);
	if (data.removed.length) log(`  ${DIM}Removed:${RESET}  ${data.removed.join(", ")}\n`);
}

export function renderBuildAuto(data: BuildAutoModel, log: (msg?: string) => void): void {
	if (!data.check.needsRebuild) {
		log(`  ${GREEN}✓${RESET} Build is up to date — skipping.\n`);
		return;
	}
	log(`  ${CYAN}▸${RESET} ${data.check.reason}\n`);
	if (data.buildRan && data.manifest) {
		log(`  ${GREEN}✓${RESET} Build manifest saved (${data.manifest.fileCount} files hashed).\n`);
	}
}

export function renderBuildRecorded(data: BuildRecordedModel, log: (msg?: string) => void): void {
	log(`  ${GREEN}✓${RESET} Build manifest recorded: ${data.fileCount} files, hash ${data.hashPrefix}…\n`);
}

// ── CI workflow renderers ───────────────────────────────────────────

export function renderWorkflowPreview(yaml: string, log: (msg?: string) => void): void {
	log(`\n  ${CYAN}Generated CI workflow:${RESET}\n`);
	for (const line of yaml.split("\n")) {
		log(`  ${DIM}│${RESET} ${line}`);
	}
	log();
}

export function renderCiDryRun(yaml: string, log: (msg?: string) => void): void {
	renderWorkflowPreview(yaml, log);
	log(`  ${YELLOW}Dry run — no files written.${RESET}\n`);
}

export function renderCiWritten(yaml: string, outputPath: string, log: (msg?: string) => void): void {
	renderWorkflowPreview(yaml, log);
	log(`  ${GREEN}Wrote${RESET} ${DIM}${outputPath}${RESET}\n`);
}

export function renderCiResult(data: CiResult, log: (msg?: string) => void): void {
	if (data.dryRun) {
		renderCiDryRun(data.yaml, log);
	} else if (data.outputPath) {
		renderCiWritten(data.yaml, data.outputPath, log);
	}
}
