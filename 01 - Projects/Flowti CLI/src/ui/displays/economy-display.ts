/**
 * economy-display.ts — Renderers for economy CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";

// ── Data models ──────────────────────────────────────────────────────

interface BalanceModel {
	readonly agent: string;
	readonly xp: number;
	readonly level: number;
	readonly title: string;
	readonly coin: number;
	readonly tokens: number;
}

interface LedgerModel {
	readonly agent: string;
	readonly entries: readonly { readonly ts: string; readonly type: string; readonly xp?: number; readonly coin?: number; readonly tokens?: number }[];
}

interface GrantModel {
	readonly agent: string;
	readonly coin: number;
	readonly tokens: number;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderBalance(data: BalanceModel, log: LogFn): void {
	log(`${BOLD}${data.agent}${RESET} — Level ${data.level} ${DIM}(${data.title})${RESET}`);
	log(`  XP:     ${CYAN}${data.xp}${RESET}`);
	log(`  Coin:   ${YELLOW}${data.coin}${RESET}`);
	log(`  Tokens: ${DIM}${data.tokens}${RESET}`);
}

export function renderLedger(data: LedgerModel, log: LogFn): void {
	log(`${BOLD}Transaction log for ${data.agent}${RESET} (${data.entries.length} entries)\n`);
	for (const e of data.entries) {
		const parts = [e.ts, e.type];
		if (e.xp) parts.push(`+${e.xp}xp`);
		if (e.coin) parts.push(`${e.coin > 0 ? "+" : ""}${e.coin}c`);
		if (e.tokens) parts.push(`${e.tokens}t`);
		log(`  ${DIM}${parts.join("  ")}${RESET}`);
	}
}

export function renderGrant(data: GrantModel, log: LogFn): void {
	log(`${GREEN}Granted${RESET} to ${BOLD}${data.agent}${RESET}: +${data.coin} Coin, +${data.tokens} Tokens`);
}
