/**
 * agent-shell.ts — IAgentShell interface and related types.
 *
 * Defines the contract for workspace-based agent dispatch, collection,
 * and lifecycle management. Implementations live in infrastructure.
 */

import type { AgentWorkspace } from "./agent-workspace.js";
import type { AgentProcess } from "./worker-types.js";

export interface DispatchRequest {
	readonly agent: string;
	readonly task: string;
	readonly branch?: string;
	readonly baseBranch?: string;
	readonly retain?: boolean;
	readonly allowedTools?: readonly string[];
	readonly timeout?: number;
	readonly provider?: "anthropic" | "cursor";
}

export interface AgentProcessResult {
	readonly text: string;
	readonly thinking: string;
	readonly exitCode: number;
}

export interface DispatchResult {
	readonly workspace: AgentWorkspace;
	readonly process: AgentProcess;
	readonly branch: string;
	readonly output: Promise<AgentProcessResult>;
}

export interface CollectResult {
	readonly commits: readonly string[];
	readonly filesChanged: number;
	readonly conversationTurns: number;
	readonly runtimeState: Record<string, unknown>;
	readonly errors: readonly string[];
}

export interface PruneOptions {
	readonly olderThan?: number;
	readonly state?: "retained" | "disposed";
	readonly dryRun?: boolean;
}

export interface PruneSummary {
	readonly removed: number;
	readonly freed: string;
	readonly skipped: number;
	readonly errors: readonly string[];
}

export interface ReconcileResult {
	readonly recovered: string[];
}

export interface IAgentShell {
	dispatch(request: DispatchRequest): Promise<DispatchResult>;
	list(): AgentWorkspace[];
	collect(workspaceId: string): Promise<CollectResult>;
	dispose(workspaceId: string): Promise<void>;
	prune(options?: PruneOptions): Promise<PruneSummary>;
	reconcileStaleAgents(): ReconcileResult;
}
