/**
 * worker-display.ts — Renderers for worker CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";

// ── Data models ──────────────────────────────────────────────────────

interface WorkerStatusEntry {
	readonly name: string;
	readonly state: string;
	readonly activeTaskCount: number;
	readonly standingOrderCount: number;
	readonly paused: boolean;
}

interface WorkerQueueEntry {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly assignee: string;
	readonly priority: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderWorkerStatus(data: { readonly workers: readonly WorkerStatusEntry[] }, log: LogFn): void {
	if (data.workers.length === 0) {
		log(`${DIM}No workers found.${RESET}`);
		return;
	}
	log(`${BOLD}Workers (${data.workers.length})${RESET}\n`);
	for (const w of data.workers) {
		const stateColor = w.paused ? YELLOW : (w.state === "idle" ? DIM : CYAN);
		const pausedTag = w.paused ? `  ${YELLOW}[paused]${RESET}` : "";
		log(`  ${BOLD}${w.name}${RESET}  ${stateColor}${w.state}${RESET}${pausedTag}  ${DIM}active:${w.activeTaskCount}  orders:${w.standingOrderCount}${RESET}`);
	}
}

export function renderWorkerQueue(data: { readonly tasks: readonly WorkerQueueEntry[] }, log: LogFn): void {
	if (data.tasks.length === 0) {
		log(`${DIM}No queued tasks.${RESET}`);
		return;
	}
	log(`${BOLD}Queued tasks (${data.tasks.length})${RESET}\n`);
	for (const t of data.tasks) {
		const assigneePart = t.assignee ? `-> ${t.assignee}` : `${DIM}unassigned${RESET}`;
		log(`  ${DIM}${t.id}${RESET}  ${YELLOW}${t.status}${RESET}  ${t.title}  ${DIM}[${t.priority}]${RESET}  ${assigneePart}`);
	}
}

export function renderWorkerReassigned(data: { readonly id: string; readonly to: string; readonly ok: boolean; readonly error?: string }, log: LogFn): void {
	if (!data.ok) {
		log(`${YELLOW}Cannot reassign${RESET} task ${BOLD}${data.id}${RESET}: ${data.error ?? "unknown error"}`);
		return;
	}
	log(`${GREEN}Reassigned${RESET} task ${BOLD}${data.id}${RESET} -> ${BOLD}${data.to}${RESET}`);
}

export function renderWorkerPaused(data: { readonly agent: string; readonly ok: boolean }, log: LogFn): void {
	if (!data.ok) {
		log(`${YELLOW}Cannot pause${RESET} worker ${BOLD}${data.agent}${RESET}`);
		return;
	}
	log(`${YELLOW}Paused${RESET} worker ${BOLD}${data.agent}${RESET}`);
}

export function renderWorkerResumed(data: { readonly agent: string; readonly ok: boolean }, log: LogFn): void {
	if (!data.ok) {
		log(`${YELLOW}Cannot resume${RESET} worker ${BOLD}${data.agent}${RESET}`);
		return;
	}
	log(`${GREEN}Resumed${RESET} worker ${BOLD}${data.agent}${RESET}`);
}
