/**
 * ui.ts — ANSI constants and terminal output primitives.
 */

import { manifest } from "./config.js";
import type { MenuEntry } from "../types.js";
import { log } from "./logger.js";

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
	log();
	log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	log(`  ${BOLD}  Flowti CLI${RESET}  ${DIM}v${manifest.version}${RESET}`);
	log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	log();
}

export function printHeader(title: string): void {
	log(`\n  ${BOLD}${"─".repeat(50)}${RESET}`);
	log(`  ${BOLD}  ${title}${RESET}`);
	log(`  ${BOLD}${"─".repeat(50)}${RESET}\n`);
}

export function printMenu(items: MenuEntry[]): void {
	for (const item of items) {
		if ("separator" in item) {
			log();
			continue;
		}
		if (item.disabled) {
			log(`    ${DIM}${item.key}) ${item.label}${RESET}`);
		} else {
			log(`    ${item.key}) ${item.label}`);
		}
	}
	log();
}
