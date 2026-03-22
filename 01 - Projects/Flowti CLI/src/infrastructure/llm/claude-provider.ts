/**
 * claude-provider.ts — Claude CLI adapter implementing ILLMProvider.
 *
 * Spawns `claude -p --output-format stream-json --verbose`, parses NDJSON output.
 * Reuses parseStreamEvents() from agent-stream.ts.
 */

import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities } from "../../domain/agents/llm-types.js";
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
};

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

			const tempPath = writePromptFile(deps, prompt);

			const args = ["-p", "--output-format", "stream-json", "--verbose"];
			if (request.tools && request.tools.length > 0) {
				args.push("--allowedTools", request.tools.join(","));
			}

			const quotedPath = `"${tempPath}"`;
			const cmd = ["claude", ...args.map((a) => a.includes(" ") ? `"${a}"` : a)].join(" ") + ` < ${quotedPath}`;
			const proc = deps.shell.spawnBackground(cmd, request.cwd ? { cwd: request.cwd } : undefined);
			const timeout = request.timeout ?? 3_600_000;
			const exitPromise = proc.waitForExit(timeout);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const subscribers = new Set<(event: LLMEvent) => void>();

			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				for (const event of parseStreamEvents(line, streamState)) {
					if (event.kind === "thinking") thinkingBuffer.push(event.text);
					if (event.kind === "text") textBuffer.push(event.text);
					for (const cb of subscribers) {
						try { cb(event); } catch { /* subscriber error */ }
					}
				}
			});

			return {
				onEvent(callback) {
					subscribers.add(callback);
					return () => { subscribers.delete(callback); };
				},
				result: exitPromise.then((exitCode) => {
					cleanupPromptFile(deps, tempPath);
					return { text: textBuffer.join(""), thinking: thinkingBuffer.join(""), exitCode } as LLMResult;
				}).catch(() => {
					proc.kill();
					cleanupPromptFile(deps, tempPath);
					return { text: "", thinking: "", exitCode: 1 } as LLMResult;
				}),
				kill() {
					proc.kill();
					cleanupPromptFile(deps, tempPath);
				},
			};
		},
	};
}
