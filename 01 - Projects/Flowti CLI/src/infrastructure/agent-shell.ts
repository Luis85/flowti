/**
 * agent-shell.ts — Provider-agnostic agent execution layer.
 *
 * Consolidates all CLI process management for agent talk and dispatch.
 * Supports Claude CLI and Cursor (future) via provider resolution.
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { IAgentShell, ProviderConfig, TalkSession, TalkResult, TalkOptions, DispatchHandle, DispatchOptions } from "./types.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import { parseStreamLine, createStreamState, updateStreamState } from "../domain/agents/agent-stream.js";
import { parseAgentResponse } from "../domain/agents/agent-conversation.js";
import { readAgentState, writeAgentState, completeFirstTask } from "../domain/agents/agent-state.js";

export type ShellBaseDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

// ── Provider resolution (exported pure function) ────────────────────

export function resolveProvider(globalDefault?: string, agentProvider?: string): ProviderConfig {
	const provider = agentProvider ?? globalDefault ?? "anthropic";
	switch (provider) {
		case "anthropic": return {
			binary: "claude",
			streamArgs: ["-p", "--output-format", "stream-json", "--verbose"],
			textArgs: ["--print"],
		};
		case "cursor": return {
			binary: "cursor",
			streamArgs: ["--print", "--json"],
			textArgs: ["--print"],
		};
		default: return {
			binary: provider,
			streamArgs: ["-p"],
			textArgs: ["--print"],
		};
	}
}

// ── Inbox note writer ───────────────────────────────────────────────

function writeInboxNote(
	deps: ShellBaseDeps, vaultRoot: string, agentName: string,
	persona: string | undefined, task: string | undefined,
	responseText: string, thinkingText: string,
): void {
	const parsed = parseAgentResponse(responseText);
	const inboxDir = deps.paths.join(vaultRoot, "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) deps.disk.mkdirSync(inboxDir, { recursive: true });
	const who = persona ?? agentName;
	const slug = `${who.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${deps.clock.ms()}`;
	const lines = [
		"---", `type: agent-note`, `from: ${agentName}`, `persona: ${who}`,
		`date: ${deps.clock.iso()}`,
	];
	if (task) lines.push(`task: ${task}`);
	lines.push(`status: ${parsed.status}`, "---", "", `# Note from ${who}`, "");
	if (task) lines.push(`**Task**: ${task}`, "");
	lines.push(parsed.message);
	if (thinkingText) {
		lines.push("", "---", "", "## Thinking", "", `> ${thinkingText.slice(0, 500)}${thinkingText.length > 500 ? "..." : ""}`);
	}
	lines.push("");
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}

function writeSystemInboxNote(
	deps: ShellBaseDeps, vaultRoot: string, agentName: string, message: string,
): void {
	const inboxDir = deps.paths.join(vaultRoot, "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) deps.disk.mkdirSync(inboxDir, { recursive: true });
	const slug = `system-${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${deps.clock.ms()}`;
	const lines = [
		"---", `type: agent-note`, `from: system`, `persona: ${agentName}`,
		`date: ${deps.clock.iso()}`, `status: message`, "---", "",
		`# System Note — ${agentName}`, "", message, "",
	];
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}

// ── Factory ─────────────────────────────────────────────────────────

export function createAgentShell(deps: ShellBaseDeps, config: AgentsConfig | undefined, vaultRoot: string): IAgentShell {
	const activeDispatches = new Map<string, DispatchHandle>();
	const globalProvider = config?.provider;
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;
	const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
	const failureCounts = new Map<string, number>();

	function buildCommand(providerConfig: ProviderConfig, agent: AgentSummary, inputPath: string): string {
		const args = [...providerConfig.streamArgs];
		if (agent.ai?.allowedTools && agent.ai.allowedTools.length > 0) {
			args.push("--allowedTools", agent.ai.allowedTools.join(","));
		}
		const quotedPath = inputPath.includes(" ") ? `"${inputPath}"` : inputPath;
		return [providerConfig.binary, ...args.map((a) => String(a).includes(" ") ? `"${String(a)}"` : String(a))].join(" ") + ` < ${quotedPath}`;
	}

	function createEventEmitter(): { subscribers: Set<(event: AgentStreamEvent) => void>; emit: (event: AgentStreamEvent) => void } {
		const subscribers = new Set<(event: AgentStreamEvent) => void>();
		return {
			subscribers,
			emit(event: AgentStreamEvent): void {
				for (const cb of subscribers) {
					try { cb(event); } catch { /* subscriber error — don't crash shell */ }
				}
			},
		};
	}

	function setAgentStatus(agentName: string, status: "busy" | "idle"): void {
		try {
			const state = readAgentState(deps, varDir, agentName);
			writeAgentState(deps, varDir, agentName, { ...state, status });
		} catch { /* state update best-effort */ }
	}

	const shell: IAgentShell = {
		talk(agent: AgentSummary, prompt: string, opts?: TalkOptions): TalkSession {
			const providerConfig = resolveProvider(globalProvider, agent.ai?.provider);
			const tempPath = deps.paths.join(deps.paths.resolve("."), `.flowti-talk-${deps.clock.ms()}.tmp`);
			deps.disk.writeFileSync(tempPath, prompt, "utf-8");

			const cmd = buildCommand(providerConfig, agent, tempPath);
			const proc = deps.shell.spawnBackground(cmd);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const { subscribers, emit } = createEventEmitter();
			let detached = false;
			let detachResolve: (() => void) | null = null;

			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				const event = parseStreamLine(line, streamState);
				if (!event) return;
				if (event.kind === "thinking") thinkingBuffer.push(event.text);
				if (event.kind === "text") textBuffer.push(event.text);
				if (!detached) emit(event);
			});

			// Rolling idle timeout
			const idleMs = opts?.idleTimeoutMs ?? 120_000;
			let idleTimer: ReturnType<typeof setTimeout>;
			let idleResolve: () => void;
			const idlePromise = new Promise<void>((resolve) => {
				idleResolve = resolve;
				idleTimer = setTimeout(resolve, idleMs);
			});
			proc.onOutput(() => {
				clearTimeout(idleTimer);
				idleTimer = setTimeout(idleResolve, idleMs);
			});

			const detachPromise = new Promise<void>((resolve) => { detachResolve = resolve; });

			const resultPromise: Promise<TalkResult | null> = (async () => {
				const exitPromise = proc.waitForExit(processTimeout);

				const winner = await Promise.race([
					exitPromise.then(() => "completed" as const),
					detachPromise.then(() => "detached" as const),
					idlePromise.then(() => "idle" as const),
				]);
				clearTimeout(idleTimer!);

				if (winner === "detached" || winner === "idle") {
					// Promote to dispatch — register synchronously
					detached = true;
					const handle: DispatchHandle = {
						onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
						sessionId: `detach-${deps.clock.ms()}`,
						agentName: agent.name,
						task: "talk (detached)",
						get running() { return proc.running; },
						stop() { proc.kill(); },
					};
					activeDispatches.set(agent.name, handle);
					setAgentStatus(agent.name, "busy");

					// Background completion handler
					proc.waitForExit(processTimeout).then(() => {
						const accumulated = textBuffer.join("");
						if (accumulated) {
							writeInboxNote(deps, vaultRoot, agent.name, opts?.character?.persona, undefined, accumulated, thinkingBuffer.join(""));
						}
						setAgentStatus(agent.name, "idle");
						activeDispatches.delete(agent.name);
						try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
					}).catch(() => {
						activeDispatches.delete(agent.name);
						try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
					});

					return { response: { message: "", status: "message" as const }, thinking: "", detached: true };
				}

				// Completed
				try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
				const exitCode = await exitPromise;
				if (exitCode !== 0) return null;
				const accumulated = textBuffer.join("");
				if (!accumulated) return null;
				return { response: parseAgentResponse(accumulated), thinking: thinkingBuffer.join(""), detached: false };
			})();

			return {
				onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
				result: resultPromise,
				detach() { if (detachResolve) detachResolve(); },
			};
		},

		dispatch(agent: AgentSummary, briefPath: string, task: string, opts?: DispatchOptions): DispatchHandle {
			const providerConfig = resolveProvider(globalProvider, agent.ai?.provider);
			const cmd = buildCommand(providerConfig, agent, briefPath);
			const proc = deps.shell.spawnBackground(cmd);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const events: Array<AgentStreamEvent & { ts: string }> = [];
			let lastUsage: { inputTokens: number; outputTokens: number } | undefined;
			const { subscribers, emit } = createEventEmitter();

			const sessionId = `dispatch-${deps.clock.ms()}`;

			// Register SYNCHRONOUSLY before any async handlers
			const handle: DispatchHandle = {
				onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
				sessionId,
				agentName: agent.name,
				task,
				get running() { return proc.running; },
				stop() { proc.kill(); },
			};
			activeDispatches.set(agent.name, handle);
			setAgentStatus(agent.name, "busy");

			// Create session if iterDir provided (async — fire and forget)
			if (opts?.iterDir && opts.iterationNumber !== undefined) {
				const iterDir = opts.iterDir;
				const iterNum = opts.iterationNumber;
				import("../domain/agents/agent-session.js").then(({ createSession, updateSessionStatus, appendStructuredOutput }) => {
					const session = createSession(deps, iterDir, agent.name, iterNum, briefPath);
					updateSessionStatus(deps, iterDir, session.id, "running");
					proc.waitForExit(processTimeout).then(() => {
						if (events.length > 0) appendStructuredOutput(deps, iterDir, session.id, events, lastUsage);
						updateSessionStatus(deps, iterDir, session.id, "completed");
					}).catch(() => {
						updateSessionStatus(deps, iterDir, session.id, "failed");
					});
				}).catch(() => { /* session tracking best-effort */ });
			}

			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				const event = parseStreamLine(line, streamState);
				if (!event) return;
				if (event.kind === "thinking") thinkingBuffer.push(event.text);
				if (event.kind === "text") textBuffer.push(event.text);
				if (event.kind === "usage") lastUsage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
				events.push({ ...event, ts: deps.clock.iso() });
				emit(event);
			});

			// Background completion — inbox note + state cleanup + auto-dequeue
			proc.waitForExit(processTimeout).then((exitCode) => {
				const accumulated = textBuffer.join("");
				if (accumulated) {
					writeInboxNote(deps, vaultRoot, agent.name, agent.persona, task, accumulated, thinkingBuffer.join(""));
				}

				// Mark current task done
				let state = readAgentState(deps, varDir, agent.name);
				state = completeFirstTask(state, task);
				writeAgentState(deps, varDir, agent.name, state);

				// Track failures for auto-dequeue guard
				const failed = exitCode !== 0 && !accumulated;
				if (failed) {
					failureCounts.set(agent.name, (failureCounts.get(agent.name) ?? 0) + 1);
				} else {
					failureCounts.delete(agent.name);
				}

				if ((failureCounts.get(agent.name) ?? 0) >= 3) {
					writeSystemInboxNote(deps, vaultRoot, agent.name, "Auto-dequeue stopped after repeated failures.");
					setAgentStatus(agent.name, "idle");
					activeDispatches.delete(agent.name);
					failureCounts.delete(agent.name);
					return;
				}

				// Check for next pending task
				const nextTask = state.tasks.find((t) => t.status === "pending");
				if (nextTask && deps.disk.existsSync(briefPath)) {
					writeSystemInboxNote(deps, vaultRoot, agent.name, `Starting next task: ${nextTask.name}`);
					setTimeout(() => {
						// Re-read state to guard against manual intervention during cooldown
						const freshState = readAgentState(deps, varDir, agent.name);
						const stillPending = freshState.tasks.find((t) => t.name === nextTask.name && t.status === "pending");
						if (!stillPending) {
							setAgentStatus(agent.name, "idle");
							activeDispatches.delete(agent.name);
							return;
						}
						// Mark in-progress and re-dispatch
						const updated = {
							...freshState,
							tasks: freshState.tasks.map((t) =>
								t.name === nextTask.name && t.status === "pending"
									? { ...t, status: "in-progress" as const }
									: t
							),
						};
						writeAgentState(deps, varDir, agent.name, updated);
						activeDispatches.delete(agent.name);
						shell.dispatch(agent, briefPath, nextTask.name, opts);
					}, 10_000);
				} else {
					setAgentStatus(agent.name, "idle");
					activeDispatches.delete(agent.name);
				}
			}).catch(() => {
				activeDispatches.delete(agent.name);
			});

			return handle;
		},

		getActiveDispatch(agentName: string): DispatchHandle | null {
			return activeDispatches.get(agentName) ?? null;
		},

		reconcileStaleAgents(): { recovered: string[] } {
			const recovered: string[] = [];
			if (!deps.disk.existsSync(varDir)) return { recovered };
			const files = deps.disk.readdirSync(varDir).filter((f) => f.startsWith("data-") && f.endsWith(".json"));
			for (const file of files) {
				try {
					const content = deps.disk.readFileSync(deps.paths.join(varDir, file), "utf-8");
					const raw = JSON.parse(content) as { name?: string; status?: string };
					if (raw.status !== "busy" || !raw.name) continue;
					if (activeDispatches.has(raw.name)) continue;
					const state = readAgentState(deps, varDir, raw.name);
					writeAgentState(deps, varDir, raw.name, { ...state, status: "idle" });
					writeSystemInboxNote(deps, vaultRoot, raw.name, "Process was interrupted. Recovered to idle.");
					recovered.push(raw.name);
				} catch { /* corrupt file — skip */ }
			}
			return { recovered };
		},
	};

	return shell;
}
