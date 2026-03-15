/** agent-runner.ts — Pure functions for building Claude CLI run specs and parsing output. */

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

/** Discriminated union of structured output events from an agent process. */
export type AgentOutputEvent =
	| { readonly kind: "progress"; readonly message: string }
	| { readonly kind: "result"; readonly content: string }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "raw"; readonly line: string };

// ── Run spec builder ─────────────────────────────────────────────────

/** Build the argument list for the Claude CLI invocation. */
export function buildClaudeArgs(ai: AgentAIConfig | undefined, briefPath: string): string[] {
	const args = ["--print", "--prompt-file", briefPath];
	if (ai?.model) args.push("--model", ai.model);
	if (ai?.maxTokens) args.push("--max-tokens", String(ai.maxTokens));
	return args;
}

/**
 * Assemble a complete run spec from agent AI config + brief path.
 * Pure function — no I/O. The caller is responsible for writing the brief file.
 */
export function buildRunSpec(ai: AgentAIConfig | undefined, briefPath: string, projectPath: string): AgentRunSpec {
	return {
		command: "claude",
		args: buildClaudeArgs(ai, briefPath),
		env: {},
		workingDir: projectPath,
		briefPath,
	};
}

// ── Output parser ────────────────────────────────────────────────────

/**
 * Classify a raw output line from the Claude CLI into a structured event.
 *
 * Heuristics:
 * - Lines starting with "Error:" or "error:" → error event
 * - Lines starting with "Progress:" or containing step markers → progress
 * - Lines starting with "Result:" → result event
 * - Everything else → raw event
 */
export function parseAgentOutput(line: string): AgentOutputEvent {
	const trimmed = line.trim();
	if (!trimmed) return { kind: "raw", line };
	if (/^error:/i.test(trimmed)) return { kind: "error", message: trimmed.replace(/^error:\s*/i, "") };
	if (/^progress:/i.test(trimmed)) return { kind: "progress", message: trimmed.replace(/^progress:\s*/i, "") };
	if (/^result:/i.test(trimmed)) return { kind: "result", content: trimmed.replace(/^result:\s*/i, "") };
	return { kind: "raw", line };
}
