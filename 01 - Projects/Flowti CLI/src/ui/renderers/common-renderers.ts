/**
 * common-renderers.ts — Shared renderer functions for common CLI output patterns.
 *
 * These are reusable render callbacks that controllers pass to dataResponse().
 * Each takes a typed data model and calls log() with ANSI formatting.
 */

import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import type { Log } from "../../infrastructure/deps.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ErrorModel {
	error: string;
	hint?: string;
	code?: string;
}

export interface SuccessModel {
	message: string;
}

export interface NoProjectModel {
	command: string;
}

export interface ShellCommandModel {
	command: string;
	exitCode: number;
	label?: string;
}

export interface InteractiveOnlyModel {
	command: string;
	error: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderError(log: Log, data: ErrorModel): void {
	log(`\n  ${RED}${data.error}${RESET}`);
	if (data.hint) log(`  ${DIM}${data.hint}${RESET}`);
	log();
}

export function renderSuccess(log: Log, data: SuccessModel): void {
	log(`\n  ${GREEN}✓${RESET} ${data.message}\n`);
}

export function renderNoProject(log: Log, data: NoProjectModel): void {
	log(`\n  ${RED}No project selected.${RESET}`);
	log(`  ${DIM}Select a project first: flowti project${RESET}`);
	log(`  ${DIM}Or specify one:          flowti ${data.command} --project=<name>${RESET}\n`);
}

export function renderShellCommand(_log: Log, _data: ShellCommandModel): void {
	// Shell commands produce their own stdout/stderr — nothing extra to render.
}

export function renderInteractiveOnly(log: Log, data: InteractiveOnlyModel): void {
	log(`\n  ${RED}${data.error}${RESET}`);
	log(`  ${DIM}Run without --format=json for interactive mode.${RESET}\n`);
}
