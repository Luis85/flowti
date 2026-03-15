/** agent-process.ts — Infrastructure layer for spawning and managing agent CLI processes. */

import type { CliDeps } from "./deps.js";
import type { BackgroundProcess } from "./types.js";
import type { AgentRunSpec, AgentOutputEvent } from "../domain/agents/agent-runner.js";
import { parseAgentOutput } from "../domain/agents/agent-runner.js";

// ── Types ────────────────────────────────────────────────────────────

export type AgentProcessDeps = Pick<CliDeps, "disk" | "shell" | "paths" | "clock" | "log">;

/** Handle to a running agent process with typed event subscription. */
export interface AgentProcessHandle {
	readonly sessionId: string;
	readonly process: BackgroundProcess;
	readonly startedAt: string;
	/** Subscribe to parsed output events. Returns unsubscribe function. */
	subscribe(callback: (event: AgentOutputEvent) => void): () => void;
	/** Kill the agent process. */
	stop(): void;
}

// ── Process management ───────────────────────────────────────────────

/** Check whether the Claude CLI is available on the system. */
export function checkClaudeInstalled(deps: Pick<AgentProcessDeps, "shell">): boolean {
	return deps.shell.check("claude --version");
}

/** Write brief content to a file and return the path. */
export function writeBriefToFile(deps: Pick<AgentProcessDeps, "disk" | "paths">, dir: string, content: string, agentName: string): string {
	const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
	const filePath = deps.paths.join(dir, `${slug}-brief.md`);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return filePath;
}

/**
 * Launch an agent process from a run spec.
 * Spawns the Claude CLI in the background, wires output through the parser,
 * and returns a handle for subscription and lifecycle management.
 */
export function launchAgent(deps: AgentProcessDeps, spec: AgentRunSpec, sessionId: string): AgentProcessHandle {
	const cmd = [spec.command, ...spec.args].join(" ");
	const process = deps.shell.spawnBackground(cmd, {
		cwd: spec.workingDir,
		env: Object.keys(spec.env).length > 0 ? spec.env : undefined,
	});
	return {
		sessionId,
		process,
		startedAt: deps.clock.iso(),
		subscribe(callback: (event: AgentOutputEvent) => void): () => void {
			return process.onOutput((line) => callback(parseAgentOutput(line)));
		},
		stop(): void {
			process.kill();
		},
	};
}
