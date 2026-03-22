/**
 * trust-display.ts — Renderers for trust CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";

// ── Data models ──────────────────────────────────────────────────────

interface TrustOperationEntry {
	readonly op: string;
	readonly level: string;
}

interface TrustProfileModel {
	readonly agent: string;
	readonly tier: string;
	readonly operations: readonly TrustOperationEntry[];
}

interface TrustUpdatedModel {
	readonly agent: string;
	readonly op: string;
	readonly from: string;
	readonly to: string;
	readonly action: "promote" | "demote";
}

interface TrustHistoryEntry {
	readonly op: string;
	readonly from: string;
	readonly to: string;
	readonly at: string;
	readonly reason: string;
}

interface TrustHistoryModel {
	readonly agent: string;
	readonly entries: readonly TrustHistoryEntry[];
}

const LEVEL_COLOR: Record<string, string> = {
	auto: GREEN,
	review: YELLOW,
	manual: RED,
};

const TIER_COLOR: Record<string, string> = {
	autonomous: GREEN,
	trusted: CYAN,
	supervised: YELLOW,
};

// ── Renderers ────────────────────────────────────────────────────────

export function renderTrustProfile(data: TrustProfileModel, log: LogFn): void {
	const tierColor = TIER_COLOR[data.tier] ?? "";
	log(`${BOLD}${data.agent}${RESET} — Trust tier: ${tierColor}${data.tier}${RESET}\n`);
	log(`${BOLD}Operations:${RESET}`);
	for (const entry of data.operations) {
		const color = LEVEL_COLOR[entry.level] ?? "";
		log(`  ${DIM}${entry.op.padEnd(16)}${RESET}  ${color}${entry.level}${RESET}`);
	}
}

export function renderTrustUpdated(data: TrustUpdatedModel, log: LogFn): void {
	const actionWord = data.action === "promote" ? `${GREEN}Promoted${RESET}` : `${YELLOW}Demoted${RESET}`;
	log(`${actionWord} ${BOLD}${data.agent}${RESET} [${data.op}]: ${DIM}${data.from}${RESET} -> ${BOLD}${data.to}${RESET}`);
}

interface TrustResetModel {
	readonly agent: string;
	readonly operations: Record<string, string>;
	readonly promotionLog: readonly unknown[];
}

export function renderTrustReset(data: TrustResetModel, log: LogFn): void {
	log(`${GREEN}RESET${RESET} trust profile for ${BOLD}${data.agent}${RESET}`);
	log(`  Operations restored to defaults`);
	log(`  Promotion log preserved (${data.promotionLog.length} entries)`);
}

export function renderTrustHistory(data: TrustHistoryModel, log: LogFn): void {
	if (data.entries.length === 0) {
		log(`${DIM}No promotion history for ${data.agent}.${RESET}`);
		return;
	}
	log(`${BOLD}Trust history for ${data.agent}${RESET} (${data.entries.length} entries)\n`);
	for (const e of data.entries) {
		log(`  ${DIM}${e.at}${RESET}  ${e.op}  ${e.from} -> ${BOLD}${e.to}${RESET}  ${DIM}${e.reason}${RESET}`);
	}
}
