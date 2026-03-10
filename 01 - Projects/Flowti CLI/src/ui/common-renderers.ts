/**
 * common-renderers.ts — Shared renderer functions for common CLI output patterns.
 *
 * These are reusable render callbacks that controllers pass to dataResponse().
 * Each takes a typed data model and calls log() with ANSI formatting.
 */

import { log } from "../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED } from "../infrastructure/ui.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ErrorModel {
	error: string;
	hint?: string;
}

export interface SuccessModel {
	message: string;
}

export interface NoProjectModel {
	command: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderError(data: ErrorModel): void {
	log(`\n  ${RED}${data.error}${RESET}`);
	if (data.hint) log(`  ${DIM}${data.hint}${RESET}`);
	log();
}

export function renderSuccess(data: SuccessModel): void {
	log(`\n  ${GREEN}✓${RESET} ${data.message}\n`);
}

export function renderNoProject(data: NoProjectModel): void {
	log(`\n  ${RED}No project selected.${RESET}`);
	log(`  ${DIM}Select a project first: flowti project${RESET}`);
	log(`  ${DIM}Or specify one:          flowti ${data.command} --project=<name>${RESET}\n`);
}
