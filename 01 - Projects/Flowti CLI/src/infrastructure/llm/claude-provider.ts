/**
 * claude-provider.ts — Claude CLI adapter implementing ILLMProvider.
 *
 * One-shot: `claude -p "<prompt>" --output-format stream-json`
 * Session: captures session_id from first call, uses `--resume <id>` for follow-ups.
 * Uses the CLI's own OAuth login — no API key needed.
 */

import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities, LLMSession, LLMSessionRequest } from "../../domain/agents/llm-types.js";
import { parseStreamEvents, createStreamState, updateStreamState } from "../../domain/agents/agent-stream.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";
import { writePromptFile, cleanupPromptFile } from "./prompt-file.js";
import type { PromptFileDeps } from "./prompt-file.js";
import type { IShell } from "../types.js";

export interface ClaudeProviderDeps extends PromptFileDeps {
	readonly shell: IShell;
}

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: true,
	toolUse: true,
	structuredOutput: true,
	persistentSession: true,
};

/** Build the base claude args shared by execute and session. */
function baseArgs(tools?: readonly string[]): string[] {
	const args = ["-p", "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"];
	if (tools && tools.length > 0) {
		args.push("--allowedTools", tools.join(","));
	}
	return args;
}

/** Spawn a single `claude -p` invocation, parse stream-json, return LLMProcess. */
function spawnOnce(
	deps: ClaudeProviderDeps,
	prompt: string,
	extraArgs: readonly string[],
	cwd?: string,
	timeout?: number,
): { process: LLMProcess; sessionIdPromise: Promise<string | null> } {
	const tempPath = writePromptFile(deps, prompt);
	const quotedPath = `"${tempPath}"`;
	const cmd = ["claude", ...extraArgs.map((a) => a.includes(" ") ? `"${a}"` : a)].join(" ") + ` < ${quotedPath}`;
	const proc = deps.shell.spawnBackground(cmd, cwd ? { cwd } : undefined);
	const exitPromise = proc.waitForExit(timeout ?? 3_600_000);

	let streamState = createStreamState();
	const textBuffer: string[] = [];
	const thinkingBuffer: string[] = [];
	const subscribers = new Set<(event: LLMEvent) => void>();

	let capturedSessionId: string | null = null;
	let resolveSessionId: ((id: string | null) => void) | null = null;
	const sessionIdPromise = new Promise<string | null>((resolve) => { resolveSessionId = resolve; });

	proc.onOutput((line: string) => {
		streamState = updateStreamState(streamState, line);
		for (const event of parseStreamEvents(line, streamState)) {
			if (event.kind === "session" && !capturedSessionId) {
				capturedSessionId = event.sessionId;
				resolveSessionId?.(event.sessionId);
				resolveSessionId = null;
			}
			if (event.kind === "thinking") thinkingBuffer.push(event.text);
			if (event.kind === "text") textBuffer.push(event.text);
			for (const cb of subscribers) {
				try { cb(event); } catch { /* subscriber error */ }
			}
		}
	});

	const llmProcess: LLMProcess = {
		onEvent(callback) {
			subscribers.add(callback);
			return () => { subscribers.delete(callback); };
		},
		result: exitPromise.then((exitCode) => {
			cleanupPromptFile(deps, tempPath);
			// Resolve sessionId if process exited before emitting one
			if (resolveSessionId) { resolveSessionId(capturedSessionId); resolveSessionId = null; }
			return { text: textBuffer.join(""), thinking: thinkingBuffer.join(""), exitCode } as LLMResult;
		}).catch(() => {
			proc.kill();
			cleanupPromptFile(deps, tempPath);
			if (resolveSessionId) { resolveSessionId(null); resolveSessionId = null; }
			return { text: "", thinking: "", exitCode: 1 } as LLMResult;
		}),
		kill() {
			proc.kill();
			cleanupPromptFile(deps, tempPath);
		},
	};

	return { process: llmProcess, sessionIdPromise };
}

export function createClaudeProvider(deps: ClaudeProviderDeps): ILLMProvider {
	return {
		name: "anthropic",

		capabilities() {
			return CAPABILITIES;
		},

		execute(request: LLMRequest): LLMProcess {
			const prompt = isPreFormatted(request.prompt)
				? request.prompt.message
				: formatPrompt(request.prompt, CAPABILITIES);
			const args = baseArgs(request.tools);
			return spawnOnce(deps, prompt, args, request.cwd, request.timeout).process;
		},

		createSession(request: LLMSessionRequest): LLMSession {
			let sessionId: string | null = null;
			let killed = false;
			let activeProcess: LLMProcess | null = null;

			return {
				send(message: string): LLMProcess {
					// Kill any in-flight process from a previous send
					if (activeProcess) {
						try { activeProcess.kill(); } catch { /* already done */ }
					}

					const args = baseArgs(request.tools);
					if (sessionId) {
						args.push("--resume", sessionId);
					}

					const { process: proc, sessionIdPromise } = spawnOnce(deps, message, args, request.cwd, request.timeout);
					activeProcess = proc;

					// Capture session_id from first invocation for subsequent --resume calls
					if (!sessionId) {
						void sessionIdPromise.then((id) => {
							if (id) sessionId = id;
						});
					}

					// When this process finishes, clear activeProcess
					void proc.result.then(() => {
						if (activeProcess === proc) activeProcess = null;
					});

					return proc;
				},

				kill() {
					killed = true;
					if (activeProcess) {
						try { activeProcess.kill(); } catch { /* already done */ }
						activeProcess = null;
					}
				},

				get alive() {
					return !killed;
				},
			};
		},
	};
}
