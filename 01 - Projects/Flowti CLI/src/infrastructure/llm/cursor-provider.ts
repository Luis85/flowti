/**
 * cursor-provider.ts — Cursor CLI adapter implementing ILLMProvider.
 *
 * Spawns `cursor --print --json`, parses output.
 * Cursor outputs plain text or JSON — adapter normalizes to LLMEvent.
 */

import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities } from "../../domain/agents/llm-types.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";
import { writePromptFile, cleanupPromptFile } from "./prompt-file.js";
import type { PromptFileDeps } from "./prompt-file.js";
import type { IShell } from "../types.js";

export interface CursorProviderDeps extends PromptFileDeps {
	readonly shell: IShell;
}

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: false,
	toolUse: true,
	structuredOutput: true,
};

export function createCursorProvider(deps: CursorProviderDeps): ILLMProvider {
	return {
		name: "cursor",

		capabilities() {
			return CAPABILITIES;
		},

		execute(request: LLMRequest): LLMProcess {
			const prompt = isPreFormatted(request.prompt)
				? request.prompt.message
				: formatPrompt(request.prompt, CAPABILITIES);

			const tempPath = writePromptFile(deps, prompt);
			const quotedPath = `"${tempPath}"`;
			const cmd = `cursor --print --json < ${quotedPath}`;
			const proc = deps.shell.spawnBackground(cmd, request.cwd ? { cwd: request.cwd } : undefined);
			const timeout = request.timeout ?? 3_600_000;
			const exitPromise = proc.waitForExit(timeout);

			const textBuffer: string[] = [];
			const subscribers = new Set<(event: LLMEvent) => void>();

			proc.onOutput((line: string) => {
				if (!line.trim()) return;
				textBuffer.push(line);
				const event: LLMEvent = { kind: "text", text: line };
				for (const cb of subscribers) {
					try { cb(event); } catch { /* subscriber error */ }
				}
			});

			return {
				onEvent(callback) {
					subscribers.add(callback);
					return () => { subscribers.delete(callback); };
				},
				result: exitPromise.then((exitCode) => {
					cleanupPromptFile(deps, tempPath);
					return { text: textBuffer.join(""), thinking: "", exitCode } as LLMResult;
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
