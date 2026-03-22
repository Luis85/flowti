/**
 * vault-display.ts — Renderers for vault CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";
import type { VaultOpResult, VaultOpOutcome, VaultContext } from "../../domain/vault-ops/vault-ops-types.js";

// ── Color map ────────────────────────────────────────────────────────

const OUTCOME_COLOR: Record<VaultOpOutcome, string> = {
	executed: GREEN,
	staged: YELLOW,
	queued: CYAN,
	denied: RED,
	failed: RED,
};

// ── Data models ──────────────────────────────────────────────────────

interface EvaluateResultModel {
	readonly matched: number;
	readonly dispatched: readonly VaultOpResult[];
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderVaultExecResult(data: VaultOpResult, log: LogFn): void {
	const color = OUTCOME_COLOR[data.outcome] ?? "";
	log(`${color}${data.outcome.toUpperCase()}${RESET}  ${DIM}${data.operation}${RESET}`);
	log(`  Agent:  ${BOLD}${data.agentName}${RESET}`);
	if (data.taskId) {
		log(`  Task:   ${DIM}${data.taskId}${RESET}`);
	}
	if (data.reason) {
		log(`  Reason: ${RED}${data.reason}${RESET}`);
	}
	if (data.stagingId) {
		log(`  Staged: ${YELLOW}${data.stagingId}${RESET}`);
	}
	if (data.data !== undefined) {
		log(`  Data:   ${DIM}${JSON.stringify(data.data)}${RESET}`);
	}
}

export function renderVaultContext(data: VaultContext, log: LogFn): void {
	log(`${BOLD}Vault Context${RESET}\n`);

	log(`${BOLD}Folders:${RESET}`);
	for (const folder of data.folderMap) {
		log(`  ${folder.path.padEnd(30)} ${DIM}${folder.noteCount} notes${RESET}`);
	}

	log(`\n${BOLD}Tags (top 20):${RESET}`);
	const topTags = data.tagIndex.slice(0, 20);
	for (const tag of topTags) {
		log(`  ${CYAN}${tag.tag.padEnd(24)}${RESET} ${DIM}${tag.count}${RESET}`);
	}

	log(`\n${BOLD}Recent changes (top 10):${RESET}`);
	const topChanges = data.recentChanges.slice(0, 10);
	for (const change of topChanges) {
		log(`  ${DIM}${change.at}${RESET}  ${change.action.padEnd(10)}  ${change.path}`);
	}
}

export function renderEvaluateResult(data: EvaluateResultModel, log: LogFn): void {
	log(`${BOLD}Standing Order Evaluation${RESET}`);
	log(`  Matched rules:  ${CYAN}${data.matched}${RESET}`);
	log(`  Dispatched ops:  ${data.dispatched.length}`);

	for (const result of data.dispatched) {
		const color = OUTCOME_COLOR[result.outcome] ?? "";
		log(`    ${color}${result.outcome}${RESET}  ${result.operation}  ${DIM}${result.agentName}${RESET}`);
	}
}
