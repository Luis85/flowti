/**
 * staging-display.ts — Renderers for staging CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";

// ── Data models ──────────────────────────────────────────────────────

export interface StagingListModel {
	readonly items: readonly {
		readonly taskId: string;
		readonly agent: string;
		readonly operation: string;
		readonly fileCount: number;
		readonly createdAt: string;
	}[];
}

export interface StagingReviewModel {
	readonly taskId: string;
	readonly agent: string;
	readonly operation: string;
	readonly files: readonly { readonly path: string; readonly action: string; readonly previewPath: string }[];
	readonly createdAt: string;
}

export interface StagingActionModel {
	readonly taskId: string;
	readonly action: "approved" | "rejected";
	readonly success: boolean;
	readonly reason?: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderStagingList(data: StagingListModel, log: LogFn): void {
	if (data.items.length === 0) {
		log(`${DIM}No pending staging reviews.${RESET}`);
		return;
	}
	log(`${BOLD}Pending staging reviews${RESET} (${data.items.length})\n`);
	for (const item of data.items) {
		log(`  ${CYAN}${item.taskId}${RESET}  ${BOLD}${item.agent}${RESET}  ${YELLOW}${item.operation}${RESET}  ${DIM}${item.fileCount} file(s)  ${item.createdAt}${RESET}`);
	}
}

export function renderStagingReview(data: StagingReviewModel, log: LogFn): void {
	log(`${BOLD}Staging review: ${CYAN}${data.taskId}${RESET}`);
	log(`  Agent:     ${BOLD}${data.agent}${RESET}`);
	log(`  Operation: ${YELLOW}${data.operation}${RESET}`);
	log(`  Created:   ${DIM}${data.createdAt}${RESET}`);
	log(`  Files (${data.files.length}):`);
	for (const f of data.files) {
		log(`    ${DIM}[${f.action}]${RESET} ${f.path}`);
	}
}

export function renderStagingAction(data: StagingActionModel, log: LogFn): void {
	if (!data.success) {
		log(`${RED}Failed${RESET} to ${data.action === "approved" ? "approve" : "reject"} ${CYAN}${data.taskId}${RESET}: staging area not found`);
		return;
	}
	const color = data.action === "approved" ? GREEN : RED;
	const label = data.action === "approved" ? "Approved" : "Rejected";
	log(`${color}${label}${RESET} staging ${CYAN}${data.taskId}${RESET}`);
	if (data.reason) {
		log(`  Reason: ${DIM}${data.reason}${RESET}`);
	}
}
