/**
 * ui.ts — ANSI constants and terminal output primitives.
 */

import { cliConfig } from "./config.js";
import type { MenuEntry } from "./types.js";
import { log } from "./logger.js";

// ── ANSI escape codes ────────────────────────────────────────────────

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const CYAN = "\x1b[36m";
export const YELLOW = "\x1b[33m";

// ── Screen management ──────────────────────────────────────────────

export function clearScreen(): void {
	process.stdout.write("\x1b[H\x1b[J");
}

// ── Printing primitives ─────────────────────────────────────────────

export function printBanner(): void {
	clearScreen();
	log();
	log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	log(`  ${BOLD}  Flowti CLI${RESET}  ${DIM}v${cliConfig.version ?? "0.0.0"}${RESET}`);
	log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	log();
}

export function printHeader(title: string): void {
	clearScreen();
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
