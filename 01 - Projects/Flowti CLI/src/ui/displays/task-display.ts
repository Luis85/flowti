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

export function renderTaskReview(data: { readonly tasks: readonly TaskListEntry[] }, log: LogFn): void {
	if (data.tasks.length === 0) {
		log(`${DIM}No tasks awaiting review.${RESET}`);
		return;
	}
	log(`${BOLD}Tasks pending review (${data.tasks.length})${RESET}\n`);
	for (const t of data.tasks) {
		const assigneePart = t.assignee ? `-> ${t.assignee}` : "";
		log(`  ${DIM}${t.id}${RESET}  ${YELLOW}review${RESET}  ${t.title}  ${DIM}[${t.type}]${RESET}  ${assigneePart}  ${DIM}+${t.reward.xp}xp +${t.reward.coin}c${RESET}`);
	}
}

export function renderTaskApproved(data: { readonly id: string; readonly ok: boolean; readonly xp: number; readonly coin: number; readonly error?: string }, log: LogFn): void {
	if (!data.ok) {
		log(`${RED}Cannot approve${RESET} task ${BOLD}${data.id}${RESET}: ${data.error ?? "unknown error"}`);
		return;
	}
	log(`${GREEN}Approved${RESET} task ${BOLD}${data.id}${RESET}  ${DIM}+${data.xp}xp +${data.coin}c${RESET}`);
}

export function renderTaskRejected(data: { readonly id: string; readonly ok: boolean; readonly reason: string }, log: LogFn): void {
	if (!data.ok) {
		log(`${RED}Cannot reject${RESET} task ${BOLD}${data.id}${RESET}: ${data.reason}`);
		return;
	}
	log(`${YELLOW}Rejected${RESET} task ${BOLD}${data.id}${RESET}  ${DIM}reason: ${data.reason}${RESET}`);
}

interface StandingOrderEntry {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly assignee: string;
	readonly priority: string;
}

export function renderStandingOrders(data: { readonly orders: readonly StandingOrderEntry[] }, log: LogFn): void {
	if (data.orders.length === 0) {
		log(`${DIM}No standing orders found.${RESET}`);
		return;
	}
	log(`${BOLD}Standing orders (${data.orders.length})${RESET}\n`);
	for (const o of data.orders) {
		const color = STATUS_COLOR[o.status] ?? "";
		const assigneePart = o.assignee ? `-> ${o.assignee}` : "";
		log(`  ${DIM}${o.id}${RESET}  ${color}${o.status}${RESET}  ${o.title}  ${DIM}[${o.priority}]${RESET}  ${assigneePart}`);
	}
}
