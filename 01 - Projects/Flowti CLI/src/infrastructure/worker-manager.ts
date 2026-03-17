/**
 * worker-manager.ts — Persistent reactive worker supervisor.
 *
 * Creates in-memory workers from agent definitions, manages lifecycle,
 * routes messages, fans out world state events through the
 * perception → decision → action pipeline.
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { IWorldStateManager, AgentAction } from "../domain/agents/world-state-types.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { WorkerState, AgentWorker, IWorkerManager, IAgentProcessRunner, SendOptions } from "../domain/agents/worker-types.js";
import { agentStore, readSystemPrompt } from "../domain/agents/agent-store.js";
import { evaluateDecision, getRulesForAgent } from "../domain/agents/decision-engine.js";
import { buildCharacter, buildTaskPrompt, buildResponsePrompt, respondFromState, acknowledge } from "../domain/agents/action-handlers.js";
import { resolvePermissionPolicy, resolveAllowedTools } from "../domain/agents/permission-engine.js";
import { readAgentState, writeAgentState, clearOnceGrants } from "../domain/agents/agent-state.js";
import { parseAgentResponse } from "../domain/agents/agent-conversation.js";

export type WorkerManagerDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

// ── Internal mutable worker state ───────────────────────────────────

interface WorkerImpl {
	readonly name: string;
	readonly agent: AgentSummary;
	state: WorkerState;
	messageQueue: string[];
	failureCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function mapActionToTrigger(actionType: string): string | null {
	if (actionType === "task-started") return "task-assigned";
	return null;
}

function setWorkerState(worker: WorkerImpl, state: WorkerState, worldState: IWorldStateManager): void {
	worker.state = state;
	worldState.updateEntity(worker.name, "agent", { status: { state } });
}

function buildPrompt(
	deps: WorkerManagerDeps,
	vaultRoot: string,
	worker: WorkerImpl,
	message: string,
	opts: SendOptions | undefined,
): string {
	const systemPrompt = readSystemPrompt(deps, vaultRoot, worker.name);
	const character = buildCharacter(worker.agent);
	return opts?.task
		? buildTaskPrompt(worker.name, message, systemPrompt, character)
		: buildResponsePrompt(worker.name, message, systemPrompt, character, []);
}

function handleLlmResult(worker: WorkerImpl, exitCode: number, text: string, worldState: IWorldStateManager): boolean {
	if (exitCode !== 0 && !text) {
		worker.failureCount++;
		if (worker.failureCount >= 3) {
			setWorkerState(worker, "stopped", worldState);
			return true;
		}
		return false;
	}
	worker.failureCount = 0;
	return false;
}

function resolveAgentPermissions(
	deps: WorkerManagerDeps,
	vaultRoot: string,
	worker: WorkerImpl,
): { resolvedTools: readonly string[] } {
	const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
	const agentState = readAgentState(deps, varDir, worker.name);
	const policy = resolvePermissionPolicy(worker.agent.ai?.permissions, agentState.permissionOverride);
	const available = worker.agent.ai?.allowedTools ?? [];
	return { resolvedTools: resolveAllowedTools(policy, agentState.grants, available) };
}

// ── Factory ─────────────────────────────────────────────────────────

export function createWorkerManager(
	deps: WorkerManagerDeps,
	worldState: IWorldStateManager,
	processRunner: IAgentProcessRunner,
	vaultRoot: string,
	config: AgentsConfig | undefined,
): IWorkerManager {
	const workers = new Map<string, WorkerImpl>();

	function spawnWorker(agent: AgentSummary): WorkerImpl {
		const worker: WorkerImpl = {
			name: agent.name,
			agent,
			state: "idle",
			messageQueue: [],
			failureCount: 0,
		};
		workers.set(agent.name, worker);

		worldState.updateEntity(agent.name, "agent", {
			identity: { name: agent.name, persona: agent.persona, type: agent.agentType },
			status: { state: "idle" },
		});

		return worker;
	}

	function toPublicWorker(impl: WorkerImpl): AgentWorker {
		return {
			name: impl.name,
			agent: impl.agent,
			state: impl.state,
			messageQueue: [...impl.messageQueue],
			send(message: string, opts?: SendOptions) { handleSend(impl, message, opts); },
			stop() { impl.state = "stopped"; },
		};
	}

	function handleSend(worker: WorkerImpl, message: string, opts?: SendOptions): void {
		if (worker.state === "stopped") return;
		if (worker.state !== "idle") {
			worker.messageQueue.push(message);
			return;
		}
		processMessage(worker, message, opts);
	}

	function processNpcMessage(worker: WorkerImpl, opts: SendOptions | undefined): void {
		const entity = worldState.getEntity(worker.name);
		const components = entity?.components ?? {};
		const response = respondFromState(worker.name, components);
		opts?.onResponse?.({ message: response, status: "message" });
	}

	async function processLlmMessage(worker: WorkerImpl, message: string, opts: SendOptions | undefined): Promise<void> {
		setWorkerState(worker, "thinking", worldState);

		const prompt = buildPrompt(deps, vaultRoot, worker, message, opts);
		const { resolvedTools } = resolveAgentPermissions(deps, vaultRoot, worker);

		try {
			const proc = processRunner.spawn(worker.agent, prompt, resolvedTools);
			if (opts?.onEvent) proc.onEvent(opts.onEvent);

			setWorkerState(worker, "working", worldState);

			const result = await proc.result;
			const stopped = handleLlmResult(worker, result.exitCode, result.text, worldState);
			if (stopped) return;

			const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
			const freshState = readAgentState(deps, varDir, worker.name);
			const cleared = clearOnceGrants(freshState);
			if (cleared !== freshState) writeAgentState(deps, varDir, worker.name, cleared);

			opts?.onResponse?.(parseAgentResponse(result.text));
		} catch {
			worker.failureCount++;
		}

		if (worker.state !== "stopped") {
			setWorkerState(worker, "idle", worldState);
		}

		drainQueue(worker);
	}

	function processMessage(worker: WorkerImpl, message: string, opts?: SendOptions): void {
		if (worker.agent.agentType !== "ai") {
			processNpcMessage(worker, opts);
			return;
		}
		processLlmMessage(worker, message, opts);
	}

	function drainQueue(worker: WorkerImpl): void {
		if (worker.state !== "idle" || worker.messageQueue.length === 0) return;
		const next = worker.messageQueue.shift()!;
		processMessage(worker, next, undefined);
	}

	function executeDecision(worker: WorkerImpl, decision: string, action: AgentAction): void {
		const task = String(action.data.task ?? "");
		switch (decision) {
			case "execute-task":
				if (task) handleSend(worker, task, { task });
				break;
			case "respond":
			case "respond-from-state": {
				const entity = worldState.getEntity(worker.name);
				deps.log(respondFromState(worker.name, entity?.components ?? {}));
				break;
			}
			case "acknowledge":
				deps.log(acknowledge(worker.name, task));
				break;
		}
	}

	function handleWorldEvent(worker: WorkerImpl, action: AgentAction): void {
		if (worker.state === "stopped") return;

		const trigger = mapActionToTrigger(action.type);
		if (!trigger) return;

		const rules = getRulesForAgent(worker.agent.agentType === "ai");
		const decision = evaluateDecision(trigger, rules);
		if (!decision) return;

		executeDecision(worker, decision, action);
	}

	return {
		spawnAll(): void {
			const agents = agentStore.list(deps, vaultRoot, config ? { dir: config.dir } : undefined);
			for (const agent of agents) {
				if (!workers.has(agent.name)) {
					spawnWorker(agent);
				}
			}
		},

		spawn(agentName: string): AgentWorker | null {
			const agents = agentStore.list(deps, vaultRoot, config ? { dir: config.dir } : undefined);
			const agent = agents.find((a) => a.name === agentName);
			if (!agent) return null;
			const impl = spawnWorker(agent);
			return toPublicWorker(impl);
		},

		stop(agentName: string): void {
			const worker = workers.get(agentName);
			if (!worker) return;
			setWorkerState(worker, "stopped", worldState);
		},

		stopAll(): void {
			for (const worker of workers.values()) {
				setWorkerState(worker, "stopped", worldState);
			}
		},

		getWorker(agentName: string): AgentWorker | null {
			const impl = workers.get(agentName);
			return impl ? toPublicWorker(impl) : null;
		},

		listWorkers(): AgentWorker[] {
			return [...workers.values()].map(toPublicWorker);
		},

		send(agentName: string, message: string, opts?: SendOptions): void {
			const worker = workers.get(agentName);
			if (!worker) return;
			handleSend(worker, message, opts);
		},

		dispatchWorldEvent(event: AgentAction): void {
			for (const worker of workers.values()) {
				if (worker.name === event.agentName) continue;
				handleWorldEvent(worker, event);
			}
		},
	};
}
