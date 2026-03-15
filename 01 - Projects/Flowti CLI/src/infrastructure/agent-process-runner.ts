/**
 * agent-process-runner.ts — Pure LLM process spawner.
 *
 * Spawns Claude CLI processes, streams events, returns results.
 * No lifecycle management, no notifications, no state — just process I/O.
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import type { AgentProcess, IAgentProcessRunner } from "../domain/agents/worker-types.js";
import { parseStreamLine, createStreamState, updateStreamState } from "../domain/agents/agent-stream.js";

export type ProcessRunnerDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

interface ProviderConfig {
	readonly binary: string;
	readonly args: readonly string[];
}

function resolveProvider(globalDefault?: string, agentProvider?: string): ProviderConfig {
	const provider = agentProvider ?? globalDefault ?? "anthropic";
	switch (provider) {
		case "anthropic": return { binary: "claude", args: ["-p", "--output-format", "stream-json", "--verbose"] };
		case "cursor": return { binary: "cursor", args: ["--print", "--json"] };
		default: return { binary: provider, args: ["-p"] };
	}
}

let idCounter = 0;

export function createProcessRunner(deps: ProcessRunnerDeps, config: AgentsConfig | undefined): IAgentProcessRunner {
	const globalProvider = config?.provider;
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;

	return {
		spawn(agent: AgentSummary, prompt: string): AgentProcess {
			const provider = resolveProvider(globalProvider, agent.ai?.provider);
			const tempPath = deps.paths.join(
				deps.paths.resolve("."),
				`.flowti-prompt-${deps.clock.ms()}-${++idCounter}.tmp`,
			);
			deps.disk.writeFileSync(tempPath, prompt, "utf-8");

			const args = [...provider.args];
			if (agent.ai?.allowedTools && agent.ai.allowedTools.length > 0) {
				args.push("--allowedTools", agent.ai.allowedTools.join(","));
			}

			const quotedPath = `"${tempPath}"`;
			const cmd = [
				provider.binary,
				...args.map((a) => String(a).includes(" ") ? `"${String(a)}"` : String(a)),
			].join(" ") + ` < ${quotedPath}`;

			const proc = deps.shell.spawnBackground(cmd);
			const exitPromise = proc.waitForExit(processTimeout);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const subscribers = new Set<(event: AgentStreamEvent) => void>();

			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				const event = parseStreamLine(line, streamState);
				if (!event) return;
				if (event.kind === "thinking") thinkingBuffer.push(event.text);
				if (event.kind === "text") textBuffer.push(event.text);
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
					try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
					return { text: textBuffer.join(""), thinking: thinkingBuffer.join(""), exitCode };
				}).catch(() => {
					proc.kill();
					try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
					return { text: "", thinking: "", exitCode: 1 };
				}),
				kill() {
					proc.kill();
					try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
				},
			};
		},
	};
}
