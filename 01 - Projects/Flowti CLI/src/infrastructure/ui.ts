/**
 * ui.ts — ANSI constants and terminal output primitives.
 */

import { manifest } from "./config.js";
import type { MenuEntry } from "../types.js";

// ── ANSI escape codes ────────────────────────────────────────────────

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const CYAN = "\x1b[36m";
export const YELLOW = "\x1b[33m";

// ── Printing primitives ─────────────────────────────────────────────

export function printBanner(): void {
	console.log();
	console.log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	console.log(`  ${BOLD}  Flowti CLI${RESET}  ${DIM}v${manifest.version}${RESET}`);
	console.log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	console.log();
}

export function printHeader(title: string): void {
	console.log(`\n  ${BOLD}${"─".repeat(50)}${RESET}`);
	console.log(`  ${BOLD}  ${title}${RESET}`);
	console.log(`  ${BOLD}${"─".repeat(50)}${RESET}\n`);
}

export function printMenu(items: MenuEntry[]): void {
	for (const item of items) {
		if ("separator" in item) {
			console.log();
			continue;
		}
		if (item.disabled) {
			console.log(`    ${DIM}${item.key}) ${item.label}${RESET}`);
		} else {
			console.log(`    ${item.key}) ${item.label}`);
		}
	}
	console.log();
}
