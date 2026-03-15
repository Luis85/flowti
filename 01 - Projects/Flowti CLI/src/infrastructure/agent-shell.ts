/**
 * agent-shell.ts — Provider-agnostic agent execution layer.
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { IAgentShell, ProviderConfig, TalkSession, TalkResult, TalkOptions, DispatchHandle, DispatchOptions, PendingQuestion } from "./types.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import { parseStreamLine, createStreamState, updateStreamState } from "../domain/agents/agent-stream.js";
import { parseAgentResponse, buildConversationPrompt } from "../domain/agents/agent-conversation.js";
import type { AgentCharacter } from "../domain/agents/agent-conversation.js";
import { readAgentState, writeAgentState, completeFirstTask } from "../domain/agents/agent-state.js";
import type { AgentPendingQuestion } from "../domain/agents/agent-state.js";
import { mapStreamEventToAction } from "../domain/agents/action-mapper.js";
import type { IWorldStateManager } from "../domain/agents/world-state-types.js";

export type ShellBaseDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

export function resolveProvider(globalDefault?: string, agentProvider?: string): ProviderConfig {
	const provider = agentProvider ?? globalDefault ?? "anthropic";
	switch (provider) {
		case "anthropic": return { binary: "claude", streamArgs: ["-p", "--output-format", "stream-json", "--verbose"], textArgs: ["--print"] };
		case "cursor": return { binary: "cursor", streamArgs: ["--print", "--json"], textArgs: ["--print"] };
		default: return { binary: provider, streamArgs: ["-p"], textArgs: ["--print"] };
	}
}

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
	const lines = ["---", `type: agent-note`, `from: ${agentName}`, `persona: ${who}`, `date: ${deps.clock.iso()}`];
	if (task) lines.push(`task: ${task}`);
	lines.push(`status: ${parsed.status}`, "---", "", `# Note from ${who}`, "");
	if (task) lines.push(`**Task**: ${task}`, "");
	lines.push(parsed.message);
	if (thinkingText) lines.push("", "---", "", "## Thinking", "", `> ${thinkingText.slice(0, 500)}${thinkingText.length > 500 ? "..." : ""}`);
	lines.push("");
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}

function writeSystemInboxNote(deps: ShellBaseDeps, vaultRoot: string, agentName: string, message: string): void {
	const inboxDir = deps.paths.join(vaultRoot, "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) deps.disk.mkdirSync(inboxDir, { recursive: true });
	const slug = `system-${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${deps.clock.ms()}`;
	const lines = ["---", `type: agent-note`, `from: system`, `persona: ${agentName}`, `date: ${deps.clock.iso()}`, `status: message`, "---", "", `# System Note — ${agentName}`, "", message, ""];
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}

function collectPersistedQuestions(deps: ShellBaseDeps, varDir: string, notifications: Map<string, PendingQuestion>): PendingQuestion[] {
	const result = [...notifications.values()];
	if (!deps.disk.existsSync(varDir)) return result;
	const files = deps.disk.readdirSync(varDir).filter((f) => f.startsWith("data-") && f.endsWith(".json"));
	for (const file of files) {
		try {
			const content = deps.disk.readFileSync(deps.paths.join(varDir, file), "utf-8");
			const raw = JSON.parse(content) as { name?: string; status?: string; pendingQuestion?: AgentPendingQuestion };
			if (raw.status === "waiting" && raw.name && raw.pendingQuestion && !notifications.has(raw.name)) {
				result.push({
					agentName: raw.name, question: raw.pendingQuestion.question,
					briefPath: raw.pendingQuestion.briefPath, task: raw.pendingQuestion.task,
					agent: { name: raw.name, agentType: "ai", description: "", skills: [], tools: [], roles: [], file: "" } as AgentSummary,
					opts: raw.pendingQuestion.iterDir ? { iterDir: raw.pendingQuestion.iterDir, iterationNumber: raw.pendingQuestion.iterationNumber } : undefined,
				});
			}
		} catch { /* corrupt file */ }
	}
	return result;
}

async function resolveAgentSummary(deps: ShellBaseDeps, vaultRoot: string, pending: PendingQuestion | undefined, agentName: string): Promise<AgentSummary | null> {
	if (pending?.agent && pending.agent.file) return pending.agent;
	try {
		const { findAgent } = await import("../domain/agents/agent-store.js");
		return findAgent(deps, vaultRoot, agentName);
	} catch { return null; }
}

function pickStr(a: string | undefined, b: string | undefined): string { return a ?? b ?? ""; }

function pickOpts(pending: PendingQuestion | undefined, pq: AgentPendingQuestion | undefined): DispatchOptions | undefined {
	if (pending?.opts) return pending.opts;
	return pq?.iterDir ? { iterDir: pq.iterDir, iterationNumber: pq.iterationNumber } : undefined;
}

async function handleAnswer(
	deps: ShellBaseDeps, vaultRoot: string, varDir: string, notifications: Map<string, PendingQuestion>,
	agentName: string, answer: string, shellRef: IAgentShell, idCounter: { value: number },
): Promise<void> {
	const state = readAgentState(deps, varDir, agentName);
	if (state.status !== "waiting") return;
	const pending = notifications.get(agentName);
	const pq = state.pendingQuestion;
	const question = pickStr(pending?.question, pq?.question);
	const task = pickStr(pending?.task, pq?.task);
	const dispatchOpts = pickOpts(pending, pq);
	const agentSummary = await resolveAgentSummary(deps, vaultRoot, pending, agentName);
	if (!agentSummary) return;
	const { readSystemPrompt } = await import("../domain/agents/agent-store.js");
	const systemPrompt = readSystemPrompt(deps, vaultRoot, agentName);
	const character: AgentCharacter = {
		description: agentSummary.description, persona: agentSummary.persona,
		mood: agentSummary.mood, personality: agentSummary.personality,
		attributes: agentSummary.attributes, experience: agentSummary.experience,
	};
	const prompt = buildConversationPrompt(agentName, systemPrompt, [{ role: "agent" as const, content: question }], answer, character);
	const tempPath = deps.paths.join(deps.paths.resolve("."), `.flowti-answer-${deps.clock.ms()}-${++idCounter.value}.tmp`);
	deps.disk.writeFileSync(tempPath, prompt, "utf-8");
	notifications.delete(agentName);
	writeAgentState(deps, varDir, agentName, { ...state, status: "busy", pendingQuestion: undefined });
	shellRef.dispatch(agentSummary, tempPath, task, dispatchOpts);
}

interface DispatchCompletionCtx {
	deps: ShellBaseDeps; vaultRoot: string; varDir: string; agentName: string;
	persona: string | undefined; task: string; briefPath: string;
	accumulated: string; thinkingText: string; exitCode: number;
	agent: AgentSummary; opts: DispatchOptions | undefined;
	failureCounts: Map<string, number>; pendingNotifications: Map<string, PendingQuestion>;
	activeDispatches: Map<string, DispatchHandle>; setAgentStatus: (name: string, status: "busy" | "idle") => void;
	shellRef: IAgentShell; worldState?: IWorldStateManager; idCounter: { value: number };
}

function handleDispatchQuestion(ctx: DispatchCompletionCtx, message: string): void {
	const pq: AgentPendingQuestion = { question: message, briefPath: ctx.briefPath, task: ctx.task, iterDir: ctx.opts?.iterDir, iterationNumber: ctx.opts?.iterationNumber };
	const qState = readAgentState(ctx.deps, ctx.varDir, ctx.agentName);
	writeAgentState(ctx.deps, ctx.varDir, ctx.agentName, { ...qState, status: "waiting", pendingQuestion: pq });
	ctx.pendingNotifications.set(ctx.agentName, { agentName: ctx.agentName, persona: ctx.persona, question: message, agent: ctx.agent, briefPath: ctx.briefPath, task: ctx.task, opts: ctx.opts });
	writeSystemInboxNote(ctx.deps, ctx.vaultRoot, ctx.agentName, `Question: ${message}`);
	ctx.activeDispatches.delete(ctx.agentName);
}

function emitWorldAction(ctx: DispatchCompletionCtx, type: "task-completed" | "task-started", data: Record<string, unknown>): void {
	if (!ctx.worldState) return;
	ctx.worldState.emitAction({ id: `task-${ctx.deps.clock.ms()}-${++ctx.idCounter.value}`, agentName: ctx.agentName, timestamp: ctx.deps.clock.iso(), type, data });
}

function handleDispatchCompletion(ctx: DispatchCompletionCtx): void {
	if (ctx.accumulated) writeInboxNote(ctx.deps, ctx.vaultRoot, ctx.agentName, ctx.persona, ctx.task, ctx.accumulated, ctx.thinkingText);
	const response = parseAgentResponse(ctx.accumulated);
	if (response.status === "question") { handleDispatchQuestion(ctx, response.message); return; }
	let state = readAgentState(ctx.deps, ctx.varDir, ctx.agentName);
	state = completeFirstTask(state, ctx.task);
	state = { ...state, pendingQuestion: undefined };
	writeAgentState(ctx.deps, ctx.varDir, ctx.agentName, state);
	emitWorldAction(ctx, "task-completed", { task: ctx.task });
	const failed = ctx.exitCode !== 0 && !ctx.accumulated;
	if (failed) { ctx.failureCounts.set(ctx.agentName, (ctx.failureCounts.get(ctx.agentName) ?? 0) + 1); } else { ctx.failureCounts.delete(ctx.agentName); }
	if ((ctx.failureCounts.get(ctx.agentName) ?? 0) >= 3) {
		writeSystemInboxNote(ctx.deps, ctx.vaultRoot, ctx.agentName, "Auto-dequeue stopped after repeated failures.");
		ctx.setAgentStatus(ctx.agentName, "idle"); ctx.activeDispatches.delete(ctx.agentName); ctx.failureCounts.delete(ctx.agentName);
		return;
	}
	const nextTask = state.tasks.find((t) => t.status === "pending");
	if (nextTask && ctx.deps.disk.existsSync(ctx.briefPath)) {
		writeSystemInboxNote(ctx.deps, ctx.vaultRoot, ctx.agentName, `Starting next task: ${nextTask.name}`);
		setTimeout(() => {
			const freshState = readAgentState(ctx.deps, ctx.varDir, ctx.agentName);
			const stillPending = freshState.tasks.find((t) => t.name === nextTask.name && t.status === "pending");
			if (!stillPending) { ctx.setAgentStatus(ctx.agentName, "idle"); ctx.activeDispatches.delete(ctx.agentName); return; }
			const updated = { ...freshState, tasks: freshState.tasks.map((t) => t.name === nextTask.name && t.status === "pending" ? { ...t, status: "in-progress" as const } : t) };
			writeAgentState(ctx.deps, ctx.varDir, ctx.agentName, updated);
			ctx.activeDispatches.delete(ctx.agentName);
			ctx.shellRef.dispatch(ctx.agent, ctx.briefPath, nextTask.name, ctx.opts);
		}, 10_000);
	} else { ctx.setAgentStatus(ctx.agentName, "idle"); ctx.activeDispatches.delete(ctx.agentName); }
}

export function createAgentShell(deps: ShellBaseDeps, config: AgentsConfig | undefined, vaultRoot: string, worldState?: IWorldStateManager): IAgentShell {
	const activeDispatches = new Map<string, DispatchHandle>();
	const globalProvider = config?.provider;
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;
	const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
	const failureCounts = new Map<string, number>();
	const pendingNotifications = new Map<string, PendingQuestion>();
	const idCounter = { value: 0 };

	function buildCommand(providerConfig: ProviderConfig, agent: AgentSummary, inputPath: string): string {
		const args = [...providerConfig.streamArgs];
		if (agent.ai?.allowedTools && agent.ai.allowedTools.length > 0) args.push("--allowedTools", agent.ai.allowedTools.join(","));
		const quotedPath = `"${inputPath}"`;
		return [providerConfig.binary, ...args.map((a) => String(a).includes(" ") ? `"${String(a)}"` : String(a))].join(" ") + ` < ${quotedPath}`;
	}

	function createEventEmitter(): { subscribers: Set<(event: AgentStreamEvent) => void>; emit: (event: AgentStreamEvent) => void } {
		const subscribers = new Set<(event: AgentStreamEvent) => void>();
		return {
			subscribers,
			emit(event: AgentStreamEvent): void { for (const cb of subscribers) { try { cb(event); } catch { /* subscriber error */ } } },
		};
	}

	function setAgentStatus(agentName: string, status: "busy" | "idle"): void {
		try { const state = readAgentState(deps, varDir, agentName); writeAgentState(deps, varDir, agentName, { ...state, status }); } catch { /* best-effort */ }
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
				if (worldState) { const action = mapStreamEventToAction(agent.name, event, deps.clock); if (action) worldState.emitAction(action); }
			});
			const idleMs = opts?.idleTimeoutMs ?? 120_000;
			let idleTimer: ReturnType<typeof setTimeout>;
			let idleResolve: () => void;
			const idlePromise = new Promise<void>((resolve) => { idleResolve = resolve; idleTimer = setTimeout(resolve, idleMs); });
			proc.onOutput(() => { clearTimeout(idleTimer); idleTimer = setTimeout(idleResolve, idleMs); });
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
					detached = true;
					const handle: DispatchHandle = {
						onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
						sessionId: `detach-${deps.clock.ms()}`, agentName: agent.name, task: "talk (detached)",
						get running() { return proc.running; }, stop() { proc.kill(); },
					};
					activeDispatches.set(agent.name, handle);
					setAgentStatus(agent.name, "busy");
					proc.waitForExit(processTimeout).then(() => {
						const accumulated = textBuffer.join("");
						if (accumulated) writeInboxNote(deps, vaultRoot, agent.name, opts?.character?.persona, undefined, accumulated, thinkingBuffer.join(""));
						setAgentStatus(agent.name, "idle");
						activeDispatches.delete(agent.name);
						try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ }
					}).catch(() => { activeDispatches.delete(agent.name); try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup */ } });
					return { response: { message: "", status: "message" as const }, thinking: "", detached: true };
				}
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
			pendingNotifications.delete(agent.name);
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
			const handle: DispatchHandle = {
				onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
				sessionId, agentName: agent.name, task,
				get running() { return proc.running; }, stop() { proc.kill(); },
			};
			activeDispatches.set(agent.name, handle);
			setAgentStatus(agent.name, "busy");
			if (worldState) worldState.emitAction({ id: `task-${deps.clock.ms()}-${++idCounter.value}`, agentName: agent.name, timestamp: deps.clock.iso(), type: "task-started", data: { task } });
			if (opts?.iterDir && opts.iterationNumber !== undefined) {
				const iterDir = opts.iterDir;
				const iterNum = opts.iterationNumber;
				import("../domain/agents/agent-session.js").then(({ createSession, updateSessionStatus, appendStructuredOutput }) => {
					const session = createSession(deps, iterDir, agent.name, iterNum, briefPath);
					updateSessionStatus(deps, iterDir, session.id, "running");
					proc.waitForExit(processTimeout).then(() => {
						if (events.length > 0) appendStructuredOutput(deps, iterDir, session.id, events, lastUsage);
						updateSessionStatus(deps, iterDir, session.id, "completed");
					}).catch(() => { updateSessionStatus(deps, iterDir, session.id, "failed"); });
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
				if (worldState) { const action = mapStreamEventToAction(agent.name, event, deps.clock); if (action) worldState.emitAction(action); }
			});
			proc.waitForExit(processTimeout).then((exitCode) => {
				handleDispatchCompletion({
					deps, vaultRoot, varDir, agentName: agent.name, persona: agent.persona,
					task, briefPath, accumulated: textBuffer.join(""), thinkingText: thinkingBuffer.join(""),
					exitCode, agent, opts, failureCounts, pendingNotifications, activeDispatches,
					setAgentStatus, shellRef: shell, worldState, idCounter,
				});
			}).catch(() => { activeDispatches.delete(agent.name); });
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
					if (raw.status === "waiting") continue;
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

		pendingQuestions(): PendingQuestion[] {
			return collectPersistedQuestions(deps, varDir, pendingNotifications);
		},

		async answerAgent(agentName: string, answer: string): Promise<void> {
			await handleAnswer(deps, vaultRoot, varDir, pendingNotifications, agentName, answer, shell, idCounter);
		},
	};

	return shell;
}
