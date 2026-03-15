/**
 * worker-types.ts — Types for the agent worker system.
 *
 * Defines worker lifecycle states, event filters, decision rules,
 * and the IWorkerManager / IAgentProcessRunner interfaces.
 */

import type { AgentSummary } from "./agent-types.js";
import type { AgentStreamEvent } from "./agent-stream.js";
import type { AgentResponse } from "./agent-conversation.js";

export type WorkerState = "spawning" | "idle" | "reacting" | "thinking" | "working" | "waiting" | "stopped";

export interface EventFilter {
	readonly entityType?: import("./world-state-types.js").WorldEntityType;
	readonly entityId?: string;
	readonly componentChanged?: string;
	readonly actionType?: import("./world-state-types.js").AgentActionType;
}

export interface DecisionRule {
	readonly trigger: string;
	readonly condition?: string;
	readonly action: string;
	readonly priority: number;
}

export interface SendOptions {
	readonly foreground?: boolean;
	readonly task?: string;
	readonly briefPath?: string;
	readonly onEvent?: (event: AgentStreamEvent) => void;
	readonly onResponse?: (response: AgentResponse) => void;
}

export interface ActionContext {
	readonly trigger: string;
	readonly message?: string;
	readonly task?: string;
	readonly briefPath?: string;
	readonly event?: import("./world-state-types.js").AgentAction;
	readonly foreground: boolean;
}

export interface AgentProcess {
	onEvent(callback: (event: AgentStreamEvent) => void): () => void;
	readonly result: Promise<{ text: string; thinking: string; exitCode: number }>;
	kill(): void;
}

export interface IAgentProcessRunner {
	spawn(agent: AgentSummary, prompt: string): AgentProcess;
}

export interface AgentWorker {
	readonly name: string;
	readonly agent: AgentSummary;
	readonly state: WorkerState;
	readonly messageQueue: readonly string[];
	send(message: string, opts?: SendOptions): void;
	stop(): void;
}

export interface IWorkerManager {
	spawnAll(): void;
	spawn(agentName: string): AgentWorker | null;
	stop(agentName: string): void;
	stopAll(): void;
	getWorker(agentName: string): AgentWorker | null;
	listWorkers(): AgentWorker[];
	send(agentName: string, message: string, opts?: SendOptions): void;
	dispatchWorldEvent(event: import("./world-state-types.js").AgentAction): void;
}
