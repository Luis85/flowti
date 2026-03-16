/**
 * dashboard-display.ts — Console display for the agent dashboard.
 *
 * Pure display function that renders agent status as a table.
 * Receives a typed model, produces ANSI output via the log function.
 */

import { RESET, BOLD, DIM, CYAN, GREEN, YELLOW } from "../../infrastructure/ui.js";

export interface DashboardAgent {
	readonly name: string;
	readonly persona?: string;
	readonly status: "idle" | "busy" | "waiting" | "offline";
	readonly task?: string;
	readonly lastInteraction?: string;
}

export interface DashboardModel {
	readonly agents: readonly DashboardAgent[];
	readonly projectName?: string;
}

function statusTag(status: DashboardAgent["status"]): string {
	switch (status) {
		case "idle": return `${GREEN}idle${RESET}`;
		case "busy": return `${YELLOW}working${RESET}`;
		case "waiting": return `${CYAN}waiting${RESET}`;
		case "offline": return `${DIM}offline${RESET}`;
	}
}

function statusIcon(status: DashboardAgent["status"]): string {
	switch (status) {
		case "idle": return `${GREEN}●${RESET}`;
		case "busy": return `${YELLOW}●${RESET}`;
		case "waiting": return `${CYAN}●${RESET}`;
		case "offline": return `${DIM}○${RESET}`;
	}
}

function pad(s: string, len: number): string {
	const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
	const padding = Math.max(0, len - stripped.length);
	return s + " ".repeat(padding);
}

export function displayDashboard(model: DashboardModel, log: (msg?: string) => void): void {
	log("");
	if (model.projectName) {
		log(`  ${BOLD}Agent Dashboard${RESET} ${DIM}— ${model.projectName}${RESET}`);
	} else {
		log(`  ${BOLD}Agent Dashboard${RESET}`);
	}
	log("");

	if (model.agents.length === 0) {
		log(`  ${DIM}No agents registered.${RESET}`);
		log("");
		return;
	}

	const busy = model.agents.filter((a) => a.status === "busy").length;
	const waiting = model.agents.filter((a) => a.status === "waiting").length;
	const idle = model.agents.filter((a) => a.status === "idle").length;
	const offline = model.agents.filter((a) => a.status === "offline").length;

	log(`  ${GREEN}${idle}${RESET} idle  ${YELLOW}${busy}${RESET} working  ${CYAN}${waiting}${RESET} waiting  ${DIM}${offline} offline${RESET}`);
	log("");

	log(`  ${DIM}${pad("Agent", 24)} ${pad("Status", 14)} ${pad("Task", 40)}${RESET}`);
	log(`  ${DIM}${"─".repeat(24)} ${"─".repeat(14)} ${"─".repeat(40)}${RESET}`);

	for (const agent of model.agents) {
		const displayName = agent.persona ? `${agent.persona}` : agent.name;
		const nameCol = pad(`${CYAN}${displayName}${RESET}`, 24);
		const statusCol = pad(`${statusIcon(agent.status)} ${statusTag(agent.status)}`, 14);
		const taskCol = agent.task ? agent.task.slice(0, 40) : `${DIM}—${RESET}`;
		log(`  ${nameCol} ${statusCol} ${taskCol}`);
	}

	log("");
}
