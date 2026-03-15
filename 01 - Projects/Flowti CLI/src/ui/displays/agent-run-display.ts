/** agent-run-display.ts — Renderers for agent run lifecycle events. */

import type { AgentOutputEvent } from "../../domain/agents/agent-runner.js";
import type { AgentSession } from "../../domain/agents/agent-session.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

/** Render confirmation that a brief was generated (prompt-only mode). */
export function renderBriefGenerated(briefPath: string, agentName: string, log: (msg?: string) => void): void {
	log();
	log(`  ${GREEN}✓${RESET} Brief generated for ${BOLD}${agentName}${RESET}`);
	log(`  ${DIM}${briefPath}${RESET}`);
	log();
	log(`  ${DIM}To run manually:${RESET}`);
	log(`  ${CYAN}claude --print --prompt-file "${briefPath}"${RESET}`);
	log();
}

/** Render notification that an agent process was spawned. */
export function renderAgentSpawned(agentName: string, sessionId: string, log: (msg?: string) => void): void {
	log();
	log(`  ${GREEN}▶${RESET} Agent ${BOLD}${agentName}${RESET} spawned`);
	log(`  ${DIM}Session: ${sessionId}${RESET}`);
	log();
}

/** Render a single parsed output event from the agent process. */
export function renderAgentOutput(event: AgentOutputEvent, log: (msg?: string) => void): void {
	switch (event.kind) {
		case "progress": log(`  ${CYAN}⟳${RESET} ${event.message}`); break;
		case "result": log(`  ${GREEN}✓${RESET} ${event.content}`); break;
		case "error": log(`  ${RED}✗${RESET} ${event.message}`); break;
		case "raw": log(`  ${DIM}${event.line}${RESET}`); break;
	}
}

/** Render a completion summary for a finished agent session. */
export function renderAgentComplete(session: AgentSession, log: (msg?: string) => void): void {
	const status = session.status === "completed" ? `${GREEN}completed${RESET}` : `${RED}${session.status}${RESET}`;
	log();
	log(`  ${BOLD}${session.agentName}${RESET} — ${status}`);
	log(`  ${DIM}Output: ${session.outputLines.length} lines${RESET}`);
	log();
}

/** Render a table of agent sessions. */
export function renderSessionList(sessions: AgentSession[], log: (msg?: string) => void): void {
	if (sessions.length === 0) {
		log(`\n  ${DIM}No agent sessions found.${RESET}\n`);
		return;
	}
	log();
	log(`  ${BOLD}Agent Sessions${RESET}`);
	log(`  ${DIM}${"─".repeat(60)}${RESET}`);
	for (const s of sessions) {
		const statusColor = s.status === "completed" ? GREEN : s.status === "failed" ? RED : s.status === "running" ? CYAN : YELLOW;
		log(`  ${BOLD}${s.agentName}${RESET}  ${statusColor}${s.status}${RESET}  ${DIM}${s.startedAt}${RESET}  ${DIM}[${s.id}]${RESET}`);
	}
	log();
}
