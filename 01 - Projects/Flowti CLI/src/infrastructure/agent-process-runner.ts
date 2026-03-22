/**
 * agent-process-runner.ts — Pure LLM process spawner.
 *
 * When a provider registry is supplied, delegates to it for multi-provider support.
 * Otherwise falls back to legacy direct spawning (Claude CLI only).
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import type { AgentProcess, IAgentProcessRunner, SpawnOptions } from "../domain/agents/worker-types.js";
import type { IProviderRegistry, LLMSession } from "../domain/agents/llm-types.js";
import {
	parseStreamEvents,
	createStreamState,
	updateStreamState,
	appendAssistantTextSkipFullDuplicate,
} from "../domain/agents/agent-stream.js";

export type ProcessRunnerDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

// ── Legacy provider resolution (used when no registry) ──────────────

interface ProviderConfig {
	readonly binary: string;
	readonly args: readonly string[];
}

function resolveProviderLegacy(globalDefault?: string, agentProvider?: string): ProviderConfig {
	const provider = agentProvider ?? globalDefault ?? "anthropic";
	switch (provider) {
		case "anthropic": return { binary: "claude", args: ["-p", "--output-format", "stream-json", "--verbose"] };
		case "cursor": return {
			binary: "agent",
			args: ["-p", "--output-format", "stream-json", "--stream-partial-output", "--force", "--trust"],
		};
		default: return { binary: provider, args: ["-p"] };
	}
}

/**
 * Vendor flags so Obsidian-driven / CI agent sessions do not block on interactive permission prompts.
 * - Claude Code: --dangerously-skip-permissions (non-interactive tool approval)
 * - Cursor print mode: --force (apply file changes without confirmation in headless flows)
 * See code comments when upgrading CLIs.
 */
function withFullAgentCliPermissions(binary: string, baseArgs: readonly string[]): string[] {
	const args = [...baseArgs];
	const leaf = binary.toLowerCase().split(/[/\\]/).pop() ?? binary.toLowerCase();
	if (leaf === "claude") {
		args.push("--dangerously-skip-permissions");
	} else if (leaf === "cursor") {
		args.push("--force");
	}
	return args;
}

let idCounter = 0;

// ── Factory ─────────────────────────────────────────────────────────

export function createProcessRunner(deps: ProcessRunnerDeps, config: AgentsConfig | undefined, registry?: IProviderRegistry): IAgentProcessRunner {
	const globalProvider = config?.provider;
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;

	return {
		spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess {
			// When registry is available, delegate to it
			if (registry) {
				const selection = registry.select({
					preferred: agent.ai?.provider,
					taskType: "conversation",
					required: { streaming: true },
				});
				return selection.provider.execute({
					prompt: { message: prompt },
					tools: resolvedTools,
					timeout: processTimeout,
					cwd: opts?.cwd,
				});
			}

			// Legacy path — direct spawn (kept for backward compat during migration)
			const provider = resolveProviderLegacy(globalProvider, agent.ai?.provider);
			const tempPath = deps.paths.join(
				deps.paths.resolve("."),
				`.flowti-prompt-${deps.clock.ms()}-${++idCounter}.tmp`,
			);
			deps.disk.writeFileSync(tempPath, prompt, "utf-8");

			let args = withFullAgentCliPermissions(provider.binary, provider.args);
			// If permission engine resolved tools, use them; otherwise fall back to
			// the agent's defined tools so it can actually function.
			const tools = (resolvedTools && resolvedTools.length > 0)
				? [...resolvedTools]
				: (agent.ai?.allowedTools ?? []);
			// Claude Code supports --allowedTools; Cursor Agent CLI does not document this flag.
			if (tools.length > 0 && provider.binary === "claude") {
				args = [...args, "--allowedTools", tools.join(",")];
			}

			const quotedPath = `"${tempPath}"`;
			const cmd = [
				provider.binary,
				...args.map((a) => String(a).includes(" ") ? `"${String(a)}"` : String(a)),
			].join(" ") + ` < ${quotedPath}`;

			const proc = deps.shell.spawnBackground(cmd, opts?.cwd ? { cwd: opts.cwd } : undefined);
			const exitPromise = proc.waitForExit(processTimeout);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const subscribers = new Set<(event: AgentStreamEvent) => void>();

			const dedupeText = provider.binary === "agent";
			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				for (const event of parseStreamEvents(line, streamState)) {
					if (event.kind === "thinking") thinkingBuffer.push(event.text);
					if (event.kind === "text") {
						if (dedupeText) appendAssistantTextSkipFullDuplicate(textBuffer, event.text);
						else textBuffer.push(event.text);
					}
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

		acquireSession(agent: AgentSummary, resolvedTools?: readonly string[], opts?: SpawnOptions): LLMSession | null {
			if (!registry) return null;
			const selection = registry.select({
				preferred: agent.ai?.provider,
				taskType: "conversation",
				required: { streaming: true },
			});
			const caps = selection.provider.capabilities();
			if (!caps.persistentSession || !selection.provider.createSession) return null;
			return selection.provider.createSession({
				tools: resolvedTools,
				timeout: processTimeout,
				cwd: opts?.cwd,
			});
		},
	};
}
