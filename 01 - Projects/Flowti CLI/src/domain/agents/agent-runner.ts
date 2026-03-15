/** agent-runner.ts — Pure functions for building Claude CLI run specs. */

import type { AgentAIConfig } from "./agent-types.js";

// ── Types ────────────────────────────────────────────────────────────

/** Fully resolved specification for spawning a Claude CLI process. */
export interface AgentRunSpec {
	readonly command: string;
	readonly args: readonly string[];
	readonly env: Readonly<Record<string, string>>;
	readonly workingDir: string;
	readonly briefPath: string;
}

// ── Run spec builder ─────────────────────────────────────────────────

/**
 * Build the argument list for the Claude CLI invocation.
 * Note: Claude CLI does not have --prompt-file. The prompt must be piped via stdin
 * or passed as a positional argument. Callers handle prompt delivery separately.
 */
export function buildClaudeArgs(ai: AgentAIConfig | undefined): string[] {
	const useText = ai?.outputFormat === "text";
	const args: (string | number)[] = [];
	if (useText) {
		args.push("--print");
	} else {
		args.push("-p", "--output-format", "stream-json", "--verbose");
	}
	if (ai?.allowedTools && ai.allowedTools.length > 0) args.push("--allowedTools", ai.allowedTools.join(","));
	return args as string[];
}

/**
 * Assemble a complete run spec from agent AI config + brief path.
 * Pure function — no I/O. The caller is responsible for writing the brief file.
 */
export function buildRunSpec(ai: AgentAIConfig | undefined, briefPath: string, projectPath: string): AgentRunSpec {
	return {
		command: "claude",
		args: buildClaudeArgs(ai),
		env: {},
		workingDir: projectPath,
		briefPath,
	};
}

