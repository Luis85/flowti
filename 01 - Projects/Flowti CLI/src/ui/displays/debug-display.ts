/**
 * debug-display.ts — Renderers for debug CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";

// ── Renderers ────────────────────────────────────────────────────────

export function renderDebugSet(data: {
	readonly agent: string;
	readonly xp?: number;
	readonly coin?: number;
	readonly level?: number;
	readonly changes: readonly string[];
}, log: LogFn): void {
	log(`${YELLOW}[debug]${RESET} ${BOLD}${data.agent}${RESET} economy override`);
	for (const change of data.changes) {
		log(`  ${DIM}set ${RESET}${CYAN}${change}${RESET}`);
	}
}

export function renderDebugTrust(data: {
	readonly agent: string;
	readonly op: string;
	readonly from: string;
	readonly to: string;
}, log: LogFn): void {
	log(`${YELLOW}[debug]${RESET} ${BOLD}${data.agent}${RESET} trust override`);
	log(`  ${DIM}${data.op}${RESET}  ${data.from} -> ${GREEN}${data.to}${RESET}`);
}

export function renderDebugNeeds(data: {
	readonly agent: string;
	readonly energy?: number;
	readonly hunger?: number;
	readonly thirst?: number;
}, log: LogFn): void {
	log(`${YELLOW}[debug]${RESET} ${BOLD}${data.agent}${RESET} needs override queued`);
	if (data.energy !== undefined) log(`  ${DIM}energy${RESET}  -> ${CYAN}${data.energy}${RESET}`);
	if (data.hunger !== undefined) log(`  ${DIM}hunger${RESET}  -> ${CYAN}${data.hunger}${RESET}`);
	if (data.thirst !== undefined) log(`  ${DIM}thirst${RESET}  -> ${CYAN}${data.thirst}${RESET}`);
}

export function renderDebugUnlock(data: {
	readonly agent: string;
	readonly capability: string;
	readonly ok: boolean;
	readonly error?: string;
}, log: LogFn): void {
	if (!data.ok) {
		log(`${YELLOW}[debug]${RESET} Cannot unlock ${BOLD}${data.capability}${RESET} for ${BOLD}${data.agent}${RESET}: ${data.error ?? "unknown error"}`);
		return;
	}
	log(`${YELLOW}[debug]${RESET} ${GREEN}Unlocked${RESET} capability ${BOLD}${data.capability}${RESET} for ${BOLD}${data.agent}${RESET}`);
}
