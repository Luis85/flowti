/**
 * task-display.ts — Renderers for task CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";

// ── Data models ──────────────────────────────────────────────────────

interface TaskListEntry {
	readonly id: string;
	readonly title: string;
	readonly type: string;
	readonly status: string;
	readonly assignee: string;
	readonly priority: string;
	readonly reward: { readonly xp: number; readonly coin: number };
}

const STATUS_COLOR: Record<string, string> = {
	proposed: YELLOW,
	pending: DIM,
	assigned: CYAN,
	"in-progress": BOLD,
	review: YELLOW,
	completed: GREEN,
	failed: RED,
};

// ── Renderers ────────────────────────────────────────────────────────

export function renderTaskList(data: { readonly tasks: readonly TaskListEntry[] }, log: LogFn): void {
	if (data.tasks.length === 0) {
		log(`${DIM}No tasks found.${RESET}`);
		return;
	}
	log(`${BOLD}Tasks (${data.tasks.length})${RESET}\n`);
	for (const t of data.tasks) {
		const color = STATUS_COLOR[t.status] ?? "";
		const assigneePart = t.assignee ? `-> ${t.assignee}` : "";
		log(`  ${DIM}${t.id}${RESET}  ${color}${t.status}${RESET}  ${t.title}  ${DIM}[${t.type}]${RESET}  ${assigneePart}  ${DIM}+${t.reward.xp}xp +${t.reward.coin}c${RESET}`);
	}
}

export function renderTaskCreated(data: { readonly id: string; readonly title: string }, log: LogFn): void {
	log(`${GREEN}Created${RESET} task ${BOLD}${data.id}${RESET}: ${data.title}`);
}

export function renderTaskUpdated(data: { readonly id: string; readonly field: string; readonly value: string }, log: LogFn): void {
	log(`${GREEN}Updated${RESET} task ${BOLD}${data.id}${RESET}: ${data.field} -> ${data.value}`);
}
